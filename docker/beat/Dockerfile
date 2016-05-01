FROM justinwp/croplands-base


RUN git clone https://github.com/justinwp/croplands
RUN pip install -r /croplands/requirements.txt

WORKDIR /croplands

RUN chmod 770 -r /croplands

USER nobody

CMD python control.py beat
