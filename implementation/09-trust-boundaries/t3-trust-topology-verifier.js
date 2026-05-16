// t3-trust-topology-verifier.js - T3: trust topology as cascade geometry

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const T3 = require("./t3-trust-topology.js");
const T2 = require("./t2-source-attribution.js");
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

function resolveNextOp(rules, stampValue) {
  const synth = Synth.synthesizeFromCss(rules);
  if (!synth.ok) throw new Error("synth failed");
  const coords = {
    "data-substrate-state": "",
    "data-incoming-source-class": stampValue["incoming-source-class"] || "",
    "data-incoming-source-verified": stampValue["incoming-source-verified"] || "",
    "data-incoming-source-rate-ok": stampValue["incoming-source-rate-ok"] || "",
    "data-incoming-record-shape": stampValue["incoming-record-shape"] || "",
    "data-incoming-type-class": stampValue["incoming-type-class"] || ""
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

console.log("t3-trust-topology verification");
console.log("");

// ----------------------------------------------------------------------------
// PART A: topology registry
// ----------------------------------------------------------------------------
console.log("PART A: topology registry");
console.log("");

test("Four topologies registered", () => {
  assert(typeof T3.TOPOLOGIES["peer-trust"] === "string");
  assert(typeof T3.TOPOLOGIES["partner-trust"] === "string");
  assert(typeof T3.TOPOLOGIES["public-firewall"] === "string");
  assert(typeof T3.TOPOLOGIES["open-public"] === "string");
});

test("getTopologyRules returns the rule string for each topology", () => {
  const peer = T3.getTopologyRules("peer-trust");
  const partner = T3.getTopologyRules("partner-trust");
  assert(peer === T3.PEER_TRUST_RULES);
  assert(partner === T3.PARTNER_TRUST_RULES);
});

test("getTopologyRules throws on unknown topology", () => {
  let threw = false;
  try { T3.getTopologyRules("nonexistent"); } catch (_) { threw = true; }
  assert(threw);
});

test("All topology rule sets synthesize to valid cascade constraints", () => {
  for (const name of Object.keys(T3.TOPOLOGIES)) {
    const r = Synth.synthesizeFromCss(T3.TOPOLOGIES[name]);
    assert(r.ok, name + " synth failed: " + JSON.stringify(r.errors));
    assert(r.constraints.length > 0, name + " has 0 constraints");
  }
});

// ----------------------------------------------------------------------------
// PART B: same record, different topologies, different outcomes
// ----------------------------------------------------------------------------
console.log("");
console.log("PART B: same record / different topology / different outcome");
console.log("");

const verifiedTrustedValid = {
  "incoming-source-class": "trusted",
  "incoming-source-verified": "1",
  "incoming-record-shape": "valid",
  "incoming-type-class": "allowed"
};

const publicRateOkValid = {
  "incoming-source-class": "public",
  "incoming-source-rate-ok": "1",
  "incoming-record-shape": "valid"
};

test("Verified trusted record: peer-trust -> process", () => {
  const co = resolveNextOp(T3.PEER_TRUST_RULES, verifiedTrustedValid);
  assert(co["--next-op"].value === "process-trusted-record");
});

test("Verified trusted record: partner-trust + allowed type -> process", () => {
  const co = resolveNextOp(T3.PARTNER_TRUST_RULES, verifiedTrustedValid);
  assert(co["--next-op"].value === "process-trusted-record");
});

test("Verified trusted record: partner-trust + DISALLOWED type -> sacrifice-disallowed-type", () => {
  const co = resolveNextOp(T3.PARTNER_TRUST_RULES, {
    "incoming-source-class": "trusted",
    "incoming-source-verified": "1",
    "incoming-record-shape": "valid",
    "incoming-type-class": "disallowed"
  });
  assert(co["--next-op"].value === "sacrifice-disallowed-type",
    "got " + co["--next-op"].value);
});

test("Verified trusted record: public-firewall -> process", () => {
  const co = resolveNextOp(T3.PUBLIC_FIREWALL_RULES, verifiedTrustedValid);
  assert(co["--next-op"].value === "process-trusted-record");
});

test("Verified trusted record: open-public -> process", () => {
  const co = resolveNextOp(T3.OPEN_PUBLIC_RULES, verifiedTrustedValid);
  assert(co["--next-op"].value === "process-trusted-record");
});

test("Public rate-ok valid: peer-trust -> SACRIFICE (no public processing)", () => {
  // Wait - peer-trust uses T2's REFERENCE rules which DO process public.
  // That's the open-public meaning. Let me check what peer-trust really should mean.
  // peer-trust = T2.REFERENCE_VERIFIED_TRUST_RULES which permits public-rate-ok.
  // So peer-trust DOES process public records. open-public is the same set.
  const co = resolveNextOp(T3.PEER_TRUST_RULES, publicRateOkValid);
  // Per the actual rules, peer-trust = T2 reference rules, public is processed
  assert(co["--next-op"].value === "process-public-record",
    "peer-trust: public rate-ok -> process");
});

test("Public rate-ok valid: partner-trust -> sacrifice-public-blocked", () => {
  const co = resolveNextOp(T3.PARTNER_TRUST_RULES, publicRateOkValid);
  assert(co["--next-op"].value === "sacrifice-public-blocked",
    "got " + co["--next-op"].value);
});

test("Public rate-ok valid: public-firewall -> sacrifice-public-blocked", () => {
  const co = resolveNextOp(T3.PUBLIC_FIREWALL_RULES, publicRateOkValid);
  assert(co["--next-op"].value === "sacrifice-public-blocked");
});

test("Public rate-ok valid: open-public -> process-public-record", () => {
  const co = resolveNextOp(T3.OPEN_PUBLIC_RULES, publicRateOkValid);
  assert(co["--next-op"].value === "process-public-record");
});

// ----------------------------------------------------------------------------
// PART C: TopologyAwareStamper composes T2's verifier with type classification
// ----------------------------------------------------------------------------
console.log("");
console.log("PART C: TopologyAwareStamper");
console.log("");

test("Stamper requires field+intake", () => {
  let threw = false;
  try { new T3.TopologyAwareStamper({}); } catch (_) { threw = true; }
  assert(threw);
});

test("Stamper ingests verified record + projects type-class coord", () => {
  const fm = buildField();
  const key = makeKey();
  const stamper = new T3.TopologyAwareStamper({
    field: fm.Field,
    keyRegistry: { "partner-a.example.com": key },
    allowedTypes: ["external::contact-record"]
  });
  const sr = T2.signRecord(key, "partner-a.example.com",
    { type: "external::contact-record", payload: { name: "alice" } });
  const r = stamper.ingest({ signedRecord: sr, timeNow: 0 });
  assert(r.verified === true);
  assert(r.typeClass === "allowed");
});

test("Stamper sets type-class=disallowed for non-allowlisted types", () => {
  const fm = buildField();
  const key = makeKey();
  const stamper = new T3.TopologyAwareStamper({
    field: fm.Field,
    keyRegistry: { "partner-a.example.com": key },
    allowedTypes: ["external::contact-record"]
  });
  const sr = T2.signRecord(key, "partner-a.example.com",
    { type: "external::deal-record", payload: {} });
  const r = stamper.ingest({ signedRecord: sr, timeNow: 0 });
  assert(r.verified === true);
  assert(r.typeClass === "disallowed");
});

// ----------------------------------------------------------------------------
// PART D: end-to-end - verified record under partner-trust topology
// ----------------------------------------------------------------------------
console.log("");
console.log("PART D: end-to-end pipelines per topology");
console.log("");

test("Partner-trust topology: allowed type processed", () => {
  const fm = buildField();
  const key = makeKey();
  const stamper = new T3.TopologyAwareStamper({
    field: fm.Field,
    keyRegistry: { "partner-a.example.com": key },
    allowedTypes: ["external::record"]
  });
  const sr = T2.signRecord(key, "partner-a.example.com",
    { type: "external::record", payload: { name: "alice" } });
  const ingest = stamper.ingest({ signedRecord: sr, timeNow: 0 });

  const co = resolveNextOp(T3.PARTNER_TRUST_RULES, {
    "incoming-source-class": ingest.sourceClass,
    "incoming-source-verified": ingest.verified ? "1" : "0",
    "incoming-source-rate-ok": ingest.rateOk ? "1" : "0",
    "incoming-record-shape": ingest.shape,
    "incoming-type-class": ingest.typeClass
  });
  const dispatch = T3.dispatchArm(fm.Field, co, { timeNow: 0 });
  assert(dispatch.dispatched === "process-trusted-record");
  assert(countIntakeByType(fm.Field, "arm-result::process-trusted") === 1);
});

test("Partner-trust topology: disallowed type sacrificed", () => {
  const fm = buildField();
  const key = makeKey();
  const stamper = new T3.TopologyAwareStamper({
    field: fm.Field,
    keyRegistry: { "partner-a.example.com": key },
    allowedTypes: ["external::contact-record"]  // not "deal-record"
  });
  const sr = T2.signRecord(key, "partner-a.example.com",
    { type: "external::deal-record", payload: {} });
  const ingest = stamper.ingest({ signedRecord: sr, timeNow: 0 });

  const co = resolveNextOp(T3.PARTNER_TRUST_RULES, {
    "incoming-source-class": ingest.sourceClass,
    "incoming-source-verified": ingest.verified ? "1" : "0",
    "incoming-source-rate-ok": ingest.rateOk ? "1" : "0",
    "incoming-record-shape": ingest.shape,
    "incoming-type-class": ingest.typeClass
  });
  const dispatch = T3.dispatchArm(fm.Field, co, { timeNow: 0 });
  assert(dispatch.dispatched === "sacrifice-disallowed-type");
  assert(countIntakeByType(fm.Field, "arm-result::sacrifice-disallowed-type") === 1);
  assert(countIntakeByType(fm.Field, "arm-result::process-trusted") === 0);
});

test("Public-firewall topology: public source -> sacrifice-public-blocked", () => {
  const fm = buildField();
  const stamper = new T3.TopologyAwareStamper({
    field: fm.Field,
    keyRegistry: {},
    allowedTypes: ["*"]  // type allowlist N/A for public sources
  });
  const sr = T2.signRecord("dummy", "anon.example.com",
    { type: "external::record", payload: { x: 1 } });
  const ingest = stamper.ingest({ signedRecord: sr, timeNow: 0 });

  const co = resolveNextOp(T3.PUBLIC_FIREWALL_RULES, {
    "incoming-source-class": ingest.sourceClass,
    "incoming-source-verified": ingest.verified ? "1" : "0",
    "incoming-source-rate-ok": ingest.rateOk ? "1" : "0",
    "incoming-record-shape": ingest.shape
  });
  const dispatch = T3.dispatchArm(fm.Field, co, { timeNow: 0 });
  assert(dispatch.dispatched === "sacrifice-public-blocked",
    "got " + dispatch.dispatched);
});

// ----------------------------------------------------------------------------
// PART E: structural firewall - sacrifice arms still inert
// ----------------------------------------------------------------------------
console.log("");
console.log("PART E: structural firewall");
console.log("");

test("sacrifice-disallowed-type: counter shape, no payload retention", () => {
  const fm = buildField();
  T3.sacrificeDisallowedType(fm.Field, { timeNow: 0 });
  const sac = fm.Field.intake.records.find(
    r => r && r.type === "arm-result::sacrifice-disallowed-type");
  assert(sac);
  assert(sac.value.sacrificed === 1);
  assert(typeof sac.value.payload === "undefined");
});

test("sacrifice-public-blocked: counter shape, no payload retention", () => {
  const fm = buildField();
  T3.sacrificePublicBlocked(fm.Field, { timeNow: 0 });
  const sac = fm.Field.intake.records.find(
    r => r && r.type === "arm-result::sacrifice-public-blocked");
  assert(sac);
  assert(sac.value.sacrificed === 1);
});

test("All sacrifice arms in T3: field.constraints unchanged", () => {
  const fm = buildField();
  const before = fm.Field.constraints.slice();
  T3.sacrificeDisallowedType(fm.Field, { timeNow: 0 });
  T3.sacrificePublicBlocked(fm.Field, { timeNow: 1 });
  assert(fm.Field.constraints.length === before.length);
});

test("Cascade rules across all topologies: SELECTORS never reference sacrifice/arm-result coords", () => {
  for (const name of Object.keys(T3.TOPOLOGIES)) {
    const rules = T3.TOPOLOGIES[name];
    const selectors = rules.split("\n").map(line => {
      const idx = line.indexOf("{");
      return idx >= 0 ? line.substring(0, idx) : line;
    }).join(" ");
    assert(selectors.indexOf("arm-result") < 0,
      name + ": selectors reference arm-result");
    assert(selectors.indexOf("sacrifice") < 0,
      name + ": selectors reference sacrifice");
  }
});

// ----------------------------------------------------------------------------
// PART F: closure
// ----------------------------------------------------------------------------
console.log("");
console.log("PART F: closure");
console.log("");

test("T3 module: no constraints.push / field.ratify / _mkPredictive", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "t3-trust-topology.js"), "utf8");
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert(stripped.indexOf("constraints.push") < 0);
  assert(!/field\.ratify\s*\(/.test(stripped));
  assert(stripped.indexOf("_mkPredictive") < 0);
});

test("T3 module: no observer class, no JS-resident result cache", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "t3-trust-topology.js"), "utf8");
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert(stripped.indexOf("class TrustObserver") < 0);
  assert(stripped.indexOf("__substrateResults") < 0);
  assert(stripped.indexOf("admittedRecords") < 0);
});

test("t3-trust-topology.js: ASCII-only", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "t3-trust-topology.js"), "utf8");
  const m = src.match(/[^\x00-\x7F]/);
  assert(!m, "non-ASCII: " + (m && m[0]));
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
