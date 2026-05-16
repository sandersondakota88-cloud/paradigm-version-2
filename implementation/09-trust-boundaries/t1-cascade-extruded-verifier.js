// t1-cascade-extruded-verifier.js - P4: T1 migration verification

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const T1ext = require("./t1-cascade-extruded.js");
const T1 = require("./t1-skeptical-intake.js");
const FieldExt = require("./field-intake-extension.js");

let pass = 0, fail = 0;
const failures = [];

function test(name, fn) {
  try { fn(); pass++; console.log("  OK   " + name); }
  catch (e) { fail++; failures.push({ name, error: e }); console.log("  FAIL " + name + ": " + e.message); }
}
function assert(c, m) { if (!c) throw new Error("assertion failed: " + (m || "")); }

function buildField() {
  const sandbox = {
    console, setTimeout, setImmediate, Promise, Object, Array, Math, JSON,
    Uint32Array, Float64Array, Float32Array, Uint8Array,
    Map, Set, Error, TypeError, RangeError, String, Number, Boolean, Date,
    performance: { now: () => Date.now() }
  };
  sandbox.globalThis = sandbox; sandbox.global = sandbox;
  vm.createContext(sandbox);
  const fieldSrc = fs.readFileSync(
    path.join(__dirname, "kernel-src", "field.js"), "utf8");
  vm.runInContext(fieldSrc, sandbox, { filename: "field.js" });
  FieldExt.install(sandbox.FieldModule);
  sandbox.FieldModule.Field.reset();
  return sandbox.FieldModule;
}

function countIntakeByType(field, t) {
  return field.intake.records.filter(r => r && r.type === t).length;
}

console.log("t1-cascade-extruded verification");
console.log("");

// ----------------------------------------------------------------------------
// PART A: K2 adapter has no source registry
// ----------------------------------------------------------------------------
console.log("PART A: K2 adapter shrunk (no source registry in JS)");
console.log("");

test("CascadeExtrudedStamper has no sourceRegistry field", () => {
  const fm = buildField();
  const stamper = new T1ext.CascadeExtrudedStamper({ field: fm.Field });
  assert(typeof stamper.sourceRegistry === "undefined",
    "stamper should not hold a source registry");
});

test("CascadeExtrudedStamper.ingest publishes source-id, not source-class", () => {
  const fm = buildField();
  const stamper = new T1ext.CascadeExtrudedStamper({ field: fm.Field });
  stamper.ingest({
    record: { source: "partner-a.example.com", value: "x" },
    timeNow: 0
  });
  const stamp = fm.Field.intake.records.find(
    r => r && r.type === "dom::source-stamp");
  assert(stamp);
  // source-id IS published
  assert(stamp.value["incoming-source-id"] === "partner-a.example.com",
    "stamp publishes source-id");
  // source-class is NOT published (cascade will derive it)
  assert(typeof stamp.value["incoming-source-class"] === "undefined",
    "stamp must NOT pre-classify");
});

test("Module source contains no source-registry data structure", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "t1-cascade-extruded.js"), "utf8");
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  // No DEFAULT_SOURCE_REGISTRY or similar lookup table
  assert(stripped.indexOf("DEFAULT_SOURCE_REGISTRY") < 0,
    "no JS-side registry");
  assert(stripped.indexOf("sourceRegistry") < 0,
    "no JS-side registry field");
});

// ----------------------------------------------------------------------------
// PART B: end-to-end equivalence with original T1
// ----------------------------------------------------------------------------
console.log("");
console.log("PART B: end-to-end - same dispatch outcomes as T1");
console.log("");

test("Trusted partner + valid record -> process-trusted-record arm", () => {
  const fm = buildField();
  const stamper = new T1ext.CascadeExtrudedStamper({ field: fm.Field });
  const ingested = stamper.ingest({
    record: { source: "partner-a.example.com", value: { x: 1 } },
    timeNow: 0
  });
  const result = T1ext.resolveAndDispatch(fm.Field, {
    "incoming-source-id": ingested.sourceId,
    "incoming-source-rate-ok": ingested.rateOk ? "1" : "0",
    "incoming-record-shape": ingested.shape
  }, { timeNow: 0 });
  assert(result.sourceClassResolved === "trusted",
    "outer cascade resolves source-class to trusted");
  assert(result.dispatched === "process-trusted-record",
    "inner cascade dispatches process-trusted-record");
  assert(result.executed);
  assert(countIntakeByType(fm.Field, "arm-result::process-trusted") === 1);
});

test("Public source + rate-ok + valid -> process-public-record", () => {
  const fm = buildField();
  const stamper = new T1ext.CascadeExtrudedStamper({ field: fm.Field });
  const ingested = stamper.ingest({
    record: { source: "anon.example.com", value: { x: 1 } },
    timeNow: 0
  });
  const result = T1ext.resolveAndDispatch(fm.Field, {
    "incoming-source-id": ingested.sourceId,
    "incoming-source-rate-ok": ingested.rateOk ? "1" : "0",
    "incoming-record-shape": ingested.shape
  }, { timeNow: 0 });
  assert(result.sourceClassResolved === "public");
  assert(result.dispatched === "process-public-record");
});

test("Public source + throttled -> sacrifice-throttled-record", () => {
  const fm = buildField();
  const stamper = new T1ext.CascadeExtrudedStamper({
    field: fm.Field,
    rateLimitPublic: 1,
    rateWindowMs: 1000
  });
  // First publish: under limit
  stamper.ingest({
    record: { source: "anon.example.com", value: 1 },
    timeNow: 0
  });
  // Second publish: over limit (limit=1, window=1000ms, both at t=0)
  const ingested2 = stamper.ingest({
    record: { source: "anon.example.com", value: 2 },
    timeNow: 0
  });
  assert(ingested2.rateOk === false, "second ingest should be throttled");
  const result = T1ext.resolveAndDispatch(fm.Field, {
    "incoming-source-id": ingested2.sourceId,
    "incoming-source-rate-ok": ingested2.rateOk ? "1" : "0",
    "incoming-record-shape": ingested2.shape
  }, { timeNow: 0 });
  assert(result.dispatched === "sacrifice-throttled-record");
});

test("Malformed record -> sacrifice-malformed-record (regardless of source)", () => {
  const fm = buildField();
  const stamper = new T1ext.CascadeExtrudedStamper({ field: fm.Field });
  const ingested = stamper.ingest({
    record: { source: "partner-a.example.com", value: "x" },
    timeNow: 0,
    recordShape: "malformed"
  });
  const result = T1ext.resolveAndDispatch(fm.Field, {
    "incoming-source-id": ingested.sourceId,
    "incoming-source-rate-ok": ingested.rateOk ? "1" : "0",
    "incoming-record-shape": ingested.shape
  }, { timeNow: 0 });
  assert(result.dispatched === "sacrifice-malformed-record");
});

// ----------------------------------------------------------------------------
// PART C: registry as text - adding a new partner
// ----------------------------------------------------------------------------
console.log("");
console.log("PART C: registry is cascade-rule text");
console.log("");

test("REGISTRY_OUTER_CASCADE is a string, not a JS object", () => {
  assert(typeof T1ext.REGISTRY_OUTER_CASCADE === "string");
});

test("Adding a partner = appending a cascade rule", () => {
  // Demonstrate that a new deployment can extend the registry by
  // text concatenation. We construct a custom rule set, run cascade
  // against a new partner-id, and verify it classifies correctly.
  const customRegistry = T1ext.REGISTRY_OUTER_CASCADE +
    '\n[data-substrate-state][data-incoming-source-id="new-partner.example.com"] { --source-class: "trusted"; }';

  const Orch = require("./cascade-orchestrator.js");
  const result = Orch.runPasses([
    {
      rules: customRegistry,
      promotionMap: { "--source-class": "data-source-class" }
    }
  ], {
    "data-substrate-state": "",
    "data-incoming-source-id": "new-partner.example.com"
  });
  assert(result.passes[0].promoted["data-source-class"] === "trusted",
    "new partner classified as trusted via appended rule");
});

test("Different deployments use different REGISTRY_OUTER_CASCADE", () => {
  // Deployment A: only partner-a is trusted
  const deploymentA = '[data-substrate-state][data-incoming-source-id] { --source-class: "public"; }\n[data-substrate-state][data-incoming-source-id="partner-a.example.com"] { --source-class: "trusted"; }';
  // Deployment B: only partner-b is trusted
  const deploymentB = '[data-substrate-state][data-incoming-source-id] { --source-class: "public"; }\n[data-substrate-state][data-incoming-source-id="partner-b.example.com"] { --source-class: "trusted"; }';

  const Orch = require("./cascade-orchestrator.js");
  const promotionMap = { "--source-class": "data-source-class" };

  // Same source-id, different deployments
  const sourceId = "partner-a.example.com";
  const initial = {
    "data-substrate-state": "",
    "data-incoming-source-id": sourceId
  };
  const rA = Orch.runPasses([{ rules: deploymentA, promotionMap }], initial);
  const rB = Orch.runPasses([{ rules: deploymentB, promotionMap }], initial);
  assert(rA.finalCoords["data-source-class"] === "trusted",
    "deployment A treats partner-a as trusted");
  assert(rB.finalCoords["data-source-class"] === "public",
    "deployment B treats partner-a as public (only partner-b is trusted there)");
});

// ----------------------------------------------------------------------------
// PART D: structural integrity (closure, F3, F5, SE-01)
// ----------------------------------------------------------------------------
console.log("");
console.log("PART D: structural integrity");
console.log("");

test("Module: no constraints.push, no field.ratify", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "t1-cascade-extruded.js"), "utf8");
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert(stripped.indexOf("constraints.push") < 0);
  assert(!/field\.ratify\s*\(/.test(stripped));
  assert(stripped.indexOf("_mkPredictive") < 0);
});

test("Module: no JS-resident result cache", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "t1-cascade-extruded.js"), "utf8");
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert(stripped.indexOf("__substrateResults") < 0);
  assert(stripped.indexOf("admittedRecords") < 0);
  assert(stripped.indexOf("class TrustObserver") < 0);
});

test("Module: ASCII-only", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "t1-cascade-extruded.js"), "utf8");
  const m = src.match(/[^\x00-\x7F]/);
  assert(!m, "non-ASCII: " + (m && m[0]));
});

test("F5 honored: ingest does not mutate field.constraints", () => {
  const fm = buildField();
  const stamper = new T1ext.CascadeExtrudedStamper({ field: fm.Field });
  const before = fm.Field.constraints.slice();
  for (let i = 0; i < 50; i++) {
    stamper.ingest({
      record: { source: "any.example.com", value: i },
      timeNow: i
    });
  }
  // K2 adapter publishes intake; doesn't mutate constraints
  assert(fm.Field.constraints.length === before.length);
});

test("Same source-id at multiple time points -> deterministic dispatch", () => {
  // Per F5 + determinism: identical inputs produce identical outputs
  const fm = buildField();
  const stamper = new T1ext.CascadeExtrudedStamper({ field: fm.Field });
  const stamp = {
    "incoming-source-id": "partner-a.example.com",
    "incoming-source-rate-ok": "1",
    "incoming-record-shape": "valid"
  };
  const r1 = T1ext.resolveAndDispatch(fm.Field, stamp, { timeNow: 0 });
  const r2 = T1ext.resolveAndDispatch(fm.Field, stamp, { timeNow: 1 });
  const r3 = T1ext.resolveAndDispatch(fm.Field, stamp, { timeNow: 2 });
  assert(r1.dispatched === r2.dispatched);
  assert(r2.dispatched === r3.dispatched);
  assert(r1.dispatched === "process-trusted-record");
});

// ----------------------------------------------------------------------------
// PART E: SE-01 compositional cascade structure visible
// ----------------------------------------------------------------------------
console.log("");
console.log("PART E: SE-01 compositional cascade structure");
console.log("");

test("Outer cascade output appears in resolveAndDispatch result", () => {
  const fm = buildField();
  const result = T1ext.resolveAndDispatch(fm.Field, {
    "incoming-source-id": "partner-a.example.com",
    "incoming-source-rate-ok": "1",
    "incoming-record-shape": "valid"
  }, { timeNow: 0 });
  // sourceClassResolved IS the outer cascade's output
  assert(result.sourceClassResolved === "trusted",
    "outer cascade output observable");
  // finalCoords has the promoted source-class as a coord (inner pass input)
  assert(result.finalCoords["data-source-class"] === "trusted");
});

test("Source-class IS the outer coordinate (per SE-01)", () => {
  // Per SE-01: "the outer cascade resolves first - its rules
  // determine which sub-cascade is active for a given outer
  // coordinate." Source-class is the outer coordinate; different
  // values activate different inner-cascade rules.
  const fm = buildField();
  const trustedR = T1ext.resolveAndDispatch(fm.Field, {
    "incoming-source-id": "partner-a.example.com",
    "incoming-source-rate-ok": "1",
    "incoming-record-shape": "valid"
  }, { timeNow: 0 });
  const publicR = T1ext.resolveAndDispatch(fm.Field, {
    "incoming-source-id": "stranger.example.com",
    "incoming-source-rate-ok": "1",
    "incoming-record-shape": "valid"
  }, { timeNow: 1 });
  // Different source-class outputs from outer cascade -> different
  // inner cascade activations -> different dispatch
  assert(trustedR.sourceClassResolved !== publicR.sourceClassResolved);
  assert(trustedR.dispatched !== publicR.dispatched);
});

console.log("");
console.log("==========================================================");
console.log("Summary: " + pass + " passed, " + fail + " failed");
if (fail > 0) {
  for (const f of failures) {
    console.log("  - " + f.name);
    console.log("    " + (f.error.stack || f.error.message));
  }
  process.exit(1);
}
process.exit(0);
