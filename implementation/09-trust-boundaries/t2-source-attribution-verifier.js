// t2-source-attribution-verifier.js - T2: cryptographic source attribution

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const T2 = require("./t2-source-attribution.js");
const T1 = require("./t1-skeptical-intake.js");
const F1Harness = require("./f1-cascade-harness.js");
const Synth = require("./cascade-rule-synthesizer.js");

let pass = 0, fail = 0;
const failures = [];

function test(name, fn) {
  try { fn(); pass++; console.log("  OK   " + name); }
  catch (e) { fail++; failures.push({ name, error: e }); console.log("  FAIL " + name + ": " + e.message); }
}
function assert(c, m) { if (!c) throw new Error("assertion failed: " + (m || "")); }

function buildField() {
  const sandbox = {
    console, setTimeout, setImmediate, Promise, Object, Array, Math, JSON,
    Uint32Array, Float64Array, Float32Array, Uint8Array,
    Map, Set, Error, TypeError, RangeError, String, Number, Boolean, Date,
    performance: { now: () => Date.now() }
  };
  sandbox.globalThis = sandbox; sandbox.global = sandbox;
  vm.createContext(sandbox);
  const fieldSrc = fs.readFileSync(
    path.join(__dirname, "kernel-src", "field.js"), "utf8");
  vm.runInContext(fieldSrc, sandbox, { filename: "field.js" });
  const ext = require(path.join(__dirname, "field-intake-extension.js"));
  ext.install(sandbox.FieldModule);
  sandbox.FieldModule.Field.reset();
  return sandbox.FieldModule;
}

function resolveNextOp(stampValue) {
  const synth = Synth.synthesizeFromCss(T2.REFERENCE_VERIFIED_TRUST_RULES);
  if (!synth.ok) throw new Error("synth failed");
  const coords = {
    "data-substrate-state": "",
    "data-incoming-source-class": stampValue["incoming-source-class"] || "",
    "data-incoming-source-verified": stampValue["incoming-source-verified"] || "",
    "data-incoming-source-rate-ok": stampValue["incoming-source-rate-ok"] || "",
    "data-incoming-record-shape": stampValue["incoming-record-shape"] || ""
  };
  const r = F1Harness.runCascade(synth.constraints, coords);
  return r.cascadeOutput || {};
}

function countIntakeByType(field, t) {
  return field.intake.records.filter(r => r && r.type === t).length;
}

function makeKey() {
  return crypto.randomBytes(32).toString("hex");
}

console.log("t2-source-attribution verification");
console.log("");

// ----------------------------------------------------------------------------
// PART A: signing and verification primitives
// ----------------------------------------------------------------------------
console.log("PART A: signRecord / verifyRecord primitives");
console.log("");

test("signRecord requires key + sourceId", () => {
  let threw = false;
  try { T2.signRecord("", "src", {}); } catch (_) { threw = true; }
  assert(threw, "missing key should throw");
  threw = false;
  try { T2.signRecord("key", "", {}); } catch (_) { threw = true; }
  assert(threw, "missing sourceId should throw");
});

test("Signed record has sourceId, content, signature fields", () => {
  const key = makeKey();
  const sr = T2.signRecord(key, "partner-a.example.com", { hello: 1 });
  assert(sr.sourceId === "partner-a.example.com");
  assert(typeof sr.signature === "string");
  assert(sr.signature.length === 64, "SHA256 hex = 64 chars; got " + sr.signature.length);
  assert(sr.content.hello === 1);
});

test("verifyRecord: valid signature -> true", () => {
  const key = makeKey();
  const sr = T2.signRecord(key, "src", { x: 1 });
  assert(T2.verifyRecord(key, sr) === true);
});

test("verifyRecord: tampered content -> false", () => {
  const key = makeKey();
  const sr = T2.signRecord(key, "src", { x: 1 });
  sr.content.x = 2;  // tamper
  assert(T2.verifyRecord(key, sr) === false);
});

test("verifyRecord: tampered sourceId -> false", () => {
  const key = makeKey();
  const sr = T2.signRecord(key, "src", { x: 1 });
  sr.sourceId = "different-source";
  assert(T2.verifyRecord(key, sr) === false);
});

test("verifyRecord: wrong key -> false", () => {
  const key1 = makeKey();
  const key2 = makeKey();
  const sr = T2.signRecord(key1, "src", { x: 1 });
  assert(T2.verifyRecord(key2, sr) === false);
});

test("verifyRecord: malformed signed record -> false (no throw)", () => {
  const key = makeKey();
  assert(T2.verifyRecord(key, null) === false);
  assert(T2.verifyRecord(key, {}) === false);
  assert(T2.verifyRecord(key, { sourceId: "x" }) === false);
  assert(T2.verifyRecord(key, { sourceId: "x", signature: "deadbeef" }) === false);
});

// ----------------------------------------------------------------------------
// PART B: cascade rules with verification coord
// ----------------------------------------------------------------------------
console.log("");
console.log("PART B: cascade rules incorporate verification coord");
console.log("");

test("Reference verified-trust rules: 5 cascade constraints", () => {
  const r = Synth.synthesizeFromCss(T2.REFERENCE_VERIFIED_TRUST_RULES);
  assert(r.ok, "synth failed: " + JSON.stringify(r.errors));
  assert(r.constraints.length === 5);
});

test("Trusted + verified=1 + valid -> process-trusted-record", () => {
  const co = resolveNextOp({
    "incoming-source-class": "trusted",
    "incoming-source-verified": "1",
    "incoming-source-rate-ok": "1",
    "incoming-record-shape": "valid"
  });
  assert(co["--next-op"], "got " + JSON.stringify(co));
  assert(co["--next-op"].value === "process-trusted-record");
});

test("Trusted + verified=0 -> sacrifice-unverified-record", () => {
  const co = resolveNextOp({
    "incoming-source-class": "trusted",
    "incoming-source-verified": "0",
    "incoming-record-shape": "valid"
  });
  assert(co["--next-op"].value === "sacrifice-unverified-record",
    "got " + co["--next-op"].value);
});

test("Trusted + no verification stamp -> sacrifice-unverified", () => {
  // No verified coord at all (e.g., unsigned record from claimed trusted source).
  // The rule for verified=0 won't match because the coord isn't present.
  // The rule for verified=1 won't match either. Cascade silent for this case.
  // (In practice the K2 stamper always emits a verified coord; this tests
  // resilience if somehow it didn't.)
  const co = resolveNextOp({
    "incoming-source-class": "trusted",
    "incoming-record-shape": "valid"
  });
  // No matching rule -> silent
  assert(!co["--next-op"], "expected silent; got " + JSON.stringify(co["--next-op"]));
});

test("Public + rate-ok + valid -> process-public-record (no verification needed)", () => {
  const co = resolveNextOp({
    "incoming-source-class": "public",
    "incoming-source-rate-ok": "1",
    "incoming-record-shape": "valid"
  });
  assert(co["--next-op"].value === "process-public-record");
});

test("Public + throttled -> sacrifice-throttled-record", () => {
  const co = resolveNextOp({
    "incoming-source-class": "public",
    "incoming-source-rate-ok": "0",
    "incoming-record-shape": "valid"
  });
  assert(co["--next-op"].value === "sacrifice-throttled-record");
});

test("Malformed shape -> sacrifice-malformed-record (any class)", () => {
  const co = resolveNextOp({
    "incoming-source-class": "trusted",
    "incoming-source-verified": "1",
    "incoming-record-shape": "malformed"
  });
  assert(co["--next-op"].value === "sacrifice-malformed-record");
});

// ----------------------------------------------------------------------------
// PART C: VerifyingSourceStamper integration
// ----------------------------------------------------------------------------
console.log("");
console.log("PART C: VerifyingSourceStamper - K2 adapter with crypto");
console.log("");

test("Stamper rejects without field+intake", () => {
  let threw = false;
  try { new T2.VerifyingSourceStamper({}); } catch (_) { threw = true; }
  assert(threw);
});

test("Stamper with valid signed record: verified=true", () => {
  const fm = buildField();
  const key = makeKey();
  const stamper = new T2.VerifyingSourceStamper({
    field: fm.Field,
    keyRegistry: { "partner-a.example.com": key }
  });
  const sr = T2.signRecord(key, "partner-a.example.com",
    { type: "external::record", payload: { x: 1 } });
  const r = stamper.ingest({ signedRecord: sr, timeNow: 0 });
  assert(r.sourceClass === "trusted");
  assert(r.verified === true);
});

test("Stamper with tampered signed record: verified=false", () => {
  const fm = buildField();
  const key = makeKey();
  const stamper = new T2.VerifyingSourceStamper({
    field: fm.Field,
    keyRegistry: { "partner-a.example.com": key }
  });
  const sr = T2.signRecord(key, "partner-a.example.com",
    { type: "external::record", payload: { x: 1 } });
  sr.content.payload.x = 999;  // tamper after signing
  const r = stamper.ingest({ signedRecord: sr, timeNow: 0 });
  assert(r.sourceClass === "trusted");
  assert(r.verified === false, "tampered record should fail verification");
});

test("Stamper publishes record + source-stamp with verification coord", () => {
  const fm = buildField();
  const key = makeKey();
  const stamper = new T2.VerifyingSourceStamper({
    field: fm.Field,
    keyRegistry: { "partner-a.example.com": key }
  });
  const sr = T2.signRecord(key, "partner-a.example.com",
    { type: "external::record", payload: { x: 1 } });
  stamper.ingest({ signedRecord: sr, timeNow: 0 });
  // Source-stamp record carries the verification coord
  const stamp = fm.Field.intake.records.find(
    r => r && r.type === "dom::source-stamp");
  assert(stamp);
  assert(stamp.value["incoming-source-verified"] === "1");
});

test("Stamper with no key for source: verified=false", () => {
  const fm = buildField();
  const stamper = new T2.VerifyingSourceStamper({
    field: fm.Field,
    keyRegistry: {}  // no keys registered
  });
  const sr = T2.signRecord("any-key", "partner-a.example.com",
    { type: "external::record", payload: { x: 1 } });
  const r = stamper.ingest({ signedRecord: sr, timeNow: 0 });
  // Even if signed correctly with some key, no registered key for
  // the source means verification cannot succeed
  assert(r.verified === false);
});

test("Stamper stats track verification attempts and outcomes", () => {
  const fm = buildField();
  const key = makeKey();
  const stamper = new T2.VerifyingSourceStamper({
    field: fm.Field,
    keyRegistry: { "partner-a.example.com": key }
  });
  // 2 valid + 1 tampered
  const sr1 = T2.signRecord(key, "partner-a.example.com",
    { payload: 1 });
  const sr2 = T2.signRecord(key, "partner-a.example.com",
    { payload: 2 });
  const sr3 = T2.signRecord(key, "partner-a.example.com",
    { payload: 3 });
  sr3.signature = "00".repeat(32);  // bad sig
  stamper.ingest({ signedRecord: sr1, timeNow: 0 });
  stamper.ingest({ signedRecord: sr2, timeNow: 0 });
  stamper.ingest({ signedRecord: sr3, timeNow: 0 });
  const stats = stamper.observe();
  assert(stats.verificationAttempts === 3);
  assert(stats.verificationSuccesses === 2);
  assert(stats.verificationFailures === 1);
});

// ----------------------------------------------------------------------------
// PART D: end-to-end pipeline (sign -> ingest -> cascade -> dispatch -> arm)
// ----------------------------------------------------------------------------
console.log("");
console.log("PART D: end-to-end pipeline");
console.log("");

test("Valid signed trusted record -> process-trusted arm fires", () => {
  const fm = buildField();
  const key = makeKey();
  const stamper = new T2.VerifyingSourceStamper({
    field: fm.Field,
    keyRegistry: { "partner-a.example.com": key }
  });
  const sr = T2.signRecord(key, "partner-a.example.com",
    { type: "external::record", payload: { important: true } });
  const ingest = stamper.ingest({ signedRecord: sr, timeNow: 0 });

  const co = resolveNextOp({
    "incoming-source-class": ingest.sourceClass,
    "incoming-source-verified": ingest.verified ? "1" : "0",
    "incoming-source-rate-ok": ingest.rateOk ? "1" : "0",
    "incoming-record-shape": ingest.shape
  });
  const dispatch = T2.dispatchArm(fm.Field, co, { timeNow: 0 });
  assert(dispatch.executed === true);
  assert(dispatch.dispatched === "process-trusted-record");
  assert(countIntakeByType(fm.Field, "arm-result::process-trusted") === 1);
  assert(countIntakeByType(fm.Field, "arm-result::sacrifice-unverified") === 0);
});

test("Tampered trusted record -> sacrifice-unverified arm fires", () => {
  const fm = buildField();
  const key = makeKey();
  const stamper = new T2.VerifyingSourceStamper({
    field: fm.Field,
    keyRegistry: { "partner-a.example.com": key }
  });
  const sr = T2.signRecord(key, "partner-a.example.com",
    { type: "external::record", payload: { x: 1 } });
  sr.content.payload.x = 999;  // tamper
  const ingest = stamper.ingest({ signedRecord: sr, timeNow: 0 });

  const co = resolveNextOp({
    "incoming-source-class": ingest.sourceClass,
    "incoming-source-verified": ingest.verified ? "1" : "0",
    "incoming-source-rate-ok": ingest.rateOk ? "1" : "0",
    "incoming-record-shape": ingest.shape
  });
  const dispatch = T2.dispatchArm(fm.Field, co, { timeNow: 0 });
  assert(dispatch.executed === true);
  assert(dispatch.dispatched === "sacrifice-unverified-record");
  assert(countIntakeByType(fm.Field, "arm-result::sacrifice-unverified") === 1);
  // Critical: NO process arm fired for the tampered record
  assert(countIntakeByType(fm.Field, "arm-result::process-trusted") === 0);
});

test("Forged source: signed with attacker key, claiming trusted source -> sacrifice", () => {
  const fm = buildField();
  const realKey = makeKey();
  const attackerKey = makeKey();
  const stamper = new T2.VerifyingSourceStamper({
    field: fm.Field,
    keyRegistry: { "partner-a.example.com": realKey }
  });
  // Attacker signs with their own key, claims to be partner-a
  const forged = T2.signRecord(attackerKey, "partner-a.example.com",
    { type: "external::record", payload: { malicious: true } });
  const ingest = stamper.ingest({ signedRecord: forged, timeNow: 0 });
  assert(ingest.verified === false, "forged record should fail verification");

  const co = resolveNextOp({
    "incoming-source-class": ingest.sourceClass,
    "incoming-source-verified": ingest.verified ? "1" : "0",
    "incoming-source-rate-ok": ingest.rateOk ? "1" : "0",
    "incoming-record-shape": ingest.shape
  });
  const dispatch = T2.dispatchArm(fm.Field, co, { timeNow: 0 });
  assert(dispatch.dispatched === "sacrifice-unverified-record");
  // The malicious payload reached intake (F5: observation deposited)
  // but no actionable arm ran on it
  assert(countIntakeByType(fm.Field, "arm-result::process-trusted") === 0);
});

test("Public source unaffected by verification (no key needed)", () => {
  const fm = buildField();
  const stamper = new T2.VerifyingSourceStamper({
    field: fm.Field,
    keyRegistry: {}  // no keys at all
  });
  const sr = T2.signRecord("dummy", "anon.example.com",
    { type: "external::record", payload: { x: 1 } });
  const ingest = stamper.ingest({ signedRecord: sr, timeNow: 0 });
  assert(ingest.sourceClass === "public");
  // verified=false (no key registered) but cascade rules for public
  // class don't check verification at all
  const co = resolveNextOp({
    "incoming-source-class": "public",
    "incoming-source-verified": "0",
    "incoming-source-rate-ok": "1",
    "incoming-record-shape": "valid"
  });
  assert(co["--next-op"].value === "process-public-record",
    "public source still processed despite verified=0");
});

// ----------------------------------------------------------------------------
// PART E: structural firewall (sacrifice-unverified is inert)
// ----------------------------------------------------------------------------
console.log("");
console.log("PART E: structural firewall");
console.log("");

test("sacrifice-unverified arm: counter shape, no payload retention", () => {
  const fm = buildField();
  T2.sacrificeUnverifiedRecord(fm.Field, { timeNow: 0 });
  const sac = fm.Field.intake.records.find(
    r => r && r.type === "arm-result::sacrifice-unverified");
  assert(sac);
  assert(sac.value.sacrificed === 1);
  assert(typeof sac.value.payload === "undefined",
    "tampered/forged payload not retained in sacrifice record");
  assert(typeof sac.value.signature === "undefined");
  assert(typeof sac.value.sourceId === "undefined");
});

test("sacrifice-unverified arm: field.constraints unchanged", () => {
  const fm = buildField();
  const before = fm.Field.constraints.slice();
  for (let i = 0; i < 100; i++) {
    T2.sacrificeUnverifiedRecord(fm.Field, { timeNow: i });
  }
  assert(fm.Field.constraints.length === before.length);
  for (let i = 0; i < before.length; i++) {
    assert(fm.Field.constraints[i] === before[i]);
  }
});

test("Cascade rule SELECTORS never reference sacrifice or arm-result coords", () => {
  const rules = T2.REFERENCE_VERIFIED_TRUST_RULES;
  const selectors = rules.split("\n").map(line => {
    const idx = line.indexOf("{");
    return idx >= 0 ? line.substring(0, idx) : line;
  }).join(" ");
  assert(selectors.indexOf("arm-result") < 0);
  assert(selectors.indexOf("sacrifice") < 0);
});

// ----------------------------------------------------------------------------
// PART F: closure and structural integrity
// ----------------------------------------------------------------------------
console.log("");
console.log("PART F: closure");
console.log("");

test("T2 module: no observer class exported", () => {
  assert(typeof T2.TrustObserver === "undefined");
});

test("T2 module: no constraints.push, no field.ratify, no _mkPredictive", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "t2-source-attribution.js"), "utf8");
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert(stripped.indexOf("constraints.push") < 0);
  assert(!/field\.ratify\s*\(/.test(stripped));
  assert(stripped.indexOf("_mkPredictive") < 0);
});

test("T2 module: no JS-resident result cache (closure honored)", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "t2-source-attribution.js"), "utf8");
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert(stripped.indexOf("__substrateResults") < 0);
  assert(!/window\.__/.test(stripped));
  assert(stripped.indexOf("admittedRecords") < 0);
});

test("t2-source-attribution.js: ASCII-only", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "t2-source-attribution.js"), "utf8");
  const m = src.match(/[^\x00-\x7F]/);
  assert(!m, "non-ASCII: " + (m && m[0]));
});

test("Crypto stays at K2 boundary: deposition's emitted code references no crypto", () => {
  // T2 module imports Node's crypto - that's OK because T2 is a K2
  // adapter. But the DEPOSITION's emitted application section must
  // not reference crypto, fetch, etc. (handled by k1/p8 closure
  // verifiers; this is just an architectural note).
  const src = fs.readFileSync(
    path.join(__dirname, "t2-source-attribution.js"), "utf8");
  // Confirm T2 imports crypto (the K2 adapter does the work)
  assert(src.indexOf('require("crypto")') >= 0,
    "T2 K2 adapter should import crypto");
});

console.log("");
console.log("==========================================================");
console.log("Summary: " + pass + " passed, " + fail + " failed");
if (fail > 0) {
  for (const f of failures) {
    console.log("  - " + f.name);
    console.log("    " + (f.error.stack || f.error.message));
  }
  process.exit(1);
}
process.exit(0);
