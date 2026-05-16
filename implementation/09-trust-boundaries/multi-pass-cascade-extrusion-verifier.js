// multi-pass-cascade-extrusion-verifier.js

"use strict";

const fs = require("fs");
const path = require("path");

const F1Harness = require("./f1-cascade-harness.js");
const Synth = require("./cascade-rule-synthesizer.js");

let pass = 0, fail = 0;
const failures = [];

function test(name, fn) {
  try { fn(); pass++; console.log("  OK   " + name); }
  catch (e) { fail++; failures.push({ name, error: e }); console.log("  FAIL " + name + ": " + e.message); }
}
function assert(c, m) { if (!c) throw new Error("assertion failed: " + (m || "")); }

// ----------------------------------------------------------------------------
// THE OUTER CASCADE - source registry as cascade rules
//
// Each rule matches a specific source-id and emits the source-class.
// A catch-all rule (lowest specificity, matched by attribute presence
// only) handles unknown sources by emitting "public".
//
// This IS the registry. There is no JS-side data structure mapping
// source-ids to classes. Adding a new source = adding a rule.
// ----------------------------------------------------------------------------
const REGISTRY_OUTER_CASCADE = [
  // Catch-all FIRST: unknown sources are public. Same specificity as
  // partner rules; source-order disambiguates - later rules override
  // earlier ones for the same source-id. The trusted partners listed
  // below override this default for matching source-ids.
  '[data-substrate-state][data-incoming-source-id] { --source-class: "public"; }',
  // Trusted partners (override catch-all by source order)
  '[data-substrate-state][data-incoming-source-id="partner-a.example.com"] { --source-class: "trusted"; }',
  '[data-substrate-state][data-incoming-source-id="partner-b.example.com"] { --source-class: "trusted"; }'
].join("\n");

// ----------------------------------------------------------------------------
// THE INNER CASCADE - dispatch arms based on source-class + shape
//
// This matches data-source-class (which the OUTER cascade produces
// and the bridge promotes to attr) plus other coords (rate-ok, shape)
// and emits --next-op for arm dispatch.
//
// This is structurally identical to T1's existing dispatch rules,
// with one change: matches data-source-class instead of
// data-incoming-source-class. Under cascade extrusion, the
// source-class coord is derived (cascade output of outer pass) rather
// than published-by-JS.
// ----------------------------------------------------------------------------
const TRUST_INNER_CASCADE = [
  '[data-substrate-state][data-source-class="trusted"][data-incoming-record-shape="valid"] { --next-op: "process-trusted-record"; }',
  '[data-substrate-state][data-source-class="public"][data-incoming-source-rate-ok="1"][data-incoming-record-shape="valid"] { --next-op: "process-public-record"; }',
  '[data-substrate-state][data-source-class="public"][data-incoming-source-rate-ok="0"] { --next-op: "sacrifice-throttled-record"; }',
  '[data-substrate-state][data-incoming-record-shape="malformed"] { --next-op: "sacrifice-malformed-record"; }'
].join("\n");

// ----------------------------------------------------------------------------
// promoteCascadeOutputToCoords: simulates the bridge step that writes
// derived cascade output back as DOM attrs. After the outer cascade
// emits --source-class, the bridge would write data-source-class.
// In this Node-only verifier, we do the same in-memory.
//
// In production, the bridge's promoteCascadeOutputToCoords reads
// getComputedStyle on the state element (or kernel-evaluator's
// cascade-output map) and setAttribute()s for each promoted property.
// ----------------------------------------------------------------------------
function promoteCascadeOutputToCoords(initialCoords, cascadeOutput, promotionMap) {
  const out = Object.assign({}, initialCoords);
  for (const propName of Object.keys(promotionMap)) {
    const attrName = promotionMap[propName];
    if (cascadeOutput[propName]) {
      out[attrName] = cascadeOutput[propName].value;
    }
  }
  return out;
}

// ----------------------------------------------------------------------------
// runCascadeExtrusion: the multi-pass resolution
//
// Pass 1: outer cascade resolves over initial coords. Output:
//   --source-class (from registry-outer-cascade rules).
//
// Promote: bridge writes derived coord (data-source-class) onto the
// state element from the outer cascade output.
//
// Pass 2: inner cascade resolves over augmented coords. Output:
//   --next-op (the dispatch decision).
//
// Returns the final cascade output of the inner pass.
// ----------------------------------------------------------------------------
function runCascadeExtrusion(initialCoords) {
  // Pass 1: outer cascade
  const outerSynth = Synth.synthesizeFromCss(REGISTRY_OUTER_CASCADE);
  if (!outerSynth.ok) throw new Error("outer synth: " + JSON.stringify(outerSynth.errors));
  const outerOut = F1Harness.runCascade(outerSynth.constraints, initialCoords);

  // Promote outer cascade output to coords (the bridge step)
  const augmented = promoteCascadeOutputToCoords(
    initialCoords,
    outerOut.cascadeOutput || {},
    { "--source-class": "data-source-class" }
  );

  // Pass 2: inner cascade
  const innerSynth = Synth.synthesizeFromCss(TRUST_INNER_CASCADE);
  if (!innerSynth.ok) throw new Error("inner synth: " + JSON.stringify(innerSynth.errors));
  const innerOut = F1Harness.runCascade(innerSynth.constraints, augmented);

  return {
    initialCoords: initialCoords,
    augmentedCoords: augmented,
    outerCascadeOutput: outerOut.cascadeOutput || {},
    innerCascadeOutput: innerOut.cascadeOutput || {}
  };
}

console.log("multi-pass-cascade-extrusion verification");
console.log("");

// ----------------------------------------------------------------------------
// PART A: outer cascade alone (registry-as-rules)
// ----------------------------------------------------------------------------
console.log("PART A: outer cascade matches source-id, emits source-class");
console.log("");

test("Outer cascade synthesizes (3 rules, 1 declaration each)", () => {
  const r = Synth.synthesizeFromCss(REGISTRY_OUTER_CASCADE);
  assert(r.ok);
  assert(r.constraints.length === 3, "got " + r.constraints.length);
});

test("partner-a.example.com -> source-class=trusted", () => {
  const synth = Synth.synthesizeFromCss(REGISTRY_OUTER_CASCADE);
  const out = F1Harness.runCascade(synth.constraints, {
    "data-substrate-state": "",
    "data-incoming-source-id": "partner-a.example.com"
  });
  assert(out.cascadeOutput["--source-class"]);
  assert(out.cascadeOutput["--source-class"].value === "trusted");
});

test("partner-b.example.com -> source-class=trusted", () => {
  const synth = Synth.synthesizeFromCss(REGISTRY_OUTER_CASCADE);
  const out = F1Harness.runCascade(synth.constraints, {
    "data-substrate-state": "",
    "data-incoming-source-id": "partner-b.example.com"
  });
  assert(out.cascadeOutput["--source-class"].value === "trusted");
});

test("Unknown source -> source-class=public (catch-all rule)", () => {
  const synth = Synth.synthesizeFromCss(REGISTRY_OUTER_CASCADE);
  const out = F1Harness.runCascade(synth.constraints, {
    "data-substrate-state": "",
    "data-incoming-source-id": "anonymous.example.com"
  });
  assert(out.cascadeOutput["--source-class"].value === "public",
    "got " + JSON.stringify(out.cascadeOutput["--source-class"]));
});

// ----------------------------------------------------------------------------
// PART B: end-to-end cascade extrusion
// ----------------------------------------------------------------------------
console.log("");
console.log("PART B: end-to-end (outer + inner cascade)");
console.log("");

test("partner-a + valid record -> next-op=process-trusted-record", () => {
  const r = runCascadeExtrusion({
    "data-substrate-state": "",
    "data-incoming-source-id": "partner-a.example.com",
    "data-incoming-record-shape": "valid"
  });
  // Outer pass produced the source-class
  assert(r.outerCascadeOutput["--source-class"].value === "trusted");
  // Promotion step wrote it as a coord
  assert(r.augmentedCoords["data-source-class"] === "trusted");
  // Inner pass dispatched
  assert(r.innerCascadeOutput["--next-op"]);
  assert(r.innerCascadeOutput["--next-op"].value === "process-trusted-record");
});

test("Unknown source + valid record + rate-ok -> next-op=process-public-record", () => {
  const r = runCascadeExtrusion({
    "data-substrate-state": "",
    "data-incoming-source-id": "stranger.example.com",
    "data-incoming-record-shape": "valid",
    "data-incoming-source-rate-ok": "1"
  });
  assert(r.outerCascadeOutput["--source-class"].value === "public");
  assert(r.augmentedCoords["data-source-class"] === "public");
  assert(r.innerCascadeOutput["--next-op"].value === "process-public-record");
});

test("Unknown source + throttled -> next-op=sacrifice-throttled-record", () => {
  const r = runCascadeExtrusion({
    "data-substrate-state": "",
    "data-incoming-source-id": "stranger.example.com",
    "data-incoming-record-shape": "valid",
    "data-incoming-source-rate-ok": "0"
  });
  assert(r.outerCascadeOutput["--source-class"].value === "public");
  assert(r.innerCascadeOutput["--next-op"].value === "sacrifice-throttled-record");
});

test("Malformed record -> next-op=sacrifice-malformed-record (regardless of source)", () => {
  const r = runCascadeExtrusion({
    "data-substrate-state": "",
    "data-incoming-source-id": "partner-a.example.com",
    "data-incoming-record-shape": "malformed"
  });
  // Source classified as trusted, but malformed-shape rule wins because
  // it doesn't depend on source-class
  assert(r.innerCascadeOutput["--next-op"].value === "sacrifice-malformed-record");
});

// ----------------------------------------------------------------------------
// PART C: equivalence with T1's existing dispatch
// ----------------------------------------------------------------------------
console.log("");
console.log("PART C: equivalent dispatch outcomes vs T1's JS-registry form");
console.log("");

const T1 = require("./t1-skeptical-intake.js");

test("T1's REFERENCE_TRUST_RULES gives same dispatch given pre-classified coords", () => {
  // T1's existing rules match data-incoming-source-class (set by JS).
  // The cascade-extrusion form matches data-source-class (set by outer
  // cascade output). For a pre-classified record, both should produce
  // the same --next-op.
  const t1Synth = Synth.synthesizeFromCss(T1.REFERENCE_TRUST_RULES);
  const t1Out = F1Harness.runCascade(t1Synth.constraints, {
    "data-substrate-state": "",
    "data-incoming-source-class": "trusted",
    "data-incoming-record-shape": "valid"
  });

  const extrusionR = runCascadeExtrusion({
    "data-substrate-state": "",
    "data-incoming-source-id": "partner-a.example.com",
    "data-incoming-record-shape": "valid"
  });

  assert(t1Out.cascadeOutput["--next-op"].value === "process-trusted-record");
  assert(extrusionR.innerCascadeOutput["--next-op"].value === "process-trusted-record");
  // Same dispatch decision; different mechanism (JS classification vs
  // outer-cascade classification).
});

test("All four T1 dispatch outcomes reproduce under cascade extrusion", () => {
  const cases = [
    { sourceId: "partner-a.example.com", shape: "valid", rateOk: "1",
      expected: "process-trusted-record" },
    { sourceId: "stranger.example.com", shape: "valid", rateOk: "1",
      expected: "process-public-record" },
    { sourceId: "stranger.example.com", shape: "valid", rateOk: "0",
      expected: "sacrifice-throttled-record" },
    { sourceId: "anyone.example.com", shape: "malformed", rateOk: "1",
      expected: "sacrifice-malformed-record" }
  ];
  for (const c of cases) {
    const r = runCascadeExtrusion({
      "data-substrate-state": "",
      "data-incoming-source-id": c.sourceId,
      "data-incoming-record-shape": c.shape,
      "data-incoming-source-rate-ok": c.rateOk
    });
    assert(r.innerCascadeOutput["--next-op"].value === c.expected,
      c.sourceId + "/" + c.shape + "/" + c.rateOk + " expected " +
      c.expected + " got " +
      (r.innerCascadeOutput["--next-op"] && r.innerCascadeOutput["--next-op"].value));
  }
});

// ----------------------------------------------------------------------------
// PART D: structural commitments
// ----------------------------------------------------------------------------
console.log("");
console.log("PART D: structural commitments (SE-01, F3, no JS-registry)");
console.log("");

test("REGISTRY_OUTER_CASCADE contains no JS - it is pure cascade rules", () => {
  // Sanity check: the registry is a string of CSS, not a JS object.
  assert(typeof REGISTRY_OUTER_CASCADE === "string");
  assert(REGISTRY_OUTER_CASCADE.indexOf("partner-a.example.com") >= 0);
  // No JS object syntax
  assert(REGISTRY_OUTER_CASCADE.indexOf("function") < 0);
  assert(REGISTRY_OUTER_CASCADE.indexOf("=>") < 0);
});

test("Adding a new source -> adding a cascade rule (text concat)", () => {
  // Demonstrate that registry extension is text-level, not JS-level.
  const extended = REGISTRY_OUTER_CASCADE +
    '\n[data-substrate-state][data-incoming-source-id="new-partner.example.com"] { --source-class: "trusted"; }';
  const synth = Synth.synthesizeFromCss(extended);
  assert(synth.ok);
  assert(synth.constraints.length === 4);
  const out = F1Harness.runCascade(synth.constraints, {
    "data-substrate-state": "",
    "data-incoming-source-id": "new-partner.example.com"
  });
  assert(out.cascadeOutput["--source-class"].value === "trusted",
    "newly-added partner classifies as trusted");
});

test("Outer + inner cascade is SE-01 compositional cascade structure", () => {
  // Outer cascade: source-id -> source-class
  // Inner cascade: source-class -> next-op
  // Outer's output is inner's input. Per SE-01: "the outer cascade
  // resolves first - its rules determine which sub-cascade is active
  // for a given outer coordinate."
  //
  // Here, source-class IS the outer coordinate that determines which
  // inner-cascade rules can match. Different sourceIds -> different
  // source-classes -> different inner cascade rule activations.
  const partnerR = runCascadeExtrusion({
    "data-substrate-state": "",
    "data-incoming-source-id": "partner-a.example.com",
    "data-incoming-record-shape": "valid"
  });
  const strangerR = runCascadeExtrusion({
    "data-substrate-state": "",
    "data-incoming-source-id": "stranger.example.com",
    "data-incoming-record-shape": "valid",
    "data-incoming-source-rate-ok": "1"
  });
  // Different outer classifications -> different inner activations
  assert(partnerR.outerCascadeOutput["--source-class"].value !==
    strangerR.outerCascadeOutput["--source-class"].value);
  assert(partnerR.innerCascadeOutput["--next-op"].value !==
    strangerR.innerCascadeOutput["--next-op"].value);
});

test("F3 honored: dispatch flows through cascade rules, not JS conditionals", () => {
  // The structural commitment: source-class classification happens
  // via the OUTER CASCADE rules (REGISTRY_OUTER_CASCADE); arm
  // dispatch happens via the INNER CASCADE rules (TRUST_INNER_
  // CASCADE). promoteCascadeOutputToCoords does mechanical
  // attribute-promotion (no application logic). This is verified
  // by inspection: the rule strings ARE the registry; the
  // promotion function is data-driven by promotionMap; cascade
  // resolution is what produces the dispatch decision.
  //
  // Concrete check: rerunning the same case 100 times produces the
  // same dispatch (deterministic, no hidden JS state).
  const result1 = runCascadeExtrusion({
    "data-substrate-state": "",
    "data-incoming-source-id": "partner-a.example.com",
    "data-incoming-record-shape": "valid"
  });
  for (let i = 0; i < 100; i++) {
    const r = runCascadeExtrusion({
      "data-substrate-state": "",
      "data-incoming-source-id": "partner-a.example.com",
      "data-incoming-record-shape": "valid"
    });
    assert(r.innerCascadeOutput["--next-op"].value ===
      result1.innerCascadeOutput["--next-op"].value);
  }
  assert(result1.innerCascadeOutput["--next-op"].value === "process-trusted-record");
});

// ----------------------------------------------------------------------------
// PART E: ASCII / closure
// ----------------------------------------------------------------------------
console.log("");
console.log("PART E: closure");
console.log("");

test("ASCII-only", () => {
  const src = fs.readFileSync(__filename, "utf8");
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
