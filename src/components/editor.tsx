import * as React from 'react';
import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import Paper from "@mui/material/Paper";
import FlipIcom from '@mui/icons-material/Flip';
import Fab from '@mui/material/Fab';
import PropTypes from 'prop-types';
import * as jsyaml from 'js-yaml';
import MonacoEditor, { MonacoDiffEditor } from 'react-monaco-editor';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import Chip from '@mui/material/Chip';


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
                <InputLabel id="input-format-select-label">Format</InputLabel>
                <Select
                    labelId="input-format-select-label"
                    id="input-format-select"
                    value={val}
                    label="Format"
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
    onExec: PropTypes.func,
    value: PropTypes.any.isRequired,
    fix: PropTypes.any,
    onApplyChange: PropTypes.func,
}

CodeEditor.defaultProps = {
    lang: "yaml",
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
    onExec: null,
    onApplyChange: () => { },
}

function CodeEditor({ onExec, onChange, value, fixed, lang, status, onApplyChanges }) {
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
    const [fix, setFix] = React.useState(null);
    const [language, setLanguage] = React.useState(lang);
    const [diffSideBySide, setDiffSideBySide] = React.useState(true); // TODO: add a button

    if (fixed && !fix) {
        setFix(encode(fixed, language));
    }

    // language selection buttons
    const languages = [
        "json",
        "yaml",
    ];

    // language selection handler
    const handleLanguageChange = (value) => {
        console.log("changing lang from", language, "to", value);
        try {
            setCode(encode(decode(code), value));
            if (fix) {
                setFix(encode(decode(fix), value));
            }
        } catch (e) {
            console.log(e);
        }
        setLanguage(value);
    };

    // Excute button handler
    const handleExcute = () => {
        if (onExec == null) {
            return;
        }
        if (fix) {
            onExec(decode(fix));
        } else {
            onExec(decode(code));
        }
    };

    var editor = <div></div>;
    const monacoOptions = {
        automaticLayout: true,
        scrollBeyondLastLine: false,
        minimap: {
            enabled: false,
        },
    }

    const diffOptions = {
        ...monacoOptions,
        renderSideBySide: diffSideBySide,
    }
    if (!fix) {
        editor = <MonacoEditor
            height="70vh"
            width="45vw"
            language={language}
            value={code}
            options={monacoOptions}
            onChange={(value) => setCode(value)}
        />
    } else {
        editor = <MonacoDiffEditor
            height="70vh"
            width="45vw"
            value={fix}
            original={code}
            language={language}
            options={diffOptions}
            onChange={(value) => setFix(value)}
        />
    }

    var actionButton = (
        <Fab disabled={onExec == null} color="primary" aria-label="exec" >
            <FlipIcom onClick={() => handleExcute()} />
        </Fab>
    )

    if (fix) {
        actionButton = (
            <Fab color="success" aria-label="exec" >
                <DoneAllIcon onClick={() => {
                    setCode(fix);
                    setFix(null);
                    onApplyChanges(decode(fix));
                }} />
            </Fab>
        )
    }

    var statusBadge = <div></div>;
    if (status) {
        var color = "warning"
        if (status === "Pass") { color = "success" }
        if (status === "Fail") { color = "error" }
        statusBadge = <Chip label={status} color={color} />
    }

    return (
        <Paper
            sx={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                p: 2,
                height: "100%",
                boxShadow: 10,
            }}
        >
            <Box >
                {editor}
            </Box>
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop:2
                }}
            >
                <LanguageSelect
                    options={languages}
                    value={lang}
                    onChange={handleLanguageChange}
                />
                {statusBadge}
                {actionButton}
            </Box>
        </Paper>
    );
}



export default CodeEditor;