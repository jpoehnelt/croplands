from croplands_api import api
from croplands_api.models import Location
from processors import api_roles, add_user_to_posted_data, remove_relations, debug_post
from records import save_record_state_to_history
from croplands_api.utils.s3 import upload_image
import requests
import uuid
import cStringIO

def process_records(result=None, **kwargs):
    """
    This processes all records that may have been posted as a relation of the location.
    :param result:
    :param kwargs:
    :return: None
    """
    for record in result['records']:
        save_record_state_to_history(record)


def merge_same_location_lat_long(data=None, **kwargs):
    """
    This preprocessor checks if the location already exists.

    :param data:
    :param kwargs:
    :return:
    """
    # TODO
    pass


def change_field_names(data=None, **kwargs):
    if 'photos' in data:
        data['images'] = data['photos']
        del data['photos']


def check_for_street_view_image(data=None, **kwargs):
    if 'images' not in data:
        return

    for image in data['images']:
        if 'source' in image and image['source'] == 'streetview':
            try:
                r = requests.get(image['url'])
                if r.status_code == 200:
                    url = 'images/streetview/' + str(uuid.uuid4()) + '.jpg'
                    image['url'] = upload_image(cStringIO.StringIO(r.content), encoded_image=False, filename=url).key
            except Exception as e:
                print(e)


def create(app):
    api.create_api(Location,
                   app=app,
                   collection_name='locations',
                   methods=['GET', 'POST', 'PATCH', 'DELETE'],
                   preprocessors={
                       'POST': [change_field_names, add_user_to_posted_data, debug_post,
                                check_for_street_view_image],
                       'PATCH_SINGLE': [api_roles(['mapping', 'validation', 'admin']),
                                        remove_relations],
                       'PATCH_MANY': [api_roles('admin'), remove_relations],
                       'DELETE': [api_roles('admin')]
                   },
                   postprocessors={
                       'POST': [process_records],
                       'PATCH_SINGLE': [],
                       'PATCH_MANY': [],
                       'DELETE': []
                   },
                   results_per_page=10)