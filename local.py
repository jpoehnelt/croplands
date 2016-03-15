from croplands_api import create_app

if __name__ == "__main__":
    app = create_app('Production')
    app.config['SQLALCHEMY_ECHO'] = True
    app.run(debug=True, port=8000, threaded=True)
