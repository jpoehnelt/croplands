from gfsad import create_app, db, limiter
import unittest
from gfsad.tasks.high_res_imagery import get_image
from gfsad.models import Tile


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