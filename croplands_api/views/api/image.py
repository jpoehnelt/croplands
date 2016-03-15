from croplands_api import api
from croplands_api.models import Image, ImageClassification
from croplands_api.exceptions import ImageProcessingError
from croplands_api.utils.s3 import upload_image
from processors import api_roles, add_user_to_posted_data, debug_post
import uuid
from flask import request
from croplands_api.tasks.classifications import compute_image_classification_statistics


def update_image_classification_statistics(result=None, **kwarg):
    compute_image_classification_statistics(result['image'])


def insert_ip(data=None, **kwargs):
    """
    Gets ip address.
    :param data:
    :param kwargs:
    :return:
    """

    data['ip'] = request.remote_addr if request.remote_addr is not None else 1


def check_for_base64(data=None, **kwargs):
    """
    Checks if data['image'] is in posted data. If it is a base64 encoded image,
    it will be processed and uploaded to s3.

    :param data:
    :param kwargs:
    :return: None
    """

    if 'image' in data:
        filename = 'img/' + str(uuid.uuid4()) + '.JPG'
        try:
            upload_image(data['image'], encoded_image=True, filename=filename)
        except:
            raise ImageProcessingError()
        else:
            data['url'] = filename
        del data['image']


def create(app):
    api.create_api(Image,
                   app=app,
                   collection_name='images',
                   methods=['GET', 'PATCH', 'POST', 'DELETE'],
                   preprocessors={
                       'POST': [add_user_to_posted_data,
                                check_for_base64, debug_post],
                       'PATCH_SINGLE': [api_roles(['mapping', 'validation', 'admin'])],
                       'PATCH_MANY': [api_roles('admin')]
                   },
    )

    api.create_api(ImageClassification,
                   app=app,
                   collection_name='image_classifications',
                   methods=['POST'],
                   preprocessors={
                       'POST': [insert_ip, add_user_to_posted_data]
                   },
                   postprocessors={
                       'POST': [update_image_classification_statistics]
                   }
    )
