from gfsad.models import db
from sqlalchemy import ForeignKey
from sqlalchemy.orm import relationship


class Tile(db.Model):
    __tablename__ = 'tile'

    id = db.Column(db.Integer, primary_key=True)
    feature_id = db.Column(db.String, nullable=False)
    zoom = db.Column(db.Integer, nullable=False)
    x = db.Column(db.Integer, nullable=False)
    y = db.Column(db.Integer, nullable=False)

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

    classifications = relationship("TileClassification", cascade="all, delete-orphan")

    classifications_count = db.Column(db.Integer)
    classifications_majority_agreement = db.Column(db.Integer)
    classifications_majority_class = db.Column(db.Integer)



class TileClassification(db.Model):
    __tablename__ = 'tile_classification'

    id = db.Column(db.Integer, primary_key=True)
    classification = db.Column(db.Integer, nullable=False)
    date_classified = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())
    tile = db.Column(db.Integer, ForeignKey('tile.id'))
    user_id = db.Column(db.Integer, ForeignKey('user.id'))
    session_id = db.Column(db.String)


class TileUser(db.Model):
    __tablename__ = 'tile_user'

    id = db.Column(db.Integer, primary_key=True)
    date_captured = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())
    ip = db.Column(db.String)
    session_id = db.Column(db.String)
    level = db.Column(db.String)
