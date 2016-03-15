import datetime
from flask import Blueprint, jsonify, request, Response
from croplands_api import limiter
from croplands_api.utils.google.gee import extract, ee, get_map, build_url
import requests

gee = Blueprint('gee', __name__, url_prefix='/gee')


@gee.route('/time_series')
@limiter.limit("2 per second")
def time_series():
    """
    Returns the time series to the user.
    :return: JSON
    """

    lat = request.args.get('lat', 31.74292, type=float)
    lon = request.args.get('lon', -110.051375, type=float)
    start = request.args.get('date_start', '2000-01-01', type=str)
    end = request.args.get('date_end', datetime.date.today().isoformat(), type=str)
    collection = request.args.get('collection', 'MODIS/MOD13Q1', type=str)

    ee.ImageCollection(collection).filterDate(start, end)

    try:
        results = {'results': extract(ee.Geometry.Point(lon, lat)),
                   'lat': lat, 'lon': lon}
    except Exception as e:
        return jsonify({'status': 'error', 'message': e.message})

    return jsonify(results)


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


@gee.route("/tiles/<asset>/<x>/<y>/<z>")
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
    map_args = {}

    # add query parameters to map arguments
    for k, v in request.args.items():
        map_args[k] = parse_request_args_values(v)

    map_args['asset'] = asset

    # get the map information from google earth engine
    print(map_args)
    map = get_map(**map_args)


    # build the url for tiles
    url = build_url(map['mapid'], map['token'], int(x), int(y), int(z))
    req = requests.get(url, stream=True)
    print(url)

    def generate():
        """
        returns response in pieces
        :return:
        """
        for chunk in req.iter_content(2048):
            yield chunk

    return Response(generate(), content_type=req.headers['content-type'])