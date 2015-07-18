from flask import Response, stream_with_context, request
import requests
from gfsad import limiter
from gfsad.views.tiles import tile_blueprint
from gfsad.views.tiles.gee import get_map, build_url
import time


def parse_request_args_values(values):
    """
    Takes in values for query parameters and returns a single
    element if the length of the array is one.
    :param values: *
    :return: *
    """
    if type(values) is list and len(values) == 1:
        return values[0]
    return values


current_milli_time = lambda: int(round(time.time() * 1000))


@tile_blueprint.route("/<asset>/<x>/<y>/<z>")
@limiter.limit("2000 per minute")
def tile_proxy(x, y, z, asset):
    """
    View handler for map tiles. Acts as a proxy to google earth engine which can
    be cached with an additional layer such as AWS Cloudfront.
    :param x:
    :param y:
    :param z:
    :param asset:
    :return:
    """
    time_start = current_milli_time()
    map_args = {}

    # add query parameters to map arguments
    for k, v in request.args.items():
        map_args[k] = parse_request_args_values(v)

    map_args['asset'] = asset

    # get the map information from google earth engine
    map = get_map(**map_args)

    time_mid = current_milli_time()

    # build the url for tiles
    url = build_url(map['mapid'], map['token'], int(x), int(y), int(z))
    req = requests.get(url, stream=True)

    def generate():
        """
        returns response in pieces
        :return:
        """
        for chunk in req.iter_content(2048):
            yield chunk

    return Response(generate(), content_type=req.headers['content-type'])

