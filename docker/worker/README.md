### Docker Run Command

```
docker pull justinwp/croplands-worker
docker run -d --env-file ./config.env --restart=always  --name croplands-worker croplands-worker
```
