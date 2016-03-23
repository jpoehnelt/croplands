from croplands_api import create_app, db, limiter
from unittest import TestCase
import json
import base64
from croplands_api.auth import generate_token, decode_token, get_token_expiration
from croplands_api.models.user import User
import time
from itsdangerous import SignatureExpired


def get_payload(token):
    encoded_payload = token.split(".")[1].strip()
    encoded_payload += '=' * (len(encoded_payload) % 4)
    return json.loads(base64.b64decode(encoded_payload))


class TestAuthViews(TestCase):
    app = None

    def setUp(self):
        self.app = TestAuthViews.app
        with self.app.app_context():
            limiter.enabled = False
            db.create_all()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    @classmethod
    def setUpClass(cls):
        super(TestAuthViews, cls).setUpClass()
        cls.app = create_app('Testing')

    def test_register_methods(self):
        with self.app.test_client() as c:
            # test that get request to endpoint returns method not allowed
            get = c.get('/auth/register')
            self.assertEqual(get.status_code, 405)

            # test get response
            headers = [('Content-Type', 'application/json')]
            data = json.dumps({})
            response = c.post('/auth/register', headers=headers, data=data)
            self.assertEqual(response.status_code, 400)

    def test_register_errors(self):
        with self.app.test_client() as c:
            me = {'first': 'Justin', 'last': 'Poehnelt', 'affiliation': 'USGS',
                  'password': 'woot1LoveCookies!', 'email': 'jpoehnelt+test@usgs.gov'}
            fields = me.keys()

            # loop through all required fields and remove one at a time
            # to check for errors
            for field in fields:
                if field == 'affiliation':
                    continue
                # remove a single field
                data = me.copy()
                data.pop(field)
                # json
                data = json.dumps(data)
                # headers are set
                headers = [('Content-Type', 'application/json')]
                response = c.post('/auth/register', headers=headers, data=data)
                response.json = json.loads(response.data)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json['description'], "Missing or invalid information")

    def test_register_token(self):
        self.app.config['AUTH_REQUIRE_CONFIRMATION'] = False
        with self.app.test_client() as c:
            # try one that works!
            me = {'first': 'Justin', 'last': 'Poehnelt', 'affiliation': 'USGS',
                  'password': 'woot1LoveCookies!', 'email': 'jpoehnelt+test@usgs.gov'}
            headers = [('Content-Type', 'application/json')]
            response = c.post('/auth/register', headers=headers, data=json.dumps(me))
            response.json = json.loads(response.data)

            payload = get_payload(response.json['data']['token'])
            self.assertAlmostEqual(int(payload['expires']), get_token_expiration(), delta=4)
            self.assertEqual(response.json['status_code'], 201)
            self.assertEqual(response.json['description'], 'User created')
            self.assertEqual(payload['first'], me['first'])
            self.assertEqual(payload['last'], me['last'])
            self.assertEqual(payload['email'], me['email'])

    def test_register_duplicate(self):
        me = {'first': 'Justin', 'last': 'Poehnelt', 'affiliation': 'USGS',
              'password': 'woot1LoveCookies!', 'email': 'jpoehnelt+test@usgs.gov'}
        headers = [('Content-Type', 'application/json')]

        with self.app.test_client() as c:
            # first user
            c.post('/auth/register', headers=headers, data=json.dumps(me))
            # duplicate user
            response = c.post('/auth/register', headers=headers, data=json.dumps(me))

            # response to duplicate user
            response.json = json.loads(response.data)

            self.assertEqual(response.json['status_code'], 409)
            self.assertEqual(response.json['description'],
                             'Account with that email already exists.')

    def test_forgot_no_email(self):
        with self.app.test_client() as c:
            headers = [('Content-Type', 'application/json')]
            response = c.post('/auth/forgot', headers=headers,
                              data=json.dumps({'email': 'fake.email@nowhere.om'}))
            response.json = json.loads(response.data)
            self.assertEqual(response.json['status_code'], 200)

    def test_forgot(self):

        with self.app.test_client() as c:
            me = {
                'email': 'jpoehnelt+test@usgs.gov',
                'password': 'woot1LoveCookies!',
                'first': 'Justin',
                'last': 'Poehnelt',
            }
            # create user
            # get /forgot
            headers = [('Content-Type', 'application/json')]
            c.post('/auth/register', headers=headers,
                   data=json.dumps(me))
            response = c.post('/auth/forgot', headers=headers,
                              data=json.dumps({'email': me['email']}))
            response.json = json.loads(response.data)
            self.assertEqual(response.json['status_code'], 200)

    def test_forgot_rate_limit(self):
        with self.app.test_client() as c:
            limiter.enabled = True

            me = {
                'email': 'jpoehnelt+test@usgs.gov',
                'password': 'woot1LoveCookies!',
                'first': 'Justin',
                'last': 'Poehnelt',
            }
            # create user
            # get /forgot
            headers = [('Content-Type', 'application/json')]
            c.post('/auth/register', headers=headers,
                   data=json.dumps(me))
            for i in range(11):
                response = c.post('/auth/forgot', headers=headers,
                                  data=json.dumps({'email': me['email']}))
            response.json = json.loads(response.data)
            self.assertEqual(response.json['status_code'], 429)

    def test_forgot_token(self):
        with self.app.test_client() as c:
            # try one that works!
            me = {'first': 'Justin', 'last': 'Poehnelt', 'affiliation': 'USGS',
                  'password': 'woot1LoveCookies!', 'email': 'jpoehnelt+test@usgs.gov'}
            headers = [('Content-Type', 'application/json')]
            c.post('/auth/register', headers=headers, data=json.dumps(me))
            c.post('/auth/login', headers=headers,
                   data=json.dumps({'email': me['email'], 'password': me['password']}))
            token = generate_token(me, self.app.config['SECRET_KEY'])

            # test token within time limit of 300 seconds
            me_from_token = decode_token(token, self.app.config['SECRET_KEY'], 300)
            self.assertEqual(me, me_from_token)

            # test token after time limit
            time.sleep(2)
            self.assertRaises(SignatureExpired, decode_token, token,
                              self.app.config['SECRET_KEY'], 1)

    def test_reset(self):
        with self.app.test_client() as c:
            # try one that works!
            me = {'first': 'Justin', 'last': 'Poehnelt', 'affiliation': 'USGS',
                  'password': 'woot1LoveCookies!', 'email': 'jpoehnelt+test@usgs.gov'}
            headers = [('Content-Type', 'application/json')]
            response = c.post('/auth/register', headers=headers, data=json.dumps(me))
            response.json = json.loads(response.data)
            payload = get_payload(response.json['data']['token'])

            # user
            user = User.from_token_payload(payload)
            token = generate_token(user.email, self.app.config['SECRET_KEY'])
            new_password = 'woot1LoveCookies2!'
            # token not preset
            reset = c.post('/auth/reset', headers=headers,
                           data=json.dumps({'password': 'woot1LoveCookies2!'}))
            reset.json = json.loads(reset.data)
            self.assertEqual(reset.status_code, 400)
            self.assertEqual(reset.json['status_code'], 400)

            # password not present
            reset = c.post('/auth/reset', headers=headers, data=json.dumps({'token': token}))
            reset.json = json.loads(reset.data)
            self.assertEqual(reset.status_code, 400)
            self.assertEqual(reset.json['status_code'], 400)

            # bad token
            reset = c.post('/auth/reset', headers=headers,
                           data=json.dumps({'password': new_password, 'token': 'asdfasdf'}))
            reset.json = json.loads(reset.data)
            self.assertEqual(reset.status_code, 400)
            self.assertEqual(reset.json['status_code'], 400)
            self.assertEqual(reset.json['description'], 'Your token is not valid.')

            # good token and password
            reset = c.post('/auth/reset', headers=headers,
                           data=json.dumps({'password': new_password, 'token': token}))
            reset.json = json.loads(reset.data)
            self.assertEqual(reset.status_code, 200)
            self.assertEqual(reset.json['status_code'], 200)
            self.assertEqual(reset.json['description'], 'Password was changed')

    def test_login(self):
        with self.app.test_client() as c:
            # try one that works!
            me = {'first': 'Justin', 'last': 'Poehnelt', 'affiliation': 'USGS',
                  'password': 'woot1LoveCookies!', 'email': 'jpoehnelt+test@usgs.gov',
                  'status': 'ENABLED'}
            headers = [('Content-Type', 'application/json')]

            c.post('/auth/register', headers=headers, data=json.dumps(me))

            response = c.post('/auth/login', headers=headers,
                              data=json.dumps({'email': me['email'], 'password': me['password']}))
            response.json = json.loads(response.data)

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json['status_code'], 200)
            self.assertIn('token', response.json['data'])
            payload = get_payload(response.json['data']['token'])
            self.assertAlmostEqual(int(payload['expires']), get_token_expiration(), delta=4)
            self.assertEqual(payload['first'], me['first'])
            self.assertEqual(payload['last'], me['last'])
            self.assertEqual(payload['email'], me['email'])

            # check case insensitivity of email
            response = c.post('/auth/login', headers=headers,
                              data=json.dumps(
                                  {'email': me['email'].upper(), 'password': me['password']}))
            self.assertEqual(response.status_code, 200)

            # check login without email
            response = c.post('/auth/login', headers=headers,
                              data=json.dumps({'password': me['password']}))
            response.json = json.loads(response.data)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json['status_code'], 400)

            response = c.post('/auth/login', headers=headers,
                              data=json.dumps({'email': me['email']}))
            response.json = json.loads(response.data)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json['status_code'], 400)

            response = c.post('/auth/login', headers=headers,
                              data=json.dumps({'email': 'asdfasdf', 'password': 'adsfasdfas'}))
            response.json = json.loads(response.data)
            self.assertEqual(response.status_code, 401)
            self.assertEqual(response.json['status_code'], 401)
