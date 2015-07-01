from gfsad.models import db
from sqlalchemy.orm import relationship
from sqlalchemy import ForeignKey, UniqueConstraint, CheckConstraint
import random

class Location(db.Model):
    """
    Stores a location.
    """
    __tablename__ = 'location'
    __table_args__ = (UniqueConstraint('lat', 'lon', name='one_location_at_each_lat_lon_pair'),
                      CheckConstraint('lat Between -90 and 90', name='lat_bounds'),
                      CheckConstraint('lon Between -180 and 180', name='lon_bounds'),)

    # id
    id = db.Column(db.Integer, primary_key=True)
    source_id = db.Column(db.Integer)
    version = db.Column(db.Integer, default=0)

    # relationships
    records = relationship("Record", cascade="all, delete-orphan")
    points = relationship("Point", cascade="all, delete-orphan")
    timeseries = relationship("TimeSeries", cascade="all, delete-orphan")
    images = relationship("Image", cascade="all, delete-orphan")

    # who
    user_id = db.Column(db.Integer, ForeignKey('user.id'))
    source = db.Column(db.String)

    # where
    lat = db.Column(db.Float, nullable=False)
    lon = db.Column(db.Float, nullable=False)

    #offset
    bearing = db.Column(db.Float, default=-1) # bearing from lat lon to center of field from lat lon
    distance = db.Column(db.Integer) # distance along bearing to center of field from lat lon
    accuracy = db.Column(db.Integer)

    country = db.Column(db.Integer)
    continent = db.Column(db.String)
    field = db.Column(db.String)

    # when
    date_created = db.Column(db.DateTime, default=db.func.now())
    date_edited = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    # use
    use_verification = db.Column(db.Boolean, default=False, index=True)
    use_verification_locked = db.Column(db.Boolean, default=False, index=True)
    use_valid = db.Column(db.Boolean, default=False, index=True)
    use_deleted = db.Column(db.Boolean, default=False)

    def __init__(self, *args, **kwargs):
        super(Location, self).__init__(*args, **kwargs)

        if 'use_verification' not in kwargs and 'use_verification_locked' not in kwargs:
            self.use_verification = random.choice([True, False])
            if self.use_verification:
                self.use_verification_locked = random.choice([True, False])




class Image(db.Model):
    __tablename__ = 'image'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, ForeignKey('user.id'))

    location_id = db.Column(db.Integer, ForeignKey('location.id'), index=True, nullable=False)
    source = db.Column(db.String)
    comments = db.Column(db.String)

    bearing = db.Column(db.Integer, default=-1)

    lat = db.Column(db.Float, nullable=False, index=True)
    lon = db.Column(db.Float, nullable=False, index=True)

    corner_ne_lat = db.Column(db.Float)
    corner_ne_lon = db.Column(db.Float)
    corner_sw_lat = db.Column(db.Float)
    corner_sw_lon = db.Column(db.Float)

    url = db.Column(db.String, unique=True, nullable=False)
    copyright = db.Column(db.String)
    image_type = db.Column(db.String, index=True)

    date_modified = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())
    date_uploaded = db.Column(db.DateTime, default=db.func.now())
    date_acquired = db.Column(db.DateTime, nullable=False, index=True)
    date_acquired_earliest = db.Column(db.DateTime)
    date_acquired_latest = db.Column(db.DateTime)

    classifications_priority = db.Column(db.Integer, default=0)
    classifications = relationship("ImageClassification", cascade="all, delete-orphan")
    classifications_count = db.Column(db.Integer, index=True, default=0)
    classifications_majority_agreement = db.Column(db.Integer, index=True, default=0)
    classifications_majority_class = db.Column(db.Integer, index=True, default=0)

    location = relationship("Location")

    flagged = db.Column(db.Integer, default=0)


class ImageClassification(db.Model):
    __tablename__ = 'image_classification'

    id = db.Column(db.Integer, primary_key=True)
    classification = db.Column(db.Integer, nullable=False)
    date_classified = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())
    image = db.Column(db.Integer, ForeignKey('image.id'))
    user = db.Column(db.Integer, ForeignKey('user.id'))
    ip = db.Column(db.String, nullable=False)


class ImageClassificationProvider(db.Model):
    __tablename__ = 'image_classification_user'

    id = db.Column(db.Integer, primary_key=True)
    date_captured = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())
    ip = db.Column(db.String, nullable=False)
    level = db.Column(db.String) # self declared expertise level