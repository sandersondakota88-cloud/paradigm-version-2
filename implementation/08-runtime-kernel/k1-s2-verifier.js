// k1-s2-verifier.js - K1 acceptance criterion 6

"use strict";

const Parser = require("./css-subset-parser.js");
const Geometry = require("./constraint-geometry.js");
const Oracle = require("./oracle-resolver.js");
const KernelOracle = require("./kernel-cascade-match-oracle.js");
const Synth = require("./cascade-rule-synthesizer.js");

const TODOMVC_CASCADE = [
  '[data-substrate-state][data-trigger="toggle"] { --next-op: "toggleTodo"; }',
  '[data-substrate-state][data-trigger="delete"] { --next-op: "deleteTodo"; }',
  '[data-substrate-state][data-trigger="submit"][data-input-present="1"] { --next-op: "addTodo"; }',
  '[data-substrate-state][data-trigger="clear-completed"] { --next-op: "clearCompleted"; }'
].join("\n");

let pass = 0, fail = 0;
const failures = [];

function test(name, fn) {
  try { fn(); pass++; console.log("  OK   " + name); }
  catch (e) { fail++; failures.push({ name, error: e }); console.log("  FAIL " + name + ": " + e.message); }
}
function assert(c, m) { if (!c) throw new Error("assertion failed: " + (m || "")); }

console.log("k1-s2 verification (criterion 6 - 4-substrate equivalence)");
console.log("");

// ----------------------------------------------------------------------------
// Setup: parse rules; build geometry; synthesize kernel constraints
// ----------------------------------------------------------------------------

let parsed, inSubsetRules, geometry, kernelConstraints;

test("parse TodoMVC cascade rules", () => {
  parsed = Parser.parseRules(TODOMVC_CASCADE);
  assert(parsed.errors.length === 0, "no parse errors");
  assert(parsed.rules.length === 4, "4 rules parsed");
  const subset = Parser.validateSubset(parsed.rules);
  inSubsetRules = subset.inSubset;
  assert(inSubsetRules.length === 4, "4 rules in subset");
});

test("build constraint geometry", () => {
  geometry = Geometry.buildGeometry(inSubsetRules);
  assert(geometry);
  assert(geometry.stateSpaceSize > 0);
  assert(geometry.dimensions.length > 0);
  console.log("    state space size: " + geometry.stateSpaceSize);
  console.log("    dimensions: " + geometry.dimensions.length);
  console.log("    output properties: " + Object.keys(geometry.outputProperties).length);
});

test("synthesize kernel cascade-match constraints", () => {
  const r = Synth.synthesizeFromCss(TODOMVC_CASCADE);
  assert(r.ok, "synthesis ok");
  kernelConstraints = r.constraints;
  assert(kernelConstraints.length === 4);
});

// ----------------------------------------------------------------------------
// Run both oracles
// ----------------------------------------------------------------------------

let phase7Result, kernelResult;

test("Phase 7 oracle-resolver runs on geometry", () => {
  phase7Result = Oracle.resolveAll(inSubsetRules, geometry);
  assert(phase7Result.outputs);
  assert(phase7Result.outputs.length === geometry.stateSpaceSize * Object.keys(geometry.outputProperties).length);
});

test("Phase 8 kernel-cascade-match-oracle runs on geometry", () => {
  kernelResult = KernelOracle.resolveAll(kernelConstraints, geometry);
  assert(kernelResult.outputs);
  assert(kernelResult.outputs.length === phase7Result.outputs.length);
});

// ----------------------------------------------------------------------------
// Byte-equivalence: the S2 claim
// ----------------------------------------------------------------------------

test("output array lengths match", () => {
  assert(kernelResult.outputs.length === phase7Result.outputs.length,
    "lengths " + kernelResult.outputs.length + " vs " + phase7Result.outputs.length);
});

test("propNames match", () => {
  assert(kernelResult.propNames.length === phase7Result.propNames.length);
  for (let i = 0; i < kernelResult.propNames.length; i++) {
    assert(kernelResult.propNames[i] === phase7Result.propNames[i],
      "propName " + i + ": " + kernelResult.propNames[i] + " vs " + phase7Result.propNames[i]);
  }
});

test("coordCount match", () => {
  assert(kernelResult.coordCount === phase7Result.coordCount);
});

test("S2: byte-equivalent across full state space", () => {
  let firstMismatch = -1;
  let mismatchCount = 0;
  for (let i = 0; i < phase7Result.outputs.length; i++) {
    if (kernelResult.outputs[i] !== phase7Result.outputs[i]) {
      if (firstMismatch < 0) firstMismatch = i;
      mismatchCount++;
    }
  }
  if (mismatchCount > 0) {
    // Localize the failure: which coord, which property
    const P = phase7Result.propNames.length;
    const coordIdx = Math.floor(firstMismatch / P);
    const propIdx = firstMismatch % P;
    const propName = phase7Result.propNames[propIdx];
    const phase7Val = phase7Result.outputs[firstMismatch];
    const kernelVal = kernelResult.outputs[firstMismatch];
    const coordValues = KernelOracle.decodeCoordToMap(geometry, coordIdx);
    console.log("    FIRST MISMATCH:");
    console.log("    coord " + coordIdx + ": " + JSON.stringify(coordValues));
    console.log("    property: " + propName);
    console.log("    Phase 7 output: " + phase7Val + " (=" +
      geometry.outputProperties[propName].values[phase7Val] + ")");
    console.log("    Kernel output: " + kernelVal + " (=" +
      (geometry.outputProperties[propName].values[kernelVal] || "<oob>") + ")");
    console.log("    total mismatches: " + mismatchCount + " of " +
      phase7Result.outputs.length);
  }
  assert(mismatchCount === 0,
    mismatchCount + " mismatches (first at index " + firstMismatch + ")");
  console.log("    " + phase7Result.outputs.length + " cells byte-equivalent across substrates");
});

// ----------------------------------------------------------------------------
// Coverage diagnostic: confirm every constraint matches at least one coord
// (not strictly required for S2, but useful sanity)
// ----------------------------------------------------------------------------

test("coverage: each kernel constraint matches at least one coord", () => {
  for (let ki = 0; ki < kernelConstraints.length; ki++) {
    const c = kernelConstraints[ki];
    let matchedAtLeastOne = false;
    for (let coordIdx = 0; coordIdx < geometry.stateSpaceSize; coordIdx++) {
      const coordValues = KernelOracle.decodeCoordToMap(geometry, coordIdx);
      if (KernelOracle.matchConstraintAtCoord(c, coordValues, geometry)) {
        matchedAtLeastOne = true;
        break;
      }
    }
    assert(matchedAtLeastOne, "constraint " + ki + " (" + c.id + ") matches no coord");
  }
});

// ----------------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------------

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
