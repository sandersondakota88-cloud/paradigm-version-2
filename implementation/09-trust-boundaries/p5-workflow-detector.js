// p5-workflow-detector.js - P5 commitment-projection adapter (F3 corrected)

"use strict";

const SOURCE_NAME = "workflow-commitment-projector";

// PHASE 10 BOILERPLATE: these commitment values are hardcoded today.
// When the legal-substrate-bridge ships, they get replaced by bridge-
// projected values from SLA contracts, organizational policy, and
// operational threshold commitments. See PHASE_10_PLAN_OF_CONTINUANCE.md
// section 5.
const DEFAULT_COMMITMENTS = Object.freeze({
  staleThresholdMs: 7 * 24 * 60 * 60 * 1000,
  activeStages: Object.freeze(
    ["discovery", "qualified", "proposed", "negotiation"])
});

const CONFIG = Object.freeze({
  MAX_SIGNALS_PER_PROJECT: 16
});

class WorkflowCommitmentProjector {
  constructor(opts) {
    if (!opts || typeof opts !== "object") {
      throw new TypeError(
        "WorkflowCommitmentProjector: opts required");
    }
    if (!opts.field) {
      throw new TypeError(
        "WorkflowCommitmentProjector: opts.field required");
    }
    if (!opts.field.intake) {
      throw new TypeError(
        "WorkflowCommitmentProjector: field must have intake");
    }

    this.field = opts.field;
    this.commitments = Object.freeze(Object.assign(
      {}, DEFAULT_COMMITMENTS, opts.commitments || {}));
    this.config = Object.assign({}, CONFIG, opts.config || {});

    this._stats = {
      projectCalls: 0,
      signalsPublished: 0,
      stalledDealsObserved: 0
    };
  }

  // --------------------------------------------------------------------
  // project()
  //
  // Walks intake; identifies deals where observed-state has diverged
  // from commitment-state; publishes workflow-signal records to intake
  // for each gap.
  //
  // The cascade rules over workflow-signal coords (defined by the
  // application) derive whatever downstream coords the UI/bridge act
  // on. The projector itself is opaque to those rules.
  //
  // Returns {published, signals: [{dealId, signal, ageMs}, ...]}
  // --------------------------------------------------------------------
  project() {
    this._stats.projectCalls++;
    const records = this.field.intake.records;
    const dealStates = this._extractDealStates(records);
    const timeNow = this._extractTimeNow(records);

    if (typeof timeNow !== "number") {
      return { published: 0, signals: [] };
    }

    const signals = [];
    let published = 0;

    for (const dealId of Object.keys(dealStates)) {
      const ds = dealStates[dealId];
      if (typeof ds.stage !== "string") continue;
      if (typeof ds.updatedAt !== "number") continue;
      if (this.commitments.activeStages.indexOf(ds.stage) < 0) continue;

      const ageMs = timeNow - ds.updatedAt;
      if (ageMs <= this.commitments.staleThresholdMs) continue;

      this._stats.stalledDealsObserved++;

      // I3: per-project cap
      if (published >= this.config.MAX_SIGNALS_PER_PROJECT) continue;

      // Publish workflow signal as intake record. The cascade decides
      // what downstream coord this drives; the projector just surfaces
      // the gap.
      this.field.intake.publish({
        type: "domain::workflow-signal",
        value: {
          dealId: dealId,
          signal: "follow-up-due",
          stage: ds.stage,
          ageMs: ageMs
        },
        timestamp: timeNow,
        source: SOURCE_NAME
      });
      signals.push({ dealId: dealId, signal: "follow-up-due", ageMs: ageMs });
      published++;
      this._stats.signalsPublished++;
    }

    return { published: published, signals: signals };
  }

  // --------------------------------------------------------------------
  // observe() - O-class observer surface (read-only stats)
  // --------------------------------------------------------------------
  observe() {
    const activeSignals = this.field.intake.records.filter(
      r => r && r.type === "domain::workflow-signal"
    ).length;
    return Object.assign({}, this._stats, {
      activeSignals: activeSignals,
      commitments: {
        staleThresholdMs: this.commitments.staleThresholdMs,
        activeStages: this.commitments.activeStages.slice()
      }
    });
  }

  // ====================================================================
  // Internal helpers
  // ====================================================================

  _extractDealStates(records) {
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
    let tn = null;
    for (const r of records) {
      if (r && r.type === "time-now" && typeof r.value === "number") {
        tn = r.value;
      }
    }
    return tn;
  }
}

// Backward-compatible export: WorkflowDetector aliased to the new class
// so existing callers don't break. New code should use the new name.
module.exports = Object.freeze({
  WorkflowCommitmentProjector: WorkflowCommitmentProjector,
  WorkflowDetector: WorkflowCommitmentProjector,  // legacy alias
  SOURCE_NAME: SOURCE_NAME,
  CONFIG: CONFIG,
  DEFAULT_COMMITMENTS: DEFAULT_COMMITMENTS
});
