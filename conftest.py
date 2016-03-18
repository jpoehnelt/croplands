# -*- coding: utf-8 -*-
"""
    tests.conftest
    ~~~~~~~~~~~~~~

    Test fixtures and what not
"""

from croplands_api import create_app, db
from croplands_api.models import User
from croplands_api.auth import make_jwt
import pytest
import uuid


@pytest.fixture(scope='function')
def app():
    _app = create_app()

    # Establish an application context before running the tests.
    ctx = _app.app_context()
    ctx.push()

    def teardown():
        ctx.pop()

    return _app


@pytest.fixture(scope='function')
def client(app):
    return app.test_client()


@pytest.fixture(scope='function')
def db_init(app):
    with app.app_context():
        db.create_all()

    def tearDown():
        with app.app_context():
            db.session.remove()
            db.drop_all()

    return db


@pytest.fixture(scope='function')
def request_jwt(user):
    if user is None:
        return {}
    return {'Authorization': 'bearer ' + make_jwt(user)}


@pytest.fixture(scope='function')
def request_ctx(app, request_jwt):
    headers = request_jwt
    return app.test_request_context("/", headers=headers)


@pytest.fixture(scope='function', params=User.ROLES + [None])
def user(db_init, app, request):
    if request is None:
        u = None
    else:
        u = User.create(email=str(uuid.uuid4()) + '@test.com', password='password', first='first',
                        last='last', role=str(request), organization="USGS")

    def tearDown():
        if u is not None:
            db.session.delete(u)
            db.session.commit()

    return u
