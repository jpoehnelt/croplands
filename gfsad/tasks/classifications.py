from gfsad import celery
from gfsad.models import db, Image
import StringIO
import datetime
import csv
import json
from gfsad.utils.s3 import upload_file_to_s3


@celery.task
def compute_image_classification_statistics(image_id):
    print "Computing Image Classification Statistics for Image #%d" % image_id
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
    classes = [
            {'id': 0, 'order': 0, 'label': 'Unknown', 'description': 'Not cropland is...'},
            {'id': 1, 'order': 1, 'label': 'Cropland', 'description': 'Cropland is...'},
            {'id': 2, 'order': 2, 'label': 'Forest', 'description': 'Forest is ...'},
            {'id': 3, 'order': 3, 'label': 'Grassland', 'description': 'Grassland is ...'},
            {'id': 4, 'order': 5, 'label': 'Barren', 'description': 'Barrenland is ...'},
            {'id': 5, 'order': 7, 'label': 'Urban/Builtup', 'description': 'Urban is ...'},
            {'id': 6, 'order': 4, 'label': 'Shrub', 'description': 'Shrub is ...'},
            {'id': 7, 'order': 6, 'label': 'Water', 'description': 'Water is ...'}
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
            row['date_acquired'].strftime("%Y-%m-%d"),
            row['date_acquired_earliest'].strftime("%Y-%m-%d"),
            row['date_acquired_latest'].strftime("%Y-%m-%d"),
        ] for row in result
    ]

    print "Building json with %d classifications" % len(records)

    key_json = '/json/classifications.json'
    key_csv = '/json/classifications.csv'

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
    upload_file_to_s3(json.dumps(content), '/json/classifications.json', 'application/javascript')
    upload_file_to_s3(csv_file.getvalue(), '/csv/classifications.csv', 'text/csv; charset=utf-8; header=present')
