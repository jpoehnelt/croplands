FROM justinwp/croplands-base

WORKDIR /croplands

ADD https://raw.githubusercontent.com/justinwp/croplands/master/requirements.txt /croplands/requirements.txt
RUN pip install -r /croplands/requirements.txt

RUN git clone https://github.com/justinwp/croplands

EXPOSE 8000

CMD gunicorn herokuapp:app -b :8000 --workers=5