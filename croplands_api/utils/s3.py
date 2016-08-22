import cStringIO
import base64
import boto
from boto.s3.key import Key
from PIL import Image
from flask import current_app
import uuid
import StringIO
import gzip


def upload_image(img=None, encoded_image=True, filename='images/' + str(uuid.uuid4()) + '.JPG', public=True,
                 cache_control='max-age=2000000',
                 content_type='image/jpeg'):
    """
    Uploads a base64 encoded image to amazon s3 bucket.
    :param img: data for image
    :param encoded_image: if base64 encoded image
    :param filename: s3 filename
    :param public: boolean if public
    :param cache_control: http cache-control value
    :param content_type: http content type
    :return:
    """
    # in memory file
    f = cStringIO.StringIO()

    # manipulate with pillow
    if encoded_image:
        img = base64.b64decode(img)
        img = Image.open(cStringIO.StringIO(img))
    else:
        img = Image.open(img)
        
    img.convert("RGB")
    img.thumbnail((1200, 1200))
    img.save(f, 'JPEG', quality=75)

    # Connect to google storage
    gs = boto.connect_gs(current_app.config['GS_ACCESS_KEY'],
                         current_app.config['GS_SECRET'])

    # Get bucket
    bucket = gs.get_bucket(current_app.config['BUCKET'])

    # create file
    gs_file = Key(bucket)
    gs_file.key = filename
    gs_file.set_metadata('cache-control', cache_control)
    gs_file.set_metadata('content-type', content_type)
    gs_file.set_contents_from_string(f.getvalue())

    if public:
        gs_file.make_public()

    return gs_file


def delete_image(key):
    """
    Deletes a key (file) from Amazon S3 Bucket
    :param key:
    :return: None
    """
    # Connect to S3
    gs = boto.connect_gs(current_app.config['GS_ACCESS_KEY'],
                         current_app.config['GS_SECRET'])

    # Get bucket
    bucket = gs.get_bucket(current_app.config['AWS_S3_BUCKET'])

    gs_file = Key(bucket)

    gs_file.key = key

    bucket.delete_key(gs_file)


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

    gs = boto.connect_gs(current_app.config['GS_ACCESS_KEY'],
                         current_app.config['GS_SECRET'])

    # Get bucket
    bucket = gs.get_bucket(current_app.config['BUCKET'])

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