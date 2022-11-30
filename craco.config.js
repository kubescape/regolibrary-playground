const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

module.exports = {
    webpack: {
        plugins: {
            add: [
                new MonacoWebpackPlugin({
                    languages: ['yaml', 'json'],
                    features: [
                        "!browser"
                    ],
                    customLanguages: [
                        {
                            label: 'yaml',
                            entry: 'monaco-yaml',
                            worker: {
                                id: 'monaco-yaml/yamlWorker',
                                entry: 'monaco-yaml/yaml.worker',
                            },
                        },
                    ],
                }),
            ],
        },
    },
};