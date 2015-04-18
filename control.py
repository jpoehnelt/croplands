#!/usr/bin/python
from flask.ext.migrate import Migrate, MigrateCommand
from flask.ext.script import Manager
from celery.bin.celery import main as celery_main
from gfsad import create_app, db
import json


app = create_app('Production')
migrate = Migrate(app, db)
manager = Manager(app)
# manager.add_option('-c', '--config', dest='config', required=True)
manager.add_command('db', MigrateCommand)


@manager.command
def beat():
    celery_args = ['celery', 'beat', '-C']
    with manager.app.app_context():
        return celery_main(celery_args)


@manager.command
def worker(Q="gfsad"):
    from random import randint
    celery_args = ['celery', 'worker', '-l', 'info','-n', str(chr(randint(71,93))),  '-Q', Q, '--concurrency', '10']
    with manager.app.app_context():
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
        for x in range(0, 2097152):
            for y in range(500000, 1500000):
                get_street_view_coverage.delay(x, y, 21)


if __name__ == '__main__':
    manager.run()
