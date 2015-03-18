import ee
import json
from flask import jsonify, current_app, request
from gfsad.views.gee import gee
from werkzeug.exceptions import BadRequest

palette = ["1f77b4", "aec7e8", "ff7f0e", "ffbb78", "2ca02c", "98df8a", "d62728", "ff9896", "9467bd", "c5b0d5", "8c564b", "c49c94", "e377c2", "f7b6d2", "7f7f7f", "c7c7c7", "bcbd22", "dbdb8d", "17becf", "9edae5"]


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

    product_map = product.getMapId({'min': 1, 'max': 9,
                                    'palette': 'B2B2B2, 505012, FF00FF, 00FFFF, FFFF00, 007A0B, 00FF00, 0000FF, A020EF'})
    print "Map: %s" % ee.data.getTileUrl(product_map, 2, 2, 2)
    return jsonify({'mapId': product_map['mapid'], 'token': product_map['token']})


@gee.route('/maps/africa/v2')
def get_africa_map_v2():
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
        if 'code' in request.args and i != int(request.args['code']):
            continue
        code = ee.Image(i + 1)
        mask = ee.Image(0)
        for cluster in image_code['clusters']:
            if 'cluster_code' in request.args and cluster != int(request.args['cluster_code']):
                continue
            mask = mask.Or(image.eq(cluster))

        code = code.multiply(mask)
        product = product.add(code)
    if 'background' in request.args and request.args['background'] == 'true':
        product_map = product.getMapId({'min': 0, 'max': 9,
                                        'palette': '000000, B2B2B2, 505012, FF00FF, 00FFFF, FFFF00, 007A0B, 00FF00, 0000FF, A020EF'})
    else:
        product = product.mask(product)

        product_map = product.getMapId({'min': 1, 'max': 9,
                                        'palette': 'B2B2B2, 505012, FF00FF, 00FFFF, FFFF00, 007A0B, 00FF00, 0000FF, A020EF'})

    # print "Map: %s" % ee.data.getTileUrl(product_map, 2, 2, 2)
    return jsonify({'mapId': product_map['mapid'], 'token': product_map['token']})


@gee.route('/maps/africa/v3')
def get_africa_map_v3():
    """
    Gets the map id and token for the africa map given specific parameters.
    """

    if 'background' in request.args and request.args['background'] == 'true':
        background = True
    else:
        background = False


    ee.Initialize(ee.ServiceAccountCredentials(current_app.config['GOOGLE_SERVICE_ACCOUNT'],
                                               key_data=current_app.config['GOOGLE_API_KEY']))

    image = ee.Image('GME/images/10477185495164119823-04069492940774464340')

    with open('gfsad/views/gee/cluster_class_mapping.json') as f:
        mappings = json.loads(f.read())

    product = ee.Image(0)

    legend = []

    # no code and no cluster_code
    if 'code' not in request.args and 'cluster_code' not in request.args:
        for i, image_code in enumerate(mappings):
            code = ee.Image(i + 1)
            mask = ee.Image(0)
            for cluster in image_code['clusters']:
                mask = mask.Or(image.eq(cluster))

            code = code.multiply(mask)
            product = product.add(code)

        if background:
            product_map = product.getMapId({'min': 0, 'max': 9,
                                            'palette': '000000, B2B2B2, 505012, FF00FF, 00FFFF, FFFF00, 007A0B, 00FF00, 0000FF, A020EF'})
        else:
            product = product.mask(product)
            product_map = product.getMapId({'min': 1, 'max': 9,
                                            'palette': 'B2B2B2, 505012, FF00FF, 00FFFF, FFFF00, 007A0B, 00FF00, 0000FF, A020EF'})

    # code and no cluster_code
    elif 'code' in request.args:
        clusters = mappings[int(request.args['code'])]['clusters']
        colors = ", ".join(palette[0:len(clusters)])
        for i, cluster in enumerate(clusters):
            if 'cluster_code' in request.args and cluster != int(request.args['cluster_code']):
                continue

            legend.append({
                "cluster_code": cluster,
                "color": palette[i]
            })
            cluster_code = ee.Image(i + 1)
            mask = image.eq(cluster)
            product = product.add(cluster_code.multiply(mask))

        if background:
            product_map = product.getMapId({'min': 0, 'max': len(clusters),
                                            'palette': "000000, " + colors})
        else:
            product = product.mask(product)
            product_map = product.getMapId({'min': 1, 'max': len(clusters),
                                            'palette': colors})
    else:
        raise BadRequest(description='Parameter cluster_code requires code to be defined.')

    print "Map: %s" % ee.data.getTileUrl(product_map, 2, 2, 2)
    return jsonify({'mapId': product_map['mapid'], 'token': product_map['token'], 'legend': legend})




if __name__ == "__main__":
    print "000000, " + ", ".join(palette[0:10])