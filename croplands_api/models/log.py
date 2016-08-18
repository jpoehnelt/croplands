from croplands_api.models import db
from croplands_api.models.base import BaseModel


class Log(BaseModel):
    __tablename__ = 'log'

    id = db.Column(db.Integer, primary_key=True)
    date_created = db.Column(db.DateTime, default=db.func.now())

    # request
    request_url = db.Column(db.String)
    request_method = db.Column(db.String)
    request_data = db.Column(db.String)
    # request_headers = db.Column(db.String)

    # response
    response_data = db.Column(db.String)
    response_status_code = db.Column(db.Integer)
    # response_headers = db.Column(db.String)

    def __init__(self, request, response):
        self.request_method = request.method

        if "/auth" in request.url:
            self.request_data = None
        else:
            self.request_data = request.data

        self.request_url = request.url

        self.response_data = response.response[0]
        self.response_status = response.status_code




