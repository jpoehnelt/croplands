import ee
import json
from flask import jsonify, current_app, request
from gfsad.views.gee import gee


@gee.route('/maps/africa')
def get_africa_map():
    """
    Gets the map id and token for the africa map given specific parameters.
    """
    ee.Initialize(ee.ServiceAccountCredentials(current_app.config['GOOGLE_SERVICE_ACCOUNT'],
                                               key_data=current_app.config['GOOGLE_API_KEY']))

    image = ee.Image('GME/images/10477185495164119823-04069492940774464340')

    with open('gfsad/views/gee/cluster_class_mapping.json') as f:
        mappings = json.loads(f.read())

    product = ee.Image(0)

    for i, image_code in enumerate(mappings):
        code = ee.Image(i + 1)
        mask = ee.Image(0)
        for cluster in image_code['clusters']:
            mask = mask.Or(image.eq(cluster))

        code = code.multiply(mask)
        product = product.add(code)




    if 'cluster' in request.args:
        product = product.mask(image.mod(100).eq(int(request.args['cluster'])))

    if 'ecoregion' in request.args:
        product = product.mask(image.divide(100).floor().eq(int(request.args['ecoregion'])))

    # do we want a black background???
    product = product.mask(product)

    product_map = product.getMapId({'min': 1, 'max': 9, 'palette': 'B2B2B2, 505012, FF00FF, 00FFFF, FFFF00, 007A0B, 00FF00, 0000FF, A020EF'})
    print "Map: %s" % ee.data.getTileUrl(product_map, 2, 2, 2)
    return jsonify({'mapId': product_map['mapid'], 'token': product_map['token']})

