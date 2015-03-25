from gfsad.models import db
from sqlalchemy import ForeignKey


class Point(db.Model):
    __tablename__ = 'point'
    id = db.Column(db.Integer, primary_key=True)

    location_id = db.Column(db.Integer, ForeignKey('location.id'), index=True, nullable=False)
    date_taken = db.Column(db.DateTime, nullable=False)
    lat = db.Column(db.Float, nullable=False)
    lon = db.Column(db.Float, nullable=False)
    accuracy = db.Column(db.Float)
    heading = db.Column(db.Float)
    speed = db.Column(db.Float)
    altitude = db.Column(db.Float)