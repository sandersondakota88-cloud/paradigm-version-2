// ============================================================================
// compile-constraints.js  -  compile {when, then} rules to a postfix u32
// instruction buffer for the GPU stack machine.
// ============================================================================
// Target instruction encoding (from algorithm #16):
//
//   Each instruction is a u32 packed as:
//     [opcode:8, operand_a:8, operand_b:8, reserved:8]  (little-endian layout
//     in the u32; we pack as (op | a<<8 | b<<16).)
//
//   OP_MATCH_DIM   0x01  a=dim_index   b=value_index
//     Push 1 if coord[a] == b else 0.
//
//   OP_AND         0x02
//     Pop two; push (top & next).
//
//   OP_BEGIN_THEN  0x10
//     Pop condition. If 0, skip forward to matching OP_END_RULE. If 1,
//     continue executing.
//
//   OP_SET_SDF     0x11  a in {0, 1}   (0 encodes -1, 1 encodes +1)
//   OP_SET_RT      0x12  a=rt_index
//   OP_SET_RTH     0x13  a=rth_value   (literal u8, 0..255; fits 95, 130, 160)
//   OP_SET_DOC     0x14  a=doc_index
//   OP_SET_REG     0x15  a=reg_index
//   OP_SET_DENY    0x16  a=deny_index
//
//   OP_END_RULE    0xFF
//     Clears skipping; advances past end of this rule's then-block.
//
// Rule emission order:
//   Rules are emitted sorted by |when| ascending. Stable sort -- within equal
//   specificity, declaration order is preserved. This means:
//     - 1-key rules emit first (credit-tier defaults, residency uplifts)
//     - 2-key denials next
//     - 3-key denial last
//   Because the stack machine accumulates effects into a single output record
//   and later writes override earlier, this reproduces CSS specificity
//   semantics exactly.
// ============================================================================

"use strict";

const {
  DIMS,
  CONSTRAINTS,
  RT_TABLE,
  DOC_TABLE,
  REG_TABLE,
  DENY_TABLE,
  dimIndex,
  valueIndex,
  lookupIndex
} = require("./constraints.js");

// Opcodes
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

// Stable-sort rules by |when| ascending.
function sortRules(rules) {
  // Attach original index to preserve declaration order among ties.
  const indexed = rules.map((r, i) => ({ rule: r, origIdx: i, whenKeys: Object.keys(r.when) }));
  indexed.sort((x, y) => {
    const d = x.whenKeys.length - y.whenKeys.length;
    if (d !== 0) return d;
    return x.origIdx - y.origIdx;
  });
  return indexed.map(e => e.rule);
}

// Compile a single rule to an array of u32 instructions.
//   For N when-keys:
//     MATCH_DIM d0 v0
//     MATCH_DIM d1 v1
//     ... (N of them)
//     AND              (N-1 of them, to reduce the N booleans to one)
//     BEGIN_THEN
//     SET_* ...        (one per field in then)
//     END_RULE
//   For 1 when-key:
//     MATCH_DIM d0 v0
//     BEGIN_THEN
//     SET_*
//     END_RULE
function compileRule(rule) {
  const insts = [];
  const whenKeys = Object.keys(rule.when);

  if (whenKeys.length === 0) {
    // No-condition rule: would always fire. Our spec has no such rule, but
    // we'll reject rather than emit something surprising.
    throw new Error("rule with empty `when` is not supported");
  }

  // Emit the MATCH_DIMs in a deterministic order (by dim index ascending).
  // This is not semantically required -- AND is commutative -- but keeps
  // compiled output stable for diffs.
  const sortedWhen = whenKeys
    .map(k => ({ key: k, dIdx: dimIndex(k), vIdx: valueIndex(dimIndex(k), rule.when[k]) }))
    .sort((x, y) => x.dIdx - y.dIdx);

  for (const w of sortedWhen) {
    insts.push(encode(OP.MATCH_DIM, w.dIdx, w.vIdx));
  }

  // Reduce N booleans to 1 via (N-1) ANDs.
  for (let i = 0; i < sortedWhen.length - 1; i++) {
    insts.push(encode(OP.AND));
  }

  insts.push(encode(OP.BEGIN_THEN));

  // Emit SETs in a deterministic order: sdf, rt, rth, doc, reg, deny.
  // Order among SETs does not affect semantics (they set different fields),
  // but stable order helps diffing compiled output.
  const t = rule.then;
  if (Object.prototype.hasOwnProperty.call(t, "sdf")) {
    // Our encoding: 0 means -1, 1 means +1. Spec values are -1 or 1.
    const a = (t.sdf === 1) ? 1 : 0;
    insts.push(encode(OP.SET_SDF, a));
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

// Compile the full rule set. Returns { instructions: Uint32Array, stats }.
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

// Disassembler -- useful for debugging and for printing the compiled
// instruction stream in human-readable form.
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

module.exports = { OP, encode, decode, compileRule, compileAll, disassemble, sortRules };
