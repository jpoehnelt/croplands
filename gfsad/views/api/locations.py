from gfsad import api
from gfsad.models import Location
from processors import api_roles, add_user_to_posted_data, remove_relations, debug_post
from records import save_record_state_to_history
from gfsad.tasks.records import get_ndvi, build_static_records
from gfsad.utils.countries import find_country


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


def get_time_series(result=None, **kwargs):
    # get_ndvi.delay(id=result['id'], lat=result['lat'], lon=result['lon'])
    pass


def build_static_locations(result=None, **kwargs):
    """
    Calls the celery task to rebuild the static locations for the web application.
    """
    # build_static_records.delay()
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
                       'PATCH_SINGLE': [api_roles(['team', 'admin']), remove_relations],
                       'PATCH_MANY': [api_roles('admin'), remove_relations],
                       'DELETE': [api_roles('admin')]
                   },
                   postprocessors={
                       'POST': [process_records, get_time_series, build_static_locations],
                       'PATCH_SINGLE': [build_static_locations],
                       'PATCH_MANY': [build_static_locations],
                       'DELETE': [build_static_locations]
                   },
                   results_per_page=10)