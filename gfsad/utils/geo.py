from geopy.distance import vincenty


def distance(lat1, lon1, lat2, lon2):
    """
    Returns distance in meters between two locations using the Vincenty method.
    :param lat1:
    :param lon1:
    :param lat2:
    :param lon2:
    :return: Integer (meters)
    """
    return vincenty((lat1, lon1), (lat2, lon2)).meters

