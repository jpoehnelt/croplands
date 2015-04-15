from gfsad.models import db
from sqlalchemy import ForeignKey


class Tile(db.Model):

    __tablename__ = 'tile'

    id = db.Column(db.Integer, primary_key=True)
    feature_id = db.Column(db.String, unique=True, nullable=False)

    center_lat = db.Column(db.Float, nullable=False)
    center_lon = db.Column(db.Float, nullable=False)
    corner_ne_lat = db.Column(db.Float)
    corner_ne_lon = db.Column(db.Float)
    corner_sw_lat = db.Column(db.Float)
    corner_sw_lon = db.Column(db.Float)

    url = db.Column(db.String, nullable=False)
    copyright = db.Column(db.String)
    product_type = db.Column(db.String)

    date_modified = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())
    date_acquired = db.Column(db.DateTime, nullable=False)
    date_acquired_earliest = db.Column(db.DateTime)
    date_acquired_latest = db.Column(db.DateTime)


