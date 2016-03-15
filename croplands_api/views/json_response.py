from flask import jsonify, current_app, make_response, json, Response


class JSONResponse(Response):
    def __init__(self, status_code, description=None, error=None, data=None, headers=None,
                 **kwargs):
        d = {
            'status_code': status_code
        }
        if description is not None:
            d['description'] = description
        if error is not None:
            d['error'] = error
        if data is not None:
            d['data'] = data

        super(JSONResponse, self).__init__(response=json.dumps(d), headers=headers,
                                           status=status_code, content_type='application/json')
