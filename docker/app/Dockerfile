FROM justinwp/croplands-server:server-latest

EXPOSE 8000

CMD gunicorn herokuapp:app -b :8000 --workers=5