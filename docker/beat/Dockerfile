FROM justinwp/croplands-base

ADD https://raw.githubusercontent.com/justinwp/croplands/master/requirements.txt /croplands/requirements.txt
RUN pip install -r /croplands/requirements.txt

WORKDIR /croplands

RUN git clone https://github.com/justinwp/croplands

USER nobody
CMD python control.py beat
