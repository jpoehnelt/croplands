from gfsad import api, limiter
from flask import current_app
from gfsad.models import Locations, History, db, Photos, Records, Reviews, Votes, User
from flask_restless import ProcessingException
import json
import random
import datetime
import copy
import base64
from PIL import Image
import cStringIO
import boto
from boto.s3.key import Key
import uuid



def before_patch_single(data=None, **kwargs):
    data['date_edited'] = datetime.datetime.utcnow().isoformat()


def before_post_locations(data=None, **kwargs):
    """
    Actions to take prior to the creation of new field points.
    :param data: the data posted to the api
    :param kwargs: probably none
    :return: nothing... modify in place
    """


    # # if logged in add name to data
    # if current_user.is_authenticated():
    # data['creator_id'] = current_user.id
    if 'date_created' not in data:
        data['date_created'] = datetime.datetime.utcnow().isoformat()

    # todo how to determine if it should be used for accuracy or training
    # currently a random choice
    data['use_verification'] = random.choice([True, False])
    # if logged in and role is '...' then training only
    # if logged in and role is '...' then random assignment
    # if not logged in then random assignment
    # other cases?

    if 'photos' in data:
        for photo in data['photos']:
            photo = before_post_photos(photo)
        print data['photos']


def before_insert_review(data=None, **kwargs):
    # if logged in add name to data
    # if current_user.is_authenticated():
    # data['user'] = current_user.id
    pass


def before_insert_vote(data=None, **kwargs):
    # if logged in add name to data
    # if current_user.is_authenticated():
    # data['user'] = current_user.id
    pass


def after_post_or_patch_locations(result=None, **kwargs):
    # save copy to history table
    insert_history_record(result)


def insert_history_record(data, **kwargs):
    history = {}

    # copy state and delete some fields that cannot/won't change
    history['data'] = copy.deepcopy(data)
    if 'photos' in history['data']:
        del history['data']['photos']
    if 'history' in history['data']:
        del history['data']['history']
    if 'creator_id' in history['data']:
        del history['data']['creator_id']
    if 'date_created' in history['data']:
        del history['data']['date_created']


    # store parent id
    history['data_id'] = data['id']

    # # get the editor
    # if current_user.is_authenticated():
    # history['data']['editor_id'] = current_user.id

    # convert history data to string
    history['data'] = json.dumps(history['data'])

    try:
        db.session.add(History(**history))
        db.session.commit()
    except:
        db.session.rollback()
        raise


def before_delete(data=None, **kwargs):
    # TODO Check role too!
    pass


def before_post_photos(data=None, **kwargs):
    photo = data['photo']

    # in memory file
    f = cStringIO.StringIO()

    # manipulate with pillow
    img = Image.open(cStringIO.StringIO(base64.b64decode(photo)))
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
    s3_file.key = 'img/' + str(uuid.uuid4()) + '.JPG'
    s3_file.set_metadata('cache-control', 'max-age=2000000')
    s3_file.set_metadata('content-type', 'image/jpeg')
    s3_file.set_contents_from_string(f.getvalue())

    s3_file.make_public()

    # Modify Post Data
    data['url'] = s3_file.key
    del data['photo']

    if 'date_taken' not in data:
        data['date_taken'] = datetime.datetime.utcnow().isoformat()

    return data


def after_post_photos(result=None, **kwargs):
    print result



api.create_api(History,
               methods=['GET'],
               results_per_page=100,
               collection_name='history')

api.create_api(Reviews,
               methods=['GET'],
               results_per_page=100)

api.create_api(Photos,
               preprocessors={
                   'POST': [before_post_photos],
               },
               postprocessors={
                   'POST': [after_post_photos]
               },
               methods=['GET', 'PATCH', 'POST'])
