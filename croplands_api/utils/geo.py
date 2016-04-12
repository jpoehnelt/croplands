from geopy.distance import vincenty, Point, VincentyDistance
import math
import numpy as np
from shapely.ops import triangulate


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


def get_destination(lat, lon, bearing, km):
    origin = Point(lat, lon)
    destination = VincentyDistance(kilometers=km).destination(origin, bearing)
    return destination.latitude, destination.longitude


def degree_to_tile_number(lat_deg, lon_deg, zoom):
    """
    Converts a latitude, longitude and zoom to a tile number.
    :param lat_deg:
    :param lon_deg:
    :param zoom:
    :return: Tuple of column and row
    """
    lat_rad = math.radians(lat_deg)
    n = 2.0 ** zoom
    x = int((lon_deg + 180.0) / 360.0 * n)
    y = int((1.0 - math.log(math.tan(lat_rad) + (1 / math.cos(lat_rad))) / math.pi) / 2.0 * n)
    return x, y


def tile_number_to_degree(x, y, zoom):
    """

    :param x:
    :param y:
    :param zoom:
    :return:
    """
    n = 2.0 ** zoom
    lon_deg = x / n * 360.0 - 180.0
    lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * y / n)))
    lat_deg = math.degrees(lat_rad)
    return lat_deg, lon_deg


def uniform_sample(poly, n=100):
    """
    Uniformly sample the Delaunay triangulation of a polygon. If the polygon
    is convex, this will uniformly sample its area.
    Parameters
    ----------
    poly: Shapely Polygon
    n: Number of points
    Returns
    -------
    [n x 2] numpy array of x-y coordinates that are uniformly distributed
    over the Delaunay triangulation.
    """
    polys = triangulate(poly)
    # Normalize the areas
    areas = np.array([p.area for p in polys])
    areas /= areas.sum()

    # Randomly select a triangle weighted by area
    # t_inds is the index of the chosen triangle
    t_inds = np.searchsorted(np.cumsum(areas), np.random.random(n))

    # Randomly sample the area of each triangle according to
    # P = (1-sqrt(r1))A + (sqrt(r1)(1-r2))B + (sqrt(r1)r2)C
    # where r1, r2 are sampled uniform [0, 1] and A, B, C are the triangle
    # vertices
    # http://math.stackexchange.com/questions/18686/uniform-random-point-in-triangle

    # Compute the coefficients
    sr1 = np.sqrt(np.random.random(n))  # sr1 is sqrt(r1) above
    r2 = np.random.random(n)
    c0 = 1 - sr1
    c1 = sr1 * (1 - r2)
    c2 = sr1 * r2

    # Grab the triangle vertices.
    # v is a 3-element list where each element is [len(polys) x 2]
    # array of each triangle vertex. It represents, A, B, C above.
    v = [np.array([p.exterior.coords[i] for p in polys])
         for i in range(3)]

    # Compute the points. v[i] is [N x 2] and the coefficients are [N x 1]
    P = (c0[:, np.newaxis] * v[0][t_inds,:] +
         c1[:, np.newaxis] * v[1][t_inds,:] +
         c2[:, np.newaxis] * v[2][t_inds,:])

    return P