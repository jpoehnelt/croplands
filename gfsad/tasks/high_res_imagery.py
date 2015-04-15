from gfsad import celery
from flask import current_app
import StringIO
import requests
from gfsad.utils.tiles import degree_to_tile_number
from PIL import Image
import boto
from boto.s3.key import Key
from bs4 import BeautifulSoup
from pyproj import Proj, transform as _transform
from gfsad.models import Tile, db
import datetime


def _build_dg_url(x, y, zoom, connect_id, request="GetTile",
                  layer="DigitalGlobe:ImageryTileService",
                  profile="Consumer_Profile"):
    """
    Function builds a url for use with Digital Globe Enhanced View
    :param x: tile col
    :param y: tile row
    :param zoom: zoom level
    :param connect_id: key
    :param request: wmts request type
    :param layer:
    :param profile: https://www.digitalglobe.com/sites/default/files/dgcs/DGCS_DeveloperGuide_WMTS.pdf
    :return: url
    """

    url = "https://rdog.digitalglobe.com/earthservice/wmtsaccess?connectid=%s" % connect_id
    url += "&request=%s" % request
    url += "&version=1.0.0&LAYER=%s&FORMAT=image/jpeg" % layer
    url += "&TileRow=%d&TileCol=%d&TileMatrixSet=EPSG:3857&TileMatrix=EPSG:3857:%d" % (y, x, zoom)
    url += "&featureProfile=%s" % profile
    return url


@celery.task(rate_limit="300/m")
def get_image(lat, lon, zoom, layer="DigitalGlobe:ImageryTileService"):
    """ Gets a tile and saves it to s3 while also saving the important acquisition date to the db.
    :param lat:
    :param lon:
    :param zoom:
    :param layer:
    :return:
    """
    # convert lat lon to tile
    x, y = degree_to_tile_number(lat, lon, zoom)
    print x, y
    # build url
    url = _build_dg_url(x, y, zoom, current_app.config['DG_EV_CONNECT_ID'], layer=layer, profile="Accuracy_Profile")

    # get tile
    auth = current_app.config['DG_EV_USERNAME'], current_app.config['DG_EV_PASSWORD']
    response = requests.get(url, auth=auth)

    if response.status_code != 200:
        raise Exception

    # get image
    f = StringIO.StringIO(response.content)
    img = Image.open(f)

    # get exif data
    exif = img._getexif()
    soup = BeautifulSoup(exif[37510])

    corner_ne = soup.find_all("gml:uppercorner")[0].string.split()
    corner_ne_lon, corner_ne_lat = transform(corner_ne[0], corner_ne[1])
    corner_sw = soup.find_all("gml:lowercorner")[0].string.split()
    corner_sw_lon, corner_sw_lat = transform(corner_sw[0], corner_sw[1])

    image_data = {
        'feature_id': soup.find("digitalglobe:featureid").string,
        'date_acquired': datetime.datetime.strptime(soup.find("digitalglobe:acquisitiondate").string, "%Y-%m-%d %H:%M:%S"),
        'date_acquired_earliest': datetime.datetime.strptime(soup.find("digitalglobe:earliestacquisitiondate").string, "%Y-%m-%d %H:%M:%S"),
        'date_acquired_latest': datetime.datetime.strptime(soup.find("digitalglobe:latestacquisitiondate").string, "%Y-%m-%d %H:%M:%S"),
        'product_type': soup.find("digitalglobe:producttype").string,
        'copyright': soup.find("digitalglobe:copyright").string,
        'corner_ne_lat': corner_ne_lat,
        'corner_ne_lon': corner_ne_lon,
        'corner_sw_lat': corner_sw_lat,
        'corner_sw_lon': corner_sw_lon,
        'center_lat': (corner_ne_lat + corner_sw_lat)/2,
        'center_lon': (corner_ne_lon + corner_sw_lon)/2,
        'url': "tiles/dg_ev/%d/%d/%d" % (zoom, x, y) + '.JPG'
    }

    # img.show()

    # save image to s3
    s3 = boto.connect_s3(current_app.config['AWS_ACCESS_KEY_ID'],
                         current_app.config['AWS_SECRET_ACCESS_KEY'])

    # Get bucket
    bucket = s3.get_bucket('gfsad30')

    cache_control = 'max-age=2000000'
    content_type = 'image/jpeg'

    s3_file = Key(bucket)
    s3_file.key = image_data['url']
    s3_file.set_metadata('cache-control', cache_control)
    s3_file.set_metadata('content-type', content_type)
    s3_file.set_contents_from_string(f.getvalue())
    s3_file.make_public()

    # save information to database
    tile = Tile(**image_data)
    db.session.add(tile)
    db.session.commit()


def transform(x, y, source_projection='epsg:3857', target_projection='epsg:4326'):
    """
    Helper function for projection transform.
    :type x: unicode
    :type y: unicode
    :type source_projection: str
    :type target_projection: str
    :return:
    """
    return _transform(Proj(init=source_projection), Proj(init=target_projection), x, y)
