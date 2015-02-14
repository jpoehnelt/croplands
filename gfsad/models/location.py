from gfsad.models import db
from sqlalchemy.orm import relationship
from sqlalchemy import ForeignKey, UniqueConstraint, CheckConstraint


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
    timeseries = relationship("TimeSeries", cascade="all, delete-orphan")
    photos = relationship("Photo", cascade="all, delete-orphan")

    # who
    user_id = db.Column(db.Integer, ForeignKey('user.id'))
    source = db.Column(db.String)

    # where
    lat = db.Column(db.Float, nullable=False)
    lon = db.Column(db.Float, nullable=False)
    country = db.Column(db.Integer)
    continent = db.Column(db.String)
    field = db.Column(db.String)

    # when
    date_created = db.Column(db.DateTime)
    date_edited = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    # use
    use_verification = db.Column(db.Boolean, default=False)
    use_valid = db.Column(db.Boolean, default=False)
    use_deleted = db.Column(db.Boolean, default=False)


class Photo(db.Model):
    __tablename__ = 'photo'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, ForeignKey('user.id'))

    location_id = db.Column(db.Integer, ForeignKey('location.id'), index=True, nullable=False)
    url = db.Column(db.String, nullable=False)
    date_taken = db.Column(db.DateTime, nullable=False)
    comments = db.Column(db.String)
    date_uploaded = db.Column(db.DateTime, default=db.func.now())
    flagged = db.Column(db.Integer, default=0)
    source = db.Column(db.String)
