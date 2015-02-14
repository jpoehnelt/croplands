from gfsad import create_app

if __name__ == "__main__":
    app = create_app('gfsad.config.development')
    app.run(debug=True, threaded=True)
