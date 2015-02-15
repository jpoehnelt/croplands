#!flask/bin/python

from gfsad import create_app

app = create_app(config='gfsad.config.production')
