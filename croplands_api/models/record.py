from werkzeug.exceptions import BadRequest
from croplands_api.models import db
from croplands_api.models.base import BaseModel
from sqlalchemy.orm import relationship, foreign
from sqlalchemy import ForeignKey, UniqueConstraint, CheckConstraint, and_, func, event
from sqlalchemy.dialects import postgresql
from location import Image
from hashlib import sha256


class Record(BaseModel):
    """
    This is the essential data of the application.
    Stores information relating to a specific time and place.
    """
    __tablename__ = 'record'
    __table_args__ = (
        UniqueConstraint('year', 'location_id', 'month', name='one_year_per_location'),
    )

    location = relationship("Location")

    # required id column
    id = db.Column(db.Integer, primary_key=True)
    protected = db.Column(db.Boolean, default=False)

    # foreign keys
    user_id = db.Column(db.Integer, ForeignKey('users.id'))
    location_id = db.Column(db.Integer, ForeignKey('location.id'), index=True, nullable=False)

    # when - no more granularity than month needed
    year = db.Column(db.Integer, nullable=False, index=True)
    month = db.Column(db.Integer, index=True)

    images = relationship("Image", primaryjoin=and_(location_id == Image.location_id,
                                                    year == func.extract('year',
                                                                         Image.date_acquired)),
                          foreign_keys=Image.location_id)

    date_created = db.Column(db.DateTime, default=db.func.now(), index=True)
    date_updated = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    SOURCE_TYPE_CHOICES = ['ground', 'derived', 'unknown', 'streetview']
    source_id = db.Column(db.String)
    source_type = db.Column(db.String, nullable=False)
    source_description = db.Column(db.String)
    source_class = db.Column(db.String, index=True)

    # time series ndvi element for each month
    ndvi = db.Column(postgresql.ARRAY(db.Integer))
    ndvi_mean = db.Column(db.Integer, index=True)

    # fields that vary by year
    land_use_type = db.Column(db.Integer, default=0, index=True)
    intensity = db.Column(db.Integer, default=0, index=True)
    water = db.Column(db.Integer, default=0, index=True)

    # crop types and coverage
    crop_primary = db.Column(db.Integer, default=0, index=True)
    crop_secondary = db.Column(db.Integer, default=0, index=True)
    crop_tertiary = db.Column(db.Integer, default=0, index=True)

    crop_primary_coverage = db.Column(db.Integer)
    crop_secondary_coverage = db.Column(db.Integer)
    crop_tertiary_coverage = db.Column(db.Integer)

    # calculated rating that is periodically updated
    rating = db.Column(db.Integer, default=0, index=True)

    scale = db.Column(db.Integer, default=-1)

    # sub models
    history = relationship("RecordHistory", cascade="all, delete-orphan")
    ratings = relationship("RecordRating", cascade="all, delete-orphan")

    def __init__(self, *args, **kwargs):
        if 'source_type' not in kwargs:
            kwargs['source_type'] = 'unknown'
        if kwargs['source_type'] not in Record.SOURCE_TYPE_CHOICES:
            raise BadRequest(description='Valid options for source_type include: ' + str(
                Record.SOURCE_TYPE_CHOICES))
        super(Record, self).__init__(*args, **kwargs)


class RecordHistory(BaseModel):
    """
    This model tracks the state of a record and is created when a record is created or updated.
    """
    __tablename__ = 'record_history'

    id = db.Column(db.Integer, primary_key=True)

    # foreign keys
    user_id = db.Column(db.Integer, ForeignKey('users.id'))
    record_id = db.Column(db.Integer, ForeignKey('record.id'), index=True, nullable=False)

    # when
    date_edited = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    # what
    data = db.Column(db.String, nullable=False)


class RecordRating(BaseModel):
    __tablename__ = 'record_rating'
    __table_args__ = (
        UniqueConstraint('user_id', 'record_id', name='one_rating_per_record_per_user'),
    )

    id = db.Column(db.Integer, primary_key=True)

    # foreign keys
    user_id = db.Column(db.Integer, ForeignKey('users.id'), index=True, nullable=False)
    record_id = db.Column(db.Integer, ForeignKey('record.id'), index=True, nullable=False)

    # when
    date_rated = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    # public:  -1 to 1
    # partner: -5 to 5
    # team: -10 to 10
    rating = db.Column(db.Integer, nullable=False)
    stale = db.Column(db.BOOLEAN, default=False)