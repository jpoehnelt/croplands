from flask import current_app
from flask_jwt import verify_jwt, current_user
from itsdangerous import URLSafeTimedSerializer
from datetime import timedelta
import time

from gfsad import jwt


def generate_token(data, secret):
    """
    Simple wrapp for url safe timed serializer.
    :param data: data to sign
    :param secret: secret used to verify
    :return: token
    """
    s = URLSafeTimedSerializer(secret_key=secret)
    return s.dumps(data)


def decode_token(token, secret, max_age=300):
    """
    Returns the signed data for the token

    :param token:
    :param secret:
    :param max_age:
    :return:
    """
    s = URLSafeTimedSerializer(secret_key=secret)
    return s.loads(token, max_age=max_age)


def make_jwt(user):
    """
    Uses flask_jwt to create a json web token with expiration
    :param user:
    :return:
    """
    return jwt.encode_callback(user.make_token_payload(get_token_expiration()))


def get_token_expiration():
    """
    Calculates the expiration time in seconds for tokens.
    :return: timestamp
    """
    expires_in = current_app.config['JWT_EXPIRATION_DELTA']
    if isinstance(expires_in, timedelta):
        expires_in = int(expires_in.total_seconds())
    expires_on = expires_in + current_app.config['JWT_LEEWAY'] + int(time.time())
    return expires_on


def load_user(*args, **kwargs):
    """
    Tries to verify jwt and load user.

    :param args:
    :param kwargs:
    :return: None
    """
    if current_user._get_current_object() is None:
        try:
            verify_jwt()
        except:
            return 'anonymous'
    return current_user


def allowed_roles(role):
    """
    This function returns a function for checking if the user
    is one of the allowed roles for the endpoint. Usage is the following:
    get_role_check_method(['partner'])
    >> function
    get_role_check_method(['any')
    >> function
    get_role_check_method(['partner', 'team', 'admin')
    >> function
    get_role_check_method(['any')()
    >> boolean
    :param role: String or List of strings
    :return: Function
    """
    if type(role) is str:
        role = [role]

    user = load_user()
    return any([verify_role(r, user) for r in role])


def verify_role(role, user):
    if user is 'anonymous':
        return False

    if role == 'any':
        return True

    if user.role == role:
        return True

    return False