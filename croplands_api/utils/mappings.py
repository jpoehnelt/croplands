def get_crop_label(id):
    return [
        'Unknown',
        'Wheat',
        'Maize (Corn)',
        'Rice',
        'Barley',
        'Soybeans',
        'Pulses',
        'Cotton',
        'Potatoes',
        'Alfalfa',
        'Sorghum',
        'Millet',
        'Sunflower',
        'Rye',
        'Rapeseed or Canola',
        'Sugarcane',
        'Groundnuts or Peanuts',
        'Cassava',
        'Sugarbeets',
        'Palm',
        'Others',
        'Plantations',
        'Fallow',
        'Tef',
        'Pastures',
        'Oats'
    ][id]


def get_water_label(id):
    return [
        'Unknown',
        'Rainfed',
        'Irrigated'
    ][id]


def get_land_cover_label(id):
    return [
        'Unknown',
        'Cropland',
        'Forest',
        'Grassland',
        'Barren',
        'Builtup',
        'Shrub',
        'Water'
    ][id]


def get_intensity_label(id):
    return [
        'Unknown',
        'Single',
        'Double',
        'Triple',
        'Continuous'
    ][id]