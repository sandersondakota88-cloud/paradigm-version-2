// s3-schema-shape-observer-verifier.js - S3

"use strict";

const fs = require("fs");
const path = require("path");

const S3 = require("./s3-schema-shape-observer.js");
const S2 = require("./s2-forward-compat.js");
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

function runRules(rules, coords) {
  const synth = Synth.synthesizeFromCss(rules);
  if (!synth.ok) throw new Error("synth failed");
  const fullCoords = Object.assign({ "data-substrate-state": "" }, coords);
  const r = F1Harness.runCascade(synth.constraints, fullCoords);
  return r.cascadeOutput || {};
}

// Helper: given an unprojected artifact, run projection and produce
// the projected coord set (for testing the observer over post-
// projection corpora)
function projectArtifact(unprojected) {
  const initial = Object.assign({ "data-substrate-state": "" }, unprojected);
  const projOut = runRules(S2.DEPLOYMENT_EVOLVED, initial);
  return S1.applyProjectionToCoords(initial, projOut);
}

console.log("s3-schema-shape-observer verification");
console.log("");

// ----------------------------------------------------------------------------
// PART A: basic instantiation and shape
// ----------------------------------------------------------------------------
console.log("PART A: instantiation and report shape");
console.log("");

test("SchemaShapeObserver instantiates with defaults", () => {
  const obs = new S3.SchemaShapeObserver();
  assert(obs);
  assert(Array.isArray(obs.knownVersions));
  assert(Array.isArray(obs.knownCanonicalCoords));
});

test("snapshot rejects non-array corpus", () => {
  const obs = new S3.SchemaShapeObserver();
  let threw = false;
  try { obs.snapshot("not an array"); } catch (_) { threw = true; }
  assert(threw);
});

test("snapshot on empty corpus -> zero counts", () => {
  const obs = new S3.SchemaShapeObserver();
  const r = obs.snapshot([]);
  assert(r.corpusSize === 0);
  assert(Object.keys(r.versionCounts).length === 0);
  assert(r.projectionCoverage.total === 0);
  assert(Object.keys(r.unknownVersions).length === 0);
});

test("Report shape is bounded (per O2)", () => {
  const obs = new S3.SchemaShapeObserver();
  const r = obs.snapshot([]);
  const expectedKeys = ["versionCounts", "projectionCoverage", "unknownVersions", "corpusSize"];
  for (const k of expectedKeys) {
    assert(Object.prototype.hasOwnProperty.call(r, k), "missing " + k);
  }
});

// ----------------------------------------------------------------------------
// PART B: version counting
// ----------------------------------------------------------------------------
console.log("");
console.log("PART B: version counting");
console.log("");

test("Single v1 artifact -> versionCounts.v1 = 1", () => {
  const obs = new S3.SchemaShapeObserver();
  const r = obs.snapshot([
    { "data-schema-version": "v1", "data-record-status": "active" }
  ]);
  assert(r.versionCounts.v1 === 1);
  assert(r.corpusSize === 1);
});

test("Mixed corpus -> per-version counts", () => {
  const obs = new S3.SchemaShapeObserver();
  const r = obs.snapshot([
    { "data-schema-version": "v1", "data-record-status": "active" },
    { "data-schema-version": "v1", "data-record-status": "vip" },
    { "data-schema-version": "v3", "data-record-tier": "platinum" },
    { "data-schema-version": "v5", "data-record-tier": "standard" },
    { "data-schema-version": "v5", "data-record-acquisition": "inbound" }
  ]);
  assert(r.versionCounts.v1 === 2);
  assert(r.versionCounts.v3 === 1);
  assert(r.versionCounts.v5 === 2);
  assert(r.corpusSize === 5);
});

test("Coord set without declared version is counted in corpus but not version counts", () => {
  const obs = new S3.SchemaShapeObserver();
  const r = obs.snapshot([
    { "data-record-status": "active" }  // no schema-version
  ]);
  assert(r.corpusSize === 1);
  assert(Object.keys(r.versionCounts).length === 0);
});

// ----------------------------------------------------------------------------
// PART C: projection coverage
// ----------------------------------------------------------------------------
console.log("");
console.log("PART C: projection coverage");
console.log("");

test("Unprojected artifact -> coverage.none = 1", () => {
  const obs = new S3.SchemaShapeObserver();
  const r = obs.snapshot([
    { "data-schema-version": "v1", "data-record-status": "active" }
  ]);
  assert(r.projectionCoverage.none === 1);
  assert(r.projectionCoverage.full === 0);
  assert(r.projectionCoverage.partial === 0);
});

test("Fully projected v1 artifact (tier+is-premium) -> coverage.partial = 1", () => {
  // v1 produces tier and is-premium but NOT acquisition (that's v5
  // only). So a v1 projected artifact has 2 of 3 known canonical
  // coords - partial coverage.
  const obs = new S3.SchemaShapeObserver();
  const projected = projectArtifact({
    "data-schema-version": "v1",
    "data-record-status": "vip"
  });
  const r = obs.snapshot([projected]);
  assert(r.projectionCoverage.partial === 1,
    "got " + JSON.stringify(r.projectionCoverage));
});

test("Fully projected v5 artifact (all 3 canonical coords) -> coverage.full = 1", () => {
  const obs = new S3.SchemaShapeObserver();
  const projected = projectArtifact({
    "data-schema-version": "v5",
    "data-record-tier": "platinum",
    "data-record-acquisition": "referral"
  });
  const r = obs.snapshot([projected]);
  assert(r.projectionCoverage.full === 1,
    "got " + JSON.stringify(r.projectionCoverage));
});

test("Mixed projected/unprojected corpus -> mixed coverage", () => {
  const obs = new S3.SchemaShapeObserver();
  const corpus = [
    // unprojected (none)
    { "data-schema-version": "v1", "data-record-status": "active" },
    // v1 projected (partial)
    projectArtifact({
      "data-schema-version": "v1",
      "data-record-status": "vip"
    }),
    // v5 fully projected (full)
    projectArtifact({
      "data-schema-version": "v5",
      "data-record-tier": "platinum",
      "data-record-acquisition": "inbound"
    })
  ];
  const r = obs.snapshot(corpus);
  assert(r.projectionCoverage.none === 1);
  assert(r.projectionCoverage.partial === 1);
  assert(r.projectionCoverage.full === 1);
  assert(r.projectionCoverage.total === 3);
});

// ----------------------------------------------------------------------------
// PART D: unknown versions detection
// ----------------------------------------------------------------------------
console.log("");
console.log("PART D: unknown version detection");
console.log("");

test("Known versions (v1, v3, v5) not flagged as unknown", () => {
  const obs = new S3.SchemaShapeObserver();
  const r = obs.snapshot([
    { "data-schema-version": "v1" },
    { "data-schema-version": "v3" },
    { "data-schema-version": "v5" }
  ]);
  assert(Object.keys(r.unknownVersions).length === 0);
});

test("v99 (not in knownVersions) flagged as unknown", () => {
  const obs = new S3.SchemaShapeObserver();
  const r = obs.snapshot([
    { "data-schema-version": "v99" }
  ]);
  assert(r.unknownVersions.v99 === 1);
});

test("Custom knownVersions config respected", () => {
  const obs = new S3.SchemaShapeObserver({
    knownVersions: ["v3"]  // only v3 is "known" for this audit
  });
  const r = obs.snapshot([
    { "data-schema-version": "v1" },
    { "data-schema-version": "v3" },
    { "data-schema-version": "v5" }
  ]);
  assert(r.unknownVersions.v1 === 1);
  assert(!r.unknownVersions.v3);  // v3 IS known
  assert(r.unknownVersions.v5 === 1);
});

// ----------------------------------------------------------------------------
// PART E: O-class commitments (read-only, deterministic)
// ----------------------------------------------------------------------------
console.log("");
console.log("PART E: O-class commitments");
console.log("");

test("Multiple snapshot calls on same input produce identical output (idempotent)", () => {
  const obs = new S3.SchemaShapeObserver();
  const corpus = [
    { "data-schema-version": "v1", "data-record-status": "active" },
    { "data-schema-version": "v3", "data-record-tier": "platinum" }
  ];
  const r1 = obs.snapshot(corpus);
  const r2 = obs.snapshot(corpus);
  assert(JSON.stringify(r1) === JSON.stringify(r2),
    "snapshots differ: " + JSON.stringify(r1) + " vs " + JSON.stringify(r2));
});

test("Corpus is not mutated by snapshot (F5 / O1)", () => {
  const obs = new S3.SchemaShapeObserver();
  const original = [
    { "data-schema-version": "v1", "data-record-status": "active" }
  ];
  const before = JSON.stringify(original);
  obs.snapshot(original);
  const after = JSON.stringify(original);
  assert(before === after, "corpus mutated: " + before + " -> " + after);
});

test("Two observers on same corpus produce consistent results", () => {
  const obs1 = new S3.SchemaShapeObserver();
  const obs2 = new S3.SchemaShapeObserver();
  const corpus = [
    { "data-schema-version": "v1", "data-record-status": "vip" },
    { "data-schema-version": "v5", "data-record-tier": "platinum",
      "data-record-acquisition": "inbound" }
  ];
  const r1 = obs1.snapshot(corpus);
  const r2 = obs2.snapshot(corpus);
  assert(JSON.stringify(r1) === JSON.stringify(r2));
});

// ----------------------------------------------------------------------------
// PART F: closure
// ----------------------------------------------------------------------------
console.log("");
console.log("PART F: closure");
console.log("");

test("S3 module: no constraints.push, no field.ratify, no _mkPredictive", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "s3-schema-shape-observer.js"), "utf8");
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert(stripped.indexOf("constraints.push") < 0);
  assert(!/field\.ratify\s*\(/.test(stripped));
  assert(stripped.indexOf("_mkPredictive") < 0);
});

test("S3 module: no JS-resident result cache", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "s3-schema-shape-observer.js"), "utf8");
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert(stripped.indexOf("__substrateResults") < 0);
});

test("S3 module: never calls field.intake.publish (read-only per O1)", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "s3-schema-shape-observer.js"), "utf8");
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert(stripped.indexOf("intake.publish") < 0,
    "S3 must not publish to intake (O1: observer read-only)");
});

test("S3 module: no host APIs", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "s3-schema-shape-observer.js"), "utf8");
  assert(src.indexOf("localStorage") < 0);
  assert(src.indexOf("fetch(") < 0);
  assert(src.indexOf("XMLHttpRequest") < 0);
});

test("s3-schema-shape-observer.js: ASCII-only", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "s3-schema-shape-observer.js"), "utf8");
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
