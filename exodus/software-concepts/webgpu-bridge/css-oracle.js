// ============================================================================
// css-oracle.js  -  the reference resolver
// ============================================================================
// Implements the canonical resolution procedure from constraints.md section 4
// exactly. This is what the CSS cascade does, expressed in plain JS so we can
// run it outside a browser and use it as the ground truth for the verification
// harness.
//
// Procedure (verbatim from spec):
//   1. Initialize outputs to the defaults from section 2.
//   2. For each constraint in order:
//      - If every key in `when` matches the coord's value for that dim, apply
//        the entries in `then` to the current output record (overwriting
//        previous).
//   3. If `sdf == 1` at the end, derive `reg = "DENIED"` and `rth = 0`.
// ============================================================================

"use strict";

const {
  DIMS,
  DEFAULTS,
  CONSTRAINTS,
  STATE_SPACE_SIZE,
  unpackCoord,
  RT_TABLE,
  DOC_TABLE,
  REG_TABLE,
  DENY_TABLE,
  lookupIndex
} = require("./constraints.js");

// Pre-sort constraints by specificity (|when| ascending, stable).
// constraints.md section 3: "Later rules with equal or greater specificity
// (more `when` keys) override earlier ones. For ties, insertion order wins."
// So we apply in specificity-ascending order, and within equal specificity,
// in declaration order. Stable sort preserves the latter.
const SORTED_CONSTRAINTS = (() => {
  const indexed = CONSTRAINTS.map((r, i) => ({
    rule: r,
    origIdx: i,
    whenCount: Object.keys(r.when).length
  }));
  indexed.sort((x, y) => {
    const d = x.whenCount - y.whenCount;
    if (d !== 0) return d;
    return x.origIdx - y.origIdx;
  });
  return indexed.map(e => e.rule);
})();

// Resolve a single coordinate (array of value indices, one per dim).
// Returns a record with the six output fields as STRINGS, not indices.
// This matches what the CSS cascade produces (getComputedStyle returns
// strings).
function resolveCoord(coord) {
  // Step 1: start from defaults
  const out = {
    sdf:  DEFAULTS.sdf,
    reg:  DEFAULTS.reg,
    deny: DEFAULTS.deny,
    rt:   DEFAULTS.rt,
    rth:  DEFAULTS.rth,
    doc:  DEFAULTS.doc
  };

  // Step 2: iterate constraints in specificity-ascending (stable) order.
  // This reproduces CSS specificity: more-specific rules apply after less-
  // specific ones and therefore win on shared output fields.
  for (let i = 0; i < SORTED_CONSTRAINTS.length; i++) {
    const c = SORTED_CONSTRAINTS[i];
    if (matches(c.when, coord)) {
      applyThen(c.then, out);
    }
  }

  // Step 3: post-process denial
  if (out.sdf === 1) {
    out.reg = "DENIED";
    out.rth = 0;
  }

  return out;
}

// Does `when` match this coord? Every key in `when` must match the coord's
// value at that dim.
function matches(when, coord) {
  for (const dimName in when) {
    if (!Object.prototype.hasOwnProperty.call(when, dimName)) continue;
    const dIdx = findDim(dimName);
    const expected = when[dimName];
    const actualIdx = coord[dIdx];
    const actualValue = DIMS[dIdx].values[actualIdx];
    if (actualValue !== expected) return false;
  }
  return true;
}

function findDim(name) {
  for (let i = 0; i < DIMS.length; i++) {
    if (DIMS[i].name === name) return i;
  }
  throw new Error("unknown dim: " + name);
}

// Apply a `then` clause to the output record. Fields present override;
// fields absent are left alone.
function applyThen(then, out) {
  if (Object.prototype.hasOwnProperty.call(then, "sdf"))  out.sdf  = then.sdf;
  if (Object.prototype.hasOwnProperty.call(then, "reg"))  out.reg  = then.reg;
  if (Object.prototype.hasOwnProperty.call(then, "deny")) out.deny = then.deny;
  if (Object.prototype.hasOwnProperty.call(then, "rt"))   out.rt   = then.rt;
  if (Object.prototype.hasOwnProperty.call(then, "rth"))  out.rth  = then.rth;
  if (Object.prototype.hasOwnProperty.call(then, "doc"))  out.doc  = then.doc;
}

// Resolve every coordinate in the state space, return an array of records
// indexed by the canonical linear coord index.
function resolveAll() {
  const out = new Array(STATE_SPACE_SIZE);
  for (let i = 0; i < STATE_SPACE_SIZE; i++) {
    out[i] = resolveCoord(unpackCoord(i));
  }
  return out;
}

// Convert a string-valued record to the index-valued form the GPU emits,
// for byte-level comparison. Throws if any string is absent from its table.
function recordToIndices(rec) {
  const rtIdx   = lookupIndex(RT_TABLE,   rec.rt);
  const docIdx  = lookupIndex(DOC_TABLE,  rec.doc);
  const regIdx  = lookupIndex(REG_TABLE,  rec.reg);
  const denyIdx = lookupIndex(DENY_TABLE, rec.deny);
  if (rtIdx   < 0) throw new Error("rt not in table: "   + JSON.stringify(rec.rt));
  if (docIdx  < 0) throw new Error("doc not in table: "  + JSON.stringify(rec.doc));
  if (regIdx  < 0) throw new Error("reg not in table: "  + JSON.stringify(rec.reg));
  if (denyIdx < 0) throw new Error("deny not in table: " + JSON.stringify(rec.deny));
  return {
    sdf:  rec.sdf | 0,
    rth:  rec.rth >>> 0,
    rt:   rtIdx   >>> 0,
    doc:  docIdx  >>> 0,
    reg:  regIdx  >>> 0,
    deny: denyIdx >>> 0
  };
}

module.exports = { resolveCoord, resolveAll, recordToIndices };
