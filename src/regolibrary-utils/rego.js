import { loadPolicy } from "@open-policy-agent/opa-wasm";
import pako from "pako";
import untar from "js-untar";
import * as jsyaml from 'js-yaml';
import isArrayBuffer from 'is-array-buffer';

const regolibraryPrefix = "armo_builtins";
const rulesPrefix = "rules";
const controlsPrefix = "controls";
const frameworksPrefix = "frameworks";
const denyRule = "deny";
const rawRule = "raw";
const filterRule = "filter";


/**
 * Library is an interface to the Kubescape Rego library.
 * It holds the controls and frameworks metadata, and it provides
 * methods to query the library for rules, controls and frameworks.
 * 
 * @example
 * // load the library
 * const library = new Library();
 * fetch("https://example.com/kubescape_regolibrary_bundle_wasm.tar.gz")
 *   .then(res => res.arrayBuffer())
 *   .then(buffer => library.loadBundle(buffer));
 * 
 * @example
 * // query the library using the explicit API
 * var rs = library.evaluateFramework("ArmoBest", input);
 * rs = library.evaluateControl("C-0001", input);
 * rs = library.evaluateRule("example-rule", input);
 * 
 * @example
 * // query the library using the implicit API
 * var rs = library.rules["example-rule"].eval(input);
 * rs = library.controls["C-0001"].eval(input);
 * rs = library.frameworks["ArmoBest"].eval(input);
 * 
 * // this enable evaluating without even knowing the type of the target
 * // for example
 * var target = {"kind": "frameworks", "name": "ArmoBest"};
 * var rs = library[target.kind][target.name].eval(input);
 * 
 * 
 * @example
 * // Set the controls inputs
 * // Can be done in bulk
 * const controlsInputs = await fetch("https://example.com/stored_controls_inputs.json")
 *                                .then(res => res.json());
 * library.setControlsInputs(controlsInputs); // set all controls inputs to {}
 * 
 * // or one by one
 * library.controlsInputs["cpu_limit_max"].set("100");
 * 
 * @example
 * // Get the controls inputs
 * // Can be done in bulk, useful for saving the controls inputs for later use
 * const controlsInputs = library.getControlsInputs();
 * 
 * // or one by one
 * const cpuLimitMax = library.controlsInputs["cpu_limit_max"].get();
 */
export class Library {

  /**
   * Eval function for a regolibrary object. It can be a rule, control or framework.
   * @name EvalFunction
   * @function
   * @param {Input} input The input to evaluate the regolibrary object with.
   * @returns {EvaluationResult} The evaluation result.
   */

  /**
   * Evaluable is an object that can be evaluated.
   * @typedef {Object} Evaluable
   * @property {EvalFunction} eval - The evaluation function.
   */

  /**
   * The opa policy wasm instance.
   * @private
   */
  policy;

  /**
   * The data channel for the evaluation.
   * @private
   */
  data;

  /**
   * Contains the configurable controls inputs.
   * More info about configurable controls:
   * https://hub.armosec.io/docs/configuration-parameters
   * @public
   * @readonly
   * @type {Object.<string, {name: string, description: string, get: function, set: function}>}
   * @example
   * // get the value of a configurable control
   * const values = library.controlsInputs["cpu_request_max"].get();
   * 
   * @example
   * // set the value of a configurable control
   * library.controlsInputs["cpu_request_max"].set(["100"]);
   */
  controlsInputs = {};

  /**
   * All the rules in the library.
   * @type {Object.<string, Evaluable>}
   * @public
   * @readonly
   */
  rules;

  /**
   * All the controls in the library.
   * @type {Object.<string, Evaluable>}
   * @public
   * @readonly
   */
  controls;

  /**
   * All the frameworks in the library.
   * @type {Object.<string, Evaluable>}
   * @public
   * @readonly
   */
  frameworks;

  constructor() {
    this.policy = null;
    this.data = null;
    this.controlsInputs = {};

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

  /**
   * Load the framework from an OPA wasm bundle tar.gz file.
   * @param {ArrayBuffer} bundleTarGzBuffer The bundle file as ArrayBuffer.
   * @throws {Error} If the bundle is invalid.
   * @returns {void}
   * @example
   * // from remote http URL
   * fetch("https://example.com/kubescape_regolibrary_bundle_wasm.tar.gz")
   *   .then(res => res.arrayBuffer())
   *   .then(buffer => regolibrary.loadBundle(buffer))
   * 
   * @example
   * // from local file
   * const fs = require('fs');
   * const bundleTarGzBuffer = fs.readFileSync("./kubescape_regolibrary_bundle_wasm.tar.gz");
   * library.loadBundle(bundleTarGzBuffer);
   */
  async load(bundleTarGzBuffer) {

    const tar = pako.inflate(bundleTarGzBuffer);
    const files = await untar(tar.buffer);

    // Most of the times the policy is the last file in the tar
    const lastFile = files[files.length - 1];
    if (lastFile.name === "/policy.wasm") {
      this.policy = await loadPolicy(lastFile.buffer, 8);
    }

    for (const file of files) {

      // Load the wasm policy itself
      if (file.name === "/policy.wasm") {
        this.policy = await loadPolicy(file.buffer, 8);
      }

      // Load the data channel
      if (file.name === "/data.json") {
        this.data = file.buffer;
      }

      // Load rules metadata
      if (file.name.startsWith("/rules/") && file.name.endsWith("raw.rego")) {
        try {
          this._loadRule(file.buffer);
        } catch (e) {
          console.error(new Error(`Rule doesn't contain metadata: ${file.name}`));
        }
      }
    }

    if (this.policy == null) {
      throw Object.assign(new Error("failed to load policy"));
    }

    if (this.data != null) {
      this.policy.setData(this.data);
      this.data = JSON.parse(new TextDecoder().decode(this.data));
    }

    // Load controls and frameworks with thei metadata
    this.loadMetadata();
    this._loadControlsInputsMetadata();
  }

  /**
   * Load the rule metadata from the OPA bundle annotations.
   * Unfortunately, currently the Rgolibrary build does not support fetching it
   * using simple evaluation (like the controls and frameworks).
   * More info about OPA annotations: https://www.openpolicyagent.org/docs/latest/annotations/
   * @param {ArrayBuffer} fileArrayBuffer A specific rule array buffer.
   * @returns {Object} The rule metadata.
   * @private
   */
  _loadRule(fileArrayBuffer) {
    const decoder = new TextDecoder();
    const fileString = decoder.decode(fileArrayBuffer);
    var fileLines = fileString.split("\n");

    const startLine = fileLines.findIndex(line => line === "# METADATA");
    fileLines = fileLines.slice(startLine + 1);

    const endLine = fileLines.findIndex(line => line === "");
    fileLines = fileLines.slice(0, endLine);

    const yamlSource = fileLines.map(line => line.slice(2)).join("\n");

    const rule = jsyaml.load(yamlSource).custom;
    rule["eval"] = (input) => this.evaluateRule(rule.name, input);

    this.rules[rule.name] = rule;
  }

  /**
   * Load the controls inputs metadata.
   * Because of the (pure) design of this feature,
   * the metadata for each control input field is inside the
   * rules metadata.
   * @private
   * @returns {void}
   */
  _loadControlsInputsMetadata() {
    for (const rule of Object.values(this.rules)) {
      if (!rule.controlConfigInputs) { continue; }
      for (const configOption of rule.controlConfigInputs) {
        // Options name
        const optionName = configOption.path.split(".").pop();
        delete configOption.path;

        // Getter and setter
        configOption["set"] = (value) => this._setControlsInputsOption(optionName, value);
        configOption["get"] = () => this.data.postureControlInputs[optionName];

        // Add to the library
        this.controlsInputs[optionName] = configOption;
      }
    }
  }


  // TODO: make this async
  _evaluate(entrypoint, input) {
    if (this.policy == null) {
      throw Object.assign(new Error("policy not loaded"));
    }

    // Check if entrypoint exists
    var entrypointNum = this.policy.entrypoints[entrypoint];
    if (entrypointNum === undefined) {
      throw Object.assign(new Error("entrypoint not found"));
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
      return this._evaluate(Library.formatEntrypoint(enrtypoint), input)[denyRule];
    } catch (error) {
      if (error === "entrypoint not found") {
        throw Object.assign(new Error(`${typ} not found: ${name}`));
      }
      throw error;
    }
  }

  _setControlsInputsOption(optionName, value) {
    if (!Array.isArray(value)) {
      value = [value];
    }
    if (!value.every(i => typeof i === "string")) {
      throw Object.assign(new Error("value must be a string or an array of strings"));
    }
    this._updateData(() => { this.data.postureControlInputs[optionName] = value; })
  }

  /**
   * A single resource, or a list of resources as input to the evaluation.
   * @typedef {(Object.<string, any>|object.<string, any>[])} Input
   */

  /**
   * Rule response.
   * @typedef {Object.<string, any>} RuleResponse
   */

  /**
   * Verbose evaluation result.
   * @typedef {Object[]} EvaluationResultVerbose
   */

  /**
   * Noraml evaluation result.
   * @typedef {Object} EvaluationResultNormal
   * @property {(RuleResponse[]|EvaluationResultNormal[]|Object.<string, EvaluationResultNormal>)} results
   */

  /**
   * Minimal evaluation result.
   * @typedef {RuleResponse[]} EvaluationResultMinimal
   */

  /**
   * Evaluation results.
   * @typedef {(EvaluationResultVerbose|EvaluationResultNormal|EvaluationResultMinimal)} EvaluationResult
   */

  /**
   * Controls inputs object. Some controls may require additional inputs.
   * For example, the memory limit control requires the memory limit value.
   * See https://hub.armosec.io/docs/configuration-parameters for more details.
   * @typedef {Object.<string, string[]>} ControlsInputs
   */

  /**
   * Eval a specific rule of the regolibrary.
   * @param {string} ruleName The rule to evaulate.
   * @param {Input} input The input to the rule.
   * @returns {EvaluationResult} The evaluation result.
   */
  evaluateRule(ruleName, input) {
    return this._evaluateRegolibraryObject(rulesPrefix, ruleName, input);
  }

  /**
   * Eval a specific control of the regolibrary.
   * @param {string} controlName The control to evaulate.
   * @param {Input} input The input to the control.
   * @returns {EvaluationResult} The evaluation result.
   */
  evaluateControl(controlID, input) {
    return this._evaluateRegolibraryObject(controlsPrefix, controlID, input);
  }

  /**
   * Eval a specific framework of the regolibrary.
   * @param {string} frameworkName The framework to evaulate.
   * @param {Input} input The input to the framework.
   * @returns {EvaluationResult} The evaluation result.
   */
  evaluateFramework(frameworkName, input) {
    return this._evaluateRegolibraryObject(frameworksPrefix, frameworkName, input);
  }

  _updateData(updater) {
    if (isArrayBuffer(this.data)) {
      this.data = JSON.parse(new TextDecoder().decode(this.data));
    }
    updater();
    this.policy.setData(this.data);
  }

  /**
   * Sets the results level to verbose.
   * @returns {void}
   */
  setResultLevelVerbose() {
    this._updateData(() => {
      this.data.settings.verbose = true;
    });
  }

  /**
   * Sets the results level to normal.
   * @returns {void}
   */
  setResultLevelNormal() {
    this._updateData(() => {
      this.data.settings.verbose = false;
      this.data.settings.metadata = true;
    });
  }

  /**
   * Sets the results level to minimal.
   * @returns {void}
   */
  setResultLevelMinimal() {
    this._updateData(() => {
      this.data.settings.verbose = false;
      this.data.settings.metadata = false;
    });
  }

  /**
   * Sets the whole controls inputs object
   * @param {ControlsInputs} inputs The control inputs.
   * @returns {void}
   */
  setControlsInputs(input) {
    this._updateData(() => {
      this.data.postureControlInputs = input;
    });
  }

  /**
   * Gets the whole current control inputs object.
   * @returns {ControlsInputs} The control inputs.
   */
  getControlsInputs() {
    if (isArrayBuffer(this.data)) {
      this.data = JSON.parse(new TextDecoder().decode(this.data));
    }
    return this.data.postureControlInputs;
  }
}