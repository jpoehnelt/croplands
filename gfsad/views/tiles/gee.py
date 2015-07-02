from flask import current_app
from gfsad.exceptions import TileNotFound
import ee
from gfsad import cache

BASE_URL = 'https://earthengine.googleapis.com/'

assets = {
    'ndvi_landsat_7': {
        'id': 'LANDSAT/LE7_L1T_ANNUAL_NDVI',
        'options': {
            'palette': 'FFFFFF,CE7E45,DF923D,F1B555,FCD163,99B718,74A901,66A000,529400,3E8601,207401,056201,004C00,023B01,012E01,011D01,011301',
            'min': 0,
            'max': 1,
        }
    },
    'ndvi_landsat_7_2014': {
        'id': 'LANDSAT/LE7_L1T_ANNUAL_NDVI/2014',
        'type': 'image',
        'options': {
            'palette': 'FFFFFF,CE7E45,DF923D,F1B555,FCD163,99B718,74A901,66A000,529400,3E8601,207401,056201,004C00,023B01,012E01,011D01,011301',
            'min': 0,
            'max': 1,
        }
    },
    'ndvi_modis': '',
    'australia_acca': '',
    'africa_acca': ''
}


def build_cache_key(**kwargs):
    """
    Builds a unique key for the map to go into the cache.
    :param kwargs:
    :return:
    """
    # todo may return different order
    return "map_" + ".".join([str(v) for k, v in kwargs.items()])


def get_map(**kwargs):
    """
    Gets map from cache if it exists or calls method to build it.
    :param kwargs:
    :return:
    """
    key = build_cache_key(**kwargs)
    map_id = cache.get(key)
    if map_id is None:
        map_id = build_map(**kwargs)
        cache.set(key, map_id, timeout=60 * 60 * 12)
    return map_id


def build_map(**kwargs):
    """
    Creates a map in Google Earth Engine using the python api and returns the map id and token.
    :param kwargs:
    :return:
    """
    if kwargs['asset'] not in assets:
        raise TileNotFound('Map does not exist.')

    asset = assets[kwargs['asset']]
    ee.Initialize(ee.ServiceAccountCredentials(current_app.config['GOOGLE_SERVICE_ACCOUNT'],
                                               key_data=current_app.config['GOOGLE_API_KEY']))

    if asset['type'] != 'image':
        collection = ee.ImageCollection(asset['id'])

        collection.filterDate('2015-01-01', '2015-12-31')

        image = collection.median()
    else:
        image = ee.Image('LANDSAT/LE7_L1T_ANNUAL_NDVI/2014')

    mapid = image.getMapId(asset['options'])

    del mapid['image']
    return mapid


def build_url(map_id, token, x, y, z):
    """
    Generates the url for the tile. Builtin function is buggy.
    :param map_id:
    :param token:
    :param x:
    :param y:
    :param z:
    :return:
    """
    return '%s/map/%s/%d/%d/%d?token=%s' % (BASE_URL, map_id, z, x, y, token)