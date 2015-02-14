# from default import *
import os
from datetime import timedelta


TESTING = True
DEBUG = True
SQLALCHEMY_DATABASE_URI = "sqlite://"
CELERY_DEFAULT_QUEUE = 'gfsad-testing'
POSTMARK_API_KEY = 'POSTMARK_API_TEST'
REDISCLOUD_URL = 'redis://127.0.0.1:6379'
RATELIMIT_STORAGE_URL = 'redis://127.0.0.1:6379'
# SQLALCHEMY_ECHO = True
SECRET_KEY = os.urandom(24)
CELERY_TIMEZONE = 'UTC'
CELERY_BROKER_URL = 'amqp://guest:guest@localhost:5672//'

AWS_URL_SIGNING_EXPIRATION_DEFAULT = 60 * 30

JWT_AUTH_URL_RULE = '/auth/l'
JWT_EXPIRATION_DELTA = timedelta(hours=6)

DEFAULT_MAIL_SENDER = 'info@croplands.org'

AUTH_RESET_TOKEN_EXPIRATION = 300
AUTH_REQUIRE_CONFIRMATION = False