from flask import Blueprint, jsonify, current_app
from boto.cloudfront.distribution import Distribution
import time
from croplands_api import cache

AWS_URL_SIGNING_EXPIRATION_DEFAULT = 3600

# create blueprint to separate scope
aws = Blueprint('aws', __name__, url_prefix='/aws')

def create_url_params(expires=None):
    dist = Distribution()
    if expires is None:
        expires = int(time.time() + AWS_URL_SIGNING_EXPIRATION_DEFAULT)
    return dist.create_signed_url('', current_app.config['AWS_ACCESS_KEY_ID'], expire_time=expires,
                                  private_key_string=current_app.config['AWS_URL_SIGNING_KEY'], policy_url='http*://cdn.croplands.org/*')


@aws.route('/policy', methods=['POST'])
@cache.cached(timeout=AWS_URL_SIGNING_EXPIRATION_DEFAULT - 100)
def policy():
    expires = int(time.time() + current_app.config['AWS_URL_SIGNING_EXPIRATION_DEFAULT'])
    params = create_url_params()
    return jsonify({'expires': expires, 'params': params})

