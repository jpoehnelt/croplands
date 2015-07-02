from flask import Response, stream_with_context, request
import requests
from gfsad import limiter
from gfsad.views.tiles import tile_blueprint
from gfsad.views.tiles.gee import get_map, build_url
import time

current_milli_time = lambda: int(round(time.time() * 1000))

@tile_blueprint.route("/<asset>/<x>/<y>/<z>")
@limiter.limit("1000 per minute")
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
    map_args = request.args.__dict__
    map_args['asset'] = asset

    map = get_map(**map_args)

    time_mid = current_milli_time()

    url = build_url(map['mapid'], map['token'], int(x), int(y), int(z))
    req = requests.get(url, stream=True)
    print "time to map_id: %dms, to gee response: %dms" % (time_mid - time_start, current_milli_time() - time_mid)

    def generate():
        for chunk in req.iter_content(1024):
            yield chunk

    return Response(generate(), content_type=req.headers['content-type'])

