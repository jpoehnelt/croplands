from flask import request, session
from gfsad import api
from gfsad.models import Tile, TileClassification
from gfsad.tasks.classifications import compute_tile_classification_statistics
import uuid
from werkzeug.exceptions import BadRequest


def update_tile_classification_statistics(result=None, **kwarg):
    compute_tile_classification_statistics(result['tile'])


def insert_session(result=None, **kwargs):
    """
    Creates a session unique identifier for later capturing information on the user
    accross classifications.
    :param data:
    :param kwargs:
    :return:
    """
    if 'uid' not in session:
        session['uid'] = str(uuid.uuid4())
    result['session_id'] = session['uid']


def check_session_id(data=None, **kwargs):
    """
    Checks session id.
    :param data:
    :param kwargs:
    :return:
    """
    if 'uid' not in session or data['session_id'] != session['uid']:
        raise BadRequest()



def create(app):
    api.create_api(Tile,
                   app=app,
                   collection_name='tiles',
                   methods=['GET'],
                   postprocessors={
                       'GET_MANY': [insert_session]
                   },
                   results_per_page=100
    )

    api.create_api(TileClassification,
                   app=app,
                   collection_name='tile_classifications',
                   methods=['POST'],
                   preprocessors={
                       'POST': [check_session_id]
                   },
                   postprocessors={
                       'POST': [update_tile_classification_statistics]
                   }
    )
