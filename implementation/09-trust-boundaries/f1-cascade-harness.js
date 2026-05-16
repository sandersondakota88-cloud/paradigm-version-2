// f1-cascade-harness.js - Phase 9 F1: closure on emitted form

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const KERNEL_FIELD_PATH = path.join(__dirname, "kernel-src", "field.js");
const INTAKE_EXTENSION_PATH = path.join(__dirname, "field-intake-extension.js");
const CASCADE_EVALUATOR_PATH = path.join(__dirname, "kernel-cascade-evaluator.js");

// ----------------------------------------------------------------------------
// Build an isolated sandbox with field + intake-ext + cascade-evaluator.
// Returns { fieldModule, evaluator, sandbox }.
// ----------------------------------------------------------------------------
function buildSandbox() {
  const sandbox = {
    console: console,
    setTimeout: setTimeout,
    setImmediate: typeof setImmediate !== "undefined" ? setImmediate : null,
    Promise: Promise,
    Object: Object, Array: Array, Math: Math, JSON: JSON,
    Uint32Array: Uint32Array, Float64Array: Float64Array,
    Float32Array: Float32Array, Uint8Array: Uint8Array,
    Map: Map, Set: Set,
    Error: Error, TypeError: TypeError, RangeError: RangeError,
    String: String, Number: Number, Boolean: Boolean, Date: Date,
    performance: { now: function () { return Date.now(); } }
  };
  sandbox.globalThis = sandbox;
  sandbox.global = sandbox;
  vm.createContext(sandbox);

  // Load field.js (defines globalThis.FieldModule)
  const fieldSrc = fs.readFileSync(KERNEL_FIELD_PATH, "utf8");
  vm.runInContext(fieldSrc, sandbox, { filename: "field.js" });

  // Install intake extension (the deposition does this in SKELETON_INIT)
  const ext = require(INTAKE_EXTENSION_PATH);
  ext.install(sandbox.FieldModule);

  // Load cascade-evaluator (defines globalThis.KernelCascadeEvaluator)
  const evalSrc = fs.readFileSync(CASCADE_EVALUATOR_PATH, "utf8");
  vm.runInContext(evalSrc, sandbox, { filename: "kernel-cascade-evaluator.js" });

  sandbox.FieldModule.Field.reset();

  return {
    fieldModule: sandbox.FieldModule,
    field: sandbox.FieldModule.Field,
    evaluator: sandbox.KernelCascadeEvaluator,
    sandbox: sandbox
  };
}

// ----------------------------------------------------------------------------
// Convert a coords object into intake records the cascade-evaluator's
// buildCoordSnapshotFromIntake will reconstruct identically.
//
// Per kernel-cascade-evaluator.js sec "buildCoordSnapshotFromIntake":
//   record.type = "dom::<source>" (source is descriptive, not load-bearing)
//   record.value = { "<bare-dim-name>": "<value>", ... }
//
// IMPORTANT: the bridge convention is that the value-object keys are
// BARE dim names (no "data-" prefix). The matcher strips "data-" from
// the selector attribute and looks up the bare dim. If the intake
// records carry "data-foo" keys, the lookup fails.
// ----------------------------------------------------------------------------
function coordsToIntakeRecords(coords) {
  // Bundle all coords into a single record (order-stable; latest wins per
  // dim within a single record's value object is undefined behavior, so
  // we collect once)
  const value = {};
  for (const k of Object.keys(coords)) {
    const bare = k.indexOf("data-") === 0 ? k.substring(5) : k;
    value[bare] = String(coords[k]);
  }
  return [{
    type: "dom::harness",
    value: value,
    timestamp: 0,
    source: "f1-harness"
  }];
}

// ----------------------------------------------------------------------------
// runCascade(cascadeRules, coords)
//
// The replacement for simulateCascade.
// ----------------------------------------------------------------------------
function runCascade(cascadeRules, coords) {
  const ctx = buildSandbox();
  const field = ctx.field;

  // Inject the cascade rules as field constraints (after seed at [0])
  for (const rule of cascadeRules) {
    field.constraints.push(rule);
  }

  // Synthesize the coord state by publishing intake records
  const records = coordsToIntakeRecords(coords);
  for (const r of records) {
    field.intake.publish(r);
  }

  // Run the actual evaluator
  const result = ctx.evaluator.evaluateCascade(field);

  return {
    currentNextOp: result.currentNextOp,
    cascadeOutput: field.cascadeOutput || {},
    coordSnapshot: result.coordSnapshot,
    matchedCount: result.matchedCount,
    evaluatedCount: result.evaluatedCount,
    // Match-result wrapper shape compatible with simulateCascade callers:
    matched: result.currentNextOp !== null,
    op: result.currentNextOp
  };
}

// ----------------------------------------------------------------------------
// runCascadeAll(cascadeRules, coords)
//
// For P8: returns full cascadeOutput (multiple emit properties).
// ----------------------------------------------------------------------------
function runCascadeAll(cascadeRules, coords) {
  const r = runCascade(cascadeRules, coords);
  // Reshape cascadeOutput into a flat {prop: value} map for caller
  const emitted = {};
  for (const prop of Object.keys(r.cascadeOutput)) {
    emitted[prop] = r.cascadeOutput[prop].value;
  }
  return {
    currentNextOp: r.currentNextOp,
    emitted: emitted,
    matchedCount: r.matchedCount
  };
}

module.exports = Object.freeze({
  buildSandbox: buildSandbox,
  coordsToIntakeRecords: coordsToIntakeRecords,
  runCascade: runCascade,
  runCascadeAll: runCascadeAll
});
