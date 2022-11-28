import * as JSONPatch from 'fast-json-patch';
import { JSONPath } from 'jsonpath-plus';

export default function recursiveJsonPatch(origin, path, val) {
    if (path === "") {
        return Object.assign(new Error("Cannot path object: empty path"));
    }

    var patchPath = path;
    patchPath = patchPath.replace(/\./g, '/');
    patchPath = patchPath.replace(/\[/g, '/');
    patchPath = patchPath.replace(/\]/g, '/');
    patchPath = patchPath.replace(/\/\//g, '/');
    patchPath = `/${patchPath}`
    const splitted = patchPath.split('/');


    const current = JSONPath({ path: path, json: origin });
    console.log(current);
    if (current.lenght > 1) { // recursion stop condition
        return JSONPatch.applyPatch(origin, [
            {
                op: "replace",
                path: patchPath,
                value: val
            }
        ]).newDocument;
    }

    const prev = splitted[splitted.length - 1];

    var prevJsonPath = "";
    if (path.endsWith("]")){
        prevJsonPath = path.slice(0, path.lastIndexOf("["));
    }else {
        prevJsonPath = path.slice(0, path.lastIndexOf("."));
    }

    const prevExists = JSONPath({ path: prevJsonPath, json: origin });
    if (!isNaN(prev)) {
        if (prevExists.length > 0) {
            var arr = prevExists[0];
            arr.push(val);
            return JSONPatch.applyPatch(origin, [
                {
                    op: "replace",
                    path: patchPath,
                    value: arr
                }
            ]).newDocument;
        }
        return recursiveJsonPatch(origin, prevJsonPath, [val])
    }

    if (prevExists.length > 0) {
        return JSONPatch.applyPatch(origin, [
            {
                op: "add",
                path: patchPath,
                value: val
            }
        ]).newDocument;
    }

    const fixed = {};
    fixed[prev] = val;


    return recursiveJsonPatch(origin, prevJsonPath, fixed)
}