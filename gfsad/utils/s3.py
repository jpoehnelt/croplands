import cStringIO
import base64
import boto
from boto.s3.key import Key
from PIL import Image
from flask import current_app
import uuid
import StringIO
import gzip


def upload_image(encoded_image, filename='img/' + str(uuid.uuid4()) + '.JPG', public=True,
                 cache_control='max-age=2000000',
                 content_type='image/jpeg'):
    """
    Uploads a base64 encoded image to amazon s3 bucket.
    :param encoded_image: base64 encoded image
    :param filename: s3 filename
    :param public: boolean if public
    :param cache_control: http cache-control value
    :param content_type: http content type
    :return:
    """
    # in memory file
    f = cStringIO.StringIO()

    # manipulate with pillow
    img = Image.open(cStringIO.StringIO(base64.b64decode(encoded_image)))
    img.convert("RGB")
    img.thumbnail((600, 600))
    img.save(f, 'JPEG', quality=60)

    # Connect to S3
    s3 = boto.connect_s3(current_app.config['AWS_ACCESS_KEY_ID'],
                         current_app.config['AWS_SECRET_ACCESS_KEY'])

    # Get bucket
    bucket = s3.get_bucket(current_app.config['AWS_S3_BUCKET'])

    # create file
    s3_file = Key(bucket)
    s3_file.key = filename  # 'img/' + str(uuid.uuid4()) + '.JPG'
    s3_file.set_metadata('cache-control', cache_control)
    s3_file.set_metadata('content-type', content_type)
    s3_file.set_contents_from_string(f.getvalue())

    if public:
        s3_file.make_public()

    return s3_file


def delete_image(key):
    """
    Deletes a key (file) from Amazon S3 Bucket
    :param key:
    :return: None
    """
    # Connect to S3
    s3 = boto.connect_s3(current_app.config['AWS_ACCESS_KEY_ID'],
                         current_app.config['AWS_SECRET_ACCESS_KEY'])

    # Get bucket
    bucket = s3.get_bucket(current_app.config['AWS_S3_BUCKET'])

    s3_file = Key(bucket)

    s3_file.key = key

    bucket.delete_key(s3_file)


def upload_file_to_s3(contents, key, content_type, do_gzip=True, max_age=300, public=True):
    """ Puts a file in s3
    :param contents: must be string
    :param key: string filename to use
    :param content_type:
    :param do_gzip: boolean
    :param max_age: int for cache max age
    :param public: boolean
    :return:
    """

    # fake a file for gzip
    out = StringIO.StringIO()

    if do_gzip:
        with gzip.GzipFile(fileobj=out, mode="w") as outfile:
            outfile.write(contents)
    else:
        out.write(contents)

    # Connect to S3
    s3 = boto.connect_s3(current_app.config['AWS_ACCESS_KEY_ID'],
                         current_app.config['AWS_SECRET_ACCESS_KEY'])

    # Get bucket
    bucket = s3.get_bucket(current_app.config['AWS_S3_BUCKET'])

    # Create key
    k = Key(bucket)
    k.key = key

    # metadata
    k.set_metadata('content-type', content_type)
    k.set_metadata('cache-control', 'max-age=%d' % max_age)
    k.set_metadata('content-encoding', 'gzip')

    # upload file
    k.set_contents_from_string(out.getvalue())

    if public:
        k.make_public()



