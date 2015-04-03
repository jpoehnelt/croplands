#!/usr/bin/python
from flask.ext.migrate import Migrate, MigrateCommand
from flask.ext.script import Manager
from celery.bin.celery import main as celery_main
from gfsad import create_app, db

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
    celery_args = ['celery', 'worker', '-l', 'info', '-Q', Q, '--concurrency', '10']
    with manager.app.app_context():
        return celery_main(celery_args)

if __name__ == '__main__':
    manager.run()
