import locations
import records
import users
import image
import ratings


def init_api(app):
    """
    Helper for initialization of api.
    :param app: Flask
    :return: None
    """
    locations.create(app)
    records.create(app)
    users.create(app)
    image.create(app)
    ratings.create(app)
