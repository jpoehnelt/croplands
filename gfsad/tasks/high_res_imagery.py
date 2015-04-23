from gfsad import celery
from flask import current_app
import StringIO
import requests
from gfsad.utils.tiles import degree_to_tile_number
from PIL import Image as Img, ImageDraw, ImageFont
import boto
from boto.s3.key import Key
from bs4 import BeautifulSoup
from pyproj import Proj, transform as _transform
from gfsad.models import Image, db, Location
import datetime
from gfsad.utils.geo import distance, decode_google_polyline, \
    calculate_plane_perpendicular_to_travel, get_destination
import uuid
import gzip
import json
import random


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
    print url
    return url


@celery.task(rate_limit="1000/m")
def get_image(lat, lon, zoom, location_id=None, layer="DigitalGlobe:ImageryTileService"):
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
                        profile="Consumer_Profile")

    # get tile
    auth = current_app.config['DG_EV_USERNAME'], current_app.config['DG_EV_PASSWORD']
    response = requests.get(url, auth=auth)
    assert (response.status_code == 200)

    if int(response.headers['content-length']) < 1000:
        print "Blank Tile... Exiting."
        return

    # get image
    f = StringIO.StringIO(response.content)
    img = Img.open(f)

    # get exif data
    try:
        exif = img._getexif()
        soup = BeautifulSoup(exif[37510])
    except:
        return

    sample_size = float(soup.find_all("digitalglobe:groundsampledistance")[0].string)
    if sample_size > 1.0:
        print "Too low of resolution... exiting."
        return

    corner_ne = soup.find_all("gml:uppercorner")[0].string.split()
    corner_ne_lon, corner_ne_lat = transform(corner_ne[0], corner_ne[1])
    corner_sw = soup.find_all("gml:lowercorner")[0].string.split()
    corner_sw_lon, corner_sw_lat = transform(corner_sw[0], corner_sw[1])

    if location_id is None:
        # create location if it does not exist
        location = Location(lat=lat, lon=lon, source='random-generator')
        db.session.add(location)
        db.session.commit()
        location_id = location.id

    image_data = {
        'location_id': location_id,
        'date_acquired': datetime.datetime.strptime(
            soup.find("digitalglobe:acquisitiondate").string, "%Y-%m-%d %H:%M:%S"),
        'date_acquired_earliest': datetime.datetime.strptime(
            soup.find("digitalglobe:earliestacquisitiondate").string, "%Y-%m-%d %H:%M:%S"),
        'date_acquired_latest': datetime.datetime.strptime(
            soup.find("digitalglobe:latestacquisitiondate").string, "%Y-%m-%d %H:%M:%S"),
        'image_type': soup.find("digitalglobe:producttype").string,
        'copyright': soup.find("digitalglobe:copyright").string,
        'corner_ne_lat': corner_ne_lat,
        'corner_ne_lon': corner_ne_lon,
        'corner_sw_lat': corner_sw_lat,
        'corner_sw_lon': corner_sw_lon,
        'lat': (corner_ne_lat + corner_sw_lat) / 2,
        'lon': (corner_ne_lon + corner_sw_lon) / 2,
        'url': "images/digital_globe/consumer_profile/%s" % uuid.uuid4() + '.JPG'
    }
    # check if location is on edge of tile and reject if it is...
    # at 18 zoom tiles are 126*126 meters
    if distance(image_data['lat'], image_data['lon'], lat, lon) > 50:
        print "On edge of tile... exiting."
        return

    # draw box at center of lat/lon with 30 meter sides
    ratio = 256.0 / 126.0

    pixel_x = abs(image_data['corner_sw_lon'] - lon) / (
        image_data['corner_ne_lon'] - image_data['corner_sw_lon']) * 256
    pixel_y = abs(image_data['corner_ne_lat'] - lat) / (
        image_data['corner_ne_lat'] - image_data['corner_sw_lat']) * 256
    draw = ImageDraw.Draw(img)
    draw.polygon([(pixel_x - 15 * ratio, pixel_y - 15 * ratio),
                  (pixel_x + 15 * ratio, pixel_y - 15 * ratio),
                  (pixel_x + 15 * ratio, pixel_y + 15 * ratio),
                  (pixel_x - 15 * ratio, pixel_y + 15 * ratio)], fill=None, outline=128)

    fnt = ImageFont.load_default()

    draw.text((3, 0),
              image_data['image_type'] + ' - ' + image_data['date_acquired'].strftime("%Y-%m-%d"),
              font=fnt,
              fill=(255, 255, 255, 128))

    draw.text((3, 242), str(image_data['copyright']), font=fnt, fill=(255, 255, 255, 128))
    draw.text((3, 232), 'Croplands.org', font=fnt, fill=(255, 255, 255, 128))

    # img.show()
    out = StringIO.StringIO()
    img.save(out, format='JPEG')
    # img.show()
    # save image to s3
    s3 = boto.connect_s3(current_app.config['AWS_ACCESS_KEY_ID'],
                         current_app.config['AWS_SECRET_ACCESS_KEY'])

    # Get bucket
    bucket = s3.get_bucket(current_app.config['AWS_S3_BUCKET'])

    cache_control = 'max-age=2000000'
    content_type = 'image/jpeg'

    s3_file = Key(bucket)
    s3_file.key = image_data['url']
    s3_file.set_metadata('cache-control', cache_control)
    s3_file.set_metadata('content-type', content_type)
    s3_file.set_contents_from_string(out.getvalue())
    s3_file.make_public()

    # save information to database
    image = Image(**image_data)
    db.session.add(image)
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
#     response = requests.get(url)
#     snapped_points = json.loads(response.data)['snappedPoints']
#
#     for pt in snapped_points:
#         get_google_street_view_image.delay(lat=pt['location']['latitude'],
#                                            lon=pt['location']['longitude'])

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

            offset = get_destination(polyline[i], bearing, 0.05)  # km
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
def get_street_view_coverage(x,y,z=21):
    url = "http://mt1.googleapis.com/vt?hl=en-US&lyrs=svv|cb_client:apiv3&style=40,18&gl=US&x=%d&y=%d&z=%d" % (x, y, z)
    response = requests.get(url)
    f = StringIO.StringIO(response.content)
    img = Img.open(f)

    # save image to s3
    s3 = boto.connect_s3(current_app.config['AWS_ACCESS_KEY_ID'],
                         current_app.config['AWS_SECRET_ACCESS_KEY'])

    # Get bucket
    bucket = s3.get_bucket(current_app.config['AWS_S3_BUCKET'])

    cache_control = 'max-age=200'
    content_type = 'image/png'

    s3_file = Key(bucket)
    s3_file.key = 'temp/google_street_view_tiles/%d/%d/%d.PNG' % (z, x, y)
    s3_file.set_metadata('cache-control', cache_control)
    s3_file.set_metadata('content-type', content_type)
    s3_file.set_contents_from_string(f.getvalue())
    s3_file.make_public()