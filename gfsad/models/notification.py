from gfsad.models import db
from sqlalchemy import ForeignKey



class Notification(db.Model):
    __tablename__ = 'notification'

    id = db.Column(db.Integer, primary_key=True)
    last_updated = db.Column(db.DateTime, default=db.func.now())
    last_read = db.Column(db.DateTime)
    read = db.Column(db.Boolean, default=False, index=True)

    subject = db.Column(db.String)
    message = db.Column(db.String)

    user_id = db.Column(db.Integer, ForeignKey('user.id'), index=True)
    record_id = db.Column(db.Integer, ForeignKey('record.id'))
    location_id = db.Column(db.Integer, ForeignKey('location.id'))

    def __str__(self):
        return self.subject