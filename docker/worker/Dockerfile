FROM justinwp/croplands-base

ADD requirements.txt /croplands/requirements.txt
RUN pip install -r /croplands/requirements.txt
ADD . /croplands

USER nobody

CMD python control.py worker
