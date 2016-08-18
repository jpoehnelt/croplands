from croplands_api.models import db
from croplands_api.models.base import BaseModel
from croplands_api.utils.geo import get_destination
from sqlalchemy.orm import relationship
from sqlalchemy import ForeignKey, UniqueConstraint, CheckConstraint
from sqlalchemy.sql import text
import random


class Location(BaseModel):
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
    images = relationship("Image", cascade="all, delete-orphan")

    # who
    user_id = db.Column(db.Integer, ForeignKey('users.id'))
    source = db.Column(db.String)

    # where
    lat = db.Column(db.Float, nullable=False, index=True)
    lon = db.Column(db.Float, nullable=False, index=True)

    original_lat = db.Column(db.Float, nullable=False)
    original_lon = db.Column(db.Float, nullable=False)

    # offset
    # bearing from lat lon to center of field from lat lon
    bearing = db.Column(db.Float, default=-1)
    distance = db.Column(db.Integer)  # distance along bearing to center of field from lat lon
    accuracy = db.Column(db.Integer)

    country = db.Column(db.String)
    continent = db.Column(db.String)
    field = db.Column(db.String)

    # when
    date_created = db.Column(db.DateTime, default=db.func.now())
    date_edited = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    # use
    use_validation = db.Column(db.Boolean, default=False, index=True)
    use_validation_locked = db.Column(db.Boolean, default=False, index=True)
    use_private = db.Column(db.Boolean, default=False, index=True)
    use_deleted = db.Column(db.Boolean, default=False, index=True)
    use_invalid = db.Column(db.Boolean, default=False, index=True)
    use_invalid_reason = db.Column(db.String)

    def __init__(self, *args, **kwargs):
        # convert to float if str
        self.lat = float(kwargs['lat'])
        self.lon = float(kwargs['lon'])

        self.original_lat = self.lat
        self.original_lon = self.lon

        assert abs(self.lat) < 90, 'lat exceeds bounds'
        assert abs(self.lon) < 180, 'lon exceeds bounds'

        super(Location, self).__init__(*args, **kwargs)

        if self.bearing is not None and self.bearing != -1 and self.distance is not None and self.distance > 0:
            self.offset(self.bearing, self.distance)

        if 'use_validation' not in kwargs and 'use_validation_locked' not in kwargs:
            self.use_validation = random.choice([True, False, False])
            if self.use_validation:
                self.use_validation_locked = random.choice([True, False])

        self.check_neighbor_use()
        # self.check_neighbor_field()

    def check_neighbor_use(self, threshold=1000):
        """
        Requires nearby samples to be used either for validation or training and not both.

        First finds all nearby samples within a specific radius.

        Next it determines the use of its neighbors. If there is no single use but a mix of uses,
        do not accept the sample and review at a later time. If there is a single use, reassign
        the current sample to the same use.

        Finally clean up the validation_locked setting if necessary.

        If failure to find single use, mark as invalid to trigger later review.

        :param threshold: Integer in meters
        :return: None
        """
        assert threshold > 0
        assert isinstance(self.lat, (int, long, float)), 'lat not number'
        assert isinstance(self.lon, (int, long, float)), 'lon not number'

        # get nearby locations to this location
        nearby_locations = Location.within(self.lat, self.lon, threshold)

        # if there are nearby locations
        if len(nearby_locations) > 0:
            use_validation = 0
            use_training = 0

            # get neighbors use
            for location in nearby_locations:

                # don't worry about these locations
                if location.use_invalid or location.use_deleted:
                    continue

                if location.use_validation:
                    use_validation += 1
                else:
                    use_training += 1

            # check if there is a mix of uses nearby
            if abs(use_training - use_validation) == len(nearby_locations):
                # apply the use to this sample
                self.use_validation = use_validation > use_training

                # after change clear validation_locked if use is for training
                if not self.use_validation:
                    self.use_validation_locked = False

            # else if not all one use mark it as invalid
            # todo what is the best way to handle this? send message for review
            else:
                self.use_invalid = True
                self.use_invalid_reason = '[Neighbor sample use is mix of training and validation]'

    def check_neighbor_field(self, meters=100):
        # get nearby locations to this location
        nearby_locations = Location.within(self.lat, self.lon, meters)

        # if there are nearby locations
        if len(nearby_locations) > 0:
            self.use_invalid = True
            if self.use_invalid_reason is None:
                self.use_invalid_reason = '[Same field as another location]'
            else:
                self.use_invalid_reason += '[Same field as another location]'


    @classmethod
    def within(cls, lat, lon, meters):
        """
        Finds all samples within a radius of x meters from lat lon pair.
        :param lat:
        :param lon:
        :param meters:
        :return:
        """
        assert isinstance(meters, (int, long, float)), 'lat not number'
        assert isinstance(lat, (int, long, float)), 'lat not number'
        assert isinstance(lon, (int, long, float)), 'lon not number'
        assert meters > 0
        assert abs(lat) < 90, 'lat exceeds bounds'
        assert abs(lon) < 180, 'lon exceeds bounds'

        # TODO paramterize
        sql = "select * from (SELECT * FROM location WHERE abs(lon - %f) < %f and abs(lat - %f) < %f) as pt where st_distance_sphere(st_makepoint(pt.lon, pt.lat), st_makepoint(%f,%f)) " % (
        float(lon), 0.1, float(lat), 0.1, float(lon), float(lat))
        sql += "< %d " % meters

        return db.session.query(Location).from_statement(text(sql)).all()

    def offset(self, bearing, meters):
        """
        Offsets the location to center of area.
        :param bearing: direction float
        :param meters: distance int
        :return: None
        """
        km = float(meters) / 1000.0

        self.lat, self.lon = get_destination(self.lat, self.lon, bearing, km)


class Image(BaseModel):
    __tablename__ = 'image'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, ForeignKey('users.id'))

    location_id = db.Column(db.Integer, ForeignKey('location.id'), index=True, nullable=False)
    source = db.Column(db.String)
    source_description = db.Column(db.String)
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


class ImageClassification(BaseModel):
    __tablename__ = 'image_classification'

    id = db.Column(db.Integer, primary_key=True)
    classification = db.Column(db.Integer, nullable=False)
    date_classified = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())
    image = db.Column(db.Integer, ForeignKey('image.id'))
    user_id = db.Column(db.Integer, ForeignKey('users.id'))
    ip = db.Column(db.String, nullable=False)


class ImageClassificationProvider(BaseModel):
    __tablename__ = 'image_classification_user'

    id = db.Column(db.Integer, primary_key=True)
    date_captured = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())
    ip = db.Column(db.String, nullable=False)
    level = db.Column(db.String)  # self declared expertise level