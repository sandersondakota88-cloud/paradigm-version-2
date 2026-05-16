// p5-workflow-detector.js - Phase 8 P5 - workflow as predictive constraints

"use strict";

const SOURCE_NAME = "workflow-detector";

const CONFIG = Object.freeze({
  // Stalled-deal threshold: 7 days. Configurable per deployment.
  STALE_THRESHOLD_MS: 7 * 24 * 60 * 60 * 1000,
  // Cap on predictives generated per detect() invocation
  MAX_PREDICTIVES_PER_DETECT: 16,
  // Stages where stalling is meaningful (closed deals do not stall)
  ACTIVE_STAGES: Object.freeze(["discovery", "qualified", "proposed", "negotiation"])
});

class WorkflowDetector {
  constructor(opts) {
    if (!opts || typeof opts !== "object") {
      throw new TypeError("p5-workflow-detector: opts required");
    }
    if (!opts.field) {
      throw new TypeError("p5-workflow-detector: opts.field required");
    }
    if (!opts.field.intake || !Array.isArray(opts.field.constraints)) {
      throw new TypeError(
        "p5-workflow-detector: field must have intake + constraints");
    }

    this.field = opts.field;
    this.config = Object.assign({}, CONFIG, opts.config || {});

    this._stats = {
      detectCalls: 0,
      predictivesGenerated: 0,
      ratificationsApplied: 0,
      stalledDealsDetected: 0
    };
  }

  // --------------------------------------------------------------------
  // detect() - the gap-detection pass
  //
  // Walks intake records, builds per-deal state, identifies stalled
  // deals, generates predictive constraints. Returns {generated,
  // alreadyTracked, stalledDeals}.
  //
  // Should be called at SE-02 metabolism cadence by the kernel's
  // tick loop. The detector itself does not subscribe to ticks; the
  // caller drives.
  // --------------------------------------------------------------------
  detect() {
    this._stats.detectCalls++;
    const records = this.field.intake.records;
    const dealStates = this._extractDealStates(records);
    const timeNow = this._extractTimeNow(records);

    let generated = 0;
    let alreadyTracked = 0;
    const stalledDeals = [];

    for (const dealId of Object.keys(dealStates)) {
      const ds = dealStates[dealId];
      if (typeof ds.stage !== "string") continue;
      if (typeof ds.updatedAt !== "number") continue;
      if (typeof timeNow !== "number") continue;

      // Active stage check
      if (this.config.ACTIVE_STAGES.indexOf(ds.stage) < 0) continue;

      // Stale check
      const ageMs = timeNow - ds.updatedAt;
      if (ageMs <= this.config.STALE_THRESHOLD_MS) continue;

      stalledDeals.push({ dealId: dealId, stage: ds.stage, ageMs: ageMs });
      this._stats.stalledDealsDetected++;

      // One-active-prediction-per-deal policy (I3)
      if (this._hasActivePredictiveFor(dealId)) {
        alreadyTracked++;
        continue;
      }

      // Cap (I3)
      if (generated >= this.config.MAX_PREDICTIVES_PER_DETECT) continue;

      this._generatePredictive(dealId, ds.stage, ds.updatedAt, timeNow);
      generated++;
    }

    return {
      generated: generated,
      alreadyTracked: alreadyTracked,
      stalledDeals: stalledDeals
    };
  }

  // --------------------------------------------------------------------
  // ratifyPending() - check intake for follow-up records; ratify
  // matching predictive constraints
  //
  // A follow-up record is shape:
  //   {type: "deal-followup", value: {dealId: "...", action: "..."}, ...}
  //
  // For each follow-up, find the predictive constraint with matching
  // dealId and call field.ratify(idx). Per SE-05: predictive becomes
  // ratified; weight boosted; lastUsed updated.
  //
  // Returns count of ratifications applied.
  // --------------------------------------------------------------------
  ratifyPending() {
    const records = this.field.intake.records;
    let ratified = 0;
    for (const rec of records) {
      if (rec.type !== "deal-followup") continue;
      if (!rec.value || typeof rec.value !== "object") continue;
      const dealId = rec.value.dealId;
      if (typeof dealId !== "string") continue;

      const idx = this._findActivePredictiveIdxForDeal(dealId);
      if (idx < 0) continue;

      // Use the kernel's Field.ratify - this is the canonical SE-05
      // ratification path. It transitions kind to "ratified", boosts
      // weight, updates lastUsed.
      const ok = (typeof this.field.ratify === "function") &&
                 this.field.ratify(idx);
      if (ok) {
        ratified++;
        this._stats.ratificationsApplied++;
      }
    }
    return ratified;
  }

  // --------------------------------------------------------------------
  // observe() - O-class observer surface
  // --------------------------------------------------------------------
  observe() {
    return Object.assign({}, this._stats, {
      activePredictives: this.field.constraints.filter(
        c => c && c.kind === "predictive" &&
             c.pattern && c.pattern.type === "deal-followup"
      ).length,
      ratifiedConstraints: this.field.constraints.filter(
        c => c && c.kind === "ratified" &&
             c.pattern && c.pattern.type === "deal-followup"
      ).length
    });
  }

  // ====================================================================
  // Internal helpers
  // ====================================================================

  _generatePredictive(dealId, stage, updatedAt, timeNow) {
    // Predictive constraint shape per SE-05 + algorithm 16:
    //   kind: "predictive" - field will evict if not ratified within
    //         PRED_AGE_LIMIT (kernel default; see field.js CFG)
    //   pattern: matches a deal-followup record for this deal
    //   desc: human-readable description for trace
    const pred = {
      id: "wf::" + dealId + "::" + this.field.step,
      kind: "predictive",
      pattern: {
        type: "deal-followup",
        dealId: dealId,
        currentStage: stage
      },
      desc: "stalled " + stage + " deal " + dealId +
            " awaiting follow-up (age=" + (timeNow - updatedAt) + "ms)",
      birth: this.field.step,
      lastUsed: this.field.step,
      uses: 0,
      weight: 1.0,
      permanent: false
    };
    this.field.constraints.push(pred);
    this._stats.predictivesGenerated++;
  }

  _hasActivePredictiveFor(dealId) {
    for (const c of this.field.constraints) {
      if (!c || c.kind !== "predictive") continue;
      if (!c.pattern || c.pattern.type !== "deal-followup") continue;
      if (c.pattern.dealId === dealId) return true;
    }
    return false;
  }

  _findActivePredictiveIdxForDeal(dealId) {
    for (let i = 0; i < this.field.constraints.length; i++) {
      const c = this.field.constraints[i];
      if (!c || c.kind !== "predictive") continue;
      if (!c.pattern || c.pattern.type !== "deal-followup") continue;
      if (c.pattern.dealId === dealId) return i;
    }
    return -1;
  }

  _extractDealStates(records) {
    // Per-deal state from the intake stream. Latest record wins (FIFO,
    // last-write).
    const states = Object.create(null);
    for (const r of records) {
      if (!r || typeof r !== "object") continue;
      if (r.type === "deal-stage" && r.value && typeof r.value === "object") {
        const id = r.value.dealId;
        if (typeof id === "string") {
          if (!states[id]) states[id] = {};
          states[id].stage = r.value.stage;
        }
      } else if (r.type === "deal-updated-at" && r.value &&
                 typeof r.value === "object") {
        const id = r.value.dealId;
        if (typeof id === "string") {
          if (!states[id]) states[id] = {};
          states[id].updatedAt = r.value.timestamp;
        }
      }
    }
    return states;
  }

  _extractTimeNow(records) {
    // Latest time-now record (the K2 time adapter publishes these).
    let tn = null;
    for (const r of records) {
      if (r && r.type === "time-now" && typeof r.value === "number") {
        tn = r.value;
      }
    }
    return tn;
  }
}

module.exports = Object.freeze({
  WorkflowDetector: WorkflowDetector,
  SOURCE_NAME: SOURCE_NAME,
  CONFIG: CONFIG
});
