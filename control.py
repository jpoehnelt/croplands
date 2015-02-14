from flask.ext.migrate import Migrate, MigrateCommand
from flask.ext.script import Manager
from celery.bin.celery import main as celery_main
from gfsad import create_app, db

manager = Manager(create_app)
manager.add_option('-c', '--config', dest='config', required=True)
manager.add_command('db', MigrateCommand)


@manager.command
def beat():
    app = create_app()
    celery_args = ['celery', 'beat', '-C']
    with app.app_context():
        return celery_main(celery_args)


@manager.command
def worker(Q="gfsad-production"):
    app = create_app('gfsad.config.production')
    celery_args = ['celery', 'worker', '-l', 'info', '-Q', Q]
    with app.app_context():
        return celery_main(celery_args)

if __name__ == '__main__':
    manager.run()
