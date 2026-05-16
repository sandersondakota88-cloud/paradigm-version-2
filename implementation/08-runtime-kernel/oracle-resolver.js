// oracle-resolver.js - Layer C2 - JS oracle (third substrate)

"use strict";

const G = require("./constraint-geometry.js");

// ============================================================================
// Build per-rule coord bitsets
// ============================================================================
//
// For each rule, compute the set of coord_indices where the rule's
// selector matches. The bitset is a Uint8Array of length
// stateSpaceSize (1 byte per coord; we don't need the density of
// a true bitset because state spaces are small).
//
// The matching logic walks all coord_indices, decodes each into
// dimension values, and tests the rule's attribute conditions
// against those values. This is the EXPENSIVE direction — but it
// only happens once per rule at compile time.
// ============================================================================

function compileRuleBitsets(inSubsetRules, geometry) {
  const compiled = [];
  for (const rule of inSubsetRules) {
    const conditions = [];
    for (const attr of rule.selectors[0].attributes) {
      if (attr.name === "data-substrate-state") continue;  // presence-only
      if (!attr.hasValue) continue;

      const dimName = attr.name.indexOf("data-") === 0
        ? attr.name.slice(5) : attr.name;
      const dim = geometry.dimensionByName[dimName];
      if (!dim) continue;
      const dimIdx = geometry.dimensions.indexOf(dim);
      const valueIdx = dim.valueIndex[attr.value];
      if (valueIdx === undefined) continue;

      conditions.push({ dimIdx: dimIdx, valueIdx: valueIdx });
    }

    // Compile effects: per-property, the value index to set.
    const effects = [];
    for (const decl of rule.declarations) {
      const op = geometry.outputProperties[decl.property];
      if (!op) continue;
      const valueIdx = op.valueIndex[decl.value];
      if (valueIdx === undefined) continue;
      effects.push({ property: decl.property, valueIdx: valueIdx });
    }

    // Build the bitset: 1 if the rule matches that coord, 0 otherwise.
    const bitset = new Uint8Array(geometry.stateSpaceSize);
    for (let ci = 0; ci < geometry.stateSpaceSize; ci++) {
      const coord = G.decodeCoord(geometry, ci);
      let allMatch = true;
      for (const cond of conditions) {
        if (coord[cond.dimIdx] !== cond.valueIdx) {
          allMatch = false;
          break;
        }
      }
      bitset[ci] = allMatch ? 1 : 0;
    }

    compiled.push({
      bitset: bitset,
      effects: effects,
      conditionCount: conditions.length
    });
  }
  return compiled;
}

// ============================================================================
// Resolve a single coord using compiled bitsets
// ============================================================================
//
// For each rule, check the bitset at coord_index; if set, apply the
// rule's effects. Source order = compilation order; later rules of
// the same property override earlier ones.
// ============================================================================

function resolveCoord(compiledRules, geometry, coordIndex) {
  const out = {};
  for (const propName of Object.keys(geometry.outputProperties)) {
    out[propName] = 0;  // sentinel
  }

  for (const cr of compiledRules) {
    if (cr.bitset[coordIndex] !== 1) continue;
    for (const eff of cr.effects) {
      out[eff.property] = eff.valueIdx;
    }
  }

  return out;
}

// ============================================================================
// Resolve full state space (enumeration, parallel-ready)
// ============================================================================
//
// Returns the same flat Uint32Array shape as the other backends.
// Every coord, every output property, all in one pass.
// ============================================================================

function resolveAll(inSubsetRules, geometry) {
  const compiled = compileRuleBitsets(inSubsetRules, geometry);
  const propNames = Object.keys(geometry.outputProperties);
  const P = propNames.length;
  const outputs = new Uint32Array(geometry.stateSpaceSize * P);

  for (let ci = 0; ci < geometry.stateSpaceSize; ci++) {
    const out = resolveCoord(compiled, geometry, ci);
    for (let pi = 0; pi < P; pi++) {
      outputs[ci * P + pi] = out[propNames[pi]];
    }
  }

  return {
    outputs: outputs,
    propNames: propNames,
    coordCount: geometry.stateSpaceSize,
    compiledRules: compiled
  };
}

// ============================================================================
// Diagnostic: report which rules cover which coords
// ============================================================================
//
// For verification debugging: returns, for each rule, the set of
// coord_indices the rule matches. Useful when the three substrates
// disagree at a specific coord — comparing which rules cover that
// coord across substrates surfaces the source of divergence.
// ============================================================================

function reportCoverage(compiledRules, geometry) {
  const lines = [];
  for (let ri = 0; ri < compiledRules.length; ri++) {
    const cr = compiledRules[ri];
    const covered = [];
    for (let ci = 0; ci < cr.bitset.length; ci++) {
      if (cr.bitset[ci]) covered.push(ci);
    }
    lines.push("rule " + ri + " (" + cr.conditionCount + " conditions): " +
               covered.length + " coords match");
    if (covered.length > 0 && covered.length <= 8) {
      lines.push("  matches: [" + covered.join(", ") + "]");
    }
  }
  return lines.join("\n");
}

// ============================================================================
// Exports
// ============================================================================

module.exports = Object.freeze({
  compileRuleBitsets: compileRuleBitsets,
  resolveCoord: resolveCoord,
  resolveAll: resolveAll,
  reportCoverage: reportCoverage
});
