from shapely.geometry import Polygon, Point
import json
import os

def find_country(lon, lat):
    """
    Determines county from latitude and longitude.
    :param lon: 
    :param lat: 
    :return:
    """
    path = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'countries.json')
    with open(path, 'r') as f:
        countries = json.loads(f.read())

    point = Point(float(lon), float(lat))
    for country in countries['features']:
        if country['geometry']['type'] == 'MultiPolygon':
            for segment in country['geometry']['coordinates']:
                if Polygon(segment[0], segment[1:]).contains(point):
                    return country['properties']

        else:
            if Polygon(country['geometry']['coordinates'][0],
                       country['geometry']['coordinates'][1:]).contains(point):
                return country['properties']


if __name__ == "__main__":
    print find_country(-95, 35)
