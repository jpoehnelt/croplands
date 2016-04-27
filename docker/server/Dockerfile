FROM justinwp/croplands-base

ADD requirements.txt /croplands/requirements.txt
RUN pip install -r /croplands/requirements.txt
ADD . /croplands

WORKDIR /croplands

EXPOSE 8000

CMD gunicorn herokuapp:app -b :8000 --workers=5