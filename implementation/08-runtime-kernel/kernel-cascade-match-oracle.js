// kernel-cascade-match-oracle.js - Kernel substrate cascade-match oracle

"use strict";

// ============================================================================
// stripDataPrefix - normalize attribute names
// ============================================================================
//
// Phase 7 geometry encodes dimensions WITHOUT the "data-" prefix (e.g.,
// "trigger" rather than "data-trigger") - per Phase 7 conventions in
// constraint-geometry.js. The cascade-rule-synthesizer keeps the full
// "data-*" name in the selector. Normalize for lookup.
// ============================================================================

function stripDataPrefix(attr) {
  if (typeof attr !== "string") return attr;
  if (attr.indexOf("data-") === 0) return attr.substring(5);
  return attr;
}

// ============================================================================
// matchConstraintAtCoord
// ============================================================================
//
// Given a single cascade-match constraint and a coord (decoded into a
// dim->value map), return true if the constraint's selector is satisfied.
// ============================================================================

function matchConstraintAtCoord(constraint, coordValues, geometry) {
  if (!constraint.pattern || constraint.pattern.type !== "cascade-match") {
    return false;
  }
  const sel = constraint.pattern.selector;

  // Build dimension-name set from geometry (presence-only attrs that aren't
  // dimensions are always-satisfied per Phase 7's geometry conventions:
  // only value-tested attributes become dimensions).
  let dimNames = null;
  if (geometry) {
    dimNames = {};
    for (const dim of geometry.dimensions) {
      dimNames[dim.name] = true;
    }
  }

  for (const attr of Object.keys(sel)) {
    const required = sel[attr];
    const dimName = stripDataPrefix(attr);

    if (dimNames && !dimNames[dimName]) {
      // Attribute not a dimension - presence-only on the state element.
      // Always satisfied for any coord on a state element. Skip.
      continue;
    }

    const actual = coordValues[dimName];

    if (required === "*") {
      // explicit presence test
      if (actual === undefined || actual === "<none>") return false;
    } else {
      if (actual !== required) return false;
    }
  }
  return true;
}

// ============================================================================
// resolveAll
// ============================================================================
//
// Walk the full state space. For each coord, walk all constraints with
// cascade-match patterns. The LAST matching constraint's emit.property
// and emit.value win (cascade-style: later rules override earlier).
//
// Default value when no constraint matches: index 0 in the property's
// value table (the unset-state value).
// ============================================================================

function resolveAll(constraints, geometry) {
  const propNames = Object.keys(geometry.outputProperties);
  const P = propNames.length;
  const N = geometry.stateSpaceSize;
  const outputs = new Uint32Array(N * P);

  // Phase 7 geometry stores outputProperties as
  //   { propName: { name, values: [...], valueIndex: { value: idx, ... } } }
  // Use valueIndex directly for lookups.
  const propValueIndex = {};
  for (const prop of propNames) {
    propValueIndex[prop] = geometry.outputProperties[prop].valueIndex;
  }

  for (let coordIdx = 0; coordIdx < N; coordIdx++) {
    // Decode coord into a dimName -> value map
    const coordValues = decodeCoordToMap(geometry, coordIdx);

    // Initialize per-prop output to default (index 0 = unset)
    const out = {};
    for (const prop of propNames) {
      out[prop] = 0;
    }

    // Walk constraints; last matching wins per property
    for (const c of constraints) {
      if (matchConstraintAtCoord(c, coordValues, geometry)) {
        const propName = c.emit.property;
        const idxMap = propValueIndex[propName];
        if (idxMap !== undefined) {
          const valueIdx = idxMap[c.emit.value];
          if (valueIdx !== undefined) {
            out[propName] = valueIdx;
          }
        }
      }
    }

    // Pack into the flat output
    for (let pi = 0; pi < P; pi++) {
      outputs[coordIdx * P + pi] = out[propNames[pi]];
    }
  }

  return {
    outputs: outputs,
    propNames: propNames,
    coordCount: N
  };
}

// ============================================================================
// decodeCoordToMap
// ============================================================================
//
// Inverse of geometry.encodeCoord: given a coord index, produce a
// dimName -> value map. Walks the dimensions in order, dividing
// out cardinalities.
// ============================================================================

function decodeCoordToMap(geometry, coordIdx) {
  const result = {};
  let remaining = coordIdx;
  for (let di = 0; di < geometry.dimensions.length; di++) {
    const dim = geometry.dimensions[di];
    const card = dim.values.length;
    const valueIdx = remaining % card;
    remaining = Math.floor(remaining / card);
    result[dim.name] = dim.values[valueIdx];
  }
  return result;
}

// ============================================================================
// Exports
// ============================================================================

module.exports = Object.freeze({
  resolveAll: resolveAll,
  matchConstraintAtCoord: matchConstraintAtCoord,
  decodeCoordToMap: decodeCoordToMap,
  stripDataPrefix: stripDataPrefix
});
