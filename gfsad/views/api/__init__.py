import locations
import records
import users
import photo
import ratings

def init_api(app):
    locations.create(app)
    records.create(app)
    users.create(app)
    photo.create(app)
    ratings.create(app)