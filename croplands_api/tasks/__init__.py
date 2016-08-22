from croplands_api import celery
from flask import current_app
from flask import json
import requests


@celery.task
def send_email(msg):
    try:
        msg = msg.__dict__
    except AttributeError as e:
        # dict object has no attribute __dict__
        pass

    if type(msg['recipients']) is list:
        msg['recipients'] = ",".join(msg['recipients'])
    if 'cc' in msg and type(msg['cc']) is list:
        msg['cc'] = ",".join(msg['cc'])
    if 'bcc' in msg and type(msg['bcc']) is list:
        msg['bcc'] = ",".join(msg['bcc'])

    message = json.dumps({
        "From": 'info@croplands.org',
        "ReplyTo": 'info@croplands.org',
        "To": msg['recipients'],
        "Subject": msg.get('subject', ''),
        "HtmlBody": msg.get('html', ''),
        "TextBody": msg.get('body', ''),
        "TrackOpens": True
    })


    headers = {'X-Postmark-Server-Token': current_app.config['POSTMARK_API_KEY'],
               'Content-Type': 'application/json',
               'Accept': 'application/json'
    }
    r = requests.post("https://api.postmarkapp.com/email", message, headers=headers)
    assert r.status_code == 200
    return r.json()