from pulsar.apps.test import test_timeout

from lux.utils import test


class TestSqlite(test.AppTestCase):
    config_file = 'tests.auth'
    config_params = {'DATASTORE': 'sqlite://'}

    def test_backend(self):
        backend = self.app.auth_backend
        self.assertTrue(backend)
        self.assertTrue(backend.backends)

    @test.green
    def test_get_user_none(self):
        backend = self.app.auth_backend
        request = self.app.wsgi_request()
        user = backend.get_user(request, user_id=18098098)
        self.assertEqual(user, None)
        user = backend.get_user(request, email='ksdcks.sdvddvf@djdjhdfc.com')
        self.assertEqual(user, None)
        user = backend.get_user(request, username='dhvfvhsdfgvhfd')
        self.assertEqual(user, None)

    @test.green
    def test_create_user(self):
        backend = self.app.auth_backend
        request = self.app.wsgi_request()

        user = backend.create_user(request,
                                   username='pippo',
                                   email='pippo@pippo.com',
                                   password='pluto',
                                   first_name='Pippo')
        self.assertTrue(user.id)
        self.assertEqual(user.first_name, 'Pippo')
        self.assertFalse(user.is_superuser())
        self.assertFalse(user.is_active())

        # make it active
        with self.app.odm().begin() as session:
            user.active = True
            session.add(user)

        self.assertTrue(user.is_active())

    @test.green
    def test_create_superuser(self):
        backend = self.app.auth_backend
        request = self.app.wsgi_request()

        user = backend.create_superuser(request,
                                        username='foo',
                                        email='foo@pippo.com',
                                        password='pluto',
                                        first_name='Foo')
        self.assertTrue(user.id)
        self.assertEqual(user.first_name, 'Foo')
        self.assertTrue(user.is_superuser())
        self.assertTrue(user.is_active())

    def test_get(self):
        request = yield from self.client.get('/')
        response = request.response
        self.assertEqual(response.status_code, 200)
        user = request.cache.user
        self.assertFalse(user.is_authenticated())

    def test_login_fail(self):
        data = {'username': 'jdshvsjhvcsd',
                'password': 'dksjhvckjsahdvsf'}
        request = yield from self.client.post('/authorizations',
                                              content_type='application/json',
                                              body=data)
        self.assertValidationError(request.response, '',
                                   'Invalid username or password')

    def test_create_superuser_command_and_token(self):
        return self._token()

    @test.green
    def test_permissions(self):
        '''Test permission models
        '''
        odm = self.app.odm()

        with odm.begin() as session:
            user = odm.user(username=test.randomname())
            group = odm.group(name='staff')
            session.add(user)
            session.add(group)
            group.users.append(user)

        self.assertTrue(user.id)
        self.assertTrue(group.id)

        groups = user.groups
        self.assertTrue(group in groups)

        with odm.begin() as session:
            # add goup to the session
            session.add(group)
            permission = odm.permission(name='admin',
                                        description='Can access the admin',
                                        policy={})
            group.permissions.append(permission)

    def test_create_permission_errors(self):
        token = yield from self._token()
        data = dict(name='blabla')
        request = yield from self.client.post('/permissions',
                                              body=data,
                                              content_type='application/json',
                                              token=token)
        self.assertValidationError(request.response, 'policy', 'required')
        #
        data = dict(name='blabla', policy='{')
        request = yield from self.client.post('/permissions',
                                              body=data,
                                              content_type='application/json',
                                              token=token)
        self.assertValidationError(request.response, 'policy',
                                   'not a valid JSON string')
        #
        data = dict(name='blabla', description='hgv hh', policy='[]')
        request = yield from self.client.post('/permissions',
                                              body=data,
                                              content_type='application/json',
                                              token=token)
        self.assertValidationError(request.response, '',
                                   'Policy empty')
        #
        data = dict(name='blabla', description='hgv hh', policy='67')
        request = yield from self.client.post('/permissions',
                                              body=data,
                                              content_type='application/json',
                                              token=token)
        self.assertValidationError(request.response, '',
                                   'Policy should be a list or an object')
        #
        data = dict(name='blabla', description='hgv hh', policy='[45]')
        request = yield from self.client.post('/permissions',
                                              body=data,
                                              content_type='application/json',
                                              token=token)
        self.assertValidationError(request.response, '',
                                   'Policy should be a list or an object')
        #
        data = dict(name='blabla', description='hgv hh', policy='{}')
        request = yield from self.client.post('/permissions',
                                              body=data,
                                              content_type='application/json',
                                              token=token)
        self.assertValidationError(request.response, '',
                                   '"action" must be defined')

    def test_signup(self):
        request = yield from self.client.get('/signup')
        self.assertEqual(request.response.status_code, 200)
        data = {'username': 'whaaazaaa',
                'password': 'annamo',
                'password_repeat': 'annamo',
                'email': 'whaaazaaa@whaaazaaa.com'}
        request = yield from self.client.post('/authorizations/signup',
                                              body=data,
                                              content_type='application/json')
        self.assertEqual(request.response.status_code, 201)

    def _token(self):
        '''Return a token for a new superuser
        '''
        username = test.randomname()
        password = test.randomname()
        email = '%s@%s.com' % (username, test.randomname())
        user = yield from self.create_superuser(username,
                                                email,
                                                password)
        self.assertEqual(user.username, username)
        self.assertNotEqual(user.password, password)

        # Get new token
        request = yield from self.client.post('/authorizations',
                                              content_type='application/json',
                                              body={'username': username,
                                                    'password': password})
        response = request.response
        self.assertEqual(response.status_code, 201)
        user = request.cache.user
        self.assertFalse(user.is_authenticated())
        data = self.json(response)
        self.assertTrue('token' in data)
        return data['token']
