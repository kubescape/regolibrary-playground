import { loadPolicy } from "@open-policy-agent/opa-wasm";
import pako from "pako";
import untar from "js-untar";
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
      if (file.name === "/policy.wasm") {
        this.policy = await loadPolicy(file.buffer, 8);
      }
      if (file.name === "/data.json") {
        this.data = file.buffer;
      }

      if (this.policy != null && this.data != null) {
        break;
      }
    }

    if (this.policy == null) {
      throw Object.assign(new Error("failed to load policy"));
    }

    if (this.data != null) {
      this.policy.setData(this.data);
    }

    // Load controls and frameworks with thei metadata
    this.loadMetadata();

    // Load rules
    for (const entry in this.policy.entrypoints) {
      const splitted = entry.split("/");
      if (splitted[0] !== regolibraryPrefix || splitted.length < 3) {
        continue;
      }

      const typ = splitted[1];
      const name = splitted[2];
      if (typ !== rulesPrefix) { continue; }
      this.rules[name] = { eval: (input) => this.evaluateRule(name, input) };

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
   * Sets the control inputs.
   * @param {ControlsInputs} inputs The control inputs.
   * @returns {void}
   */
  setControlsInputs(input) {
    this._updateData(() => {
      this.data.postureControlInputs = input;
    });
  }

  /**
   * Gets the current control inputs.
   * @returns {ControlsInputs} The control inputs.
   */
  getControlsInputs() {
    if (isArrayBuffer(this.data)) {
      this.data = JSON.parse(new TextDecoder().decode(this.data));
    }
    return this.data.postureControlInputs;
  }
}