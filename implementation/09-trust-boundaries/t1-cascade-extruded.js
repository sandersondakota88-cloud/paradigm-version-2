// t1-cascade-extruded.js - T1 migrated to SE-01-faithful form

"use strict";

const Orch = require("./cascade-orchestrator.js");
const T1 = require("./t1-skeptical-intake.js");  // arms reused

// ----------------------------------------------------------------------------
// REGISTRY_OUTER_CASCADE - source classification as cascade rules
//
// Adding a new trusted partner: append a rule. Removing one: remove
// the rule. The deployment's source-classification policy is text.
// ----------------------------------------------------------------------------
const REGISTRY_OUTER_CASCADE = [
  // Catch-all: unknown sources are public. Same specificity as
  // partner rules; source-order disambiguates - later rules override
  // for matching source-ids.
  '[data-substrate-state][data-incoming-source-id] { --source-class: "public"; }',
  // Trusted partners
  '[data-substrate-state][data-incoming-source-id="partner-a.example.com"] { --source-class: "trusted"; }',
  '[data-substrate-state][data-incoming-source-id="partner-b.example.com"] { --source-class: "trusted"; }'
].join("\n");

// ----------------------------------------------------------------------------
// TRUST_INNER_CASCADE - dispatch based on cascade-resolved source-class
//
// Differs from t1-skeptical-intake's REFERENCE_TRUST_RULES only in
// matching data-source-class (cascade-resolved) instead of
// data-incoming-source-class (set-by-JS). Functionally equivalent.
// ----------------------------------------------------------------------------
const TRUST_INNER_CASCADE = [
  '[data-substrate-state][data-source-class="trusted"][data-incoming-record-shape="valid"] { --next-op: "process-trusted-record"; }',
  '[data-substrate-state][data-source-class="public"][data-incoming-source-rate-ok="1"][data-incoming-record-shape="valid"] { --next-op: "process-public-record"; }',
  '[data-substrate-state][data-source-class="public"][data-incoming-source-rate-ok="0"] { --next-op: "sacrifice-throttled-record"; }',
  '[data-substrate-state][data-incoming-record-shape="malformed"] { --next-op: "sacrifice-malformed-record"; }'
].join("\n");

// ----------------------------------------------------------------------------
// CascadeExtrudedStamper - K2 adapter, no source registry
//
// Differences from T1.SourceStamper:
//   - No sourceRegistry field (registry lives in cascade rules)
//   - ingest() publishes source-id only (no classification)
//   - Rate limiting and shape validation retained (wire-level concerns)
//
// The K2 adapter has shrunk - that's the visible structural sign of
// configuration moving from K2 to cascade.
// ----------------------------------------------------------------------------
class CascadeExtrudedStamper {
  constructor(opts) {
    if (!opts || typeof opts !== "object") {
      throw new TypeError("CascadeExtrudedStamper: opts required");
    }
    if (!opts.field || !opts.field.intake) {
      throw new TypeError("CascadeExtrudedStamper: opts.field with intake required");
    }
    this.field = opts.field;
    this.rateLimitPublic = (typeof opts.rateLimitPublic === "number")
      ? opts.rateLimitPublic
      : T1.RATE_LIMIT_PUBLIC;
    this.rateWindowMs = (typeof opts.rateWindowMs === "number")
      ? opts.rateWindowMs
      : T1.RATE_WINDOW_MS;
    this._history = Object.create(null);
    this._stats = {
      recordsReceived: 0
    };
  }

  // ingest({record, timeNow, recordShape})
  //
  // Note: classification (source-class) NOT done here. The cascade
  // does it. This adapter only publishes source-id + wire-level
  // signals (rate-ok, shape).
  ingest(opts) {
    if (!opts || !opts.record) return null;
    const record = opts.record;
    const timeNow = (typeof opts.timeNow === "number")
      ? opts.timeNow : Date.now();
    const recordShape = opts.recordShape || "valid";

    this._stats.recordsReceived++;

    const sourceId = record.source || "anonymous";
    const rateOk = this._checkRate(sourceId, timeNow);

    // Publish the record (no classification; SE-01 will classify)
    this.field.intake.publish({
      type: record.type || "external::record",
      value: {
        payload: record.value,
        rateOk: rateOk,
        shape: recordShape
      },
      timestamp: timeNow,
      source: sourceId
    });

    // Source-stamp coords - source-id (not source-class!) plus wire signals
    this.field.intake.publish({
      type: "dom::source-stamp",
      value: {
        "incoming-source-id": sourceId,
        "incoming-source-rate-ok": rateOk ? "1" : "0",
        "incoming-record-shape": recordShape
      },
      timestamp: timeNow,
      source: "cascade-extruded-stamper"
    });

    return {
      sourceId: sourceId,
      rateOk: rateOk,
      shape: recordShape
    };
  }

  observe() { return Object.assign({}, this._stats); }

  _checkRate(sourceId, timeNow) {
    // Rate-limit check is wire-level (this adapter's concern). The
    // cascade will not classify the rate; we just provide the rate
    // signal as a coord.
    //
    // Note: in the post-migration form, rate-limit POLICY (which
    // classes get rate-limited) could ALSO be cascade-extruded. For
    // this initial migration we keep the rate-limit at K2 because
    // it requires per-source state across calls (the _history map).
    // A fully-cascade-extruded rate-limit would require the cascade
    // to read time-windowed state, which is a larger structural move.
    // Marked for follow-up.
    const hist = this._history[sourceId] || [];
    const cutoff = timeNow - this.rateWindowMs;
    let i = 0;
    while (i < hist.length && hist[i] < cutoff) i++;
    const fresh = hist.slice(i);
    fresh.push(timeNow);
    this._history[sourceId] = fresh;
    return fresh.length <= this.rateLimitPublic;
  }
}

// ----------------------------------------------------------------------------
// resolveAndDispatch - run the full cascade-extrusion pipeline
//
// Given current source-stamp coords (from CascadeExtrudedStamper.ingest),
// run outer cascade (registry classification), promote source-class,
// run inner cascade (dispatch), and dispatch the resolved arm.
//
// In production deposition, this is what the bridge does over
// projection passes. In Node tests, we do it explicitly via the
// orchestrator.
// ----------------------------------------------------------------------------
function resolveAndDispatch(field, sourceStampCoords, opts) {
  if (!field || !field.intake) {
    throw new TypeError("resolveAndDispatch: field with intake required");
  }
  if (!sourceStampCoords || typeof sourceStampCoords !== "object") {
    throw new TypeError("resolveAndDispatch: sourceStampCoords required");
  }

  // Build initial coord set (from source-stamp)
  const initialCoords = Object.assign({
    "data-substrate-state": ""
  }, _stampToDataAttrs(sourceStampCoords));

  // Run the cascade-extrusion pipeline
  const result = Orch.runPasses([
    {
      rules: REGISTRY_OUTER_CASCADE,
      promotionMap: { "--source-class": "data-source-class" }
    },
    {
      rules: TRUST_INNER_CASCADE,
      promotionMap: {}
    }
  ], initialCoords);

  // Read --next-op from inner cascade output and dispatch
  const nextOp = result.lastOutput["--next-op"];
  if (!nextOp || typeof nextOp.value !== "string") {
    return {
      dispatched: null,
      executed: false,
      finalCoords: result.finalCoords,
      sourceClassResolved: result.passes[0].promoted["data-source-class"] || null
    };
  }
  const arm = T1.ARMS[nextOp.value];
  if (typeof arm !== "function") {
    return {
      dispatched: nextOp.value,
      executed: false,
      reason: "no-arm-registered",
      finalCoords: result.finalCoords,
      sourceClassResolved: result.passes[0].promoted["data-source-class"] || null
    };
  }
  const armResult = arm(field, opts || {});
  return {
    dispatched: nextOp.value,
    executed: true,
    armResult: armResult,
    finalCoords: result.finalCoords,
    sourceClassResolved: result.passes[0].promoted["data-source-class"] || null
  };
}

// Helper: convert source-stamp object to data-* attrs
function _stampToDataAttrs(stamp) {
  const out = {};
  for (const k of Object.keys(stamp)) {
    out["data-" + k] = stamp[k];
  }
  return out;
}

module.exports = Object.freeze({
  REGISTRY_OUTER_CASCADE: REGISTRY_OUTER_CASCADE,
  TRUST_INNER_CASCADE: TRUST_INNER_CASCADE,
  CascadeExtrudedStamper: CascadeExtrudedStamper,
  resolveAndDispatch: resolveAndDispatch
});
