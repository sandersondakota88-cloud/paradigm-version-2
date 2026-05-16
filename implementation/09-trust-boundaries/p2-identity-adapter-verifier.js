// p2-identity-adapter-verifier.js - P2 acceptance: auth as cascade

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const Pub = require("./contributor-publisher.js");
const IdentityModule = require("./p2-identity-adapter.js");
const Synth = require("./cascade-rule-synthesizer.js");

let pass = 0, fail = 0;
const failures = [];

function test(name, fn) {
  try { fn(); pass++; console.log("  OK   " + name); }
  catch (e) { fail++; failures.push({ name, error: e }); console.log("  FAIL " + name + ": " + e.message); }
}
function assert(c, m) { if (!c) throw new Error("assertion failed: " + (m || "")); }

// ----------------------------------------------------------------------------
// Field fixture
// ----------------------------------------------------------------------------
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

console.log("p2-identity-adapter verification (auth as cascade)");
console.log("");

// ----------------------------------------------------------------------------
// PART A: adapter construction
// ----------------------------------------------------------------------------
console.log("PART A: adapter construction");
console.log("");

test("constructor requires publisher", () => {
  let threw = false;
  try { new IdentityModule.IdentityAdapter({}); } catch (e) { threw = true; }
  assert(threw);
});

test("VALID_ROLES enumerates 4 roles per P1 sec 4.4", () => {
  assert(IdentityModule.VALID_ROLES.length === 4);
  assert(IdentityModule.VALID_ROLES.indexOf("admin") >= 0);
  assert(IdentityModule.VALID_ROLES.indexOf("manager") >= 0);
  assert(IdentityModule.VALID_ROLES.indexOf("rep") >= 0);
  assert(IdentityModule.VALID_ROLES.indexOf("viewer") >= 0);
});

test("VALID_VALIDITY enumerates 3 states", () => {
  assert(IdentityModule.VALID_VALIDITY.length === 3);
  assert(IdentityModule.VALID_VALIDITY.indexOf("valid") >= 0);
  assert(IdentityModule.VALID_VALIDITY.indexOf("expired") >= 0);
  assert(IdentityModule.VALID_VALIDITY.indexOf("none") >= 0);
});

// ----------------------------------------------------------------------------
// PART B: setSession / clearSession publish flow
// ----------------------------------------------------------------------------
console.log("");
console.log("PART B: identity publish flow");
console.log("");

let FieldMod, field, publisher, adapter;

test("fixture: field + intake wired", () => {
  FieldMod = buildField();
  field = FieldMod.Field;
  publisher = Pub.ContributorPublisher.attach(field);
  adapter = new IdentityModule.IdentityAdapter({ publisher: publisher });
});

test("setSession publishes user-id, user-role, session-validity", () => {
  field.intake.clear();
  adapter.setSession({ user_id: "u-42", role: "admin" });

  const recs = field.intake.records;
  assert(recs.length === 3, "expected 3 records, got " + recs.length);
  const byType = {};
  for (const r of recs) byType[r.type] = r.value;
  assert(byType["user-id"] === "u-42");
  assert(byType["user-role"] === "admin");
  assert(byType["session-validity"] === "valid");
  // All from identity-adapter
  for (const r of recs) {
    assert(r.source === "identity-adapter");
  }
});

test("setSession: invalid role rejected (validation)", () => {
  field.intake.clear();
  const before = adapter.stats.validationFailures;
  adapter.setSession({ user_id: "u-1", role: "superuser" });   // not in VALID_ROLES
  assert(field.intake.records.length === 0);
  assert(adapter.stats.validationFailures === before + 1);
});

test("setSession: same session twice does not republish (S1)", () => {
  field.intake.clear();
  adapter.setSession({ user_id: "u-42", role: "admin" });
  const after1 = field.intake.records.length;
  adapter.setSession({ user_id: "u-42", role: "admin" });
  assert(field.intake.records.length === after1, "redundant publish");
});

test("setSession with expired=true publishes session-validity='expired'", () => {
  field.intake.clear();
  adapter.setSession({ user_id: "u-42", role: "admin", expired: true });
  const recs = field.intake.records;
  const valState = recs.find(r => r.type === "session-validity");
  assert(valState);
  assert(valState.value === "expired");
});

test("clearSession publishes empty values + session-validity='none'", () => {
  field.intake.clear();
  // Re-establish a session first
  adapter.setSession({ user_id: "u-99", role: "rep" });
  field.intake.clear();
  adapter.clearSession();
  const recs = field.intake.records;
  assert(recs.length === 3);
  const byType = {};
  for (const r of recs) byType[r.type] = r.value;
  assert(byType["user-id"] === "");
  assert(byType["user-role"] === "");
  assert(byType["session-validity"] === "none");
});

test("clearSession: idempotent (clearing already-cleared does nothing)", () => {
  field.intake.clear();
  adapter.clearSession();
  assert(field.intake.records.length === 0);
});

// ----------------------------------------------------------------------------
// PART C: cascade gating with synthesized rules
// ----------------------------------------------------------------------------
console.log("");
console.log("PART C: auth as cascade - rules gate ops by role + session");
console.log("");

// Synthesize the auth-gating cascade rule. Per P1 sec 4.4:
//   "[data-substrate-state][data-session-validity='valid']
//    [data-user-role='admin'][data-target='user-edit']
//    { --next-op: 'openUserEditor' }"
const AUTH_CASCADE_CSS = [
  '[data-substrate-state][data-session-validity="valid"][data-user-role="admin"][data-target="user-edit"] { --next-op: "openUserEditor"; }',
  '[data-substrate-state][data-session-validity="valid"][data-user-role="admin"][data-target="user-edit"][data-user-role="manager"] { --next-op: "openUserEditor"; }',
  '[data-substrate-state][data-session-validity="valid"][data-target="contact-list"] { --next-op: "showContactList"; }'
].join("\n");

let cascadeRules;

test("Synthesize auth cascade rules", () => {
  const r = Synth.synthesizeFromCss(AUTH_CASCADE_CSS);
  assert(r.ok, "synthesis failed: " + JSON.stringify(r.errors));
  cascadeRules = r.constraints;
  assert(cascadeRules.length === 3);
});

// Helper: run cascade through the ACTUAL kernel-cascade-evaluator
// (per Phase 9 F1: closure on emitted form). Replaces the earlier
// simulateCascade that approximated the evaluator's logic.
const F1Harness = require("./f1-cascade-harness.js");
function simulateCascade(rules, coords) {
  return F1Harness.runCascade(rules, coords);
}

test("Admin + valid session + target=user-edit -> openUserEditor", () => {
  const coords = {
    "data-substrate-state": "",
    "data-session-validity": "valid",
    "data-user-role": "admin",
    "data-target": "user-edit"
  };
  const r = simulateCascade(cascadeRules, coords);
  assert(r.matched);
  assert(r.op === "openUserEditor");
});

test("Non-admin (rep) + same target: rule does not match", () => {
  const coords = {
    "data-substrate-state": "",
    "data-session-validity": "valid",
    "data-user-role": "rep",
    "data-target": "user-edit"
  };
  const r = simulateCascade(cascadeRules, coords);
  assert(!r.matched);
});

test("Admin + EXPIRED session + same target: rule does not match", () => {
  const coords = {
    "data-substrate-state": "",
    "data-session-validity": "expired",
    "data-user-role": "admin",
    "data-target": "user-edit"
  };
  const r = simulateCascade(cascadeRules, coords);
  assert(!r.matched);
});

test("Admin + NO session + target=user-edit: rule does not match", () => {
  const coords = {
    "data-substrate-state": "",
    "data-session-validity": "none",
    "data-user-role": "",
    "data-target": "user-edit"
  };
  const r = simulateCascade(cascadeRules, coords);
  assert(!r.matched);
});

test("Viewer + valid session + target=contact-list: showContactList rule matches", () => {
  // contact-list is not auth-gated by role; valid session is sufficient
  const coords = {
    "data-substrate-state": "",
    "data-session-validity": "valid",
    "data-user-role": "viewer",
    "data-target": "contact-list"
  };
  const r = simulateCascade(cascadeRules, coords);
  assert(r.matched);
  assert(r.op === "showContactList");
});

test("Viewer + NO session + target=contact-list: rule does not match", () => {
  const coords = {
    "data-substrate-state": "",
    "data-session-validity": "none",
    "data-user-role": "",
    "data-target": "contact-list"
  };
  const r = simulateCascade(cascadeRules, coords);
  assert(!r.matched);
});

// ----------------------------------------------------------------------------
// PART D: session expiry transition via sessionSource polling
// ----------------------------------------------------------------------------
console.log("");
console.log("PART D: session expiry transition");
console.log("");

test("sessionSource polling: valid -> expired transition detected", () => {
  field.intake.clear();
  let currentSession = { user_id: "u-7", role: "manager", expired: false };
  const source = {
    getCurrentSession() { return currentSession; }
  };
  const a = new IdentityModule.IdentityAdapter({
    publisher: publisher,
    sessionSource: source
  });

  // Simulate a poll cycle (start would call _pollSession, but in test we
  // call directly to avoid timer dependence)
  a._pollSession();
  // 3 records published for valid session
  assert(field.intake.records.length === 3);

  // Time passes; session expires
  field.intake.clear();
  currentSession = { user_id: "u-7", role: "manager", expired: true };
  a._pollSession();
  // session-validity republished as "expired"; user-id and role same so
  // change-detection only republishes the changed fields... actually our
  // implementation publishes all 3 on any change. That's acceptable.
  assert(field.intake.records.length === 3);
  const valState = field.intake.records.find(r => r.type === "session-validity");
  assert(valState.value === "expired");
  assert(a.stats.expiryDetected === 1);
});

test("sessionSource returning null clears the session", () => {
  field.intake.clear();
  let currentSession = { user_id: "u-8", role: "rep", expired: false };
  const source = {
    getCurrentSession() { return currentSession; }
  };
  const a = new IdentityModule.IdentityAdapter({
    publisher: publisher,
    sessionSource: source
  });
  a._pollSession();   // publish
  field.intake.clear();
  currentSession = null;
  a._pollSession();   // should clearSession
  const recs = field.intake.records;
  assert(recs.length === 3);
  const byType = {};
  for (const r of recs) byType[r.type] = r.value;
  assert(byType["session-validity"] === "none");
});

test("sessionSource throwing does not propagate (F3)", () => {
  const source = {
    getCurrentSession() { throw new Error("source-blew-up"); }
  };
  const a = new IdentityModule.IdentityAdapter({
    publisher: publisher,
    sessionSource: source
  });
  // Should not throw
  let threw = false;
  try { a._pollSession(); } catch (e) { threw = true; }
  assert(!threw);
});

// ----------------------------------------------------------------------------
// PART E: invariants (F3, S1, I3, M5)
// ----------------------------------------------------------------------------
console.log("");
console.log("PART E: invariants");
console.log("");

test("F3: setSession returns void; no engine ref on adapter", () => {
  const a = new IdentityModule.IdentityAdapter({ publisher: publisher });
  const r = a.setSession({ user_id: "u-1", role: "admin" });
  assert(r === undefined);
  assert(!a.field);
  assert(!a.er);
  assert(!a.ct);
});

test("S1: publisher.field is the same field substrate uses", () => {
  const a = new IdentityModule.IdentityAdapter({ publisher: publisher });
  assert(a.publisher.field === field);
});

test("I3: rapid setSession -> field intake bounded by cap", () => {
  field.intake.clear();
  const a = new IdentityModule.IdentityAdapter({ publisher: publisher });
  const cap = field.intake.cap;
  // setSession publishes 3 records each (user-id, role, validity)
  // with change-detection; alternating sessions force republish.
  for (let i = 0; i < cap + 100; i++) {
    a.setSession({
      user_id: "u-" + (i % 2),    // alternate to defeat change-detection
      role: "admin"
    });
  }
  assert(field.intake.records.length === cap);
});

test("M5: setSession does not write Trace", () => {
  const a = new IdentityModule.IdentityAdapter({ publisher: publisher });
  const traceBefore = FieldMod.Trace.entries.length;
  a.setSession({ user_id: "u-1", role: "admin" });
  // intentionally republish to defeat change-detection
  a.setSession({ user_id: "u-2", role: "admin" });
  const traceAfter = FieldMod.Trace.entries.length;
  assert(traceAfter === traceBefore);
});

// ----------------------------------------------------------------------------
// PART F: closure (sec 3.1)
// ----------------------------------------------------------------------------
console.log("");
console.log("PART F: closure (sec 3.1)");
console.log("");

test("p2-identity-adapter.js: no localStorage, no fetch, no XMLHttpRequest", () => {
  const src = fs.readFileSync(path.join(__dirname, "p2-identity-adapter.js"), "utf8");
  assert(src.indexOf("localStorage") < 0);
  assert(src.indexOf("fetch(") < 0);
  assert(src.indexOf("XMLHttpRequest") < 0);
  assert(src.indexOf("WebSocket") < 0);
});

test("p2-identity-adapter.js: no Date.now (identity has no clock dependency)", () => {
  const src = fs.readFileSync(path.join(__dirname, "p2-identity-adapter.js"), "utf8");
  // The adapter doesn't read host time; the time-adapter already covers that.
  assert(src.indexOf("Date.now") < 0);
});

test("p2-identity-adapter.js: ASCII-only (I1)", () => {
  const src = fs.readFileSync(path.join(__dirname, "p2-identity-adapter.js"), "utf8");
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
