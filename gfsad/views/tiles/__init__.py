from flask import Blueprint
from gfsad.views.tiles.gee import get_map

tile_blueprint = Blueprint('tiles', __name__, url_prefix='/tiles')

from gfsad.views.tiles.proxy import tile_proxy



