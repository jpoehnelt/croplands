FROM justinwp/croplands-base

RUN git clone https://github.com/justinwp/croplands
WORKDIR /croplands

RUN pip install -r /croplands/requirements.txt
USER nobody
CMD python control.py worker
