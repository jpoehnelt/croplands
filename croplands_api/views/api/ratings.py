from croplands_api import api
from croplands_api.exceptions import Unauthorized
from croplands_api.models import RecordRating, User, db
from croplands_api.auth import is_anonymous, current_user
from processors import (
    api_roles,
    add_user_to_posted_data
)
from croplands_api.tasks.records import sum_ratings_for_record


def rating_adjuster(data=None, **kwargs):
    """
    Adjusts the rating to a specific range.
    :param data:
    :param kwargs:
    :return:
    """
    # force rating to -1 to 1 range
    data['rating'] = min(1, max(-1, data['rating']))


def cannot_edit_other_user_rating(data=None, **kwargs):
    """
    This function raises an exception is a user tries to edit another user's rating.
    :param data: rating
    :param kwargs: catch all
    :return: None
    """
    if is_anonymous():
        raise Unauthorized(description="Cannot change another user's rating.")
    rating = RecordRating.query.filter_by(id=int(kwargs['instance_id'])).first()
    if current_user.id != rating.user_id:
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


def delete_existing_rating_from_user_for_record(data=None, **kwargs):
    """
    Deletes the existing rating for the record from the user if it exists.
    :param data:
    :param kwargs:
    :return: None
    """
    print data
    record = RecordRating.query.filter_by(record_id=data['record_id'],
                                          user_id=data['user_id']).first()
    if record is not None:
        db.session.delete(record)
        db.session.commit()


def create(app):
    api.create_api(RecordRating,
                   app=app,
                   collection_name='ratings',
                   methods=['GET', 'POST', 'PATCH', 'PUT'],
                   preprocessors={
                       'POST': [api_roles(['registered', 'partner', 'mapping', 'validation', 'admin']),
                                add_user_to_posted_data,
                                delete_existing_rating_from_user_for_record,
                                rating_adjuster],
                       'PATCH_SINGLE': [api_roles(['registered', 'partner', 'mapping', 'validation', 'admin']),
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