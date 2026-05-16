// ============================================================================
// compile-constraints.mjs  -  ES module version (mirror of compile-constraints.js)
// ============================================================================

import {
  DIMS, CONSTRAINTS, RT_TABLE, DOC_TABLE, REG_TABLE, DENY_TABLE,
  dimIndex, valueIndex, lookupIndex
} from "./constraints.mjs";

const OP = Object.freeze({
  MATCH_DIM:  0x01,
  AND:        0x02,
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
  if (op < 0 || op > 0xFF) throw new Error("bad opcode: " + op);
  if (a === undefined) a = 0;
  if (b === undefined) b = 0;
  if (a < 0 || a > 0xFF) throw new Error("operand a out of range: " + a);
  if (b < 0 || b > 0xFF) throw new Error("operand b out of range: " + b);
  return ((op & 0xFF) | ((a & 0xFF) << 8) | ((b & 0xFF) << 16)) >>> 0;
}

function decode(u32) {
  return {
    op: (u32 >>> 0)  & 0xFF,
    a:  (u32 >>> 8)  & 0xFF,
    b:  (u32 >>> 16) & 0xFF
  };
}

function sortRules(rules) {
  const indexed = rules.map((r, i) => ({ rule: r, origIdx: i, whenKeys: Object.keys(r.when) }));
  indexed.sort((x, y) => {
    const d = x.whenKeys.length - y.whenKeys.length;
    if (d !== 0) return d;
    return x.origIdx - y.origIdx;
  });
  return indexed.map(e => e.rule);
}

function compileRule(rule) {
  const insts = [];
  const whenKeys = Object.keys(rule.when);
  if (whenKeys.length === 0) throw new Error("rule with empty `when` is not supported");

  const sortedWhen = whenKeys
    .map(k => ({ key: k, dIdx: dimIndex(k), vIdx: valueIndex(dimIndex(k), rule.when[k]) }))
    .sort((x, y) => x.dIdx - y.dIdx);

  for (const w of sortedWhen) insts.push(encode(OP.MATCH_DIM, w.dIdx, w.vIdx));
  for (let i = 0; i < sortedWhen.length - 1; i++) insts.push(encode(OP.AND));

  insts.push(encode(OP.BEGIN_THEN));

  const t = rule.then;
  if (Object.prototype.hasOwnProperty.call(t, "sdf")) {
    insts.push(encode(OP.SET_SDF, t.sdf === 1 ? 1 : 0));
  }
  if (Object.prototype.hasOwnProperty.call(t, "rt")) {
    const idx = lookupIndex(RT_TABLE, t.rt);
    if (idx < 0) throw new Error("rt not in table: " + t.rt);
    insts.push(encode(OP.SET_RT, idx));
  }
  if (Object.prototype.hasOwnProperty.call(t, "rth")) {
    if ((t.rth | 0) !== t.rth || t.rth < 0 || t.rth > 255)
      throw new Error("rth out of u8 range: " + t.rth);
    insts.push(encode(OP.SET_RTH, t.rth));
  }
  if (Object.prototype.hasOwnProperty.call(t, "doc")) {
    const idx = lookupIndex(DOC_TABLE, t.doc);
    if (idx < 0) throw new Error("doc not in table: " + t.doc);
    insts.push(encode(OP.SET_DOC, idx));
  }
  if (Object.prototype.hasOwnProperty.call(t, "reg")) {
    const idx = lookupIndex(REG_TABLE, t.reg);
    if (idx < 0) throw new Error("reg not in table: " + t.reg);
    insts.push(encode(OP.SET_REG, idx));
  }
  if (Object.prototype.hasOwnProperty.call(t, "deny")) {
    const idx = lookupIndex(DENY_TABLE, t.deny);
    if (idx < 0) throw new Error("deny not in table: " + JSON.stringify(t.deny));
    insts.push(encode(OP.SET_DENY, idx));
  }

  insts.push(encode(OP.END_RULE));
  return insts;
}

function compileAll() {
  const sorted = sortRules(CONSTRAINTS);
  const all = [];
  const perRuleLengths = [];
  for (const r of sorted) {
    const insts = compileRule(r);
    perRuleLengths.push(insts.length);
    all.push(...insts);
  }
  return {
    instructions: Uint32Array.from(all),
    stats: {
      ruleCount: sorted.length,
      totalInstructions: all.length,
      perRule: perRuleLengths,
      byteSize: all.length * 4
    }
  };
}

function disassemble(instructions) {
  const names = {};
  for (const k in OP) names[OP[k]] = k;
  const lines = [];
  for (let i = 0; i < instructions.length; i++) {
    const d = decode(instructions[i]);
    const name = names[d.op] || ("OP_" + d.op.toString(16));
    lines.push(
      String(i).padStart(3, " ") + "  0x" +
      instructions[i].toString(16).padStart(8, "0") + "  " +
      name.padEnd(13) +
      (d.a || d.b ? "a=" + d.a + " b=" + d.b : "")
    );
  }
  return lines.join("\n");
}

export { OP, encode, decode, compileRule, compileAll, disassemble, sortRules };
