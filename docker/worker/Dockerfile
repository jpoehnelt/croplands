FROM justinwp/croplands-base

RUN git clone https://github.com/justinwp/croplands
RUN pip install -r /croplands/requirements.txt

WORKDIR /croplands

CMD python control.py worker
