from default import *

SECRET_KEY = os.urandom(24)
SQLALCHEMY_DATABASE_URI = os.environ.get('SQLALCHEMY_DATABASE_URI')

CELERY_DEFAULT_QUEUE = 'gfsad-production'
CELERYBEAT_SCHEDULE = {
    'add-every-5-minutes': {
        'task': 'gfsad.tasks.records.build_static_records',
        'schedule': timedelta(minutes=5),
        'options': {'queue': CELERY_DEFAULT_QUEUE}
    },
}
CELERY_TIMEZONE = 'UTC'