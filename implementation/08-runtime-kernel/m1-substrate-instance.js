// m1-substrate-instance.js - Phase 8 M1 - substrate-instance factory

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const KERNEL_FIELD_PATH = path.join(__dirname, "kernel-src", "field.js");
const INTAKE_EXTENSION_PATH = path.join(__dirname, "field-intake-extension.js");

// ----------------------------------------------------------------------------
// createSubstrate(opts)
//
// Returns an isolated substrate instance. Each call produces a fresh
// field, trace, and intake; mutations to one instance do not affect
// another.
//
// opts:
//   id       (string)  - identifier for diagnostic; default "substrate-anon"
//   sandbox  (object)  - additional sandbox globals (rare)
//
// Returns:
//   {
//     id: string,
//     fieldModule: { Field, Trace, ... },   // per-instance module
//     field: Field,                          // convenience: fieldModule.Field
//     // O-class observer surface
//     observe(): { id, step, constraintCount, traceLength }
//   }
// ----------------------------------------------------------------------------
function createSubstrate(opts) {
  opts = opts || {};
  const id = String(opts.id || "substrate-anon");

  // Build a fresh sandbox per instance. This is the isolation boundary:
  // the field.js loaded into this sandbox has its own module-level state.
  const sandbox = Object.assign({
    console: console,
    setTimeout: setTimeout,
    setImmediate: typeof setImmediate !== "undefined" ? setImmediate : null,
    Promise: Promise,
    Object: Object,
    Array: Array,
    Math: Math,
    JSON: JSON,
    Uint32Array: Uint32Array,
    Float64Array: Float64Array,
    Float32Array: Float32Array,
    Uint8Array: Uint8Array,
    Map: Map,
    Set: Set,
    Error: Error,
    TypeError: TypeError,
    RangeError: RangeError,
    String: String,
    Number: Number,
    Boolean: Boolean,
    Date: Date,
    performance: { now: function () { return Date.now(); } }
  }, opts.sandbox || {});
  sandbox.globalThis = sandbox;
  sandbox.global = sandbox;
  vm.createContext(sandbox);

  // Load field.js into the sandbox - this is the per-instance kernel
  const fieldSrc = fs.readFileSync(KERNEL_FIELD_PATH, "utf8");
  vm.runInContext(fieldSrc, sandbox, { filename: "field.js" });

  // Install the intake extension (Phase 8 SE-08 contributor pathway)
  const ext = require(INTAKE_EXTENSION_PATH);
  ext.install(sandbox.FieldModule);

  // Reset to canonical starting state
  sandbox.FieldModule.Field.reset();

  return {
    id: id,
    fieldModule: sandbox.FieldModule,
    field: sandbox.FieldModule.Field,
    sandbox: sandbox,   // exposed for advanced cases (testing only)

    observe() {
      const f = sandbox.FieldModule.Field;
      return {
        id: id,
        step: f.step,
        constraintCount: f.constraints.length,
        traceLength: sandbox.FieldModule.Trace.entries.length,
        intakeRecords: f.intake ? f.intake.records.length : 0
      };
    },

    // teardown: reset state. Caller wanting full isolation should
    // discard this instance and call createSubstrate() again.
    teardown() {
      sandbox.FieldModule.Field.reset();
      if (sandbox.FieldModule.Trace.entries) {
        sandbox.FieldModule.Trace.entries.length = 0;
      }
    }
  };
}

module.exports = Object.freeze({
  createSubstrate: createSubstrate
});
