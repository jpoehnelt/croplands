import math


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
