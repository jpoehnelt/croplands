from gfsad import celery
from gfsad.models import db, Image
from flask import current_app
import StringIO
import boto
from boto.s3.key import Key
import datetime
import gzip
import json


@celery.task
def compute_image_classification_statistics(image_id):
    image = Image.query.get(image_id)

    classification_count = [0 for i in range(0, 10)]

    for record in image.classifications:
        classification_count[record.classification] += 1

    image.classifications_majority_class = 0
    for i, count in enumerate(classification_count):
        if count > classification_count[image.classifications_majority_class]:
            image.classifications_majority_class = i

    image.classifications_count = sum(classification_count)
    image.classifications_majority_agreement = 100 * classification_count[
        image.classifications_majority_class] / image.classifications_count

    image.classifications_count = sum(classification_count)

    db.session.commit()


@celery.task(rate_limit="6/h")
def build_classifications_result():
    LICENSE = """This data is made available under the Open Database License:
    http://opendatacommons.org/licenses/odbl/1.0/. Any rights in individual
    contents of the database are licensed under the Database Contents License:
    http://opendatacommons.org/licenses/dbcl/1.0/"""

    ATTRIBUTION = 'Global Food Security Analysis-Support Data at 30m, http://www.croplands.org'

    cmd = """
          SELECT
          lat,
          lon,
          classifications_count,
          classifications_majority_class,
          classifications_majority_agreement,
          date_acquired,
          date_acquired_earliest,
          date_acquired_latest

          FROM image
          WHERE classifications_count > 0
          """

    result = db.engine.execute(cmd)
    columns = result.keys()
    records = [
        [
            row['lat'], row['lon'],
            row['classifications_count'],
            row['classifications_majority_class'],
            row['classifications_majority_agreement'], 
            row['date_acquired'].isoformat(),
            row['date_acquired_earliest'].isoformat(),
            row['date_acquired_latest'].isoformat()
        ] for row in result
    ]

    print "Building json with %d classifications" % len(records)


    # Connect to S3
    s3 = boto.connect_s3(current_app.config['AWS_ACCESS_KEY_ID'],
                         current_app.config['AWS_SECRET_ACCESS_KEY'])

    # Get bucket
    bucket = s3.get_bucket('gfsad30')

    if current_app.testing:
        key = 'json/classifications.test.json'
    else:
        key = 'json/classifications.json'

    content = {
        'num_results': len(records),
        'meta': {
            'created': datetime.datetime.utcnow().isoformat(),
            'columns': columns,
            'license': LICENSE,
            'attribution': ATTRIBUTION
        },
        'objects': records
    }

    # fake a file for gzip
    out = StringIO.StringIO()

    k = Key(bucket)

    k.key = key

    k.set_metadata('content-type', 'application/javascript')
    k.set_metadata('cache-control', 'max-age=3000')
    k.set_metadata('content-encoding', 'gzip')

    with gzip.GzipFile(fileobj=out, mode="w") as outfile:
        outfile.write(json.dumps(content))

    k.set_contents_from_string(out.getvalue())
    k.make_public()
