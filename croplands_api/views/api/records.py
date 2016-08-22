from croplands_api import api
from croplands_api.models import Record, RecordHistory, RecordRating, db
from croplands_api.tasks.records import get_ndvi
from processors import (
    api_roles,
    add_user_to_posted_data,
    remove_relations
)
from flask import json
from flask_restless.helpers import to_dict
import copy


def save_record_state_to_history(result=None, **kwargs):
    """
    Saves the current state of the record so that changes can be undone.
    :param result:
    :param kwargs:
    :return:
    """

    # No need to store history array within the history table data
    data = copy.copy(result)
    if 'history' in data:
        del data['history']

    if 'ratings' in data:
        del data['ratings']

    history = RecordHistory(record_id=result['id'], user_id=result['user_id'],
                            data=json.dumps(data))

    db.session.add(history)
    db.session.commit()

    if 'history' not in result:
        result['history'] = []

    result['history'].insert(0, to_dict(history))


def mark_ratings_stale(result=None, **kwargs):
    """
    When a record is changed, the rating may or may not be applicable.
    This function loops through all ratings on the record and marks each stale.
    :param result:
    :param kwargs:
    :return:
    """
    if 'ratings' in result and len(result['ratings']):
        for rating in result['ratings']:
            rating['stale'] = True

    # TODO perform this in background
    ratings = RecordRating.query.filter_by(record_id=int(result['id'])).all()
    for rating in ratings:
        rating.stale = True
        # TODO Alert user of change?
    db.session.commit()


def notify(result=None, **kwargs):
    pass
    # Get User that Modified Result
    # user = load_user()
    #
    # # Build Content
    # subject = "Record #%d Updated" % result['id']
    # message = "This record has been updated by: %s %s" % (user.first, user.last)
    #
    # # Create Notification
    # note = Notification(record_id=result['id'], location_id=result['location_id'], subject=subject,
    # message=message)
    # db.session.add(note)
    # db.session.commit()


def get_external_data(result=None, **kwargs):
    try:
        get_ndvi.delay(result['id'])
    except Exception as e:
        print e


def create(app):
    api.create_api(Record,
                   app=app, collection_name='records',
                   methods=['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
                   preprocessors={
                       'POST': [add_user_to_posted_data],
                       'PATCH_SINGLE': [api_roles(['partner', 'mapping', 'validation', 'admin']),
                                        remove_relations, add_user_to_posted_data],
                       'PATCH_MANY': [api_roles('admin'), remove_relations],
                       'DELETE': [api_roles('admin')]
                   },
                   postprocessors={
                       'POST': [save_record_state_to_history, notify, get_external_data],
                       'PATCH_SINGLE': [save_record_state_to_history, notify,
                                        mark_ratings_stale],
                       'PATCH_MANY': [],
                       'DELETE': []
                   }
    )
