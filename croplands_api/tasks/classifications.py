from croplands_api import celery
from croplands_api.models import db, Image
import StringIO
import datetime
import csv
from flask import json
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
        {'id': 3, 'order': 3, 'label': 'Not Cropland'},
        {'id': 4, 'order': 4, 'label': 'Maybe Cropland'}
    ]
    cmd = """
          SELECT
          image.id,
          location.lat,
          location.lon,
          location.country,
          image.classifications_count,
          image.classifications_majority_class,
          image.classifications_majority_agreement,
          image.date_acquired,
          image.date_acquired_earliest,
          image.date_acquired_latest,
          image.url,
          location.use_validation

          FROM image
          JOIN location on image.location_id = location.id
          WHERE image.classifications_count > 0 and image.source = 'VHRI'
          """

    result = db.engine.execute(cmd)
    columns = result.keys()
    print(columns)

    training = []
    all_data = []
    for row in result:
        data = [
            row['id'],
            row['lat'], row['lon'], row['country'],
            row['classifications_count'],
            row['classifications_majority_class'],
            row['classifications_majority_agreement'],
            strftime(row['date_acquired']),
            strftime(row['date_acquired_earliest']),
            strftime(row['date_acquired_latest']),
            "http://images.croplands.org" + row['url'].replace("images",""),
            row['use_validation']
        ]

        if not row['use_validation']:
            training.append(data)

        all_data.append(data)
    print("length: ", len(all_data))
    training_content = {
        'num_results': len(training),
        'meta': {
            'created': datetime.datetime.utcnow().isoformat(),
            'columns': columns,
            'class_mapping': [c['label'] for c in classes],
            'license': LICENSE,
            'attribution': ATTRIBUTION
        },
        'objects': training
    }

    all_data_content = {
        'num_results': len(all_data),
        'meta': {
            'created': datetime.datetime.utcnow().isoformat(),
            'columns': columns,
            'class_mapping': [c['label'] for c in classes],
            'license': LICENSE,
            'attribution': ATTRIBUTION
        },
        'objects': all_data
    }

    # make csv file
    csv_file_training = StringIO.StringIO()
    csv_file_all_data = StringIO.StringIO()

    writer = csv.writer(csv_file_training)
    writer.writerow(columns)
    for row in training:
        writer.writerow(row)

    upload_file_to_s3(csv_file_training.getvalue(), '/public/csv/classifications.csv',
                      'text/csv; charset=utf-8; header=present')

    writer = csv.writer(csv_file_all_data)
    writer.writerow(columns)
    for row in all_data:
        writer.writerow(row)

    upload_file_to_s3(csv_file_all_data.getvalue(), '/public/csv/classifications_all.csv',
                      'text/csv; charset=utf-8; header=present')

    # upload to s3
    upload_file_to_s3(json.dumps(training_content), '/public/json/classifications.json',
                      'application/javascript')

    # upload to s3
    upload_file_to_s3(json.dumps(all_data_content), '/public/json/classifications_all.json',
                      'application/javascript')
