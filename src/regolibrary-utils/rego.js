import { loadPolicy } from "@open-policy-agent/opa-wasm";
import bundle_url from "./bin/kubescape_regolibrary_bundle_wasm.tar.gz";
import frameworks_metadata from "./bin/frameworks.json";
import controls_metadata from "./bin/controls.json";

const pako = require("pako");
const untar = require("js-untar");


const regolibrary_prefix = "armo_builtins";
const rules_prefix = "rules";
const controls_prefix = "controls";
const frameworks_prefix = "frameworks";
const deny_rule = "deny";
const raw_rule = "raw";
const filter_rule = "filter";


async function myFetch(url) {
  const response = await fetch(url, {headers: {'X-Requested-With': 'https://github.com'}});
  return response;
}

async function NewLibrary() {
  var l = new Library();
  await l.load();
  await l.load_metadata();
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

  static _normalize_rule_name(rule_name) {
    return rule_name.replace(/[^a-zA-Z0-9]/g, "_");
  }

  format_entrypoint(entrypoint) {
    entrypoint.forEach(function (entry, index, theArray) {
      theArray[index] = Library._normalize_rule_name(entry);
    });
    return entrypoint.join("/");
  }

  async load_metadata() {
    const frameworks = frameworks_metadata;
    const controls = controls_metadata;

    for (var control of controls) {
      const normalized = Library._normalize_rule_name(control.id);
      if (this.controls[normalized] === undefined) {
        continue;
      }

      // Add metadata to control
      control.eval = this.controls[normalized].eval;
      this.controls[control.id] = control;

      // Set the real control ID as the key
      if (normalized != control.id) {
        delete this.controls[normalized];
      }
    }

    for (var framework of frameworks) {
      const normalized = Library._normalize_rule_name(framework.name);
      if (this.frameworks[normalized] === undefined) {
        continue;
      }

      // Add metadata to framework
      framework.eval = this.frameworks[normalized].eval;
      this.frameworks[framework.name] = framework;

      // Set the real framework name as the key
      if (normalized != framework.name) {
        delete this.frameworks[normalized];
      }
    }
  }

  async load() {
    const response = await myFetch(bundle_url,);
    const buffer = await response.arrayBuffer();
    const tar = pako.inflate(buffer);
    const files = await untar(tar.buffer);

    // Most of the times the policy is the last file in the tar
    const last_file = files[files.length - 1];
    if (last_file.name == "/policy.wasm") {
      this.policy = await loadPolicy(last_file.buffer, 8);
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
        metadata: false,
      };
      this.policy.setData(this.data);
    }

    for (const entry in this.policy.entrypoints) {
      const splitted = entry.split("/");
      if (splitted[0] != regolibrary_prefix) {
        continue;
      }

      if (splitted.length < 3) { continue; }
      const typ = splitted[1];
      const name = splitted[2];
      switch (typ) {
        case rules_prefix:
          this.rules[name] = { eval: (input) => this.evaluate_rule(name, input) };
          break;
        case controls_prefix:
          this.controls[name] = { eval: (input) => this.evaluate_control(name, input) };
          break;
        case frameworks_prefix:
          this.frameworks[name] = { eval: (input) => this.evaluate_framework(name, input) };
          break;
      }
    }
  }


  _evaluate(entrypoint, input) {
    if (this.policy == null) {
      throw "policy not loaded";
    }

    // Check if entrypoint exists
    var entrypoint_num = this.policy.entrypoints[entrypoint];
    if (entrypoint_num === undefined) {
      throw "entrypoint not found";
    }

    // Wrap input in array if it's not already
    if (!Array.isArray(input)) {
      input = [input];
    }

    var rs = this.policy.evaluate(input, entrypoint_num);

    return rs[0].result.deny;
  }

  evaluate_rule(rule_name, input) {
    var enrtypoint = [
      regolibrary_prefix,
      rules_prefix,
      rule_name,
      raw_rule,
    ];
    try {
      return this._evaluate(this.format_entrypoint(enrtypoint), input);
    } catch (error) {
      if (error == "entrypoint not found") {
        throw `rule not found: ${rule_name}`;
      } else {
        throw error;
      }
    }
  }

  evaluate_control(control_name, input) {
    var enrtypoint = [
      regolibrary_prefix,
      controls_prefix,
      control_name,
    ];
    try {
      return this._evaluate(this.format_entrypoint(enrtypoint), input);
    } catch (error) {
      if (error == "entrypoint not found") {
        throw `control not found: ${control_name}`;
      } else {
        throw error;
      }
    }
  }

  evaluate_framework(framework_name, input) {
    var enrtypoint = [
      regolibrary_prefix,
      frameworks_prefix,
      framework_name,
    ];
    try {
      var rs = this._evaluate(this.format_entrypoint(enrtypoint), input);
      return rs;
    } catch (error) {
      if (error == "entrypoint not found") {
        throw `framework not found: ${framework_name}`;
      } else {
        throw error;
      }
    }
  }
}

export default NewLibrary;