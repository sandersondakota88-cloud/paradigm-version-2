// ============================================================================
// generate-gpu-fixtures.js  --  Phase B step 1: build the expected-hash file
// the browser-side GPU harness will check itself against.
// ============================================================================
//
// What this does
// --------------
// Reproduces exactly the constraint sets that equivalence.test.js generated,
// then for each one:
//   1. Compiles to the Uint32Array postfix instruction buffer
//   2. Runs the JS oracle over all 2880 coords
//   3. Computes a stable FNV-1a 32-bit hash of the packed output bytes
// Writes the (id, ruleset, instruction-buffer-hex, expected-output-hash, coord-count)
// tuples to gpu-fixtures.json.
//
// The browser then loads this file, runs the SAME compiled instruction buffer
// through the WGSL compute shader, hashes the GPU output the same way, and
// reports per-set agreement.
//
// Determinism: the generators are seeded identically and the enumeration
// order is fixed, so this script and equivalence.test.js MUST produce the
// same ordered set of rulesets. The "self-check" suite in the browser
// confirms the canonical-11-rule fixture matches before any other check.
//
// Run with:
//   node tests/generate-gpu-fixtures.js
// Output:
//   tests/gpu-fixtures.json
// ============================================================================

"use strict";

const fs   = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const C        = require(path.join(ROOT, "constraints.js"));
const jsOrig   = require(path.join(ROOT, "oracle.js"));
const compiler = require(path.join(ROOT, "compile-constraints.js"));

// ---------------------------------------------------------------------------
// Generators -- LINE-FOR-LINE the same as equivalence.test.js. If you change
// one, change both.
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
// FNV-1a 32-bit -- byte-oriented stable hash. Same algorithm in the browser.
// ---------------------------------------------------------------------------

function fnv1a32(bytes) {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    // h *= 16777619 mod 2^32
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

// Pack one ruleset's JS-oracle output into a deterministic byte sequence.
// The layout is fixed and must match the browser side exactly: for each of
// 2880 coords, write 6 little-endian u32s in (sdf, rth, rt, doc, reg, deny)
// order -- sdf is reinterpreted from its i32 representation, matching the
// WGSL Output struct field order.
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
  const out = jsOrig.executeAll(instructions);
  const bytes = packOutputBytes(out);
  return {
    instructions,
    outputHash: fnv1a32(bytes)
  };
}

// ---------------------------------------------------------------------------
// Enumerate all fixtures (must match equivalence.test.js suite order)
// ---------------------------------------------------------------------------

function buildFixtures() {
  const fixtures = [];

  // Self-check: canonical 11-rule set FIRST. The browser uses this as a
  // smoke test before running anything else. If this disagrees the GPU
  // path is broken and there is no point continuing.
  fixtures.push({
    id: "canonical-11",
    suite: "self-check",
    rules: C.CONSTRAINTS.map(cloneRule)
  });

  // Suite 2: every (dim, value) x every then in the catalogue, alone.
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

  // Suite 3 part a: 2-key clauses x {deny then, classification then}
  const denyThen  = { sdf: 1, deny: "SubPrime cannot hold BusinessLine" };
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
  // Suite 3 part b: 3-key clauses x deny then
  idx = 0;
  for (const when of allThreeKeyClauses()) {
    fixtures.push({
      id: "three-key-" + (idx++),
      suite: "exhaustive-3key",
      rules: [{ when: { ...when }, then: { ...denyThen } }]
    });
  }

  // Suite 4: rule-count scaling, 24 sets at each n=1..16. Same seed as the
  // Node-side run.
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

  // Suite 5: overwrite pairs across all 6 fields. SAME literal whenA/whenB
  // as equivalence.test.js: the FIRST 1-key clause and the FIRST 2-key
  // clause.
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
            { when: { ...whenA }, then: { [f]: a } },
            { when: { ...whenB }, then: { [f]: b } }
          ]
        });
      }
    }
  }

  return fixtures;
}

function cloneRule(r) {
  return { when: { ...r.when }, then: { ...r.then } };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

console.log("[gen] enumerating fixtures...");
const fixtures = buildFixtures();
console.log("[gen] " + fixtures.length + " fixtures to hash");

const t0 = Date.now();
const out = [];
for (let i = 0; i < fixtures.length; i++) {
  const fx = fixtures[i];
  const { instructions, outputHash } = hashJsOracleOutput(fx.rules);
  // Hex-encode instructions for safe JSON transport.
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
  if ((i + 1) % 500 === 0) {
    console.log("[gen]   " + (i + 1) + " / " + fixtures.length);
  }
}
const dt = Date.now() - t0;
console.log("[gen] hashed " + out.length + " fixtures in " + dt + " ms");

const meta = {
  specVersion: C.SPEC_VERSION,
  stateSpaceSize: C.STATE_SPACE_SIZE,
  dims: C.DIMS.map(d => ({ name: d.name, cardinality: d.values.length })),
  fixtureCount: out.length,
  hashAlgorithm: "fnv1a32",
  outputLayoutPerCoord: ["sdf:i32", "rth:u32", "rt:u32", "doc:u32", "reg:u32", "deny:u32"],
  generatedAt: new Date().toISOString(),
  fixtures: out
};

const outPath = path.join(__dirname, "gpu-fixtures.json");
fs.writeFileSync(outPath, JSON.stringify(meta));
const sizeKb = Math.round(fs.statSync(outPath).size / 1024);
console.log("[gen] wrote " + outPath + " (" + sizeKb + " KB)");
