from unittest import TestCase
import json
import datetime
import base64
from croplands_api import create_app, db, limiter
from croplands_api.auth import make_jwt
from croplands_api.models import User
from croplands_api.exceptions import Unauthorized


def get_payload(token):
    """
    Get payload from jwt.
    :param token: String
    :return: Payload dict
    """
    encoded_payload = token.split(".")[1].strip()
    encoded_payload += '=' * (len(encoded_payload) % 4)
    return json.loads(base64.b64decode(encoded_payload))


class TestApi(TestCase):
    app = None

    def setUp(self):
        self.app = TestApi.app
        with self.app.app_context():
            limiter.enabled = False
            db.create_all()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    @classmethod
    def setUpClass(cls):
        super(TestApi, cls).setUpClass()
        cls.app = create_app()
        with cls.app.app_context():
            db.create_all()

    def create_user(self, c):
        me = {'first': 'Justin', 'last': 'Poehnelt', 'organization': 'USGS',
              'password': 'woot1LoveCookies!', 'email': 'jpoehnelt+test@usgs.gov'}
        headers = [('Content-Type', 'application/json')]
        c.post('/auth/register', headers=headers, data=json.dumps(me))

        return User.from_email(me['email'])

    def create_location(self, c):
        data = {'lat': 0, 'lon': 0, 'records': []}
        headers = [('Content-Type', 'application/json')]
        post = c.post('/api/locations', headers=headers, data=json.dumps(data))
        self.assertEqual(post.status_code, 201)
        return json.loads(post.data)

    def test_who_can_edit_users(self):
        with self.app.test_client() as c:
            me = {'first': 'Justin', 'last': 'Poehnelt', 'organization': 'USGS',
                  'password': 'woot1LoveCookies!', 'email': 'jpoehnelt+test@usgs.gov'}
            other = {'first': 'Justin', 'last': 'Poehnelt', 'organization': 'USGS',
                     'password': 'woot1LoveCookies!', 'email': 'jpoehnelt+testother@usgs.gov'}
            headers = [('Content-Type', 'application/json')]

            c.post('/auth/register', headers=headers, data=json.dumps(me))
            c.post('/auth/register', headers=headers, data=json.dumps(other))
            user = User.from_email(me['email'])
            other = User.from_email(other['email'])

            # attempt to edit a user from anyone
            response = c.patch('/api/users/%d' % user.id, headers=headers, data=json.dumps(me))
            self.assertEqual(response.status_code, 401)
            self.assertEqual(json.loads(response.data)['status_code'], 401)

            # attempt to edit user from user
            headers = [('Content-Type', 'application/json'),
                       ('authorization', 'bearer ' + make_jwt(user))]
            c.patch('/api/users/%d' % user.id, headers=headers, data=json.dumps(me))

            # attempt to edit user from different user without roles
            headers = [('Content-Type', 'application/json'),
                       ('authorization', 'bearer ' + make_jwt(other))]
            response = c.patch('/api/users/%d' % user.id, headers=headers, data=json.dumps(me))
            self.assertEqual(response.status_code, 401)
            self.assertEqual(json.loads(response.data)['status_code'], 401)

            # attempt to edit different user with admin
            user.role = 'admin'
            headers = [('Content-Type', 'application/json'),
                       ('authorization', 'bearer ' + make_jwt(user))]
            c.patch('/api/users/%d' % other.id, headers=headers, data=json.dumps(me))

    def test_api_role(self):
        with self.app.test_request_context() as request_ctx:
            from croplands_api.views.api.processors import api_roles

            def api_roles_wrapper(role):
                """
                Help for roles in test
                :param role:
                :return:
                """

                api_roles(role)()

            # should not be authorized for any of these since current user is none
            self.assertRaises(Unauthorized, api_roles_wrapper, 'registered')
            self.assertRaises(Unauthorized, api_roles_wrapper, 'partner')
            self.assertRaises(Unauthorized, api_roles_wrapper, 'team')
            self.assertRaises(Unauthorized, api_roles_wrapper, 'admin')
            self.assertRaises(Unauthorized, api_roles_wrapper,
                              ['registered', 'partner', 'team', 'admin'])

            request_ctx.current_user = user = User(
                **{'first': 'Justin', 'last': 'Poehnelt', 'organization': 'USGS',
                   'password': 'woot1LoveCookies!',
                   'email': 'jpoehnelt+test@usgs.gov'})

            user.role = 'registered'
            self.assertEqual(api_roles_wrapper('registered'), None)
            self.assertRaises(Unauthorized, api_roles_wrapper, ['partner', 'team', 'admin'])

            user.role = 'partner'
            self.assertEqual(api_roles_wrapper('partner'), None)
            self.assertRaises(Unauthorized, api_roles_wrapper, ['registered', 'team', 'admin'])

            user.role = 'team'
            self.assertEqual(api_roles_wrapper('team'), None)
            self.assertRaises(Unauthorized, api_roles_wrapper, ['partner', 'registered', 'admin'])

            user.role = 'admin'
            self.assertEqual(api_roles_wrapper('admin'), None)
            self.assertRaises(Unauthorized, api_roles_wrapper, ['partner', 'team', 'registered'])

    def test_create_location(self):
        with self.app.test_client() as c:
            data = {'lat': 45, 'lon': -90, 'records': []}
            headers = [('Content-Type', 'application/json')]

            post = c.post('/api/locations', headers=headers, data=json.dumps(data))
            self.assertEqual(post.status_code, 201)
            get = c.get('/api/locations/%d' % json.loads(post.data)['id'])
            response_data = json.loads(get.data)
            for key, val in data.iteritems():
                self.assertEqual(val, response_data[key])
            print response_data
            self.assertEqual(-1.0, response_data['bearing'])

    def test_create_location_offset(self):
        with self.app.test_client() as c:
            data = {'lat': 45, 'lon': -90, 'distance': 200, 'bearing': 45}
            headers = [('Content-Type', 'application/json')]
            post = c.post('/api/locations', headers=headers, data=json.dumps(data))
            response_data = json.loads(post.data)

            self.assertNotEqual(response_data['lat'], data['lat'])
            self.assertNotEqual(response_data['lon'], data['lon'])
            self.assertAlmostEquals(response_data['lat'], data['lat'], places=1)
            self.assertAlmostEquals(response_data['lon'], data['lon'], places=1)

            from croplands_api.utils.geo import distance

            self.assertAlmostEquals(data['distance'], distance(data['lat'], data['lon'],
                                                               response_data['lat'],
                                                               response_data['lon']), 1)

            # missing distance
            data = {'lat': 46, 'lon': -90, 'bearing': 45}
            headers = [('Content-Type', 'application/json')]
            post = c.post('/api/locations', headers=headers, data=json.dumps(data))
            response_data = json.loads(post.data)

            self.assertEqual(response_data['lat'], data['lat'])
            self.assertEqual(response_data['lon'], data['lon'])

            # missing bearing
            data = {'lat': 47, 'lon': -90, 'distance': 45}
            headers = [('Content-Type', 'application/json')]
            post = c.post('/api/locations', headers=headers, data=json.dumps(data))
            response_data = json.loads(post.data)

            self.assertEqual(response_data['lat'], data['lat'])
            self.assertEqual(response_data['lon'], data['lon'])

    def test_create_location_with_user(self):
        with self.app.test_client() as c:
            headers = [('Content-Type', 'application/json')]
            user = self.create_user(c)

            user_headers = headers + [('authorization', 'bearer ' + make_jwt(user))]

            data = {'lat': 0, 'lon': 0,
                    'records': [{'year': 2014, 'month': 1}],
                    'images': [
                        {'url': 'adsf', 'lat': 0.01, 'lon': 0.0123, 'date_acquired': '2012-10-01'}]
                    }
            post = c.post('/api/locations', headers=user_headers, data=json.dumps(data))
            response = json.loads(post.data)

            self.assertEqual(len(data['records']), len(response['records']))
            self.assertEqual(response['user_id'], user.id)
            self.assertEqual(response['records'][0]['user_id'], user.id)
            self.assertEqual(response['images'][0]['user_id'], user.id)

    def test_create_location_with_sub_models(self):
        with self.app.test_client() as c:
            headers = [('Content-Type', 'application/json')]
            user = self.create_user(c)

            user_headers = headers + [('authorization', 'bearer ' + make_jwt(user))]

            # without user
            data = {'lat': 0, 'lon': 0,
                    'records': [{'year': 2014, 'month': 1}],
                    'images': [
                        {'url': 'adsf', 'lat': 0.01, 'lon': 0.0123, 'date_acquired': '2012-10-01'}]
                    }
            post = c.post('/api/locations', headers=headers, data=json.dumps(data))
            response = json.loads(post.data)
            self.assertEqual(len(data['records']), len(response['records']))
            self.assertEqual(response['user_id'], response['records'][0]['user_id'])

            # with user
            data = {'lat': 1, 'lon': 0,
                    'records': [{'year': 2014, 'month': 1}],
                    'images': [{'url': 'adsfasd', 'lat': 0.01, 'lon': 0.0123,
                                'date_acquired': '2012-10-01'}]
                    }
            post = c.post('/api/locations', headers=user_headers, data=json.dumps(data))
            response = json.loads(post.data)
            self.assertEqual(len(data['records']), len(response['records']))
            self.assertEqual(response['user_id'], response['records'][0]['user_id'])

    def test_location_create_duplicate(self):
        with self.app.test_client() as c:
            data = {'lat': 0, 'lon': 0, 'records': []}
            headers = [('Content-Type', 'application/json')]
            c.post('/api/locations', headers=headers, data=json.dumps(data))
            post = c.post('/api/locations', headers=headers, data=json.dumps(data))
            print json.loads(post.data)
            self.assertEqual(post.status_code, 400)
            # would prefer a more descriptive response

    def test_location_update(self):
        with self.app.test_client() as c:
            user = self.create_user(c)

            headers = [('Content-Type', 'application/json')]
            json_data = self.create_location(c)

            # anonymous cannot update
            patch = c.patch('/api/locations/%d' % json_data['id'], headers=headers,
                            data=json.dumps(json_data))
            self.assertEqual(patch.status_code, 401)

            # registered users cannot update
            user_headers = headers + [('authorization', 'bearer ' + make_jwt(user))]
            patch = c.patch('/api/locations/%d' % json_data['id'], headers=user_headers,
                            data=json.dumps(json_data))
            self.assertEqual(patch.status_code, 401)

            # partner can update
            user = User.from_email(user.email)
            user.change_role('partner')
            user_headers = headers + [('authorization', 'bearer ' + make_jwt(user))]

            patch = c.patch('/api/locations/%d' % json_data['id'], headers=user_headers,
                            data=json.dumps(json_data))
            self.assertEqual(patch.status_code, 401)

            # team member can update
            user = User.from_email(user.email)
            user.change_role('mapping')
            user_headers = headers + [('authorization', 'bearer ' + make_jwt(user))]

            patch = c.patch('/api/locations/%d' % json_data['id'], headers=user_headers,
                            data=json.dumps(json_data))
            self.assertEqual(patch.status_code, 200)

            # admin can update
            user = User.from_email(user.email)
            user.change_role('admin')
            user_headers = headers + [('authorization', 'bearer ' + make_jwt(user))]

            patch = c.patch('/api/locations/%d' % json_data['id'], headers=user_headers,
                            data=json.dumps(json_data))
            self.assertEqual(patch.status_code, 200)

    def test_location_update_with_relation(self):
        with self.app.test_client() as c:
            user = self.create_user(c)

            headers = [('Content-Type', 'application/json')]
            json_data = self.create_location(c)
            json_data['records'].append({'year': 2014, 'month': 1})

            # partner can update
            user = User.from_email(user.email)
            user.change_role('mapping')
            user_headers = headers + [('authorization', 'bearer ' + make_jwt(user))]

            patch = c.patch('/api/locations/%d' % json_data['id'], headers=user_headers,
                            data=json.dumps(json_data))
            location = json.loads(patch.data)
            self.assertEqual(patch.status_code, 200)
            self.assertEqual(len(location['records']), 0)

    def test_location_delete(self):
        with self.app.test_client() as c:
            user = self.create_user(c)
            user = User.from_email(user.email)

            headers = [('Content-Type', 'application/json')]

            json_data = self.create_location(c)
            delete = c.delete('/api/locations/%d' % json_data['id'], headers=headers)
            self.assertEqual(delete.status_code, 401)

            # admin can delete
            user = User.from_email(user.email)
            user.change_role('admin')
            user_headers = headers + [('authorization', 'bearer ' + make_jwt(user))]
            delete = c.delete('/api/locations/%d' % json_data['id'], headers=user_headers)
            self.assertEqual(delete.status_code, 204)

    def test_record_create_with_location(self):
        with self.app.test_client() as c:
            data = {'lat': 0, 'lon': 0, 'records': []}
            headers = [('Content-Type', 'application/json')]
            post = c.post('/api/locations', headers=headers, data=json.dumps(data))
            location = json.loads(post.data)

            data = {'year': 2014, 'month': 1, 'location_id': location['id']}
            post = c.post('/api/records', headers=headers, data=json.dumps(data))
            self.assertEqual(post.status_code, 201)

    def test_record_create_source(self):
        with self.app.test_client() as c:
            data = {'lat': 0, 'lon': 0, 'records': []}
            headers = [('Content-Type', 'application/json')]
            post = c.post('/api/locations', headers=headers, data=json.dumps(data))
            location = json.loads(post.data)

            data = {'year': 2014, 'month': 1, 'location_id': location['id']}
            post = c.post('/api/records', headers=headers, data=json.dumps(data))
            self.assertEqual(post.status_code, 201)
            record = json.loads(post.data)
            self.assertEqual(record['source_type'], 'unknown')

            data = {'year': 2013, 'month': 1, 'location_id': location['id'],
                    'source_type': 'derived'}
            post = c.post('/api/records', headers=headers, data=json.dumps(data))
            self.assertEqual(post.status_code, 201)
            record = json.loads(post.data)
            self.assertEqual(record['source_type'], 'derived')

            data = {'year': 2012, 'month': 1, 'location_id': location['id'],
                    'source_type': 'ground'}
            post = c.post('/api/records', headers=headers, data=json.dumps(data))
            self.assertEqual(post.status_code, 201)
            record = json.loads(post.data)
            self.assertEqual(record['source_type'], 'ground')

            data = {'year': 2011, 'month': 1, 'location_id': location['id'],
                    'source_type': 'this is not a valid source type'}
            post = c.post('/api/records', headers=headers, data=json.dumps(data))
            self.assertEqual(post.status_code, 400)

    def test_record_create_without_location(self):
        with self.app.test_client() as c:
            data = {'year': 2014, 'month': 1}
            headers = [('Content-Type', 'application/json')]
            post = c.post('/api/records', headers=headers, data=json.dumps(data))
            self.assertEqual(post.status_code, 400)

    def test_record_update(self):
        with self.app.test_client() as c:
            headers = [('Content-Type', 'application/json')]
            user = self.create_user(c)
            user = User.from_email(user.email)
            user.change_role('partner')

            user_headers = headers + [('authorization', 'bearer ' + make_jwt(user))]

            data = {'lat': 0, 'lon': 0}
            post = c.post('/api/locations', headers=user_headers, data=json.dumps(data))
            location = json.loads(post.data)

            data_record = {'year': 2014, 'month': 1, 'location_id': location['id']}

            post = c.post('/api/records', headers=user_headers, data=json.dumps(data_record))
            record = json.loads(post.data)

            c.patch('/api/records/%d' % record['id'], headers=user_headers,
                    data=json.dumps(record))

    def test_record_delete(self):
        pass

    def test_record_get(self):
        pass

    def test_record_create_has_history(self):
        with self.app.test_client() as c:
            headers = [('Content-Type', 'application/json')]
            user = self.create_user(c)
            user = User.from_email(user.email)
            user.change_role('partner')

            user_headers = headers + [('authorization', 'bearer ' + make_jwt(user))]

            data = {'lat': 0, 'lon': 0}
            post = c.post('/api/locations', headers=user_headers, data=json.dumps(data))
            location = json.loads(post.data)

            data_record = {'year': 2014, 'month': 1, 'location_id': location['id']}

            post = c.post('/api/records', headers=user_headers, data=json.dumps(data_record))
            record = json.loads(post.data)
            self.assertEqual(len(record['history']), 1)
            self.assertAlmostEqual(datetime.datetime.strptime(record['history'][0]['date_edited'],
                                                              "%Y-%m-%dT%H:%M:%S.%f"),
                                   datetime.datetime.now(), delta=datetime.timedelta(seconds=5))

            patch = c.patch('/api/records/%d' % record['id'], headers=user_headers,
                            data=json.dumps(data_record))
            record = json.loads(patch.data)
            self.assertEqual(len(record['history']), 2)
            self.assertAlmostEqual(datetime.datetime.strptime(record['history'][0]['date_edited'],
                                                              "%Y-%m-%dT%H:%M:%S.%f"),
                                   datetime.datetime.now(), delta=datetime.timedelta(seconds=5))
            for history in record['history']:
                data = json.loads(history['data'])
                self.assertNotIn('history', data)

    def test_record_create_rating(self):
        with self.app.test_client() as c:
            user = self.create_user(c)

            user = User.from_email(user.email)

            headers = [('Content-Type', 'application/json')]
            user_headers = headers + [('authorization', 'bearer ' + make_jwt(user))]

            location = self.create_location(c)

            data_record = {'year': 2014, 'month': 1, 'location_id': location['id']}

            post = c.post('/api/records', headers=user_headers, data=json.dumps(data_record))
            record = json.loads(post.data)

            data_rating = {'rating': 1, 'record_id': record['id']}
            c.post('/api/ratings', headers=user_headers, data=json.dumps(data_rating))

            # try a duplicate, should replace old
            post = c.post('/api/ratings', headers=user_headers, data=json.dumps(data_rating))
            self.assertEqual(post.status_code, 201)

    def test_record_update_rating(self):
        with self.app.test_client() as c:
            user = self.create_user(c)

            user = User.from_email(user.email)

            headers = [('Content-Type', 'application/json')]
            user_headers = headers + [('authorization', 'bearer ' + make_jwt(user))]

            location = self.create_location(c)

            data_record = {'year': 2014, 'month': 1, 'location_id': location['id']}

            post = c.post('/api/records', headers=user_headers, data=json.dumps(data_record))
            record = json.loads(post.data)

            data_rating = {'rating': 1, 'record_id': record['id']}
            post = c.post('/api/ratings', headers=user_headers, data=json.dumps(data_rating))
            rating = json.loads(post.data)
            other = {'first': 'Justin', 'last': 'Poehnelt', 'organization': 'USGS',
                     'password': 'woot1LoveCookies!', 'email': 'jpoehnelt+test2@usgs.gov'}
            c.post('/auth/register', headers=headers, data=json.dumps(other))
            other = User.from_email(other['email'])
            other_headers = headers + [('authorization', 'bearer ' + make_jwt(other))]

            patch = c.patch('/api/ratings/%d' % rating['id'], headers=other_headers,
                            data=json.dumps(data_rating))
            self.assertEqual(patch.status_code, 401)  # cannot edit someone elses rating
            patch = c.patch('/api/ratings/%d' % rating['id'], headers=user_headers,
                            data=json.dumps(data_rating))
            self.assertEqual(patch.status_code, 200)  # can edit own rating

    def test_record_rating_stale_after_update(self):
        with self.app.test_client() as c:
            user = self.create_user(c)

            user = User.from_email(user.email)
            user.change_role('partner')

            headers = [('Content-Type', 'application/json')]
            user_headers = headers + [('authorization', 'bearer ' + make_jwt(user))]

            location = self.create_location(c)

            data_record = {'year': 2014, 'month': 1, 'location_id': location['id']}

            post = c.post('/api/records', headers=user_headers, data=json.dumps(data_record))
            record = json.loads(post.data)
            data_rating = {'rating': 1, 'record_id': record['id']}
            c.post('/api/ratings', headers=user_headers, data=json.dumps(data_rating))

            patch = c.patch('/api/records/%d' % record['id'], headers=user_headers,
                            data=json.dumps(record))
            record = json.loads(patch.data)
            for rating in record['ratings']:
                self.assertTrue(rating['stale'])

    def test_user_patch(self):
        with self.app.test_client() as c:
            me = {
                'first': 'Justin', 'last': 'Poehnelt', 'organization': 'USGS',
                'password': 'woot1LoveCookies!',
                'email': 'jpoehnelt+test@usgs.gov'
            }
            user = self.create_user(c)
            headers = [('Content-Type', 'application/json')]
            user_headers = headers + [('authorization', 'bearer ' + make_jwt(user))]

            patch = c.patch('/api/users/%d' % user.id, headers=headers,
                            data=json.dumps(me))
            self.assertEqual(patch.status_code, 401)

            patch = c.patch('/api/users/%d' % user.id, headers=user_headers,
                            data=json.dumps(me))
            self.assertEqual(patch.status_code, 200)
