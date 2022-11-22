import CodeEditor from "./editor.tsx";
import BasicTabs from "./tabs";
import * as React from 'react';
import Box from '@mui/material/Box';

import { useState } from "react";
import { Library } from "../regolibrary-utils/rego";
import SplitterDemo from "./view";

interface Lib {
    library: Library;
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

    if (!loaded) {
        lib.library.load()
            .then(() => lib.library.load_metadata())
            .then(() => setLoaded(true))
            .catch((err) => console.log(err)
            );
    }

    const onTargetChange = (target) => {
        console.log("target changed", target);
        setTarget(target);
    }

    const handleResults = (results) => {
        console.log("handleResults", results, target);
        setResult(results);
        if (target.scope === "frameworks") {
            for (const control in results.result) {
                if (control.results.lenght > 0) {
                    setStatus("Fail");
                    break;
                }
            }
        }

        if (target.scope === "controls") {

            if (results.results.length > 0) {
                setStatus("Fail");
            }
        }
    }

    const onEval = (input) => {
        console.log("onEval", input);
        console.log("target", target);
        // console.log(lib.library[target.scope]);
        try {
            const rs = lib.library[target.scope][target.value].eval(input)
            console.log(rs);
            handleResults(rs);
        } catch (err) {
            console.log(err);
        }
    }

    if (!loaded) {
        return (<div>Loading...</div>);
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
            <CodeEditor
            onExec={onEval}
            status={status}
            />
        </Box>

    )
}

export default KubescapeRegoLibrary;