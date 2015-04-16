from gfsad import create_app, db, limiter
import unittest
from gfsad.tasks.high_res_imagery import get_image
from gfsad.models.tile import Tile
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
            lat = 35.21506432459321
            lon = -111.63386642932892
            get_image(lat,lon,18)

            tile = Tile.query.first()
            self.assertAlmostEqual(lat, tile.center_lat, delta=0.01)
            self.assertAlmostEqual(lon, tile.center_lon, delta=0.01)

    def test_post_classification(self):
        with self.app.app_context():
            with self.app.test_client(use_cookies=False) as c:
                # create image
                lat = 35.21506432459321
                lon = -111.63386642932892
                get_image(lat,lon,18)

                headers = [('Content-Type', 'application/json')]
                response = c.get('/api/tiles', headers=headers)
                tile_id = json.loads(response.data)['objects'][0]['id']

                data = {
                    "tile": tile_id,
                    "classification": 3
                }

                response = c.post('/api/tile_classifications', headers=headers, data=json.dumps(data))
                self.assertEqual(response.status_code, 201)

                response = c.get('/api/tiles/%d' % tile_id, headers=headers)
                tile = json.loads(response.data)
                self.assertEqual(tile['classifications_count'], 1)
                self.assertEqual(tile['classifications_majority_class'], 3)
                self.assertEqual(tile['classifications_majority_agreement'], 100)

                data = {
                    "tile": tile_id,
                    "classification": 3
                }

                response = c.post('/api/tile_classifications', headers=headers, data=json.dumps(data))
                self.assertEqual(response.status_code, 201)

                data = {
                    "tile": tile_id,
                    "classification": 2
                }

                response = c.post('/api/tile_classifications', headers=headers, data=json.dumps(data))
                self.assertEqual(response.status_code, 201)

                response = c.get('/api/tiles/%d' % tile_id, headers=headers)
                tile = json.loads(response.data)
                self.assertEqual(tile['classifications_count'], 3)
                self.assertEqual(tile['classifications_majority_class'], 3)
                self.assertEqual(tile['classifications_majority_agreement'], 66)
