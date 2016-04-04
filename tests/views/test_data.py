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
