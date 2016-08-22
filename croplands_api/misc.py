import logging
from flask import render_template, json

class PostMarkHandler(logging.Handler):
    def __init__(self, url='https://api.postmarkapp.com/email', api_key=None):
        """
        Initialize the instance with the url and api key
        """
        logging.Handler.__init__(self)
        self.url = url
        self.api_key = api_key

    def emit(self, record):
        print record
        """
        Emit a record.

        Send the record to the Web server as a percent-encoded dictionary
        """
        try:
            import requests
            data = record.__dict__
            data['data'] = data
            body = render_template('email/application_error.txt', **data)
            message = json.dumps({
                "From": 'info@croplands.org',
                "ReplyTo": 'info@croplands.org',
                "To": 'jpoehnelt@usgs.gov',
                "Subject": 'Croplands Application Error',
                "HtmlBody": body,
                "TextBody": body
            })

            headers = {'X-Postmark-Server-Token': self.api_key,
                       'Content-Type': 'application/json',
                       'Accept': 'application/json'
            }
            post = requests.post(self.url, data=message, headers=headers)
        except (KeyboardInterrupt, SystemExit):
            raise
        except:
            self.handleError(record)

