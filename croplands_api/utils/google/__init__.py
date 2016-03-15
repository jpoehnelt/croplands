from flask import current_app
from oauth2client.service_account import ServiceAccountCredentials
from googleapiclient.discovery import build
import httplib2


def build_service(name, version, credentials=None):
    if credentials is None:
        credentials = ServiceAccountCredentials._from_parsed_json_keyfile(
            current_app.config['GOOGLE_SERVICE_ACCOUNT'],
            scopes=current_app.config['GOOGLE_SERVICE_ACCOUNT_SCOPES'])

    http = credentials.authorize(httplib2.Http())

    return build(name, version, http=http)