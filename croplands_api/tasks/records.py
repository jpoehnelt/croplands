from flask import current_app
from croplands_api import celery
from croplands_api.models import db, Record
from croplands_api.utils.google.fusion import replace_rows
from croplands_api.utils.google.gee import extract, ee
from croplands_api.utils.mappings import get_crop_label, get_intensity_label, get_land_cover_label, \
    get_water_label
import StringIO
import csv
from datetime import datetime, timedelta

def status(so_far, total):
    print '%d bytes transferred out of %d' % (so_far, total)


def convert_to_labels(row):
    row['water_source'] = get_water_label(row['water_source'])
    row['crop_primary'] = get_crop_label(row['crop_primary'])
    row['crop_secondary'] = get_crop_label(row['crop_secondary'])
    row['land_cover'] = get_land_cover_label(row['land_cover'])
    row['intensity'] = get_intensity_label(row['intensity'])
    return row


def median(A):
    if len(A) == 0:
        return None
    return sorted(A)[len(A) / 2]


def mean(A):
    if len(A) == 0:
        return None
    total = 0.0
    count = 0

    for i in A:
        if i is not None:
            total += i
            count += 1

    if count == 0:
        return 0

    return total / count


@celery.task(rate_limit="120/m", time_limit=300)
def get_ndvi(id=None, record=None):
    """
    Gets the ndvi time series for a record and insert into array(23 elements) for record.
    Also computes the mean ndvi.

    :param id: record.id optional
    :param record: Record
    :return: None
    """
    eta = datetime.utcnow() + timedelta(days=150)

    if id is not None and record is None:
        record = db.session.query(Record).filter(Record.id == id).first()

    geometry = ee.Geometry.Point(record.location.lon, record.location.lat)
    start, end = str(record.year) + "-01-01", str(record.year) + "-12-31"
    collection = ee.ImageCollection('MODIS/MOD13Q1').filterDate(start, end).select(['NDVI'])
    results = extract(geometry, collection)

    series23 = [(row['NDVI'] / 10) if row['NDVI'] is not None else None for row in results]

    if len(series23) < 23:
        series23 += [None for i in range(23 - len(series23))]
        eta = datetime.utcnow() + timedelta(days=10)

    assert len(series23) == 23

    record.ndvi_mean = int(mean(series23))
    record.ndvi = series23

    print("Record #%d NDVI Series Updated. Mean: %d" % (record.id, record.ndvi_mean))

    db.session.commit()

    # todo fix for testing...
    if current_app.config['ENV'] != 'TESTING':
        get_ndvi.apply_async(args=[id, record], eta=eta)


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
        db.session.commit()
    except Exception as e:
        print e
        pass


@celery.task(rate_limit="15/h", time_limit=300)
def build_fusion_tables():
    cmd = """
          SELECT  record.id as id,
                  location.id AS location_id,
                  location.lat AS lat,
                  location.lon AS lon,
                  record.rating as rating,
                  record.year as year,
                  record.month as month,
                  record.land_use_type as land_cover,
                  record.crop_primary as crop_primary,
                  record.crop_secondary as crop_secondary,
                  record.water as water_source,
                  record.intensity as intensity,
                  location.country as country,
                  record.source_description as source_description,
                  record.source_type as source_type,
                  record.source_id as source_id,
                  record.source_class as source_class,
                  images.image_1 as image_1,
                  images.image_2 as image_2,
                  images.image_3 as image_3,
                  location.use_validation as use_validation,
                  location.use_private as use_private
          FROM record
          LEFT JOIN location ON location.id = record.location_id
          LEFT OUTER JOIN (SELECT * from crosstab (
            $$SELECT location_id, url, replace(url, 'images/', 'http://images.croplands.org/')
             FROM   image
             WHERE  url not like '%%digital_globe%%'
             $$)
             AS t ( location_id int,
              image_1 text, --varchar changed to text with replace function above
              image_2 text,
              image_3 text
            )
          ) images on location.id = images.location_id
          WHERE location.use_deleted is false AND location.use_invalid is false
          """

    result = db.engine.execute(cmd)
    columns = result.keys()

    all_results = [convert_to_labels(dict(row.items())) for row in result]

    training = StringIO.StringIO()
    validation = StringIO.StringIO()
    public = StringIO.StringIO()

    writer_training = csv.DictWriter(training, fieldnames=columns[0:-2], extrasaction='ignore')
    writer_validation = csv.DictWriter(validation, fieldnames=columns[0:-2], extrasaction='ignore')
    writer_public = csv.DictWriter(public, fieldnames=columns[0:-2], extrasaction='ignore')

    writer_training.writeheader()
    writer_validation.writeheader()
    writer_public.writeheader()

    print len(all_results)

    for row in all_results:
        try:
            if not row['use_private']:
                writer_public.writerow(row)
            if row['use_validation']:
                writer_validation.writerow(row)
            else:
                writer_training.writerow(row)
        except UnicodeEncodeError as e:
            print e, row

    replace_rows('1C_gFvQmd3AGtB0Q0XgnKk5ESUARSH79FB9Un8sF2', training, startLine=1)
    replace_rows('12WLGpk7o1ic_j88NQfmrUEILVWDlrJaqZCAqEDeo', validation, startLine=1)
    replace_rows('1jQjTg7zXhwmLGJdfPCavgdifnyNTqJGi3Bn3RwWF', public, startLine=1)
