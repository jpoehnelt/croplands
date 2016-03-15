from croplands_api import create_app, db, limiter
import unittest


class TestUtilsS3(unittest.TestCase):
    app = None

    def setUp(self):
        self.app = TestUtilsS3.app
        with self.app.app_context():
            limiter.enabled = False
            db.create_all()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    @classmethod
    def setUpClass(cls):
        super(TestUtilsS3, cls).setUpClass()
        cls.app = create_app('Testing')

        # def test_image_upload_to_s3_from_base64(self):
        # # TODO create image dynamically with pillow
        #     with self.app.app_context():
        #         with open('tests/test.JPG', "rb") as img:
        #             img_str = base64.b64encode(img.read())
        #         f = upload_image(img_str)
        #         url = f.generate_url(10)
        #         get = requests.get(url.split('?')[0])
        #         self.assertEqual(get.status_code, 200)
        #
        #         # cleanup
        #         delete_image(f.key)
        #         get = requests.get(url.split('?')[0])
        #         self.assertEqual(get.status_code, 404)
