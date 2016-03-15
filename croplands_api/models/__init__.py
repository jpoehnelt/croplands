from flask.ext.sqlalchemy import SQLAlchemy

# initiate sqlalchemy
db = SQLAlchemy()

# get models
from croplands_api.models.user import User
from croplands_api.models.location import Location, Image, ImageClassification, ImageClassificationProvider
from croplands_api.models.point import Point
from croplands_api.models.record import Record, RecordHistory, RecordRating
