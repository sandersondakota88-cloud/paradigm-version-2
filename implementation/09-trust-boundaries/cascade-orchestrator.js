// cascade-orchestrator.js - multi-pass cascade resolution primitive

"use strict";

const F1Harness = require("./f1-cascade-harness.js");
const Synth = require("./cascade-rule-synthesizer.js");

// ----------------------------------------------------------------------------
// promoteCascadeOutputToCoords - mechanical promotion step
//
// Given a coord set, a cascade output map, and a promotion map
// (custom-property name -> coord-attribute name), produces a new
// coord set with the promoted values added. Original coords preserved
// (F5).
// ----------------------------------------------------------------------------
function promoteCascadeOutputToCoords(initialCoords, cascadeOutput, promotionMap) {
  if (!initialCoords || typeof initialCoords !== "object") {
    throw new TypeError("promoteCascadeOutputToCoords: initialCoords required");
  }
  if (!cascadeOutput || typeof cascadeOutput !== "object") {
    throw new TypeError("promoteCascadeOutputToCoords: cascadeOutput required");
  }
  if (!promotionMap || typeof promotionMap !== "object") {
    throw new TypeError("promoteCascadeOutputToCoords: promotionMap required");
  }

  const out = Object.assign({}, initialCoords);
  for (const propName of Object.keys(promotionMap)) {
    const attrName = promotionMap[propName];
    const co = cascadeOutput[propName];
    if (co && typeof co.value !== "undefined") {
      out[attrName] = co.value;
    }
  }
  return out;
}

// ----------------------------------------------------------------------------
// runOnePass - synthesize rules, run cascade, return output
//
// Internal helper. Accepts either a rules-string (synthesizes) or a
// pre-synthesized constraint array.
// ----------------------------------------------------------------------------
function runOnePass(rulesOrConstraints, coords) {
  let constraints;
  if (Array.isArray(rulesOrConstraints)) {
    constraints = rulesOrConstraints;
  } else if (typeof rulesOrConstraints === "string") {
    const synth = Synth.synthesizeFromCss(rulesOrConstraints);
    if (!synth.ok) {
      throw new Error("synth failed: " + JSON.stringify(synth.errors));
    }
    constraints = synth.constraints;
  } else {
    throw new TypeError("runOnePass: rules must be string or array");
  }
  const result = F1Harness.runCascade(constraints, coords);
  return result.cascadeOutput || {};
}

// ----------------------------------------------------------------------------
// runPasses - sequence multiple cascade passes
//
// passes: array of {rules, promotionMap}
//   rules: CSS rule string (or pre-synthesized constraint array)
//   promotionMap: optional, map from cascade-output property name to
//     coord attribute name. Empty/missing means no promotion (final
//     pass typically).
//
// initialCoords: starting coord set
//
// Returns: { finalCoords, passes: [{output, promoted}], lastOutput }
// ----------------------------------------------------------------------------
function runPasses(passes, initialCoords) {
  if (!Array.isArray(passes)) {
    throw new TypeError("runPasses: passes must be array");
  }
  if (!initialCoords || typeof initialCoords !== "object") {
    throw new TypeError("runPasses: initialCoords required");
  }

  let coords = Object.assign({}, initialCoords);
  const passResults = [];
  let lastOutput = {};

  for (let i = 0; i < passes.length; i++) {
    const p = passes[i];
    if (!p || (!p.rules && !Array.isArray(p.rules))) {
      throw new TypeError("runPasses: pass " + i + " requires rules");
    }
    lastOutput = runOnePass(p.rules, coords);
    const promoted = (p.promotionMap && Object.keys(p.promotionMap).length > 0)
      ? promoteCascadeOutputToCoords(coords, lastOutput, p.promotionMap)
      : coords;
    passResults.push({
      output: lastOutput,
      promoted: promoted
    });
    coords = promoted;
  }

  return {
    finalCoords: coords,
    passes: passResults,
    lastOutput: lastOutput
  };
}

// ----------------------------------------------------------------------------
// runUntilFixpoint - same rule set repeatedly until coords stop changing
//
// Useful when one rule set defines an iterative resolution where each
// pass produces additional coords that subsequent passes can match.
// Terminates when a pass produces no new coord values OR maxPasses
// reached.
//
// rules: CSS rule string or constraint array
// promotionMap: which output properties to promote to coords each pass
// initialCoords: starting coord set
// maxPasses: safety cap (default 16)
//
// Returns: { finalCoords, passCount, converged, passes }
// ----------------------------------------------------------------------------
function runUntilFixpoint(rules, promotionMap, initialCoords, maxPasses) {
  const cap = (typeof maxPasses === "number" && maxPasses > 0) ? maxPasses : 16;
  let coords = Object.assign({}, initialCoords);
  const passes = [];
  let converged = false;

  for (let i = 0; i < cap; i++) {
    const output = runOnePass(rules, coords);
    const promoted = promoteCascadeOutputToCoords(coords, output, promotionMap);
    passes.push({ output: output, promoted: promoted });
    // Convergence check: did promotion produce any NEW coord value?
    let changed = false;
    for (const k of Object.keys(promoted)) {
      if (coords[k] !== promoted[k]) { changed = true; break; }
    }
    coords = promoted;
    if (!changed) {
      converged = true;
      break;
    }
  }

  return {
    finalCoords: coords,
    passCount: passes.length,
    converged: converged,
    passes: passes
  };
}

module.exports = Object.freeze({
  promoteCascadeOutputToCoords: promoteCascadeOutputToCoords,
  runPasses: runPasses,
  runUntilFixpoint: runUntilFixpoint
});
