from gfsad import api
from gfsad.models import Photo
from gfsad.exceptions import ImageProcessingError
from gfsad.utils.s3 import upload_photo
from processors import api_roles, add_user_to_posted_data
import uuid


def check_for_base64(data=None, **kwargs):
    """
    Checks if data['photo'] is in posted data. If it is a base64 encoded image,
    it will be processed and uploaded to s3.

    :param data:
    :param kwargs:
    :return: None
    """

    if 'photo' in data:
        filename = 'img/' + str(uuid.uuid4()) + '.JPG'
        try:
            upload_photo(data['photo'], filename)
        except:
            raise ImageProcessingError()
        else:
            data['url'] = 'http://cdn.croplands.org/' + filename
    del data['photo']


def create(app):
    api.create_api(Photo,
                   app=app,
                   collection_name='photos',
                   methods=['GET', 'PATCH', 'POST', 'DELETE'],
                   preprocessors={
                       'POST': [api_roles(['partner', 'team', 'admin']), add_user_to_posted_data,
                                check_for_base64],
                       'PATCH_SINGLE': [api_roles(['team', 'admin'])],
                       'PATCH_MANY': [api_roles('admin')]
                   },
    )
