class FieldError(Exception):
    """
    Error class for use in returning fields that may be in error.
    """
    status_code = 400

    def __init__(self, error="Bad Request", description="Missing or invalid information", status_code=400,
                 headers=None):
        """
        :param error: name of error
        :param description: readable description
        :param status_code: the http status code
        :param headers: any applicable headers
        :return:
        """
        self.description = description
        self.status_code = status_code
        self.headers = headers
        self.error = error


class UserError(Exception):
    """
    Error class for use in returning fields that may be in error.
    """
    status_code = 400

    def __init__(self, error=None, description="Missing or invalid information", status_code=400,
                 headers=None):
        """
        :param error: name of error
        :param description: readable description
        :param status_code: the http status code
        :param headers: any applicable headers
        :return:
        """
        self.description = description
        self.status_code = status_code
        self.headers = headers
        self.error = error


class Unauthorized(Exception):
    """
    Error class for unauthorized access.
    """
    status_code = 401

    def __init__(self, error="Unauthorized", description=None, status_code=401,
                 headers=None):
        """
        :param error: name of error
        :param description: readable description
        :param status_code: the http status code
        :param headers: any applicable headers
        :return:
        """
        self.description = description
        self.status_code = status_code
        self.headers = headers
        self.error = error


class InvalidLocation(Exception):
    status_code = 400

    def __init__(self, error="Bad Request", description=None, status_code=400,
                 headers=None):
        """
        :param error: name of error
        :param description: readable description
        :param status_code: the http status code
        :param headers: any applicable headers
        :return:
        """
        self.description = description
        self.status_code = status_code
        self.headers = headers
        self.error = error


class ImageProcessingError(Exception):
    status_code = 500

    def __init__(self, error="Image Processing Error",
                 description="Something went wrong processing your image.", status_code=400,
                 headers=None):
        """
        :param error: name of error
        :param description: readable description
        :param status_code: the http status code
        :param headers: any applicable headers
        :return:
        """
        self.description = description
        self.status_code = status_code
        self.headers = headers
        self.error = error


class TileNotFound(Exception):
    status_code = 404

    def __init__(self, error="Image Processing Error",
                 description="Something went wrong processing your image.", status_code=404,
                 headers=None):
        """
        :param error: name of error
        :param description: readable description
        :param status_code: the http status code
        :param headers: any applicable headers
        :return:
        """
        self.description = description
        self.status_code = status_code
        self.headers = headers
        self.error = error
