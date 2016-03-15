from croplands_api import api
from croplands_api.models import Location
from processors import api_roles, add_user_to_posted_data, remove_relations, debug_post
from records import save_record_state_to_history
from croplands_api.tasks.records import get_ndvi


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


def create(app):
    api.create_api(Location,
                   app=app,
                   collection_name='locations',
                   methods=['GET', 'POST', 'PATCH', 'DELETE'],
                   preprocessors={
                       'POST': [change_field_names, add_user_to_posted_data, debug_post],
                       'PATCH_SINGLE': [api_roles(['mapping', 'validation', 'admin']), remove_relations],
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