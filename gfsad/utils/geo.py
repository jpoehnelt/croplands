from geopy.distance import vincenty, Point, VincentyDistance
import math


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


def decode_google_polyline(encoded):
    """Decodes a polyline that was encoded using the Google Maps method.

    See http://code.google.com/apis/maps/documentation/polylinealgorithm.html

    This is a straightforward Python port of Mark McClure's JavaScript polyline decoder
    (http://facstaff.unca.edu/mcmcclur/GoogleMaps/EncodePolyline/decode.js)
    and Peter Chng's PHP polyline decode
    (http://unitstep.net/blog/2008/08/02/decoding-google-maps-encoded-polylines-using-php/)
    """

    encoded_len = len(encoded)
    index = 0
    array = []
    lat = 0
    lng = 0

    while index < encoded_len:

        b = 0
        shift = 0
        result = 0

        while True:
            b = ord(encoded[index]) - 63
            index = index + 1
            result |= (b & 0x1f) << shift
            shift += 5
            if b < 0x20:
                break

        dlat = ~(result >> 1) if result & 1 else result >> 1
        lat += dlat

        shift = 0
        result = 0

        while True:
            b = ord(encoded[index]) - 63
            index = index + 1
            result |= (b & 0x1f) << shift
            shift += 5
            if b < 0x20:
                break

        dlng = ~(result >> 1) if result & 1 else result >> 1
        lng += dlng

        array.append((lat * 1e-5, lng * 1e-5))

    return array


def calculate_bearing(origin_lat, origin_lon, destination_lat, destination_lon):
    """
    Calculates the bearing between two points.

    :param origin_lat: float (decimal degrees)
    :param origin_lon: float (decimal degrees)
    :param destination_lat: float (decimal degrees)
    :param destination_lon: float (decimal degrees)
    :return: float
    """

    lat1 = math.radians(origin_lat)
    lat2 = math.radians(destination_lat)

    diffLong = math.radians(destination_lon - origin_lon)

    x = math.sin(diffLong) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - (math.sin(lat1)
                                           * math.cos(lat2) * math.cos(diffLong))

    initial_bearing = math.atan2(x, y)

    # Now we have the initial bearing but math.atan2 return values
    # The solution is to normalize the initial bearing as shown below

    initial_bearing = math.degrees(initial_bearing)
    compass_bearing = (initial_bearing + 360) % 360

    return compass_bearing


def calculate_plane_perpendicular_to_travel(origin, current, destination):
    """
    Returns an angle perpendicular to the direction of travel.

    :param origin: tuple of lat, lon
    :param current: tuple of lat, lon
    :param destination: tuple of lat, lon
    :return: float
    """

    first = calculate_bearing(current[0], current[1], origin[0], origin[1])
    second = calculate_bearing(current[0], current[1], destination[0], destination[1])

    return (first + second) / 2.0


def get_destination(origin, bearing, d):
    origin = Point(origin[0], origin[1])
    destination = VincentyDistance(kilometers=d).destination(origin, bearing)
    return destination.latitude, destination.longitude