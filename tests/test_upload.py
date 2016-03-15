from unittest import TestCase
import json
import base64
from croplands_api import create_app, db, limiter
from croplands_api.models import User
from croplands_api.auth import make_jwt
from StringIO import StringIO
import os
import inspect


def get_payload(token):
    encoded_payload = token.split(".")[1].strip()
    encoded_payload += '=' * (len(encoded_payload) % 4)
    return json.loads(base64.b64decode(encoded_payload))


class TestUpload(TestCase):
    app = None

    def setUp(self):
        self.app = TestUpload.app
        with self.app.app_context():
            limiter.enabled = False
            db.create_all()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    @classmethod
    def setUpClass(cls):
        super(TestUpload, cls).setUpClass()
        cls.app = create_app('Testing')
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

    def test_image_upload(self):
        with self.app.test_client() as c:
            location = self.create_location(c)
            d = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))

            with open(os.path.join(d, 'test.JPG'), 'r') as f:
                img = f.read()

            data = {
                'location_id': location['id'], 'lat': 0.01, 'lon': 0.0123,
                'date_acquired': '2012-10-01',
                'file': (StringIO(img), 'hello_world.jpg'),
            }
            r = c.post('/upload/image', data=data)

            self.assertEqual(r.status_code, 201)

    def test_image_upload_with_user(self):
        with self.app.test_client() as c:
            location = self.create_location(c)
            user = self.create_user(c)
            user_headers = [('authorization', 'bearer ' + make_jwt(user))]

            d = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))

            with open(os.path.join(d, 'test.JPG'), 'r') as f:
                img = f.read()

            data = {
                'location_id': location['id'], 'lat': 0.01, 'lon': 0.0123,
                'date_acquired': '2012-10-01',
                'file': (StringIO(img), 'hello_world.jpg'),
            }
            r = c.post('/upload/image', data=data, headers=user_headers)

            response = json.loads(r.data)

            self.assertEqual(response['user_id'], user.id)

            self.assertEqual(r.status_code, 201)

    def test_image_upload_no_file(self):
        with self.app.test_client() as c:
            location = self.create_location(c)

            data = {
                'location_id': location['id'], 'url': 'adsf', 'lat': 0.01, 'lon': 0.0123,
                'date_acquired': '2012-10-01'
            }
            r = c.post('/upload/image', data=data)

            self.assertEqual(r.status_code, 201)

    def test_image_upload_no_data(self):
        with self.app.test_client() as c:
            location = self.create_location(c)

            data = {
                'location_id': location['id'], 'lat': 0.01, 'lon': 0.0123,
                'date_acquired': '2012-10-01'
            }
            r = c.post('/upload/image', data=data)
            self.assertEqual(r.status_code, 400)
