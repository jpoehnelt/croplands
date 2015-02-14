from default import *

DEVELOPMENT = True
DEBUG = True
SQLALCHEMY_DATABASE_URI = os.environ.get('SQLALCHEMY_DATABASE_URI')

CELERY_DEFAULT_QUEUE = 'gfsad-development'
CELERYBEAT_SCHEDULE = {
    'add-every-5-minutes': {
        'task': 'gfsad.tasks.records.build_static_records',
        'schedule': timedelta(minutes=5),
        'options': {'queue': CELERY_DEFAULT_QUEUE}
    },
}