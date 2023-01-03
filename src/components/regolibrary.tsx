/**
 * 
 */

import BasicTabs from "./tabs";
import * as React from 'react';
import Box from '@mui/material/Box';

import { useState } from "react";
import { Library } from "../regolibrary-utils/rego";
import Typography from "@mui/material/Typography";
import recursiveJsonPatch from '../regolibrary-utils/jsonpatch';
import bundleUrl from './bin/kubescape_regolibrary_bundle_wasm.tar.gz'
import Backdrop from '@mui/material/Backdrop';
import Spinner from 'react-spinkit';

const CodeEditor = React.lazy(() => import('./editor.tsx'));

interface Lib {
    library: Library;
}

/**
* function is marking the needed changes at the code
* @param obj refered to the full object which needs to fixed
* @param path refered to the specific path which needs to fixed in the file
* @param value refered to the specific value which needs to be fixed / changed
*/
function patchObject(obj: any, path: string, value: any) {
    try {
        const fixed = recursiveJsonPatch(obj, path, value);
        return fixed;
    } catch (e) {
        console.log("Failed to path object: ", obj, path, value);
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
    const [status, setStatus] = useState("");
    const [fix, setFix] = useState(null);
    const [loadError, setLoadError] = useState(null);

    if (loadError) {
        return (
            <Box sx={{ width: '100%' }}>
                <Typography variant="h6" component="div" gutterBottom>
                    Error loading library.
                </Typography>
            </Box>
        )
    }
    if (!loaded) {
        fetch(bundleUrl)
            .then(response => response.arrayBuffer())
            .then(bytes => lib.library.load(bytes))
            .then(() => setLoaded(true))
            .catch((err) => { console.log(err); setLoadError(err) });
    }

    const onTargetChange = (target) => {
        console.log("target changed", target);
        setStatus("");
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
        
        // set the scanning status
        setStatus(status);

        // skip document fix if status marked as Pass 
        if (status === "Pass") {
            setFix(null);
            return;
        }

        var fixed = null;

        // iterate by all detected failed controls in the document
        for (const control of failedControls) {
            for (const r of control.results) {
                // check if the path have failed path 
                if (!r.fixPaths || r.fixPaths.length === 0) {
                    if (fixed == null) {
                        fixed = input;
                    }
                    fixed = patchObject(fixed, r.failedPaths[0], r.failedPaths[0].value);       // mark fix options at the document 
                    continue;
                }

                // review all fix paths attributes which needs to be fixed
                for (const path of r.fixPaths) {
                    if (fixed == null) {
                        fixed = input;
                    }
                    fixed = patchObject(fixed, path.path, path.value);      // mark the needed changes at the HTML page 
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

    const Loading = ({open}) => (<Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={open}
    >
        <Box
            sx={{
                // center the spinner
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
            }}
        >
            <Spinner name="cube-grid" color="#3f51b5"
                style={{
                    height: '100px',
                    width: '100px',
                }} />
        </Box>
    </Backdrop>);


    return (
        <React.Suspense fallback={<Loading open={true} />}>
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
                        {/* Monaco is huge, so we must lazy load the editor */}
                        <CodeEditor
                            onExec={(target.scope && target.value) ? onEval : null}
                            onApplyChanges={onApplyFix}
                            status={status}
                            fixed={fix}
                        />

                    </Box>
                </Box>
            </Box>
        </React.Suspense>
    )
}

export default KubescapeRegoLibrary;