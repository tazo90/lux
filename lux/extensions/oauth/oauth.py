'''OAuth account handling
'''

__all__ = ['OAuth1', 'OAuth2', 'register_oauth']


class OAuth1(object):
    '''OAuth version 1
    '''
    version = 1
    auth_uri = None
    token_uri = None
    config = []

    def __init__(self, config):
        self.config = config or {}

    def available(self):
        '''Check if this Oauth handler has the correct configuration parameters
        '''
        return self.config.get('key') and self.config.get('secret')

    def add_meta_tags(self, request, doc):
        '''Add meta tags to the HTML5 document
        '''
        pass

    def authorization_url(self, request, redirect_uri):
        oauth = self.oauth()
        token = oauth.fetch_request_token(self.request_token_uri)
        owner_key = token.get('oauth_token')
        owner_secret = token.get('oauth_token_secret')
        cache = request.cache_server
        cache.add(key=owner_key, value=owner_secret, time=600)
        return oauth.authorization_url(self.auth_uri)

    def access_token(self, request, data, redirect_uri=None):
        oauth_token = data['oauth_token']
        cache = request.cache_server
        oauth_secret = cache.get(oauth_token)
        verifier = data['oauth_verifier']
        oauth = self.oauth(resource_owner_key=oauth_token,
                           resource_owner_secret=oauth_secret,
                           verifier=verifier)
        return oauth.fetch_access_token(self.token_uri)

    def oauth(self, **kw):
        from requests_oauthlib import OAuth1Session
        p = self.config
        return OAuth1Session(p['key'], client_secret=p['secret'], **kw)

    def create_user(self, token, user=None):
        raise NotImplementedError


class OAuth2(OAuth1):
    '''OAuth version 2
    '''
    version = 2
    default_scope = None

    def available(self):
        if super(OAuth2, self).available():
            scope = self.config.get('scope') or self.default_scope
            self.config['scope'] = scope
            return bool(scope)
        return False

    def authorization_url(self, request, redirect_uri):
        oauth = self.oauth(redirect_uri=redirect_uri)
        return oauth.authorization_url(self.auth_uri)[0]

    def access_token(self, request, data, redirect_uri=None):
        oauth = self.oauth(redirect_uri=redirect_uri)
        return oauth.fetch_token(self.token_uri,
                                 client_secret=self.config['secret'],
                                 code=data.get('code'))

    def oauth(self, **kw):
        from requests_oauthlib import OAuth2Session
        p = self.config
        return OAuth2Session(p['key'], scope=p['scope'], **kw)


class OGPbase(object):
    '''Open Graph Protocol (OGP_) meta tags

    .. _OGP: http://ogp.me/
    '''
    prefix = 'og'
    meta_key = 'property'
    default_type = None
    types = ()
    field_mapping = {}

    def __init__(self, request, doc, default_type=None):
        if default_type:
            self.default_type = default_type
        self.config = request.config
        self.add_meta_tags(request, doc)

    def get_field(self, doc, field, prefix=None):
        pname = '%s_%s' % (prefix or self.prefix, field)
        return doc.fields.get(pname) or doc.fields.get(field)

    def get_type(self, doc):
        value = self.get_field(doc, 'type') or self.default_type
        if value not in self.types:
            return self.default_type
        return value

    def add_namespace(self, doc, namespace, url=None):
        pass

    def list_key(self, index, key):
        return key

    def add_meta_tags(self, request, doc):
        head = doc.head
        type = self.get_type(doc)
        url = self.get_field(doc, 'html_url')
        if not head.get_meta('%s:url' % self.prefix, meta_key=self.meta_key):
            if url:
                self.add_namespace(doc, self.prefix, url)
                self.add_meta(doc, 'type', type)
                self.add_meta(doc, 'url', url)
                self.add_meta(doc, 'title')
                self.add_meta(doc, 'description')
                #
                type_method = getattr(self, 'type_%s' % type, None)
                if type_method:
                    type_method(doc)
                #
                image = self.get_field(doc, 'image')
                if isinstance(image, dict):
                    url = image.get('url')
                    if url:
                        self.add_meta(doc, 'image', url)
                        for key, value in image.items():
                            self.add_meta(doc, 'image:%s' % key, value)
                elif image:
                    self.add_meta(doc, 'image', image)
            else:
                request.logger.warning('No doc html_url, cannot add open graph'
                                       ' protocol data to %s' % request.path)

    def add_meta(self, doc, key, value=None, prefix=None):
        if not value:
            value = self.get_field(doc, key, prefix=prefix)
        key = self.field_mapping.get(key) or key
        if value:
            if prefix:
                self.add_namespace(doc, prefix)
            else:
                prefix = self.prefix
            if isinstance(value, (list, tuple)):
                self.add_list(doc, key, prefix, value)
            else:
                key = '%s:%s' % (prefix, key)
                doc.head.add_meta(**{self.meta_key: key, 'content': value})

    def add_list(self, doc, key, prefix, values):
        for index, value in enumerate(values):
            newkey = self.list_key(index, key)
            if newkey:
                newkey = '%s:%s' % (prefix, newkey)
                doc.head.add_meta(**{self.meta_key: newkey, 'content': value})



class OGP(OGPbase):
    types = ('website', 'music', 'video', 'article', 'book', 'profile')

    def add_namespace(self, doc, namespace, url=None):
        cfg = self.config
        prefix = doc.attr('prefix')
        if prefix is None:  # No prefix yet
            prefix = 'og: http://ogp.me/ns#'
            self.add_meta(doc, 'site_name', cfg['APP_NAME'])
            self.add_meta(doc, 'locale')
            if url:
                doc.head.links.append(rel='canonical', href=url, type='')
        if namespace is not 'og':
            attr = '{0}: http://ogp.me/ns/{0}#'.format(namespace)
            if attr not in prefix:
                prefix += ' %s' % attr
        doc.attr('prefix', prefix)

    def type_profile(self, doc):
        self.add_meta(doc, 'first_name')
        self.add_meta(doc, 'last_name')
        self.add_meta(doc, 'username')
        self.add_meta(doc, 'gender')

    def type_article(self, doc):
        self.add_meta(doc, 'author')
        self.add_meta(doc, 'tag')


def register_oauth(cls):
    global Accounts
    name = getattr(cls, 'name', None) or cls.__name__.lower()
    Accounts[name] = cls


def oauths(config):
    '''Return a dictionary of OAuth handlers with configuration
    '''
    global Accounts
    oauths = {}
    for name, cls in Accounts.items():
        oauths[name] = cls(config.get(name))
    return oauths


def get_oauths(request):
    o = request.cache.oauths
    if o is None:
        cfg = request.config.get('OAUTH_PROVIDERS')
        if isinstance(cfg, dict):
            o = oauths(cfg)
        o = o or {}
        request.cache.oauths = o
    return o


Accounts = {}
