from default import *
import os
from datetime import timedelta


TESTING = True
DEBUG = True
SQLALCHEMY_DATABASE_URI = "sqlite://"
POSTMARK_API_KEY = 'POSTMARK_API_TEST'
REDISCLOUD_URL = 'redis://127.0.0.1:6379'
RATELIMIT_STORAGE_URL = 'redis://127.0.0.1:6379'
# SQLALCHEMY_ECHO = True
SECRET_KEY = os.urandom(24)
CELERY_TIMEZONE = 'UTC'
CELERY_BROKER_URL = 'redis://127.0.0.1:6379'
CELERY_ALWAYS_EAGER = False
