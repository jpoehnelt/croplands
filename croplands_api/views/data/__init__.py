from flask import Blueprint, current_app, Response, request, jsonify
from croplands_api.models import Record, Location
from croplands_api import db, cache, limiter
from croplands_api.exceptions import FieldError
from requests.models import PreparedRequest
from flask_jwt import current_user
from croplands_api.auth import is_anonymous, generate_token
from sqlalchemy import func, asc, desc
import uuid
import datetime

data_blueprint = Blueprint('data', __name__, url_prefix='/data')

categorical_columns = {"id": Record.id,
                       "land_use_type": Record.land_use_type,
                       "crop_primary": Record.crop_primary,
                       "crop_secondary": Record.crop_secondary,
                       "water": Record.water,
                       "intensity": Record.intensity,
                       "year": Record.year,
                       "month": Record.month,
                       "source_type": Record.source_type,
                       "country": Location.country,
                       "use_validation": Location.use_validation}


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
                'water', 'intensity', 'source_type', 'source_class', 'source_description',
                'use_validation']

    return [r[0].id, r[0].year, r[0].month, round(r[1].lat, 8), round(r[1].lon, 8), r[1].country,
            r[0].land_use_type,
            r[0].crop_primary, r[0].crop_secondary,
            r[0].water, r[0].intensity, r[0].source_type, r[0].source_class,
            r[0].source_description, r[1].use_validation]


def safe_for_csv(value):
    """
    Simple helper for converting to csv value...
    TODO Find built-in replacement that is more robust
    :param value: anything
    :return: string
    """
    escape_chars = ["'", "\""]

    try:
        value = value.replace(",", "_")
    except AttributeError:
        pass

    if value is None:
        return ""
    elif any((c in str(value) for c in escape_chars)):
        return "\"" + str(value) + "\""
    else:
        return str(value)


def query(meta=None, filters=None, count_all=False, count_filtered=False):
    if filters is None:
        filters = {}

    if meta is None:
        meta = {
            "offset": 0,
            "limit": 1000,
            "order_by": 'id'
        }

    q = db.session.query(Record, Location)\
        .join(Location).filter(Location.id == Record.location_id)

    if count_all:
        return q.count()

    # filter by bounds
    if 'southWestBounds' in filters and 'northEastBounds' in filters:
        south_west = filters['southWestBounds'].split(',')
        north_east = filters['northEastBounds'].split(',')
        q = q.filter(Location.lat > float(south_west[0]), Location.lon > float(south_west[1]),
                     Location.lat < float(north_east[0]), Location.lon < float(north_east[1]))

    if 'ndvi_limit_lower' in filters and 'ndvi_limit_upper' in filters:
        upper = [int(v) for v in filters['ndvi_limit_upper'].split(',')]
        lower = [int(v) for v in filters['ndvi_limit_lower'].split(',')]
        q = q.filter(func.array_bounds(Record.ndvi, upper, lower))

    for name, column in categorical_columns.iteritems():
        if name not in filters:
            continue
        values = filters[name]
        if values:
            q = q.filter(column.in_(values))

    if 'delay' in filters and filters['delay']:
        q = q.filter(Record.date_created < datetime.datetime.utcnow() - current_app.config.get(
            'DATA_QUERY_DELAY'))
        print('delay', datetime.datetime.utcnow() - current_app.config.get(
            'DATA_QUERY_DELAY'))


    if count_filtered:
        return q.count()

    # order by
    if meta["order_by"] and meta["order_by"] in categorical_columns or meta[
        "order_by_direction"] == 'rand':
        if meta["order_by_direction"].lower() == 'desc':
            q = q.order_by(desc(categorical_columns[meta["order_by"]]))
        elif meta["order_by_direction"].lower() == 'rand':
            q = q.order_by(func.random())
        else:
            q = q.order_by(asc(categorical_columns[meta["order_by"]]))
    else:
        q = q.order_by(asc(Record.id))

    results = q.offset(meta["offset"]).limit(meta["limit"]).all()

    return results


def result_generator(results):
    for i, r in enumerate(results):
        if i == 0:
            yield ','.join(row_to_list(None, headers=True)) + '\n'
        yield ','.join([safe_for_csv(c) for c in row_to_list(r)]) + '\n'


def get_filters():
    filters = {}

    if is_anonymous():
        filters['delay'] = request.args.get('d', 1) == 1
    else:
        filters['delay'] = request.args.get('d', 0) == 1

    if is_anonymous() or current_user.role not in ['validation', 'admin']:
        filters['use_validation'] = [False]

    if request.args.get('southWestBounds') is not None and request.args.get(
            'northEastBounds') is not None:
        filters['northEastBounds'] = request.args.get('northEastBounds')
        filters['southWestBounds'] = request.args.get('southWestBounds')

    if request.args.get('ndvi_limit_upper') is not None and request.args.get(
            'ndvi_limit_lower') is not None:
        filters['ndvi_limit_upper'] = request.args.get('ndvi_limit_upper')
        filters['ndvi_limit_lower'] = request.args.get('ndvi_limit_lower')

        if len(filters['ndvi_limit_upper'].split(',')) != 23 or len(
                filters['ndvi_limit_lower'].split(',')) != 23:
            raise FieldError(description="Invalid Array Bounds Length")

    for name, column in categorical_columns.iteritems():
        values = request.args.getlist(name)
        if values:
            filters[name] = values
    return filters


def get_meta(page_size=1000):
    try:
        page = int(request.args.get('page', 1))
        page_size = min(int(request.args.get('page_size', page_size)), current_app.config.get('DATA_DOWNLOAD_MAX_PAGE_SIZE'))
    except ValueError:
        raise FieldError(description="Invalid page or page size")

    offset = (page - 1) * page_size
    if offset < 0:
        raise FieldError(description="Invalid page or page size")

    order_by = request.args.get('order_by', 'id')
    if order_by not in categorical_columns:
        raise FieldError(description="Invalid order by column")
    order_by_direction = request.args.get('order_by_direction', 'desc')

    return {
        "page": page,
        "page_size": page_size,
        "offset": offset,
        "limit": min(page_size, 1000000),
        "order_by": order_by,
        "order_by_direction": order_by_direction
    }


@data_blueprint.route('/search')
@limiter.limit("80 per minute")
def search():
    meta = get_meta()
    filters = get_filters()

    # get counts
    count_total = query(count_all=True)
    count_filtered = query(filters=filters, count_filtered=True)

    # build response
    results = query(meta=meta, filters=filters)

    headers = {
        "Query-Count-Total": str(count_total),
        "Query-Count-Filtered": str(count_filtered),
        "Cache-Control": "max-age=259200",
        "Access-Control-Expose-Headers": "Query-Count-Total, Query-Count-Filtered, Query-Next"
    }

    if count_filtered > meta["page"] * meta["limit"]:
        next_url_params = {
            'page': str(meta["page"] + 1),
            'page_size': str(meta["limit"]),
            'order_by': meta["order_by"],
            'order_by_direction': meta["order_by_direction"]
        }
        next_url_params.update(filters)
        next_request = PreparedRequest()
        next_request.prepare_url(request.base_url, next_url_params)
        headers['Query-Next'] = next_request.url

    return Response(result_generator(results), headers=[(k, v) for k, v in headers.iteritems()],
                    mimetype='text/csv')


@data_blueprint.route('/image')
@limiter.limit("80 per minute")
def image():
    filters = get_filters()
    meta = {
        "order_by": "id",
        "order_by_direction": "rand",
        "limit": 1000,
        "offset": 0
    }

    # build response
    results = query(meta, filters=filters)

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

            x, y = (i * 52.17, 1000 - max(3, min(val, 1000)))

            if path is None:
                path = "M%d %d" % (x, y)
            else:
                if segments == 1:
                    path += "L%d %d" % (x, y)
                else:
                    path += " %d %d" % (x, y)

            if i + 1 == len(r[0].ndvi):
                paths += '<path d="' + path + '"/>'
                path = None
                segments = 0
                continue

            segments += 1

    svg = '''<svg viewbox="0 0 1500 1210" preserveAspectRatio="xMidYMid meet">
                <g transform="translate(20,20)">
                    <g class="paths" fill="none" stroke="black" stroke-width="2" transform="translate(150,0)">''' + paths + '''</g>
                    <g class="y labels" font-size="45">
                        <text x="90" y="40"  text-anchor="end" alignment-baseline="start">1</text>
                        <text x="90" y="280" text-anchor="end" alignment-baseline="start">0.75</text>
                        <text x="90" y="530" text-anchor="end" alignment-baseline="start">0.5</text>
                        <text x="90" y="780" text-anchor="end" alignment-baseline="start">0.25</text>
                        <text x="90" y="1010" text-anchor="end" alignment-baseline="start">0</text>
                    </g>
                    <polyline class="axis" fill="none" stroke="#000000" points="110,10 110,1000 1330,1000 "></polyline>
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
                </g>
                <g data-temporal-bounds transform="translate(150,0)" data-intervals="23" data-interval-width="52.17"></g>
                  Sorry, your browser does not support inline SVG.
            </svg>'''

    return Response(svg, headers=[(k, v) for k, v in headers.iteritems()], mimetype='image/svg+xml')


@data_blueprint.route("/download")
@limiter.limit("10 per minute")
def download():
    meta = get_meta(page_size=1000000)
    filters = get_filters()

    results = query(meta=meta, filters=filters)
    return Response(result_generator(results), mimetype='text/csv')


@data_blueprint.route("/download/<country>")
@limiter.limit("10 per minute")
def download_country(country):
    meta = get_meta(page_size=1000000)
    filters = get_filters()

    if request.args.get('justin_says', 'nope') == 'yes':
        filters['use_validation'] = [False, True]

    filters['country'] = [country]
    filters['delay'] = False

    results = query(meta=meta, filters=filters)
    return Response(result_generator(results), mimetype='text/csv')
