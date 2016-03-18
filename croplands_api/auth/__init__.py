from flask import current_app
from flask_jwt import verify_jwt, current_user, JWTError
from itsdangerous import URLSafeTimedSerializer
from datetime import timedelta
import time

from croplands_api import jwt


def generate_token(data, secret):
    """
    Simple wrapp for url safe timed serializer.
    :param data: data to sign
    :param secret: secret used to verify
    :return: token
    """
    s = URLSafeTimedSerializer(secret_key=secret)
    return s.dumps(data)


def decode_token(token, secret, max_age=3600):
    """
    Returns the signed data for the token

    :param token:
    :param secret:
    :param max_age:
    :return:
    """

    s = URLSafeTimedSerializer(secret_key=secret)
    ret = s.loads(token, max_age=max_age)
    return ret


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
    Tries to verify jwt and load user, @jwt.required is a separate check.
    :param args:
    :param kwargs:
    :return: None
    """
    if is_anonymous():
        try:
            verify_jwt()
        except JWTError:
            pass


def is_anonymous():
    """
    Check if local proxy object is set
    :return: Boolean
    """
    return current_user._get_current_object() is None


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

    return any([verify_role(r) for r in role])


def verify_role(role):
    """
    Check if user has the associated role.
    :param role:
    :param user:
    :return: Boolean
    """
    if is_anonymous():
        return False

    if role == 'any':
        return True

    if current_user.role == role:
        return True

    return False