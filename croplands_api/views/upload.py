from flask import Blueprint, request, current_app, jsonify
from flask_restless.helpers import to_dict
from flask_jwt import current_user
from werkzeug.utils import secure_filename
from werkzeug.exceptions import BadRequest
from croplands_api.utils.s3 import upload_image
import uuid
import cStringIO
from croplands_api.models.location import Image, db
from croplands_api.auth import is_anonymous

upload = Blueprint('upload', __name__, url_prefix='/upload')


def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in current_app.config['ALLOWED_IMG_EXTENSIONS']


@upload.route('/image', methods=['POST'])
def image_view():
    """
    This view allows users to upload photos of locations from their mobile device.
    """

    # get the accompanying data
    data = request.form

    for field in ['location_id', 'lat', 'lon', 'date_acquired']:
        if field not in data:
            print "missing %s" % field
            raise BadRequest(description='Image requires %s.' % field)


    if 'file' in request.files and request.files['file'] is not None:
        # get the file from the request object
        f = request.files['file']

        # sanitize the file name
        filename = secure_filename(f.filename)

        # check that file type is allowed NAIVE check
        if not allowed_file(filename):
            print "bad file type"
            raise BadRequest('Bad File Type')

        # get file for processing and uploading
        f_io = cStringIO.StringIO()
        f.save(dst=f_io)

        # create key for file
        url = 'images/mobile/' + str(uuid.uuid4()) + '.jpg'

        # upload image to s3 bucket
        upload_image(f_io, encoded_image=False, filename=url)
    elif 'url' in data:
        url = data['url']
    else:
        raise BadRequest(description='Not enough data')



    # save to database
    image = Image(location_id=data['location_id'], lat=data['lat'], lon=data['lon'],
                  url=url,
                  date_acquired=data['date_acquired'])

    # get the user from the token
    if not is_anonymous():
        image.user_id = current_user.id

    if 'source' in data:
        image.source = data['source']

    db.session.add(image)
    db.session.commit()
    return jsonify(to_dict(image)), 201