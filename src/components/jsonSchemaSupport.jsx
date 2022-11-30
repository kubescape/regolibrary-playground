import {monaco} from 'react-monaco-editor';
import { setDiagnosticsOptions } from 'monaco-yaml';
import Schema from './bin/k8s-schema.json'

// Setup workers
window.MonacoEnvironment = {
    getWorker(moduleId, label) {
        switch (label) {
            case 'editorWorkerService':
                return new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker', import.meta.url));
            case 'json':
                return new Worker(
                    new URL('monaco-editor/esm/vs/language/json/json.worker', import.meta.url),
                );
            case 'yaml':
                return new Worker(new URL('monaco-yaml/yaml.worker', import.meta.url));
            default:
                throw new Error(`Unknown label ${label}`);
        }
    },
};

// Json k8s json shcema
monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    schemas: [
        {
            fileMatch: ["*"],
            uri: 'k8s-schema',
            schema: Schema
        }
    ],
});

// yaml k8s json shcema 
setDiagnosticsOptions({
    isKubernetes: true,
    schemas: [
        {
            fileMatch: ["*"],
            uri: 'http://example.com/k8s-schema.json', // In yaml for some reason it must be a valid http url
            schema: Schema
        }
    ],
});
