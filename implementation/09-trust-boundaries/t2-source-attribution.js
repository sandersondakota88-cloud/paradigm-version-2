// t2-source-attribution.js - Phase 9 T2: signed source attribution

"use strict";

const crypto = require("crypto");
const T1 = require("./t1-skeptical-intake.js");

// ----------------------------------------------------------------------------
// Signing / verification primitives (HMAC-SHA256 placeholder)
//
// In production these would be replaced with EdDSA or ECDSA over
// asymmetric keys. The shape (signRecord, verifyRecord) stays the same.
// ----------------------------------------------------------------------------

function _canonical(content) {
  // Deterministic JSON for signature input. Real production would
  // use a canonicalization spec (e.g., RFC 8785 JCS).
  return JSON.stringify(content);
}

function signRecord(key, sourceId, content) {
  if (typeof key !== "string" || key.length === 0) {
    throw new TypeError("signRecord: key required");
  }
  if (typeof sourceId !== "string" || sourceId.length === 0) {
    throw new TypeError("signRecord: sourceId required");
  }
  const hmac = crypto.createHmac("sha256", key);
  hmac.update(sourceId);
  hmac.update("\x00");  // domain separator
  hmac.update(_canonical(content));
  const signature = hmac.digest("hex");
  return {
    sourceId: sourceId,
    content: content,
    signature: signature
  };
}

function verifyRecord(key, signedRecord) {
  if (!signedRecord || typeof signedRecord !== "object") return false;
  if (typeof signedRecord.sourceId !== "string") return false;
  if (typeof signedRecord.signature !== "string") return false;
  if (typeof key !== "string" || key.length === 0) return false;

  let expected;
  try {
    const hmac = crypto.createHmac("sha256", key);
    hmac.update(signedRecord.sourceId);
    hmac.update("\x00");
    hmac.update(_canonical(signedRecord.content));
    expected = hmac.digest("hex");
  } catch (_) {
    return false;
  }

  // Constant-time comparison
  if (expected.length !== signedRecord.signature.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signedRecord.signature, "hex")
    );
  } catch (_) {
    return false;
  }
}

// ----------------------------------------------------------------------------
// Reference verified-trust cascade rules
//
// These extend T1's pattern with the verification coord. The trusted
// class now requires data-incoming-source-verified="1" to dispatch
// the process arm; a trusted-class CLAIM with verified="0" dispatches
// the sacrifice-unverified arm (the cryptographic-failure sacrificial
// branch).
//
// Public-class rules unchanged from T1 (public sources don't carry
// trust claims; they get rate-limited instead). Malformed-shape rule
// also unchanged.
// ----------------------------------------------------------------------------
const REFERENCE_VERIFIED_TRUST_RULES = [
  // Trusted: requires verification
  '[data-substrate-state][data-incoming-source-class="trusted"][data-incoming-source-verified="1"][data-incoming-record-shape="valid"] { --next-op: "process-trusted-record"; }',
  // Trusted CLAIM with bad signature: sacrifice-unverified
  '[data-substrate-state][data-incoming-source-class="trusted"][data-incoming-source-verified="0"] { --next-op: "sacrifice-unverified-record"; }',
  // Public: same as T1 (rate-limited; no signature check)
  '[data-substrate-state][data-incoming-source-class="public"][data-incoming-source-rate-ok="1"][data-incoming-record-shape="valid"] { --next-op: "process-public-record"; }',
  '[data-substrate-state][data-incoming-source-class="public"][data-incoming-source-rate-ok="0"] { --next-op: "sacrifice-throttled-record"; }',
  // Malformed: same as T1
  '[data-substrate-state][data-incoming-record-shape="malformed"] { --next-op: "sacrifice-malformed-record"; }'
].join("\n");

// ----------------------------------------------------------------------------
// sacrifice-unverified arm: counter-shape disposal for cryptographic
// verification failures. Inert sacrifice coord; no payload retention.
// ----------------------------------------------------------------------------
function sacrificeUnverifiedRecord(field, opts) {
  field.intake.publish({
    type: "arm-result::sacrifice-unverified",
    value: { sacrificed: 1 },
    timestamp: (opts && opts.timeNow) | 0,
    source: "arm::sacrifice-unverified-record"
  });
  return { fired: true, kind: "sacrifice" };
}

// Extended arm registry: T1's arms + the verification-failure sacrifice
const ARMS = Object.freeze({
  "process-trusted-record": T1.ARMS["process-trusted-record"],
  "process-public-record": T1.ARMS["process-public-record"],
  "sacrifice-throttled-record": T1.ARMS["sacrifice-throttled-record"],
  "sacrifice-malformed-record": T1.ARMS["sacrifice-malformed-record"],
  "sacrifice-unverified-record": sacrificeUnverifiedRecord
});

// ----------------------------------------------------------------------------
// VerifyingSourceStamper - K2 adapter with cryptographic verification
//
// Differences from T1's SourceStamper:
//   - Takes a keyRegistry (sourceId -> verification key)
//   - Takes an optional verify function (defaults to verifyRecord above)
//   - ingest() expects a signedRecord (vs raw record); verifies before
//     classifying; stamps the verification coord
//
// The verify function abstraction lets the deposition wire in Web
// Crypto (or any other implementation) without touching the K2
// adapter's structural shape.
// ----------------------------------------------------------------------------
class VerifyingSourceStamper {
  constructor(opts) {
    if (!opts || typeof opts !== "object") {
      throw new TypeError("VerifyingSourceStamper: opts required");
    }
    if (!opts.field || !opts.field.intake) {
      throw new TypeError("VerifyingSourceStamper: opts.field with intake required");
    }
    this.field = opts.field;
    this.keyRegistry = Object.assign({}, opts.keyRegistry || {});
    this.sourceRegistry = Object.assign({},
      T1.DEFAULT_SOURCE_REGISTRY,
      opts.sourceRegistry || {});
    this.verify = opts.verify || verifyRecord;
    this.rateLimitPublic = (typeof opts.rateLimitPublic === "number"
      ? opts.rateLimitPublic : T1.RATE_LIMIT_PUBLIC);
    this.rateWindowMs = (typeof opts.rateWindowMs === "number"
      ? opts.rateWindowMs : T1.RATE_WINDOW_MS);
    this._history = Object.create(null);
    this._stats = {
      recordsReceived: 0,
      verificationAttempts: 0,
      verificationSuccesses: 0,
      verificationFailures: 0
    };
  }

  // ingest({signedRecord, timeNow, recordShape})
  //
  // signedRecord: {sourceId, content, signature}
  // Returns {sourceClass, verified, rateOk, shape}
  ingest(opts) {
    if (!opts || !opts.signedRecord) return null;
    const sr = opts.signedRecord;
    const timeNow = (typeof opts.timeNow === "number"
      ? opts.timeNow : Date.now());
    const recordShape = opts.recordShape || "valid";

    this._stats.recordsReceived++;

    const sourceId = sr.sourceId || "anonymous";
    const sourceClass = this.sourceRegistry[sourceId]
      || this.sourceRegistry.__default;

    // Verification: only meaningful if a key is registered for the
    // source. Sources with no registered key are by definition
    // unverifiable; they get verified="0".
    let verified = false;
    const key = this.keyRegistry[sourceId];
    if (typeof key === "string" && key.length > 0) {
      this._stats.verificationAttempts++;
      try {
        verified = this.verify(key, sr);
      } catch (_) {
        verified = false;
      }
      if (verified) this._stats.verificationSuccesses++;
      else this._stats.verificationFailures++;
    }

    const rateOk = this._checkRate(sourceId, timeNow, sourceClass);

    // Publish the record (per SE-08 contract; verification state
    // nests in value)
    this.field.intake.publish({
      type: (sr.content && sr.content.type) || "external::record",
      value: {
        payload: sr.content && sr.content.payload,
        sourceClass: sourceClass,
        verified: verified,
        rateOk: rateOk,
        shape: recordShape
      },
      timestamp: timeNow,
      source: sourceId
    });

    // Source-stamp coords (cascade matches against these)
    this.field.intake.publish({
      type: "dom::source-stamp",
      value: {
        "incoming-source-class": sourceClass,
        "incoming-source-verified": verified ? "1" : "0",
        "incoming-source-rate-ok": rateOk ? "1" : "0",
        "incoming-record-shape": recordShape,
        "incoming-source-id": sourceId
      },
      timestamp: timeNow,
      source: "verifying-source-stamper"
    });

    return {
      sourceClass: sourceClass,
      verified: verified,
      rateOk: rateOk,
      shape: recordShape
    };
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

// dispatchArm: reuse T1's mechanism but with the extended ARMS registry
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
  // Crypto primitives
  signRecord: signRecord,
  verifyRecord: verifyRecord,
  // Cascade rules
  REFERENCE_VERIFIED_TRUST_RULES: REFERENCE_VERIFIED_TRUST_RULES,
  // K2 adapter
  VerifyingSourceStamper: VerifyingSourceStamper,
  // Extended arm registry + dispatch
  ARMS: ARMS,
  dispatchArm: dispatchArm,
  sacrificeUnverifiedRecord: sacrificeUnverifiedRecord
});
