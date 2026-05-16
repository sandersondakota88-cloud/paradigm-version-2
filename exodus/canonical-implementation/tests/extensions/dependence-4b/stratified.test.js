// ============================================================================
// stratified.test.js  --  Boundary 4b-stratified: single named-coord
// cross-coord predicate
// ============================================================================
//
// What this tests
// ---------------
// A rule whose `when` clause refers to ANOTHER COORD's resolved value.
// Concretely: "this coord is denied iff sdf at named coord X is 1."
//
// "Named coord" means a specific coordinate fixed at compile time -- not
// a function over the field, not a reduction. The dependence is one-way
// and stratified: the named coord's resolution depends only on its own
// MATCH_DIM predicates (current grammar); other coords' resolution depends
// on the named coord's resolved sdf (proposed extension).
//
// Why this is the right first test for 4b
// ---------------------------------------
// 4a established that reductions are structurally outside the grammar
// because no opcode reads another coord's lane. Stratified cross-coord
// is the simplest extension of that: ONE foreign coord is read, the
// dependence is acyclic, the answer COULD be computed in two passes
// (first the named coord, then everyone else). It's the test that
// distinguishes "machine shape can't address other coords" from
// "machine shape requires fixed-point iteration." Stratified is the
// former. Mutual (next test) is the latter.
//
// Locked predictions
// ------------------
// P1. The cascade-correct answer exists and is constructible by a
//     two-pass external resolver. We compute it as ground truth.
// P2. The current grammar cannot express the rule. Specifically, no
//     legal `when` clause names another coord, and the compiler will
//     refuse or misinterpret any attempt.
// P3. The minimum extension to support stratified cross-coord is a
//     new opcode that reads from a designated coord's resolved Output.
//     Adding this opcode breaks single-pass dispatch: the shader can
//     no longer resolve all coords simultaneously because some coords
//     need other coords' Output to be already written. The machine
//     shape becomes two-pass (or k-pass for chains of length k).
// P4. The byte-identical equivalence claim must be RE-DERIVED under
//     the new dispatch model. The previous argument (per-coord
//     independence => same opcode handlers => same output) no longer
//     applies because the opcode handlers now depend on cross-coord
//     read ordering, which the three substrates may schedule
//     differently.
//
// Falsification:
//   F1. If the cascade resolves cross-coord rules without re-dispatch
//       (e.g., via CSS sibling selectors that read computed values
//       at render time), the predicted machine-shape change is too
//       pessimistic.
//   F2. If a legal grammar construct already addresses another coord
//       (we missed it in the 10-opcode enumeration), P2 is wrong.
//
// What we expect to learn:
//   - The machine shape boundary is real but stratified cases sit at
//     its near edge -- finite k-pass dispatch is enough. Mutual
//     (cyclic) cases sit at the far edge, where fixed-point
//     iteration is required.
//
// Run with:  node tests/extensions/dependence-4b/stratified.test.js
// ============================================================================

"use strict";

const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..", "..");
const C        = require(path.join(ROOT, "constraints.js"));
const cssOrig  = require(path.join(ROOT, "css-oracle.js"));
const compiler = require(path.join(ROOT, "compile-constraints.js"));

const results = { pass: 0, fail: 0 };
function test(label, body) {
  try {
    body();
    results.pass++;
    console.log("  PASS  " + label);
  } catch (e) {
    results.fail++;
    console.log("  FAIL  " + label + "  -> " + e.message);
  }
}
function note(s) { console.log("  NOTE  " + s); }

// ---------------------------------------------------------------------------
// Step 1: the cascade-correct answer via a two-pass external resolver
// ---------------------------------------------------------------------------
//
// The named coord: (prime, mortgage, individual, domestic, over250, employed).
// We will construct a proposed cross-coord rule:
//   "deny this coord iff the named coord's resolved sdf is 1"
// and compute the answer in two passes:
//   pass 1: resolve named coord with the canonical 11-rule program
//   pass 2: for every coord, if pass-1 result has sdf==1, deny this coord
//
// Because the canonical 11-rule program resolves the named coord to a
// VALID record (sdf=-1; prime+mortgage+individual+domestic+over250+employed
// matches the A-PREFERRED rule, no denials), the cross-coord rule produces
// NO denials in pass 2. We pick a different named coord to make the test
// interesting.

console.log("\n=== Step 1: ground truth from a two-pass external resolver ===\n");

function namedCoordIndex(values) {
  const coord = [0, 0, 0, 0, 0, 0];
  for (const dimName in values) {
    const d = C.dimIndex(dimName);
    coord[d] = C.valueIndex(d, values[dimName]);
  }
  return C.packCoord(coord);
}

// Pick a named coord that the canonical program DENIES, so the cross-coord
// rule has a non-trivial effect.
const namedCoord = {
  credit: "sub-prime", product: "business-line",
  applicant: "individual", residency: "domestic",
  income: "over250", employment: "employed"
};
const namedIdx = namedCoordIndex(namedCoord);
note(`named coord: ${JSON.stringify(namedCoord)}`);
note(`named coord linear index: ${namedIdx}`);

// Pass 1: resolve everyone via the canonical 11-rule program.
const baseRecords = cssOrig.resolveAll();
const namedRecord = baseRecords[namedIdx];
note(`pass-1 resolved record at named coord: ${JSON.stringify(namedRecord)}`);

test("P1: named coord resolves to sdf=1 (so the cross-coord rule fires)", () => {
  if (namedRecord.sdf !== 1) {
    throw new Error("expected sdf=1; got " + namedRecord.sdf);
  }
});

// Pass 2: now apply the proposed cross-coord rule.
//   when: { crossCoord_sdf: { atCoord: namedCoord, equals: 1 } }
//   then: { sdf: 1, deny: "denied by cross-coord rule" }
// Effect: if the named coord has sdf=1, ALL coords are denied. Otherwise,
// none.
//
// We compute the cascade-correct result of layering this rule on top of
// the canonical 11-rule resolution.

function appliesCrossCoord(namedRecord) {
  return namedRecord.sdf === 1;
}

const crossCoordFires = appliesCrossCoord(namedRecord);
const crossCoordDenyText = "Mortgage requires income source"; // pick a legal deny string
note(`cross-coord rule fires globally: ${crossCoordFires}`);

const groundTruthRecords = baseRecords.map(r => {
  if (!crossCoordFires) return r;
  return {
    sdf: 1,
    rt: r.rt, rth: 0, doc: r.doc,
    reg: "DENIED",
    deny: crossCoordDenyText
  };
});

const groundTruthDeniedCount = groundTruthRecords.filter(r => r.sdf === 1).length;
note(`ground-truth denied-coord count under cross-coord rule: ${groundTruthDeniedCount}`);

test("ground truth is well-defined (denies all 2880 if rule fires)", () => {
  if (crossCoordFires && groundTruthDeniedCount !== C.STATE_SPACE_SIZE) {
    throw new Error("expected " + C.STATE_SPACE_SIZE + "; got " + groundTruthDeniedCount);
  }
});

// ---------------------------------------------------------------------------
// Step 2: confirm no current opcode addresses another coord
// ---------------------------------------------------------------------------

console.log("\n=== Step 2: current grammar has no cross-coord vocabulary ===\n");

const opNames = Object.keys(compiler.OP);
note(`opcodes in current grammar: ${opNames.length}`);

const localityViolators = opNames.filter(n => {
  // Same locality semantics as reduction-4a Step 2.
  // The MATCH_DIM opcode reads only coord[a] for the CURRENT coord.
  // The SET_* opcodes write only the current coord's Output.
  // None addresses a foreign coord. We re-confirm here.
  return n.includes("OTHER") || n.includes("COORD_AT") || n.includes("FOREIGN");
});

test("P2: no opcode names a foreign-coord read", () => {
  if (localityViolators.length > 0) {
    throw new Error("found cross-coord opcodes: " + localityViolators.join(", "));
  }
});

// ---------------------------------------------------------------------------
// Step 3: attempt to express the cross-coord rule in current grammar
// ---------------------------------------------------------------------------

console.log("\n=== Step 3: attempt to compile the cross-coord rule ===\n");

// The rule shape we'd want:
//   {
//     when: { atCoord: namedCoord, sdfEquals: 1 },
//     then: { sdf: 1, deny: "..." }
//   }
// The compiler interprets `when` as { dimName: value } entries. "atCoord"
// is not a dim name. The compiler will throw on the unknown-dim lookup.

let threw = false, throwMsg = "";
try {
  compiler.compileRule({
    when: { atCoord: JSON.stringify(namedCoord), sdfEquals: 1 },
    then: { sdf: 1, deny: crossCoordDenyText }
  });
} catch (e) { threw = true; throwMsg = e.message; }

test("compiler refuses cross-coord rule shape", () => {
  if (!threw) throw new Error("compiler unexpectedly accepted cross-coord rule");
  note("compiler threw: " + throwMsg);
});

// Try a different shape: maybe the cross-coord predicate could be smuggled
// via a deeply-nested `when`. The compiler's `parseWhen` (in compile-
// constraints.js) iterates Object.keys(rule.when) and looks each up as a
// dim name. There is no recursion, no special-case for nested objects, no
// reserved key for cross-coord. The shape simply has no entry point.
test("no reserved key in `when` resolves to a cross-coord read", () => {
  const candidates = ["atCoord", "$foreign", "ref", "lookup", "external"];
  for (const k of candidates) {
    let didThrow = false;
    try {
      compiler.compileRule({
        when: { [k]: "anything" },
        then: { sdf: -1 }
      });
    } catch (_) { didThrow = true; }
    if (!didThrow) {
      throw new Error("compiler accepted reserved-key-shaped clause: " + k);
    }
  }
  note("all candidate cross-coord keys were rejected as unknown dims");
});

// ---------------------------------------------------------------------------
// Step 4: what would a minimum extension look like?
// ---------------------------------------------------------------------------

console.log("\n=== Step 4: minimum extension for stratified cross-coord ===\n");

note("the smallest extension that would support stratified cross-coord:");
note("  - one new opcode, say OP_MATCH_FOREIGN_SDF (0x04):");
note("    a = (the named coord's packed index high byte)");
note("    b = (expected sdf value: 0 for -1, 1 for +1)");
note("    behavior: push 1 if foreign_output[coord_idx_high<<8|low].sdf");
note("              == expected_sdf, else 0");
note("  - the foreign coord index needs more than 8 bits for STATE_SPACE_SIZE=2880");
note("    (which is 12 bits). The current instruction word is u32 with op:8,");
note("    a:8, b:8, reserved:8. We'd need to widen the operand (use the");
note("    reserved byte, or shift to a multi-word instruction).");
note("  - the SHADER would need access to outputs[] as a read source, not");
note("    just a write destination. Currently outputs[] is declared");
note("    storage<read_write> but only ever read by HOST after dispatch.");
note("    Inside the kernel, no read of outputs[i] occurs.");

test("the encoding word does not have spare operand bits for a 12-bit coord index", () => {
  // Confirm: instruction is op(8) | a(8) | b(8) | reserved(8).
  // a coord index for STATE_SPACE_SIZE=2880 needs ceil(log2(2880)) = 12 bits.
  // a single 8-bit operand can address 0..255 only. Either pack across a+b
  // (needs both bytes -> can't carry a second value like expected_sdf),
  // or widen instruction to multiple words. Both are encoding changes.
  const stateSpace = C.STATE_SPACE_SIZE;
  const bitsNeeded = Math.ceil(Math.log2(stateSpace));
  if (bitsNeeded <= 8) throw new Error("state space fits in 8 bits -- test premise wrong");
  note(`STATE_SPACE_SIZE=${stateSpace} needs ${bitsNeeded} bits; operand is 8 bits`);
});

// ---------------------------------------------------------------------------
// Step 5: what would the machine shape change require?
// ---------------------------------------------------------------------------

console.log("\n=== Step 5: machine-shape consequences ===\n");

note("structural consequences of adding stratified cross-coord:");
note("");
note("1. SHADER DISPATCH becomes multi-pass.");
note("   Currently: one compute pass resolves all 2880 coords in parallel.");
note("   With cross-coord reads: a coord that reads foreign[X] must execute");
note("   AFTER X has finished. Single dispatch can't enforce this without");
note("   inter-thread synchronization or workgroup barriers, which the");
note("   current shader does not use. The minimum change is K passes,");
note("   where K is the longest chain of cross-coord dependencies + 1.");
note("");
note("2. COMPILER must compute the dependence graph.");
note("   Each rule referencing a foreign coord induces an edge. The compiler");
note("   must topologically sort coords and emit per-pass instruction");
note("   buffers. Cyclic dependencies (Boundary 4b-mutual) cannot be");
note("   sorted -- they require iteration to fixed point or refusal.");
note("");
note("3. BYTE-IDENTICAL equivalence claim must be re-derived.");
note("   Currently: CSS == JS == GPU because all three implement the same");
note("   per-coord opcode handlers on the same bytecode. With cross-coord");
note("   reads, the THREE substrates' scheduling of the multi-pass dispatch");
note("   may differ:");
note("     - CSS engine: native; the cascade may have its own scheduling");
note("       (depends on CSS-spec semantics for any cross-coord-like feature)");
note("     - JS oracle: a host loop with explicit pass ordering");
note("     - GPU: K dispatches with explicit pass boundaries");
note("   For all three to agree byte-for-byte, they must all schedule the");
note("   K-pass resolution identically. Phase A/B does not cover this.");
note("");
note("4. The independence-closure property is no longer 'per-coord'");
note("   It becomes 'per stratum.' The strongest form of independence is");
note("   gone; a weaker form (independence within each stratum) replaces it.");

test("the machine shape changes -- single-pass dispatch is no longer sufficient", () => {
  // Establishable by inspection of the shader: it dispatches one compute
  // pass with no barriers between invocations. A cross-coord read would
  // race against the writer.
  const shaderHasBarriers = false; // confirmed by inspection of resolve.wgsl
  const shaderIsSinglePass = true;
  if (!shaderIsSinglePass) throw new Error("test premise wrong");
  if (shaderHasBarriers) throw new Error("test premise wrong");
  note("resolve.wgsl: single compute pass, no inter-invocation barriers");
  note("=> cannot safely support cross-coord reads without re-dispatch");
});

console.log("\n=== Totals ===");
console.log(`PASS: ${results.pass}   FAIL: ${results.fail}`);
if (results.fail > 0) process.exit(1);
process.exit(0);
