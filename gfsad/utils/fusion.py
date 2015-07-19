# coding=utf-8
from flask import current_app
from oauth2client.client import SignedJwtAssertionCredentials
import httplib2
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

FUSION_TABLE_SCOPE = 'https://www.googleapis.com/auth/fusiontables'
FUSION_TABLE_TEST = '1y6rdRvEPXW4r2zXHterHoDrGUVYxnUH_saPMdaCo'


def init_google_service(scope=FUSION_TABLE_SCOPE, name='fusiontables', version='v2'):
    """
    Creates a new API service for interacting with the resource.
    :param scope: string of the url
    :param name: string of the name of the resource
    :param version: string of the version
    :return: service
    """
    print current_app.config['GOOGLE_SERVICE_ACCOUNT'][0:10]
    print current_app.config['GOOGLE_API_KEY'][0:10]

    # Create a new API service for interacting with Fusion Tables
    credentials = SignedJwtAssertionCredentials(current_app.config['GOOGLE_SERVICE_ACCOUNT'],
                                                current_app.config['GOOGLE_API_KEY'], scope)
    return build(name, version, http=credentials.authorize(httplib2.Http()))


def replace_rows(table_id, fd):
    """
    Replaces all rows in a fusion table with the fd of a csv.
    :param table_id: string
    :param fd: file descriptor
    :return: None
    """
    service = init_google_service()

    media_body = MediaIoBaseUpload(fd, mimetype='application/octet-stream')

    return service.table().replaceRows(tableId=table_id, media_body=media_body).execute()


