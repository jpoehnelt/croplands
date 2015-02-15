import os
from datetime import timedelta

try:
    import secrets
except ImportError:
    pass

DEBUG = False
TESTING = False
CSRF_ENABLED = False
SECRET_KEY = 'this-really-needs-to-be-changed'

# Access Keys
GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY')
GOOGLE_SERVICE_ACCOUNT = os.environ.get('GOOGLE_SERVICE_ACCOUNT')
AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')
AWS_URL_SIGNING_KEY = os.environ.get('AWS_URL_SIGNING_KEY')
POSTMARK_API_KEY = os.environ.get('POSTMARK_API_KEY')

AWS_URL_SIGNING_EXPIRATION_DEFAULT = 60 * 30

JWT_AUTH_URL_RULE = '/auth/l'
JWT_EXPIRATION_DELTA = timedelta(hours=6)

DEFAULT_MAIL_SENDER = 'info@croplands.org'

AUTH_RESET_TOKEN_EXPIRATION = 300
AUTH_REQUIRE_CONFIRMATION = False

REDISCLOUD_URL = os.environ.get('REDISCLOUD_URL')
RATELIMIT_STORAGE_URL = REDISCLOUD_URL

CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL')
CELERY_DEFAULT_QUEUE = 'gfsad'
