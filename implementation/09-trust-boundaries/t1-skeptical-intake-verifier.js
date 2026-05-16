// t1-skeptical-intake-verifier.js - T1: cascade-dispatched arm acceptance

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const T1 = require("./t1-skeptical-intake.js");
const F1Harness = require("./f1-cascade-harness.js");
const Synth = require("./cascade-rule-synthesizer.js");

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
  const ext = require(path.join(__dirname, "field-intake-extension.js"));
  ext.install(sandbox.FieldModule);
  sandbox.FieldModule.Field.reset();
  return sandbox.FieldModule;
}

// Resolve --next-op for a given coord state by running cascade through
// the actual evaluator (F1Harness, which is what P2/P8/etc. use)
function resolveNextOp(stampValue) {
  const synth = Synth.synthesizeFromCss(T1.REFERENCE_TRUST_RULES);
  if (!synth.ok) throw new Error("synth failed");
  const coords = {
    "data-substrate-state": "",
    "data-incoming-source-class": stampValue["incoming-source-class"] || "",
    "data-incoming-source-rate-ok": stampValue["incoming-source-rate-ok"] || "",
    "data-incoming-record-shape": stampValue["incoming-record-shape"] || ""
  };
  const r = F1Harness.runCascade(synth.constraints, coords);
  return r.cascadeOutput || {};
}

function countIntakeByType(field, t) {
  return field.intake.records.filter(r => r && r.type === t).length;
}

console.log("t1-skeptical-intake verification (cascade-dispatched arms)");
console.log("");

// ----------------------------------------------------------------------------
// PART A: cascade dispatches the right arm per record class
// ----------------------------------------------------------------------------
console.log("PART A: cascade -> arm dispatch");
console.log("");

test("Reference trust rules synthesize to 4 arm-dispatch constraints", () => {
  const r = Synth.synthesizeFromCss(T1.REFERENCE_TRUST_RULES);
  assert(r.ok, "synth failed: " + JSON.stringify(r.errors));
  assert(r.constraints.length === 4);
});

test("Trusted + valid -> --next-op = process-trusted-record", () => {
  const co = resolveNextOp({
    "incoming-source-class": "trusted",
    "incoming-source-rate-ok": "1",
    "incoming-record-shape": "valid"
  });
  assert(co["--next-op"], "--next-op set");
  assert(co["--next-op"].value === "process-trusted-record",
    "got " + co["--next-op"].value);
});

test("Public + rate-ok + valid -> --next-op = process-public-record", () => {
  const co = resolveNextOp({
    "incoming-source-class": "public",
    "incoming-source-rate-ok": "1",
    "incoming-record-shape": "valid"
  });
  assert(co["--next-op"].value === "process-public-record");
});

test("Public + throttled -> --next-op = sacrifice-throttled-record", () => {
  const co = resolveNextOp({
    "incoming-source-class": "public",
    "incoming-source-rate-ok": "0",
    "incoming-record-shape": "valid"
  });
  assert(co["--next-op"].value === "sacrifice-throttled-record",
    "got " + co["--next-op"].value);
});

test("Malformed shape -> --next-op = sacrifice-malformed-record", () => {
  const co = resolveNextOp({
    "incoming-source-class": "trusted",
    "incoming-source-rate-ok": "1",
    "incoming-record-shape": "malformed"
  });
  assert(co["--next-op"].value === "sacrifice-malformed-record");
});

test("Unknown source class + valid -> cascade silent", () => {
  const co = resolveNextOp({
    "incoming-source-class": "shadowy-cabal",
    "incoming-source-rate-ok": "1",
    "incoming-record-shape": "valid"
  });
  assert(!co["--next-op"], "no --next-op when no rule matches");
});

// ----------------------------------------------------------------------------
// PART B: SourceStamper - K2 adapter unchanged
// ----------------------------------------------------------------------------
console.log("");
console.log("PART B: SourceStamper");
console.log("");

test("Stamper publishes record + source-stamp through intake", () => {
  const fm = buildField();
  const stamper = new T1.SourceStamper({ field: fm.Field });
  stamper.ingest({
    record: { type: "external::record", value: { x: 1 } },
    sourceId: "partner-a.example.com",
    timeNow: 0
  });
  assert(countIntakeByType(fm.Field, "external::record") === 1);
  assert(countIntakeByType(fm.Field, "dom::source-stamp") === 1);
});

test("Stamper classifies trusted vs public by registry", () => {
  const fm = buildField();
  const stamper = new T1.SourceStamper({ field: fm.Field });
  const r1 = stamper.ingest({
    record: { type: "x", value: 1 },
    sourceId: "partner-a.example.com",
    timeNow: 0
  });
  const r2 = stamper.ingest({
    record: { type: "x", value: 2 },
    sourceId: "anon.example.com",
    timeNow: 0
  });
  assert(r1.sourceClass === "trusted");
  assert(r2.sourceClass === "public");
});

test("Stamper rate-limits public sources only", () => {
  const fm = buildField();
  const stamper = new T1.SourceStamper({ field: fm.Field });
  // Trusted: many ingests, all rate-ok
  for (let i = 0; i < 50; i++) {
    const r = stamper.ingest({
      record: { type: "x", value: i },
      sourceId: "partner-a.example.com",
      timeNow: i * 10
    });
    assert(r.rateOk === true);
  }
  // Public: hit limit and flip
  let lastOk = true;
  for (let i = 0; i < T1.RATE_LIMIT_PUBLIC + 3; i++) {
    const r = stamper.ingest({
      record: { type: "x", value: i },
      sourceId: "anon.example.com",
      timeNow: i * 10
    });
    lastOk = r.rateOk;
  }
  assert(lastOk === false);
});

// ----------------------------------------------------------------------------
// PART C: dispatchArm - cascade output drives arm execution
// ----------------------------------------------------------------------------
console.log("");
console.log("PART C: dispatchArm fires the right arm");
console.log("");

test("dispatchArm with no --next-op: nothing executed", () => {
  const fm = buildField();
  const r = T1.dispatchArm(fm.Field, {});
  assert(r.dispatched === null);
  assert(r.executed === false);
});

test("dispatchArm with unrecognized --next-op: no arm registered", () => {
  const fm = buildField();
  const r = T1.dispatchArm(fm.Field, {
    "--next-op": { value: "totally-unknown-op" }
  });
  assert(r.dispatched === "totally-unknown-op");
  assert(r.executed === false);
  assert(r.reason === "no-arm-registered");
});

test("dispatchArm fires process-trusted: arm-result::process-trusted in intake", () => {
  const fm = buildField();
  const stamper = new T1.SourceStamper({ field: fm.Field });
  stamper.ingest({
    record: { type: "external::record", value: { x: 1 } },
    sourceId: "partner-a.example.com",
    timeNow: 0
  });
  const r = T1.dispatchArm(fm.Field, {
    "--next-op": { value: "process-trusted-record" }
  });
  assert(r.executed === true);
  assert(r.armResult.fired === true);
  assert(r.armResult.kind === "process");
  assert(countIntakeByType(fm.Field, "arm-result::process-trusted") === 1);
});

test("dispatchArm fires sacrifice-throttled: only sacrifice coord written", () => {
  const fm = buildField();
  const stamper = new T1.SourceStamper({ field: fm.Field });
  // Ingest enough public records to throttle
  for (let i = 0; i < T1.RATE_LIMIT_PUBLIC + 1; i++) {
    stamper.ingest({
      record: { type: "external::record", value: { i: i } },
      sourceId: "anon.example.com",
      timeNow: i * 10
    });
  }
  // Last one was throttled. Dispatch the sacrifice arm.
  const r = T1.dispatchArm(fm.Field, {
    "--next-op": { value: "sacrifice-throttled-record" }
  });
  assert(r.executed === true);
  assert(r.armResult.kind === "sacrifice");

  // CRITICAL: only sacrifice arm-result, no process arm-result
  assert(countIntakeByType(fm.Field, "arm-result::sacrifice-throttled") === 1);
  assert(countIntakeByType(fm.Field, "arm-result::process-trusted") === 0);
  assert(countIntakeByType(fm.Field, "arm-result::process-public") === 0);
});

test("Sacrifice arm-result has counter shape (no payload retention)", () => {
  const fm = buildField();
  T1.sacrificeThrottledRecord(fm.Field, { timeNow: 0 });
  const sac = fm.Field.intake.records.find(
    r => r && r.type === "arm-result::sacrifice-throttled");
  assert(sac);
  assert(sac.value.sacrificed === 1, "counter shape, value=1");
  // The sacrifice record carries no payload from the input
  assert(typeof sac.value.payload === "undefined",
    "no payload retention on sacrifice");
  assert(typeof sac.value.sourceId === "undefined",
    "no source attribution retention on sacrifice");
});

// ----------------------------------------------------------------------------
// PART D: structural firewall - sacrifice arms touch ONLY sacrifice coords
// ----------------------------------------------------------------------------
console.log("");
console.log("PART D: structural firewall (sacrifice does not touch actionable)");
console.log("");

test("Sacrifice arm: field.constraints unchanged", () => {
  const fm = buildField();
  const before = fm.Field.constraints.slice();
  T1.sacrificeThrottledRecord(fm.Field, { timeNow: 0 });
  T1.sacrificeMalformedRecord(fm.Field, { timeNow: 1 });
  assert(fm.Field.constraints.length === before.length);
  for (let i = 0; i < before.length; i++) {
    assert(fm.Field.constraints[i] === before[i],
      "constraint identity preserved at " + i);
  }
});

test("Sacrifice arm: seed permanence (F1) preserved", () => {
  const fm = buildField();
  const seed = fm.Field.constraints[0];
  for (let i = 0; i < 100; i++) {
    T1.sacrificeThrottledRecord(fm.Field, { timeNow: i });
  }
  assert(fm.Field.constraints[0] === seed);
  assert(fm.Field.constraints[0].kind === "seed");
  assert(fm.Field.constraints[0].permanent === true);
});

test("100 sacrifice ops + 0 process ops: no process-class records anywhere", () => {
  const fm = buildField();
  for (let i = 0; i < 100; i++) {
    T1.sacrificeThrottledRecord(fm.Field, { timeNow: i });
  }
  // All sacrificed records should have arm-result::sacrifice-* but NEVER
  // arm-result::process-*
  assert(countIntakeByType(fm.Field, "arm-result::process-trusted") === 0);
  assert(countIntakeByType(fm.Field, "arm-result::process-public") === 0);
});

test("Cascade rules NEVER match against arm-result coords (off into null space)", () => {
  // Read the reference rules; verify no rule's SELECTOR (left side
  // before the brace) references arm-result or sacrifice coords.
  // The --next-op VALUES legitimately contain "sacrifice" because
  // that names the arm.
  const rules = T1.REFERENCE_TRUST_RULES;
  // Extract only the selector portion of each rule
  const selectors = rules.split("\n").map(line => {
    const idx = line.indexOf("{");
    return idx >= 0 ? line.substring(0, idx) : line;
  }).join(" ");
  assert(selectors.indexOf("arm-result") < 0,
    "no SELECTOR references arm-result coords");
  assert(selectors.indexOf("sacrifice") < 0,
    "no SELECTOR references sacrifice coords");
  assert(selectors.indexOf("data-sacrifice") < 0,
    "no SELECTOR references data-sacrifice attribute");
});

// ----------------------------------------------------------------------------
// PART E: end-to-end (stamper -> cascade -> dispatch -> arm)
// ----------------------------------------------------------------------------
console.log("");
console.log("PART E: end-to-end pipeline");
console.log("");

test("Full pipeline: trusted record produces process arm-result", () => {
  const fm = buildField();
  const stamper = new T1.SourceStamper({ field: fm.Field });
  const ingest = stamper.ingest({
    record: { type: "external::record", value: { kind: "important" } },
    sourceId: "partner-a.example.com",
    timeNow: 0
  });
  const co = resolveNextOp({
    "incoming-source-class": ingest.sourceClass,
    "incoming-source-rate-ok": ingest.rateOk ? "1" : "0",
    "incoming-record-shape": ingest.shape
  });
  const dispatch = T1.dispatchArm(fm.Field, co, { timeNow: 0 });
  assert(dispatch.executed === true);
  assert(dispatch.dispatched === "process-trusted-record");
  assert(countIntakeByType(fm.Field, "arm-result::process-trusted") === 1);
  assert(countIntakeByType(fm.Field, "arm-result::sacrifice-throttled") === 0);
});

test("Full pipeline: throttled public record produces sacrifice arm-result", () => {
  const fm = buildField();
  const stamper = new T1.SourceStamper({ field: fm.Field });
  let last = null;
  for (let i = 0; i < T1.RATE_LIMIT_PUBLIC + 2; i++) {
    last = stamper.ingest({
      record: { type: "external::record", value: { i: i } },
      sourceId: "anon.example.com",
      timeNow: i * 10
    });
  }
  // Last ingest is throttled
  const co = resolveNextOp({
    "incoming-source-class": last.sourceClass,
    "incoming-source-rate-ok": last.rateOk ? "1" : "0",
    "incoming-record-shape": last.shape
  });
  const dispatch = T1.dispatchArm(fm.Field, co, { timeNow: 100 });
  assert(dispatch.executed === true);
  assert(dispatch.dispatched === "sacrifice-throttled-record");
  assert(countIntakeByType(fm.Field, "arm-result::sacrifice-throttled") >= 1);
  assert(countIntakeByType(fm.Field, "arm-result::process-trusted") === 0);
  assert(countIntakeByType(fm.Field, "arm-result::process-public") === 0);
});

test("Full pipeline: unknown source -> cascade silent -> no arm fires", () => {
  const fm = buildField();
  const stamper = new T1.SourceStamper({
    field: fm.Field,
    sourceRegistry: { "shadowy.example.com": "shadowy-cabal" }
  });
  const ingest = stamper.ingest({
    record: { type: "external::record", value: { x: 1 } },
    sourceId: "shadowy.example.com",
    timeNow: 0
  });
  const co = resolveNextOp({
    "incoming-source-class": ingest.sourceClass,
    "incoming-source-rate-ok": ingest.rateOk ? "1" : "0",
    "incoming-record-shape": ingest.shape
  });
  const dispatch = T1.dispatchArm(fm.Field, co, { timeNow: 0 });
  assert(dispatch.executed === false);
  assert(dispatch.dispatched === null);
  // No arm-result records at all - the cascade was silent
  assert(countIntakeByType(fm.Field, "arm-result::process-trusted") === 0);
  assert(countIntakeByType(fm.Field, "arm-result::process-public") === 0);
  assert(countIntakeByType(fm.Field, "arm-result::sacrifice-throttled") === 0);
  assert(countIntakeByType(fm.Field, "arm-result::sacrifice-malformed") === 0);
});

// ----------------------------------------------------------------------------
// PART F: closure - no JS-resident result cache
// ----------------------------------------------------------------------------
console.log("");
console.log("PART F: closure - no JS-resident leak");
console.log("");

test("Module exports no observer class (TrustObserver removed)", () => {
  assert(typeof T1.TrustObserver === "undefined",
    "TrustObserver should not be exported");
});

test("Module source: no constraints.push, no field.ratify, no _mkPredictive", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "t1-skeptical-intake.js"), "utf8");
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert(stripped.indexOf("constraints.push") < 0);
  assert(!/field\.ratify\s*\(/.test(stripped));
  assert(stripped.indexOf("_mkPredictive") < 0);
});

test("Module source: no result-cache (no __substrateResults pattern)", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "t1-skeptical-intake.js"), "utf8");
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert(stripped.indexOf("__substrateResults") < 0,
    "the retired reserved-catch-class leak pattern");
  assert(!/window\.__/.test(stripped),
    "no window-resident state");
});

test("Module source: no admittedRecords getter (the initial T1 leak)", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "t1-skeptical-intake.js"), "utf8");
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert(stripped.indexOf("admittedRecords") < 0,
    "the initial T1's JS-resident filter is gone");
});

test("Arm functions write to intake only (closure: result -> coords)", () => {
  const fm = buildField();
  const intakeBefore = fm.Field.intake.records.length;
  const constraintsBefore = fm.Field.constraints.length;
  T1.processTrustedRecord(fm.Field, { timeNow: 0 });
  T1.processPublicRecord(fm.Field, { timeNow: 0 });
  T1.sacrificeThrottledRecord(fm.Field, { timeNow: 0 });
  T1.sacrificeMalformedRecord(fm.Field, { timeNow: 0 });
  // Constraint array unchanged
  assert(fm.Field.constraints.length === constraintsBefore);
  // Intake grew by exactly 4 (one per arm; the 2 process arms find
  // nothing in this empty fixture so they return fired:false but
  // that case still publishes nothing - actually they return early
  // without publishing). Check sacrifices did publish.
  assert(countIntakeByType(fm.Field, "arm-result::sacrifice-throttled") === 1);
  assert(countIntakeByType(fm.Field, "arm-result::sacrifice-malformed") === 1);
});

// ----------------------------------------------------------------------------
// PART G: closure (file-level)
// ----------------------------------------------------------------------------
console.log("");
console.log("PART G: closure (ASCII, no host APIs)");
console.log("");

test("t1-skeptical-intake.js: ASCII-only", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "t1-skeptical-intake.js"), "utf8");
  const m = src.match(/[^\x00-\x7F]/);
  assert(!m, "non-ASCII: " + (m && m[0]));
});

test("t1-skeptical-intake.js: no host APIs", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "t1-skeptical-intake.js"), "utf8");
  assert(src.indexOf("localStorage") < 0);
  assert(src.indexOf("fetch(") < 0);
  assert(src.indexOf("XMLHttpRequest") < 0);
  assert(src.indexOf("WebSocket") < 0);
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
