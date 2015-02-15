from gfsad import api
from gfsad.models import Location
from processors import api_roles, add_user_to_posted_data, remove_relations
from records import save_record_state_to_history
from gfsad.tasks.records import get_ndvi


def process_records(result=None, **kwargs):
    """
    This processes all records that may have been posted as a relation of the location.
    :param result:
    :param kwargs:
    :return: None
    """
    for record in result['records']:
        save_record_state_to_history(record)


def get_time_series(result=None, **kwargs):
    get_ndvi.delay(id=result['id'], lat=result['lat'], lon=result['lon'])


def create(app):
    api.create_api(Location,
                   app=app,
                   collection_name='locations',
                   methods=['GET', 'POST', 'PATCH', 'DELETE'],
                   preprocessors={
                       'POST': [add_user_to_posted_data],
                       'PATCH_SINGLE': [api_roles(['team', 'admin']), remove_relations],
                       'PATCH_MANY': [api_roles('admin'), remove_relations],
                       'DELETE': [api_roles('admin')]
                   },
                   postprocessors={
                       'POST': [process_records, get_time_series],
                       'PATCH_SINGLE': [],
                       'PATCH_MANY': [],
                       'DELETE': []
                   },
                   results_per_page=10)