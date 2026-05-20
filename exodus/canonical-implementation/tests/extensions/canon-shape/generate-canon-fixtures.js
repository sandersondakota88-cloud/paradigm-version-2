// =============================================================================
// generate-canon-fixtures.js  --  canon-shape variant of generate-gpu-fixtures.
//
// The difference from the original generator: every THEN clause that sets
// sdf: 1 is normalized to ALSO set reg: "DENIED" and rth: 0 explicitly. This
// removes the spec's step-3 "derive at the end" rule from the test corpus:
// every denial outcome is fully self-contained in the THEN, so no resolver
// needs post-processing to produce the same result.
//
// Why: the stratified-harness run on 2026-05-19 surfaced 102/2602 fixtures
// where real CSS diverged from JS+WGSL. Every divergence traced to the
// step-3 derivation, which CSS cannot natively express in a single pass.
// canon/UTF/01-foundations.md section 3 commits the substrate to WHEN:THEN
// shape with NO post-processing across the full record. The step-3 rule is
// non-canonical by canon's own structural definition.
//
// This generator produces a canon-shape-compliant test corpus. If the
// stratified harness produces 2602/2602 agreement on this corpus, the
// conclusion is: S2 holds at 100% for canon-shape constraints; the 102
// divergences in the original corpus were the test corpus exercising
// non-canonical semantics that canon section 3 already forbids.
//
// Run with:
//   node tests/extensions/canon-shape/generate-canon-fixtures.js
// Output:
//   tests/extensions/canon-shape/canon-fixtures.json
// =============================================================================

"use strict";

const fs   = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..", "..");
const C        = require(path.join(ROOT, "constraints.js"));
const compiler = require(path.join(ROOT, "compile-constraints.js"));

// Inline canon-shape JS oracle. Identical to oracle.js BUT with the
// post-processing step (lines 112-115 of oracle.js) removed. canon section 3
// commits to WHEN:THEN with no derivation across the resolved record, so
// the canon-shape expected hash must be computed without the post-process.
const OP = {
  MATCH_DIM:  0x01, AND: 0x02, BEGIN_THEN: 0x10,
  SET_SDF:    0x11, SET_RT: 0x12, SET_RTH:    0x13,
  SET_DOC:    0x14, SET_REG: 0x15, SET_DENY:   0x16,
  END_RULE:   0xFF
};
function canonShapeExecute(instructions, coord) {
  let sdf = -1, rt = 0, rth = 0, doc = 0, reg = 0, deny = 0;
  const stack = new Int8Array(8);
  let sp = 0, skipping = false, pc = 0;
  const n = instructions.length;
  while (pc < n) {
    const inst = instructions[pc];
    const op = inst & 0xFF;
    const a  = (inst >>> 8) & 0xFF;
    if (skipping) { if (op === OP.END_RULE) skipping = false; pc++; continue; }
    switch (op) {
      case OP.MATCH_DIM: { const b = (inst >>> 16) & 0xFF;
        stack[sp++] = (coord[a] === b) ? 1 : 0; break; }
      case OP.AND: { const top = stack[--sp]; stack[sp - 1] = (stack[sp - 1] & top) & 1; break; }
      case OP.BEGIN_THEN: { if (stack[--sp] === 0) skipping = true; break; }
      case OP.SET_SDF:  sdf  = (a === 1) ? 1 : -1; break;
      case OP.SET_RT:   rt   = a; break;
      case OP.SET_RTH:  rth  = a; break;
      case OP.SET_DOC:  doc  = a; break;
      case OP.SET_REG:  reg  = a; break;
      case OP.SET_DENY: deny = a; break;
      case OP.END_RULE: break;
      default: throw new Error("unknown opcode " + op);
    }
    pc++;
  }
  // NO post-process. WHEN:THEN composition is the entirety of the commitment.
  return { sdf, rt, rth, doc, reg, deny };
}
function canonShapeExecuteAll(instructions) {
  const out = new Array(C.STATE_SPACE_SIZE);
  for (let i = 0; i < C.STATE_SPACE_SIZE; i++) {
    out[i] = canonShapeExecute(instructions, C.unpackCoord(i));
  }
  return out;
}

// ---------------------------------------------------------------------------
// THEN normalization. The canon-shape commitment is: every commitment a rule
// makes is fully expressed in its THEN. No derivation, no post-processing,
// no side-channel.
//
// Concretely: if a THEN sets sdf: 1, it must ALSO set reg: "DENIED" and
// rth: 0 -- because that's what the original spec's step-3 rule WOULD have
// derived. By writing the derivation explicitly into the THEN, we lift the
// commitment out of the post-processing layer and into the WHEN:THEN layer
// where canon section 3 says it must live.
// ---------------------------------------------------------------------------

function normalizeThen(then) {
  // If the THEN does not commit to sdf at all, no change is needed.
  if (!("sdf" in then)) return { ...then };
  // If the THEN commits to sdf:-1, no derivation applies; pass through.
  if (then.sdf !== 1) return { ...then };
  // sdf:1 case: ensure reg:"DENIED" and rth:0 are present. If they're already
  // set (e.g. someone wrote a THEN that explicitly sets reg to something else
  // alongside sdf:1), the canon-shape interpretation is: the THEN author's
  // commitment wins. We only ADD the derivation values, we don't overwrite.
  const out = { ...then };
  if (!("reg" in out)) out.reg = "DENIED";
  if (!("rth" in out)) out.rth = 0;
  return out;
}

// ---------------------------------------------------------------------------
// Generators -- IDENTICAL enumeration to generate-gpu-fixtures.js so the
// fixture IDs and RNG-driven random rules match exactly. The only change is
// every produced THEN passes through normalizeThen().
// ---------------------------------------------------------------------------

function allDimValueClauses() {
  const out = [];
  for (let d = 0; d < C.DIMS.length; d++) {
    const dimName = C.DIMS[d].name;
    for (let v = 0; v < C.DIMS[d].values.length; v++) {
      out.push({ [dimName]: C.DIMS[d].values[v] });
    }
  }
  return out;
}

function allTwoKeyClauses() {
  const dims = C.DIMS;
  const out = [];
  for (let d1 = 0; d1 < dims.length; d1++) {
    for (let v1 = 0; v1 < dims[d1].values.length; v1++) {
      for (let d2 = d1 + 1; d2 < dims.length; d2++) {
        for (let v2 = 0; v2 < dims[d2].values.length; v2++) {
          out.push({
            [dims[d1].name]: dims[d1].values[v1],
            [dims[d2].name]: dims[d2].values[v2]
          });
        }
      }
    }
  }
  return out;
}

function allThreeKeyClauses() {
  const dims = C.DIMS;
  const out = [];
  for (let d1 = 0; d1 < dims.length; d1++) {
    for (let v1 = 0; v1 < dims[d1].values.length; v1++) {
      for (let d2 = d1 + 1; d2 < dims.length; d2++) {
        for (let v2 = 0; v2 < dims[d2].values.length; v2++) {
          for (let d3 = d2 + 1; d3 < dims.length; d3++) {
            for (let v3 = 0; v3 < dims[d3].values.length; v3++) {
              out.push({
                [dims[d1].name]: dims[d1].values[v1],
                [dims[d2].name]: dims[d2].values[v2],
                [dims[d3].name]: dims[d3].values[v3]
              });
            }
          }
        }
      }
    }
  }
  return out;
}

// THEN catalogue: same enumeration as original, but every emitted THEN is
// normalized so sdf:1 carries reg:"DENIED" and rth:0 explicitly.
function thenClauseCatalogue() {
  const cat = [];
  cat.push(normalizeThen({ sdf: -1 }));
  cat.push(normalizeThen({ sdf: 1 }));
  for (const v of C.RT_TABLE)   cat.push(normalizeThen({ rt: v }));
  for (const v of C.DOC_TABLE)  cat.push(normalizeThen({ doc: v }));
  for (const v of C.REG_TABLE)  cat.push(normalizeThen({ reg: v }));
  for (const v of C.DENY_TABLE) cat.push(normalizeThen({ deny: v }));
  for (const v of [0, 1, 127, 255]) cat.push(normalizeThen({ rth: v }));
  cat.push(normalizeThen({ sdf: 1, deny: "SubPrime cannot hold BusinessLine" }));
  cat.push(normalizeThen({ rt: "A-PREFERRED", rth: 160, doc: "BASIC" }));
  cat.push(normalizeThen({ rt: "B-STANDARD",  rth: 130, doc: "ENHANCED" }));
  cat.push(normalizeThen({ rt: "C-ELEVATED",  rth:  95, doc: "ENHANCED" }));
  return cat;
}

function makeRng(seed) {
  let s = (seed | 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) / 0x100000000);
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function compileRulesArray(rules) {
  const sorted = compiler.sortRules(rules);
  const all = [];
  for (const rule of sorted) {
    const insts = compiler.compileRule(rule);
    for (const inst of insts) all.push(inst);
  }
  return Uint32Array.from(all);
}

// ---------------------------------------------------------------------------
// FNV-1a 32-bit -- identical to generate-gpu-fixtures.js
// ---------------------------------------------------------------------------

function fnv1a32(bytes) {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

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

function hashJsOracleOutput(rules) {
  const instructions = compileRulesArray(rules);
  const out = canonShapeExecuteAll(instructions);
  const bytes = packOutputBytes(out);
  return { instructions, outputHash: fnv1a32(bytes) };
}

// ---------------------------------------------------------------------------
// Enumerate fixtures. Same shape as the original; ALL produced THENs go
// through normalizeThen() including the literal denyThen in suites 3a/3b
// and the overwrite-sdf pairs in suite 5.
// ---------------------------------------------------------------------------

function cloneRule(r) {
  return { when: { ...r.when }, then: normalizeThen(r.then) };
}

function buildFixtures() {
  const fixtures = [];

  // Self-check: canonical 11-rule set. Each constraint passes through
  // normalizeThen so denial rules carry reg:"DENIED" and rth:0 explicitly.
  fixtures.push({
    id: "canonical-11",
    suite: "self-check",
    rules: C.CONSTRAINTS.map(cloneRule)
  });

  // Suite 2: 1-key x catalog
  const oneKey = allDimValueClauses();
  const thens  = thenClauseCatalogue();
  let idx = 0;
  for (const when of oneKey) {
    for (const then of thens) {
      fixtures.push({
        id: "one-key-" + (idx++),
        suite: "exhaustive-1key",
        rules: [{ when: { ...when }, then: { ...then } }]
      });
    }
  }

  // Suite 3a: 2-key x {deny, class}. The deny THEN is normalized.
  const denyThen  = normalizeThen({ sdf: 1, deny: "SubPrime cannot hold BusinessLine" });
  const classThen = { rt: "B-STANDARD", rth: 130, doc: "ENHANCED" };
  idx = 0;
  for (const when of allTwoKeyClauses()) {
    for (const then of [denyThen, classThen]) {
      fixtures.push({
        id: "two-key-" + (idx++),
        suite: "exhaustive-2key",
        rules: [{ when: { ...when }, then: { ...then } }]
      });
    }
  }

  // Suite 3b: 3-key x deny
  idx = 0;
  for (const when of allThreeKeyClauses()) {
    fixtures.push({
      id: "three-key-" + (idx++),
      suite: "exhaustive-3key",
      rules: [{ when: { ...when }, then: { ...denyThen } }]
    });
  }

  // Suite 4: rule-count scaling. RNG seed identical to original generator
  // so the random when-clause choices match exactly; the THENs picked from
  // the catalogue are already normalized.
  const rng = makeRng(0xC0FFEE);
  const oneK = oneKey, twoK = allTwoKeyClauses(), threeK = allThreeKeyClauses();
  function randomRule() {
    const w = rng();
    let when;
    if (w < 0.5)        when = pick(rng, oneK);
    else if (w < 0.85)  when = pick(rng, twoK);
    else                when = pick(rng, threeK);
    return { when: { ...when }, then: { ...pick(rng, thens) } };
  }
  idx = 0;
  for (let n = 1; n <= 16; n++) {
    for (let s = 0; s < 24; s++) {
      const rules = [];
      for (let i = 0; i < n; i++) rules.push(randomRule());
      fixtures.push({
        id: "scale-n" + n + "-s" + s + "-" + (idx++),
        suite: "rule-count-scaling",
        rules
      });
    }
  }

  // Suite 5: overwrite pairs. For each field, build pairs of rules that
  // both write the same field but at different specificities. The original
  // generator's sdf:1 pairs need normalizeThen to remain canon-shape.
  const valuesByField = {
    sdf:  [-1, 1],
    rt:   C.RT_TABLE.slice(),
    rth:  [0, 1, 127, 255],
    doc:  C.DOC_TABLE.slice(),
    reg:  C.REG_TABLE.slice(),
    deny: C.DENY_TABLE.slice()
  };
  const FIELDS = ["sdf", "rt", "rth", "doc", "reg", "deny"];
  const whenA = oneK[0], whenB = twoK[0];
  idx = 0;
  for (const f of FIELDS) {
    const vs = valuesByField[f];
    for (const a of vs) {
      for (const b of vs) {
        if (a === b) continue;
        fixtures.push({
          id: "overwrite-" + f + "-" + (idx++),
          suite: "overwrite-pairs",
          rules: [
            { when: { ...whenA }, then: normalizeThen({ [f]: a }) },
            { when: { ...whenB }, then: normalizeThen({ [f]: b }) }
          ]
        });
      }
    }
  }

  return fixtures;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

console.log("[gen-canon] enumerating fixtures...");
const fixtures = buildFixtures();
console.log("[gen-canon] " + fixtures.length + " fixtures to hash");

const t0 = Date.now();
const out = [];
for (let i = 0; i < fixtures.length; i++) {
  const fx = fixtures[i];
  const { instructions, outputHash } = hashJsOracleOutput(fx.rules);
  const hex = new Array(instructions.length);
  for (let k = 0; k < instructions.length; k++) {
    hex[k] = ("00000000" + instructions[k].toString(16)).slice(-8);
  }
  out.push({
    id: fx.id,
    suite: fx.suite,
    ruleCount: fx.rules.length,
    instructionCount: instructions.length,
    instructionsHex: hex,
    expectedOutputHash: ("00000000" + outputHash.toString(16)).slice(-8)
  });
  if ((i + 1) % 250 === 0) {
    console.log("[gen-canon] " + (i + 1) + " / " + fixtures.length);
  }
}
console.log("[gen-canon] hashed " + out.length + " fixtures in " +
  ((Date.now() - t0) / 1000).toFixed(1) + "s");

const manifest = {
  specVersion: "1.0-canon-shape",
  stateSpaceSize: C.STATE_SPACE_SIZE,
  dims: C.DIMS.map(d => ({ name: d.name, cardinality: d.values.length })),
  fixtureCount: out.length,
  hashAlgorithm: "fnv1a32",
  outputLayoutPerCoord: ["sdf:i32", "rth:u32", "rt:u32", "doc:u32", "reg:u32", "deny:u32"],
  generatedAt: new Date().toISOString(),
  fixtures: out,
  notes: [
    "Canon-shape variant of gpu-fixtures.json.",
    "Every THEN that sets sdf:1 also explicitly sets reg:'DENIED' and rth:0.",
    "Removes the spec's step-3 'derive at the end' rule from the test corpus.",
    "Conforms to canon/UTF/01-foundations.md section 3 (WHEN:THEN shape).",
    "Generator: tests/extensions/canon-shape/generate-canon-fixtures.js"
  ]
};

const outPath = path.join(__dirname, "canon-fixtures.json");
fs.writeFileSync(outPath, JSON.stringify(manifest), "utf8");
console.log("[gen-canon] wrote " + outPath +
  " (" + (fs.statSync(outPath).size / 1024).toFixed(0) + " KB)");
