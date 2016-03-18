#!flask/bin/python

from croplands_api import create_app

app = create_app(config='Production')
