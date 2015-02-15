from flask import abort

from gfsad import api
from gfsad.models import User
from gfsad.views.api.processors import api_roles, remove_relations
from gfsad.exceptions import Unauthorized
from gfsad.auth import load_user, verify_role


def can_edit_the_user(data=None, **kwargs):
    """
    Determines if the current user can modify the specified user account.

    :param data:
    :param kwargs:
    :return: None
    """

    user = load_user()

    if hasattr(user, 'id') and user.id == int(kwargs['instance_id']):
        return
    if verify_role('admin', user):
        return
    raise Unauthorized()


def check_for_me(data=None, **kwargs):
    """

    :param data:
    :param kwargs:
    :return: None
    """
    user = load_user()
    if user is 'anonymous':
        raise Unauthorized(description="Must send token.")

    if kwargs['instance_id'] == 'me':
        kwargs['instance_id'] = user.id


def ignore_read_only_fields(data=None, **kwargs):
    """
    Removes the read only field from the data. Alternative could be to raise a 409 conflict.
    :param data: json
    :param kwargs:
    :return: None
    """
    read_only = ['password', 'attempts', 'email_verification_token', 'score', 'id', 'status']
    for field in read_only:
        if field in data:
            del data[field]
            # abort(409)


def create(app):
    api.create_api(User,
                   app=app,
                   collection_name='users',
                   methods=['GET', 'PATCH'],
                   results_per_page=50,
                   preprocessors={
                       'GET_SINGLE': [check_for_me],
                       'PATCH_SINGLE': [can_edit_the_user, remove_relations,
                                        ignore_read_only_fields],
                       'PATCH_MANY': [api_roles('admin'), remove_relations,
                                      ignore_read_only_fields],
                       'DELETE': [api_roles('admin'), ]
                   },
                   postprocessors={
                   },
                   exclude_columns=['email', 'password', 'attempts',
                                    'email_verification_token', 'status']
    )

