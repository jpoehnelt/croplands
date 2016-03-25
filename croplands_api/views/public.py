from flask import current_app, Blueprint, jsonify, request, _request_ctx_stack, abort
from werkzeug.urls import url_decode, url_parse
from werkzeug.datastructures import MultiDict

import base64

# create blueprint to separate scope
public = Blueprint('views', __name__, template_folder='templates')


@public.route('/')
def app(path=None):
    return jsonify({"message": "No content here."})


# debugging sitemap
@public.route('/sitemap', methods=['GET'])
def sitemap():
    """Print available functions."""
    func_list = {}
    for rule in current_app.url_map.iter_rules():
        print rule
        if rule.endpoint != 'static':
            func_list[rule.rule] = current_app.view_functions[rule.endpoint].__doc__
    return jsonify(func_list)


@public.route('/link/<encoded>')
def forward(encoded):
    """
    Decodes a token and looks up the view/endpoint to internally redirect to.
    :param encoded: Base64 Url Safe containing url
    :return: Response
    """
    request.parameter_storage_class = MultiDict

    ctx = _request_ctx_stack.top
    try:
        link = url_parse(base64.urlsafe_b64decode(encoded.encode("utf-8")))
        scheme, netloc, path, query, fragment = link
        request.args = url_decode(query)
        view, variables = ctx.url_adapter.match(path)  # raises 404
        endpoint = current_app.view_functions[view]
        return endpoint(**variables)
    except UnicodeDecodeError:
        abort(404)

    abort(400)
