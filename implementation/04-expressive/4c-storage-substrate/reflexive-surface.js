// reflexive-surface.js - Reflexive surface (Phase 4a)

(function (global) {
"use strict";

let FieldModule;
if (typeof require !== "undefined") {
  FieldModule = require("./field.js");
} else {
  FieldModule = global.FieldModule;
}
const Field = FieldModule.Field;
const CFG = FieldModule.CFG;
const Guards = FieldModule.Guards;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const SURFACE_CFG = Object.freeze({
  CLAUSE_CAP: 64,
  GAP_SETTLED_THRESHOLD: 0.10,        // gap below this => settled
  DIVERGENCE_THRESHOLD: 0.25,          // |execGap - renderGap| above => diverged
  REACHING_MIN_PREDICTIONS: 1,         // min new predictions for "reaching" clause
  STRUCTURAL_VERBS: Object.freeze([
    "formed", "landed", "named", "settled", "diverged",
    "reaching", "consolidated"
  ])
});

// Clause kinds (closed enumeration)
const CLAUSE_KIND = Object.freeze({
  FORMED:        "formed",         // new meta-constraint or compound
  LANDED:        "landed",         // predictive ratified
  NAMED:         "named",          // sub-cascade addressed
  CONSOLIDATED:  "consolidated",   // family promoted to sub-cascade
  SETTLED:       "settled",        // gap fell below threshold
  DIVERGED:      "diverged",       // exec-render gap crossed threshold
  REACHING:      "reaching",       // new predictive constraints
  // Phase 4c: recall observations
  RECALLED:      "recalled",       // persisted record matched current input
  RE_ENCOUNTERED: "re-encountered" // multiple recall events for same record
});

// ---------------------------------------------------------------------------
// ReflexiveSurface
// ---------------------------------------------------------------------------

class ReflexiveSurface {
  constructor() {
    // Bounded clause buffer
    this.clauses = [];
    this.totalEmitted = 0;
    // Snapshot of field state from last observation, for diff
    this.snapshot = null;
    // Whether the surface has been initialized (first observe() call)
    this.initialized = false;
  }

  // -------------------------------------------------------------------
  // CORE API: observe()
  //
  // Read field state, compare to snapshot, emit clauses for transitions.
  // Update snapshot. Read-only with respect to Field (O1).
  // -------------------------------------------------------------------
  observe() {
    if (!this.initialized) {
      // First observation: capture baseline, emit no clauses
      this._takeSnapshot();
      this.initialized = true;
      return [];
    }

    const emittedThisObserve = [];
    const cur = this._currentState();
    const prev = this.snapshot;

    // Detect each transition kind
    const formedClauses = this._detectFormed(prev, cur);
    const landedClauses = this._detectLanded(prev, cur);
    const namedClauses = this._detectNamed(prev, cur);
    const consolidatedClauses = this._detectConsolidated(prev, cur);
    const settledClauses = this._detectSettled(prev, cur);
    const divergedClauses = this._detectDiverged(prev, cur);
    const reachingClauses = this._detectReaching(prev, cur);
    // Phase 4c: recall events
    const recalledClauses = this._detectRecalled(prev, cur);
    const reEncounteredClauses = this._detectReEncountered(prev, cur);

    // Combine in fixed order so the same observation always produces
    // the same clause sequence
    const all = formedClauses
      .concat(landedClauses)
      .concat(namedClauses)
      .concat(consolidatedClauses)
      .concat(reachingClauses)
      .concat(recalledClauses)
      .concat(reEncounteredClauses)
      .concat(settledClauses)
      .concat(divergedClauses);

    // Emit each
    for (const clause of all) {
      this._emit(clause);
      emittedThisObserve.push(clause);
    }

    // Update snapshot for next observation
    this._takeSnapshot();

    return emittedThisObserve;
  }

  // -------------------------------------------------------------------
  // STATE SNAPSHOT
  //
  // Captures the structural-quantity state the surface uses for
  // diffing. This is a READ of Field; never writes back.
  // -------------------------------------------------------------------
  _currentState() {
    let metaCount = 0, compoundCount = 0;
    let predictiveCount = 0;
    const constraintIds = Object.create(null);
    for (const c of Field.constraints) {
      constraintIds[c.id] = c.kind;
      if (c.kind === "meta") metaCount += 1;
      if (c.kind === "compound") compoundCount += 1;
      if (c.kind === "predictive") predictiveCount += 1;
    }
    const subcascadeIds = Object.create(null);
    const subcascadeNamedCounts = Object.create(null);
    for (const sc of Field.subcascades) {
      subcascadeIds[sc.id] = sc.name;
      subcascadeNamedCounts[sc.id] = sc.namedCount;
    }
    return {
      step: Field.step,
      ratCount: Field.ratCount,
      namedCount: Field.namedCount,
      metaCount: metaCount,
      compoundCount: compoundCount,
      predictiveCount: predictiveCount,
      subcascadeCount: Field.subcascades.length,
      subcascadeIds: subcascadeIds,
      subcascadeNamedCounts: subcascadeNamedCounts,
      constraintIds: constraintIds,
      gap: Field.gap,
      execGap: Field.execGap,
      gapMinusExecGap: Field.gap - Field.execGap,
      // Phase 4c: track recall events. recallEventLogLength is the
      // length at snapshot time; new events between snapshots are at
      // indices >= prev snapshot's length.
      recallEventLogLength: (Field.recallEventLog || []).length,
      // Per-id recall counts for re-encounter detection
      recallCountsById: this._buildRecallCounts()
    };
  }

  _buildRecallCounts() {
    const counts = Object.create(null);
    if (!Field.recallEventLog) return counts;
    for (const ev of Field.recallEventLog) {
      if (ev.payload && ev.payload.id) {
        counts[ev.payload.id] = (counts[ev.payload.id] || 0) + 1;
      }
    }
    return counts;
  }

  _takeSnapshot() {
    this.snapshot = this._currentState();
  }

  // -------------------------------------------------------------------
  // TRANSITION DETECTORS
  //
  // Each detector reads prev and cur snapshots, identifies a specific
  // transition, and returns clause descriptors. Pure functions of the
  // two snapshots; no Field writes.
  // -------------------------------------------------------------------

  // FORMED: meta-constraint or compound count increased
  _detectFormed(prev, cur) {
    const out = [];
    // Find newly-appearing meta or compound constraints
    for (const c of Field.constraints) {
      if (c.kind !== "meta" && c.kind !== "compound") continue;
      if (prev.constraintIds[c.id]) continue;  // existed before
      // Newly formed
      let text;
      if (c.kind === "meta") {
        const metaKind = c.metaKind || "meta";
        const desc = c.desc || c.id;
        text = "structure formed: " + metaKind + " - " +
               Guards.clampString(desc, 80);
      } else {
        // compound (Phase 4b will add this kind)
        text = "structure formed: compound - " +
               Guards.clampString(c.desc || c.id, 80);
      }
      out.push({
        kind: CLAUSE_KIND.FORMED,
        text: text,
        evidence: { constraintId: c.id, refs: c.refs ? c.refs.slice() : null }
      });
    }
    return out;
  }

  // LANDED: ratCount increased; identify which constraints transitioned
  // from predictive to ratified
  _detectLanded(prev, cur) {
    const out = [];
    if (cur.ratCount <= prev.ratCount) return out;
    // Identify ratified constraints whose previous kind in snapshot
    // was "predictive" but current kind is "ratified"
    for (const c of Field.constraints) {
      if (c.kind !== "ratified") continue;
      if (prev.constraintIds[c.id] !== "predictive") continue;
      out.push({
        kind: CLAUSE_KIND.LANDED,
        text: "reach landed: " + Guards.clampString(c.desc || c.id, 100),
        evidence: { constraintId: c.id }
      });
    }
    return out;
  }

  // NAMED: a sub-cascade's namedCount increased
  _detectNamed(prev, cur) {
    const out = [];
    for (const sc of Field.subcascades) {
      const prevCount = prev.subcascadeNamedCounts[sc.id] || 0;
      if (sc.namedCount > prevCount) {
        const delta = sc.namedCount - prevCount;
        out.push({
          kind: CLAUSE_KIND.NAMED,
          text: "named: '" + sc.name + "' addressed" +
                (delta > 1 ? " (x" + delta + ")" : ""),
          evidence: { subcascadeId: sc.id, name: sc.name, delta: delta }
        });
      }
    }
    return out;
  }

  // CONSOLIDATED: a sub-cascade emerged that did not exist in prev
  _detectConsolidated(prev, cur) {
    const out = [];
    for (const sc of Field.subcascades) {
      if (prev.subcascadeIds[sc.id]) continue;
      out.push({
        kind: CLAUSE_KIND.CONSOLIDATED,
        text: "consolidated: " + sc.familyType + " family promoted to '" +
              sc.name + "' (fid=" + sc.fidAtBirth.toFixed(3) + ")",
        evidence: {
          subcascadeId: sc.id,
          name: sc.name,
          familyType: sc.familyType
        }
      });
    }
    return out;
  }

  // SETTLED: gap was above threshold, now below
  _detectSettled(prev, cur) {
    const out = [];
    const wasAbove = prev.gap >= SURFACE_CFG.GAP_SETTLED_THRESHOLD;
    const isBelow = cur.gap < SURFACE_CFG.GAP_SETTLED_THRESHOLD;
    if (wasAbove && isBelow) {
      out.push({
        kind: CLAUSE_KIND.SETTLED,
        text: "settled: render-gap " + prev.gap.toFixed(3) +
              " -> " + cur.gap.toFixed(3),
        evidence: { prevGap: prev.gap, curGap: cur.gap }
      });
    }
    return out;
  }

  // DIVERGED: |execGap - renderGap| crossed threshold (was below, now above)
  _detectDiverged(prev, cur) {
    const out = [];
    const prevDiff = Math.abs(prev.gap - prev.execGap);
    const curDiff = Math.abs(cur.gap - cur.execGap);
    const wasBelow = prevDiff < SURFACE_CFG.DIVERGENCE_THRESHOLD;
    const isAbove = curDiff >= SURFACE_CFG.DIVERGENCE_THRESHOLD;
    if (wasBelow && isAbove) {
      const direction = cur.execGap > cur.gap
        ? "exec-scope ahead of render-scope"
        : "render-scope ahead of exec-scope";
      out.push({
        kind: CLAUSE_KIND.DIVERGED,
        text: "diverged: " + direction + " (gap-diff=" + curDiff.toFixed(3) + ")",
        evidence: {
          renderGap: cur.gap,
          execGap: cur.execGap,
          diff: curDiff
        }
      });
    }
    return out;
  }

  // REACHING: predictive constraint count increased
  _detectReaching(prev, cur) {
    const out = [];
    const delta = cur.predictiveCount - prev.predictiveCount;
    if (delta >= SURFACE_CFG.REACHING_MIN_PREDICTIONS) {
      // Find newly-appearing predictive constraints to source vocabulary
      const newPredictives = [];
      for (const c of Field.constraints) {
        if (c.kind !== "predictive") continue;
        if (prev.constraintIds[c.id] === "predictive") continue;
        newPredictives.push(c);
      }
      // Only emit if we found new predictives matching the count delta
      if (newPredictives.length > 0) {
        const target = newPredictives[0].pattern && newPredictives[0].pattern.cls
          ? newPredictives[0].pattern.cls
          : (newPredictives[0].pattern && newPredictives[0].pattern.token
              ? newPredictives[0].pattern.token
              : "structure");
        const more = newPredictives.length > 1
          ? " (+" + (newPredictives.length - 1) + " more)"
          : "";
        out.push({
          kind: CLAUSE_KIND.REACHING,
          text: "reaching: toward " + target + more +
                ", gap=" + cur.gap.toFixed(3),
          evidence: {
            predictiveCount: cur.predictiveCount,
            target: target,
            count: newPredictives.length
          }
        });
      }
    }
    return out;
  }

  // RECALLED: new entries appeared in Field.recallEventLog
  // Per Phase 4c: when a persisted record matched current input, the
  // CT engine appended an event to recallEventLog. Surface emits a
  // clause for each new event.
  _detectRecalled(prev, cur) {
    const out = [];
    if (!Field || !Field.recallEventLog) return out;
    const log = Field.recallEventLog;
    const prevLen = prev.recallEventLogLength || 0;
    const curLen = cur.recallEventLogLength || 0;
    if (curLen <= prevLen) return out;
    // Determine the slice of new events. recallEventLog is bounded
    // (RECALL_EVENT_LOG_CAP), so events may have shifted out. The
    // safe approach: read events from index max(0, curLen - delta)
    // forward, where delta is curLen - prevLen.
    const delta = curLen - prevLen;
    const startIdx = Math.max(0, log.length - delta);
    for (let i = startIdx; i < log.length; i += 1) {
      const ev = log[i];
      if (ev.kind !== "recalled") continue;
      const desc = (ev.payload && ev.payload.desc) || ev.payload.id || "(unnamed)";
      const successCount = ev.payload && ev.payload.recallSuccessCount;
      const text = "recalled: " +
        Guards.clampString(desc, 80) +
        (successCount > 1 ? " (recall #" + successCount + ")" : "");
      out.push({
        kind: CLAUSE_KIND.RECALLED,
        text: text,
        evidence: {
          recordId: ev.payload && ev.payload.id,
          originalKind: ev.payload && ev.payload.originalKind,
          recallSuccessCount: successCount,
          persistedAt: ev.payload && ev.payload.persistedAt
        }
      });
    }
    return out;
  }

  // RE-ENCOUNTERED: same record has been recalled multiple times
  // across observations. We detect this as: a record id whose
  // recall count went from < 2 to >= 2 in the snapshot diff.
  _detectReEncountered(prev, cur) {
    const out = [];
    const prevCounts = (prev && prev.recallCountsById) || Object.create(null);
    const curCounts = cur.recallCountsById || Object.create(null);
    for (const id of Object.keys(curCounts)) {
      const before = prevCounts[id] || 0;
      const now = curCounts[id];
      if (before < 2 && now >= 2) {
        out.push({
          kind: CLAUSE_KIND.RE_ENCOUNTERED,
          text: "re-encountered: " + id + " has surfaced " + now + " times",
          evidence: { recordId: id, count: now }
        });
      }
    }
    return out;
  }

  // -------------------------------------------------------------------
  // EMIT
  // -------------------------------------------------------------------
  _emit(clause) {
    const stamped = Object.assign({}, clause, {
      step: Field.step,
      seq: this.totalEmitted
    });
    this.clauses.push(stamped);
    this.totalEmitted += 1;
    while (this.clauses.length > SURFACE_CFG.CLAUSE_CAP) {
      this.clauses.shift();
    }
  }

  // -------------------------------------------------------------------
  // READ ACCESS for host UI
  // -------------------------------------------------------------------
  recent(n) {
    n = Math.max(1, Math.min(n || 16, this.clauses.length));
    return this.clauses.slice(-n).reverse();
  }

  all() {
    return this.clauses.slice();
  }

  byKind(kind) {
    return this.clauses.filter(c => c.kind === kind);
  }

  stats() {
    const byKind = Object.create(null);
    for (const c of this.clauses) {
      byKind[c.kind] = (byKind[c.kind] || 0) + 1;
    }
    return {
      totalEmitted: this.totalEmitted,
      buffered: this.clauses.length,
      cap: SURFACE_CFG.CLAUSE_CAP,
      byKind: byKind
    };
  }

  // -------------------------------------------------------------------
  // RESET / CLEAR
  // -------------------------------------------------------------------
  clear() {
    this.clauses = [];
    this.totalEmitted = 0;
    this.initialized = false;
    this.snapshot = null;
  }
}

// ---------------------------------------------------------------------------
// EXPORT
// ---------------------------------------------------------------------------
const ReflexiveSurfaceModule = Object.freeze({
  ReflexiveSurface: ReflexiveSurface,
  SURFACE_CFG: SURFACE_CFG,
  CLAUSE_KIND: CLAUSE_KIND
});

if (typeof module !== "undefined" && module.exports) {
  module.exports = ReflexiveSurfaceModule;
} else {
  global.ReflexiveSurfaceModule = ReflexiveSurfaceModule;
}

})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));
