from functools import wraps
from gfsad.auth import allowed_roles
from gfsad.exceptions import Unauthorized


# def role(roles):
#     """Decorator that checks if the user is one of the roles passed as arguments.
#
#     """
#     def wrapper(fn):
#         @wraps(fn)
#         def decorated_view(*args, **kwargs):
#             if not allowed_roles(roles):
#                 raise Unauthorized
#             return fn(*args, **kwargs)
#         return decorated_view
#     return wrapper
#
