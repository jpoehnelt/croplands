import datetime
import time
import ee
from flask import current_app, Blueprint, jsonify, request
from gfsad import limiter, create_app


gee = Blueprint('gee', __name__, url_prefix='/gee')

# initialize earth engine with service account credentials
def init_gee():
    ee.Initialize(ee.ServiceAccountCredentials(current_app.config['GOOGLE_SERVICE_ACCOUNT'],
                                               key_data=current_app.config['GOOGLE_API_KEY']))
    return ee


def extract_info(collection='MODIS/MOD13Q1', lat=31.74292, lon=-110.051375, date_start='2008-01-01',
                 date_end=datetime.date.today().isoformat()):
    collection = ee.ImageCollection(collection)
    filter = collection.filterDate(date_start, date_end)
    data = filter.select(['NDVI'])
    points = ee.Geometry.Point(lon, lat)
    results = data.getRegion(points, 231.65).getInfo()

    results_cleaned = []
    for line in results[1:]:
        results_cleaned.append(
            {'date': datetime.datetime.utcfromtimestamp(line[3] / 1000).isoformat().split('T', 1)[
                0], 'ndvi': line[4]})

    return results_cleaned


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


def get_segments_more_bands(lat=41.01, lon=-96, bufferSize=2000, blurRadius=30):
    pt = ee.Geometry.Point(lon, lat)
    clip = pt.buffer(bufferSize).bounds()

    collection = ee.ImageCollection('LANDSAT/LC8_L1T_TOA')
    collection = collection.filterBounds(clip.buffer(blurRadius))

    collection = collection.map(add_ndvi_band)
    collection = collection.map(add_tassel_cap_band)

    image = collection.select(['nd'], ['ndvi_median']).median()
    image = image.addBands(collection.select(['nd'], ['ndvi_max']).max()).addBands(
        collection.select(['nd'], ['ndvi_min']).min()).addBands(
        collection.select(['nd'], ['ndvi_mean']).mean()).addBands(
        collection.select(['nd'], ['ndvi_sum']).sum()).addBands(
        collection.select(['brightness'], ['brightness_min']).min()).addBands(
        collection.select(['brightness'], ['brightness_median']).median()).addBands(
        collection.select(['brightness'], ['brightness_mean']).mean()).addBands(
        collection.select(['brightness'], ['brightness_sum']).sum()).addBands(
        collection.select(['greenness'], ['greenness_min']).min()).addBands(
        collection.select(['greenness'], ['greenness_median']).median()).addBands(
        collection.select(['greenness'], ['greenness_mean']).mean()).addBands(
        collection.select(['greenness'], ['greenness_sum']).sum()).addBands(
        collection.select(['wetness'], ['wetness_min']).min()).addBands(
        collection.select(['wetness'], ['wetness_median']).median()).addBands(
        collection.select(['wetness'], ['wetness_mean']).mean()).addBands(
        collection.select(['wetness'], ['wetness_sum']).sum()).addBands(
        collection.select(['B8'], ['panchromatic_mean']).mean()).clip(clip)

    # blur image a bit
    imageBlur = image.convolve(ee.Kernel.gaussian(blurRadius)).clip(clip.buffer(-blurRadius))

    maxObjectSize = 500

    imageClustered = ee.apply("Test.Clustering.KMeans", {
        "image": image.select(
            ['ndvi_mean', 'panchromatic_mean', 'brightness_mean', 'greenness_mean',
             'wetness_mean']),
    })

    # Performs clustering on the input image in a consistent way
    #  across tiles. The algorithm works as follows: first, renumber
    #  the current tile clusters based on an offset then, for each
    #  cluster that touches the left or the top edge, look at the
    #  adjacent tile and find that tile's cluster label. Assign this
    #  label, added to that tile's offset, to the current cluster and
    #  continue. Ambiguities can be resolved either by number of pixels
    #  touching the current pixel, or by closest mean. Corner cases can
    #  be resolved by looking at the northwest tile. Note that not all
    #  cases can be resolved.
    #
    #  Input should be an image where one of the bands is named
    #  'clusters' and represents the cluster labels. The remaining
    #  bands are spectral data.
    #
    #  The output is an INT32 image in which each value is the
    #  cluster to which he pixel belongs.
    #
    #  Arguments:
    #    image (Image): The input image for clustering.
    #   maxObjectSize (Integer, optional): Maximum object size.
    #   useCentroid (Boolean, optional): Use centroid to search for corresponding cluster.
    #   cornerCases (Boolean, optional): Treat corner cases.

    imageConsistent = ee.apply("Test.Clustering.SpatialConsistency", {
        "image": imageClustered,
        "maxObjectSize": maxObjectSize,
        "useCentroid": False,
        "cornerCases": True
    })

    clusters = imageConsistent.select(["clusters"]).reduceToVectors(scale=30)
    print len(clusters.getInfo()['features'])

    print clusters.getDownloadUrl(filetype='json')
    for f in clusters.getInfo()['features']:
        time.sleep(0.15)
        polygon = ee.Geometry.Polygon(f['geometry']['coordinates'])
        if polygon.contains(pt).getInfo():
            print polygon.toGeoJSONString()
            print pt.toGeoJSONString()
            break


@gee.route('/time_series')
@limiter.limit("1 per second")
def time_series():
    # Pass Field Data Mapping
    ee_auth = init_gee()

    lat = request.args.get('lat', 31.74292, type=float)
    lon = request.args.get('lon', -110.051375, type=float)
    date_start = request.args.get('date_start', '2013-01-01', type=str)
    date_end = request.args.get('date_end', datetime.date.today().isoformat(), type=str)
    try:
        results = {'results': extract_info(ee_auth, lat=lat, lon=lon, date_start=date_start,
                                           date_end=date_end),
                   'lat': lat, 'lon': lon}
    except Exception as e:
        return jsonify({'status': 'error', 'message': e.message})
    return jsonify(results)

    #
    # @gee.route('/tiles/<tile>/<int:year>/<int:month>')
    # def tiles(tile, year=2014, month=1):
    # mapid = None
    # retry_count = 0
    # max_retries = 3
    # n = 1
    # auth = False
    #
    # while retry_count < max_retries:
    #         try:
    #             ee.Initialize(ee.ServiceAccountCredentials(GOOGLE_SERVICE_ACCOUNT,
    #                                                        key_data=GOOGLE_API_KEY))
    #             auth = True
    #             break
    #         except:
    #             logging.info('RETRY AUTHENTICATION')
    #             retry_count += 1
    #             time.sleep(math.pow(2, n - 1))
    #             n += 1
    #             if auth:
    #                 break
    #
    #     if not auth or (retry_count == max_retries):
    #         return
    #
    #     retry_count = 0
    #     max_retries = 5
    #     n = 1
    #
    #     while retry_count < max_retries:
    #         try:
    #             if tile == 'landsat_composites':
    #                 palette = "FFFFFF,CE7E45,DF923D,F1B555,FCD163,99B718,74A901,66A000,529400,3E8601,207401,056201,004C00,023B01,012E01,011D01,011301"
    #                 # landsat (L7) composites
    #                 # accepts a year, side effect map display of annual L7 cloud free composite
    #                 landSat = ee.ImageCollection("LANDSAT/LE7_L1T_ANNUAL_NDVI").filterDate(
    #                     '2012-01-01',
    #                     '2012-12-31').select("NDVI")
    #                 mapid = landSat.getMapId({'min': 0, 'max': 1, 'palette': palette})
    #
    #             if tile == 'l7_toa_1year_2012':
    #                 mapid = ee.Image("L7_TOA_1YEAR_2012").getMapId(
    #                     {'opacity': 1,
    #                      'bands': '30,20,10',
    #                      'min': 10,
    #                      'max': 120,
    #                      'gamma': 1.6})
    #
    #             if tile == 'simple_green_coverage':
    #                 # The Green Forest Coverage background created by Andrew Hill
    #                 # example here: http://ee-api.appspot.com/#331746de9233cf1ee6a4afd043b1dd8f
    #                 treeHeight = ee.Image("Simard_Pinto_3DGlobalVeg_JGR")
    #                 elev = ee.Image('srtm90_v4')
    #                 mask2 = elev.gt(0).add(treeHeight.mask())
    #                 water = ee.Image("MOD44W/MOD44W_005_2000_02_24").select(["water_mask"]).eq(0)
    #                 mapid = treeHeight.mask(mask2).mask(water).getMapId(
    #                     {'opacity': 1, 'min': 0, 'max': 50, 'palette': "dddddd,1b9567,333333"})
    #
    #             if tile == 'simple_bw_coverage':
    #                 # The Green Forest Coverage background created by Andrew Hill
    #                 # example here: http://ee-api.appspot.com/#331746de9233cf1ee6a4afd043b1dd8f
    #                 treeHeight = ee.Image("Simard_Pinto_3DGlobalVeg_JGR")
    #                 elev = ee.Image('srtm90_v4')
    #                 mask2 = elev.gt(0).add(treeHeight.mask())
    #                 mapid = treeHeight.mask(mask2).getMapId(
    #                     {'opacity': 1, 'min': 0, 'max': 50, 'palette': "ffffff,777777,000000"})
    #
    #             if tile == 'masked_forest_carbon':
    #                 forestCarbon = ee.Image("GME/images/06900458292272798243-10017894834323798527")
    #                 mapid = forestCarbon.mask(forestCarbon).getMapId(
    #                     {'opacity': 0.5, 'min': 1, 'max': 200,
    #                      'palette': "FFFFD4,FED98E,FE9929,dd8653"})
    #
    #             break
    #         except Exception as e:
    #             print e
    #             logging.info('RETRY GET MAP ID %s' % tile)
    #             retry_count += 1
    #             time.sleep(math.pow(2, n - 1))
    #             n += 1
    #
    #     if mapid is None:
    #         raise ProcessingException(code=404)
    #     else:
    #         return jsonify({
    #             'mapid': mapid['mapid'],
    #             'token': mapid['token']
    #         })
    #

    # if __name__ == "__main__":
    #     app = create_app('Testing')
    #     with app.app_context():
    #         GOOGLE_API_KEY = app.config['GOOGLE_API_KEY']
    #         GOOGLE_SERVICE_ACCOUNT = app.config['GOOGLE_SERVICE_ACCOUNT']
    #         ee.Initialize(ee.ServiceAccountCredentials(GOOGLE_SERVICE_ACCOUNT, key_data=GOOGLE_API_KEY))
    #         geometry = ee.Geometry.Point(20, 20)
    #         feature = ee.Feature(geometry)
    #         from_features = ee.FeatureCollection([feature])
    #
    #         result = get_series(ee.ImageCollection('MODIS/MCD43A4_NDVI').map(
    #             lambda img: renameBands(img)), from_features)
    #
    #         for r in result:
    #             properties = sorted(r['properties'].items())
    #
    #             for k,v in properties:
    #                 print k,v