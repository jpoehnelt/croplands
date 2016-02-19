import os
from datetime import timedelta

try:
    import secrets
except ImportError:
    pass

class Default(object):
    ENV = 'DEFAULT'
    CSRF_ENABLED = False
    ALLOWED_IMG_EXTENSIONS = ['jpg', 'png']

    # Access Keys
    try:
        with open('google_api.key', 'r') as f:
            GOOGLE_API_KEY = f.read()
    except:
        GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY')
    finally:
        assert GOOGLE_API_KEY is not None


    GOOGLE_STREET_VIEW_API_KEY = os.environ.get('GOOGLE_STREET_VIEW_API_KEY')
    GOOGLE_SERVICE_ACCOUNT = os.environ.get('GOOGLE_SERVICE_ACCOUNT')
    AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')
    AWS_URL_SIGNING_KEY = os.environ.get('AWS_URL_SIGNING_KEY')

    AWS_URL_SIGNING_EXPIRATION_DEFAULT = 60 * 60

    JWT_AUTH_URL_RULE = '/auth/l'
    JWT_EXPIRATION_DELTA = timedelta(days=150)

    DEFAULT_MAIL_SENDER = 'info@croplands.org'

    AUTH_RESET_TOKEN_EXPIRATION = 300
    AUTH_REQUIRE_CONFIRMATION = False

    CELERY_TIMEZONE = 'UTC'
    CELERY_ENABLE_UTC = True

    DG_EV_CONNECT_ID = os.environ.get('DG_EV_CONNECT_ID')
    DG_EV_USERNAME = os.environ.get('DG_EV_USERNAME')
    DG_EV_PASSWORD = os.environ.get('DG_EV_PASSWORD')
    AWS_S3_BUCKET = 'gfsad30'

    CACHE_TYPE = 'redis'
    REDISCLOUD_URL = 'redis://127.0.0.1:6379'
    CACHE_REDIS_URL = REDISCLOUD_URL
    POSTMARK_API_KEY = 'POSTMARK_API_TEST'

class Testing(Default):
    ENV = 'TESTING'
    DEBUG = True
    TESTING = True

    SECRET_KEY = os.urandom(24)

    # REDIS
    REDISCLOUD_URL = 'redis://127.0.0.1:6379'
    RATELIMIT_STORAGE_URL = 'redis://127.0.0.1:6379'

    # SQL
    SQLALCHEMY_DATABASE_URI = "postgresql://postgres:@localhost:5432/test"

    # SQLALCHEMY_ECHO = True
    CELERY_BROKER_URL = 'redis://127.0.0.1:6379'
    CELERY_ALWAYS_EAGER = False
    AWS_S3_BUCKET = 'gfsad30-test'


class Development(Default):
    ENV = 'DEVELOPMENT'
    DEBUG = True

    SECRET_KEY = os.environ.get('SECRET')

    # REDIS
    REDISCLOUD_URL = 'redis://127.0.0.1:6379'
    RATELIMIT_STORAGE_URL = 'redis://127.0.0.1:6379'

    # SQL
    SQLALCHEMY_DATABASE_URI = os.environ.get('SQLALCHEMY_DATABASE_URI')

    CELERY_BROKER_URL = 'redis://127.0.0.1:6379'
    CELERY_DEFAULT_QUEUE = 'gfsad'


class Production(Default):
    ENV = 'PRODUCTION'

    SECRET_KEY = os.environ.get('SECRET')

    # REDIS
    REDISCLOUD_URL = os.environ.get('REDISCLOUD_URL')
    SQLALCHEMY_DATABASE_URI = os.environ.get('SQLALCHEMY_DATABASE_URI')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    PROPAGATE_EXCEPTIONS = True
    RATELIMIT_STORAGE_URL = os.environ.get('REDISCLOUD_URL')

    CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL')

    CELERY_DEFAULT_QUEUE = 'gfsad'
    CELERYBEAT_SCHEDULE = {
        'build_fusion_tables': {
            'task': 'gfsad.tasks.records.build_fusion_tables',
            'schedule': timedelta(minutes=15),
            'options': {'queue': CELERY_DEFAULT_QUEUE}
        },
        'build_static_records': {
            'task': 'gfsad.tasks.records.build_static_records',
            'schedule': timedelta(minutes=15),
            'options': {'queue': CELERY_DEFAULT_QUEUE}
        },
        'build_classification_results': {
            'task': 'gfsad.tasks.classifications.build_classifications_result',
            'schedule': timedelta(hours=12),
            'options': {'queue': CELERY_DEFAULT_QUEUE}
        },
    }
    CACHE_TYPE = 'redis'
    CACHE_REDIS_URL = REDISCLOUD_URL
    POSTMARK_API_KEY = os.environ.get('POSTMARK_API_KEY')




