from flask import request
from croplands_api.models.log import Log, db


def log(response):
    try:
        if request.method != 'GET' and response.status_code not in [200, 201]:
            l = Log(request, response)
            db.session.add(l)
            db.session.commit()
    except:
        pass

    return response