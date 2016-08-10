from croplands_api.models import db
import uuid


class BaseModel(db.Model):
    __abstract__ = True

    def get_topic(self):
        return str(uuid.uuid4()).replace("-", "")

    def message(self, subject, body):
        from croplands_api.models.subscription import Message
        m = Message(subject=subject, body=body, topic=self.topic)
        db.session.add(m)
        db.session.commit()

        # auto publish message
        m.publish()

    def save(self):
        db.session.add(self)
        db.session.commit()
