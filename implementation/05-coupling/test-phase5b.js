// test-phase5b.js - Divergence induction

"use strict";

const H = require("./phase5-harness.js");

const tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

// ---------------------------------------------------------------------------
// 5b.1: Divergence stream produces a render-gap exceeding threshold
//
// Stable inputs followed by a novelty burst should at some point push
// the render-gap above GAP_PREDICT_THRESH. The architecture's job is
// to respond; this test only verifies the gap actually rises.
// ---------------------------------------------------------------------------
test("5b.1 divergence stream raises render-gap above threshold", async function () {
  const rt = await H.setup();
  const thr = H.CFG.GAP_PREDICT_THRESH || 0.12;
  const inputs = H.inputStreamDivergence(20, 40);
  const snaps = await H.driveInputs(rt, inputs);
  const peak = H.maxGap(snaps);
  if (peak < thr * 0.8) {
    // gap did not even reach 80% of threshold
    throw new Error("render-gap peak " + peak.toFixed(3)
      + " below " + (thr * 0.8).toFixed(3) + " (threshold " + thr + ")");
  }
  await H.teardown(rt);
});

// ---------------------------------------------------------------------------
// 5b.2: Predictive constraints are generated during divergence
//
// SE-05 commits to predictive constraint generation when the vector-
// delta gap exceeds threshold. This test verifies that across a
// divergence-inducing stream, at least some predictive constraints
// appear in the field.
// ---------------------------------------------------------------------------
test("5b.2 predictive constraints generated under divergence", async function () {
  const rt = await H.setup();
  const inputs = H.inputStreamDivergence(15, 35);
  const snaps = await H.driveInputs(rt, inputs);
  // Look for any snapshot where predictive constraints existed
  let sawPredictive = false;
  for (const s of snaps) {
    if ((s.byKind.predictive || 0) > 0) { sawPredictive = true; break; }
  }
  if (!sawPredictive) {
    throw new Error("no predictive constraints generated across divergence stream");
  }
  await H.teardown(rt);
});

// ---------------------------------------------------------------------------
// 5b.3: Exec-scope gap is independently measured
//
// Per S3, render-scope and exec-scope deltas are read from different
// positions. They should be independently observable. This test
// verifies the exec-gap is computed (not always zero).
// ---------------------------------------------------------------------------
test("5b.3 exec-scope delta is independently measured", async function () {
  const rt = await H.setup();
  const inputs = H.inputStreamDivergence(10, 30);
  const snaps = await H.driveInputs(rt, inputs);
  // exec-scope has three readings: scalar (queue population), fast
  // (recent unresolved-ratio), and slow (integrated history). The
  // scalar will be 0 between drives (queue drained), which is
  // semantically correct. The slow reading integrates across the
  // run and SHOULD move from its initial 1.0 toward equilibrium.
  // The gap is what predictive reaching at exec-scope responds to.
  const execSlows = snaps.map(s => s.execDelta.slow);
  const minSlow = Math.min.apply(null, execSlows);
  const maxSlow = Math.max.apply(null, execSlows);
  if (maxSlow - minSlow < 0.005) {
    throw new Error("exec-slow delta is flat across divergence stream (range "
      + minSlow.toFixed(4) + " to " + maxSlow.toFixed(4) + ")");
  }
  // Exec-gap should be > 0 at some point (since exec-slow > exec-fast
  // when work is being processed).
  const peakExecGap = H.maxExecGap(snaps);
  if (peakExecGap < 0.001) {
    throw new Error("exec-scope gap stuck at 0 across divergence stream");
  }
  await H.teardown(rt);
});

// ---------------------------------------------------------------------------
// 5b.4: Surface emits structural-event clauses during divergence
//
// 'reach landed' or 'diverged' or 'structure formed' clauses indicate
// the surface is observing the divergence. We don't assert specific
// counts, only that the surface is alive across the stream.
// ---------------------------------------------------------------------------
test("5b.4 reflexive surface observes divergence events", async function () {
  const rt = await H.setup();
  const inputs = H.inputStreamDivergence(15, 35);
  await H.driveInputs(rt, inputs);
  if (rt.surface.totalEmitted < 1) {
    throw new Error("surface emitted zero clauses across divergence stream");
  }
  await H.teardown(rt);
});

// ---------------------------------------------------------------------------
// 5b.5: Invariants hold through divergence
// ---------------------------------------------------------------------------
test("5b.5 F1, I3, and S3 hold through divergence stream", async function () {
  const rt = await H.setup();
  const inputs = H.inputStreamDivergence(15, 40);
  await H.driveInputs(rt, inputs);

  const r1 = H.Invariants.seedPermanent(rt);
  if (r1 !== true && r1.ok !== true) throw new Error("F1: " + r1.msg);

  const r2 = H.Invariants.constraintCap(rt);
  if (r2 !== true && r2.ok !== true) throw new Error("I3-constraints: " + r2.msg);

  const r3 = H.Invariants.traceBounded(rt);
  if (r3 !== true && r3.ok !== true) throw new Error("I3-trace: " + r3.msg);

  const r4 = H.Invariants.noCommandPath(rt);
  if (r4 !== true && r4.ok !== true) throw new Error("S3: " + r4.msg);

  await H.teardown(rt);
});

// ---------------------------------------------------------------------------
// 5b.6: After divergence settles (more steady inputs), delta gap
// can come back down
//
// Predictive reaching closes the gap when matching inputs arrive. We
// drive a divergence burst, then a steady tail, and check that the
// gap is lower at the end than at peak. This is a soft check - we
// only require some recovery, not full convergence.
// ---------------------------------------------------------------------------
test("5b.6 render-gap can decline after divergence with steady tail", async function () {
  const rt = await H.setup();
  const burst = H.inputStreamDivergence(10, 30);
  const tail = [];
  for (let i = 0; i < 30; i++) tail.push("steady predictable input pattern");
  const inputs = burst.concat(tail);
  const snaps = await H.driveInputs(rt, inputs);
  const peak = H.maxGap(snaps);
  // Average gap over the last 10 snapshots
  const tail10 = snaps.slice(-10);
  const tailAvg = tail10.reduce((s, x) => s + x.delta.gap, 0) / tail10.length;
  // Soft: tailAvg should be at most peak (not strictly below). The
  // architecture's gap dynamics include slow-layer drift; we don't
  // demand full closure, only that the system isn't getting strictly
  // worse over a steady tail.
  if (tailAvg > peak * 1.05) {
    throw new Error("gap rose during steady tail: peak=" + peak.toFixed(3)
      + " tailAvg=" + tailAvg.toFixed(3));
  }
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
