// p6-report-observer.js - Phase 8 P6 - reports as O-class observers

"use strict";

const SOURCE = "report-observer";

const CONFIG = Object.freeze({
  MAX_HISTORY: 100   // O2: bounded retention of past outputs
});

class ReportObserver {
  constructor(opts) {
    if (!opts || typeof opts !== "object") {
      throw new TypeError("ReportObserver: opts required");
    }
    if (!opts.field || !Array.isArray(opts.field.constraints)) {
      throw new TypeError("ReportObserver: opts.field required (with constraints)");
    }
    if (typeof opts.template !== "function") {
      throw new TypeError("ReportObserver: opts.template (function) required");
    }

    this.field = opts.field;
    this.template = opts.template;
    this.name = opts.name || "anonymous-report";
    this.config = Object.assign({}, CONFIG, opts.config || {});

    this._outputs = [];   // O2: bounded ring of past generations
    this._stats = {
      generations: 0,
      templateErrors: 0
    };
  }

  // --------------------------------------------------------------------
  // generate() - the read-only observation
  //
  // Reads field state (via snapshot copy), runs the template, records
  // the output in the bounded ring. Returns the output object.
  // O1: no field write. O2: outputs ring capped. O3: template's job.
  // --------------------------------------------------------------------
  generate() {
    const snapshot = this._snapshotField();
    let output;
    try {
      output = this.template(snapshot);
    } catch (e) {
      this._stats.templateErrors++;
      // Per F3 (no supervision): template errors do not crash; return
      // a structured error output so the observer remains usable.
      output = { error: e.message, partial: true };
    }
    if (output === null || output === undefined) {
      output = { error: "template returned null/undefined", partial: true };
    }
    const entry = {
      step: this.field.step,
      generatedAt: this._stats.generations,
      output: output
    };
    this._outputs.push(entry);
    // O2: cap retention
    if (this._outputs.length > this.config.MAX_HISTORY) {
      this._outputs.shift();
    }
    this._stats.generations++;
    return output;
  }

  // --------------------------------------------------------------------
  // history() - the bounded output ring
  // --------------------------------------------------------------------
  history() {
    return this._outputs.slice();
  }

  observe() {
    return Object.assign({}, this._stats, {
      historyLength: this._outputs.length,
      reportName: this.name,
      maxHistory: this.config.MAX_HISTORY
    });
  }

  // ====================================================================
  // Internal: read-only snapshot copy of relevant field state
  // ====================================================================
  _snapshotField() {
    // Constraints are the primary content. Shallow-copy each constraint
    // so templates can't mutate field via the snapshot. Same for intake.
    const constraints = [];
    for (const c of this.field.constraints) {
      // Defensive copy of each constraint's outer fields. Inner pattern/
      // data references remain shared, but the template contract forbids
      // mutation; verification covers this in O1 tests.
      constraints.push(Object.assign({}, c));
    }
    const intake = this.field.intake && Array.isArray(this.field.intake.records)
      ? this.field.intake.records.slice()
      : [];
    return {
      step: this.field.step,
      constraints: constraints,
      intake: intake,
      scalarDelta: this.field.scalarDelta,
      fastDelta: this.field.fastDelta,
      slowDelta: this.field.slowDelta
    };
  }
}

// ============================================================================
// Built-in report templates
// ============================================================================
//
// Each template:
//   - Takes a fieldSnapshot
//   - Returns plain output data
//   - Sources all output content (record ids, stage labels, etc.) from
//     the snapshot (O3)
//   - Does not modify the snapshot (O1)
//
// Conventions:
//   - Deals are constraints with kind="data" and pattern.type="deal-record"
//   - Contacts are constraints with kind="data" and pattern.type="contact-record"
//   - Each has a `data` payload with the record's coords
// ============================================================================

const TEMPLATES = Object.freeze({

  // Count of deals at each stage. Output:
  //   { reportType: "deals-by-stage", counts: {discovery: N, ...}, total: M }
  dealsByStage(snapshot) {
    const counts = {};
    let total = 0;
    for (const c of snapshot.constraints) {
      if (!c || !c.pattern) continue;
      if (c.pattern.type !== "deal-record") continue;
      if (!c.data) continue;
      const stage = c.data.stage;
      if (typeof stage !== "string") continue;
      // O3: stage label sourced from field state, not invented
      counts[stage] = (counts[stage] || 0) + 1;
      total++;
    }
    return {
      reportType: "deals-by-stage",
      counts: counts,
      total: total,
      asOfStep: snapshot.step
    };
  },

  // Count of deals owned by each user.
  dealsByOwner(snapshot) {
    const counts = {};
    let total = 0;
    let unowned = 0;
    for (const c of snapshot.constraints) {
      if (!c || !c.pattern) continue;
      if (c.pattern.type !== "deal-record") continue;
      if (!c.data) continue;
      const owner = c.data.owner;
      if (typeof owner === "string" && owner.length > 0) {
        counts[owner] = (counts[owner] || 0) + 1;
      } else {
        unowned++;
      }
      total++;
    }
    return {
      reportType: "deals-by-owner",
      counts: counts,
      unowned: unowned,
      total: total,
      asOfStep: snapshot.step
    };
  },

  // Count of contacts by status.
  contactsByStatus(snapshot) {
    const counts = {};
    let total = 0;
    for (const c of snapshot.constraints) {
      if (!c || !c.pattern) continue;
      if (c.pattern.type !== "contact-record") continue;
      if (!c.data) continue;
      const status = c.data.status;
      if (typeof status !== "string") continue;
      counts[status] = (counts[status] || 0) + 1;
      total++;
    }
    return {
      reportType: "contacts-by-status",
      counts: counts,
      total: total,
      asOfStep: snapshot.step
    };
  }
});

module.exports = Object.freeze({
  ReportObserver: ReportObserver,
  TEMPLATES: TEMPLATES,
  CONFIG: CONFIG,
  SOURCE: SOURCE
});
