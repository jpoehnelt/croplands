import datetime
from unittest import TestCase
from gfsad import create_app, limiter
from gfsad.models import Location, db, TimeSeries, Record
from gfsad.tasks.records import get_ndvi, build_static_records
import random
from sqlalchemy.exc import IntegrityError


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
        cls.app = create_app('gfsad.config.testing')

    def test_get_ndvi(self):
        with self.app.app_context():
            location = Location(lat='40.00', lon='-90.00')
            db.session.add(location)
            db.session.commit()

            get_ndvi.delay(id=location.id, lat=location.lat, lon=location.lon)

            time_series = TimeSeries.query.all()

    def test_build_static_records(self):
        with self.app.app_context():
            for i in range(4):
                if i % 10000 == 0:
                    pass
                    # print i / 10000
                try:
                    location = Location(lat=random.randint(-5000, 5000) / 100.0,
                                        lon=random.randint(-18000, 18000) / 100.0)
                    db.session.add(location)
                    db.session.commit()

                    record = Record(year='2014', month='01', location_id=location.id)
                    db.session.add(record)
                    db.session.commit()


                except IntegrityError as e:
                    db.session.rollback()

            build_static_records()


