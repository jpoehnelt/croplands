from flask import current_app
from gfsad import celery
from gfsad.models import db, TimeSeries
from gfsad.utils import split_list
import boto
from boto.s3.key import Key
import datetime
import StringIO
import gzip
import json
from gfsad.views.gee import init_gee, extract_info
import base64
from flask_restless.helpers import strings_to_dates


def status(so_far, total):
    print '%d bytes transferred out of %d' % (so_far, total)


@celery.task()
def get_ndvi(id, lat, lon):
    init_gee()
    time_series_data = extract_info(lat=lat, lon=lon, date_start="1990-01-01")
    for data in time_series_data:
        if data['ndvi'] is None:
            continue

        pt = TimeSeries(location_id=id,
                        date_acquired=datetime.datetime.strptime(data['date'], "%Y-%m-%d"),
                        series='modis_ndvi',
                        value=data['ndvi'])
        db.session.add(pt)
    db.session.commit()


@celery.task()
def sum_ratings_for_record(id):
    try:
        db.session.execute(
            """
            UPDATE record
            SET rating = (SELECT sum(rating)
                          FROM record_rating
                          WHERE record_rating.record_id = :id)
            WHERE id = :id
            """,
            {'id': id}
        )
    except Exception as e:
        pass


@celery.task(rate_limit="6/h", time_limit=300)
def build_static_records():
    NUM_FILES = 3

    LICENSE = """This data is made available under the Open Database License:
    http://opendatacommons.org/licenses/odbl/1.0/. Any rights in individual
    contents of the database are licensed under the Database Contents License:
    http://opendatacommons.org/licenses/dbcl/1.0/"""

    ATTRIBUTION = 'Global Food Security Analysis-Support Data at 30m, http://www.croplands.org'
    cmd = """
              SELECT  location.id AS location_id,
                      location.lat AS lat,
                      location.lon AS lon,
                      record.id as id,
                      record.rating as rating,
                      record.year as year,
                      record.month as month,
                      record.land_use_type as land_use_type,
                      record.crop_primary as crop_primary,
                      record.crop_secondary as crop_secondary,
                      record.water as water,
                      record.intensity as intensity
              FROM record
              LEFT JOIN location
              ON location.id = record.location_id
              ORDER BY random()
              """

    result = db.engine.execute(cmd)
    columns = result.keys()
    records = [[row['location_id'], row['lat'], row['lon'], row['id'], row['rating'], row['year'], row['month'], row['land_use_type'], row['crop_primary'], row['crop_secondary'], row['water'],
                row['intensity']] for row in result]

    split_records = split_list(records, NUM_FILES)

    # Connect to S3
    s3 = boto.connect_s3(current_app.config['AWS_ACCESS_KEY_ID'],
                         current_app.config['AWS_SECRET_ACCESS_KEY'])

    # Get bucket
    bucket = s3.get_bucket('gfsad30')

    for i in range(1,NUM_FILES+1):
        if current_app.testing:
            key = 'json/records.test.p%d.json'
        else:
            key = 'json/records.p%d.json'

        content = {
            'num_results': len(records),
            'total_pages': NUM_FILES,
            'page': i,
            'meta': {
                'created': datetime.datetime.utcnow().isoformat(),
                'columns': columns,
                'license': LICENSE,
                'attribution': ATTRIBUTION
            },
            'objects': split_records[i - 1]
        }

        if i < NUM_FILES - 1:
            content['next_page'] = key % (i + 1)

        # fake a file for gzip
        out = StringIO.StringIO()

        k = Key(bucket)

        k.key = key % i

        k.set_metadata('content-type', 'application/javascript')
        k.set_metadata('cache-control', 'max-age=300')
        k.set_metadata('content-encoding', 'gzip')

        with gzip.GzipFile(fileobj=out, mode="w") as outfile:
            outfile.write(json.dumps(content))

        if current_app.testing:
            k.set_contents_from_string(out.getvalue(), cb=status, num_cb=10)
        else:
            k.set_contents_from_string(out.getvalue())
        k.make_public()


