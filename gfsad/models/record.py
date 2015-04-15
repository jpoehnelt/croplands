from gfsad.models import db
from sqlalchemy.orm import relationship
from sqlalchemy import ForeignKey, UniqueConstraint, CheckConstraint
import random
from sqlalchemy.dialects import postgresql


class Record(db.Model):
    """
    This is the essential data of the application.
    Stores information relating to a specific time and place.
    """
    __tablename__ = 'record'
    __table_args__ = (
        UniqueConstraint('year', 'location_id', 'month', name='one_year_per_location'),
    )

    # required id column
    id = db.Column(db.Integer, primary_key=True)

    protected = db.Column(db.Boolean, default=False)
    validation = db.Column(db.Boolean, default=lambda: random.choice([True, False]))

    # foreign keys
    user_id = db.Column(db.Integer, ForeignKey('user.id'))
    location_id = db.Column(db.Integer, ForeignKey('location.id'), index=True, nullable=False)

    # when - no more granularity than month needed
    year = db.Column(db.Integer, nullable=False, index=True)
    month = db.Column(db.Integer, index=True)

    #
    date_created = db.Column(db.DateTime, default=db.func.now())
    date_updated = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    # fields that vary by year
    land_use_type = db.Column(db.Integer, default=0)
    intensity = db.Column(db.Integer, default=0)
    water = db.Column(db.Integer, default=0)

    # crop types
    crop_primary = db.Column(db.Integer, default=0)
    crop_secondary = db.Column(db.Integer, default=0)

    # calculated rating that is periodically updated
    rating = db.Column(db.Integer, default=0)

    ndvi_modis = db.Column(postgresql.ARRAY(db.Integer),
                           default=[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                                    0, 0])
    # sub models
    history = relationship("RecordHistory", cascade="all, delete-orphan")
    ratings = relationship("RecordRating", cascade="all, delete-orphan")


class RecordHistory(db.Model):
    """
    This model tracks the state of a record and is created when a record is created or updated.
    """
    __tablename__ = 'record_history'

    id = db.Column(db.Integer, primary_key=True)

    # foreign keys
    user_id = db.Column(db.Integer, ForeignKey('user.id'))
    record_id = db.Column(db.Integer, ForeignKey('record.id'), index=True, nullable=False)

    # when
    date_edited = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    # what
    data = db.Column(db.String, nullable=False)


class RecordRating(db.Model):
    __tablename__ = 'record_rating'
    __table_args__ = (
        UniqueConstraint('user_id', 'record_id', name='one_rating_per_record_per_user'),
    )

    id = db.Column(db.Integer, primary_key=True)

    # foreign keys
    user_id = db.Column(db.Integer, ForeignKey('user.id'))
    record_id = db.Column(db.Integer, ForeignKey('record.id'), index=True, nullable=False)

    # when
    date_rated = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    # public:  -1 to 1
    # partner: -5 to 5
    # team: -10 to 10
    rating = db.Column(db.Integer, nullable=False)
    stale = db.Column(db.BOOLEAN, default=False)