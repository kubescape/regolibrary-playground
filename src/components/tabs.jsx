import * as React from 'react';
import PropTypes from 'prop-types';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';

import MarkdownPreview from '@uiw/react-markdown-preview';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import { useMemo } from "react";
import Divider from '@mui/material/Divider';

import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';


// js-yaml is a library for parsing YAML
const severity_map = { 1: 'Low', 2: 'Low', 3: 'Low', 4: 'Medium', 5: 'Medium', 6: 'Medium', 7: 'High', 8: 'High', 9: 'Critical', 10: 'Critical' };

const generateControlReadme = (control) => {
    let md_text = '';
    md_text += '# ' + control.name;
    md_text += `${severity_map[control.baseScore]}\n`;
    md_text += '## Description of the the issue\n';
    if (control.long_description) {
        md_text += `${control.long_description}\n`;
    } else {
        md_text += `${control.description}\n`;
    }
    md_text += '## What does this control test\n';
    var test = control.description;
    if (control.test) {
        test = control.test;
    }
    md_text += `${test}\n`;

    return md_text;
}


const generateFrameworkReadme = (framework) => {
    let md_text = '';
    md_text += `# ${framework.name}\n`;
    md_text += `${framework.description}\n`;
    return md_text;
}


function ItemSelect({ options, value, onChange, name, getOptionLabel }) {
    var getOptLabel = (option) => (`${option.controlID} - ${option.name}`)
    if (getOptionLabel) {
        getOptLabel = getOptionLabel;
    }

    // console.log(value)
    return <Autocomplete
        value={value}
        onChange={(event, newValue) => onChange(newValue)}
        disablePortal
        id="combo-box-demo"
        options={options}
        sx={{ width: 300 }}
        getOptionLabel={getOptLabel}
        renderInput={(params) => <TextField {...params} label={name} variant="outlined" />}
    />
}

ItemSelect.propTypes = {
    options: PropTypes.array.isRequired,
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    sx: PropTypes.object,
    name: PropTypes.string.isRequired,
}

ItemSelect.defaultProps = {
    sx: {
        width: 120,
        flex: 1,
    },
}


function TabPanel(props) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`simple-tabpanel-${index}`}
            aria-labelledby={`simple-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box sx={{
                    p: 3,
                    textAlign: 'left',
                }}>
                    {children}
                </Box>
            )}
        </div>
    );
}

TabPanel.propTypes = {
    children: PropTypes.node,
    index: PropTypes.number.isRequired,
    value: PropTypes.number.isRequired,
};

function a11yProps(index) {
    return {
        id: `simple-tab-${index}`,
        'aria-controls': `simple-tabpanel-${index}`,
    };
}

export default function BasicTabs({ library, onSelect }) {
    const valToType = useMemo(() => ({
        0: "frameworks",
        1: "controls",
    }));

    const [tabNum, setTabNum] = React.useState(0);

    // Control and framework selection in saparate
    const [selectedControl, setSelectedControl] = React.useState(null);
    const [selectedFramework, setSelectedFramework] = React.useState(null);


    // Control and framework options
    const controlsOptions = useMemo(() => { return Object.entries(library.controls).map(([k, v]) => ({ controlID: k, name: v.name })) });
    const frameworksOptions = useMemo(() => { return Object.entries(library.frameworks).map(([k, v]) => ({ frameworkID: k, name: v.name })) });

    const handleChange = () => {
        const typ = valToType[tabNum];
        console.log("handle selection change", typ, selectedControl, selectedFramework);

    };


    const handleTabChange = (event, newTabNum) => {
        console.log("handle tab change", newTabNum);
        const typ = valToType[newTabNum];
        setTabNum(newTabNum);
        var val = "";
        switch (typ) {
            case "frameworks":
                if (selectedFramework) {
                    val = selectedFramework.frameworkID;
                }
                break;
            case "controls":
                if (selectedControl) {
                    val = selectedControl.controlID;
                }
                break;
        };
        onSelect({
            scope: typ,
            value: val,
        });
    };

    const handleControlChange = (control) => {
        console.log("handleControlChange", control);
        var val = "";
        if (control) {
            val = control.controlID;
        }
        onSelect({
            scope: "controls",
            value: val,
        })
        setSelectedControl(control);
    }

    const handleFrameworkChange = (framework) => {
        console.log("handleControlChange", framework);
        var val = "";
        if (framework) {
            val = framework.frameworkID;
        }
        onSelect({
            scope: "frameworks",
            value: val,
        })
        setSelectedFramework(framework);
    }

    var controlInfo = null;
    if (selectedControl && selectedControl.controlID in library.controls) {
        controlInfo = <MarkdownPreview warpperElement={{ "data-color-mode": "light" }} source={generateControlReadme(library.controls[selectedControl.controlID])} />
    } else {
        // Controls explanation
        controlInfo = (
            <div>
                Controls are the building blocks of the framework. They are the tests that are run on the system. Each control has a unique ID and a name. The ID is used to reference the control in the framework. The name is used to display the control in the UI.
                Please select a control from the list to see more information about it.
            </div>
        )
    }

    var frameworkInfo = null;
    if (selectedFramework && selectedFramework.frameworkID in library.frameworks) {
        frameworkInfo = <MarkdownPreview warpperElement={{ "data-color-mode": "light" }} source={generateFrameworkReadme(library.frameworks[selectedFramework.frameworkID])} />
    } else {
        // Frameworks explanation
        frameworkInfo = (
            <div>
                Frameworks are the tests that are run on the system. Each framework has a unique ID and a name. The ID is used to reference the framework in the system. The name is used to display the framework in the UI.
                Please select a framework from the list to see more information about it.
            </div>
        )
    }



    return (
        <Box sx={{ width: '100%' }} >
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={tabNum} onChange={handleTabChange} aria-label="basic tabs example">
                    <Tab label="Frameworks" {...a11yProps(0)} />
                    <Tab label="Controls" {...a11yProps(1)} />
                </Tabs>
            </Box>
            <TabPanel value={tabNum} index={0}>
                <Box sx={{ width: '100%', bgcolor: 'background.paper' }}>
                    <Box sx={{ my: 3, mx: 2 }}>
                        <ItemSelect
                            options={frameworksOptions}
                            value={selectedFramework}
                            onChange={handleFrameworkChange}
                            name="Framework"
                            getOptionLabel={(option) => option.frameworkID}
                        />
                    </Box>

                </Box>
                {frameworkInfo}
            </TabPanel>
            <TabPanel value={tabNum} index={1}>
                <Box sx={{ width: '100%', bgcolor: 'background.paper' }}>
                    <Box sx={{ my: 3, mx: 2 }}>
                        <ItemSelect
                            options={controlsOptions}
                            value={selectedControl}
                            onChange={handleControlChange}
                            name="Control"
                        />
                    </Box>

                </Box>
                {controlInfo}
            </TabPanel>
        </Box >
    );
}