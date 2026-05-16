// p8-form-validator-verifier.js - P8 acceptance: validation as cascade

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const Pub = require("./contributor-publisher.js");
const Validator = require("./p8-form-validator.js");
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

// Cascade-match simulation (same as P2 verifier)
// Phase 9 F1 closure: route both single-cascade and cascade-all through
// the ACTUAL kernel-cascade-evaluator instead of approximating its logic.
const F1Harness = require("./f1-cascade-harness.js");
function simulateCascade(rules, coords) {
  return F1Harness.runCascade(rules, coords);
}
function simulateCascadeAll(rules, coords) {
  const r = F1Harness.runCascadeAll(rules, coords);
  return r.emitted;
}

console.log("p8-form-validator verification (validation as cascade)");
console.log("");

// ----------------------------------------------------------------------------
// PART A: validator publish flow
// ----------------------------------------------------------------------------
console.log("PART A: validator publish flow");
console.log("");

let FieldMod, field, publisher, validator;

test("constructor requires publisher", () => {
  let threw = false;
  try { new Validator.FormValidator({}); } catch (e) { threw = true; }
  assert(threw);
});

test("Built-in validators: email, phone, name, text", () => {
  const v = Validator.BUILTIN_VALIDATORS;
  assert(typeof v.email === "function");
  assert(typeof v.phone === "function");
  assert(typeof v.name === "function");
  assert(typeof v.text === "function");
});

test("fixture: field + intake wired", () => {
  FieldMod = buildField();
  field = FieldMod.Field;
  publisher = Pub.ContributorPublisher.attach(field);
  validator = new Validator.FormValidator({ publisher: publisher });
});

test("Email validator: valid input publishes empty=0 + pattern=match", () => {
  field.intake.clear();
  validator.validate({ fieldName: "email", fieldType: "email", value: "a@b.co" });
  const recs = field.intake.records;
  assert(recs.length === 3);
  const byType = {};
  for (const r of recs) byType[r.type] = r.value;
  assert(byType["email-empty"] === "0");
  assert(byType["email-pattern"] === "match");
  assert(byType["email-length"] === "6");
});

test("Email validator: invalid input publishes pattern=no-match", () => {
  field.intake.clear();
  validator.validate({ fieldName: "email", fieldType: "email", value: "not-an-email" });
  const recs = field.intake.records;
  const byType = {};
  for (const r of recs) byType[r.type] = r.value;
  assert(byType["email-empty"] === "0");
  assert(byType["email-pattern"] === "no-match");
});

test("Email validator: empty string publishes empty=1", () => {
  field.intake.clear();
  validator.validate({ fieldName: "email", fieldType: "email", value: "" });
  const recs = field.intake.records;
  const byType = {};
  for (const r of recs) byType[r.type] = r.value;
  assert(byType["email-empty"] === "1");
  // Pattern check fails for empty string per our regex
  assert(byType["email-pattern"] === "no-match");
});

test("Phone validator: international format passes", () => {
  field.intake.clear();
  validator.validate({ fieldName: "phone", fieldType: "phone", value: "+1-555-123-4567" });
  const recs = field.intake.records;
  const byType = {};
  for (const r of recs) byType[r.type] = r.value;
  assert(byType["phone-pattern"] === "match");
});

test("Phone validator: alphanumeric fails", () => {
  field.intake.clear();
  validator.validate({ fieldName: "phone", fieldType: "phone", value: "abc-1234" });
  const byType = {};
  for (const r of field.intake.records) byType[r.type] = r.value;
  assert(byType["phone-pattern"] === "no-match");
});

test("Name validator: bounded length + no leading/trailing whitespace", () => {
  field.intake.clear();
  validator.validate({ fieldName: "name", fieldType: "name", value: "Alice Smith" });
  const byType1 = {};
  for (const r of field.intake.records) byType1[r.type] = r.value;
  assert(byType1["name-pattern"] === "match");

  field.intake.clear();
  validator.validate({ fieldName: "name", fieldType: "name", value: "  Alice  " });
  const byType2 = {};
  for (const r of field.intake.records) byType2[r.type] = r.value;
  assert(byType2["name-pattern"] === "no-match");
});

test("Unknown fieldType falls back to text validator", () => {
  field.intake.clear();
  validator.validate({ fieldName: "notes", fieldType: "totally-unknown", value: "hello" });
  const byType = {};
  for (const r of field.intake.records) byType[r.type] = r.value;
  assert(byType["notes-pattern"] === "match");
});

test("validateAll batch: all fields published", () => {
  field.intake.clear();
  validator.validateAll({
    name: { fieldType: "name", value: "Alice Smith" },
    email: { fieldType: "email", value: "alice@example.com" },
    phone: { fieldType: "phone", value: "+15551234567" }
  });
  // 3 fields x 3 records = 9
  assert(field.intake.records.length === 9);
});

// ----------------------------------------------------------------------------
// PART B: cascade rules combine characterizing -> per-field validity
// ----------------------------------------------------------------------------
console.log("");
console.log("PART B: per-field validity cascade rules");
console.log("");

// Per-field validity cascade rules (synthesized from CSS):
// "Field is valid when not empty AND pattern matches"
const PER_FIELD_VALIDITY_CSS = [
  '[data-form="contact"][data-name-empty="0"][data-name-pattern="match"] { --name-valid: "1"; }',
  '[data-form="contact"][data-name-empty="1"] { --name-valid: "0"; }',
  '[data-form="contact"][data-name-pattern="no-match"][data-name-empty="0"] { --name-valid: "0"; }',
  '[data-form="contact"][data-email-empty="0"][data-email-pattern="match"] { --email-valid: "1"; }',
  '[data-form="contact"][data-email-empty="1"] { --email-valid: "0"; }',
  '[data-form="contact"][data-email-pattern="no-match"][data-email-empty="0"] { --email-valid: "0"; }',
  '[data-form="contact"][data-phone-empty="0"][data-phone-pattern="match"] { --phone-valid: "1"; }',
  '[data-form="contact"][data-phone-empty="1"] { --phone-valid: "0"; }',
  '[data-form="contact"][data-phone-pattern="no-match"][data-phone-empty="0"] { --phone-valid: "0"; }'
].join("\n");

let perFieldRules;

test("Synthesize per-field validity rules", () => {
  const r = Synth.synthesizeFromCss(PER_FIELD_VALIDITY_CSS);
  assert(r.ok, "synthesis failed: " + JSON.stringify(r.errors));
  perFieldRules = r.constraints;
  assert(perFieldRules.length === 9);
});

test("Valid name+email+phone -> all per-field _valid='1'", () => {
  const coords = {
    "data-form": "contact",
    "data-name-empty": "0", "data-name-pattern": "match",
    "data-email-empty": "0", "data-email-pattern": "match",
    "data-phone-empty": "0", "data-phone-pattern": "match"
  };
  const out = simulateCascadeAll(perFieldRules, coords);
  assert(out["--name-valid"] === "1");
  assert(out["--email-valid"] === "1");
  assert(out["--phone-valid"] === "1");
});

test("Empty email -> email-valid='0'; others valid", () => {
  const coords = {
    "data-form": "contact",
    "data-name-empty": "0", "data-name-pattern": "match",
    "data-email-empty": "1", "data-email-pattern": "no-match",
    "data-phone-empty": "0", "data-phone-pattern": "match"
  };
  const out = simulateCascadeAll(perFieldRules, coords);
  assert(out["--name-valid"] === "1");
  assert(out["--email-valid"] === "0");
  assert(out["--phone-valid"] === "1");
});

test("Bad email pattern -> email-valid='0'", () => {
  const coords = {
    "data-form": "contact",
    "data-name-empty": "0", "data-name-pattern": "match",
    "data-email-empty": "0", "data-email-pattern": "no-match",
    "data-phone-empty": "0", "data-phone-pattern": "match"
  };
  const out = simulateCascadeAll(perFieldRules, coords);
  assert(out["--email-valid"] === "0");
});

// ----------------------------------------------------------------------------
// PART C: aggregate validity + submit gating
// ----------------------------------------------------------------------------
console.log("");
console.log("PART C: form-validity aggregation + submit cascade rule");
console.log("");

// Aggregate cascade rules use the cascade-output coords from PART B as
// inputs. In a real deposition, the cascade evaluator runs multiple
// passes; we simulate by composing the outputs. Here the form-validity
// rule MATCHES on data-name-valid="1" etc. (the cascade output from
// PART B is projected to data-* attrs by the bridge).
const FORM_VALIDITY_CSS = [
  // All three valid -> form-validity=valid
  '[data-form="contact"][data-name-valid="1"][data-email-valid="1"][data-phone-valid="1"] { --form-validity: "valid"; }',
  // Submit rule: only when form-validity=valid
  '[data-form="contact"][data-form-validity="valid"][data-trigger="submit"] { --next-op: "submitContactForm"; }'
].join("\n");

let aggregateRules;

test("Synthesize form-validity + submit rules", () => {
  const r = Synth.synthesizeFromCss(FORM_VALIDITY_CSS);
  assert(r.ok);
  aggregateRules = r.constraints;
  assert(aggregateRules.length === 2);
});

test("All fields valid -> form-validity=valid", () => {
  const coords = {
    "data-form": "contact",
    "data-name-valid": "1", "data-email-valid": "1", "data-phone-valid": "1"
  };
  const out = simulateCascadeAll(aggregateRules, coords);
  assert(out["--form-validity"] === "valid");
});

test("One field invalid -> form-validity rule does NOT match", () => {
  const coords = {
    "data-form": "contact",
    "data-name-valid": "1", "data-email-valid": "0", "data-phone-valid": "1"
  };
  const out = simulateCascadeAll(aggregateRules, coords);
  assert(!("--form-validity" in out),
    "form-validity should not be 'valid' when email invalid");
});

test("Submit + form valid -> --next-op=submitContactForm", () => {
  const coords = {
    "data-form": "contact",
    "data-form-validity": "valid",
    "data-trigger": "submit"
  };
  const r = simulateCascade(aggregateRules, coords);
  assert(r.matched);
  assert(r.op === "submitContactForm");
});

test("Submit + form INVALID -> rule does not match (no op dispatched)", () => {
  const coords = {
    "data-form": "contact",
    "data-form-validity": "invalid",
    "data-trigger": "submit"
  };
  // The rule requires data-form-validity="valid"; "invalid" doesn't match.
  // The submit attempt produces no --next-op, so no op is dispatched.
  for (const rule of aggregateRules) {
    if (rule.emit.property === "--next-op") {
      // Walk just this rule's selector
      const sel = rule.pattern.selector;
      let allMatch = true;
      for (const k of Object.keys(sel)) {
        if (coords[k] !== sel[k]) { allMatch = false; break; }
      }
      assert(!allMatch, "submit rule should not match");
    }
  }
});

// ----------------------------------------------------------------------------
// PART D: end-to-end - validator publishes; cascade rules resolve
// ----------------------------------------------------------------------------
console.log("");
console.log("PART D: end-to-end - validator -> cascade -> form-validity");
console.log("");

test("End-to-end: valid form data flows through both rule passes", () => {
  field.intake.clear();
  // Simulate user-typed input
  validator.validateAll({
    name:  { fieldType: "name",  value: "Alice Smith" },
    email: { fieldType: "email", value: "alice@example.com" },
    phone: { fieldType: "phone", value: "+15551234567" }
  });

  // Build coords from the latest intake state (FIFO last wins)
  const coords = { "data-form": "contact" };
  for (const rec of field.intake.records) {
    coords["data-" + rec.type] = String(rec.value);
  }

  // Pass 1: per-field validity
  const pass1 = simulateCascadeAll(perFieldRules, coords);
  // Project pass1 outputs back as data-* coords (bridge would do this)
  if (pass1["--name-valid"]) coords["data-name-valid"] = pass1["--name-valid"];
  if (pass1["--email-valid"]) coords["data-email-valid"] = pass1["--email-valid"];
  if (pass1["--phone-valid"]) coords["data-phone-valid"] = pass1["--phone-valid"];

  // Pass 2: aggregate validity
  const pass2 = simulateCascadeAll(aggregateRules, coords);
  assert(pass2["--form-validity"] === "valid",
    "expected form-validity=valid, got " + pass2["--form-validity"]);
});

test("End-to-end: invalid email blocks form-validity=valid", () => {
  field.intake.clear();
  validator.validateAll({
    name:  { fieldType: "name",  value: "Alice Smith" },
    email: { fieldType: "email", value: "not-an-email" },
    phone: { fieldType: "phone", value: "+15551234567" }
  });
  const coords = { "data-form": "contact" };
  for (const rec of field.intake.records) {
    coords["data-" + rec.type] = String(rec.value);
  }
  const pass1 = simulateCascadeAll(perFieldRules, coords);
  if (pass1["--name-valid"]) coords["data-name-valid"] = pass1["--name-valid"];
  if (pass1["--email-valid"]) coords["data-email-valid"] = pass1["--email-valid"];
  if (pass1["--phone-valid"]) coords["data-phone-valid"] = pass1["--phone-valid"];
  assert(coords["data-email-valid"] === "0");
  const pass2 = simulateCascadeAll(aggregateRules, coords);
  assert(!("--form-validity" in pass2),
    "form-validity should not resolve when email invalid");
});

// ----------------------------------------------------------------------------
// PART E: invariants
// ----------------------------------------------------------------------------
console.log("");
console.log("PART E: invariants");
console.log("");

test("F3: validate returns void; no engine ref on validator", () => {
  const v = new Validator.FormValidator({ publisher: publisher });
  const r = v.validate({ fieldName: "x", fieldType: "text", value: "y" });
  assert(r === undefined);
  assert(!v.field);
  assert(!v.er);
});

test("Validator throwing in custom validator does not propagate (F3)", () => {
  const v = new Validator.FormValidator({
    publisher: publisher,
    validators: { boom: function () { throw new Error("validator-error"); } }
  });
  let threw = false;
  try { v.validate({ fieldName: "x", fieldType: "boom", value: "y" }); }
  catch (e) { threw = true; }
  assert(!threw);
});

test("M5: validate does not write Trace", () => {
  const traceBefore = FieldMod.Trace.entries.length;
  validator.validate({ fieldName: "x", fieldType: "email", value: "a@b.co" });
  const traceAfter = FieldMod.Trace.entries.length;
  assert(traceAfter === traceBefore);
});

// ----------------------------------------------------------------------------
// PART F: closure
// ----------------------------------------------------------------------------
console.log("");
console.log("PART F: closure");
console.log("");

test("p8-form-validator.js: regex IS in adapter (legitimate site)", () => {
  const src = fs.readFileSync(path.join(__dirname, "p8-form-validator.js"), "utf8");
  assert(src.indexOf("/^") >= 0, "regex compilation expected in validator");
});

test("p8-form-validator.js: no host APIs leaked", () => {
  const src = fs.readFileSync(path.join(__dirname, "p8-form-validator.js"), "utf8");
  assert(src.indexOf("localStorage") < 0);
  assert(src.indexOf("fetch(") < 0);
  assert(src.indexOf("Date.now") < 0);
  assert(src.indexOf("XMLHttpRequest") < 0);
  assert(src.indexOf("WebSocket") < 0);
  assert(src.indexOf("document.cookie") < 0);
});

test("p8-form-validator.js: ASCII-only", () => {
  const src = fs.readFileSync(path.join(__dirname, "p8-form-validator.js"), "utf8");
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
