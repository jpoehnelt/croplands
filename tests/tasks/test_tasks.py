from unittest import TestCase
from croplands_api import create_app, limiter
from croplands_api.models import Location, db, Record
from croplands_api.tasks.records import get_ndvi


class TestTasks(TestCase):
    app = None

    def setUp(self):
        self.app = TestTasks.app
        with self.app.app_context():
            limiter.enabled = False
            db.create_all()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    @classmethod
    def setUpClass(cls):
        super(TestTasks, cls).setUpClass()
        cls.app = create_app('Testing')

    def test_get_ndvi(self):
        with self.app.app_context():
            location = Location(lat=40.00, lon=-90.00)
            db.session.add(location)
            db.session.commit()

            r1 = Record(location_id=location.id, year=2010, month=2)
            db.session.add(r1)

            db.session()
            db.session.flush()

            # pass entire record object
            get_ndvi(record=r1)

            # pass record.id
            get_ndvi(1)
