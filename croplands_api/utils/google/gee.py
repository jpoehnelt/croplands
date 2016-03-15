from flask import current_app
from croplands_api.exceptions import TileNotFound
import ee
from croplands_api import cache

BASE_URL = 'https://earthengine.googleapis.com/'

ASSETS = {
    'ndvi_landsat_7': {
        'id': 'LANDSAT/LE7_L1T_ANNUAL_NDVI',
        'type': 'collection',
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
    }
}


def extract(geometry, collection=None, scale=231.65):
    """
    Returns the image values for the specified geo
    :param geometry: ee.Geometry object
    :param collection: image stack
    :param scale: appropriate scale for image
    :return: list of dicts for each image
    """
    point = geometry.centroid()

    if collection is None:
        collection = ee.ImageCollection('MODIS/MOD13Q1')

    collection = collection.sort('system:time_start', True)

    data = collection.getRegion(point, scale).getInfo()

    return [dict((data[0][i], val) for i, val in enumerate(row))
            for row in data[1:]]


def add_ndvi_band(image):
    ndvi = image.normalizedDifference(['B5', 'B4'])
    image = image.addBands(ndvi, ['NDVI'])
    return image


def add_tassel_cap_band(image):
    # Coefficients from Derivation of a tasselled cap
    # transformation based on Landsat 8 atsatellite reflectance
    # Muhammad Hasan Ali Baigab, Lifu Zhanga , Tong Shuaiab & Qingxi Tonga

    brightness = image.select(['B2'], ['brightness']).multiply(0.3029).add(
        image.select('B3').multiply(.2786)).add(image.select('B4').multiply(.4733)).add(
        image.select('B5').multiply(.5599)).add(image.select('B6').multiply(.508)).add(
        image.select('B7').multiply(.1872)).toFloat()

    greenness = image.select(['B2'], ['greenness']).multiply(-0.2941).add(
        image.select('B3').multiply(-0.243)).add(image.select('B4').multiply(-0.5424)).add(
        image.select('B5').multiply(.7276)).add(image.select('B6').multiply(.0713)).add(
        image.select('B7').multiply(-0.1608)).toFloat()

    wetness = image.select(['B2'], ['wetness']).multiply(0.1511).add(
        image.select('B3').multiply(0.1973)).add(image.select('B4').multiply(0.3283)).add(
        image.select('B5').multiply(0.3407)).add(image.select('B6').multiply(-0.7117)).add(
        image.select('B7').multiply(-0.4559)).toFloat()

    image = image.addBands(brightness)
    image = image.addBands(greenness)
    image = image.addBands(wetness)

    return image


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
    :return: mapid object
    """
    if kwargs['asset'] not in ASSETS:
        # lookup gee asset id
        raise TileNotFound('Map does not exist.')

    asset = ASSETS[kwargs['asset']]

    if asset['type'] != 'image':
        collection = ee.ImageCollection(asset['id'])
        if 'year' in kwargs:
            # todo allow for better date handling
            collection = collection.filterDate('%s-01-01' % kwargs['year'],
                                               '%s-12-31' % kwargs['year'])
        image = collection.median()
    else:
        image = ee.Image(asset['id'])

    if 'mask' in asset and len(asset['mask']) > 0:
        mask = ee.Image(1)
        for value in asset['mask']:
            mask = mask.And(image.neq(value))

        image = image.mask(mask)

    mapid = image.getMapId(asset['options'])

    del mapid['image']
    return mapid


def build_url(map_id, token, x, y, z):
    """
    Generates the url for the tile. Builtin function is buggy.
    :param map_id: String
    :param token: String
    :param x: int
    :param y: int
    :param z: int
    :return: String
    """
    return '%s/map/%s/%d/%d/%d?token=%s' % (BASE_URL, map_id, z, x, y, token)