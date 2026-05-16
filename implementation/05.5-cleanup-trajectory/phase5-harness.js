// phase5-harness.js - Stress harness for Phase 5 coupling verification

"use strict";

const FieldModule = require("./field.js");
const CompilerModule = require("./constraint-compiler.js");
const ERengineModule = require("./er-engine.js");
const CTengineModule = require("./ct-engine.js");
const SurfaceModule = require("./reflexive-surface.js");
const StorageModule = require("./storage-adapter.js");

const Field = FieldModule.Field;
const Trace = FieldModule.Trace;
const OpsLog = FieldModule.OpsLog;
const CFG = FieldModule.CFG;

// ---------------------------------------------------------------------------
// setup(): fresh runtime
//
// Each test creates its own runtime. State is reset; engines are bound;
// storage adapter is opened. The caller may run the runtime, then call
// teardown() when finished.
//
// opts:
//   useStorage: bool (default true) - whether to bind a storage adapter
//   gpuSimulated: bool (default false) - currently a no-op; reserved for
//     future GPU-substrate testing harnesses
// ---------------------------------------------------------------------------

async function setup(opts) {
  opts = opts || {};
  Field.reset();
  Trace.clear();
  OpsLog.clear();

  const er = new ERengineModule.ERengine();
  er.state = "cpu-fallback";  // headless Node: CPU oracle only

  const ct = new CTengineModule.CTengine();
  ct.bind(er, CompilerModule);

  const surface = new SurfaceModule.ReflexiveSurface();

  let storage = null;
  if (opts.useStorage !== false) {
    storage = new StorageModule.StorageAdapter();
    await storage.open();
    ct.bindStorage(storage, StorageModule.PersistenceEligibility);
  }

  return { er: er, ct: ct, surface: surface, storage: storage };
}

async function teardown(rt) {
  if (rt.storage) {
    await rt.storage.clear();
    await rt.storage.close();
  }
}

// ---------------------------------------------------------------------------
// Input stream generators
//
// Each generator produces a sequence of input strings. Tests pick one
// based on what they want to stress.
// ---------------------------------------------------------------------------

// Rapid stream: many short inputs in fast succession
function inputStreamRapid(n) {
  const tokens = ["hello", "world", "alpha", "beta", "delta",
                  "gamma", "epsilon", "zeta", "eta", "theta"];
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = tokens[i % tokens.length];
    const b = tokens[(i * 3 + 1) % tokens.length];
    out.push(a + " " + b);
  }
  return out;
}

// Structured stream: includes char-class diversity to provoke
// predictive reaching across multiple shape predicates
function inputStreamStructured(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const phase = i % 5;
    if (phase === 0) out.push("plain alpha words");
    else if (phase === 1) out.push("digits 42 here");
    else if (phase === 2) out.push("symbols !@#$ included");
    else if (phase === 3) out.push("mixed alpha 99 !!");
    else out.push("trigger token recurrent");
  }
  return out;
}

// Divergence-inducing stream: same input repeated to settle render-
// scope, then a sudden burst of novel inputs to spike render-gap
// while exec-side has had time to settle.
function inputStreamDivergence(stableCount, burstCount) {
  const out = [];
  for (let i = 0; i < stableCount; i++) {
    out.push("steady predictable input pattern");
  }
  const novels = ["xyz123", "qq!! foreign", "9876 wild", "fresh #strange unseen"];
  for (let i = 0; i < burstCount; i++) {
    out.push(novels[i % novels.length] + " " + i);
  }
  return out;
}

// Recurring stream: small token vocabulary repeated with permutations.
// Designed to exercise compound formation and ratification under
// repeated exposure to similar shapes.
function inputStreamRecurring(n) {
  const A = ["red", "blue", "green"];
  const B = ["square", "circle", "triangle"];
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = A[i % A.length];
    const b = B[(i * 2) % B.length];
    out.push(a + " " + b);
  }
  return out;
}

// ---------------------------------------------------------------------------
// snapshot(): capture observable state at a moment in time
//
// Returns a plain object capturing what's measurable from outside the
// field. This is observation-only; nothing in the field is modified.
// ---------------------------------------------------------------------------

function snapshot(rt) {
  const constraints = Field.constraints || [];
  const byKind = Object.create(null);
  for (const c of constraints) byKind[c.kind] = (byKind[c.kind] || 0) + 1;

  const compounds = constraints.filter(c => c.kind === "compound");
  const promotedCompounds = compounds.filter(c => c.promoted);

  return {
    step: Field.step,
    inputCount: Field.inputCount,
    constraintCount: constraints.length,
    byKind: byKind,
    ratCount: Field.ratCount,
    namedCount: Field.namedCount,
    subcascadeCount: (Field.subcascades || []).length,
    compoundCount: compounds.length,
    promotedCompoundCount: promotedCompounds.length,
    delta: {
      scalar: Field.scalarDelta,
      fast: Field.fastDelta,
      slow: Field.slowDelta,
      gap: Field.gap
    },
    execDelta: {
      scalar: Field.execScalarDelta,
      fast: Field.execFastDelta,
      slow: Field.execSlowDelta,
      gap: Field.execGap
    },
    queue: {
      pending: (Field.ctPendingOps || []).length,
      committed: (Field.ctCommittedQueue || []).length,
      inFlight: Field.ctInFlightOp ? Field.ctInFlightOp.kind : null
    },
    recall: {
      windowSize: (Field.recallWindow || []).length,
      eventsTriggered: rt.ct.recallEventsTriggered || 0,
      matchesProduced: rt.ct.recallMatchesProduced || 0,
      eventLogLength: (Field.recallEventLog || []).length
    },
    surface: {
      totalEmitted: rt.surface.totalEmitted,
      bufferedClauses: (rt.surface.clauses || []).length
    },
    traceEntryCount: (Trace.entries || []).length
  };
}

// ---------------------------------------------------------------------------
// driveInputs(): submit inputs and drain the CT engine
//
// Submits each input via ct.enqueueInput, then drains the queue with a
// step cap. Returns array of per-input snapshots.
//
// Per-input cost: one input op plus any internal ops generated. The
// step cap protects against runaway queues (compound generation can
// cascade if poorly tuned).
// ---------------------------------------------------------------------------

async function driveInputs(rt, inputs, opts) {
  opts = opts || {};
  const observePerInput = opts.observePerInput !== false;
  const snapshots = [];

  for (const inp of inputs) {
    rt.ct.enqueueInput(inp);
    // Drain with bounded step count. CT engine processes one op per
    // step(). A normal input op may spawn 0-2 internal ops via prediction
    // generation or compound formation; stepCap of 8 per input is safe.
    await rt.ct.drainAll(opts.stepCap || 8);
    if (observePerInput) {
      try { rt.surface.observe(); } catch (e) { /* observation failure non-fatal */ }
      snapshots.push(snapshot(rt));
    }
  }
  return snapshots;
}

// ---------------------------------------------------------------------------
// driveOps(): submit non-input operations (tick, develop, promote, etc.)
//
// For tests that need to provoke specific internal operations.
// ---------------------------------------------------------------------------

async function driveOps(rt, opSpecs, opts) {
  opts = opts || {};
  const snapshots = [];
  for (const spec of opSpecs) {
    rt.ct.enqueueInternal(spec.kind, spec.payload || {});
    await rt.ct.drainAll(opts.stepCap || 4);
    if (opts.observePerOp !== false) {
      try { rt.surface.observe(); } catch (e) { /* */ }
      snapshots.push(snapshot(rt));
    }
  }
  return snapshots;
}

// ---------------------------------------------------------------------------
// Metric helpers - aggregate / extract from snapshot lists
// ---------------------------------------------------------------------------

function deltaTrajectory(snapshots) {
  return snapshots.map(s => ({
    step: s.step,
    scalar: s.delta.scalar,
    fast: s.delta.fast,
    slow: s.delta.slow,
    gap: s.delta.gap,
    execGap: s.execDelta.gap
  }));
}

function maxGap(snapshots) {
  return snapshots.reduce((m, s) => Math.max(m, s.delta.gap), 0);
}

function maxExecGap(snapshots) {
  return snapshots.reduce((m, s) => Math.max(m, s.execDelta.gap), 0);
}

function structuralEventCount(rt, kind) {
  if (!rt || !rt.surface || !rt.surface.clauses) return 0;
  return rt.surface.clauses.filter(c => c.kind === kind).length;
}

// ---------------------------------------------------------------------------
// assertInvariant(): runtime invariant check
//
// Tests use this to verify INVARIANTS.md commitments hold through the
// stress run. Returns { ok: bool, msg: string } - tests can decide
// whether to throw or accumulate.
// ---------------------------------------------------------------------------

function assertInvariant(rt, name, fn) {
  try {
    const result = fn(rt);
    if (result === true) return { ok: true, name: name };
    if (result && result.ok === true) return { ok: true, name: name };
    const msg = (result && result.msg) || "violated";
    return { ok: false, name: name, msg: msg };
  } catch (e) {
    return { ok: false, name: name, msg: "exception: " + (e && e.message || e) };
  }
}

// Specific invariant checks reused across tests
const Invariants = {
  // F1: seed permanent
  seedPermanent: function (rt) {
    const seeds = (Field.constraints || []).filter(c => c.kind === "seed");
    if (seeds.length !== 1) return { ok: false, msg: "expected 1 seed, got " + seeds.length };
    if (!seeds[0].permanent) return { ok: false, msg: "seed.permanent is not true" };
    return true;
  },
  // F4: indefinite operation - step monotonically increases
  stepMonotonic: function (rt, prevStep) {
    if (Field.step < prevStep) return { ok: false, msg: "step regressed " + prevStep + " -> " + Field.step };
    return true;
  },
  // I3: bounded everything - constraint count under cap
  constraintCap: function (rt) {
    const liveCap = CFG.FIELD_LIVE_CAP || 4096;
    const count = (Field.constraints || []).length;
    if (count > liveCap) return { ok: false, msg: "constraints " + count + " > cap " + liveCap };
    return true;
  },
  // I3: trace bounded
  traceBounded: function (rt) {
    const cap = CFG.TRACE_CAP || 16384;
    const len = (Trace.entries || []).length;
    if (len > cap * 1.1) return { ok: false, msg: "trace " + len + " > cap*1.1 " + (cap * 1.1) };
    return true;
  },
  // O1: surface observation does not modify constraints
  // (verified by snapshot diff around an observe() call)
  surfaceReadOnly: function (rt, beforeSnap) {
    const after = snapshot(rt);
    if (after.constraintCount !== beforeSnap.constraintCount) {
      return { ok: false, msg: "constraint count changed " + beforeSnap.constraintCount + " -> " + after.constraintCount };
    }
    if (after.ratCount !== beforeSnap.ratCount) {
      return { ok: false, msg: "ratCount changed " + beforeSnap.ratCount + " -> " + after.ratCount };
    }
    return true;
  },
  // S2: substrate equivalence (tested separately in 5f via direct CPU oracle vs ER engine evaluator)
  // S3: no command path between engines (tested via static source analysis in 5b/5c)
  noCommandPath: function (rt) {
    // Runtime-side check: ER engine's binding to CT engine should not exist.
    // CT binds to ER, not the other way.
    if (rt.er && rt.er.ctBinding) return { ok: false, msg: "ER engine has ctBinding (command path)" };
    return true;
  }
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  setup: setup,
  teardown: teardown,
  snapshot: snapshot,
  driveInputs: driveInputs,
  driveOps: driveOps,
  inputStreamRapid: inputStreamRapid,
  inputStreamStructured: inputStreamStructured,
  inputStreamDivergence: inputStreamDivergence,
  inputStreamRecurring: inputStreamRecurring,
  deltaTrajectory: deltaTrajectory,
  maxGap: maxGap,
  maxExecGap: maxExecGap,
  structuralEventCount: structuralEventCount,
  assertInvariant: assertInvariant,
  Invariants: Invariants,
  // Re-exports for convenience
  Field: Field,
  Trace: Trace,
  CFG: CFG
};
