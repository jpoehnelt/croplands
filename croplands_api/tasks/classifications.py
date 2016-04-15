from croplands_api import celery
from croplands_api.models import db, Image
import StringIO
import datetime
import csv
import json
from croplands_api.utils.s3 import upload_file_to_s3
from croplands_api.utils.misc import strftime

@celery.task
def compute_image_classification_statistics(image_id):
    print "Computing Image Classification Statistics for Image #%d" % image_id
    image = Image.query.get(image_id)

    classes = {}

    for record in image.classifications:
        if record.classification not in classes:
            classes[record.classification] = 1
        else:
            classes[record.classification] += 1

    image.classifications_majority_class = None
    for k in classes.keys():
        if image.classifications_majority_class is None or classes[k] > classes[image.classifications_majority_class]:
            image.classifications_majority_class = k

    image.classifications_count = sum(classes.values())
    image.classifications_majority_agreement = 100 * classes[
        image.classifications_majority_class] / image.classifications_count

    db.session.commit()


@celery.task(rate_limit="6/h")
def build_classifications_result():
    LICENSE = """This data is made available under the Open Database License:
    http://opendatacommons.org/licenses/odbl/1.0/. Any rights in individual
    contents of the database are licensed under the Database Contents License:
    http://opendatacommons.org/licenses/dbcl/1.0/"""

    ATTRIBUTION = 'Global Food Security Analysis-Support Data at 30m, https://croplands.org'
    classes = [
        {'id': -1, 'order': 0, 'label': 'Reject'},
        {'id': 1, 'order': 1, 'label': 'Pure Cropland'},
        {'id': 2, 'order': 2, 'label': 'Mixed Cropland'},
        {'id': 3, 'order': 3, 'label': 'Not Cropland'}
    ]
    cmd = """
          SELECT
          location.lat,
          location.lon,
          image.classifications_count,
          image.classifications_majority_class,
          image.classifications_majority_agreement,
          image.date_acquired,
          image.date_acquired_earliest,
          image.date_acquired_latest

          FROM image
          JOIN location on image.location_id = location.id
          WHERE classifications_count > 0 and location.source = 'random' and not location.use_validation
          """

    result = db.engine.execute(cmd)
    columns = result.keys()
    records = [
        [
            row['lat'], row['lon'],
            row['classifications_count'],
            row['classifications_majority_class'],
            row['classifications_majority_agreement'],
            strftime(row['date_acquired']),
            strftime(row['date_acquired_earliest']),
            strftime(row['date_acquired_latest'])
        ] for row in result
    ]

    print "Building json with %d classifications" % len(records)

    content = {
        'num_results': len(records),
        'meta': {
            'created': datetime.datetime.utcnow().isoformat(),
            'columns': columns,
            'class_mapping': [c['label'] for c in classes],
            'license': LICENSE,
            'attribution': ATTRIBUTION
        },
        'objects': records
    }

    # make csv file
    csv_file = StringIO.StringIO()

    writer = csv.writer(csv_file)
    writer.writerow(columns)
    for row in records:
        writer.writerow(row)

    # upload to s3
    upload_file_to_s3(json.dumps(content), '/public/json/classifications.json',
                      'application/javascript')
    upload_file_to_s3(csv_file.getvalue(), '/public/csv/classifications.csv',
                      'text/csv; charset=utf-8; header=present')
