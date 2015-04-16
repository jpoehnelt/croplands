from gfsad import create_app, db, limiter
import unittest
from gfsad.tasks.high_res_imagery import get_image
from gfsad.models import Image
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

    def test_get_image(self):
        with self.app.app_context():
            with self.app.test_client() as c:
                headers = [('Content-Type', 'application/json')]

                data = {'lat': 35.198136597203195, 'lon': -111.64765298366547}
                post = c.post('/api/locations', headers=headers, data=json.dumps(data))
                response = json.loads(post.data)

                get_image(response['id'], response['lat'], response['lon'], 18)

                image = Image.query.first()
                self.assertAlmostEqual(response['lat'], image.lat, delta=0.001)
                self.assertAlmostEqual(response['lon'], image.lon, delta=0.001)


    def test_post_classification(self):
        with self.app.app_context():
            with self.app.test_client() as c:
                headers = [('Content-Type', 'application/json')]
                data = {'lat': 35.198136597203195, 'lon': -111.64765298366547}

                post = c.post('/api/locations', headers=headers, data=json.dumps(data))
                print post.data
                response = json.loads(post.data)
                print response
                get_image(response['id'], response['lat'], response['lon'], 18)

                headers = [('Content-Type', 'application/json')]
                response = c.get('/api/images', headers=headers)

                image_id = json.loads(response.data)['objects'][0]['id']
                data = {
                    "image": image_id,
                    "classification": 3
                }

                response = c.post('/api/image_classifications', headers=headers,
                                  data=json.dumps(data))

                print response.data
                self.assertEqual(response.status_code, 201)



