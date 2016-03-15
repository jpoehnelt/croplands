from unittest import TestCase
from croplands_api import create_app, limiter
from croplands_api.models import Location, db, User
from croplands_api.utils.geo import get_destination


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
            assert (user.email.islower())

            user = User.create(**data)
            assert (user.email.islower())

            user = User.from_email(data['email'])
            self.assertIsNotNone(user)

            user = User.from_login(data['email'], data['password'])
            self.assertIsNotNone(user)

    def test_location_within(self):
        with self.app.app_context():
            l1 = Location(lat=40, lon=-110)
            l2 = Location(lat=40.0000000001, lon=-110)
            l3 = Location(lat=40.9999999999, lon=-110.99999999999)
            db.session.add(l1)
            db.session.add(l2)
            db.session.add(l3)
            db.session.commit()

            self.assertEqual(len(Location.within(l1.lat, l1.lon, 1)), 2)

    def test_location_nearby_mixed_use(self):
        with self.app.app_context():
            l1 = Location(lat=40, lon=-110, use_validation=True)
            db.session.add(l1)
            db.session.commit()

            l2 = Location(lat=40.0000000001, lon=-110, use_validation=False)
            db.session.add(l2)
            db.session.commit()

            self.assertEqual(l1.use_validation, l2.use_validation)

            pt = get_destination(l1.lat, l1.lon, 90, 3)  # in km
            l3 = Location(lat=pt[0], lon=pt[1], use_validation=False)
            db.session.add(l3)
            db.session.commit()

            self.assertEqual(False, l3.use_validation)

    def test_location_nearby_mixed_use_three_samples(self):
        with self.app.app_context():
            l1 = Location(lat=40, lon=-110, use_validation=True)
            db.session.add(l1)
            db.session.commit()

            pt1 = get_destination(l1.lat, l1.lon, 90, 1.5)  # in km
            l2 = Location(lat=pt1[0], lon=pt1[1], use_validation=False)
            db.session.add(l2)
            db.session.commit()

            pt2 = get_destination(l1.lat, l1.lon, 90, .75)  # in km

            # make sure we are in the failing condition with pt2
            self.assertEqual(2, len(Location.within(pt2[0], pt2[1], 1000)))
            l3 = Location(lat=pt2[0], lon=pt2[1], use_validation=False)
            db.session.add(l3)
            db.session.commit()

            self.assertEqual(True, l3.use_invalid)
