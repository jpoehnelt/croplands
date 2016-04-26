### Docker Run Command

```
docker pull justinwp/croplands-server
docker run --net=host -p 8000:8000 -d --env-file ./config.env --restart=always  --name croplands-server croplands-server
```
