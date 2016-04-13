from flask import Blueprint, request, jsonify, render_template, current_app
from flask_mail import Message
from flask_jwt import jwt_required, verify_jwt
from functools import wraps

from croplands_api import limiter
from croplands_api.tasks import send_email
from croplands_api.models import User
from croplands_api.exceptions import FieldError
from croplands_api.views.json_response import JSONResponse
from croplands_api.auth import decode_token, generate_token, make_jwt


# create blueprint to separate scope
auth = Blueprint('auth', __name__, url_prefix='/auth')


def required_fields(*fields):
    """Decorator that raises FieldError if not all required fields are included in the json.
    """

    def wrapper(fn):
        @wraps(fn)
        def decorated_view(*args, **kwargs):
            errors = {}
            for field in fields:
                if field not in request.json:
                    if field not in errors:
                        errors[field] = []
                    errors[field].append(field + ' is required')

            if len(errors) > 0:
                raise FieldError(error=errors, description="Missing or invalid information")

            return fn(*args, **kwargs)
        return decorated_view
    return wrapper


@auth.route('/register', methods=['POST'])
@required_fields('email', 'first', 'last', 'password')
@limiter.limit("5 per hour", methods=['POST'], error_message='Try again later.')
def register():
    data = request.json
    # create user with the data, 
    # all stormpath exceptions will be caught and passed on in standardized format
    user = User.create(**data)

    # if requires confirmation
    if current_app.config['AUTH_REQUIRE_CONFIRMATION']:
        token = generate_token((user.email, user.custom_data['email_verification_token']),
                               current_app.config['SECRET_KEY'])
        # Send Email #
        link = 'https://croplands.org/app/a/confirm?t=' + token
        send_confirmation_email(link, user.email)
        return JSONResponse(status_code=201, description='User created')

    # else just return token
    response_data = {
        'token': make_jwt(user)
    }
    return JSONResponse(status_code=201, description='User created',
                        data=response_data)


@auth.route('/login', methods=['POST'])
@required_fields('email', 'password')
@limiter.limit("20 per hour", methods=['POST'], error_message="Try again in an hour.", key_func=lambda: request.json['email'] if (
        hasattr(request, 'json') and hasattr(request.json, 'email')) else request.remote_addr)
def login():
    user = User.from_login(request.json['email'], request.json['password'])
    return JSONResponse(status_code=200, description='User logged in',
                        data={
                            'token': make_jwt(user)
                        })


@auth.route('/forgot', methods=['POST'])
@required_fields('email')
@limiter.limit("10 per day", methods=['POST'])
def forgot_password():
    user = User.from_email(request.json['email'])
    if user is not None:
        # send email
        token = generate_token(user.email, current_app.config['SECRET_KEY'])
        # Send Email #
        link = 'https://croplands.org/app/a/reset?token=' + token
        send_reset_email(link, user.email)

    return jsonify({'status_code': 200, 'description': 'Email sent'}), 200


@auth.route('/reset', methods=['POST'])
@required_fields('password', 'token')
@limiter.limit("10 per day", methods=['POST'])
def reset_password():
    token = request.json['token']
    email = decode_token(token, current_app.config['SECRET_KEY'],
                         current_app.config['AUTH_RESET_TOKEN_EXPIRATION'])
    user = User.from_email(email)
    user.change_password(request.json['password'])
    return JSONResponse(status_code=200, description='Password was changed',
                        data={'token': make_jwt(user)})


@auth.route('/send_confirm', methods=['POST'])
@required_fields('email')
@limiter.limit("10 per day", methods=['POST'])
def send_confirm():
    user = User.from_email(request.json['email'])
    if user is not None:
        # send email
        token = generate_token((user.email, user.custom_data['email_verification_token']),
                               current_app.config['SECRET_KEY'])
        # Send Email #
        link = 'http://www.croplands.org/account/confirm?t=' + token
        send_confirmation_email(link, user.email)
    return JSONResponse(status_code=200, description='Confirmation email sent')


@auth.route('/confirm', methods=['POST'])
@required_fields('token')
def confirm():
    token = request.json['token']
    email, token = decode_token(token, current_app.config['SECRET_KEY'])
    user = User.from_email(email)
    user.verify(token)
    return JSONResponse(status_code=200, description='Email confirmed')


def send_reset_email(link, email):
    html = render_template('email/reset_instructions.html', reset_link=link)
    body = render_template('email/reset_instructions.txt', reset_link=link)

    msg = Message(recipients=email, body=body, html=html,
                  subject='Global Croplands - Password Reset')
    return send_email(msg)


def send_confirmation_email(link, email):
    html = render_template('email/confirmation_instructions.html', reset_link=link)
    body = render_template('email/confirmation_instructions.txt', reset_link=link)

    msg = Message(recipients=email, body=body, html=html,
                  subject='Global Croplands - Email Verification')
    return send_email(msg)
