#!/usr/bin/python
from flask.ext.migrate import Migrate, MigrateCommand
from flask.ext.script import Manager
from celery.bin.celery import main as celery_main
from croplands_api import create_app, db
import json
import redis
import uuid

app = create_app('Production')
migrate = Migrate(app, db)
manager = Manager(app)
manager.add_command('db', MigrateCommand)


@manager.command
def beat():
    celery_args = ['celery', 'beat', '-C', '-l',
                   'warning', '--pidfile='] # no pidfile required
    with manager.app.app_context():
        return celery_main(celery_args)


@manager.command
def worker(Q="croplands_api"):
    from random import randint

    celery_args = ['celery', 'worker', '-l', 'warning', '-n', str(uuid.uuid4()).replace("-","")[0:12], '-Q', Q,
                   '--concurrency', '3']
    print " ".join(celery_args)
    with manager.app.app_context():
        return celery_main(celery_args)


@manager.command
def flower():
    with manager.app.app_context():
        celery_args = ['celery', '-A', 'croplands_api', 'flower',
                       '--broker=' + manager.app.config['CELERY_BROKER_URL']]
        return celery_main(celery_args)


@manager.command
def purge_tasks():
    with manager.app.app_context():
        celery_args = ['celery', '-A', 'croplands_api', 'purge',
                       '--broker=' + manager.app.config['CELERY_BROKER_URL']]
        return celery_main(celery_args)


@manager.command
def get_image():
    from croplands_api.tasks.high_res_imagery import get_image

    with manager.app.app_context():

        # good test image for alignment:
        # get_image(-16.571397081961127, -44.087328593117576, 18)
        import sqlite3
        import time
        conn = sqlite3.connect('random_locations.sqlite')
        c = conn.cursor()
        i = 0
        while True:
            c.execute(
                'SELECT * FROM pts WHERE sync=0 AND lon > 97.2 AND lon < 105.7 AND lat < 20.5 AND lat > 5.4  ORDER BY RANDOM() LIMIT 100') # Thailand
                # 'SELECT * FROM pts WHERE sync=0 ORDER BY RANDOM() LIMIT 50')

            pts = c.fetchall()

            if len(pts) == 0 or i > 500:
                break

            for pt in pts:
                # print pt
                i += 1
                print("%d %s" % (i, str(pt)))
                time.sleep(2)
                get_image.delay(pt[1], pt[0], 18)
                c.execute("UPDATE pts SET sync = 1 WHERE id= ?", (pt[3],))
            conn.commit()
        return

@manager.command
def get_image_from_csv(path):
    import csv

    from croplands_api.tasks.high_res_imagery import get_image
    with manager.app.app_context():

        with open(path) as f:
            reader = csv.DictReader(f)
            for row in reader:
                print(float(row['lat']), float(row['lon']), 18)
                try:
                    get_image(float(row['lat']), float(row['lon']), 18, training_only=True)
                except Exception as e:
                    print(e)



@manager.command
def random(n=10000000):
    import csv
    from shapely.geometry import shape, LineString, Point, MultiPolygon
    from croplands_api.utils.geo import uniform_sample
    from multiprocessing.pool import ThreadPool

    with manager.app.app_context():
        with open('countries_small.geojson') as f:
            features = json.load(f)['features']

        features = [shape(f['geometry']) for f in features if
                    f['properties']['name'] not in ['Greenland', 'Antarctica']]
        meridian = LineString([(0, 90), (0, -90)])


        def polygonize_with_areas(poly):
            if poly.intersects(meridian):
                poly = poly.difference(meridian.buffer(0.01))

            if type(poly) is MultiPolygon:
                return [(p, p.area) for p in poly.geoms]
            else:
                return [(poly, poly.area)]


        pool = ThreadPool(30)
        polygons = [p for r in pool.map(polygonize_with_areas, features) for p in r]
        pool.close()
        pool.join()
        total_area = sum([p[1] for p in polygons])
        print('sampling %d polygons for %d pts' % (len(polygons), n))

        def sample(args):
            poly, n, i = args
            print(i)
            for pt in uniform_sample(poly, n).tolist():
                if poly.contains(Point(pt[0], pt[1])):
                    yield pt


        pool = ThreadPool(50)
        pts = [pt for result in pool.map(sample, [(p[0], int(p[1] / total_area * n), i) for i, p in
                                                  enumerate(polygons)]) for pt in result]
        pool.close()
        pool.join()

        with open('random_%d.csv' % n, 'w') as f:
            writer = csv.writer(f)
            writer.writerow(['longitude', 'latitude'])
            for pt in pts:
                writer.writerow(pt)

        return


@manager.command
def coverage():
    with manager.app.app_context():
        pass
        from croplands_api.tasks.high_res_imagery import get_street_view_coverage
        from random import randint
        # for x in range(0, 2097152):
        # for y in range(500000, 1500000):
        # get_street_view_coverage(x, y, 21)


@manager.command
def classification():
    with manager.app.app_context():
        from croplands_api.tasks.classifications import build_classifications_result, compute_image_classification_statistics
        build_classifications_result.delay()
        # compute_image_classification_statistics(30986)

@manager.command
def clear_mapids():
    """
    Clears all map ids from the cache. Map ids and tokens are currently stored for
    between 12 and 24 hours to speed retrieval of tiles from Google Earth Engine.
    :return: None
    """
    with manager.app.app_context():
        redis_client = redis.from_url(app.config['REDISCLOUD_URL'])
        for key in redis_client.scan_iter(match='flask_cache_map_*'):
            print 'deleting %s' % key
            redis_client.delete(key)


@manager.command
def ndvi():
    from croplands_api.models import Record
    from croplands_api.tasks.records import get_ndvi

    with manager.app.app_context():
        for r in db.session.query(Record).filter(Record.ndvi == None).all():
            get_ndvi.delay(r.id)
            print("Called get_ndvi.delay(%d)" % r.id)


@manager.command
def reference_data_coverage():
    """
    Clears all map ids from the cache. Map ids and tokens are currently stored for
    between 12 and 24 hours to speed retrieval of tiles from Google Earth Engine.
    :return: None
    """
    with manager.app.app_context():
        from croplands_api.tasks.reference_data_coverage import reference_data_coverage_task

        reference_data_coverage_task()


@manager.command
def fusion():
    """
    Clears all map ids from the cache. Map ids and tokens are currently stored for
    between 12 and 24 hours to speed retrieval of tiles from Google Earth Engine.
    :return: None
    """
    with manager.app.app_context():
        from croplands_api.tasks.records import build_fusion_tables

        build_fusion_tables()


if __name__ == '__main__':
    manager.run()
