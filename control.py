#!/usr/bin/python
from flask.ext.migrate import Migrate, MigrateCommand
from flask.ext.script import Manager
from celery.bin.celery import main as celery_main
from gfsad import create_app, db
from gfsad.models import Location
import json
import redis

app = create_app('Production')
migrate = Migrate(app, db)
manager = Manager(app)
manager.add_command('db', MigrateCommand)


@manager.command
def beat():
    celery_args = ['celery', 'beat', '-C', '--pidfile=', '-s','/home/ubuntu/celerybeat.db','-l','debug']
    with manager.app.app_context():
        return celery_main(celery_args)


@manager.command
def worker(Q="gfsad"):
    from random import randint

    celery_args = ['celery', 'worker', '-l', 'info', '-n', str(chr(randint(71, 93))), '-Q', Q,
                   '--concurrency', '10']
    with manager.app.app_context():
        return celery_main(celery_args)


@manager.command
def flower():
    with manager.app.app_context():
        celery_args = ['celery', '-A', 'gfsad', 'flower',
                       '--broker=' + manager.app.config['CELERY_BROKER_URL']]
        return celery_main(celery_args)


@manager.command
def purge_tasks():
    with manager.app.app_context():
        celery_args = ['celery', '-A', 'gfsad', 'purge',
                       '--broker=' + manager.app.config['CELERY_BROKER_URL']]
        return celery_main(celery_args)


@manager.command
def random():
    from gfsad.tasks.high_res_imagery import transform, get_image

    with manager.app.app_context():
        # lat = 43.068887774169625
        # lon = -74.1796875
        #
        # get_image(lat, lon, 18)
        #
        with open('random_pts_per_gaul2.json', 'r') as f:
            features = json.loads(f.read())['features']
            for feature in features:
                x = feature['geometry']['x']
                y = feature['geometry']['y']

                lon, lat = transform(x, y)

                get_image.delay(lat, lon, 18)


@manager.command
def coverage():
    with manager.app.app_context():
        from gfsad.tasks.high_res_imagery import get_street_view_coverage
        from random import randint
        # for x in range(0, 2097152):
        # for y in range(500000, 1500000):
        # get_street_view_coverage(x, y, 21)


@manager.command
def country():
    with manager.app.app_context():
        locations = Location.query.filter_by(country=None).all()
        from gfsad.utils.countries import find_country

        c = 0
        print len(locations)
        for l in locations:
            country = find_country(l.lon, l.lat)
            if country is not None:
                l.country = country['name']
                l.continent = country['continent']

            print l.country, l.continent, l.lat, l.lon
            if c % 100 == 0:
                print c
                db.session.commit()
            c += 1

        db.session.commit()


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


if __name__ == '__main__':
    manager.run()
