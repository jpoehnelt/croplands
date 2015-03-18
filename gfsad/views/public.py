from flask import current_app, Blueprint, jsonify

# create blueprint to separate scope
public = Blueprint('views', __name__, template_folder='templates')


@public.route('/')
def app(path=None):
    return jsonify({"message": "No content here."}, 200)


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