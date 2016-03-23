FROM python:2.7.11-wheezy

RUN echo deb http://http.debian.net/debian wheezy-backports main >> /etc/apt/sources.list
RUN apt-get update && apt-get install -y --no-install-recommends libgeos-dev

ARG CACHEBUST=1 # docker build --build-arg CACHE_DATE=$(date)
RUN git clone -b docker https://github.com/justinwp/croplands
WORKDIR /croplands

RUN pip install -r /croplands/requirements.txt

EXPOSE 8000

CMD gunicorn herokuapp:app -b :8000 --workers=5
# sudo docker run --net=host -p 8000:8000 -d --env-file ./config.env --restart=always  --name croplands-server croplands-server
