import json

from pulsar.apps.test import test_timeout

from lux.utils import test


class TestSqlite(test.AppTestCase):
    config_file = 'tests.auth'
    config_params = {'DATASTORE': 'sqlite://'}

    def test_backend(self):
        backend = self.app.auth_backend
        self.assertTrue(backend)
        self.assertTrue(backend.backends)

    def test_get_user_none(self):
        backend = self.app.auth_backend

        request = self.app.wsgi_request()
        user = backend.get_user(request, user_id=18098098)
        self.assertEqual(user, None)
        user = backend.get_user(request, email='ksdcks.sdvddvf@djdjhdfc.com')
        self.assertEqual(user, None)
        user = backend.get_user(request, username='dhvfvhsdfgvhfd')
        self.assertEqual(user, None)

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
        request = self.client.get('/')
        response = request.response
        self.assertEqual(response.status_code, 200)
        user = request.cache.user
        self.assertFalse(user.is_authenticated())

    def test_authorizations(self):
        request = self.client.get('/authorizations')
        response = request.response
        self.assertEqual(response.status_code, 401)
        user = request.cache.user
        self.assertFalse(user.is_authenticated())

    def test_login_fail(self):
        data = {'username': 'jdshvsjhvcsd',
                'password': 'dksjhvckjsahdvsf'}
        request = self.client.post('/authorizations',
                                   content_type='application/json',
                                   body=data)
        response = request.response
        self.assertEqual(response.status_code, 200)
        user = request.cache.user
        self.assertFalse(user.is_authenticated())
        self.assertEqual(response['content-type'],
                         'application/json; charset=utf-8')

    def test_create_superuser_command_and_token(self):
        username = 'ghghghgh'
        password = 'dfbjdhbvdjbhv'
        user = self.client.run_command('create_superuser',
                                       ['--username', username,
                                        '--email', 'sjhcsecds@sjdbcsjdc.com',
                                        '--password', password])
        self.assertEqual(user.username, username)
        self.assertNotEqual(user.password, password)

        # Get new token
        request = self.client.post('/authorizations',
                                   content_type='application/json',
                                   body={'username': username,
                                         'password': password})
        response = request.response
        self.assertEqual(response.status_code, 201)
        user = request.cache.user
        self.assertFalse(user.is_authenticated())
        self.assertEqual(response['content-type'],
                         'application/json; charset=utf-8')
        data = json.loads(response.content[0].decode('utf-8'))
        self.assertTrue('token' in data)
