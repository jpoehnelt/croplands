import os
from datetime import timedelta
import base64
from flask import json

try:
    import secrets
except ImportError:
    pass


class Default(object):
    ENV = 'DEFAULT'

    # Google
    GOOGLE_SERVICE_ACCOUNT = json.loads(base64.b64decode(os.environ.get('GOOGLE_SERVICE_ACCOUNT_ENC')).decode('utf-8'))
    GOOGLE_SERVICE_ACCOUNT_SCOPES = ['https://www.googleapis.com/auth/fusiontables',
                                     'https://www.googleapis.com/auth/earthengine']

    # Amazon
    AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')
    AWS_URL_SIGNING_KEY = os.environ.get('AWS_URL_SIGNING_KEY')
    AWS_URL_SIGNING_EXPIRATION_DEFAULT = 60 * 60
    BUCKET = 'croplands-public'
    GS_ACCESS_KEY = os.environ.get("GS_ACCESS_KEY")
    GS_SECRET = os.environ.get("GS_SECRET")

    # Auth and JWT Settings
    JWT_AUTH_URL_RULE = '/auth/l'
    JWT_EXPIRATION_DELTA = timedelta(days=150)
    AUTH_RESET_TOKEN_EXPIRATION = 300
    AUTH_REQUIRE_CONFIRMATION = False

    # Redis, Cache Etc.
    CACHE_TYPE = 'redis'
    REDIS_URL = 'redis://127.0.0.1:6379'
    CACHE_REDIS_URL = REDIS_URL
    RATELIMIT_STORAGE_URL = REDIS_URL

    # Celery and Tasks
    CELERY_TIMEZONE = 'UTC'
    CELERY_ENABLE_UTC = True
    CELERY_BROKER_URL = REDIS_URL

    # Database
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Mail
    POSTMARK_API_KEY = 'POSTMARK_API_TEST'
    DEFAULT_MAIL_SENDER = 'info@croplands.org'

    # Digital Globe
    DG_EV_CONNECT_ID = os.environ.get('DG_EV_CONNECT_ID')
    DG_EV_USERNAME = os.environ.get('DG_EV_USERNAME')
    DG_EV_PASSWORD = os.environ.get('DG_EV_PASSWORD')

    # Misc
    ALLOWED_IMG_EXTENSIONS = ['jpg', 'png']
    SECRET_KEY = os.urandom(24)
    CSRF_ENABLED = False
    DATA_DOWNLOAD_LINK_EXPIRATION = 60*5
    DATA_DOWNLOAD_MAX_PAGE_SIZE = 50000
    DATA_QUERY_DELAY = timedelta(0)  # how long until data is publicly available


class Testing(Default):
    ENV = 'TESTING'
    DEBUG = True
    TESTING = True

    # Amazon
    BUCKET = 'croplands-test'

    # Celery and Tasks
    CELERY_ALWAYS_EAGER = False

    # Database
    SQLALCHEMY_DATABASE_URI = "postgresql://postgres:@localhost:5432/croplands_test"

    # Misc
    ALLOWED_IMG_EXTENSIONS = ['jpg', 'png']
    SECRET_KEY = 'not-a-secret'


class Development(Default):
    ENV = 'DEVELOPMENT'
    DEBUG = True

    # Amazon
    AWS_S3_BUCKET = 'gfsad30-test'

    # Celery and Tasks
    CELERY_DEFAULT_QUEUE = 'croplands_api_dev'

    # Database
    SQLALCHEMY_DATABASE_URI = os.environ.get('SQLALCHEMY_DATABASE_DEV_URI')

    # Mail
    POSTMARK_API_KEY = os.environ.get('POSTMARK_API_KEY')

    # Misc
    SECRET_KEY = os.environ.get('SECRET', Default.SECRET_KEY)


class Production(Development):
    ENV = 'PRODUCTION'

    # Amazon
    AWS_S3_BUCKET = 'gfsad30'

    # Redis, Cache Etc.
    CACHE_TYPE = 'redis'
    REDIS_URL = os.environ.get('REDIS_URL')
    CACHE_REDIS_URL = REDIS_URL
    RATELIMIT_STORAGE_URL = REDIS_URL
    CELERY_BROKER_URL = REDIS_URL

    # Database
    SQLALCHEMY_DATABASE_URI = os.environ.get('SQLALCHEMY_DATABASE_URI')
    PROPAGATE_EXCEPTIONS = True

    # Celery and Tasks
    CELERY_DEFAULT_QUEUE = 'croplands_api'
    CELERYBEAT_SCHEDULE = {
        'build_fusion_tables': {
            'task': 'croplands_api.tasks.records.build_fusion_tables',
            'schedule': timedelta(hours=3),
            'options': {'queue': CELERY_DEFAULT_QUEUE}
        },
        'build_classification_results': {
            'task': 'croplands_api.tasks.classifications.build_classifications_result',
            'schedule': timedelta(minutes=30),
            'options': {'queue': CELERY_DEFAULT_QUEUE}
        },
        'build_data_coverage': {
            'task': 'croplands_api.tasks.reference_data_coverage.reference_data_coverage_task',
            'schedule': timedelta(days=1),
            'options': {'queue': CELERY_DEFAULT_QUEUE}
        },
    }
