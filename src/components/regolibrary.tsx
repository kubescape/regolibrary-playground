import CodeEditor from "./editor.tsx";
import BasicTabs from "./tabs";
import * as React from 'react';
import Box from '@mui/material/Box';
import * as jsonpatch from 'fast-json-patch';
import LinearProgress from '@mui/material/LinearProgress';

import { useState } from "react";
import { Library } from "../regolibrary-utils/rego";
import { JSONPath } from 'jsonpath-plus';
import { Typography } from "@mui/material";

interface Lib {
    library: Library;
}

function patchObject(obj: any, path: string, value: any) {
    const currentVal = JSONPath({ path: path, json: obj });
    const exist = Boolean(currentVal.length);


    var p = path;
    p = p.replace(/\./g, '/');
    p = p.replace(/\[/g, '/');
    p = p.replace(/\]/g, '/');
    p = p.replace(/\/\//g, '/');
    p = `/${p}`

    var currentval = JSONPath({ path: p, json: obj });
    var patchArgs = {
        op: exist ? "replace" : "add",
        path: p,
        value: value
    }

    var copy = structuredClone(obj);
    try {
        const r = jsonpatch.applyPatch(copy, [patchArgs]);
        return r.newDocument;
    } catch (e) {
        console.log(e);
        return obj;
    }
}

const KubescapeRegoLibrary = ({ }) => {
    const [loaded, setLoaded] = useState(false);
    const [target, setTarget] = useState({
        scope: "",
        value: "",
    });

    const [lib, setLibrary] = useState<Lib>({ library: new Library() });
    const [result, setResult] = useState({});
    const [status, setStatus] = useState("Pass");
    const [fix, setFix] = useState(null);
    const [loadError, setLoadError] = useState(null);

    if (loadError) {
        return (
            <Box sx={{ width: '100%' }}>
                <Typography variant="h6" component="div" gutterBottom>
                    Error loading library.
                    It maybe problem with the CORS policy.

                    This is an ALPHA version.
                    Please visit https://cors-anywhere.herokuapp.com/
                    and click on the button "Request temporary access to the demo server".
                </Typography>
            </Box>
        )
    }
    if (!loaded) {
        lib.library.load()
            .then(() => lib.library.load_metadata())
            .then(() => setLoaded(true))
            .catch((err) => { console.log(err); setLoadError(err) });
    }

    const onTargetChange = (target) => {
        console.log("target changed", target);
        setTarget(target);
    }

    const handleResults = (results, input) => {
        console.log("handleResults", results, target);
        setResult(results);
        var status = "Pass";

        var failedControls = [];
        if (target.scope === "frameworks") {
            for (const [controlID, control] of Object.entries(results.results)) {
                if (control.results.length > 0) {
                    status = "Fail";
                    failedControls.push(control);
                }
            }
        }


        if (target.scope === "controls") {
            const rs = results.results;
            if (rs.length > 0) {
                status = "Fail";
                failedControls.push(results);
            }
        }

        setStatus(status);
        if (status === "Pass") {
            setFix(null);
            return;
        }

        var fixed = null;
        for (const control of failedControls) {
            for (const r of control.results) {

                if (!r.fixPaths || r.fixPaths.length == 0) {
                    continue;
                }

                for (const path of r.fixPaths) {
                    if (fixed == null) {
                        fixed = input;
                    }
                    fixed = patchObject(fixed, path.path, path.value);
                }
            }
        }
        setFix(fixed);
    }

    const onEval = (input) => {
        console.log("onEval", input);
        console.log("target", target);
        // console.log(lib.library[target.scope]);
        try {
            const rs = lib.library[target.scope][target.value].eval(input)
            console.log(rs);
            handleResults(rs, input);
        } catch (err) {
            console.log(err);
        }
    }

    const onApplyFix = (f) => {
        console.log("onApplyFix", f);
        setFix(null);
    }


    if (!loaded) {
        return (
            <Box
                sx={{
                    // Center the children
                    alignSelf: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Typography variant="h4" component="div" gutterBottom>
                    The Kubescape Rego Library is loading...
                </Typography>
                <LinearProgress />
            </Box>
        );
    }

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                p: 2,
            }}
        >
            <BasicTabs
                library={lib.library}
                onSelect={onTargetChange}
            />
            <Box
                sx={{
                    width: '100%',
                    padding: 2,
                }}
            >

                <Box
                    sx={{
                        // fixed position
                        position: 'fixed',
                        top: 20,
                        right: 20,
                        zIndex: 1000,

                    }}
                >

                    <CodeEditor
                        onExec={onEval}
                        onApplyChanges={onApplyFix}
                        status={status}
                        fixed={fix}
                    />
                </Box>
            </Box>
        </Box>
    )
}

export default KubescapeRegoLibrary;