from croplands_api.models import db
import uuid


class BaseModel(db.Model):
    __abstract__ = True

    def get_topic(self):
        return str(uuid.uuid4()).replace("-", "")

    def save(self):
        db.session.add(self)
        db.session.commit()
