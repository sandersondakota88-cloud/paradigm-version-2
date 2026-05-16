// constraint-geometry.js - Layer C1 - extract dimensions and value tables

"use strict";

const SENTINEL_NONE = "<none>";

// ============================================================================
// Build the geometry
// ============================================================================

function buildGeometry(inSubsetRules, opts) {
  opts = opts || {};

  // Dimension table: ordered list of attribute names.
  //
  // We deliberately exclude `data-substrate-state` from the
  // dimension table because it's a selector-presence check (always
  // true for the state element). Treating it as a dimension would
  // double the state space without expressive value.
  const dimensionNames = [];
  const dimensionValueSets = {};   // name -> Set of value strings

  for (const rule of inSubsetRules) {
    if (rule.selectors.length === 0) continue;
    const sel = rule.selectors[0];
    for (const attr of sel.attributes) {
      if (attr.name === "data-substrate-state") continue;  // presence-only
      if (!attr.hasValue) continue;  // skip value-less (already validated)

      // Strip "data-" prefix for the dimension's display name; the
      // bytecode uses the same dimension index regardless.
      const dimName = stripDataPrefix(attr.name);

      if (dimensionNames.indexOf(dimName) < 0) {
        dimensionNames.push(dimName);
        dimensionValueSets[dimName] = new Set();
      }
      dimensionValueSets[dimName].add(attr.value);
    }
  }

  // Build value tables for each dimension. SENTINEL_NONE always at
  // index 0; named values follow in deterministic order.
  const dimensions = dimensionNames.map(function (name) {
    const values = [SENTINEL_NONE].concat(
      Array.from(dimensionValueSets[name]).sort()
    );
    const valueIndex = {};
    for (let i = 0; i < values.length; i++) valueIndex[values[i]] = i;
    return {
      name: name,
      attributeName: "data-" + name,
      values: values,
      cardinality: values.length,
      valueIndex: valueIndex
    };
  });

  // State-space size = product of cardinalities. For an empty
  // dimension list, state-space = 1 (one coord for "no constraints").
  let stateSpaceSize = 1;
  for (const d of dimensions) stateSpaceSize *= d.cardinality;

  // Output property tables: collect the set of distinct values written
  // by any rule's declarations, per property.
  const outputProperties = {};       // property -> { values: [SENTINEL_NONE, ...], valueIndex: {} }
  for (const rule of inSubsetRules) {
    for (const decl of rule.declarations) {
      if (!outputProperties[decl.property]) {
        outputProperties[decl.property] = {
          name: decl.property,
          valuesSet: new Set([SENTINEL_NONE])
        };
      }
      outputProperties[decl.property].valuesSet.add(decl.value);
    }
  }
  for (const propName of Object.keys(outputProperties)) {
    const op = outputProperties[propName];
    op.values = [SENTINEL_NONE].concat(
      Array.from(op.valuesSet).filter(function (v) { return v !== SENTINEL_NONE; }).sort()
    );
    op.valueIndex = {};
    for (let i = 0; i < op.values.length; i++) op.valueIndex[op.values[i]] = i;
    delete op.valuesSet;
  }

  return {
    dimensions: dimensions,
    dimensionByName: indexBy(dimensions, "name"),
    stateSpaceSize: stateSpaceSize,
    outputProperties: outputProperties,
    sentinelNone: SENTINEL_NONE
  };
}

function stripDataPrefix(attrName) {
  if (attrName.indexOf("data-") === 0) return attrName.slice(5);
  return attrName;
}

function indexBy(arr, key) {
  const out = {};
  for (const item of arr) out[item[key]] = item;
  return out;
}

// ============================================================================
// Coordinate encoding/decoding
// ============================================================================
//
// A coordinate in the state space is an array of dimension-value
// indices, one per dimension. We pack this into a single integer
// (the coord_index used by the GPU dispatch) using mixed-radix
// encoding:
//
//   coord_index = vals[0] * 1
//               + vals[1] * cardinality[0]
//               + vals[2] * cardinality[0] * cardinality[1]
//               + ...
//
// Decoding reverses this. Both directions are needed at test time
// (the harness enumerates every coord_index, decodes to dimension
// values, and checks the resolved output).
// ============================================================================

function encodeCoord(geometry, valueArray) {
  if (valueArray.length !== geometry.dimensions.length) {
    throw new Error("encodeCoord: expected " + geometry.dimensions.length +
                    " values, got " + valueArray.length);
  }
  let idx = 0;
  let multiplier = 1;
  for (let i = 0; i < geometry.dimensions.length; i++) {
    const v = valueArray[i];
    if (v < 0 || v >= geometry.dimensions[i].cardinality) {
      throw new Error("encodeCoord: value " + v + " out of range for dim " +
                      geometry.dimensions[i].name);
    }
    idx += v * multiplier;
    multiplier *= geometry.dimensions[i].cardinality;
  }
  return idx;
}

function decodeCoord(geometry, coordIndex) {
  const result = [];
  let remaining = coordIndex;
  for (let i = 0; i < geometry.dimensions.length; i++) {
    const card = geometry.dimensions[i].cardinality;
    result.push(remaining % card);
    remaining = Math.floor(remaining / card);
  }
  return result;
}

// Resolve a coord_index to its dimension-value names (the inverse
// of encodeCoord, but returning string values).
function describeCoord(geometry, coordIndex) {
  const valueArray = decodeCoord(geometry, coordIndex);
  const result = {};
  for (let i = 0; i < geometry.dimensions.length; i++) {
    const dim = geometry.dimensions[i];
    result[dim.name] = dim.values[valueArray[i]];
  }
  return result;
}

// ============================================================================
// Map a state element's actual attribute values to a coord_index
// ============================================================================
//
// At runtime we have a state element with `data-trigger="delete"` and
// `data-input-present="0"`. Project this to a coord_index in the
// geometry's space. Unknown values map to the sentinel.
// ============================================================================

function coordIndexFromAttributes(geometry, attributes) {
  const valueArray = [];
  for (const dim of geometry.dimensions) {
    const v = attributes[dim.attributeName];
    if (v === undefined || v === null || v === "") {
      valueArray.push(0);  // sentinel
    } else if (dim.valueIndex.hasOwnProperty(v)) {
      valueArray.push(dim.valueIndex[v]);
    } else {
      valueArray.push(0);  // unknown -> sentinel
    }
  }
  return encodeCoord(geometry, valueArray);
}

// ============================================================================
// Geometry summary (for coverage reports)
// ============================================================================

function describeGeometry(geometry) {
  const lines = [];
  lines.push("Constraint geometry:");
  lines.push("  Dimensions: " + geometry.dimensions.length);
  for (const d of geometry.dimensions) {
    lines.push("    " + d.name + " (" + d.attributeName + "): " +
               d.cardinality + " values [" +
               d.values.map(v => JSON.stringify(v)).join(", ") + "]");
  }
  lines.push("  State-space size: " + geometry.stateSpaceSize);
  lines.push("  Output properties:");
  for (const propName of Object.keys(geometry.outputProperties)) {
    const op = geometry.outputProperties[propName];
    lines.push("    " + propName + ": " + op.values.length + " values [" +
               op.values.map(v => JSON.stringify(v)).join(", ") + "]");
  }
  return lines.join("\n");
}

// ============================================================================
// Exports
// ============================================================================

module.exports = Object.freeze({
  SENTINEL_NONE: SENTINEL_NONE,
  buildGeometry: buildGeometry,
  encodeCoord: encodeCoord,
  decodeCoord: decodeCoord,
  describeCoord: describeCoord,
  coordIndexFromAttributes: coordIndexFromAttributes,
  describeGeometry: describeGeometry
});
