from croplands_api.tasks import send_email
from croplands_api import create_app
import requests
import unittest
import json
from flask_mail import Message


class TestEmail(unittest.TestCase):
    app = None

    def setUp(self):
        self.app = TestEmail.app

    @classmethod
    def setUpClass(cls):
        super(TestEmail, cls).setUpClass()
        cls.app = create_app('Testing')

    def test_api(self):
        message = json.dumps({
            "From": "info@croplands.org",
            "To": "justin.poehnelt+tests@gmail.com",
            "Subject": "Test Email",
            "HtmlBody": "<b>Hello</b>",
            "TextBody": "Hello",
            "ReplyTo": "info@croplands.org",
            "TrackOpens": True
        })
        headers = {'X-Postmark-Server-Token': self.app.config['POSTMARK_API_KEY'],
                   'Content-Type': 'application/json',
                   'Accept': 'application/json'}

        r = requests.post("https://api.postmarkapp.com/email", message, headers=headers)

        assert r.status_code

    def test_send_email(self):
        with self.app.app_context():
            msg = Message(subject="Test", recipients="<Justin.Poehnelt+tests@gmail.com>",
                          body="Test Email")
            send_email(msg)
