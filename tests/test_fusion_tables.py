from unittest import TestCase
from gfsad import create_app, limiter
from gfsad.models import db
try:
    from gfsad.utils.fusion import FUSION_TABLE_SCOPE, init_google_service, replace_rows
except ImportError as e:
    print e
    raise e
import csv
from cStringIO import StringIO


class TestFusionTables(TestCase):
    app = None

    def setUp(self):
        self.app = TestFusionTables.app
        with self.app.app_context():
            limiter.enabled = False
            db.create_all()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    @classmethod
    def setUpClass(cls):
        super(TestFusionTables, cls).setUpClass()
        cls.app = create_app('Testing')

    def test_init_service(self):
        with self.app.app_context():
            service = init_google_service(FUSION_TABLE_SCOPE)

    def test_replace_rows(self):
        with self.app.app_context():
            csvfile = StringIO()
            writer = csv.writer(csvfile, delimiter=',')
            writer.writerow([1, 2, 3, 4, 5, 6, 7, 8, 9])
            replace_rows('1y6rdRvEPXW4r2zXHterHoDrGUVYxnUH_saPMdaCo', csvfile)




