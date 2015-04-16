from flask import request, session
from gfsad import api
from gfsad.models import Tile, TileClassification
from gfsad.tasks.classifications import compute_tile_classification_statistics
import uuid


def update_tile_classification_statistics(result=None, **kwarg):
    compute_tile_classification_statistics(result['tile'])


def insert_session(data=None, **kwargs):
    """
    Creates a session unique identifier for later capturing information on the user
    accross classifications.
    :param data:
    :param kwargs:
    :return:
    """
    if 'uid' not in session:
        session['uid'] = str(uuid.uuid4())
    data['session_id'] = session['uid']


def create(app):
    api.create_api(Tile,
                   app=app,
                   collection_name='tiles',
                   methods=['GET'],
                   results_per_page=100
    )

    api.create_api(TileClassification,
                   app=app,
                   collection_name='tile_classifications',
                   methods=['POST'],
                   preprocessors={
                       'POST': [insert_session]
                   },
                   postprocessors={
                       'POST': [update_tile_classification_statistics]
                   }
    )
