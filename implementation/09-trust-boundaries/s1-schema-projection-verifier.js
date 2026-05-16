// s1-schema-projection-verifier.js - S1: schema-version + projection

"use strict";

const fs = require("fs");
const path = require("path");

const S1 = require("./s1-schema-projection.js");
const F1Harness = require("./f1-cascade-harness.js");
const Synth = require("./cascade-rule-synthesizer.js");

let pass = 0, fail = 0;
const failures = [];

function test(name, fn) {
  try { fn(); pass++; console.log("  OK   " + name); }
  catch (e) { fail++; failures.push({ name, error: e }); console.log("  FAIL " + name + ": " + e.message); }
}
function assert(c, m) { if (!c) throw new Error("assertion failed: " + (m || "")); }

// Run rules against coords; return cascade output map
function runRules(rules, coords) {
  const synth = Synth.synthesizeFromCss(rules);
  if (!synth.ok) throw new Error("synth failed: " + JSON.stringify(synth.errors));
  const fullCoords = Object.assign({ "data-substrate-state": "" }, coords);
  const r = F1Harness.runCascade(synth.constraints, fullCoords);
  return r.cascadeOutput || {};
}

console.log("s1-schema-projection verification");
console.log("");

// ----------------------------------------------------------------------------
// PART A: rules synthesize
// ----------------------------------------------------------------------------
console.log("PART A: projection cascade rules synthesize");
console.log("");

test("Projection rules synthesize to 12 cascade constraints (6 rules x 2 declarations each)", () => {
  // After Phase 9 synthesizer fix: each multi-property rule expands
  // into one constraint per declaration. 6 logical projection rules
  // x 2 emit declarations each = 12 constraints. The expression is
  // grammar-faithful (one rule per source-case); the constraint
  // count reflects the cascade's per-property granularity.
  const r = Synth.synthesizeFromCss(S1.REFERENCE_PROJECTION_RULES);
  assert(r.ok, "synth failed: " + JSON.stringify(r.errors));
  assert(r.constraints.length === 12, "got " + r.constraints.length);
});

test("v3 application rules synthesize", () => {
  const r = Synth.synthesizeFromCss(S1.REFERENCE_V3_APPLICATION_RULES);
  assert(r.ok);
  assert(r.constraints.length === 2);
});

test("composedRules() concatenates projection + v3 app", () => {
  const c = S1.composedRules();
  const r = Synth.synthesizeFromCss(c);
  assert(r.ok);
  assert(r.constraints.length === 14);  // 12 projection + 2 v3 app
});

// ----------------------------------------------------------------------------
// PART B: v1 projections
// ----------------------------------------------------------------------------
console.log("");
console.log("PART B: v1 -> canonical projection");
console.log("");

test("v1+status=active -> tier=standard, is-premium=0", () => {
  const co = runRules(S1.REFERENCE_PROJECTION_RULES, {
    "data-schema-version": "v1",
    "data-record-status": "active"
  });
  assert(co["--derived-tier"], "expected --derived-tier; got " + JSON.stringify(co));
  assert(co["--derived-tier"].value === "standard");
  assert(co["--derived-is-premium"].value === "0");
});

test("v1+status=vip -> tier=platinum, is-premium=1", () => {
  const co = runRules(S1.REFERENCE_PROJECTION_RULES, {
    "data-schema-version": "v1",
    "data-record-status": "vip"
  });
  assert(co["--derived-tier"].value === "platinum");
  assert(co["--derived-is-premium"].value === "1");
});

test("v1+status=inactive -> tier=inactive, is-premium=0", () => {
  const co = runRules(S1.REFERENCE_PROJECTION_RULES, {
    "data-schema-version": "v1",
    "data-record-status": "inactive"
  });
  assert(co["--derived-tier"].value === "inactive");
  assert(co["--derived-is-premium"].value === "0");
});

// ----------------------------------------------------------------------------
// PART C: v3 native passthrough
// ----------------------------------------------------------------------------
console.log("");
console.log("PART C: v3 native passthrough");
console.log("");

test("v3+tier=standard -> tier=standard, is-premium=0", () => {
  const co = runRules(S1.REFERENCE_PROJECTION_RULES, {
    "data-schema-version": "v3",
    "data-record-tier": "standard"
  });
  assert(co["--derived-tier"].value === "standard");
  assert(co["--derived-is-premium"].value === "0");
});

test("v3+tier=platinum -> tier=platinum, is-premium=1", () => {
  const co = runRules(S1.REFERENCE_PROJECTION_RULES, {
    "data-schema-version": "v3",
    "data-record-tier": "platinum"
  });
  assert(co["--derived-tier"].value === "platinum");
  assert(co["--derived-is-premium"].value === "1");
});

test("v3+tier=inactive -> tier=inactive, is-premium=0", () => {
  const co = runRules(S1.REFERENCE_PROJECTION_RULES, {
    "data-schema-version": "v3",
    "data-record-tier": "inactive"
  });
  assert(co["--derived-tier"].value === "inactive");
  assert(co["--derived-is-premium"].value === "0");
});

// ----------------------------------------------------------------------------
// PART D: F5 - original coords preserved
// ----------------------------------------------------------------------------
console.log("");
console.log("PART D: F5 (irreversibility) - original artifact unchanged");
console.log("");

test("v1 coords still present in input after running projection", () => {
  // The cascade runs over coords as input; the cascade output is
  // separate. The input coords are not mutated by cascade resolution.
  const inputCoords = {
    "data-substrate-state": "",
    "data-schema-version": "v1",
    "data-record-status": "vip"
  };
  const synth = Synth.synthesizeFromCss(S1.REFERENCE_PROJECTION_RULES);
  const r = F1Harness.runCascade(synth.constraints, inputCoords);

  // Input coords unchanged - the v1 "status" attribute is still there
  assert(inputCoords["data-record-status"] === "vip",
    "v1 coord preserved");
  assert(inputCoords["data-schema-version"] === "v1",
    "version coord preserved");

  // The DERIVED outputs are in cascadeOutput, not in input
  assert(r.cascadeOutput["--derived-tier"]);
});

test("Projection produces ADDITIVE coords; no removal of source coords", () => {
  // The applyProjectionToCoords helper simulates the bridge writing
  // derived coords back. It should ADD data-derived-* attributes
  // alongside the originals, not replace them.
  const initialCoords = {
    "data-substrate-state": "",
    "data-schema-version": "v1",
    "data-record-status": "vip"
  };
  const co = runRules(S1.REFERENCE_PROJECTION_RULES, initialCoords);
  const projected = S1.applyProjectionToCoords(initialCoords, co);

  // Original coords still in projected
  assert(projected["data-record-status"] === "vip");
  assert(projected["data-schema-version"] === "v1");
  // Derived coords added
  assert(projected["data-derived-tier"] === "platinum");
  assert(projected["data-derived-is-premium"] === "1");
});

// ----------------------------------------------------------------------------
// PART E: composed pipeline (v1 artifact -> v3 application output)
// ----------------------------------------------------------------------------
console.log("");
console.log("PART E: end-to-end (v1 artifact + v3 application cascade)");
console.log("");

test("v1+vip artifact + composed cascade -> --next-op = show-premium-actions", () => {
  // Two-pass simulation: (1) run projection, (2) apply derived coords
  // as data-* attrs, (3) run v3 application cascade.
  //
  // In the deposition this is the bridge's job: cascade output
  // --derived-* gets written back as data-derived-* attributes; the
  // next cascade pass sees those attrs.
  const initialCoords = {
    "data-substrate-state": "",
    "data-schema-version": "v1",
    "data-record-status": "vip"
  };

  // Pass 1: projection
  const projOut = runRules(S1.REFERENCE_PROJECTION_RULES, initialCoords);
  const projected = S1.applyProjectionToCoords(initialCoords, projOut);

  // Pass 2: v3 application cascade reads the derived coords
  const appOut = runRules(S1.REFERENCE_V3_APPLICATION_RULES, projected);
  assert(appOut["--next-op"], "v3 cascade produced --next-op");
  assert(appOut["--next-op"].value === "show-premium-actions");
});

test("v1+active artifact -> --next-op = show-standard-actions", () => {
  const initialCoords = {
    "data-substrate-state": "",
    "data-schema-version": "v1",
    "data-record-status": "active"
  };
  const projOut = runRules(S1.REFERENCE_PROJECTION_RULES, initialCoords);
  const projected = S1.applyProjectionToCoords(initialCoords, projOut);
  const appOut = runRules(S1.REFERENCE_V3_APPLICATION_RULES, projected);
  assert(appOut["--next-op"].value === "show-standard-actions");
});

test("v3+platinum artifact -> --next-op = show-premium-actions (passthrough works)", () => {
  const initialCoords = {
    "data-substrate-state": "",
    "data-schema-version": "v3",
    "data-record-tier": "platinum"
  };
  const projOut = runRules(S1.REFERENCE_PROJECTION_RULES, initialCoords);
  const projected = S1.applyProjectionToCoords(initialCoords, projOut);
  const appOut = runRules(S1.REFERENCE_V3_APPLICATION_RULES, projected);
  assert(appOut["--next-op"].value === "show-premium-actions");
});

test("v1+vip and v3+platinum produce IDENTICAL --next-op", () => {
  // Both should reach show-premium-actions through the canonical
  // --derived-is-premium=1 coord. The application is unaware of the
  // source version.
  const v1Coords = {
    "data-substrate-state": "",
    "data-schema-version": "v1",
    "data-record-status": "vip"
  };
  const v3Coords = {
    "data-substrate-state": "",
    "data-schema-version": "v3",
    "data-record-tier": "platinum"
  };
  const v1ProjOut = runRules(S1.REFERENCE_PROJECTION_RULES, v1Coords);
  const v3ProjOut = runRules(S1.REFERENCE_PROJECTION_RULES, v3Coords);
  const v1Projected = S1.applyProjectionToCoords(v1Coords, v1ProjOut);
  const v3Projected = S1.applyProjectionToCoords(v3Coords, v3ProjOut);
  const v1App = runRules(S1.REFERENCE_V3_APPLICATION_RULES, v1Projected);
  const v3App = runRules(S1.REFERENCE_V3_APPLICATION_RULES, v3Projected);
  assert(v1App["--next-op"].value === v3App["--next-op"].value,
    "v1=" + v1App["--next-op"].value + " v3=" + v3App["--next-op"].value);
});

// ----------------------------------------------------------------------------
// PART F: forward-compat (unknown future versions)
// ----------------------------------------------------------------------------
console.log("");
console.log("PART F: forward-compatibility");
console.log("");

test("v99 artifact (no projection rules) -> cascade silent", () => {
  // A future schema version with no projection rules in the current
  // deployment. Projection cascade output should be empty; the v3
  // application cascade should also produce no --next-op (since no
  // --derived-is-premium is derivable). This is graceful failure -
  // the application sees no actionable signal and can show a fallback.
  const co = runRules(S1.REFERENCE_PROJECTION_RULES, {
    "data-schema-version": "v99",
    "data-record-something": "weird"
  });
  assert(!co["--derived-tier"], "no projection for v99");
  assert(!co["--derived-is-premium"]);
});

test("v99 artifact through composed cascade -> no --next-op", () => {
  const initialCoords = {
    "data-substrate-state": "",
    "data-schema-version": "v99",
    "data-record-something": "weird"
  };
  const projOut = runRules(S1.REFERENCE_PROJECTION_RULES, initialCoords);
  const projected = S1.applyProjectionToCoords(initialCoords, projOut);
  const appOut = runRules(S1.REFERENCE_V3_APPLICATION_RULES, projected);
  // No matching rule in projection (v99 unknown) -> no derived coords
  // -> v3 app rules also don't match -> no --next-op
  assert(!appOut["--next-op"],
    "expected silent; got " + JSON.stringify(appOut["--next-op"]));
});

// ----------------------------------------------------------------------------
// PART G: schema-shape derivation (S3 prep)
// ----------------------------------------------------------------------------
console.log("");
console.log("PART G: describeSchemaShape (S3 observation surface)");
console.log("");

test("describeSchemaShape on v1 artifact reports v1 coords", () => {
  const shape = S1.describeSchemaShape({
    "data-schema-version": "v1",
    "data-record-status": "active"
  });
  assert(shape.declaredVersion === "v1");
  assert(shape.hasV1Coords === true);
  assert(shape.hasV3Coords === false);
  assert(shape.derivedCoordsPresent.length === 0);
});

test("describeSchemaShape on v3 artifact reports v3 coords", () => {
  const shape = S1.describeSchemaShape({
    "data-schema-version": "v3",
    "data-record-tier": "platinum"
  });
  assert(shape.declaredVersion === "v3");
  assert(shape.hasV1Coords === false);
  assert(shape.hasV3Coords === true);
});

test("describeSchemaShape post-projection: derived coords present", () => {
  const initialCoords = {
    "data-substrate-state": "",
    "data-schema-version": "v1",
    "data-record-status": "vip"
  };
  const projOut = runRules(S1.REFERENCE_PROJECTION_RULES, initialCoords);
  const projected = S1.applyProjectionToCoords(initialCoords, projOut);
  const shape = S1.describeSchemaShape(projected);
  assert(shape.declaredVersion === "v1");
  assert(shape.hasV1Coords === true);  // original preserved
  assert(shape.derivedCoordsPresent.length === 2);
  assert(shape.derivedCoordsPresent.indexOf("data-derived-tier") >= 0);
  assert(shape.derivedCoordsPresent.indexOf("data-derived-is-premium") >= 0);
});

// ----------------------------------------------------------------------------
// PART H: closure
// ----------------------------------------------------------------------------
console.log("");
console.log("PART H: closure");
console.log("");

test("S1 module: no constraints.push, no field.ratify, no _mkPredictive", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "s1-schema-projection.js"), "utf8");
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert(stripped.indexOf("constraints.push") < 0);
  assert(!/field\.ratify\s*\(/.test(stripped));
  assert(stripped.indexOf("_mkPredictive") < 0);
});

test("S1 module: no JS-resident result cache", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "s1-schema-projection.js"), "utf8");
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert(stripped.indexOf("__substrateResults") < 0);
  assert(stripped.indexOf("admittedRecords") < 0);
});

test("S1 module: no host APIs", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "s1-schema-projection.js"), "utf8");
  assert(src.indexOf("localStorage") < 0);
  assert(src.indexOf("fetch(") < 0);
  assert(src.indexOf("XMLHttpRequest") < 0);
  assert(src.indexOf("WebSocket") < 0);
});

test("s1-schema-projection.js: ASCII-only", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "s1-schema-projection.js"), "utf8");
  const m = src.match(/[^\x00-\x7F]/);
  assert(!m, "non-ASCII: " + (m && m[0]));
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
