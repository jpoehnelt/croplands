### Docker Run Command

```
docker pull justinwp/croplands-server:worker-latest
docker run -d --env-file ./config.env --restart=always  --name croplands-worker justinwp/croplands-server:worker-latest
```
