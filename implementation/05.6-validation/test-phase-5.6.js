// test-phase-5.6.js - Phase 5.6 - Trajectory Novelty Verification

“use strict”;

const H = require(”./phase5-harness.js”);
const crypto = require(“node:crypto”);

const tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

// —————————————————————————
// hashFieldState(): deterministic structural digest of field state
//
// Captures the surfaces F5 names as the irreversibility deposits:
//   - substrate state (slow + fast layers, both render and exec scope)
//   - constraint population (per-constraint id, kind, uses, lastUsed, weight)
//   - ratification + naming counters
//   - trace length (the trace itself is append-only per M5; length is sufficient
//     to verify M5 monotonicity, and the per-constraint state captures what
//     the trace records about)
//   - sub-cascade and recall state
//
// Explicitly EXCLUDES the step counter. Step is monotonic by F4 and would
// trivialize the trajectory novelty test if included. The structural claim
// of F5 is that field state minus bookkeeping is novel across observation
// events; that is what this digest tests.
//
// Floats are converted via Number.prototype.toString(), which produces the
// shortest decimal representation that uniquely identifies the double-
// precision value. This means two distinct doubles never produce equal
// strings, and equal doubles always do.
// —————————————————————————

function hashFieldState() {
const F = H.Field;
const constraints = F.constraints || [];

// Per-constraint structural digest in field-array order (Field maintains
// deterministic order; we do not re-sort).
const cdigest = [];
for (let i = 0; i < constraints.length; i++) {
const c = constraints[i];
cdigest.push([
String(c.id || “”),
String(c.kind || “”),
(c.uses | 0),
(c.lastUsed | 0),
(typeof c.weight === “number” ? c.weight.toString() : “0”),
(typeof c.birth === “number” ? (c.birth | 0).toString() : “0”)
].join(”|”));
}

const subs = (F.subcascades || []).map(s => [
String(s.id || “”),
(s.namedCount | 0),
(typeof s.localDelta === “number” ? s.localDelta.toString() : “0”)
].join(”|”));

const payload = [
“slow_render=” + (F.slowDelta || 0).toString(),
“fast_render=” + (F.fastDelta || 0).toString(),
“scalar_render=” + (F.scalarDelta || 0).toString(),
“slow_exec=” + (F.execSlowDelta || 0).toString(),
“fast_exec=” + (F.execFastDelta || 0).toString(),
“scalar_exec=” + (F.execScalarDelta || 0).toString(),
“ratCount=” + (F.ratCount | 0),
“namedCount=” + (F.namedCount | 0),
“inputCount=” + (F.inputCount | 0),
“trace_len=” + ((H.Trace.entries || []).length | 0),
“constraints_n=” + cdigest.length,
“constraints=[” + cdigest.join(”,”) + “]”,
“subcascades_n=” + subs.length,
“subcascades=[” + subs.join(”,”) + “]”,
“recall_window=” + ((F.recallWindow || []).length | 0),
“recall_eventlog=” + ((F.recallEventLog || []).length | 0)
].join(”\n”);

return crypto.createHash(“sha256”).update(payload).digest(“hex”);
}

// Helper: assert two hashes differ with a useful failure message
function assertDistinct(h1, h2, ctx) {
if (h1 === h2) {
throw new Error(“F5 violation: “ + ctx + “ produced identical structural hash “ +
h1.slice(0, 16) + “…”);
}
}

// —————————————————————————
// 5.6.4: step counter strict monotonicity (F4)
//
// Subsidiary to F5 but load-bearing for the meaning of “trajectory” itself:
// if step does not advance, there is no trajectory to assert novelty over.
// Run this first as a smoke test that the harness is wired correctly.
// —————————————————————————

test(“5.6.4 step counter strictly monotonic across input stream (F4)”, async function () {
const rt = await H.setup();
const inputs = H.inputStreamRapid(100);
const snaps = await H.driveInputs(rt, inputs);
if (snaps.length === 0) throw new Error(“no snapshots produced”);

let prev = -1;
for (const s of snaps) {
if (s.step <= prev) {
throw new Error(“F4 violation: step did not advance: “ + prev + “ -> “ + s.step);
}
prev = s.step;
}
await H.teardown(rt);
});

// —————————————————————————
// 5.6.3: trace append-only (M5)
//
// Trace length must be monotonic non-decreasing across the run. The trace
// has a cap (CFG.TRACE_CAP); aging from the cap is excretion, not mid-run
// rewrite. If trace length ever regresses between consecutive snapshots
// outside of cap-aging boundaries, M5 is violated.
// —————————————————————————

test(“5.6.3 trace length monotonic non-decreasing (M5)”, async function () {
const rt = await H.setup();
const inputs = H.inputStreamRapid(100);
const snaps = await H.driveInputs(rt, inputs);

let prev = 0;
for (let i = 0; i < snaps.length; i++) {
const s = snaps[i];
if (s.traceEntryCount < prev) {
// Possible legitimate cause: trace cap aging shrinks the trace.
// The harness’s snapshot reads Trace.entries.length directly, so
// an aging event would show up here. In current implementation,
// aging is by archive (entries removed) rather than overflow drop;
// either way, M5 commits to append-only at the channel - the
// archive is itself preservation, not loss. So a regression here
// means the trace was rewritten mid-run, which is an M5 violation.
throw new Error(“M5 violation at i=” + i + “: trace length “ +
prev + “ -> “ + s.traceEntryCount);
}
prev = s.traceEntryCount;
}
await H.teardown(rt);
});

// —————————————————————————
// 5.6.2: slow-layer modulation drift (SE-03)
//
// Per SE-03, the slow-layer modulation accumulator (Field.slowMod) drifts
// permanently per contribution. Note this is a DIFFERENT quantity from
// slow-delta (which is the delta formula computed over the slow temporal
// window and CAN decrease as the field resolves). slowMod is the substrate
// modulation state SE-03 commits to permanence on; slowDelta is a derived
// reading.
//
// Test: across a positive-contribution input stream, slowMod must not
// regress between consecutive snapshots. SE-03 says permanent drift; the
// implementation’s slowMod accumulator must therefore be monotonic
// non-decreasing during operation. (Aging or decay of slowMod, were it to
// exist, would violate SE-03 directly.)
//
// We sample slowMod via a per-snapshot side-read on Field; the harness
// snapshot does not currently expose modulation state, but Field itself
// is read-accessible (per O1: read-only with respect to field is fine for
// observation infrastructure).
// —————————————————————————

test(“5.6.2 slow-layer modulation monotonic non-decreasing (SE-03)”, async function () {
const rt = await H.setup();
const inputs = H.inputStreamRapid(150);

const slowModTrajectory = [];
const initial = H.Field.slowMod;
slowModTrajectory.push(initial);

for (const inp of inputs) {
rt.ct.enqueueInput(inp);
await rt.ct.drainAll(8);
slowModTrajectory.push(H.Field.slowMod);
}

// Monotonic non-decreasing check. SE-03 permits no internal mechanism
// that decreases slowMod; if the trajectory regresses, SE-03 is violated.
let prev = slowModTrajectory[0];
for (let i = 1; i < slowModTrajectory.length; i++) {
const cur = slowModTrajectory[i];
if (cur < prev - 1e-12) {
throw new Error(“SE-03 violation at i=” + i + “: slowMod regressed “ +
prev.toString() + “ -> “ + cur.toString());
}
prev = cur;
}

// Verify slowMod actually moved across the run (otherwise the test
// is vacuous: no contributions occurred).
const final = slowModTrajectory[slowModTrajectory.length - 1];
if (Math.abs(final - initial) < 1e-12) {
throw new Error(“SE-03 not exercised: slowMod did not drift across “ +
inputs.length + “ inputs (” + initial + “ -> “ + final + “)”);
}
await H.teardown(rt);
});

// —————————————————————————
// 5.6.5: identical-input divergence (F5/SE-09 minimum case)
//
// The smallest positive demonstration of trajectory novelty: feed the same
// input twice in immediate succession. F5 says the resulting field states
// must differ. If this fails, the canon entries for F5 and SE-09 are
// making a claim the implementation does not support.
// —————————————————————————

test(“5.6.5 identical input twice produces distinct field states (F5/SE-09)”, async function () {
const rt = await H.setup();

rt.ct.enqueueInput(“alpha beta”);
await rt.ct.drainAll(8);
const h1 = hashFieldState();
const traceLen1 = (H.Trace.entries || []).length;

rt.ct.enqueueInput(“alpha beta”);
await rt.ct.drainAll(8);
const h2 = hashFieldState();
const traceLen2 = (H.Trace.entries || []).length;

assertDistinct(h1, h2, “identical input fed twice”);

// Subsidiary check: trace must have grown (M5 deposit during second input)
if (traceLen2 <= traceLen1) {
throw new Error(“M5 violation: trace did not grow under second observation event “ +
“(” + traceLen1 + “ -> “ + traceLen2 + “)”);
}

await H.teardown(rt);
});

// —————————————————————————
// 5.6.1: full N-iteration trajectory novelty (F5/SE-09 main test)
//
// The load-bearing test. Same input string fed N times in succession.
// Per F5, every iteration’s field state must be structurally distinct
// from every prior iteration’s. This is trajectory novelty in its
// strongest form: the architecture cannot produce a repeated field
// configuration even under repeated identical observation events.
//
// Implementation: hash field state after each input op (drain to
// completion first), accumulate hashes in a Map keyed by hash. Map
// size at end must equal N (one unique hash per iteration). First
// collision (if any) is reported with the prior-iteration index for
// triage.
//
// N is set conservatively. Larger N is more exhaustive but linearly
// more expensive. 200 is large enough to show non-trivial drift in
// the slow layer, accumulate meaningful constraint population growth,
// and exercise multiple cycles of the metabolism’s flow discipline.
// —————————————————————————

test(“5.6.1 N=200 repeating input produces no two identical field states (F5)”, async function () {
const rt = await H.setup();
const N = 200;
const seen = new Map();

for (let i = 0; i < N; i++) {
rt.ct.enqueueInput(“baseline”);
await rt.ct.drainAll(8);
const h = hashFieldState();
if (seen.has(h)) {
const priorIdx = seen.get(h);
throw new Error(“F5 violation at i=” + i + “: structural hash collides with i=” +
priorIdx + “ (hash “ + h.slice(0, 16) + “…)”);
}
seen.set(h, i);
}

if (seen.size !== N) {
throw new Error(“expected “ + N + “ unique hashes, got “ + seen.size);
}

await H.teardown(rt);
});

// —————————————————————————
// runner
// —————————————————————————

async function run() {
let pass = 0, fail = 0;
for (const t of tests) {
try {
await t.fn();
console.log(”  ok    “ + t.name);
pass += 1;
} catch (e) {
console.log(”  FAIL  “ + t.name);
console.log(”        “ + (e && e.stack || e));
fail += 1;
}
}
console.log(””);
console.log(pass + “/” + tests.length + “ tests passed”);
return { pass: pass, fail: fail, total: tests.length };
}

if (require.main === module) {
run().then(r => process.exit(r.fail === 0 ? 0 : 1));
}

module.exports = { run: run, hashFieldState: hashFieldState };