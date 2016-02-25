from flask import Blueprint, jsonify, Response, request
from gfsad.models import Record, Location
from gfsad import db
from gfsad.exceptions import FieldError
from requests.models import PreparedRequest
from flask_jwt import current_user
from sqlalchemy import func, asc, desc

data_blueprint = Blueprint('data', __name__, url_prefix='/data')


def row_to_list(r, headers=False):
    """
    Flattens query tuple to list
    :param r: tuple of columns
    :return: list
    """

    # todo should pass columns to this function and have it get the data or headers

    if headers:
        return ['id', 'year', 'month', 'lat', 'lon', 'country', 'land_use_type', 'crop_primary',
                'crop_secondary',
                'water', 'intensity', 'source_type']

    return [r[0].id, r[0].year, r[0].month, round(r[1].lat, 8), round(r[1].lon, 8), r[1].country,
            r[0].land_use_type,
            r[0].crop_primary, r[0].crop_secondary,
            r[0].water, r[0].intensity, r[0].source_type]


def safe_for_csv(value):
    """
    Simple helper for converting to csv value...
    TODO Find built-in replacement that is more robust
    :param value: anything
    :return: string
    """
    escape_chars = [",", "'", "\""]

    if value is None:
        return ""
    elif any((c in str(value) for c in escape_chars)):
        return "\"" + str(value) + "\""
    else:
        return str(value)


@data_blueprint.route('/search')
def search():
    try:
        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('page_size', 1000))
    except ValueError:
        raise FieldError(description="Invalid page or page size")

    order_by = request.args.get('order_by')
    order_by_direction = request.args.get('order_by_direction', 'asc')

    if page <= 0 or page_size < 10 or page_size > 1000:
        raise FieldError(description="Invalid page or page size")

    categorical_columns = {"land_use_type": Record.land_use_type,
                           "crop_primary": Record.crop_primary,
                           "crop_secondary": Record.crop_secondary,
                           "water": Record.water,
                           "intensity": Record.intensity,
                           "year": Record.year,
                           "month": Record.month,
                           "source_type": Record.source_type,
                           "country": Location.country,
                           "use_validation": Location.use_validation}

    q = db.session.query(Record, Location).join(Location).filter(Location.id == Record.location_id)

    if current_user._get_current_object() is None or current_user.role not in ['validation',
                                                                               'admin']:
        q = q.filter(Location.use_validation == False)

    count_total = q.count()

    # filter by bounds
    if request.args.get('southWestBounds') is not None and request.args.get(
            'northEastBounds') is not None:
        south_west = request.args.get('southWestBounds').split(',')
        north_east = request.args.get('northEastBounds').split(',')
        q = q.filter(Location.lat > float(south_west[0]), Location.lon > float(south_west[1]),
                     Location.lat < float(north_east[0]), Location.lon < float(north_east[1]))

    next_url_params = {}
    for name, column in categorical_columns.iteritems():
        values = request.args.getlist(name)
        if values:
            q = q.filter(column.in_(values))
            next_url_params[name] = values

    count_filtered = q.count()

    # order by
    if order_by and order_by in categorical_columns:
        if order_by_direction == 'desc':
            q = q.order_by(desc(categorical_columns[order_by]))
        else:
            q = q.order_by(asc(categorical_columns[order_by]))

        # save url params
        next_url_params[order_by] = order_by
        next_url_params[order_by_direction] = order_by_direction
    else:
        q = q.order_by(asc(Record.id))

    results = q.offset((page - 1) * page_size).limit(page_size).all()

    # next page

    headers = {
        "Query-Count-Total": str(count_total),
        "Query-Count-Filtered": str(count_filtered),
        "Cache-Control": "max-age=259200",
        "Access-Control-Expose-Headers": "Query-Count-Total, Query-Count-Filtered, Query-Next"

    }

    if count_filtered > page * page_size:
        next_url_params['page'] = str(page + 1)
        next_url_params['page_size'] = str(page_size)
        next_request = PreparedRequest()
        next_request.prepare_url(request.base_url, next_url_params)
        headers['Query-Next'] = next_request.url


    def generate():
        for i, r in enumerate(results):
            if i == 0:
                yield ','.join(row_to_list(None, headers=True)) + '\n'
            yield ','.join([safe_for_csv(c) for c in row_to_list(r)]) + '\n'

    return Response(generate(), headers=[(k, v) for k, v in headers.iteritems()],
                    mimetype='text/csv')


@data_blueprint.route('/image')
def image():
    categorical_columns = {"land_use_type": Record.land_use_type,
                           "crop_primary": Record.crop_primary,
                           "crop_secondary": Record.crop_secondary,
                           "water": Record.water,
                           "intensity": Record.intensity,
                           "year": Record.year,
                           "month": Record.month,
                           "source_type": Record.source_type,
                           "country": Location.country,
                           "use_validation": Location.use_validation}

    q = db.session.query(Record, Location).join(Location).filter(Location.id == Record.location_id)

    if current_user._get_current_object() is None or current_user.role not in ['validation',
                                                                               'admin']:
        q = q.filter(Location.use_validation == False)

    # filter by bounds
    if request.args.get('southWestBounds') is not None and request.args.get(
            'northEastBounds') is not None:
        south_west = request.args.get('southWestBounds').split(',')
        north_east = request.args.get('northEastBounds').split(',')
        q = q.filter(Location.lat > float(south_west[0]), Location.lon > float(south_west[1]),
                     Location.lat < float(north_east[0]), Location.lon < float(north_east[1]))

    for name, column in categorical_columns.iteritems():
        values = request.args.getlist(name)
        if values:
            q = q.filter(column.in_(values))

    # q = q.filter(Record.ndvi != None)
    q = q.order_by(func.random())

    results = q.limit(1000).all()

    # next page

    headers = {
        "Cache-Control": "max-age=259200"
    }

    paths = ''
    for r in results:
        if r[0].ndvi is None:
            continue

        path = None
        segments = 0

        for i, val in enumerate(r[0].ndvi):
            if val is None:
                if path is not None:
                    paths += '<path d="' + path + '"/>'
                    path = None
                    segments = 0
                continue

            if path is None:
                path = "M%d %d" % (i*52.17 + 150, 1000 - max(0, min(val, 1000)))
            else:
                if segments == 1:
                    path += "L%d %d" % (i*52.17 + 150, 1000 - max(0, min(val, 1000)))
                else:
                    path += " %d %d" % (i*52.17 + 150, 1000 - max(0, min(val, 1000)))

            if i + 1 == len(r[0].ndvi):
                paths += '<path d="' + path + '"/>'
                path = None
                segments = 0
                continue

            segments += 1

    svg = '''<svg viewbox="0 0 1300 1070" preserveAspectRatio="xMidYMid meet">
                <g class="paths" fill="none" stroke="black" stroke-width="2">''' + paths + '''</g>
                <g class="y labels" font-size="45">
                    <text x="90" y="40"  text-anchor="end" alignment-baseline="start">1</text>
                    <text x="90" y="280" text-anchor="end" alignment-baseline="start">0.75</text>
                    <text x="90" y="530" text-anchor="end" alignment-baseline="start">0.5</text>
                    <text x="90" y="780" text-anchor="end" alignment-baseline="start">0.25</text>
                    <text x="90" y="1010" text-anchor="end" alignment-baseline="start">0</text>
                </g>
                <polyline class="axis" fill="none" stroke="#000000" points="110,10 110,1000 1350,1000 "></polyline>
                <g class="y labels" font-size="45">
                    <text x="115" y="1050" alignment-baseline="start">Jan</text>
                    <text x="215" y="1050" alignment-baseline="start">Feb</text>
                    <text x="315" y="1050" alignment-baseline="start">Mar</text>
                    <text x="415" y="1050" alignment-baseline="start">Apr</text>
                    <text x="515" y="1050" alignment-baseline="start">May</text>
                    <text x="615" y="1050" alignment-baseline="start">Jun</text>
                    <text x="715" y="1050" alignment-baseline="start">Jul</text>
                    <text x="815" y="1050" alignment-baseline="start">Aug</text>
                    <text x="915" y="1050" alignment-baseline="start">Sep</text>
                    <text x="1015" y="1050" alignment-baseline="start">Oct</text>
                    <text x="1115" y="1050" alignment-baseline="start">Nov</text>
                    <text x="1215" y="1050" alignment-baseline="start">Dec</text>
                </g>
                  Sorry, your browser does not support inline SVG.
            </svg>'''

    return Response(svg, headers=[(k, v) for k, v in headers.iteritems()], mimetype='image/svg+xml')