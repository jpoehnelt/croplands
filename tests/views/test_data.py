from flask import request
import json
from croplands_api import cache
from croplands_api.auth import decode_token, make_jwt, load_user, allowed_roles
from croplands_api.views.data import get_meta, get_filters
import time


def test_get_meta(request_ctx):
    with request_ctx:
        meta = get_meta()

    assert meta['limit'] == 1000
    assert meta['offset'] == 0
    assert meta['order_by'] == 'id'
    assert meta['order_by_direction'] == 'desc'


def test_get_filters_use_validation(request_ctx):
    with request_ctx:
        filters = get_filters()
        if allowed_roles(['validation', 'admin']):
            assert filters['use_validation'] == [False, True]
        else:
            assert filters['use_validation'] == [False]


def test_link(client):
    r = client.get('/data/link')

    assert r.status_code == 200

    data = json.loads(r.data)

    assert 'token' in data
    assert 'search' in data


def test_link_maximum_page_size(client, app):
    params = {"page_size": app.config['DATA_DOWNLOAD_MAX_PAGE_SIZE'] + 5}
    r = client.get('/data/link', query_string=params)
    search = json.loads(r.data)['search']

    assert 'meta' in search
    assert search['meta']['page_size'] == app.config['DATA_DOWNLOAD_MAX_PAGE_SIZE']


def test_link_token(client, app):
    r = client.get('/data/link')
    token = json.loads(r.data)['token']
    key = decode_token(token, app.config.get("SECRET_KEY"))
    search = cache.get(key)

    assert search is not None
    assert 'filters' in search
    assert 'meta' in search


def test_link_token_expiration(client, app):
    r = client.get('/data/link')
    token = json.loads(r.data)['token']
    d = client.get('/data/download', query_string={"token": token})

    assert d.status_code == 200

    app.config['DATA_DOWNLOAD_LINK_EXPIRATION'] = 0
    time.sleep(1)
    d = client.get('/data/download', query_string={"token": token})

    assert d.status_code == 401


def test_download(client):
    r = client.get('/data/link')
    token = json.loads(r.data)['token']
    r = client.get('/data/download', query_string={"token": token})

    assert r.status_code == 200
