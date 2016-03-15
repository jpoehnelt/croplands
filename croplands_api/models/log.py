from croplands_api.models import db
import json


class Log(db.Model):
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
        self.request_data = request.data
        self.request_url = request.url

        self.response_data = response.response[0]
        self.response_status = response.status_code




