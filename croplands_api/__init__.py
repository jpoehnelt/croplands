from flask import Flask, request, g, redirect
from flask.ext.cache import Cache
from flask.ext.compress import Compress
from flask.ext.restless import APIManager
from flask_jwt import JWT
from flask_mail import Mail
from croplands_api.exceptions import FieldError
from flask.ext.celery import Celery
from flask_limiter import Limiter, HEADERS
from flask_limiter.util import get_remote_address
from croplands_api.misc import PostMarkHandler
import logging
from oauth2client.service_account import ServiceAccountCredentials
import ee


class JSONLimiter(Limiter):
    def inject_headers(self, response):
        current_limit = getattr(g, 'view_rate_limit', None)
        if self.enabled and self.headers_enabled and current_limit:
            window_stats = self.limiter.get_window_stats(*current_limit)
            response.headers.add(
                self.header_mapping[HEADERS.LIMIT],
                str(current_limit[0].amount)
            )
            response.headers.add(
                self.header_mapping[HEADERS.REMAINING],
                str(window_stats[1])
            )
            response.headers.add(
                self.header_mapping[HEADERS.RESET],
                str(window_stats[0])
            )
        return response


cache = Cache()
compress = Compress()
limiter = JSONLimiter(headers_enabled=True, global_limits=["1000 per minute"],
                      key_func=get_remote_address)
api = APIManager()
jwt = JWT()
celery = Celery()
mail = Mail()

from croplands_api.models import db, User


def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = request.headers.get(
        'Access-Control-Request-Headers', '*')
    response.headers['Access-Control-Allow-Methods'] = request.headers.get(
        'Access-Control-Request-Method', '')
    # Do nothing for post, patch, delete etc..
    try:
        method = [e for e in request.url_rule.methods][-1]
    except AttributeError:
        # print "add_cors_headers: Attribute Error - " + str(response)
        return response

    if method in ['PUT', 'PATCH', 'DELETE', 'POST', 'OPTIONS']:
        return response

    if response.status_code == 404:
        return response

    # set cache max age
    if 'Cache-Control' in response.headers:
        pass
    elif '/api' in request.url_rule.rule:
        response.headers['Cache-Control'] = 'max-age=120'
    elif '/gee/time_series' in request.url_rule.rule:
        response.headers['Cache-Control'] = 'max-age=4000000'
    elif '/tiles' in request.url_rule.rule:
        response.headers['Cache-Control'] = 'max-age=4000000'
    elif '/stats' in request.url_rule.rule:
        response.headers['Cache-Control'] = 'max-age=300'
    elif '/gee/maps' in request.url_rule.rule:
        response.headers['Cache-Control'] = 'max-age=80000'
    else:
        response.headers['Cache-Control'] = 'max-age=0'

    return response


def create_app(config='Testing'):
    app = Flask(__name__)

    # Configure the flask app
    app.config.from_object("croplands_api.config." + config)

    # initialize all of the extensions
    jwt.init_app(app)
    celery.init_app(app)
    db.init_app(app)
    limiter.init_app(app)
    cache.init_app(app)
    compress.init_app(app)
    mail.init_app(app)
    api.init_app(app, flask_sqlalchemy_db=db)

    # initialize google earth engine
    ee.Initialize(ServiceAccountCredentials._from_parsed_json_keyfile(
        app.config['GOOGLE_SERVICE_ACCOUNT'],
        scopes=app.config['GOOGLE_SERVICE_ACCOUNT_SCOPES']))

    # import and register all of the blueprints
    from croplands_api.views.public import public
    from croplands_api.views.auth import auth
    from croplands_api.views.gee import gee
    from croplands_api.views.aws import aws
    from croplands_api.views.upload import upload
    from croplands_api.views.stats import stats_blueprint
    from croplands_api.views.data import data_blueprint

    app.register_blueprint(public)
    app.register_blueprint(gee)
    app.register_blueprint(aws)
    app.register_blueprint(auth)
    app.register_blueprint(upload)
    app.register_blueprint(stats_blueprint)
    app.register_blueprint(data_blueprint)

    from croplands_api.views.api import init_api

    init_api(app)

    # import and init error handlers
    from croplands_api.views.errors import init_error_handlers

    init_error_handlers(app)

    # cors headers and cache
    app.after_request(add_cors_headers)

    from croplands_api.auth import load_user, is_anonymous
    app.before_request(load_user)

    from croplands_api.utils.log import log

    app.after_request(log)

    @limiter.request_filter
    def registered():
        """
        Removes limit if user is registered and using a token.
        :return:
        """
        return not is_anonymous()

    if 'POSTMARK_API_KEY' in app.config:
        email_handler = PostMarkHandler(api_key=app.config['POSTMARK_API_KEY'])
        email_handler.setLevel(logging.ERROR)
        app.logger.addHandler(email_handler)

    import croplands_api.tasks.high_res_imagery
    import croplands_api.tasks.classifications
    import croplands_api.tasks.reference_data_coverage
    import croplands_api.tasks.records

    return app


if __name__ == "__main__":
    app = create_app()
