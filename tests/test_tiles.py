from unittest import TestCase
from gfsad import create_app, db, limiter


class TestTiles(TestCase):
    app = None

    def setUp(self):
        self.app = TestTiles.app
        with self.app.app_context():
            limiter.enabled = False
            db.create_all()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    @classmethod
    def setUpClass(cls):
        super(TestTiles, cls).setUpClass()
        cls.app = create_app('Testing')
        with cls.app.app_context():
            db.create_all()

    # def test_get_tile(self):
    #     with self.app.test_client() as c:
    #         r = c.get('/tiles/ndvi_landsat_7/1555/3228/13')
    #         self.assertEqual(r.status_code, 200)
    #
    #         r = c.get('/tiles/ndvi_landsat_7/1555/3001/13')
    #         self.assertEqual(r.status_code, 200)