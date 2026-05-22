// =============================================================================
// generate-crypto-fixtures.js  --  Build the test corpus for the crypto-
// stratified harness. Same fixture-enumeration shape as canon-shape, but
// every rule's THEN sets the `rt` slot via OP_SET_HASH_RT (0x20) -- the
// resolved value is the first 4 bytes of SHA-256 over the rule's predicate
// bytecode, packed as a big-endian u32.
//
// What this stresses: bit-precise SHA-256 across CSS (precomputed at compile
// time, emitted as a u32 in the cascade rule), JS (computed at runtime per
// coordinate in the postfix interpreter), and WGSL (computed in the compute
// shader per coordinate). If all three produce byte-identical output, the
// architecture's S2 commitment holds against cryptographic-class operations.
//
// Run with:
//   node tests/crypto-demo/generate-crypto-fixtures.js
// Output:
//   tests/crypto-demo/crypto-fixtures.json
// =============================================================================

"use strict";

const fs   = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");
const C    = require(path.join(ROOT, "constraints.js"));
const sha  = require(path.join(__dirname, "sha256-shared.js"));

// ----------------------------------------------------------------------------
// Opcode set (canon opcodes + new SET_HASH_RT at 0x20)
// ----------------------------------------------------------------------------

const OP = {
  MATCH_DIM:    0x01,
  AND:          0x02,
  BEGIN_THEN:   0x10,
  SET_SDF:      0x11,
  SET_RT:       0x12,
  SET_RTH:      0x13,
  SET_DOC:      0x14,
  SET_REG:      0x15,
  SET_DENY:     0x16,
  SET_HASH_RT:  0x20,   // NEW: hash predicate bytecode, first 4 bytes -> rt
  END_RULE:     0xFF
};

function encode(op, a, b) {
  if (a === undefined) a = 0;
  if (b === undefined) b = 0;
  return ((op & 0xFF) | ((a & 0xFF) << 8) | ((b & 0xFF) << 16)) >>> 0;
}

function dimIndex(name) {
  for (let i = 0; i < C.DIMS.length; i++) if (C.DIMS[i].name === name) return i;
  throw new Error("unknown dim: " + name);
}
function valueIndex(dIdx, v) {
  const vs = C.DIMS[dIdx].values;
  for (let i = 0; i < vs.length; i++) if (vs[i] === v) return i;
  throw new Error("unknown value '" + v + "' in dim " + C.DIMS[dIdx].name);
}

// ----------------------------------------------------------------------------
// Rule compilation. THEN is always { hashRt: true } in this corpus, but the
// compiler also accepts a passthrough for `sdf`, `reg`, `rth`, `doc`, `deny`
// in case future fixtures want to combine.
// ----------------------------------------------------------------------------

function compileRule(rule) {
  const insts = [];
  const whenKeys = Object.keys(rule.when);
  if (whenKeys.length === 0) throw new Error("rule with empty when");

  // Predicate instructions in deterministic order (dim index ascending)
  const sortedWhen = whenKeys
    .map(k => ({ key: k, dIdx: dimIndex(k), vIdx: valueIndex(dimIndex(k), rule.when[k]) }))
    .sort((x, y) => x.dIdx - y.dIdx);

  // MATCH_DIMs (this is the predicate prefix that gets hashed for SET_HASH_RT)
  for (const w of sortedWhen) insts.push(encode(OP.MATCH_DIM, w.dIdx, w.vIdx));
  // AND-reductions
  for (let i = 0; i < sortedWhen.length - 1; i++) insts.push(encode(OP.AND));

  // PREDICATE BYTECODE PREFIX ends here (before BEGIN_THEN).
  // The hash is over MATCH_DIMs + ANDs, as packed u32s read as LE byte sequences.
  const predicateInsts = insts.slice();

  insts.push(encode(OP.BEGIN_THEN));

  // THEN. For the crypto-demo corpus, the canonical THEN sets rt via hash.
  // Other fields can be set normally; they'll be carried by the cascade as before.
  const t = rule.then;
  if ("sdf" in t)  insts.push(encode(OP.SET_SDF, t.sdf === 1 ? 1 : 0));
  if ("rth" in t)  insts.push(encode(OP.SET_RTH, t.rth));
  if ("doc" in t)  insts.push(encode(OP.SET_DOC, t.doc));
  if ("reg" in t)  insts.push(encode(OP.SET_REG, t.reg));
  if ("deny" in t) insts.push(encode(OP.SET_DENY, t.deny));
  if (t.hashRt === true) insts.push(encode(OP.SET_HASH_RT));

  insts.push(encode(OP.END_RULE));

  // Compute the hash that SET_HASH_RT will produce. Input = predicateInsts
  // packed as LE byte sequence (same as Uint32Array byte layout).
  const predBytes = u32arrToLeBytes(predicateInsts);
  const hashRt = sha.sha256First4AsU32(predBytes);

  return { instructions: insts, hashRt: hashRt, predicateBytes: predBytes };
}

function u32arrToLeBytes(arr) {
  const out = new Uint8Array(arr.length * 4);
  for (let i = 0; i < arr.length; i++) {
    out[i * 4 + 0] = arr[i] & 0xFF;
    out[i * 4 + 1] = (arr[i] >>> 8) & 0xFF;
    out[i * 4 + 2] = (arr[i] >>> 16) & 0xFF;
    out[i * 4 + 3] = (arr[i] >>> 24) & 0xFF;
  }
  return out;
}

// Sort rules by |when| ascending. Same as canon-shape and the original generator.
function sortRules(rules) {
  const indexed = rules.map((r, i) => ({
    rule: r, origIdx: i, whenCount: Object.keys(r.when).length
  }));
  indexed.sort((x, y) => {
    const d = x.whenCount - y.whenCount;
    return d !== 0 ? d : x.origIdx - y.origIdx;
  });
  return indexed.map(e => e.rule);
}

function compileRulesArray(rules) {
  const sorted = sortRules(rules);
  const all = [];
  const ruleHashes = []; // hashRt result per rule, in emission order
  for (const r of sorted) {
    const c = compileRule(r);
    for (const inst of c.instructions) all.push(inst);
    ruleHashes.push({ when: r.when, hashRt: c.hashRt });
  }
  return { instructions: Uint32Array.from(all), ruleHashes };
}

// ----------------------------------------------------------------------------
// JS oracle for the crypto corpus. Identical to canon-shape oracle but adds
// SET_HASH_RT support. Tracks rule_start_pc so it can compute the predicate
// bytes per matching rule.
// ----------------------------------------------------------------------------

function cryptoExecute(instructions, coord) {
  let sdf = -1, rt = 0, rth = 0, doc = 0, reg = 0, deny = 0;
  const stack = new Int8Array(8);
  let sp = 0, skipping = false, pc = 0;
  let rule_start_pc = 0;
  const n = instructions.length;
  while (pc < n) {
    const inst = instructions[pc];
    const op = inst & 0xFF;
    const a  = (inst >>> 8) & 0xFF;

    if (skipping) {
      if (op === OP.END_RULE) { skipping = false; rule_start_pc = pc + 1; }
      pc++;
      continue;
    }

    switch (op) {
      case OP.MATCH_DIM: {
        const b = (inst >>> 16) & 0xFF;
        stack[sp++] = (coord[a] === b) ? 1 : 0;
        break;
      }
      case OP.AND: {
        const top = stack[--sp];
        stack[sp - 1] = (stack[sp - 1] & top) & 1;
        break;
      }
      case OP.BEGIN_THEN: {
        if (stack[--sp] === 0) skipping = true;
        break;
      }
      case OP.SET_SDF:  sdf  = (a === 1) ? 1 : -1; break;
      case OP.SET_RT:   rt   = a; break;
      case OP.SET_RTH:  rth  = a; break;
      case OP.SET_DOC:  doc  = a; break;
      case OP.SET_REG:  reg  = a; break;
      case OP.SET_DENY: deny = a; break;
      case OP.SET_HASH_RT: {
        // Hash predicate prefix: rule_start_pc through current pc - 1
        // (exclusive of BEGIN_THEN, which is at pc - (count of SETs)).
        // BUT: we're now AT the SET_HASH_RT instruction, not at BEGIN_THEN.
        // We need to find BEGIN_THEN by walking backward.
        let predEnd = pc - 1;
        while (predEnd >= rule_start_pc && (instructions[predEnd] & 0xFF) !== OP.BEGIN_THEN) {
          predEnd--;
        }
        // predEnd now points at BEGIN_THEN. Predicate is [rule_start_pc .. predEnd).
        const predU32 = [];
        for (let i = rule_start_pc; i < predEnd; i++) predU32.push(instructions[i]);
        const predBytes = u32arrToLeBytes(predU32);
        rt = sha.sha256First4AsU32(predBytes);
        break;
      }
      case OP.END_RULE: rule_start_pc = pc + 1; break;
      default: throw new Error("unknown opcode " + op);
    }
    pc++;
  }
  return { sdf, rt, rth, doc, reg, deny };
}

function cryptoExecuteAll(instructions) {
  const out = new Array(C.STATE_SPACE_SIZE);
  for (let i = 0; i < C.STATE_SPACE_SIZE; i++) {
    out[i] = cryptoExecute(instructions, C.unpackCoord(i));
  }
  return out;
}

// ----------------------------------------------------------------------------
// Hash + pack output. Same byte layout as the canon-shape corpus so all
// existing diff tools work.
// ----------------------------------------------------------------------------

function packOutputBytes(results) {
  const buf = new ArrayBuffer(C.STATE_SPACE_SIZE * 6 * 4);
  const i32 = new Int32Array(buf);
  const u32 = new Uint32Array(buf);
  for (let i = 0; i < C.STATE_SPACE_SIZE; i++) {
    const r = results[i];
    const base = i * 6;
    i32[base + 0] = r.sdf | 0;
    u32[base + 1] = r.rth >>> 0;
    u32[base + 2] = r.rt  >>> 0;
    u32[base + 3] = r.doc >>> 0;
    u32[base + 4] = r.reg >>> 0;
    u32[base + 5] = r.deny >>> 0;
  }
  return new Uint8Array(buf);
}

function fnv1a32(bytes) {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

function hashJsOracleOutput(rules) {
  const { instructions, ruleHashes } = compileRulesArray(rules);
  const out = cryptoExecuteAll(instructions);
  const bytes = packOutputBytes(out);
  return { instructions, outputHash: fnv1a32(bytes), ruleHashes };
}

// ----------------------------------------------------------------------------
// Fixture enumeration. Smaller corpus than canon-shape: this test stresses
// per-rule cryptographic computation, so coverage of when-clause shapes
// matters more than rule-count scaling.
// ----------------------------------------------------------------------------

function allDimValueClauses() {
  const out = [];
  for (let d = 0; d < C.DIMS.length; d++)
    for (let v = 0; v < C.DIMS[d].values.length; v++)
      out.push({ [C.DIMS[d].name]: C.DIMS[d].values[v] });
  return out;
}
function allTwoKeyClauses() {
  const out = [];
  for (let d1 = 0; d1 < C.DIMS.length; d1++)
    for (let v1 = 0; v1 < C.DIMS[d1].values.length; v1++)
      for (let d2 = d1 + 1; d2 < C.DIMS.length; d2++)
        for (let v2 = 0; v2 < C.DIMS[d2].values.length; v2++)
          out.push({
            [C.DIMS[d1].name]: C.DIMS[d1].values[v1],
            [C.DIMS[d2].name]: C.DIMS[d2].values[v2]
          });
  return out;
}
function allThreeKeyClauses() {
  const out = [];
  for (let d1 = 0; d1 < C.DIMS.length; d1++)
    for (let v1 = 0; v1 < C.DIMS[d1].values.length; v1++)
      for (let d2 = d1 + 1; d2 < C.DIMS.length; d2++)
        for (let v2 = 0; v2 < C.DIMS[d2].values.length; v2++)
          for (let d3 = d2 + 1; d3 < C.DIMS.length; d3++)
            for (let v3 = 0; v3 < C.DIMS[d3].values.length; v3++)
              out.push({
                [C.DIMS[d1].name]: C.DIMS[d1].values[v1],
                [C.DIMS[d2].name]: C.DIMS[d2].values[v2],
                [C.DIMS[d3].name]: C.DIMS[d3].values[v3]
              });
  return out;
}

function buildFixtures() {
  const fixtures = [];
  const HASH_THEN = { hashRt: true };

  // Suite 1: one rule per fixture, each WHEN-key once (all 1-key WHEN shapes)
  let idx = 0;
  for (const when of allDimValueClauses()) {
    fixtures.push({
      id: "one-key-" + (idx++),
      suite: "crypto-1key",
      rules: [{ when: { ...when }, then: { ...HASH_THEN } }]
    });
  }

  // Suite 2: one rule per fixture, all 2-key WHEN shapes
  idx = 0;
  for (const when of allTwoKeyClauses()) {
    fixtures.push({
      id: "two-key-" + (idx++),
      suite: "crypto-2key",
      rules: [{ when: { ...when }, then: { ...HASH_THEN } }]
    });
  }

  // Suite 3: one rule per fixture, all 3-key WHEN shapes
  idx = 0;
  for (const when of allThreeKeyClauses()) {
    fixtures.push({
      id: "three-key-" + (idx++),
      suite: "crypto-3key",
      rules: [{ when: { ...when }, then: { ...HASH_THEN } }]
    });
  }

  // Suite 4: rule-count scaling, 4 sets at each n=2..8.
  // RNG-seeded so reruns reproduce.
  let rngState = (0xCAFEBEEF | 0) || 1;
  function rng() {
    rngState = (rngState * 1664525 + 1013904223) | 0;
    return ((rngState >>> 0) / 0x100000000);
  }
  function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }

  const oneK = allDimValueClauses();
  const twoK = allTwoKeyClauses();
  const threeK = allThreeKeyClauses();
  function randomWhen() {
    const w = rng();
    if (w < 0.5)      return pick(oneK);
    else if (w < 0.85) return pick(twoK);
    else               return pick(threeK);
  }
  idx = 0;
  for (let n = 2; n <= 8; n++) {
    for (let s = 0; s < 4; s++) {
      const rules = [];
      for (let i = 0; i < n; i++) {
        rules.push({ when: { ...randomWhen() }, then: { ...HASH_THEN } });
      }
      fixtures.push({
        id: "multi-n" + n + "-s" + s + "-" + (idx++),
        suite: "crypto-multi",
        rules
      });
    }
  }

  return fixtures;
}

// ----------------------------------------------------------------------------
// Run
// ----------------------------------------------------------------------------

console.log("[gen-crypto] enumerating fixtures...");
const fixtures = buildFixtures();
console.log("[gen-crypto] " + fixtures.length + " fixtures to hash");

const t0 = Date.now();
const out = [];
for (let i = 0; i < fixtures.length; i++) {
  const fx = fixtures[i];
  const { instructions, outputHash, ruleHashes } = hashJsOracleOutput(fx.rules);
  const hex = new Array(instructions.length);
  for (let k = 0; k < instructions.length; k++) {
    hex[k] = ("00000000" + instructions[k].toString(16)).slice(-8);
  }
  // Rule hashes per (when-clause -> u32) so CSS path can emit precomputed rt
  const ruleHashTable = ruleHashes.map(r => ({
    when: r.when,
    rt: r.hashRt
  }));
  out.push({
    id: fx.id,
    suite: fx.suite,
    ruleCount: fx.rules.length,
    instructionCount: instructions.length,
    instructionsHex: hex,
    expectedOutputHash: ("00000000" + outputHash.toString(16)).slice(-8),
    ruleHashTable
  });
  if ((i + 1) % 100 === 0) {
    console.log("[gen-crypto] " + (i + 1) + " / " + fixtures.length);
  }
}
console.log("[gen-crypto] hashed " + out.length + " fixtures in " +
  ((Date.now() - t0) / 1000).toFixed(1) + "s");

const manifest = {
  specVersion: "1.0-crypto-stratified",
  stateSpaceSize: C.STATE_SPACE_SIZE,
  dims: C.DIMS.map(d => ({ name: d.name, cardinality: d.values.length })),
  fixtureCount: out.length,
  hashAlgorithm: "fnv1a32",
  outputLayoutPerCoord: ["sdf:i32", "rth:u32", "rt:u32", "doc:u32", "reg:u32", "deny:u32"],
  generatedAt: new Date().toISOString(),
  fixtures: out,
  notes: [
    "Crypto-stratified test corpus. Every rule's THEN sets rt via SHA-256.",
    "OP_SET_HASH_RT (0x20) hashes the rule's predicate bytecode prefix.",
    "First 4 bytes of digest, big-endian u32, become the rt slot value.",
    "Tests bit-precise SHA-256 agreement across CSS (precomputed), JS (runtime), WGSL (runtime).",
    "Generator: tests/crypto-demo/generate-crypto-fixtures.js"
  ]
};

const outPath = path.join(__dirname, "crypto-fixtures.json");
fs.writeFileSync(outPath, JSON.stringify(manifest), "utf8");
console.log("[gen-crypto] wrote " + outPath +
  " (" + (fs.statSync(outPath).size / 1024).toFixed(0) + " KB)");
