from gfsad import create_app

if __name__ == "__main__":
    app = create_app('Development')
    app.run(debug=True, threaded=True)
