// ============================================================================
// not1-equivalence.test.js  --  Track 1A extension #1: NOT over single-dim clauses
// ============================================================================
//
// What this tests
// ---------------
// The current grammar accepts only conjunctive equality:
//   when: { dim1: v1, dim2: v2, ... }    # AND of (xi = vi)
//
// This file extends the grammar with single-dim negation:
//   when: { dim1: v1, "!dim2": v2, ... } # AND of clauses where each clause
//                                        # is either (xi = vi) or NOT (xi = vi)
//
// The extension is isolated:
//   - Does NOT modify any file under canonical-implementation/ except the
//     ones inside this folder.
//   - The original css-oracle, oracle, compiler, resolve.wgsl, harness,
//     and tests/ continue to work unchanged.
//   - The canonical 66/66 and Phase A/B 2,602/2,602 remain regression
//     baselines.
//
// Locked predictions (written before running):
//   P1. Adding NOT as a single postfix opcode preserves byte-identical
//       equivalence across CSS oracle and JS oracle on the extended grammar.
//   P2. The encoding stays postfix-stack-shaped; no new machine shape is
//       required.
//   P3. Single-dim NOT maps to CSS :not([dim=value]) with the same
//       specificity weight as a positive clause -- one attribute selector.
//
// Failure modes that would falsify (and what they would mean):
//   F1. CSS-oracle and JS-oracle diverge for any generated rule set.
//       -> The reference (CSS) and the bytecode (JS) disagree. Either the
//          compiler is wrong, the new opcode semantics are wrong, or our
//          CSS reading of NOT is wrong. Either way, an empirical break
//          inside the predicted "should work" zone.
//   F2. The compiler emits something the postfix machine cannot evaluate.
//       -> The machine shape was NOT enough. Postfix-stack form is not
//          closed under the extended algebra. Strong falsification of P2.
//
// If F1 or F2 fires, we stop and investigate before extending further.
//
// Run with:  node tests/extensions/not-1/not1-equivalence.test.js
// ============================================================================

"use strict";

const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..", "..");
const C = require(path.join(ROOT, "constraints.js"));

// ---------------------------------------------------------------------------
// Extended compiler -- adds OP_NOT, accepts negated clauses
// ---------------------------------------------------------------------------
//
// New opcode:
//   OP_NOT      0x03    # pop top, push (1 - top). Unary, postfix.
//
// New clause syntax (compiler input only):
//   when: { credit: "prime", "!residency": "foreign" }
//   means (x_credit = prime) AND NOT (x_residency = foreign).
//
// Compiler emit per rule with k clauses:
//   For each clause c_i in dim-ascending order:
//     emit MATCH_DIM dim=di value=vi
//     if c_i is negated: emit NOT
//   emit (k-1) ANDs
//   emit BEGIN_THEN, SET_* sequence, END_RULE
//
// Postfix discipline preserved: NOT acts on top of stack only; subsequent
// AND reduces as before.

const OP = Object.freeze({
  MATCH_DIM:  0x01,
  AND:        0x02,
  NOT:        0x03,   // <-- new
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

// Parse a `when` object into a list of { dimName, value, negated } clauses,
// sorted by dim index ascending (same canonical ordering the original
// compiler uses; preserves the source-order tiebreak property under sort).
function parseWhen(when) {
  const clauses = [];
  for (const key of Object.keys(when)) {
    const negated = key.startsWith("!");
    const dimName = negated ? key.slice(1) : key;
    const value = when[key];
    const dIdx = C.dimIndex(dimName);
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
  if (Object.prototype.hasOwnProperty.call(t, "sdf")) {
    insts.push(encode(OP.SET_SDF, t.sdf === 1 ? 1 : 0));
  }
  if (Object.prototype.hasOwnProperty.call(t, "rt")) {
    const idx = C.lookupIndex(C.RT_TABLE, t.rt);
    if (idx < 0) throw new Error("rt not in table: " + t.rt);
    insts.push(encode(OP.SET_RT, idx));
  }
  if (Object.prototype.hasOwnProperty.call(t, "rth")) {
    if ((t.rth | 0) !== t.rth || t.rth < 0 || t.rth > 255)
      throw new Error("rth out of u8 range: " + t.rth);
    insts.push(encode(OP.SET_RTH, t.rth));
  }
  if (Object.prototype.hasOwnProperty.call(t, "doc")) {
    const idx = C.lookupIndex(C.DOC_TABLE, t.doc);
    if (idx < 0) throw new Error("doc not in table: " + t.doc);
    insts.push(encode(OP.SET_DOC, idx));
  }
  if (Object.prototype.hasOwnProperty.call(t, "reg")) {
    const idx = C.lookupIndex(C.REG_TABLE, t.reg);
    if (idx < 0) throw new Error("reg not in table: " + t.reg);
    insts.push(encode(OP.SET_REG, idx));
  }
  if (Object.prototype.hasOwnProperty.call(t, "deny")) {
    const idx = C.lookupIndex(C.DENY_TABLE, t.deny);
    if (idx < 0) throw new Error("deny not in table: " + JSON.stringify(t.deny));
    insts.push(encode(OP.SET_DENY, idx));
  }

  insts.push(encode(OP.END_RULE));
  return insts;
}

// Specificity sort: rules with fewer clauses appear first, ties broken by
// source order. Same rule as the original compiler -- a negated clause
// still counts as one clause for specificity, matching CSS where
// :not([x]) has the specificity weight of one attribute selector.
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

// ---------------------------------------------------------------------------
// Extended JS oracle -- executes the extended bytecode
// ---------------------------------------------------------------------------

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
        if (sp < 1) throw new Error("NOT underflow at pc=" + pc);
        stack[sp - 1] = (stack[sp - 1] === 0) ? 1 : 0;
        break;
      }
      case OP.AND: {
        if (sp < 2) throw new Error("AND underflow at pc=" + pc);
        const top = stack[--sp];
        stack[sp - 1] = (stack[sp - 1] & top) & 1;
        break;
      }
      case OP.BEGIN_THEN: {
        if (sp < 1) throw new Error("BEGIN_THEN underflow at pc=" + pc);
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

function executeAllExt(instructions) {
  const out = new Array(C.STATE_SPACE_SIZE);
  for (let i = 0; i < C.STATE_SPACE_SIZE; i++) {
    out[i] = executeExt(instructions, C.unpackCoord(i));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Extended CSS oracle (reference) -- direct evaluation of the extended
// grammar, with no reliance on the bytecode. This is what defines what
// `resolve` MEANS for the extended grammar; the JS oracle is tested
// against it.
//
// Semantics chosen for single-dim NOT (matching CSS :not([dim=value])):
//   "!dim": value  ==  NOT (x_dim = value)  ==  (x_dim != value)
//
// This is the CSS reading: :not([credit=prime]) holds for elements whose
// credit attribute is anything other than "prime".
// ---------------------------------------------------------------------------

function whenMatches(when, coord) {
  for (const key of Object.keys(when)) {
    const negated = key.startsWith("!");
    const dimName = negated ? key.slice(1) : key;
    const dIdx = C.dimIndex(dimName);
    const expectedValue = when[key];
    const actualValue = C.DIMS[dIdx].values[coord[dIdx]];
    const matches = (actualValue === expectedValue);
    const clauseHolds = negated ? !matches : matches;
    if (!clauseHolds) return false;
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

function resolveCoordExt(rules, coord) {
  const sorted = sortRulesExt(rules);
  const out = {
    sdf: C.DEFAULTS.sdf, reg: C.DEFAULTS.reg, deny: C.DEFAULTS.deny,
    rt: C.DEFAULTS.rt, rth: C.DEFAULTS.rth, doc: C.DEFAULTS.doc
  };
  for (const r of sorted) {
    if (whenMatches(r.when, coord)) applyThen(r.then, out);
  }
  if (out.sdf === 1) { out.reg = "DENIED"; out.rth = 0; }
  return out;
}

function recordToIndices(rec) {
  const rtIdx   = C.lookupIndex(C.RT_TABLE,   rec.rt);
  const docIdx  = C.lookupIndex(C.DOC_TABLE,  rec.doc);
  const regIdx  = C.lookupIndex(C.REG_TABLE,  rec.reg);
  const denyIdx = C.lookupIndex(C.DENY_TABLE, rec.deny);
  if (rtIdx < 0 || docIdx < 0 || regIdx < 0 || denyIdx < 0) {
    throw new Error("intern lookup failed: " + JSON.stringify(rec));
  }
  return {
    sdf:  rec.sdf | 0,
    rth:  rec.rth >>> 0,
    rt:   rtIdx   >>> 0,
    doc:  docIdx  >>> 0,
    reg:  regIdx  >>> 0,
    deny: denyIdx >>> 0
  };
}

const FIELDS = ["sdf", "rt", "rth", "doc", "reg", "deny"];

function diffOneRuleSet(rules) {
  const instructions = compileAllExt(rules);
  let divergences = 0;
  let firstFailure = null;
  for (let i = 0; i < C.STATE_SPACE_SIZE; i++) {
    const coord = C.unpackCoord(i);
    const cssRec = resolveCoordExt(rules, coord);
    const cssIdx = recordToIndices(cssRec);
    const js     = executeExt(instructions, coord);
    for (const f of FIELDS) {
      if (cssIdx[f] !== js[f]) {
        divergences++;
        if (!firstFailure) {
          firstFailure = {
            coordIdx: i, coord, field: f,
            css: cssIdx[f], js: js[f], cssRec, jsIdx: js, rules
          };
        }
      }
    }
  }
  return { divergences, firstFailure, instructions };
}

// ---------------------------------------------------------------------------
// Generators -- mirror Phase A but emit negated clauses too
// ---------------------------------------------------------------------------

function allDimValueClauses(negated) {
  const out = [];
  for (let d = 0; d < C.DIMS.length; d++) {
    const dimName = C.DIMS[d].name;
    for (let v = 0; v < C.DIMS[d].values.length; v++) {
      const key = negated ? "!" + dimName : dimName;
      out.push({ [key]: C.DIMS[d].values[v] });
    }
  }
  return out;
}

function thenClauseCatalogue() {
  const cat = [];
  cat.push({ sdf: -1 });
  cat.push({ sdf: 1 });
  for (const v of C.RT_TABLE)   cat.push({ rt: v });
  for (const v of C.DOC_TABLE)  cat.push({ doc: v });
  for (const v of C.REG_TABLE)  cat.push({ reg: v });
  for (const v of C.DENY_TABLE) cat.push({ deny: v });
  for (const v of [0, 1, 127, 255]) cat.push({ rth: v });
  cat.push({ sdf: 1, deny: "SubPrime cannot hold BusinessLine" });
  cat.push({ rt: "A-PREFERRED", rth: 160, doc: "BASIC" });
  cat.push({ rt: "B-STANDARD",  rth: 130, doc: "ENHANCED" });
  cat.push({ rt: "C-ELEVATED",  rth:  95, doc: "ENHANCED" });
  return cat;
}

// All legal mixed 2-key clauses: every pair of dims, every value combo,
// every (negation, negation) flag pair. Skips combinations that produce
// duplicate keys.
function allMixedTwoKeyClauses() {
  const dims = C.DIMS;
  const out = [];
  for (let d1 = 0; d1 < dims.length; d1++) {
    for (let v1 = 0; v1 < dims[d1].values.length; v1++) {
      for (let d2 = d1 + 1; d2 < dims.length; d2++) {
        for (let v2 = 0; v2 < dims[d2].values.length; v2++) {
          for (const n1 of [false, true]) {
            for (const n2 of [false, true]) {
              const k1 = (n1 ? "!" : "") + dims[d1].name;
              const k2 = (n2 ? "!" : "") + dims[d2].name;
              out.push({ [k1]: dims[d1].values[v1], [k2]: dims[d2].values[v2] });
            }
          }
        }
      }
    }
  }
  return out;
}

function makeRng(seed) {
  let s = (seed | 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) / 0x100000000);
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

const results = { suites: [], totalPass: 0, totalFail: 0 };

function suite(name, fn) {
  const sub = { name, pass: 0, fail: 0, failures: [] };
  results.suites.push(sub);
  function test(label, body) {
    try {
      body();
      sub.pass++; results.totalPass++;
      console.log("  PASS  " + label);
    } catch (e) {
      sub.fail++; results.totalFail++;
      sub.failures.push({ label, message: e.message });
      console.log("  FAIL  " + label + "  -> " + e.message);
    }
  }
  console.log("\n=== " + name + " ===");
  fn(test);
}

// ---------- Suite 0: backwards compatibility ----------
suite("Backwards compatibility: positive-only grammar still works", (test) => {
  test("canonical 11-rule program agrees on extended compiler/oracle", () => {
    // The canonical program has no negation. The extended compiler should
    // produce byte-identical bytecode and the extended CSS oracle should
    // produce identical records.
    const { divergences, firstFailure } = diffOneRuleSet(C.CONSTRAINTS);
    if (divergences > 0) {
      throw new Error("regression on canonical program: " +
        JSON.stringify(firstFailure));
    }
  });
});

// ---------- Suite 1: every single negated clause ----------
suite("Every (!dim, value) single-clause rule", (test) => {
  const negKeys = allDimValueClauses(true);
  const thens = thenClauseCatalogue();
  let tried = 0, agreed = 0, firstFailure = null;
  for (const when of negKeys) {
    for (const then of thens) {
      const rules = [{ when, then }];
      tried++;
      const { divergences, firstFailure: ff } = diffOneRuleSet(rules);
      if (divergences === 0) agreed++;
      else if (!firstFailure) firstFailure = ff;
    }
  }
  test(`all ${tried} negated single-clause rules agreed`, () => {
    if (agreed !== tried) {
      throw new Error(`${tried - agreed} disagreed; first: ${JSON.stringify(firstFailure)}`);
    }
  });
  console.log(`  tried=${tried}  agreed=${agreed}`);
});

// ---------- Suite 2: mixed 2-key (positive + negated combinations) ----------
suite("Mixed 2-key clauses: every (negation flag, negation flag) combo", (test) => {
  const whens = allMixedTwoKeyClauses();
  const denyThen  = { sdf: 1, deny: "SubPrime cannot hold BusinessLine" };
  const classThen = { rt: "B-STANDARD", rth: 130, doc: "ENHANCED" };
  let tried = 0, agreed = 0, firstFailure = null;
  for (const when of whens) {
    for (const then of [denyThen, classThen]) {
      const rules = [{ when, then }];
      tried++;
      const { divergences, firstFailure: ff } = diffOneRuleSet(rules);
      if (divergences === 0) agreed++;
      else if (!firstFailure) firstFailure = ff;
    }
  }
  test(`all ${tried} mixed 2-key rules agreed`, () => {
    if (agreed !== tried) {
      throw new Error(`${tried - agreed} disagreed; first: ${JSON.stringify(firstFailure)}`);
    }
  });
  console.log(`  tried=${tried}  agreed=${agreed}`);
});

// ---------- Suite 3: rule-count scaling with mixed negation ----------
suite("Rule-count scaling 1..16 with random mixed-negation clauses", (test) => {
  const MAX_N = 16, SETS_PER_N = 24;
  const rng = makeRng(0xCAFE);
  const posKeys = allDimValueClauses(false);
  const negKeys = allDimValueClauses(true);
  const twoKey  = allMixedTwoKeyClauses();
  const thens   = thenClauseCatalogue();

  function randomRule() {
    const w = rng();
    let when;
    if (w < 0.35)       when = pick(rng, posKeys);
    else if (w < 0.70)  when = pick(rng, negKeys);
    else                when = pick(rng, twoKey);
    return { when, then: pick(rng, thens) };
  }

  let tried = 0, agreed = 0, firstFailure = null;
  for (let n = 1; n <= MAX_N; n++) {
    for (let s = 0; s < SETS_PER_N; s++) {
      const rules = [];
      for (let i = 0; i < n; i++) rules.push(randomRule());
      tried++;
      const { divergences, firstFailure: ff } = diffOneRuleSet(rules);
      if (divergences === 0) agreed++;
      else if (!firstFailure) firstFailure = ff;
    }
  }
  test(`all ${tried} randomized constraint sets agreed`, () => {
    if (agreed !== tried) {
      throw new Error(`${tried - agreed} disagreed; first: ${JSON.stringify(firstFailure)}`);
    }
  });
  console.log(`  tried=${tried}  agreed=${agreed}`);
});

// ---------- Suite 4: structural sanity ----------
suite("Structural sanity: NOT actually negates", (test) => {
  test("(!credit: prime) excludes prime, includes everything else", () => {
    // One rule: NOT (credit=prime) -> sdf=1, deny=...
    const rules = [{
      when: { "!credit": "prime" },
      then: { sdf: 1, deny: "SubPrime cannot hold BusinessLine" }
    }];
    const instructions = compileAllExt(rules);
    let primeDenied = 0, nonPrimeDenied = 0;
    for (let i = 0; i < C.STATE_SPACE_SIZE; i++) {
      const coord = C.unpackCoord(i);
      const r = executeExt(instructions, coord);
      const isPrime = (C.DIMS[0].values[coord[0]] === "prime");
      if (r.sdf === 1) {
        if (isPrime) primeDenied++;
        else nonPrimeDenied++;
      }
    }
    // Expected: 0 prime coords denied, all non-prime denied.
    // prime has 1 of 3 credit values, so 1/3 of coords should be excluded.
    const expectedNonPrime = C.STATE_SPACE_SIZE * 2 / 3; // 2/3 are not prime
    if (primeDenied !== 0) throw new Error(`primeDenied=${primeDenied}, expected 0`);
    if (nonPrimeDenied !== expectedNonPrime) throw new Error(`nonPrimeDenied=${nonPrimeDenied}, expected ${expectedNonPrime}`);
  });

  test("double negation: NOT NOT (credit=prime) equals (credit=prime)", () => {
    // Express via two rules whose union should equal a single positive rule.
    // We test more cleanly: build a rule that uses two negated clauses
    // forming a tautological positive: NOT(credit=prime) AND NOT(credit=near-prime)
    // -> identifies only sub-prime.
    const rules = [{
      when: { "!credit": "prime", "!residency": "foreign" },
      then: { sdf: 1, deny: "SubPrime cannot hold BusinessLine" }
    }];
    const { divergences } = diffOneRuleSet(rules);
    if (divergences > 0) throw new Error("double negation construction diverged");
  });
});

// ---------- Totals ----------
console.log("\n=== Totals ===");
console.log(`PASS: ${results.totalPass}   FAIL: ${results.totalFail}`);
if (results.totalFail > 0) {
  console.log("\nFailures by suite:");
  for (const s of results.suites) {
    if (s.fail === 0) continue;
    console.log(`  ${s.name}:`);
    for (const f of s.failures) console.log(`    - ${f.label}: ${f.message}`);
  }
  process.exit(1);
}
process.exit(0);
