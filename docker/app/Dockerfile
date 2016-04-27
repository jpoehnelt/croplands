FROM justinwp/croplands-server

EXPOSE 8000

CMD gunicorn herokuapp:app -b :8000 --workers=5