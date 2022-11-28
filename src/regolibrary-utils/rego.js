import { loadPolicy } from "@open-policy-agent/opa-wasm";
import pako from "pako";
import untar from "js-untar";

const regolibraryPrefix = "armo_builtins";
const rulesPrefix = "rules";
const controlsPrefix = "controls";
const frameworksPrefix = "frameworks";
const denyRule = "deny";
const rawRule = "raw";
const filterRule = "filter";


async function NewLibrary() {
  var l = new Library();
  await l.load();
  return l;
};

export class Library {
  constructor() {
    this.policy = null;
    this.data = null;
    this.rules = {};
    this.controls = {};
    this.frameworks = {};
  }

  static NormalizeRuleName(ruleName) {
    return ruleName.replace(/[^a-zA-Z0-9]/g, "_");
  }

  static formatEntrypoint(entrypoint) {
    entrypoint.forEach(function (entry, index, theArray) {
      theArray[index] = Library.NormalizeRuleName(entry);
    });
    return entrypoint.join("/");
  }

  loadMetadata() {
    const frameworks = {};
    const controls = {};

    // Get contorls metadata
    const ctrlsRes = this._evaluate(Library.formatEntrypoint([regolibraryPrefix, controlsPrefix]), []);
    for (const [entry, results] of Object.entries(ctrlsRes)) {
      const control = results[denyRule];
      delete control['result'];
      control['eval'] = (input) => this.evaluateControl(entry, input);
      controls[control.controlID] = control;
    }

    // Get frameworks metadata
    const fwRes = this._evaluate(Library.formatEntrypoint([regolibraryPrefix, frameworksPrefix]), []);
    for (const [entry, results] of Object.entries(fwRes)) {
      const framework = results[denyRule];
      delete framework['result'];
      framework['eval'] = (input) => this.evaluateFramework(entry, input);
      frameworks[framework.name] = framework;
    }

    this.controls = controls;
    this.frameworks = frameworks;
  }

  async load(bundleTarGzBuffer) {

    const tar = pako.inflate(bundleTarGzBuffer);
    const files = await untar(tar.buffer);

    // Most of the times the policy is the last file in the tar
    const lastFile = files[files.length - 1];
    if (lastFile.name == "/policy.wasm") {
      this.policy = await loadPolicy(lastFile.buffer, 8);
    }

    for (const file of files) {
      if (file.name == "/policy.wasm") {
        this.policy = await loadPolicy(file.buffer, 8);
      }
      if (file.name == "/data.json") {
        this.data = file.buffer;
      }

      if (this.policy != null && this.data != null) {
        break;
      }
    }

    if (this.policy == null) {
      throw "failed to load policy";
    }

    if (this.data != null) {
      var data = JSON.parse(new TextDecoder().decode(this.data));
      data.settings = {
        verbose: false,
        metadata: true,
      };
      this.policy.setData(this.data);
    }

    // Load controls and frameworks with thei metadata
    this.loadMetadata();

    // Load rules
    for (const entry in this.policy.entrypoints) {
      const splitted = entry.split("/");
      if (splitted[0] != regolibraryPrefix || splitted.length < 3) {
        continue;
      }

      const typ = splitted[1];
      const name = splitted[2];
      if (typ != rulesPrefix) { continue; }
      this.rules[name] = { eval: (input) => this.evaluateRule(name, input) };

    }
  }

  // TODO: make this async
  _evaluate(entrypoint, input) {
    if (this.policy == null) {
      throw "policy not loaded";
    }

    // Check if entrypoint exists
    var entrypointNum = this.policy.entrypoints[entrypoint];
    if (entrypointNum === undefined) {
      throw "entrypoint not found";
    }

    // Wrap input in array if it's not already
    if (!Array.isArray(input)) {
      input = [input];
    }

    var rs = this.policy.evaluate(input, entrypointNum);

    return rs[0].result;
  }

  _evaluateRegolibraryObject(typ, name, input) {
    var enrtypoint = [
      regolibraryPrefix,
      typ,
      name,
    ];
    try {
      return this._evaluate(this.formatEntrypoint(enrtypoint), input)[denyRule];
    } catch (error) {
      if (error == "entrypoint not found") {
        throw `${typ} not found: ${name}`;
      }
      throw error;
    }
  }

  evaluateRule(ruleName, input) {
    return this._evaluateRegolibraryObject(rulesPrefix, ruleName, input);
  }

  evaluateControl(controlID, input) {
    return this._evaluateRegolibraryObject(controlsPrefix, controlID, input);
  }

  evaluateFramework(frameworkName, input) {
    return this._evaluateRegolibraryObject(frameworksPrefix, frameworkName, input);
  }
}

export default NewLibrary;