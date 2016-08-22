from flask import current_app
from croplands_api import celery
from croplands_api.models import db
import boto
from boto.s3.key import Key
import StringIO
import gzip
from flask import json


def status(so_far, total):
    print '%d bytes transferred out of %d' % (so_far, total)


@celery.task(rate_limit="1/h")
def reference_data_coverage_task():
    cmd = """
          Select
        c.geom_json As geometry,
        c.adm0_name as adm0_name,
        coalesce(d.cropland, 0) as cropland,
        coalesce(d.not_cropland, 0) as not_cropland,
        coalesce(d.crop_type, 0) as crop_type,
        c.cultivated_area_hectares as cultivated_area_hectares
		from (
		select
			sum((case when r.land_use_type = 1 then 1 else 0 end)) as cropland,
			sum((case when r.land_use_type > 1 then 1 else 0 end)) as not_cropland,
			sum((case when r.crop_primary > 0 then 1 else 0 end)) as crop_type,
			l.country
			from location l
			join record r on l.id = r.location_id
			group by l.country) d
		right outer join country as c on d.country = c.adm0_name
		where c.shape_area > 1.5
          """

    result = db.engine.execute(cmd)
    columns = result.keys()
    print "Got result"
    features = [{
                    'geometry': json.loads(row['geometry']),
                    "type": "Feature",
                    'properties': {
                        'cropland': row['cropland'],
                        'not_cropland': row['not_cropland'],
                        'adm0_name': row['adm0_name'],
                        'crop_type': row['crop_type'],
                        'cultivated_area_hectares': row['cultivated_area_hectares']
                    }
                } for row in result]
    fc = {
        "type": "FeatureCollection",
        "features": features
    }
    print "Converted features"

    # Connect to S3
    s3 = boto.connect_s3(current_app.config['AWS_ACCESS_KEY_ID'],
                         current_app.config['AWS_SECRET_ACCESS_KEY'])

    # Get bucket
    bucket = s3.get_bucket(current_app.config['AWS_S3_BUCKET'])

    # fake a file for gzip
    out = StringIO.StringIO()

    k = Key(bucket)

    k.key = 'public/json/reference_data_coverage.json'

    k.set_metadata('content-type', 'application/javascript')
    k.set_metadata('cache-control', 'max-age=3000000')
    k.set_metadata('content-encoding', 'gzip')

    with gzip.GzipFile(fileobj=out, mode="w") as outfile:
        outfile.write(json.dumps(fc))

    if current_app.testing:
        k.set_contents_from_string(out.getvalue(), cb=status, num_cb=10)
    else:
        k.set_contents_from_string(out.getvalue(), cb=status, num_cb=10)
    k.make_public()


