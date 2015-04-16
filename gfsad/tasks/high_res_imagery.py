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
from gfsad.models import Image, db
import datetime
from gfsad.utils.geo import distance
import uuid

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


@celery.task(rate_limit="300/m")
def get_image(location_id, lat, lon, zoom, layer="DigitalGlobe:ImageryTileService"):
    """ Gets a tile and saves it to s3 while also saving the important acquisition date to the db.
    :param lat:
    :param lon:
    :param zoom:
    :param layer:
    :return:
    """
    # convert lat lon to tile
    x, y = degree_to_tile_number(lat, lon, zoom)

    # build url
    url = _build_dg_url(x, y, zoom, current_app.config['DG_EV_CONNECT_ID'],
                        layer="DigitalGlobe:NGAOtherProducts", profile="Consumer_Profile")

    # get tile
    auth = current_app.config['DG_EV_USERNAME'], current_app.config['DG_EV_PASSWORD']
    response = requests.get(url, auth=auth)

    assert (response.status_code == 200)

    # get image
    f = StringIO.StringIO(response.content)
    img = Img.open(f)

    # get exif data
    exif = img._getexif()
    soup = BeautifulSoup(exif[37510])

    sample_size = float(soup.find_all("digitalglobe:groundsampledistance")[0].string)
    if sample_size > 1.0:
        return

    corner_ne = soup.find_all("gml:uppercorner")[0].string.split()
    corner_ne_lon, corner_ne_lat = transform(corner_ne[0], corner_ne[1])
    corner_sw = soup.find_all("gml:lowercorner")[0].string.split()
    corner_sw_lon, corner_sw_lat = transform(corner_sw[0], corner_sw[1])

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
    fnt = ImageFont.truetype("OpenSans-Regular.ttf", 10)

    draw.text((3, 0),
              image_data['image_type'] + ' - ' + image_data['date_acquired'].strftime("%Y-%m-%d"),
              font=fnt,
              fill=(255, 255, 255, 128))

    draw.text((3, 242), image_data['copyright'] + ',  Croplands.org', font=fnt,
              fill=(255, 255, 255, 128))

    # img.show()
    out = StringIO.StringIO()
    img.save(out, format='JPEG')

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
