FROM justinwp/croplands-base

RUN git clone -b docker https://github.com/justinwp/croplands
WORKDIR /croplands

RUN pip install -r /croplands/requirements.txt

EXPOSE 8000

CMD gunicorn herokuapp:app -b :8000 --workers=5
# sudo docker run --net=host -p 8000:8000 -d --env-file ./config.env --restart=always  --name croplands-server croplands-server
