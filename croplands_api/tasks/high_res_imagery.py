from croplands_api import celery
from flask import current_app
import StringIO
import requests
from PIL import Image as Img
import boto
from boto.s3.key import Key
from bs4 import BeautifulSoup
from pyproj import Proj, transform as _transform
from croplands_api.models import Image, db, Location
import datetime
from croplands_api.utils.geo import (
    distance,
    decode_google_polyline,
    calculate_plane_perpendicular_to_travel,
    get_destination,
    degree_to_tile_number
)
import uuid
from flask import json
import random

from multiprocessing.pool import ThreadPool


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

    url = "https://evwhs.digitalglobe.com/earthservice/wmtsaccess?connectid=%s" % connect_id
    url += "&request=%s" % request
    url += "&version=1.0.0&LAYER=%s&FORMAT=image/jpeg" % layer
    url += "&TileRow=%d&TileCol=%d&TileMatrixSet=EPSG:3857&TileMatrix=EPSG:3857:%d" % (y, x, zoom)
    url += "&featureProfile=%s" % profile
    return url


def get_image_data(img):
    try:
        exif = img._getexif()
        soup = BeautifulSoup(exif[37510])
    except Exception as e:
        print(e)
        return
    else:
        corner_ne = soup.find_all("gml:uppercorner")[0].string.split()
        corner_ne_lon, corner_ne_lat = transform(corner_ne[0], corner_ne[1])
        corner_sw = soup.find_all("gml:lowercorner")[0].string.split()
        corner_sw_lon, corner_sw_lat = transform(corner_sw[0], corner_sw[1])

        format_string = "%a %b %d %H:%M:%S %Y"

        return {
            'date_acquired': datetime.datetime.strptime(
                soup.find("digitalglobe:acquisitiondate").string.replace("UTC",""), format_string),
            'date_acquired_earliest': datetime.datetime.strptime(
                soup.find("digitalglobe:earliestacquisitiondate").string.replace("UTC",""), format_string),
            'date_acquired_latest': datetime.datetime.strptime(
                soup.find("digitalglobe:latestacquisitiondate").string.replace("UTC",""), format_string),
            'image_type': 'digitalglobe' + soup.find("digitalglobe:producttype").string,
            'copyright': soup.find("digitalglobe:copyright").string,
            # 'source': soup.find("digitalglobe:source").string,
            # 'source_unit': soup.find("digitalglobe:sourceunit").string,
            # 'data_layer': soup.find("digitalglobe:datalayer").string,
            'resolution': float(soup.find_all("digitalglobe:groundsampledistance")[0].string),
            # 'ce90accuracy': soup.find("digitalglobe:ce90accuracy").string,
            # 'rmseaccuracy': soup.find("digitalglobe:rmseaccuracy").string,
            'corner_ne_lat': corner_ne_lat,
            'corner_ne_lon': corner_ne_lon,
            'corner_sw_lat': corner_sw_lat,
            'corner_sw_lon': corner_sw_lon,
            'lat': (corner_ne_lat + corner_sw_lat) / 2,
            'lon': (corner_ne_lon + corner_sw_lon) / 2
        }


def download_image(x, y, zoom, profile):
    url = _build_dg_url(x, y, zoom, profile)


@celery.task(rate_limit="20/m")
def get_image(lat, lon, zoom, location_id=None, layer="DigitalGlobe:ImageryTileService",
              profile="MyDG_Color_Consumer_Profile", training_only=False):
    """ Gets a tile and saves it to s3 while also saving the important acquisition date to the db.
    :param lat:
    :param lon:
    :param zoom:
    :param location_id:
    :param layer:
    :return:
    """
    # convert lat lon to tile
    x, y = degree_to_tile_number(lat, lon, zoom)

    # build url
    url = _build_dg_url(x, y, zoom, current_app.config['DG_EV_CONNECT_ID'],
                        profile=profile)

    # get tile
    auth = current_app.config['DG_EV_USERNAME'], current_app.config['DG_EV_PASSWORD']
    id = current_app.config['DG_EV_CONNECT_ID']

    m, n = 5,5
    mosaic = Img.new('RGB', (256 * m, 256 * n))

    tile_matrix = [[None for i in range(m)] for j in range(n)]

    def download(args):
        i, j = args
        img_url = _build_dg_url(x + i - m/2, y + j - n/2, zoom, id, profile=profile)
        r = requests.get(img_url, auth=auth)

        if r.status_code != 200 or int(r.headers['content-length']) < 1000:
            return False

        f = StringIO.StringIO(r.content)
        tile = Img.open(f)

        mosaic.paste(tile, (i * 256, j * 256))
        tile_matrix[i][j] = {'tile': tile, 'data': get_image_data(tile)}
        return True

    pool = ThreadPool(m * n)
    results = pool.map(download,
                       [(i, j) for i, row in enumerate(tile_matrix) for j, col in enumerate(row)])
    pool.close()
    pool.join()

    if sum(results) < m * n:
        print('some tiles failed to download')
        return

    data = tile_matrix[int(len(tile_matrix) / 2)][int(len(tile_matrix[0]) / 2)]['data']
    # adjust image data for all other tiles in mosaic
    data['resolution'] = max(
        [max([col['data']['resolution'] for col in row]) for row in tile_matrix])
    data['date_acquired_earliest'] = min(
        [min([col['data']['date_acquired_earliest'] for col in row]) for row in tile_matrix])
    data['date_acquired_latest'] = min(
        [min([col['data']['date_acquired_latest'] for col in row]) for row in tile_matrix])

    data['corner_ne_lat'] = tile_matrix[-1][0]['data']['corner_ne_lat']
    data['corner_ne_lon'] = tile_matrix[-1][0]['data']['corner_ne_lon']
    data['corner_sw_lat'] = tile_matrix[0][-1]['data']['corner_sw_lat']
    data['corner_sw_lon'] = tile_matrix[0][-1]['data']['corner_sw_lon']
    data['url'] = "images/digital_globe/%s/%s" % (profile, str(uuid.uuid4()) + '.JPG')
    data['source'] = "VHRI"

    # quality checks
    if (data['date_acquired_latest'] - data['date_acquired_earliest']).days > 200:
        print('inconsistent acquisition date: %d days' % (
            data['date_acquired_latest'] - data['date_acquired_earliest']).days)
        return

    if data['resolution'] > 1:
        print('poor resolution: %f' % data['resolution'])
        return

    # n = 100
    # size = mosaic.size
    # white_thresh = 200
    # num_white = 0
    # for i in range(n):
    #     pixel = mosaic.getpixel((random.randrange(0,size[0]),random.randrange(0,size[1])))
    #     if sum((int(color > white_thresh) for color in pixel[:3])) >= 2:
    #         num_white += 1
    #
    # print num_white/float(n)

    data.pop('resolution', None)

    if location_id is None:
        if training_only:
            location = Location(lat=data['lat'], lon=data['lon'], source='random', use_validation=True)
        else:
            location = Location(lat=data['lat'], lon=data['lon'], source='random')
        db.session.add(location)
        db.session.flush()
        location_id = location.id

    data['location_id'] = location_id

    # mosaic.show()

    out = StringIO.StringIO()
    mosaic.save(out, format='JPEG', optimize=True, quality=30)

    image = Image(**data)
    db.session.add(image)

    # save image to s3
    gs = boto.connect_gs(current_app.config['GS_ACCESS_KEY'],
                         current_app.config['GS_SECRET'])

    # Get bucket
    bucket = gs.get_bucket(current_app.config['BUCKET'])

    cache_control = 'max-age=2000000'
    content_type = 'image/jpeg'

    s3_file = Key(bucket)
    s3_file.key = data['url']
    s3_file.set_metadata('cache-control', cache_control)
    s3_file.set_metadata('content-type', content_type)
    s3_file.set_contents_from_string(out.getvalue())
    s3_file.make_public()

    # save information to database
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


@celery.task(rate_limit="1/s")
def get_google_street_view_image(lat, lon, location=None):
    url = 'https://maps.googleapis.com/maps/api/streetview'
    url += '?size=400x400&location=%f,%f&fov=%s&heading=%d&pitch=%d'

    # get street view image
    response = requests.get(url % (lat, lon, 90, 90, 1))


# @celery.task(rate_limit="1/s")
# def get_snapped_points(start_lat, start_lon, end_lat, end_lon):
# api_key = current_app.config['GOOGLE_STREET_VIEW_API_KEY']
# url = 'https://roads.googleapis.com/v1/snapToRoads'
# url += '?path=%f,%f|%f,%f&key=%s&interpolate=true' % (
# start_lat, start_lon, end_lat, end_lon, api_key)
#
# response = requests.get(url)
# snapped_points = json.loads(response.data)['snappedPoints']
#
# for pt in snapped_points:
# get_google_street_view_image.delay(lat=pt['location']['latitude'],
# lon=pt['location']['longitude'])

@celery.task(rate_limit="1/s")
def get_directions(origin_lat, origin_lon, destination_lat, destination_lon):
    api_key = current_app.config['GOOGLE_STREET_VIEW_API_KEY']
    url = "https://maps.googleapis.com/maps/api/directions/json"
    url += "?origin=%f,%f&destination=%f,%f&avoid=highways&key=%s" % (
        origin_lat, origin_lon, destination_lat, destination_lon, api_key)

    response = requests.get(url)
    route = json.loads(response.text)['routes'][0]

    # build polyline for driving segments
    polyline = []
    for leg in route['legs']:
        for step in leg['steps']:
            if step['travel_mode'] == 'DRIVING':
                polyline.extend(decode_google_polyline(step['polyline']['points']))

    geo_json = {
        "type": "GeometryCollection",
        "geometries": [
            {"type": "LineString",
             "coordinates": [[pt[1], pt[0]] for pt in polyline]
            },
            {
                "type": "MultiPoint",
                "coordinates": []
            }]
    }
    previous = polyline[0]
    for i in range(1, len(polyline) - 1):
        if distance(previous[0], previous[1], polyline[i][0], polyline[i][1]) > 2000:
            bearing = calculate_plane_perpendicular_to_travel(polyline[i - 1], polyline[i],
                                                              polyline[i + 1])
            if random.choice([True, False]):
                bearing += 180

            offset = get_destination(polyline[i][0], polyline[i][1], bearing, 0.05)  # km
            geo_json['geometries'][1]['coordinates'].append([offset[1], offset[0]])
            previous = polyline[i]
            has_street_view_image(polyline[i][0], polyline[i][1], bearing)

    print json.dumps(geo_json)


@celery.task(rate_limit="1/s")
def has_street_view_image(lat, lon, heading):
    url = "https://maps.googleapis.com/maps/api/streetview"
    url += "?size=400x400&location=%f,%f&fov=90&heading=%f&pitch=10" % (lat, lon, heading)

    response = requests.get(url)
    if int(response.headers['content-length']) < 8000:
        return

    # get image
    f = StringIO.StringIO(response.content)

    img = Img.open(f)
    img.show()


@celery.task
def get_street_view_coverage(x, y, z=21):
    url = "http://mt1.googleapis.com/vt?hl=en-US&lyrs=svv|cb_client:apiv3&style=40,18&gl=US&x=%d&y=%d&z=%d" % (
        x, y, z)
    response = requests.get(url)
    f = StringIO.StringIO(response.content)
    img = Img.open(f)

    # save image to s3
    gs = boto.connect_gs(current_app.config['GS_ACCESS_KEY'],
                         current_app.config['GS_SECRET'])

    # Get bucket
    bucket = gs.get_bucket(current_app.config['BUCKET'])

    cache_control = 'max-age=200'
    content_type = 'image/png'

    s3_file = Key(bucket)
    s3_file.key = 'temp/google_street_view_tiles/%d/%d/%d.PNG' % (z, x, y)
    s3_file.set_metadata('cache-control', cache_control)
    s3_file.set_metadata('content-type', content_type)
    s3_file.set_contents_from_string(f.getvalue())
    s3_file.make_public()