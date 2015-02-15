from gfsad import api
from gfsad.exceptions import Unauthorized
from gfsad.models import RecordRating, User
from gfsad.auth import load_user
from processors import (
    api_roles,
    add_user_to_posted_data
)
from gfsad.tasks.records import sum_ratings_for_record

def rating_multiplier(data=None, **kwargs):
    """
    This function can be used to give more weight for ratings according to role.
    :param data:
    :param kwargs:
    :return:
    """
    user = load_user()
    data['rating'] *= User.ROLES.index(user.role)


def cannot_edit_other_user_rating(data=None, **kwargs):
    """
    This function raises an exception is a user tries to edit another user's rating.
    :param data: rating
    :param kwargs: catch all
    :return: None
    """
    user = load_user()
    rating = RecordRating.query.filter_by(id=int(kwargs['instance_id'])).first()
    if user.id != rating.user_id:
        raise Unauthorized(description="Cannot change another user's rating.")


def calculate_rating(result=None, **kwargs):
    """
    Calls a function that updates the rating of the record with the sum of its ratings.
    :param result: API Result
    :param kwargs:
    :return: None
    """
    sum_ratings_for_record(result['record_id'])
    # sum_ratings_for_record.delay(result['record_id']) #async with celery


def create(app):
    api.create_api(RecordRating,
                   app=app,
                   collection_name='ratings',
               methods=['GET', 'POST', 'PATCH', 'PUT'],
               preprocessors={
                   'POST': [api_roles(['registered', 'partner', 'team', 'admin']),
                            add_user_to_posted_data],
                   'PATCH_SINGLE': [api_roles(['registered', 'partner', 'team', 'admin']),
                                    cannot_edit_other_user_rating],
                   'PATCH_MANY': [api_roles('admin')],
                   'DELETE': [api_roles('admin')]
               },
               postprocessors={
                   'POST': [calculate_rating],
                   'PATCH_SINGLE': [calculate_rating],
                   'PATCH_MANY': [],
                   'DELETE': []
               }
)