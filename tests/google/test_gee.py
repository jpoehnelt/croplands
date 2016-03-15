from unittest import TestCase
from croplands_api import create_app, limiter
from croplands_api.models import db
from croplands_api.utils.google.gee import extract
import ee


class TestGEE(TestCase):
    app = None

    def setUp(self):
        self.app = TestGEE.app
        with self.app.app_context():
            limiter.enabled = False
            db.create_all()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    @classmethod
    def setUpClass(cls):
        super(TestGEE, cls).setUpClass()
        cls.app = create_app('Testing')

    def test_extract(self):
        with self.app.app_context():
            lat = 31.74292
            lon = -110.051375

            geometry = ee.Geometry.Point(lon, lat)
            collection = ee.ImageCollection('MODIS/MOD13Q1').filterDate('2015-01-01', '2015-12-31')
            results = extract(geometry, collection)
            self.assertEqual(len(results), 23)
            self.assertIn('NDVI', results[0])
