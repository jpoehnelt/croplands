from croplands_api.exceptions import FieldError, UserError, Unauthorized, InvalidLocation, TileNotFound
from croplands_api.views.json_response import JSONResponse
from itsdangerous import SignatureExpired, BadSignature
from flask import render_template, request, jsonify, Response
from werkzeug.exceptions import BadRequest


def init_error_handlers(app):
    @app.errorhandler(FieldError)
    def handle_field_error(e):
        if hasattr(e, 'description'):
            description = e.description
        else:
            description = ""
        return JSONResponse(status_code=400, description=description,
                            error='Bad request')

    @app.errorhandler(UserError)
    def handle_user_error(e):
        return JSONResponse(**e.__dict__)

    @app.errorhandler(429)
    def rate_limit_handler(e):
        return JSONResponse(status_code=429, error='Exceeded Rate Limit',
                            description='Slow Down! ' + str(e.description))

    @app.errorhandler(SignatureExpired)
    def signature_expired(e):
        return JSONResponse(status_code=401, description='Token is expired.')

    @app.errorhandler(BadSignature)
    def signature_expired(e):
        print e.__dict__
        return JSONResponse(status_code=400, error='Bad Signature',
                            description='Your token is not valid.')

    @app.errorhandler(Unauthorized)
    def unauthorized_handler(e):
        return JSONResponse(status_code=401, error='Unauthorized', description=e.description)

    @app.errorhandler(InvalidLocation)
    def invalid_location_handler(e):
        return JSONResponse(**e.__dict__)

    @app.errorhandler(404)
    def not_found(error):
        response = jsonify({'code': 404, 'message': 'No resource.'})
        response.status_code = 404
        return response

    @app.errorhandler(BadRequest)
    def bad_request(error):
        return JSONResponse(status_code=error.code, error='Bad Request',
                            description=error.description)

    @app.errorhandler(TileNotFound)
    def no_tile(error):
        return Response(status=404, content_type='image/png')
