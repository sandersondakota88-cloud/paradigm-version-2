// s2-forward-compat-verifier.js - S2: forward-compatibility harness

"use strict";

const fs = require("fs");
const path = require("path");

const S1 = require("./s1-schema-projection.js");
const S2 = require("./s2-forward-compat.js");
const F1Harness = require("./f1-cascade-harness.js");
const Synth = require("./cascade-rule-synthesizer.js");

let pass = 0, fail = 0;
const failures = [];

function test(name, fn) {
  try { fn(); pass++; console.log("  OK   " + name); }
  catch (e) { fail++; failures.push({ name, error: e }); console.log("  FAIL " + name + ": " + e.message); }
}
function assert(c, m) { if (!c) throw new Error("assertion failed: " + (m || "")); }

function runRules(rules, coords) {
  const synth = Synth.synthesizeFromCss(rules);
  if (!synth.ok) throw new Error("synth failed: " + JSON.stringify(synth.errors));
  const fullCoords = Object.assign({ "data-substrate-state": "" }, coords);
  const r = F1Harness.runCascade(synth.constraints, fullCoords);
  return r.cascadeOutput || {};
}

console.log("s2-forward-compat verification");
console.log("");

// ----------------------------------------------------------------------------
// PART A: v5 projection rules
// ----------------------------------------------------------------------------
console.log("PART A: v5 projection rules in isolation");
console.log("");

test("V5 rules synthesize to 12 constraints (6 rules x 2 declarations + 3 single)", () => {
  // 3 tier rules x 2 declarations = 6 constraints
  // 3 acquisition rules x 1 declaration = 3 constraints
  // total 9
  // wait, let me count: tier rules emit --derived-tier AND
  // --derived-is-premium (2 each = 6 constraints from 3 rules);
  // acquisition rules emit --derived-acquisition only (1 each = 3
  // constraints from 3 rules). Total: 9 constraints.
  const r = Synth.synthesizeFromCss(S2.REFERENCE_V5_PROJECTION_RULES);
  assert(r.ok);
  assert(r.constraints.length === 9, "got " + r.constraints.length);
});

test("v5+tier=platinum -> derived-tier=platinum, is-premium=1", () => {
  const co = runRules(S2.REFERENCE_V5_PROJECTION_RULES, {
    "data-schema-version": "v5",
    "data-record-tier": "platinum"
  });
  assert(co["--derived-tier"].value === "platinum");
  assert(co["--derived-is-premium"].value === "1");
});

test("v5+acquisition=inbound -> derived-acquisition=inbound", () => {
  const co = runRules(S2.REFERENCE_V5_PROJECTION_RULES, {
    "data-schema-version": "v5",
    "data-record-acquisition": "inbound"
  });
  assert(co["--derived-acquisition"].value === "inbound");
});

test("v5+full record -> all canonical coords derived", () => {
  const co = runRules(S2.REFERENCE_V5_PROJECTION_RULES, {
    "data-schema-version": "v5",
    "data-record-tier": "platinum",
    "data-record-acquisition": "referral"
  });
  assert(co["--derived-tier"].value === "platinum");
  assert(co["--derived-is-premium"].value === "1");
  assert(co["--derived-acquisition"].value === "referral");
});

// ----------------------------------------------------------------------------
// PART B: composeDeploymentRules
// ----------------------------------------------------------------------------
console.log("");
console.log("PART B: composeDeploymentRules");
console.log("");

test("composeDeploymentRules joins rule sets", () => {
  const composed = S2.composeDeploymentRules({
    "v1-v3": S1.REFERENCE_PROJECTION_RULES,
    "v5": S2.REFERENCE_V5_PROJECTION_RULES
  });
  assert(typeof composed === "string");
  assert(composed.indexOf("v1-v3") >= 0);
  assert(composed.indexOf("v5") >= 0);
  // Both rule sets should be present
  assert(composed.indexOf("data-record-status") >= 0,
    "S1's v1 rules present");
  assert(composed.indexOf("data-record-acquisition") >= 0,
    "S2's v5 rules present");
});

test("composeDeploymentRules rejects non-string rule sets", () => {
  let threw = false;
  try {
    S2.composeDeploymentRules({ "v1": 123 });
  } catch (_) { threw = true; }
  assert(threw);
});

test("DEPLOYMENT_EVOLVED synthesizes successfully", () => {
  const r = Synth.synthesizeFromCss(S2.DEPLOYMENT_EVOLVED);
  assert(r.ok, "synth failed: " + JSON.stringify(r.errors));
  // 12 constraints from S1 + 9 from v5 = 21
  assert(r.constraints.length === 21, "got " + r.constraints.length);
});

// ----------------------------------------------------------------------------
// PART C: deployment evolution preserves earlier-version handling
// ----------------------------------------------------------------------------
console.log("");
console.log("PART C: deployment evolution is additive (existing artifacts unaffected)");
console.log("");

test("v1+vip artifact under DEPLOYMENT_EVOLVED still projects correctly", () => {
  const co = runRules(S2.DEPLOYMENT_EVOLVED, {
    "data-schema-version": "v1",
    "data-record-status": "vip"
  });
  assert(co["--derived-tier"].value === "platinum");
  assert(co["--derived-is-premium"].value === "1");
});

test("v3+platinum artifact under DEPLOYMENT_EVOLVED still projects correctly", () => {
  const co = runRules(S2.DEPLOYMENT_EVOLVED, {
    "data-schema-version": "v3",
    "data-record-tier": "platinum"
  });
  assert(co["--derived-tier"].value === "platinum");
  assert(co["--derived-is-premium"].value === "1");
});

test("v5+platinum artifact under DEPLOYMENT_EVOLVED projects correctly", () => {
  const co = runRules(S2.DEPLOYMENT_EVOLVED, {
    "data-schema-version": "v5",
    "data-record-tier": "platinum",
    "data-record-acquisition": "referral"
  });
  assert(co["--derived-tier"].value === "platinum");
  assert(co["--derived-is-premium"].value === "1");
  assert(co["--derived-acquisition"].value === "referral");
});

test("v3 application cascade reads canonical coords, source-version-blind", () => {
  // The v3 application cascade reads --derived-is-premium. Three
  // artifacts at different versions should all produce the same
  // application-cascade outcome through canonical coords.
  const v1coords = {
    "data-substrate-state": "",
    "data-schema-version": "v1",
    "data-record-status": "vip"
  };
  const v3coords = {
    "data-substrate-state": "",
    "data-schema-version": "v3",
    "data-record-tier": "platinum"
  };
  const v5coords = {
    "data-substrate-state": "",
    "data-schema-version": "v5",
    "data-record-tier": "platinum",
    "data-record-acquisition": "inbound"
  };

  for (const cs of [v1coords, v3coords, v5coords]) {
    const projOut = runRules(S2.DEPLOYMENT_EVOLVED, cs);
    const projected = S1.applyProjectionToCoords(cs, projOut);
    const appOut = runRules(S1.REFERENCE_V3_APPLICATION_RULES, projected);
    assert(appOut["--next-op"].value === "show-premium-actions",
      "version " + cs["data-schema-version"] + " did not produce premium next-op");
  }
});

// ----------------------------------------------------------------------------
// PART D: unknown future versions handled gracefully
// ----------------------------------------------------------------------------
console.log("");
console.log("PART D: unknown future versions");
console.log("");

test("v99 (no projection rules) under DEPLOYMENT_EVOLVED -> silent cascade", () => {
  const co = runRules(S2.DEPLOYMENT_EVOLVED, {
    "data-schema-version": "v99",
    "data-record-future-coord": "weird"
  });
  assert(!co["--derived-tier"], "no projection for v99");
  assert(!co["--derived-is-premium"]);
  assert(!co["--derived-acquisition"]);
});

test("v99 application cascade pass: no crash, no canonical coords -> no --next-op", () => {
  const initial = {
    "data-substrate-state": "",
    "data-schema-version": "v99",
    "data-record-future-coord": "weird"
  };
  const projOut = runRules(S2.DEPLOYMENT_EVOLVED, initial);
  const projected = S1.applyProjectionToCoords(initial, projOut);
  const appOut = runRules(S1.REFERENCE_V3_APPLICATION_RULES, projected);
  assert(!appOut["--next-op"]);
});

// ----------------------------------------------------------------------------
// PART E: F5 - original artifact coords preserved across deployment evolution
// ----------------------------------------------------------------------------
console.log("");
console.log("PART E: F5 (irreversibility) under deployment evolution");
console.log("");

test("v5 artifact coords preserved after projection under evolved deployment", () => {
  const initial = {
    "data-substrate-state": "",
    "data-schema-version": "v5",
    "data-record-tier": "platinum",
    "data-record-acquisition": "referral"
  };
  const projOut = runRules(S2.DEPLOYMENT_EVOLVED, initial);
  const projected = S1.applyProjectionToCoords(initial, projOut);

  // Original coords still present
  assert(projected["data-record-tier"] === "platinum");
  assert(projected["data-record-acquisition"] === "referral");
  assert(projected["data-schema-version"] === "v5");
  // Derived coords added alongside
  assert(projected["data-derived-tier"] === "platinum");
  assert(projected["data-derived-acquisition"] === "referral");
});

// ----------------------------------------------------------------------------
// PART F: closure
// ----------------------------------------------------------------------------
console.log("");
console.log("PART F: closure");
console.log("");

test("S2 module: no constraints.push, no field.ratify, no _mkPredictive", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "s2-forward-compat.js"), "utf8");
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert(stripped.indexOf("constraints.push") < 0);
  assert(!/field\.ratify\s*\(/.test(stripped));
  assert(stripped.indexOf("_mkPredictive") < 0);
});

test("S2 module: no JS-resident result cache, no observer class", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "s2-forward-compat.js"), "utf8");
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert(stripped.indexOf("__substrateResults") < 0);
  assert(stripped.indexOf("admittedRecords") < 0);
  assert(stripped.indexOf("class TrustObserver") < 0);
});

test("S2 module: no host APIs", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "s2-forward-compat.js"), "utf8");
  assert(src.indexOf("localStorage") < 0);
  assert(src.indexOf("fetch(") < 0);
  assert(src.indexOf("XMLHttpRequest") < 0);
  assert(src.indexOf("WebSocket") < 0);
});

test("s2-forward-compat.js: ASCII-only", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "s2-forward-compat.js"), "utf8");
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
