from gfsad import api
from gfsad.models import Tile


def create(app):
    api.create_api(Tile,
                   app=app,
                   collection_name='tiles',
                   methods=['GET'],
    )
