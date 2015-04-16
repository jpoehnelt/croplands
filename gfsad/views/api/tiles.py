from flask import request, session
from gfsad import api
from gfsad.models import Tile, TileClassification
from gfsad.tasks.classifications import compute_tile_classification_statistics
import uuid
from werkzeug.exceptions import BadRequest


def update_tile_classification_statistics(result=None, **kwarg):
    compute_tile_classification_statistics.delay(result['tile'])


def insert_session(data=None, **kwargs):
    """
    Creates a session unique identifier for later capturing information on the user
    accross classifications.
    :param data:
    :param kwargs:
    :return:
    """

    data['session_id'] = request.remote_addr if request.remote_addr is not None else 1



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
