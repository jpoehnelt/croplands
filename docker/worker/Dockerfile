FROM justinwp/croplands-base

RUN git cloneo https://github.com/justinwp/croplands
WORKDIR /croplands

RUN pip install -r /croplands/requirements.txt

CMD python control.py worker
