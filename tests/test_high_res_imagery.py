from croplands_api import create_app, db, limiter
from croplands_api.models import User
import unittest
from croplands_api.tasks.classifications import build_classifications_result, \
    compute_image_classification_statistics
import json


class TestHighResImage(unittest.TestCase):
    app = None

    def setUp(self):
        self.app = TestHighResImage.app
        with self.app.app_context():
            limiter.enabled = False
            db.create_all()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    @classmethod
    def setUpClass(cls):
        super(TestHighResImage, cls).setUpClass()
        cls.app = create_app('Testing')

    # def test_get_image(self):
    # with self.app.app_context():
    # lat= 35.198136597203195
    # lon = -111.64765298366547
    #
    #         get_image(lat, lon, 18)
    #
    #         image = Image.query.first()
    #         self.assertAlmostEqual(lat, image.lat, delta=0.001)
    #         self.assertAlmostEqual(lon, image.lon, delta=0.001)

    def test_post_classification(self):
        with self.app.app_context():
            with self.app.test_client() as c:
                headers = [('Content-Type', 'application/json')]
                data = {'lat': 35.198136597203195, 'lon': -111.64765298366547}

                post = c.post('/api/locations', headers=headers, data=json.dumps(data))
                response = json.loads(post.data)

                image_data = {'date_acquired': '2015-01-01', 'lat': 0, 'lon': 0,
                              'location_id': response['id'], 'bearing': 0, 'url': 'asdf'}
                c.post('/api/images', headers=headers, data=json.dumps(image_data))

                headers = [('Content-Type', 'application/json')]
                response = c.get('/api/images', headers=headers)

                image_id = json.loads(response.data)['objects'][0]['id']
                data = {
                    "image": image_id,
                    "classification": 3
                }

                response = c.post('/api/image_classifications', headers=headers,
                                  data=json.dumps(data))

                self.assertEqual(response.status_code, 201)

    def test_classification_results(self):
        with self.app.test_client() as c:
            headers = [('Content-Type', 'application/json')]
            data = {'lat': 35.312, 'lon': -111.112}

            post = c.post('/api/locations', headers=headers, data=json.dumps(data))
            response = json.loads(post.data)

            image_data = {'date_acquired': '2015-01-01', 'lat': 0, 'lon': 0,
                          'location_id': response['id'], 'bearing': 0, 'url': 'asdf'}
            c.post('/api/images', headers=headers, data=json.dumps(image_data))

            response = c.get('/api/images', headers=headers)

            image_id = json.loads(response.data)['objects'][0]['id']
            data = {
                "image": image_id,
                "classification": 3
            }

            c.post('/api/image_classifications', headers=headers,
                   data=json.dumps(data))
            data = {
                "image": image_id,
                "classification": 3
            }

            c.post('/api/image_classifications', headers=headers,
                   data=json.dumps(data))

            data = {
                "image": image_id,
                "classification": 3
            }

            response = c.post('/api/image_classifications', headers=headers,
                              data=json.dumps(data))

            self.assertEqual(response.status_code, 201)
            compute_image_classification_statistics(image_id)
            build_classifications_result()

    # def test_get_google_street_view_image(self):
    #     with self.app.app_context():
    #         data = {'lat': 35.198136597203195, 'lon': -111.64765298366547}
    #         get_google_street_view_image(**data)

    # def test_directions(self):
    #     with self.app.app_context():
    #         origin_lat = 35.198136597203195
    #         origin_lon = -111.64765298366547
    #
    #         destination_lat = 35.198136597203195
    #         destination_lon = -111.14765298366547
    #
    #         # polyline = get_directions(origin_lat, origin_lon, destination_lat, destination_lon)

    def test_classification_user(self):
        with self.app.test_client() as c:
            me = {'first': 'Justin', 'last': 'Poehnelt', 'affiliation': 'USGS',
                  'password': 'woot1LoveCookies!', 'email': 'jpoehnelt+test@usgs.gov'}
            headers = [('Content-Type', 'application/json')]

            c.post('/auth/register', headers=headers, data=json.dumps(me))
            # verify user
            User.from_email(me['email'])

            # login
            response = c.post('/auth/login', headers=headers,
                              data=json.dumps({'email': me['email'], 'password': me['password']}))
            response.json = json.loads(response.data)
            self.assertIn('data', response.json)
            self.assertIn('token', response.json['data'])

            token = response.json['data']['token']

            headers = [('Content-Type', 'application/json'), ('authorization', 'bearer ' + token)]
            data = {'lat': 35.312, 'lon': -111.112}

            post = c.post('/api/locations', headers=headers, data=json.dumps(data))
            response = json.loads(post.data)

            image_data = {'date_acquired': '2015-01-01', 'lat': 0, 'lon': 0,
                          'location_id': response['id'], 'bearing': 0, 'url': 'asdf'}
            c.post('/api/images', headers=headers, data=json.dumps(image_data))

            response = c.get('/api/images', headers=headers)

            image_id = json.loads(response.data)['objects'][0]['id']
            data = {
                "image": image_id,
                "classification": 3
            }

            response = c.post('/api/image_classifications', headers=headers,
                              data=json.dumps(data))

            classification = json.loads(response.data)
            self.assertIsNotNone(classification['user_id'])
            self.assertEqual(classification['user_id'], 1)
