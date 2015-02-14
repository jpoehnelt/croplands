from flask import current_app, Blueprint, render_template, abort, jsonify, redirect, url_for, make_response

# create blueprint to separate scope
public = Blueprint('views', __name__, template_folder='templates')

@public.route('/')
@public.route('/map')
@public.route('/app')
@public.route('/game')
@public.route('/account/<path:path>')
def app(path=None):
    return render_template('app.html')

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