from flask import request
from flask_jwt import current_user
from croplands_api.exceptions import Unauthorized
from croplands_api.tasks.records import get_ndvi
from croplands_api.auth import allowed_roles, verify_role, is_anonymous


def api_roles(role):
    def wrapper(*args, **kwargs):
        if not allowed_roles(role):
            raise Unauthorized()

    return wrapper


def after_post_record():
    get_ndvi.apply()


def add_user_to_posted_data(data=None, **kwargs):
    """
    Appends user_id to data if user is not none.
    :param data: data from api endpoint
    :param kwargs:
    :return: None
    """

    if not is_anonymous():
        data['user_id'] = current_user.id

        #TODO Improve method of applying user_id to sub models
        # perhaps using get_related_model? looping through entities of array?
        if 'records' in data:
            for record in data['records']:
                record['user_id'] = current_user.id

        if 'images' in data:
            for image in data['images']:
                image['user_id'] = current_user.id


def remove_relations(data=None, **kwargs):
    """
    Removes all relations from patched data.
    :param data:
    :param kwargs:
    :return: None
    """
    if request.method == 'OPTIONS':
        return
    keys_to_delete = []
    for key, val in data.iteritems():
        if type(data[key]) is list:
            keys_to_delete.append(key)

    for key in keys_to_delete:
        del data[key]

def debug_post(data=None, **kwargs):
    print data
    print "authorization header" + str(request.headers.get('Authorization', None))