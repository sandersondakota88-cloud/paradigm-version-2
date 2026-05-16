// t3-trust-topology.js - Phase 9 T3: per-pair trust topology

"use strict";

const T2 = require("./t2-source-attribution.js");

// ----------------------------------------------------------------------------
// Topology: peer-trust
//
// Two instances of the same deployment (e.g., two replicas of the
// same CRM) trust each other fully. Verification required on every
// trusted-claim; sacrifice all unverified or malformed input.
// ----------------------------------------------------------------------------
const PEER_TRUST_RULES = T2.REFERENCE_VERIFIED_TRUST_RULES;

// ----------------------------------------------------------------------------
// Topology: partner-trust
//
// Records from verified partners are processed only if their type
// matches an allowlisted set. This adds a type-class coord and
// rules that gate processing on it. The K2 adapter would set
// data-incoming-record-type-class based on whether the incoming
// record's type is in the partner's allowlist.
//
// Demonstration: only "external::contact-record" types are admitted
// from partners. Other types from verified partners get sacrificed.
// ----------------------------------------------------------------------------
const PARTNER_TRUST_RULES = [
  // Verified partner + allowed type -> process
  '[data-substrate-state][data-incoming-source-class="trusted"][data-incoming-source-verified="1"][data-incoming-record-shape="valid"][data-incoming-type-class="allowed"] { --next-op: "process-trusted-record"; }',
  // Verified partner + disallowed type -> sacrifice
  '[data-substrate-state][data-incoming-source-class="trusted"][data-incoming-source-verified="1"][data-incoming-type-class="disallowed"] { --next-op: "sacrifice-disallowed-type"; }',
  // Trusted CLAIM with bad signature -> sacrifice-unverified
  '[data-substrate-state][data-incoming-source-class="trusted"][data-incoming-source-verified="0"] { --next-op: "sacrifice-unverified-record"; }',
  // No public processing under partner-trust topology
  '[data-substrate-state][data-incoming-source-class="public"] { --next-op: "sacrifice-public-blocked"; }',
  // Malformed
  '[data-substrate-state][data-incoming-record-shape="malformed"] { --next-op: "sacrifice-malformed-record"; }'
].join("\n");

// ----------------------------------------------------------------------------
// Topology: public-firewall
//
// Strictest. Only verified trusted-source records are admitted.
// Public records (regardless of rate or shape) are sacrificed.
// ----------------------------------------------------------------------------
const PUBLIC_FIREWALL_RULES = [
  '[data-substrate-state][data-incoming-source-class="trusted"][data-incoming-source-verified="1"][data-incoming-record-shape="valid"] { --next-op: "process-trusted-record"; }',
  '[data-substrate-state][data-incoming-source-class="trusted"][data-incoming-source-verified="0"] { --next-op: "sacrifice-unverified-record"; }',
  '[data-substrate-state][data-incoming-source-class="public"] { --next-op: "sacrifice-public-blocked"; }',
  '[data-substrate-state][data-incoming-record-shape="malformed"] { --next-op: "sacrifice-malformed-record"; }'
].join("\n");

// ----------------------------------------------------------------------------
// Topology: open-public
//
// Most permissive. Verified trusted + rate-limited public both
// processed. Same as T2's reference rules.
// ----------------------------------------------------------------------------
const OPEN_PUBLIC_RULES = T2.REFERENCE_VERIFIED_TRUST_RULES;

// ----------------------------------------------------------------------------
// Additional sacrifice arms for the new topology rules
// ----------------------------------------------------------------------------

function sacrificeDisallowedType(field, opts) {
  field.intake.publish({
    type: "arm-result::sacrifice-disallowed-type",
    value: { sacrificed: 1 },
    timestamp: (opts && opts.timeNow) | 0,
    source: "arm::sacrifice-disallowed-type"
  });
  return { fired: true, kind: "sacrifice" };
}

function sacrificePublicBlocked(field, opts) {
  field.intake.publish({
    type: "arm-result::sacrifice-public-blocked",
    value: { sacrificed: 1 },
    timestamp: (opts && opts.timeNow) | 0,
    source: "arm::sacrifice-public-blocked"
  });
  return { fired: true, kind: "sacrifice" };
}

// Extended arm registry for T3 topologies
const ARMS = Object.freeze(Object.assign({}, T2.ARMS, {
  "sacrifice-disallowed-type": sacrificeDisallowedType,
  "sacrifice-public-blocked": sacrificePublicBlocked
}));

// dispatchArm for T3's extended registry
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

// ----------------------------------------------------------------------------
// TopologyRegistry - looks up cascade rules by topology name
// ----------------------------------------------------------------------------
const TOPOLOGIES = Object.freeze({
  "peer-trust": PEER_TRUST_RULES,
  "partner-trust": PARTNER_TRUST_RULES,
  "public-firewall": PUBLIC_FIREWALL_RULES,
  "open-public": OPEN_PUBLIC_RULES
});

function getTopologyRules(name) {
  if (!TOPOLOGIES.hasOwnProperty(name)) {
    throw new Error("Unknown topology: " + name);
  }
  return TOPOLOGIES[name];
}

// ----------------------------------------------------------------------------
// TopologyAwareStamper - K2 adapter that ALSO classifies record type
// against an allowlist (for partner-trust topology).
//
// Wraps T2's VerifyingSourceStamper with a type-class projection.
// ----------------------------------------------------------------------------
class TopologyAwareStamper {
  constructor(opts) {
    if (!opts || typeof opts !== "object") {
      throw new TypeError("TopologyAwareStamper: opts required");
    }
    if (!opts.field || !opts.field.intake) {
      throw new TypeError("TopologyAwareStamper: opts.field with intake required");
    }
    this.field = opts.field;
    this.allowedTypes = (opts.allowedTypes || []).slice();
    this._inner = new T2.VerifyingSourceStamper({
      field: opts.field,
      keyRegistry: opts.keyRegistry,
      sourceRegistry: opts.sourceRegistry,
      verify: opts.verify,
      rateLimitPublic: opts.rateLimitPublic,
      rateWindowMs: opts.rateWindowMs
    });
  }

  ingest(opts) {
    const r = this._inner.ingest(opts);
    if (!r) return r;
    const recordType = (opts.signedRecord
      && opts.signedRecord.content
      && opts.signedRecord.content.type) || "external::record";
    const typeClass = this.allowedTypes.indexOf(recordType) >= 0
      ? "allowed" : "disallowed";

    // Augment the source-stamp with type-class. We publish a NEW
    // source-stamp record with the additional coord. Latest wins
    // when the bridge projects.
    this.field.intake.publish({
      type: "dom::source-stamp",
      value: {
        "incoming-source-class": r.sourceClass,
        "incoming-source-verified": r.verified ? "1" : "0",
        "incoming-source-rate-ok": r.rateOk ? "1" : "0",
        "incoming-record-shape": r.shape,
        "incoming-type-class": typeClass,
        "incoming-source-id": opts.signedRecord && opts.signedRecord.sourceId
      },
      timestamp: (typeof opts.timeNow === "number" ? opts.timeNow : 0),
      source: "topology-aware-stamper"
    });

    return Object.assign({}, r, { typeClass: typeClass });
  }

  observe() {
    return this._inner.observe();
  }
}

module.exports = Object.freeze({
  TOPOLOGIES: TOPOLOGIES,
  PEER_TRUST_RULES: PEER_TRUST_RULES,
  PARTNER_TRUST_RULES: PARTNER_TRUST_RULES,
  PUBLIC_FIREWALL_RULES: PUBLIC_FIREWALL_RULES,
  OPEN_PUBLIC_RULES: OPEN_PUBLIC_RULES,
  getTopologyRules: getTopologyRules,
  TopologyAwareStamper: TopologyAwareStamper,
  ARMS: ARMS,
  dispatchArm: dispatchArm,
  sacrificeDisallowedType: sacrificeDisallowedType,
  sacrificePublicBlocked: sacrificePublicBlocked
});
