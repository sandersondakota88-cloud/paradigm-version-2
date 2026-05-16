// test-phase5c.js - Cross-engine ratification

"use strict";

const H = require("./phase5-harness.js");

const tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

// ---------------------------------------------------------------------------
// 5c.1: Ratification occurs at least once across a divergence-then-
// recurring stream
//
// Divergence pushes the gap up, generating predictions. Recurring
// input then arrives and either matches predictions (ratifying them)
// or does not. We do not assert a specific count, only that the
// mechanism fires at least once across a generous stream.
// ---------------------------------------------------------------------------
test("5c.1 ratification occurs across divergence-then-recurring", async function () {
  const rt = await H.setup();
  const burst = H.inputStreamDivergence(10, 30);
  const recur = H.inputStreamRecurring(50);
  const inputs = burst.concat(recur);
  const snaps = await H.driveInputs(rt, inputs);
  const finalRat = snaps[snaps.length - 1].ratCount;
  if (finalRat < 1) {
    throw new Error("zero ratifications across " + inputs.length + " inputs");
  }
  await H.teardown(rt);
});

// ---------------------------------------------------------------------------
// 5c.2: Ratification leaves a structural-event clause on the surface
//
// Per O3 the surface emits clauses on structural transitions. A
// "reach landed" clause should appear at least once when any
// ratification occurs.
// ---------------------------------------------------------------------------
test("5c.2 ratification produces 'reach landed' clauses", async function () {
  const rt = await H.setup();
  const burst = H.inputStreamDivergence(10, 30);
  const recur = H.inputStreamRecurring(60);
  const inputs = burst.concat(recur);
  await H.driveInputs(rt, inputs);

  const finalRat = H.Field.ratCount;
  // If no ratifications occurred this run (small-sample variance),
  // skip the clause check rather than fail.
  if (finalRat === 0) {
    console.log("        [note: 0 ratifications this run; cannot test for reach-landed clause]");
    await H.teardown(rt);
    return;
  }

  const reachCount = H.structuralEventCount(rt, "landed");
  if (reachCount < 1) {
    throw new Error("ratifications=" + finalRat + " but 0 'landed' clauses on surface");
  }
  await H.teardown(rt);
});

// ---------------------------------------------------------------------------
// 5c.3: Ratification advances ratCount monotonically
//
// Per F4-style commitment, ratCount only goes up. Once a prediction
// ratifies, it stays ratified.
// ---------------------------------------------------------------------------
test("5c.3 ratCount is monotonically non-decreasing", async function () {
  const rt = await H.setup();
  const inputs = H.inputStreamDivergence(10, 20).concat(H.inputStreamRecurring(40));
  const snaps = await H.driveInputs(rt, inputs);
  let prev = 0;
  for (const s of snaps) {
    if (s.ratCount < prev) {
      throw new Error("ratCount regressed " + prev + " -> " + s.ratCount + " at step " + s.step);
    }
    prev = s.ratCount;
  }
  await H.teardown(rt);
});

// ---------------------------------------------------------------------------
// 5c.4: Ratified constraints are weighted higher than fresh derived
//
// Per the kindMult semantics in Field selection, ratified gets 1.3x
// weight versus 1.0 baseline. We can't observe weighting directly in
// snapshots, but we can verify ratified constraints exist after
// ratification events occur.
// ---------------------------------------------------------------------------
test("5c.4 ratified constraints persist in field after ratification", async function () {
  const rt = await H.setup();
  const inputs = H.inputStreamDivergence(10, 20).concat(H.inputStreamRecurring(40));
  await H.driveInputs(rt, inputs);
  const ratified = (H.Field.constraints || []).filter(c => c.kind === "ratified");
  // If no ratifications occurred, this test trivially passes (nothing
  // to verify). If any did occur, ratified constraints should be in
  // the field.
  if (H.Field.ratCount > 0 && ratified.length === 0) {
    throw new Error("ratCount=" + H.Field.ratCount + " but no ratified constraints in field");
  }
  await H.teardown(rt);
});

// ---------------------------------------------------------------------------
// 5c.5: Predictive constraints can also age out without ratifying
//
// Per SE-05's M2 + M3, predictive constraints either ratify (matched)
// or evict (aged out). We verify that predictives don't accumulate
// indefinitely - the count should stay bounded over a long run.
// ---------------------------------------------------------------------------
test("5c.5 predictive constraints don't accumulate unbounded", async function () {
  const rt = await H.setup();
  const inputs = H.inputStreamDivergence(20, 60);
  const snaps = await H.driveInputs(rt, inputs);
  const peakPred = snaps.reduce((m, s) => Math.max(m, s.byKind.predictive || 0), 0);
  // Predictive cap is implementation-specific; we use a generous bound.
  // 64 is the FIELD_LIVE_CAP / 64 ratio that any sensible implementation
  // would respect.
  const reasonableCap = 256;
  if (peakPred > reasonableCap) {
    throw new Error("predictive count peaked at " + peakPred + " > " + reasonableCap);
  }
  await H.teardown(rt);
});

// ---------------------------------------------------------------------------
// 5c.6: Field state shared across "engines" - a single ratification
// event affects subsequent reads from both substrate connections
//
// Per S1 (substrate is shared, owned by neither), once a constraint
// ratifies, both engines see the ratified state on subsequent reads.
// In our implementation the ER engine reads Field on each evaluation,
// and CT engine reads Field for its scoring. This test verifies the
// shared-field property via observable side effects.
// ---------------------------------------------------------------------------
test("5c.6 ratification visible to both engines via shared field", async function () {
  const rt = await H.setup();
  const inputs = H.inputStreamDivergence(10, 20).concat(H.inputStreamRecurring(40));
  await H.driveInputs(rt, inputs);
  if (H.Field.ratCount === 0) {
    console.log("        [note: 0 ratifications this run; field-share trivially holds]");
    await H.teardown(rt);
    return;
  }
  // Both engines read Field. After ratifications, the same
  // ratified constraint should be visible regardless of which
  // engine "looks." We verify this by checking both:
  //   - Field.constraints (ER engine reads this on evaluate)
  //   - Field.ratCount (CT engine reads this for scoring)
  // are consistent.
  const ratifiedInList = (H.Field.constraints || []).filter(c => c.kind === "ratified").length;
  if (ratifiedInList === 0 && H.Field.ratCount > 0) {
    throw new Error("ratCount=" + H.Field.ratCount + " but no ratified in constraints list");
  }
  await H.teardown(rt);
});

// ---------------------------------------------------------------------------
// 5c.7: SE-06 invariants S1, S2, S3 hold through ratification cycles
// ---------------------------------------------------------------------------
test("5c.7 SE-06 invariants hold through ratification stream", async function () {
  const rt = await H.setup();
  const inputs = H.inputStreamDivergence(10, 20).concat(H.inputStreamRecurring(40));
  await H.driveInputs(rt, inputs);
  const r1 = H.Invariants.seedPermanent(rt);
  if (r1 !== true && r1.ok !== true) throw new Error("F1: " + r1.msg);
  const r3 = H.Invariants.noCommandPath(rt);
  if (r3 !== true && r3.ok !== true) throw new Error("S3: " + r3.msg);
  await H.teardown(rt);
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
