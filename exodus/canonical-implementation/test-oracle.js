// ============================================================================
// test-oracle.js  -  verify oracle.js matches css-oracle.js byte-for-byte
// ============================================================================
// This is the verification that proves the WGSL shader's semantics are
// correct BEFORE we run it on hardware. Logic:
//
//   1. css-oracle.js implements constraints.md section 4 directly, as a
//      straight port of the canonical resolution procedure.
//   2. oracle.js executes the compiled bytecode using the same stack-machine
//      semantics resolve.wgsl uses.
//   3. compile-constraints.js turns the rules into that bytecode.
//
// If (1) and (2) agree across all 2880 coordinates, then the compiler is
// correct AND the bytecode semantics are correct. What remains for the
// GPU path to be trusted is ONLY the host plumbing (device setup, buffer
// layout, dispatch) -- problems that are detectable by byte-comparison
// in-browser but cannot introduce new logical errors.
//
// This script is Node-runnable with zero dependencies.
// ============================================================================

"use strict";

const C = require("./constraints.js");
const cssOracle = require("./css-oracle.js");
const jsOracle  = require("./oracle.js");
const compiler  = require("./compile-constraints.js");

let pass = 0, fail = 0;
const failures = []; // collect first few divergences for diagnosis

function test(name, fn) {
  try { fn(); console.log("  PASS  " + name); pass++; }
  catch (e) { console.log("  FAIL  " + name + "  -> " + e.message); fail++; }
}

// ---- Structural tests ------------------------------------------------------

console.log("=== Spec sanity ===");

test("spec version matches 1.0", () => {
  if (C.SPEC_VERSION !== "1.0") throw new Error("version: " + C.SPEC_VERSION);
});

test("state space size is 2880", () => {
  if (C.STATE_SPACE_SIZE !== 2880) throw new Error("size: " + C.STATE_SPACE_SIZE);
});

test("11 constraints defined", () => {
  if (C.CONSTRAINTS.length !== 11) throw new Error("count: " + C.CONSTRAINTS.length);
});

test("6 dimensions defined", () => {
  if (C.DIMS.length !== 6) throw new Error("dim count: " + C.DIMS.length);
});

test("dim cardinalities match spec", () => {
  const expected = [3, 4, 4, 3, 4, 5];
  for (let i = 0; i < expected.length; i++) {
    if (C.DIMS[i].values.length !== expected[i]) {
      throw new Error(`dim ${i} card: got ${C.DIMS[i].values.length}, expected ${expected[i]}`);
    }
  }
});

test("canonical tables have expected sizes", () => {
  if (C.RT_TABLE.length   !== 4) throw new Error("rt:"   + C.RT_TABLE.length);
  if (C.DOC_TABLE.length  !== 3) throw new Error("doc:"  + C.DOC_TABLE.length);
  if (C.REG_TABLE.length  !== 2) throw new Error("reg:"  + C.REG_TABLE.length);
  if (C.DENY_TABLE.length !== 7) throw new Error("deny:" + C.DENY_TABLE.length);
});

test("index 0 is the default in every table", () => {
  if (C.RT_TABLE[0]   !== "UNCLASSIFIED") throw new Error("rt[0]");
  if (C.DOC_TABLE[0]  !== "BASIC")        throw new Error("doc[0]");
  if (C.REG_TABLE[0]  !== "VALID")        throw new Error("reg[0]");
  if (C.DENY_TABLE[0] !== "")             throw new Error("deny[0]");
});

// ---- Coord packing roundtrip ----------------------------------------------

console.log("\n=== Coordinate enumeration and packing ===");

test("unpackCoord / packCoord roundtrip over full space", () => {
  for (let i = 0; i < C.STATE_SPACE_SIZE; i++) {
    const c = C.unpackCoord(i);
    const back = C.packCoord(c);
    if (back !== i) throw new Error(`roundtrip fail at ${i}: ${c} -> ${back}`);
  }
});

test("unpackCoordU32 / packCoordU32 roundtrip for full space", () => {
  for (let i = 0; i < C.STATE_SPACE_SIZE; i++) {
    const c = C.unpackCoord(i);
    const packed = C.packCoordU32(c);
    const back = C.unpackCoordU32(packed);
    for (let d = 0; d < 6; d++) {
      if (back[d] !== c[d]) throw new Error(`u32 roundtrip fail at ${i}/${d}: ${c} -> ${back}`);
    }
  }
});

// ---- Compiler tests --------------------------------------------------------

console.log("\n=== Compiler ===");

let compiled;
test("compileAll produces a Uint32Array", () => {
  compiled = compiler.compileAll();
  if (!(compiled.instructions instanceof Uint32Array)) throw new Error("not Uint32Array");
});

test("compiled instruction count is reasonable", () => {
  // 11 rules, each roughly:
  //   1-key:  MATCH_DIM, BEGIN_THEN, 1-3 SET_*, END_RULE  (4-6 insts)
  //   2-key:  MATCH_DIM, MATCH_DIM, AND, BEGIN_THEN, SET_SDF, SET_DENY, END_RULE  (7)
  //   3-key:  MATCH_DIM x3, AND x2, BEGIN_THEN, SET_SDF, SET_DENY, END_RULE  (9)
  // Total in the 50-80 range.
  const n = compiled.instructions.length;
  if (n < 40 || n > 100) throw new Error("out of expected range: " + n);
});

test("compiler sorts rules by |when| ascending (stable)", () => {
  const sorted = compiler.sortRules(C.CONSTRAINTS);
  // After sorting: first come 1-key rules in original order, then 2-key, then 3-key.
  // Original declaration order (from constraints.js):
  //   0: credit:prime            (1)
  //   1: credit:near-prime       (1)
  //   2: credit:sub-prime        (1)
  //   3: residency:foreign       (1)
  //   4: residency:diplomatic    (1)
  //   5: credit:sub-prime+prod   (2)
  //   6: foreign+mort+subprime   (3)
  //   7: unemployed+mortgage     (2)
  //   8: student+business-line   (2)
  //   9: trust+personal          (2)
  //  10: under50+mortgage        (2)
  // After stable sort by |when|:
  //   [0,1,2,3,4] first (all 1-key in orig order)
  //   [5,7,8,9,10] next (2-key in orig order)
  //   [6] last (only 3-key)
  const expectedOrder = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 6];
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] !== C.CONSTRAINTS[expectedOrder[i]]) {
      throw new Error(`sort order mismatch at position ${i}`);
    }
  }
});

// ---- Oracle vs CSS oracle: THE CENTRAL TEST --------------------------------

console.log("\n=== Central verification: JS stack machine vs CSS oracle ===");

let cssResults, jsResults;

test("css-oracle resolves all 2880 coords", () => {
  cssResults = cssOracle.resolveAll();
  if (cssResults.length !== 2880) throw new Error("count: " + cssResults.length);
});

test("js oracle resolves all 2880 coords", () => {
  jsResults = jsOracle.executeAll(compiled.instructions);
  if (jsResults.length !== 2880) throw new Error("count: " + jsResults.length);
});

test("every CSS output field uses a string that maps to its canonical table", () => {
  for (let i = 0; i < cssResults.length; i++) {
    // recordToIndices throws if a string is absent
    cssOracle.recordToIndices(cssResults[i]);
  }
});

test("JS oracle output equals CSS oracle output byte-for-byte (all 2880 coords)", () => {
  let divergences = 0;
  for (let i = 0; i < 2880; i++) {
    const cssIdx = cssOracle.recordToIndices(cssResults[i]);
    const js     = jsResults[i];
    const fields = ["sdf", "rt", "rth", "doc", "reg", "deny"];
    for (const f of fields) {
      if (cssIdx[f] !== js[f]) {
        divergences++;
        if (failures.length < 10) {
          const coord = C.unpackCoord(i);
          failures.push({
            coordIdx: i,
            coord,
            field: f,
            css:    cssIdx[f],
            js:     js[f],
            cssStr: cssResults[i],
            jsIdx:  js
          });
        }
      }
    }
  }
  if (divergences > 0) {
    throw new Error(`${divergences} field mismatches across ${failures.length >= 10 ? "at least 10" : failures.length} coordinates. First failure: ` + JSON.stringify(failures[0]));
  }
});

// ---- Sample output inspections --------------------------------------------

console.log("\n=== Sample outputs (spot-checks) ===");

function coordFromValues(vals) {
  // Build a coord array from {dimName: valueStr} -- returns value-index array.
  const coord = [0, 0, 0, 0, 0, 0];
  for (const name in vals) {
    const d = C.dimIndex(name);
    coord[d] = C.valueIndex(d, vals[name]);
  }
  return coord;
}

test("prime + mortgage + individual + domestic + over250 + employed => A-PREFERRED valid", () => {
  const c = coordFromValues({ credit: "prime", product: "mortgage", applicant: "individual",
                              residency: "domestic", income: "over250", employment: "employed" });
  const r = cssOracle.resolveCoord(c);
  if (r.sdf !== -1 || r.rt !== "A-PREFERRED" || r.rth !== 160 || r.doc !== "BASIC" || r.reg !== "VALID") {
    throw new Error(JSON.stringify(r));
  }
});

test("sub-prime + business-line => DENIED ('SubPrime cannot hold BusinessLine')", () => {
  const c = coordFromValues({ credit: "sub-prime", product: "business-line", applicant: "individual",
                              residency: "domestic", income: "over250", employment: "employed" });
  const r = cssOracle.resolveCoord(c);
  if (r.sdf !== 1 || r.reg !== "DENIED" || r.rth !== 0 ||
      r.deny !== "SubPrime cannot hold BusinessLine") {
    throw new Error(JSON.stringify(r));
  }
});

test("foreign + sub-prime + mortgage => 3-key denial wins over 1-key defaults", () => {
  const c = coordFromValues({ credit: "sub-prime", product: "mortgage", applicant: "individual",
                              residency: "foreign", income: "over250", employment: "employed" });
  const r = cssOracle.resolveCoord(c);
  if (r.sdf !== 1 || r.reg !== "DENIED" ||
      r.deny !== "Foreign SubPrime Mortgage not underwriteable") {
    throw new Error(JSON.stringify(r));
  }
});

test("near-prime + diplomatic => rt=B-STANDARD, doc=MAXIMUM (diplomatic overrides B's ENHANCED)", () => {
  const c = coordFromValues({ credit: "near-prime", product: "auto", applicant: "individual",
                              residency: "diplomatic", income: "over250", employment: "employed" });
  const r = cssOracle.resolveCoord(c);
  if (r.sdf !== -1 || r.rt !== "B-STANDARD" || r.doc !== "MAXIMUM" || r.reg !== "VALID") {
    throw new Error(JSON.stringify(r));
  }
});

test("prime + foreign => rt=A-PREFERRED, doc=ENHANCED (foreign uplifts A's BASIC)", () => {
  const c = coordFromValues({ credit: "prime", product: "auto", applicant: "individual",
                              residency: "foreign", income: "over250", employment: "employed" });
  const r = cssOracle.resolveCoord(c);
  if (r.sdf !== -1 || r.rt !== "A-PREFERRED" || r.rth !== 160 || r.doc !== "ENHANCED") {
    throw new Error(JSON.stringify(r));
  }
});

// ---- Output-space inspection ----------------------------------------------

console.log("\n=== Output-space statistics ===");

test("valid / denied counts match in both paths", () => {
  let cssValid = 0, cssDenied = 0;
  for (const r of cssResults) {
    if (r.sdf === -1) cssValid++; else cssDenied++;
  }
  let jsValid = 0, jsDenied = 0;
  for (const r of jsResults) {
    if (r.sdf === -1) jsValid++; else jsDenied++;
  }
  if (cssValid !== jsValid) throw new Error(`valid counts: css=${cssValid} js=${jsValid}`);
  if (cssDenied !== jsDenied) throw new Error(`denied counts: css=${cssDenied} js=${jsDenied}`);
  console.log(`        [info]  valid=${cssValid}  denied=${cssDenied}  total=${cssValid + cssDenied}`);
});

// ---- Disassembly ----------------------------------------------------------

console.log("\n=== Compiled program disassembly ===\n");
console.log(compiler.disassemble(compiled.instructions));
console.log();
console.log(`[${compiled.stats.totalInstructions} instructions, ${compiled.stats.byteSize} bytes]`);

// ---- Final totals ---------------------------------------------------------

console.log("\n=== Totals ===");
console.log(`PASS: ${pass}   FAIL: ${fail}`);
if (fail > 0) {
  console.log("\nFirst failures:");
  for (const f of failures.slice(0, 5)) {
    console.log("  coord", f.coordIdx, f.coord, "field", f.field, "css=", f.css, "js=", f.js);
  }
  process.exit(1);
}
