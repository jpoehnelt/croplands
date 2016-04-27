### Docker Run Command

```
docker pull justinwp/croplands-server:worker-latest
docker run -d --env-file ./config.env --restart=always  --name croplands-beat justinwp/croplands-server:beat-latest
```
