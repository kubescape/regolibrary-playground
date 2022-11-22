import Editor from "@monaco-editor/react";
import * as React from 'react';
import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import { Grid, Paper } from "@mui/material";
import FlipIcom from '@mui/icons-material/Flip';
import Fab from '@mui/material/Fab';
import PropTypes from 'prop-types';
import * as jsyaml from 'js-yaml';
import ReactResizeDetector from 'react-resize-detector';


function LanguageSelect({ options, value, onChange }) {
    const [val, setValue] = React.useState(value);

    const handleChange = (event) => {
        setValue(event.target.value);
        onChange(event.target.value);
    };

    const items = options.map((option) => {
        return <MenuItem value={option} key={option}>{option}</MenuItem>
    });
    return (
        <Box sx={{ minWidth: 120 }}>
            <FormControl >
                <InputLabel id="demo-simple-select-label">Language</InputLabel>
                <Select
                    labelId="demo-simple-select-label"
                    id="demo-simple-select"
                    value={val}
                    label="Language"
                    onChange={handleChange}
                >
                    {items}
                </Select>
            </FormControl>
        </Box>
    );
}


LanguageSelect.propTypes = {
    options: PropTypes.array.isRequired,
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    sx: PropTypes.object,
}

LanguageSelect.defaultProps = {
    sx: {
        width: 120,
        flex: 1,
    },
}

CodeEditor.propTypes = {
    lang: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    onExec: PropTypes.func.isRequired,
    value: PropTypes.any.isRequired,
}

CodeEditor.defaultProps = {
    lang: "json",
    value: {
        "apiVersion": "v1",
        "kind": "Pod",
        "metadata": {
            "name": "frontend"
        },
        "spec": {
            "containers": [
                {
                    "name": "app",
                    "image": "images.my-company.example/app:v4",
                    "resources": {
                        "requests": {
                            "memory": "64Mi",
                            "cpu": "250m"
                        },
                        "limits": {
                            "memory": "128Mi",
                            "cpu": "500m"
                        }
                    }
                },
                {
                    "name": "log-aggregator",
                    "image": "images.my-company.example/log-aggregator:v6",
                    "resources": {
                        "limits": {
                            "memory": "128Mi"
                        }
                    }
                }
            ]
        }
    },
    onChange: () => { },
    onExec: () => { }
}

function CodeEditor({ onExec, onChange, value, lang, status }) {
    const decode = (code) => {
        if (language === "json") {
            return JSON.parse(code);
        }
        if (language === "yaml") {
            return jsyaml.load(code);
        }
    }

    const encode = (code, lang) => {
        if (lang === "json") {
            return JSON.stringify(code, null, 2);
        }
        if (lang === "yaml") {
            return jsyaml.dump(code);
        }
    }

    const [code, setCode] = React.useState(encode(value, lang));
    const [language, setLanguage] = React.useState(lang);

    // language selection buttons
    const languages = [
        "json",
        "yaml",
    ];

    const statusToColor = {
        "Pass": 'primary.green',
        // "Fail": window.theme.palette.error.main,
        // "Warn": window.theme.palette.warning.main,
        // "Info": window.theme.palette.info.main,
    }



    // language selection handler
    const handleLanguageChange = (value) => {
        console.log("changing lang from", language, "to", value);
        try {
            setCode(encode(decode(code), value));
        } catch (e) {
            console.log(e);
        }
        setLanguage(value);
    };

    // Excute button handler
    const handleExcute = () => {
        console.log("handleExcute", code);
        onExec(decode(code));
    };

    return (
        <Paper
            sx={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                p: 2,
                height: "100%",
            }}
        >
            <Box >
                <Editor
                    height="70vh"
                    width="80vh"
                    language={language}
                    value={code}
                    onChange={(value) => setCode(value)}
                />
            </Box>
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    p: 2,
                }}
            >
                <LanguageSelect
                    options={languages}
                    value={"json"}
                    onChange={handleLanguageChange}
                />
                <p>Status: {status}</p>
                <Fab color="primary" aria-label="exec">
                    <FlipIcom onClick={() => handleExcute()} />
                </Fab>
            </Box>
        </Paper>
    );
}



export default CodeEditor;