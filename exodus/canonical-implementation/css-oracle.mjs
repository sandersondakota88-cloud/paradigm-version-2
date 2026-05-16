// ============================================================================
// css-oracle.mjs  -  ES module version (mirror of css-oracle.js)
// ============================================================================

import {
  DIMS, DEFAULTS, CONSTRAINTS, STATE_SPACE_SIZE, unpackCoord,
  RT_TABLE, DOC_TABLE, REG_TABLE, DENY_TABLE, lookupIndex
} from "./constraints.mjs";

const SORTED_CONSTRAINTS = (() => {
  const indexed = CONSTRAINTS.map((r, i) => ({
    rule: r, origIdx: i, whenCount: Object.keys(r.when).length
  }));
  indexed.sort((x, y) => {
    const d = x.whenCount - y.whenCount;
    if (d !== 0) return d;
    return x.origIdx - y.origIdx;
  });
  return indexed.map(e => e.rule);
})();

function findDim(name) {
  for (let i = 0; i < DIMS.length; i++) if (DIMS[i].name === name) return i;
  throw new Error("unknown dim: " + name);
}

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

function applyThen(then, out) {
  if (Object.prototype.hasOwnProperty.call(then, "sdf"))  out.sdf  = then.sdf;
  if (Object.prototype.hasOwnProperty.call(then, "reg"))  out.reg  = then.reg;
  if (Object.prototype.hasOwnProperty.call(then, "deny")) out.deny = then.deny;
  if (Object.prototype.hasOwnProperty.call(then, "rt"))   out.rt   = then.rt;
  if (Object.prototype.hasOwnProperty.call(then, "rth"))  out.rth  = then.rth;
  if (Object.prototype.hasOwnProperty.call(then, "doc"))  out.doc  = then.doc;
}

function resolveCoord(coord) {
  const out = {
    sdf: DEFAULTS.sdf, reg: DEFAULTS.reg, deny: DEFAULTS.deny,
    rt: DEFAULTS.rt, rth: DEFAULTS.rth, doc: DEFAULTS.doc
  };
  for (let i = 0; i < SORTED_CONSTRAINTS.length; i++) {
    const c = SORTED_CONSTRAINTS[i];
    if (matches(c.when, coord)) applyThen(c.then, out);
  }
  if (out.sdf === 1) {
    out.reg = "DENIED";
    out.rth = 0;
  }
  return out;
}

function resolveAll() {
  const out = new Array(STATE_SPACE_SIZE);
  for (let i = 0; i < STATE_SPACE_SIZE; i++) {
    out[i] = resolveCoord(unpackCoord(i));
  }
  return out;
}

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

export { resolveCoord, resolveAll, recordToIndices };
