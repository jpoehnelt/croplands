import cStringIO
import base64
import boto
from boto.s3.key import Key
from PIL import Image
from flask import current_app
import uuid


def upload_photo(encoded_photo, filename='img/' + str(uuid.uuid4()) + '.JPG', public=True,
                 cache_control='max-age=2000000',
                 content_type='image/jpeg'):
    """
    Uploads a base64 encoded image to amazon s3 bucket.
    :param encoded_photo: base64 encoded image
    :param filename: s3 filename
    :param public: boolean if public
    :param cache_control: http cache-control value
    :param content_type: http content type
    :return:
    """
    # in memory file
    f = cStringIO.StringIO()

    # manipulate with pillow
    img = Image.open(cStringIO.StringIO(base64.b64decode(encoded_photo)))
    img.convert("RGB")
    img.thumbnail((600, 600))
    img.save(f, 'JPEG', quality=60)

    # Connect to S3
    s3 = boto.connect_s3(current_app.config['AWS_ACCESS_KEY_ID'],
                         current_app.config['AWS_SECRET_ACCESS_KEY'])

    # Get bucket
    bucket = s3.get_bucket('gfsad30')

    # create file
    s3_file = Key(bucket)
    s3_file.key = filename  # 'img/' + str(uuid.uuid4()) + '.JPG'
    s3_file.set_metadata('cache-control', cache_control)
    s3_file.set_metadata('content-type', content_type)
    s3_file.set_contents_from_string(f.getvalue())

    if public:
        s3_file.make_public()

    return s3_file


def delete_photo(key):
    """
    Deletes a key (file) from Amazon S3 Bucket
    :param key:
    :return: None
    """
    # Connect to S3
    s3 = boto.connect_s3(current_app.config['AWS_ACCESS_KEY_ID'],
                         current_app.config['AWS_SECRET_ACCESS_KEY'])

    # Get bucket
    bucket = s3.get_bucket('gfsad30')

    s3_file = Key(bucket)

    s3_file.key = key

    bucket.delete_key(s3_file)


