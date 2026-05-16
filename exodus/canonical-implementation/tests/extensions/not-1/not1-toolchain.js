// ============================================================================
// not1-toolchain.js  --  shared compiler + JS oracle for the NOT extension
// ============================================================================
// Extracted from not1-equivalence.test.js so the boundary test (not2) can
// reuse the same extended compiler and JS oracle. The two test files run
// independently; this module has no test code, only the toolchain.
// ============================================================================

"use strict";

const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..", "..");
const C = require(path.join(ROOT, "constraints.js"));

const OP = Object.freeze({
  MATCH_DIM:  0x01,
  AND:        0x02,
  NOT:        0x03,
  BEGIN_THEN: 0x10,
  SET_SDF:    0x11,
  SET_RT:     0x12,
  SET_RTH:    0x13,
  SET_DOC:    0x14,
  SET_REG:    0x15,
  SET_DENY:   0x16,
  END_RULE:   0xFF
});

function encode(op, a, b) {
  if (a === undefined) a = 0;
  if (b === undefined) b = 0;
  return ((op & 0xFF) | ((a & 0xFF) << 8) | ((b & 0xFF) << 16)) >>> 0;
}

function parseWhen(when) {
  const clauses = [];
  for (const key of Object.keys(when)) {
    const negated = key.startsWith("!");
    const dimName = negated ? key.slice(1) : key;
    const value = when[key];
    const dIdx = C.dimIndex(dimName); // throws on unknown dim
    const vIdx = C.valueIndex(dIdx, value);
    clauses.push({ dimName, dIdx, value, vIdx, negated });
  }
  clauses.sort((a, b) => a.dIdx - b.dIdx);
  return clauses;
}

function compileRuleExt(rule) {
  const insts = [];
  const clauses = parseWhen(rule.when);
  if (clauses.length === 0) throw new Error("empty `when` not supported");

  for (const c of clauses) {
    insts.push(encode(OP.MATCH_DIM, c.dIdx, c.vIdx));
    if (c.negated) insts.push(encode(OP.NOT));
  }
  for (let i = 0; i < clauses.length - 1; i++) insts.push(encode(OP.AND));

  insts.push(encode(OP.BEGIN_THEN));

  const t = rule.then;
  if (Object.prototype.hasOwnProperty.call(t, "sdf"))  insts.push(encode(OP.SET_SDF, t.sdf === 1 ? 1 : 0));
  if (Object.prototype.hasOwnProperty.call(t, "rt"))   insts.push(encode(OP.SET_RT,  C.lookupIndex(C.RT_TABLE, t.rt)));
  if (Object.prototype.hasOwnProperty.call(t, "rth"))  insts.push(encode(OP.SET_RTH, t.rth));
  if (Object.prototype.hasOwnProperty.call(t, "doc"))  insts.push(encode(OP.SET_DOC, C.lookupIndex(C.DOC_TABLE, t.doc)));
  if (Object.prototype.hasOwnProperty.call(t, "reg"))  insts.push(encode(OP.SET_REG, C.lookupIndex(C.REG_TABLE, t.reg)));
  if (Object.prototype.hasOwnProperty.call(t, "deny")) insts.push(encode(OP.SET_DENY, C.lookupIndex(C.DENY_TABLE, t.deny)));
  insts.push(encode(OP.END_RULE));
  return insts;
}

function sortRulesExt(rules) {
  const indexed = rules.map((r, i) => ({
    rule: r, origIdx: i, count: Object.keys(r.when).length
  }));
  indexed.sort((x, y) => {
    const d = x.count - y.count;
    if (d !== 0) return d;
    return x.origIdx - y.origIdx;
  });
  return indexed.map(e => e.rule);
}

function compileAllExt(rules) {
  const sorted = sortRulesExt(rules);
  const all = [];
  for (const r of sorted) {
    const insts = compileRuleExt(r);
    for (const inst of insts) all.push(inst);
  }
  return Uint32Array.from(all);
}

function executeExt(instructions, coord) {
  let sdf = -1, rt = 0, rth = 0, doc = 0, reg = 0, deny = 0;
  const stack = new Int8Array(8);
  let sp = 0;
  let skipping = false;
  let pc = 0;
  const n = instructions.length;

  while (pc < n) {
    const inst = instructions[pc];
    const op = (inst >>> 0) & 0xFF;
    const a  = (inst >>> 8) & 0xFF;

    if (skipping) {
      if (op === OP.END_RULE) skipping = false;
      pc++;
      continue;
    }

    switch (op) {
      case OP.MATCH_DIM: {
        const b = (inst >>> 16) & 0xFF;
        stack[sp++] = (coord[a] === b) ? 1 : 0;
        break;
      }
      case OP.NOT: {
        stack[sp - 1] = (stack[sp - 1] === 0) ? 1 : 0;
        break;
      }
      case OP.AND: {
        const top = stack[--sp];
        stack[sp - 1] = (stack[sp - 1] & top) & 1;
        break;
      }
      case OP.BEGIN_THEN: {
        const cond = stack[--sp];
        if (cond === 0) skipping = true;
        break;
      }
      case OP.SET_SDF:  sdf  = (a === 1) ? 1 : -1; break;
      case OP.SET_RT:   rt   = a; break;
      case OP.SET_RTH:  rth  = a; break;
      case OP.SET_DOC:  doc  = a; break;
      case OP.SET_REG:  reg  = a; break;
      case OP.SET_DENY: deny = a; break;
      case OP.END_RULE: break;
      default: throw new Error("unknown opcode 0x" + op.toString(16) + " at pc=" + pc);
    }
    pc++;
  }

  if (sdf === 1) { reg = 1; rth = 0; }
  return { sdf, rt, rth, doc, reg, deny };
}

module.exports = { OP, encode, parseWhen, compileRuleExt, sortRulesExt, compileAllExt, executeExt };
