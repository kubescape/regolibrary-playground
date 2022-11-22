import ControlsDocsURL from './Controls.md';
import FrameworksDocsURL from './Frameworks.md';

export var ControlsDocs = ""

fetch(ControlsDocsURL)
    .then(response => response.text())
    .then(text => {
        ControlsDocs = text;
    });


export var FrameworksDocs = ""

fetch(FrameworksDocsURL)
    .then(response => response.text())
    .then(text => {
        FrameworksDocs = text;
    });