### Docker Run Command

```
docker pull justinwp/croplands-server:beat-latest
docker run -d --env-file ./config.env -m 100M --restart=always  --name croplands-beat justinwp/croplands-server:beat-latest
```
