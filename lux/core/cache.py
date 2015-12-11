import json
import logging
import asyncio

from copy import copy
from inspect import isfunction

from pulsar.apps.data import parse_store_url, create_store, LockError
from pulsar.utils.importer import module_attribute
from pulsar.utils.string import to_string
from pulsar import ImproperlyConfigured

from .wrappers import WsgiRequest


__all__ = ['cached', 'Cacheable', 'Cache', 'register_cache']


logger = logging.getLogger('lux.cache')

data_caches = {}


def cached(*args, **kw):
    '''Decorator to apply to Router's methods for
    caching the return value
    '''
    if len(args) == 1 and not kw and isfunction(args[0]):
        cache = CacheObject()
        return cache(args[0])
    else:
        return CacheObject(*args, **kw)


class Cache:

    def __init__(self, app, name, url):
        self.app = app
        self.name = name

    def ping(self):
        return True

    def set(self, key, value, **params):
        pass

    def get(self, key):
        pass

    def delete(self, key):
        '''Delete a key from the cache'''
        pass

    def hmset(self, key, iterable):
        pass

    def hmget(self, key, *fields):
        pass

    def set_json(self, key, value, timeout=None):
        value = json.dumps(value)
        self.set(key, value, timeout=timeout)

    def get_json(self, key):
        value = self.get(key)
        if value is not None:
            try:
                return json.loads(to_string(value))
            except Exception:
                self.app.logger.warning('Could not convert to JSON: %s',
                                        value)

    def lock(self, name, timeout=None):
        raise NotImplementedError


class AsyncLock:

    def __init__(self, name, loop=None, timeout=None, blocking=0, sleep=0.2):
        self._timeout = timeout
        self._blocking = blocking
        self._loop = loop or asyncio.get_event_loop()
        self._lock = self._get_lock(name)

        self._acquired = False
        self._timeout_handler = None
        # Sleep is ignored, this parameter is not needed, but might be passed
        # in as RedisLock needs it

    @property
    def _locks(self):
        if not hasattr(self._loop, '_locks'):
            self._loop._locks = {}
        return self._loop._locks

    @asyncio.coroutine
    def acquire(self):
        try:
            yield from asyncio.wait_for(self._lock.acquire(),
                                        timeout=self._blocking)
            self._acquired = True
            self._schedule_timeout()
            return True
        except asyncio.TimeoutError:
            return False

    def release(self):
        if not self._acquired:
            raise LockError('Trying to release an unacquired lock')
        try:
            self._lock.release()
            self._cancel_timeout()
        except RuntimeError as exc:
            raise LockError(str(exc)) from exc
        finally:
            self._acquired = False

    def _get_lock(self, name):
        if name not in self._locks:
            self._locks[name] = asyncio.Lock(loop=self._loop)
        return self._locks[name]

    def _schedule_timeout(self):
        if self._timeout is None:
            return
        self._timeout_future = self._loop.call_later(
            self._timeout, self._release_after_timeout
        )

    def _cancel_timeout(self):
        if self._timeout_handler:
            self._timeout_handler.cancel()
            self._timeout_handler = None

    def _release_after_timeout(self):
        if self._acquired:
            self.release()


class DummyCache(Cache):

    def __init__(self, app, name, url):
        super().__init__(app, name, url)
        if app.green_pool:
            from pulsar.apps.greenio import wait
            self._wait = wait
        else:
            self._loop = asyncio.get_event_loop()

    def lock(self, name, **kwargs):
        return GreenLock(AsyncLock(name, **kwargs), self._wait)

    def _wait(self, coro):
        return self._loop.run_until_complete(coro)


class GreenLock:

    def __init__(self, lock, wait):
        self._lock = lock
        self._wait = wait

    def __enter__(self):
        if not self.acquire():
            raise TimeoutError()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.release()

    def acquire(self):
        return self._wait(self._lock.acquire())

    def release(self):
        return self._wait(self._lock.release())


class RedisCache(Cache):

    def __init__(self, app, name, url):
        super().__init__(app, name, url)
        if app.green_pool:
            from pulsar.apps.greenio import wait
            self._wait = wait
            self.client = create_store(url).client()
        else:
            import redis
            self.client = redis.StrictRedis.from_url(url)

    def set(self, key, value, timeout=None):
        self._wait(self.client.set(key, value, timeout))

    def get(self, key):
        return self._wait(self.client.get(key))

    def delete(self, key):
        return self._wait(self.client.delete(key))

    def hmset(self, key, iterable, timeout=None):
        self._wait(self.client.hmset(key, iterable, timeout))

    def hmget(self, key, *fields):
        return self._wait(self.client.hmset(key, *fields))

    def lock(self, name, **kwargs):
        return GreenLock(self.client.lock(name, **kwargs), self._wait)

    def _wait(self, value):
        return value


class Cacheable:
    '''An class which can create its how cache key
    '''
    def cache_key(self, app):
        return ''


class CacheObject:
    '''Object which implement cache functionality on callables.

    A callable can be either a method or a function
    '''
    instance = None
    callable = None

    def __init__(self, user=False, timeout=None):
        self.user = user
        self.timeout = timeout

    def cache_key(self, app):
        key = ''
        if isinstance(self.instance, Cacheable):
            key = self.instance.cache_key(app.app)

        if isinstance(app, WsgiRequest):
            if not key:
                key = app.path
            if self.user:
                key = '%s:%s' % (key, app.cache.user)

        base = self.callable.__name__
        if self.instance:
            base = '%s:%s' % (type(self.instance).__name__, base)

        base = '%s:%s' % (app.config['APP_NAME'], base)
        key = '%s:%s' % (base, key) if key else base
        return key.lower()

    def __call__(self, callable, *args, **kw):
        if self.callable is None:
            assert not args and not kw
            self.callable = callable
            return self

        app = callable

        if not hasattr(callable, 'cache_server'):
            try:
                if self.instance:
                    app = self.instance.app
                else:
                    raise AttributeError
            except AttributeError:
                app = None
                logger.error('Could not obtain application from first '
                             'parameter nor from bound instance')

        args = (callable,) + args
        if self.instance:
            args = (self.instance,) + args

        if app:
            key = self.cache_key(app)
            result = app.cache_server.get_json(key)
            if result is not None:
                return result

        result = self.callable(*args, **kw)

        if app:
            timeout = self.timeout
            if timeout in app.config:
                timeout = app.config[timeout]
            try:
                int(timeout)
            except Exception:
                timeout = app.config['DEFAULT_CACHE_TIMEOUT']

            try:
                app.cache_server.set_json(key, result, timeout=timeout)
            except TypeError:
                app.logger.exception('Could not convert to JSON a value to '
                                     'set in cache')
            except Exception:
                app.logger.exception('Critical exception while setting cache')

        return result

    def __get__(self, instance, objtype):
        obj = copy(self)
        obj.instance = instance
        return obj


def create_cache(app, url):
    if isinstance(url, Cache):
        return url
    scheme, _, _ = parse_store_url(url)
    dotted_path = data_caches.get(scheme)
    if not dotted_path:
        raise ImproperlyConfigured('%s cache not available' % scheme)
    store_class = module_attribute(dotted_path)
    if not store_class:
        raise ImproperlyConfigured('"%s" store not available' % dotted_path)
    return store_class(app, scheme, url)


def register_cache(name, dotted_path):
    '''Register a new :class:`.Cache` with ``name`` which
    can be found at the python ``dotted_path``.
    '''
    data_caches[name] = dotted_path


register_cache('dummy', 'lux.core.cache.DummyCache')
register_cache('redis', 'lux.core.cache.RedisCache')
