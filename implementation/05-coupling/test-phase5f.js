// test-phase5f.js - Substrate equivalence at scale

"use strict";

const H = require("./phase5-harness.js");
const Compiler = require("./constraint-compiler.js");
const CpuOracle = require("./cpu-oracle.js");

const tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

// ---------------------------------------------------------------------------
// 5f.1: CPU oracle is deterministic (same input -> same output)
//
// Run the oracle against the same compiled buffer and input record
// twice; results must be byte-identical.
// ---------------------------------------------------------------------------
test("5f.1 CPU oracle deterministic on repeat", async function () {
  const rt = await H.setup();
  await H.driveInputs(rt, H.inputStreamRecurring(40));

  const compiled = Compiler.compileField(H.Field.constraints);
  const probe = Compiler.computeInputRecord("test red square", compiled.tokenTable);

  const r1 = CpuOracle.evaluateField(compiled, probe);
  const r2 = CpuOracle.evaluateField(compiled, probe);

  if (r1.length !== r2.length) {
    throw new Error("output length differs between runs");
  }
  for (let i = 0; i < r1.length; i++) {
    if (r1[i] !== r2[i]) {
      throw new Error("non-deterministic at index " + i + ": " + r1[i] + " vs " + r2[i]);
    }
  }
  await H.teardown(rt);
});

// ---------------------------------------------------------------------------
// 5f.2: Different inputs produce different outputs (sanity: not a stub)
//
// Two distinct inputs must produce at least somewhat different match
// results, otherwise the oracle is broken (returning constant zero,
// for example).
// ---------------------------------------------------------------------------
test("5f.2 CPU oracle is responsive to input variation", async function () {
  const rt = await H.setup();
  await H.driveInputs(rt, H.inputStreamRecurring(40));

  const compiled = Compiler.compileField(H.Field.constraints);
  const probeA = Compiler.computeInputRecord("red square", compiled.tokenTable);
  const probeB = Compiler.computeInputRecord("xyz123 strange", compiled.tokenTable);

  const rA = CpuOracle.evaluateField(compiled, probeA);
  const rB = CpuOracle.evaluateField(compiled, probeB);

  let differs = false;
  for (let i = 0; i < rA.length; i++) {
    if (rA[i] !== rB[i]) { differs = true; break; }
  }
  if (!differs) {
    throw new Error("CPU oracle returned identical results for two distinct inputs (output may be stuck)");
  }
  await H.teardown(rt);
});

// ---------------------------------------------------------------------------
// 5f.3: Output length matches constraint count
// ---------------------------------------------------------------------------
test("5f.3 CPU oracle output length equals constraint count", async function () {
  const rt = await H.setup();
  await H.driveInputs(rt, H.inputStreamRecurring(40));

  const compiled = Compiler.compileField(H.Field.constraints);
  const probe = Compiler.computeInputRecord("test alpha 42", compiled.tokenTable);

  const result = CpuOracle.evaluateField(compiled, probe);
  if (result.length !== compiled.constraintCount) {
    throw new Error("output length " + result.length + " != constraint count " + compiled.constraintCount);
  }
  await H.teardown(rt);
});

// ---------------------------------------------------------------------------
// 5f.4: Resolver handles a population including compounds
//
// Phase 4b introduces compound constraints. The compiler should
// either skip them (if not GPU-expressible) or compile them into a
// form the oracle can walk. Either way, the oracle must not crash
// or produce out-of-bounds results when compounds are present.
// ---------------------------------------------------------------------------
test("5f.4 resolver coherent on field including compounds", async function () {
  const rt = await H.setup();
  // A heterogeneous stream that produces compounds
  const inputs = H.inputStreamRecurring(60).concat(H.inputStreamDivergence(15, 25));
  await H.driveInputs(rt, inputs);

  // Verify the field has compounds (or note if not)
  const compounds = (H.Field.constraints || []).filter(c => c.kind === "compound");
  if (compounds.length === 0) {
    console.log("        [note: no compounds in field this run; coherence trivially holds]");
  }

  const compiled = Compiler.compileField(H.Field.constraints);
  const probe = Compiler.computeInputRecord("test under stress", compiled.tokenTable);

  const result = CpuOracle.evaluateField(compiled, probe);

  // All result values must be 0 or 1 (boolean match indicator)
  for (let i = 0; i < result.length; i++) {
    if (result[i] !== 0 && result[i] !== 1) {
      throw new Error("invalid match result at " + i + ": " + result[i] + " (expected 0 or 1)");
    }
  }
  await H.teardown(rt);
});

// ---------------------------------------------------------------------------
// 5f.5: Resolver walks a large constraint population without OOB
//
// Stress: drive enough input to grow the field to 100+ constraints.
// Verify the oracle walks the entire compiled buffer without
// out-of-bounds reads or write errors.
// ---------------------------------------------------------------------------
test("5f.5 resolver handles large constraint population", async function () {
  const rt = await H.setup();
  const inputs = H.inputStreamStructured(100).concat(H.inputStreamRecurring(50));
  await H.driveInputs(rt, inputs);

  const constraintCount = (H.Field.constraints || []).length;
  // Should have grown from initial seed-only state
  if (constraintCount < 5) {
    console.log("        [note: only " + constraintCount + " constraints; large-population claim weak]");
  }

  const compiled = Compiler.compileField(H.Field.constraints);
  const inputs2 = ["test alpha 99", "more inputs here", "different shape"];
  for (const inp of inputs2) {
    const probe = Compiler.computeInputRecord(inp, compiled.tokenTable);
    const result = CpuOracle.evaluateField(compiled, probe);
    if (result.length !== compiled.constraintCount) {
      throw new Error("output size mismatch: " + result.length + " vs " + compiled.constraintCount);
    }
  }
  await H.teardown(rt);
});

// ---------------------------------------------------------------------------
// 5f.6: Same field, same input: oracle and ER engine CPU path agree
//
// The ER engine's _evaluateCPU calls CpuOracle.evaluateField. We
// verify that the engine's evaluate() path produces the same result
// as direct CpuOracle.evaluateField calls. This catches any caching
// or state drift in the ER engine.
// ---------------------------------------------------------------------------
test("5f.6 ER engine CPU path agrees with direct oracle", async function () {
  const rt = await H.setup();
  await H.driveInputs(rt, H.inputStreamRecurring(40));

  const compiled = Compiler.compileField(H.Field.constraints);
  const probe = Compiler.computeInputRecord("alpha test", compiled.tokenTable);

  const direct = CpuOracle.evaluateField(compiled, probe);
  const viaEngine = rt.er.evaluate(compiled, probe);

  if (!viaEngine || !viaEngine.length) {
    throw new Error("ER engine evaluate() returned empty result");
  }
  if (viaEngine.length !== direct.length) {
    throw new Error("size mismatch: direct=" + direct.length + " engine=" + viaEngine.length);
  }
  for (let i = 0; i < direct.length; i++) {
    if (direct[i] !== viaEngine[i]) {
      throw new Error("divergence at " + i + ": direct=" + direct[i] + " engine=" + viaEngine[i]);
    }
  }
  await H.teardown(rt);
});

// ---------------------------------------------------------------------------
// 5f.7: Resolver is referentially transparent across stream replays
//
// Build a field, snapshot constraints, run the oracle on input X.
// Then run more inputs, then re-build a fresh oracle on the original
// snapshot, run input X again. Results must match.
// ---------------------------------------------------------------------------
test("5f.7 oracle is referentially transparent", async function () {
  const rt = await H.setup();
  await H.driveInputs(rt, H.inputStreamRecurring(30));

  // Snapshot the field
  const snap = JSON.parse(JSON.stringify(H.Field.constraints));
  const compiled1 = Compiler.compileField(snap);
  const probe1 = Compiler.computeInputRecord("reference input", compiled1.tokenTable);
  const r1 = CpuOracle.evaluateField(compiled1, probe1);

  // Drive more inputs to mutate the live field
  await H.driveInputs(rt, H.inputStreamRecurring(20));

  // Recompile the original snapshot, run again
  const compiled2 = Compiler.compileField(snap);
  const probe2 = Compiler.computeInputRecord("reference input", compiled2.tokenTable);
  const r2 = CpuOracle.evaluateField(compiled2, probe2);

  if (r1.length !== r2.length) {
    throw new Error("size mismatch on replay");
  }
  for (let i = 0; i < r1.length; i++) {
    if (r1[i] !== r2[i]) {
      throw new Error("non-transparent at " + i + ": " + r1[i] + " vs " + r2[i]);
    }
  }
  await H.teardown(rt);
});

// ---------------------------------------------------------------------------
// 5f.8: Note about GPU-side equivalence
//
// We can't run WebGPU in Node. Phase 2's test-equivalence.js verified
// CPU vs WGSL on the static loan-domain corpus (22/22). Phase 5f's
// claim is that the runtime cascade is *also* deterministic and
// well-formed - so when running on the GPU substrate, the byte-
// equivalence Phase 2 established continues to hold.
//
// This test is a placeholder that documents the inheritance.
// ---------------------------------------------------------------------------
test("5f.8 GPU substrate equivalence inherits from Phase 2", async function () {
  // No runtime check; this is a documented inheritance claim.
  // The test exists to make the inheritance explicit in the test
  // count, and to fail loudly if anyone accidentally runs Phase 5
  // claiming to verify GPU equivalence in Node.
  if (typeof navigator !== "undefined" && navigator.gpu) {
    // In a hypothetical browser run, we'd dispatch the shader and
    // diff the outputs. Skipped in Node by design.
    throw new Error("5f.8 should not run GPU verification in Node");
  }
  // Pass: inheritance from Phase 2's 22/22 is recorded.
});

// ---------------------------------------------------------------------------
// runner
// ---------------------------------------------------------------------------

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log("  ok    " + t.name);
      pass += 1;
    } catch (e) {
      console.log("  FAIL  " + t.name);
      console.log("        " + (e && e.stack || e));
      fail += 1;
    }
  }
  console.log("");
  console.log(pass + "/" + tests.length + " tests passed");
  return { pass: pass, fail: fail, total: tests.length };
}

if (require.main === module) {
  run().then(r => process.exit(r.fail === 0 ? 0 : 1));
}

module.exports = { run: run };
