# React POC of [Kubescape Regolibrary](https://github.com/kubescape/regolibrary) playground
[Playgound](https://shm12.github.io/react-gh-pages-test/)


# Updating
## k8s schemas
To update the k8s json schema, run the following command:
```
pip install openapi2jsonschema
openapi2jsonschema --stand-alone --kubernetes --strict https://raw.githubusercontent.com/kubernetes/kubernetes/master/api/openapi-spec/swagger.json
python scripts/k8s_schema.py schemas -o src/components/k8s-schema.json
```

## Regolibrary
To update the regolibrary, download the latest version from [here](https://github.com/kubescape/regolibrary/releases/latest/download/kubescape_regolibrary_bundle_wasm.tar.gz) and extract it to `src/components/bin` folder.

# Deployment
To deploy the app, run the following command:
```
npm run deploy
```

# TODO
- [ ] Add more tests
- [ ] support yaml k8s json schema
- [ ] clean the messy code
- [ ] use tree-shaking to reduce the bundle size