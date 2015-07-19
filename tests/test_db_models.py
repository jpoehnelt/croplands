import datetime
from unittest import TestCase
from gfsad import create_app, limiter
from gfsad.models import Location, db, TimeSeries, User
import random
from sqlalchemy.exc import IntegrityError


class TestDatabase(TestCase):
    app = None

    def setUp(self):
        self.app = TestDatabase.app
        with self.app.app_context():
            limiter.enabled = False
            db.create_all()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    @classmethod
    def setUpClass(cls):
        super(TestDatabase, cls).setUpClass()
        cls.app = create_app('Testing')
        with cls.app.app_context():
            db.create_all()

    def test_time_series(self):
        with self.app.app_context():
            location = Location(lat='0.00', lon='0.00')
            db.session.add(location)
            db.session.commit()

            # try with missing location
            data = TimeSeries(series='modis_ndvi', value=random.randint(-10, 100) / 100.0,
                              date_acquired=datetime.datetime.utcnow())
            db.session.add(data)
            self.assertRaises(IntegrityError, db.session.commit)
            db.session.rollback()

            # this should work
            data = TimeSeries(location_id=location.id, series='modis_ndvi',
                              value=random.randint(-10, 100) / 100.0,
                              date_acquired=datetime.datetime.utcnow())
            db.session.add(data)
            db.session.commit()
            self.assertAlmostEqual(data.date_updated, datetime.datetime.utcnow(),
                                   delta=datetime.timedelta(seconds=1))

    def test_user_email_case_insensitivity(self):
        """
        Emails are by nature case insensitive. This test checks that
        the user model correctly handles this specification.
        :return:
        """
        with self.app.app_context():
            data = {
                'email': 'Test@test.net',
                'password': 'password',
                'first': 'First',
                'last': 'Last'
            }
            user = User(**data)
            assert(user.email.islower())

            user = User.create(**data)
            assert(user.email.islower())

            user = User.from_email(data['email'])
            self.assertIsNotNone(user)

            user = User.from_login(data['email'], data['password'])
            self.assertIsNotNone(user)
