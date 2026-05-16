// t1-skeptical-intake.js - T1: cascade-dispatched arms (sacrificial branch)

"use strict";

// ----------------------------------------------------------------------------
// Reference cascade rules. The arm names (--next-op values) are part
// of the deployment's contract with its arm registry.
//
// Two process arms (actionable) + two sacrifice arms (inert disposal).
// ----------------------------------------------------------------------------
const REFERENCE_TRUST_RULES = [
  // PROCESS arms - matched records get actionable handling
  '[data-substrate-state][data-incoming-source-class="trusted"][data-incoming-record-shape="valid"] { --next-op: "process-trusted-record"; }',
  '[data-substrate-state][data-incoming-source-class="public"][data-incoming-source-rate-ok="1"][data-incoming-record-shape="valid"] { --next-op: "process-public-record"; }',
  // SACRIFICE arms - cascade actively routes disposal through arm dispatch
  '[data-substrate-state][data-incoming-source-class="public"][data-incoming-source-rate-ok="0"] { --next-op: "sacrifice-throttled-record"; }',
  '[data-substrate-state][data-incoming-record-shape="malformed"] { --next-op: "sacrifice-malformed-record"; }'
].join("\n");

const DEFAULT_SOURCE_REGISTRY = Object.freeze({
  "partner-a.example.com": "trusted",
  "partner-b.example.com": "trusted",
  __default: "public"
});

const RATE_WINDOW_MS = 1000;
const RATE_LIMIT_PUBLIC = 5;

// ----------------------------------------------------------------------------
// SourceStamper - K2 adapter (unchanged in shape from initial T1)
// ----------------------------------------------------------------------------
class SourceStamper {
  constructor(opts) {
    if (!opts || typeof opts !== "object") {
      throw new TypeError("SourceStamper: opts required");
    }
    if (!opts.field || !opts.field.intake) {
      throw new TypeError("SourceStamper: opts.field with intake required");
    }
    this.field = opts.field;
    this.registry = Object.assign({}, DEFAULT_SOURCE_REGISTRY,
      opts.sourceRegistry || {});
    this.rateLimitPublic = (typeof opts.rateLimitPublic === "number"
      ? opts.rateLimitPublic : RATE_LIMIT_PUBLIC);
    this.rateWindowMs = (typeof opts.rateWindowMs === "number"
      ? opts.rateWindowMs : RATE_WINDOW_MS);
    this._history = Object.create(null);
    this._stats = { recordsReceived: 0 };
  }

  // ingest({record, sourceId, timeNow, recordShape}) -> {sourceClass, rateOk, shape}
  ingest(opts) {
    if (!opts || !opts.record) return null;
    const sourceId = opts.sourceId || "anonymous";
    const timeNow = (typeof opts.timeNow === "number"
      ? opts.timeNow : Date.now());
    const recordShape = opts.recordShape || "valid";

    this._stats.recordsReceived++;

    const sourceClass = this.registry[sourceId] || this.registry.__default;
    const rateOk = this._checkRate(sourceId, timeNow, sourceClass);

    // Publish the record itself (per SE-08: {type, value, timestamp,
    // source} - extra fields nest in value)
    this.field.intake.publish({
      type: opts.record.type || "external::record",
      value: {
        payload: opts.record.value,
        sourceClass: sourceClass,
        rateOk: rateOk,
        shape: recordShape
      },
      timestamp: timeNow,
      source: sourceId
    });

    // Publish source-stamp coords. The deposition's bridge would
    // project these onto the state element; the cascade matches.
    this.field.intake.publish({
      type: "dom::source-stamp",
      value: {
        "incoming-source-class": sourceClass,
        "incoming-source-rate-ok": rateOk ? "1" : "0",
        "incoming-record-shape": recordShape,
        "incoming-source-id": sourceId
      },
      timestamp: timeNow,
      source: "source-stamper"
    });

    return { sourceClass: sourceClass, rateOk: rateOk, shape: recordShape };
  }

  observe() { return Object.assign({}, this._stats); }

  _checkRate(sourceId, timeNow, sourceClass) {
    if (sourceClass === "trusted") return true;
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
// ARMS - the CT-side ops that run when cascade dispatches them.
//
// Each arm:
//   - reads the latest source-stamp from intake to find context
//   - reads the latest external::record (the input being routed)
//   - writes its result back to intake as an arm-result record
//   - never mutates field.constraints
//   - never calls kernel internals
//
// Process arms write to actionable arm-result coords.
// Sacrifice arms write to inert sacrifice coords (counter-shaped).
// ----------------------------------------------------------------------------

function _findLatest(field, recordType) {
  const records = field.intake.records;
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i] && records[i].type === recordType) return records[i];
  }
  return null;
}

// Process arms - actionable handling
function processTrustedRecord(field, opts) {
  const stamp = _findLatest(field, "dom::source-stamp");
  const record = _findLatest(field, "external::record");
  if (!stamp || !record) return { fired: false };
  field.intake.publish({
    type: "arm-result::process-trusted",
    value: {
      payload: record.value && record.value.payload,
      sourceId: stamp.value && stamp.value["incoming-source-id"]
    },
    timestamp: (opts && opts.timeNow) | 0,
    source: "arm::process-trusted-record"
  });
  return { fired: true, kind: "process" };
}

function processPublicRecord(field, opts) {
  const stamp = _findLatest(field, "dom::source-stamp");
  const record = _findLatest(field, "external::record");
  if (!stamp || !record) return { fired: false };
  field.intake.publish({
    type: "arm-result::process-public",
    value: {
      payload: record.value && record.value.payload,
      sourceId: stamp.value && stamp.value["incoming-source-id"]
    },
    timestamp: (opts && opts.timeNow) | 0,
    source: "arm::process-public-record"
  });
  return { fired: true, kind: "process" };
}

// Sacrifice arms - inert disposal. Writes ONLY to sacrifice coords.
// No payload retention beyond the sacrifice marker. The input was
// observed (F5 honors the deposit), but no actionable coord is touched.
function sacrificeThrottledRecord(field, opts) {
  field.intake.publish({
    type: "arm-result::sacrifice-throttled",
    value: { sacrificed: 1 },  // counter shape; no payload
    timestamp: (opts && opts.timeNow) | 0,
    source: "arm::sacrifice-throttled-record"
  });
  return { fired: true, kind: "sacrifice" };
}

function sacrificeMalformedRecord(field, opts) {
  field.intake.publish({
    type: "arm-result::sacrifice-malformed",
    value: { sacrificed: 1 },
    timestamp: (opts && opts.timeNow) | 0,
    source: "arm::sacrifice-malformed-record"
  });
  return { fired: true, kind: "sacrifice" };
}

const ARMS = Object.freeze({
  "process-trusted-record": processTrustedRecord,
  "process-public-record": processPublicRecord,
  "sacrifice-throttled-record": sacrificeThrottledRecord,
  "sacrifice-malformed-record": sacrificeMalformedRecord
});

// ----------------------------------------------------------------------------
// dispatchArm(field, cascadeOutput, [opts])
//
// Reads --next-op from cascade output; looks up the arm; runs it.
// The arm writes its result back to intake. Returns metadata about
// the dispatch (no JS-resident result cached).
// ----------------------------------------------------------------------------
function dispatchArm(field, cascadeOutput, opts) {
  if (!field || !field.intake) {
    throw new TypeError("dispatchArm: field with intake required");
  }
  const nextOp = cascadeOutput && cascadeOutput["--next-op"];
  if (!nextOp || typeof nextOp.value !== "string") {
    return { dispatched: null, executed: false };
  }
  const arm = ARMS[nextOp.value];
  if (typeof arm !== "function") {
    return { dispatched: nextOp.value, executed: false,
             reason: "no-arm-registered" };
  }
  const result = arm(field, opts || {});
  return {
    dispatched: nextOp.value,
    executed: true,
    armResult: result
  };
}

module.exports = Object.freeze({
  REFERENCE_TRUST_RULES: REFERENCE_TRUST_RULES,
  DEFAULT_SOURCE_REGISTRY: DEFAULT_SOURCE_REGISTRY,
  RATE_WINDOW_MS: RATE_WINDOW_MS,
  RATE_LIMIT_PUBLIC: RATE_LIMIT_PUBLIC,
  SourceStamper: SourceStamper,
  ARMS: ARMS,
  dispatchArm: dispatchArm,
  // Direct arm exports for tests + direct invocation by walkers
  processTrustedRecord: processTrustedRecord,
  processPublicRecord: processPublicRecord,
  sacrificeThrottledRecord: sacrificeThrottledRecord,
  sacrificeMalformedRecord: sacrificeMalformedRecord
});
