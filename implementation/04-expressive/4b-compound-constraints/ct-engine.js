// ct-engine.js - Critical Thought engine (Phase 3)

(function (global) {
"use strict";

// Acquire dependencies. In browser context, FieldModule is on global.
// In Node test context, require it.
let FieldModule;
if (typeof require !== "undefined") {
  FieldModule = require("./field.js");
} else {
  FieldModule = global.FieldModule;
}
const Field = FieldModule.Field;
const Trace = FieldModule.Trace;
const OpsLog = FieldModule.OpsLog;
const CFG = FieldModule.CFG;
const Guards = FieldModule.Guards;

// ---------------------------------------------------------------------------
// Operation types
// ---------------------------------------------------------------------------
// Each operation is a record describing a sequential transaction. The CT
// engine processes them one at a time, with explicit commit semantics. An
// operation can be created from input (CTengine.enqueueInput), from a
// scheduled internal event (CTengine.enqueueInternal), or from a periodic
// scan that detects something needs to happen.

const OP_KIND = Object.freeze({
  INPUT:          "input",
  TICK:           "tick",
  DEVELOP:        "develop",
  CORRELATE:      "correlate",
  REASON:         "reason",
  PROMOTE:        "promote",
  EXEC_PREDICT:   "exec-predict",
  SNAPSHOT:       "snapshot",
  TRACE_FLUSH:    "trace-flush"
});

// ---------------------------------------------------------------------------
// Persistent storage adapter
// ---------------------------------------------------------------------------
// Phase 3 first iteration uses localStorage. Synchronous, small, and
// sufficient to exercise the persistence invariants. IndexedDB would be a
// later upgrade for larger field states or multi-tab coherence.

const PersistKeys = Object.freeze({
  FIELD:    "ct::field-snapshot::v3",
  TRACE:    "ct::trace::v3",
  STAMP:    "ct::stamp::v3"
});

const PersistAdapter = {
  available: function () {
    try {
      return typeof localStorage !== "undefined" && localStorage !== null;
    } catch (e) { return false; }
  },
  saveFieldSnapshot: function (json) {
    if (!this.available()) return false;
    try {
      localStorage.setItem(PersistKeys.FIELD, json);
      localStorage.setItem(PersistKeys.STAMP, String(Date.now()));
      return true;
    } catch (e) { return false; }
  },
  loadFieldSnapshot: function () {
    if (!this.available()) return null;
    try { return localStorage.getItem(PersistKeys.FIELD); }
    catch (e) { return null; }
  },
  appendTrace: function (entries) {
    if (!this.available() || !entries.length) return false;
    try {
      const existing = localStorage.getItem(PersistKeys.TRACE);
      let arr = [];
      if (existing) {
        try { arr = JSON.parse(existing); if (!Array.isArray(arr)) arr = []; }
        catch (e) { arr = []; }
      }
      for (const e of entries) arr.push(e);
      // Cap at TRACE_CAP * 4 in storage to prevent unbounded growth
      const cap = CFG.TRACE_CAP * 4;
      if (arr.length > cap) arr = arr.slice(arr.length - cap);
      localStorage.setItem(PersistKeys.TRACE, JSON.stringify(arr));
      return true;
    } catch (e) { return false; }
  },
  clearAll: function () {
    if (!this.available()) return;
    try {
      localStorage.removeItem(PersistKeys.FIELD);
      localStorage.removeItem(PersistKeys.TRACE);
      localStorage.removeItem(PersistKeys.STAMP);
    } catch (e) {}
  }
};

// ---------------------------------------------------------------------------
// CT engine
// ---------------------------------------------------------------------------

class CTengine {
  constructor() {
    this.running = false;
    this.opsExecuted = 0;
    this.predictionsGeneratedExec = 0;
    this.snapshotCount = 0;
    this.traceFlushCount = 0;
    // Reference to ER engine for compiling the field and reading match
    // results. NOT a command channel: the CT engine asks the ER engine
    // to evaluate the current field+input pair, which is the same as
    // saying "trigger a frame on this state and read the result". This
    // is one shared substrate (the field) being read by two substrates;
    // it is not a request/response protocol between engines.
    this.erBinding = null;
    // Compiler reference (host-injected, for compiling the field for ER)
    this.compilerBinding = null;
    // Last computed exec-scope vector-delta record
    this.lastExecVD = null;
    // Track ops-completed-window for fast exec-delta tracking
    this.recentExecOps = [];
  }

  // Bind the ER engine and constraint compiler. The host calls this
  // during initialization. The CT engine uses these to make the
  // field+input pair available to ER; it does not use them to send
  // commands.
  bind(erEngine, compilerModule) {
    this.erBinding = erEngine;
    this.compilerBinding = compilerModule;
  }

  // -------------------------------------------------------------------
  // OPERATION QUEUE
  // -------------------------------------------------------------------
  enqueueInput(text) {
    if (Field.ctPendingOps.length >= CFG.CT_OP_QUEUE_CAP) {
      // Backpressure: queue is saturated. Drop oldest INPUT ops to
      // preserve queue invariant. This is a SE-02 metabolism choice:
      // the field accepts only what it can metabolize.
      const idx = Field.ctPendingOps.findIndex(op => op.kind === OP_KIND.INPUT);
      if (idx >= 0) Field.ctPendingOps.splice(idx, 1);
      else Field.ctPendingOps.shift();
    }
    Field.ctPendingOps.push({
      kind: OP_KIND.INPUT,
      payload: { text: Guards.clampString(text, CFG.INPUT_MAX) },
      enqueuedAt: Field.step
    });
    Field.ctTotalOpsSeen++;
  }

  enqueueInternal(kind, payload) {
    if (Field.ctPendingOps.length >= CFG.CT_OP_QUEUE_CAP) {
      // Internal ops are not dropped; they are deferred. If queue is
      // saturated, enqueueInternal silently drops to maintain bound.
      // The exec-scope gap will rise, signaling the CT engine should
      // catch up.
      return false;
    }
    Field.ctPendingOps.push({
      kind: kind,
      payload: payload || {},
      enqueuedAt: Field.step
    });
    Field.ctTotalOpsSeen++;
    return true;
  }

  hasWork() {
    return Field.ctPendingOps.length > 0 || Field.ctInFlightOp !== null;
  }

  // -------------------------------------------------------------------
  // STEP: dequeue one op, execute it, commit it
  //
  // Per SE-06, the CT engine is sequential at execution scope. Each
  // step processes one operation through phases:
  //   1. dequeue: move from pending to in-flight
  //   2. execute: run the op, produce committed-but-not-persisted state
  //   3. commit: state in committed queue is observable in the field
  //
  // Note: persistence (snapshot, trace flush) is its own kind of op that
  // gets enqueued; it is not implicit in commit.
  // -------------------------------------------------------------------
  async step() {
    // Refresh exec-scope vector-delta at start of step
    Field.refreshExecVectorDelta();
    Field.updateExecSlowDelta(Field.execScalarDelta);
    const execBefore = {
      scalar: Field.execScalarDelta,
      fast: Field.execFastDelta,
      slow: Field.execSlowDelta,
      gap: Field.execGap
    };

    // Maybe generate exec-scope predictions BEFORE doing work,
    // if exec-gap signals reaching is appropriate
    if (Field.execGap > CFG.EXEC_GAP_PREDICT_THRESH && Field.ctPendingOps.length < 4) {
      this._generateExecPredictions();
    }

    if (Field.ctPendingOps.length === 0) {
      // No work; record idle observation in trace
      Trace.append("ct", "idle", { scalar: execBefore.scalar, fast: execBefore.fast,
                                    slow: execBefore.slow, gap: execBefore.gap },
                   "queue empty");
      return null;
    }

    // Dequeue
    const op = Field.ctPendingOps.shift();
    Field.ctInFlightOp = op;

    Trace.append("ct", "op-begin", execBefore, op.kind + " (queue=" + Field.ctPendingOps.length + ")");

    // Execute
    let result = null;
    try {
      result = await this._executeOp(op);
    } catch (e) {
      // Op failed; record and continue
      Trace.append("ct", "op-failed", execBefore, op.kind + ": " + (e && e.message || e));
      Field.ctInFlightOp = null;
      return { kind: op.kind, ok: false, error: String(e && e.message || e) };
    }

    // Commit (move from in-flight to committed queue)
    Field.ctInFlightOp = null;
    Field.ctOpsCompleted++;
    this.opsExecuted++;
    Field.ctCommittedQueue.push({ kind: op.kind, atStep: Field.step, result: result });
    while (Field.ctCommittedQueue.length > 32) Field.ctCommittedQueue.shift();

    // Track for fast-exec-delta
    this.recentExecOps.push({ step: Field.step, kind: op.kind });
    while (this.recentExecOps.length > CFG.FAST_WINDOW) this.recentExecOps.shift();

    // Refresh exec-scope vector-delta after committing
    Field.refreshExecVectorDelta();

    // Periodic snapshot and trace flush enqueueing
    this._maybeSchedulePersistence();

    return { kind: op.kind, ok: true, result: result };
  }

  // Run all pending ops to completion (used in tests; the host's frame
  // loop calls step() once per frame instead).
  async drainAll(maxOps) {
    maxOps = maxOps || 1000;
    let count = 0;
    while (this.hasWork() && count < maxOps) {
      await this.step();
      count++;
    }
    return count;
  }

  // -------------------------------------------------------------------
  // OPERATION EXECUTION
  // -------------------------------------------------------------------
  async _executeOp(op) {
    switch (op.kind) {
      case OP_KIND.INPUT:        return await this._opInput(op.payload.text);
      case OP_KIND.TICK:         return this._opTick();
      case OP_KIND.DEVELOP:      return this._opDevelop();
      case OP_KIND.CORRELATE:    return this._opCorrelate();
      case OP_KIND.REASON:       return this._opReason();
      case OP_KIND.PROMOTE:      return this._opPromote();
      case OP_KIND.EXEC_PREDICT: return this._opExecPredict(op.payload);
      case OP_KIND.SNAPSHOT:     return this._opSnapshot();
      case OP_KIND.TRACE_FLUSH:  return this._opTraceFlush();
      default:                   throw new Error("unknown op kind: " + op.kind);
    }
  }

  // Input op: full Phase 2 process loop, but as a CT operation. Compiles
  // the field, dispatches to ER engine, reads back match results, then
  // runs sequential post-match logic.
  async _opInput(input) {
    if (!input || !input.trim()) return { skipped: true };
    Field.step++;
    Field.inputCount++;
    const named = Field.detectNames(input);
    const wasNamed = named.length > 0;
    if (wasNamed) {
      Field.namedCount++;
      for (const sc of named) { sc.namedCount++; sc.lastNamed = Field.step; }
    }
    Field.refreshVectorDelta();
    const vBefore = {
      scalar: Field.scalarDelta, fast: Field.fastDelta,
      slow: Field.slowDelta, gap: Field.gap
    };
    Trace.append("ct", "input-begin", vBefore, "input: " + Guards.clampString(input, 60));

    // Dispatch to ER engine for parallel resolution
    if (!this.erBinding || !this.compilerBinding) {
      throw new Error("CT engine: erBinding or compilerBinding not set");
    }
    const compiled = this.compilerBinding.compileField(Field.constraints);
    const inputRec = this.compilerBinding.computeInputRecord(input, compiled.tokenTable);
    const matchArr = await this.erBinding.evaluateAsync(compiled, inputRec);
    Trace.append("er", "eval", vBefore,
      "n=" + Field.constraints.length + " in " + this.erBinding.lastDispatchMS.toFixed(2) + "ms",
      "frame");

    // Process match results sequentially (CT-side post-match)
    const matched = [];
    for (let i = 1; i < matchArr.length; i++) if (matchArr[i] === 1) matched.push(i);

    // Phase 4b: evaluate compound constraints CPU-side. Compounds are
    // not in the ER engine's instruction stream because their exec-side
    // predicate references CT-engine state. They match here, after
    // render-side resolution, and merge into the matched set so they
    // contribute to selection, fidelity, and surface observation the
    // same way other constraints do.
    const compoundMatched = Field.evaluateCompounds(input);
    if (compoundMatched.length) {
      for (const idx of compoundMatched) {
        if (matched.indexOf(idx) === -1) matched.push(idx);
      }
      Trace.append("ct", "compound-matched", vBefore,
        "+" + compoundMatched.length + " compound(s)");
    }

    const novelty = Field.constraints.length <= 1
      ? 1.0
      : 1.0 - (matched.length / (Field.constraints.length - 1));
    const evalResult = { matched: matched, novelty: Guards.clamp01(novelty) };

    const chosen = Field.selectFromMatches(matched, named);
    const chosenIndices = chosen.map(c => c.idx);

    // Ratify matched predictions
    const ratified = [];
    for (const idx of matched) {
      const c = Field.constraints[idx];
      if (c && c.kind === "predictive" && Field.ratify(idx)) ratified.push(c);
    }
    if (ratified.length) {
      Trace.append("ct", "ratification", vBefore, "ratified " + ratified.length, "ratified");
    }

    // Generate derived constraints from novelty
    const generated = Field.generate(input, evalResult);
    if (generated.length) {
      Field.integrate(generated);
      Trace.append("ct", "generated", vBefore, "+" + generated.length + " derived");
    }

    // Update correlations from co-firing
    if (chosenIndices.length >= 2) Field.updateCorrelations(chosenIndices);
    Field.markUsed(chosenIndices);
    const touched = chosenIndices
      .map(i => Field.constraints[i] && Field.constraints[i].id)
      .filter(Boolean);
    Field.recordOp("input", touched);

    // Refresh render-scope delta after generation/marking
    Field.refreshVectorDelta();
    Field.updateSlowDelta(Field.scalarDelta);
    Field.refreshVectorDelta();
    let vAfter = {
      scalar: Field.scalarDelta, fast: Field.fastDelta,
      slow: Field.slowDelta, gap: Field.gap
    };

    // Naming bias to render-scope delta
    if (wasNamed) {
      const bonus = Math.min(0.4, CFG.NAMING_DELTA_DROP * named.length);
      vAfter.scalar = Math.max(0, vAfter.scalar - bonus);
      Field.scalarDelta = vAfter.scalar;
      Trace.append("ct", "naming-bias", vAfter, "-" + bonus.toFixed(3));
    }

    Field.modulate();
    const absDrop = vBefore.scalar - vAfter.scalar;
    const relDrop = vBefore.scalar > 0.001 ? absDrop / vBefore.scalar : 0;
    Field.recordFidelity(chosenIndices, relDrop);

    // Phase 4b: record compound fidelity for compounds that matched
    // this input. Same observation (relDrop) gets attributed to compounds
    // that contributed; sustained drops promote them.
    if (compoundMatched.length) {
      Field.recordCompoundFidelity(compoundMatched, relDrop);
    }

    Field.reinforceNaming(wasNamed);

    // Phase 4b: snapshot generation history for compound generation
    // triggers. This must happen AFTER ratification, naming, and delta
    // refresh so the snapshot reflects the full post-input state.
    Field.recordCompoundGenerationSnapshot();

    // Phase 4b: detect coincidence triggers and generate compounds
    const compounds = Field.generateCompounds(input);
    if (compounds.length) {
      Field.integrate(compounds);
      Trace.append("ct", "compounds-formed", vAfter,
        "+" + compounds.length + " compound(s)");
    }

    // Phase 4b: check for compound promotions
    const promotedCompounds = Field.checkCompoundPromotions();
    if (promotedCompounds.length) {
      Trace.append("ct", "compounds-promoted", vAfter,
        "+" + promotedCompounds.length + " promoted");
    }

    // Render-scope predictive generation (still done CT-side because
    // prediction is shape-derivative; per IMPLEMENTATION_PATH this is
    // CPU-side, which means the CT engine does it)
    const predictions = Field.generatePredictions();
    if (predictions.length) {
      Field.integrate(predictions);
      Trace.append("ct", "predictions-generated", vAfter,
        "+" + predictions.length + " predictive (gap=" + vAfter.gap.toFixed(3) + ")",
        "predicted");
    }
    const evicted = Field.evictStalePredictions();
    if (evicted.length) {
      Trace.append("ct", "predictions-evicted", vAfter, "-" + evicted.length + " aged out");
    }

    Trace.append("ct", "input-commit", vAfter,
      "chosen=" + chosen.length + " gen=" + generated.length + " rat=" + ratified.length);

    return {
      input: input,
      chosen: chosen.length,
      generated: generated.length,
      predictions: predictions.length,
      ratified: ratified.length,
      named: named.map(s => s.name),
      vBefore: vBefore,
      vAfter: vAfter
    };
  }

  _opTick() {
    Field.step++;
    Field.refreshVectorDelta();
    Field.updateSlowDelta(Field.scalarDelta);
    Field.refreshVectorDelta();
    Field.modulate();
    const preds = Field.generatePredictions();
    if (preds.length) {
      Field.integrate(preds);
      Trace.append("ct", "tick-predictions", null, "+" + preds.length + " predictive", "predicted");
    }
    Field.evictStalePredictions();
    Trace.append("ct", "tick", null, "idle advance");
    return { step: Field.step };
  }

  _opDevelop() {
    const produced = Field.developPatterns();
    Field.refreshVectorDelta();
    Trace.append("ct", "develop", null, "+" + produced.length + " meta");
    OpsLog.append("DEVELOP", produced.length === 0
      ? "no new patterns"
      : "produced " + produced.length + " meta");
    return { count: produced.length };
  }

  _opCorrelate() {
    const top = Field.topCorrelations(15);
    Trace.append("ct", "correlate-inspect", null, top.length + " top pairs");
    OpsLog.append("CORRELATE", top.length === 0 ? "none" : "top " + top.length + " inspected");
    return { count: top.length };
  }

  _opReason() {
    const f = Field.reason();
    Trace.append("ct", "reason", null, f.length + " findings");
    for (let i = 0; i < f.length && i < 4; i++) OpsLog.append("REASON", f[i].text);
    if (f.length === 0) OpsLog.append("REASON", "no findings");
    return { count: f.length, findings: f };
  }

  _opPromote() {
    const p = Field.checkPromotions();
    Trace.append("ct", "check-promotions", null, p.length === 0 ? "none" : "+" + p.length);
    if (p.length === 0) {
      OpsLog.append("PROMOTE", "no families met threshold");
    } else {
      for (const sc of p) {
        OpsLog.append("PROMOTE",
          "'" + sc.name + "' (" + sc.familyType + ") fid=" + sc.fidAtBirth.toFixed(3));
      }
    }
    return { count: p.length, promoted: p.map(sc => sc.name) };
  }

  // ----------------------------------------------------------
  // EXECUTION-SCOPE PREDICTIVE GENERATION
  //
  // When execution-scope gap is high, the CT engine reaches:
  // it generates operations it expects to need in upcoming steps.
  //
  // Examples:
  // - If ratification rate is high and pending queue is shrinking,
  //   schedule a TICK to keep the field metabolizing
  // - If recent ops show repeated INPUTs but no DEVELOP, schedule
  //   a DEVELOP to consolidate
  // - If exec-gap is high but render-gap is low, the CT engine
  //   has lagged behind the rendering substrate; schedule REASON
  //   to inspect what state the divergence reflects
  //
  // These are predictions in the SE-05 sense: constraint-shaped
  // candidates for closure, generated when a gap opens. They get
  // ratified when the predicted op is what actually happens next,
  // or aged out and discarded if not.
  // ----------------------------------------------------------
  _generateExecPredictions() {
    if (this.recentExecOps.length < 4) return;

    // Heuristic 1: if last 4+ ops were INPUTs without DEVELOP/CORRELATE,
    // predict that DEVELOP would close exec-gap
    const lastFour = this.recentExecOps.slice(-4);
    const allInputs = lastFour.every(op => op.kind === OP_KIND.INPUT);
    if (allInputs && !Field.ctPendingOps.some(op => op.kind === OP_KIND.DEVELOP)) {
      this.enqueueInternal(OP_KIND.DEVELOP, { source: "exec-predict" });
      this.predictionsGeneratedExec++;
      Trace.append("ct", "exec-predict", null, "predicting DEVELOP (4 inputs without consolidation)");
      return;
    }

    // Heuristic 2: if exec-gap is high and queue is empty, predict TICK
    if (Field.ctPendingOps.length === 0 && Field.execGap > CFG.EXEC_GAP_PREDICT_THRESH * 1.5) {
      this.enqueueInternal(OP_KIND.TICK, { source: "exec-predict" });
      this.predictionsGeneratedExec++;
      Trace.append("ct", "exec-predict", null, "predicting TICK (high exec-gap, idle queue)");
      return;
    }

    // Heuristic 3: if many constraints exist but no recent PROMOTE check,
    // predict PROMOTE
    const lastPromote = this.recentExecOps.findIndex(op => op.kind === OP_KIND.PROMOTE);
    if (lastPromote === -1 && Field.constraints.length > 10
        && Object.keys(Field.familyFidelity).length > 0
        && !Field.ctPendingOps.some(op => op.kind === OP_KIND.PROMOTE)) {
      this.enqueueInternal(OP_KIND.PROMOTE, { source: "exec-predict" });
      this.predictionsGeneratedExec++;
      Trace.append("ct", "exec-predict", null, "predicting PROMOTE (untested fidelity)");
    }
  }

  _opExecPredict(payload) {
    // No-op: exec-predict is a marker op recording that prediction
    // happened. The actual prediction work runs at the start of step().
    return { source: payload && payload.source };
  }

  _opSnapshot() {
    const json = Field.serialize();
    const ok = PersistAdapter.saveFieldSnapshot(json);
    if (ok) {
      this.snapshotCount++;
      Field.ctLastSnapshotStep = Field.step;
      Trace.append("ct", "snapshot", null, "field state persisted (" + json.length + " bytes)");
    } else {
      Trace.append("ct", "snapshot-failed", null, "no persistent storage available");
    }
    return { ok: ok, bytes: json.length };
  }

  _opTraceFlush() {
    const unflushed = Trace.unflushed();
    if (unflushed.length === 0) return { flushed: 0 };
    const ok = PersistAdapter.appendTrace(unflushed);
    if (ok) {
      Trace.markFlushed();
      this.traceFlushCount++;
    }
    return { flushed: unflushed.length, ok: ok };
  }

  // ----------------------------------------------------------
  // PERSISTENCE SCHEDULING
  //
  // After every committed op, the CT engine checks whether
  // persistence work needs scheduling. Snapshots happen at
  // CT_SNAPSHOT_INTERVAL steps; trace flushes when accumulated
  // entries exceed CT_TRACE_FLUSH_INTERVAL.
  //
  // Per SE-06: the CT engine is responsible for state durability.
  // The ER engine is in-memory only; a frame's results are not
  // persisted unless the CT engine commits them.
  // ----------------------------------------------------------
  _maybeSchedulePersistence() {
    if (!PersistAdapter.available()) return;

    const stepsSinceSnapshot = Field.step - Field.ctLastSnapshotStep;
    if (stepsSinceSnapshot >= CFG.CT_SNAPSHOT_INTERVAL
        && !Field.ctPendingOps.some(op => op.kind === OP_KIND.SNAPSHOT)
        && (!Field.ctInFlightOp || Field.ctInFlightOp.kind !== OP_KIND.SNAPSHOT)) {
      this.enqueueInternal(OP_KIND.SNAPSHOT, {});
    }

    const unflushed = Trace.unflushed().length;
    if (unflushed >= CFG.CT_TRACE_FLUSH_INTERVAL
        && !Field.ctPendingOps.some(op => op.kind === OP_KIND.TRACE_FLUSH)
        && (!Field.ctInFlightOp || Field.ctInFlightOp.kind !== OP_KIND.TRACE_FLUSH)) {
      this.enqueueInternal(OP_KIND.TRACE_FLUSH, {});
    }
  }

  // ----------------------------------------------------------
  // STARTUP RESTORE
  //
  // On host initialization, the CT engine attempts to restore
  // the field state from the most recent snapshot. If no
  // snapshot exists, the field starts seed-only.
  // ----------------------------------------------------------
  restoreFromSnapshot() {
    const json = PersistAdapter.loadFieldSnapshot();
    if (!json) return false;
    const ok = Field.deserialize(json);
    if (ok) {
      Trace.append("ct", "restore", null,
        "restored field at step " + Field.step + " (" + Field.constraints.length + " constraints)");
    } else {
      Trace.append("ct", "restore-failed", null, "snapshot data invalid; starting fresh");
      Field.reset();
    }
    return ok;
  }

  // Force-clear all persisted state (called by RESET button)
  clearPersistence() {
    PersistAdapter.clearAll();
    Trace.append("ct", "persistence-cleared", null, "all snapshots and trace removed");
  }

  // Stats for UI
  getStats() {
    return {
      opsExecuted: this.opsExecuted,
      predictionsExec: this.predictionsGeneratedExec,
      snapshots: this.snapshotCount,
      traceFlushes: this.traceFlushCount,
      pending: Field.ctPendingOps.length,
      inFlight: Field.ctInFlightOp ? Field.ctInFlightOp.kind : null,
      committed: Field.ctCommittedQueue.length,
      execScalar: Field.execScalarDelta,
      execGap: Field.execGap,
      persistAvailable: PersistAdapter.available()
    };
  }
}

const CTengineModule = Object.freeze({
  CTengine: CTengine,
  OP_KIND: OP_KIND,
  PersistAdapter: PersistAdapter,
  PersistKeys: PersistKeys
});

if (typeof module !== "undefined" && module.exports) {
  module.exports = CTengineModule;
} else {
  global.CTengineModule = CTengineModule;
}

})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));
