from flask.ext.sqlalchemy import SQLAlchemy

# initiate sqlalchemy
db = SQLAlchemy()

# get models
from gfsad.models.user import User
from gfsad.models.location import Location, Photo
from gfsad.models.point import Point
from gfsad.models.record import Record, RecordHistory, RecordRating
from gfsad.models.notification import Notification
from gfsad.models.timeseries import TimeSeries
from gfsad.models.tile import Tile, TileClassification, TileUser