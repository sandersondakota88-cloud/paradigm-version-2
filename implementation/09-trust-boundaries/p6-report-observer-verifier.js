// p6-report-observer-verifier.js - P6 acceptance: reports as observers

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const Report = require("./p6-report-observer.js");

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
  const src = fs.readFileSync(
    path.join(__dirname, "kernel-src", "field.js"), "utf8");
  vm.runInContext(src, sandbox, { filename: "field.js" });
  // Phase 9 F2: install intake so domain records can publish through SE-08
  const ext = require(path.join(__dirname, "field-intake-extension.js"));
  ext.install(sandbox.FieldModule);
  sandbox.FieldModule.Field.reset();
  return sandbox.FieldModule;
}

// Phase 9 F2: domain records flow through intake (SE-08), not as
// kind="data" constraints. Helpers below publish to field.intake.
function publishDeal(field, id, stage, owner) {
  field.intake.publish({
    type: "domain::deal-record",
    value: { id: id, stage: stage, owner: owner },
    timestamp: 0,
    source: "p6-fixture"
  });
}

function publishContact(field, id, status) {
  field.intake.publish({
    type: "domain::contact-record",
    value: { id: id, status: status },
    timestamp: 0,
    source: "p6-fixture"
  });
}

console.log("p6-report-observer verification");
console.log("");

// ----------------------------------------------------------------------------
// PART A: construction
// ----------------------------------------------------------------------------
console.log("PART A: construction");
console.log("");

test("constructor requires field", () => {
  let threw = false;
  try { new Report.ReportObserver({ template: () => ({}) }); }
  catch (e) { threw = true; }
  assert(threw);
});

test("constructor requires template (function)", () => {
  let threw = false;
  try { new Report.ReportObserver({ field: { constraints: [] } }); }
  catch (e) { threw = true; }
  assert(threw);
});

test("Built-in templates: dealsByStage, dealsByOwner, contactsByStatus", () => {
  assert(typeof Report.TEMPLATES.dealsByStage === "function");
  assert(typeof Report.TEMPLATES.dealsByOwner === "function");
  assert(typeof Report.TEMPLATES.contactsByStatus === "function");
});

// ----------------------------------------------------------------------------
// PART B: built-in templates produce correct aggregates
// ----------------------------------------------------------------------------
console.log("");
console.log("PART B: built-in templates");
console.log("");

let FieldMod, field;

test("fixture: field with mock CRM data", () => {
  FieldMod = buildField();
  field = FieldMod.Field;
  // Add deals
  publishDeal(field, "D1", "discovery", "alice");
  publishDeal(field, "D2", "qualified", "alice");
  publishDeal(field, "D3", "qualified", "bob");
  publishDeal(field, "D4", "proposed", "bob");
  publishDeal(field, "D5", "won", "alice");
  publishDeal(field, "D6", "lost", null);   // unowned
  // Add contacts
  publishContact(field, "C1", "lead");
  publishContact(field, "C2", "lead");
  publishContact(field, "C3", "qualified");
  publishContact(field, "C4", "customer");
  publishContact(field, "C5", "churned");
  field.step = 42;
});

test("dealsByStage report counts correctly", () => {
  const r = new Report.ReportObserver({
    field: field,
    template: Report.TEMPLATES.dealsByStage,
    name: "deals-by-stage"
  });
  const out = r.generate();
  assert(out.reportType === "deals-by-stage");
  assert(out.total === 6);
  assert(out.counts.discovery === 1);
  assert(out.counts.qualified === 2);
  assert(out.counts.proposed === 1);
  assert(out.counts.won === 1);
  assert(out.counts.lost === 1);
  assert(out.asOfStep === 42);
});

test("dealsByOwner report aggregates owners + tracks unowned", () => {
  const r = new Report.ReportObserver({
    field: field,
    template: Report.TEMPLATES.dealsByOwner,
    name: "deals-by-owner"
  });
  const out = r.generate();
  assert(out.reportType === "deals-by-owner");
  assert(out.total === 6);
  assert(out.counts.alice === 3);
  assert(out.counts.bob === 2);
  assert(out.unowned === 1);
});

test("contactsByStatus report aggregates contacts", () => {
  const r = new Report.ReportObserver({
    field: field,
    template: Report.TEMPLATES.contactsByStatus,
    name: "contacts-by-status"
  });
  const out = r.generate();
  assert(out.reportType === "contacts-by-status");
  assert(out.total === 5);
  assert(out.counts.lead === 2);
  assert(out.counts.qualified === 1);
  assert(out.counts.customer === 1);
  assert(out.counts.churned === 1);
});

test("Templates ignore non-record constraints (e.g., seed, cascade rules)", () => {
  // Seed at [0] is constrant.kind="seed", not "data" with pattern.type="deal-record"
  const r = new Report.ReportObserver({
    field: field,
    template: Report.TEMPLATES.dealsByStage
  });
  const out = r.generate();
  // Total should be 6 even though field has 12 constraints (seed + 6 deals + 5 contacts)
  assert(out.total === 6, "should ignore seed/contacts; got " + out.total);
});

// ----------------------------------------------------------------------------
// PART C: O1 - read-only with respect to the field
// ----------------------------------------------------------------------------
console.log("");
console.log("PART C: O1 - observation is read-only");
console.log("");

test("Generating a report does NOT modify field.constraints", () => {
  const before = field.constraints.length;
  const beforeFirst = field.constraints[0];
  const r = new Report.ReportObserver({
    field: field, template: Report.TEMPLATES.dealsByStage
  });
  r.generate();
  r.generate();
  r.generate();
  assert(field.constraints.length === before, "constraints array length unchanged");
  assert(field.constraints[0] === beforeFirst, "first constraint identity preserved");
});

test("Generating a report does NOT modify field.intake", () => {
  // Trigger intake change detection (any modification would be visible)
  const intakeBefore = field.intake ? field.intake.records.length : 0;
  const r = new Report.ReportObserver({
    field: field, template: Report.TEMPLATES.dealsByOwner
  });
  r.generate();
  const intakeAfter = field.intake ? field.intake.records.length : 0;
  assert(intakeBefore === intakeAfter);
});

test("Field step does NOT advance from generating reports", () => {
  const stepBefore = field.step;
  const r = new Report.ReportObserver({
    field: field, template: Report.TEMPLATES.contactsByStatus
  });
  r.generate();
  r.generate();
  assert(field.step === stepBefore, "step unchanged: " + field.step);
});

test("Snapshot is a defensive copy: malicious template cannot mutate field", () => {
  // A template that tries to write back through the snapshot
  let attemptedWrite = false;
  const evilTemplate = function (snapshot) {
    attemptedWrite = true;
    // Try to add a constraint via the snapshot
    snapshot.constraints.push({ id: "INJECTED" });
    return { ok: true };
  };
  const constraintsBefore = field.constraints.length;
  const r = new Report.ReportObserver({
    field: field, template: evilTemplate
  });
  r.generate();
  assert(attemptedWrite);
  // Field unmodified despite the template's mutation attempt
  assert(field.constraints.length === constraintsBefore,
    "field constraint count should be unchanged: " + field.constraints.length);
  // The injected constraint is in the SNAPSHOT, but not in the field
  const hasInjected = field.constraints.some(c => c && c.id === "INJECTED");
  assert(!hasInjected, "INJECTED should not appear in field");
});

// ----------------------------------------------------------------------------
// PART D: O2 - bounded retention
// ----------------------------------------------------------------------------
console.log("");
console.log("PART D: O2 - bounded retention");
console.log("");

test("Output history capped at MAX_HISTORY", () => {
  const r = new Report.ReportObserver({
    field: field,
    template: Report.TEMPLATES.dealsByStage,
    config: { MAX_HISTORY: 5 }
  });
  for (let i = 0; i < 15; i++) {
    r.generate();
  }
  const h = r.history();
  assert(h.length === 5, "history capped at 5; got " + h.length);
  // FIFO eviction: oldest dropped, newest retained
  assert(r.observe().generations === 15);
});

test("Default MAX_HISTORY is 100", () => {
  assert(Report.CONFIG.MAX_HISTORY === 100);
});

// ----------------------------------------------------------------------------
// PART E: O3 - vocabulary sourced from field state
// ----------------------------------------------------------------------------
console.log("");
console.log("PART E: O3 - vocabulary sourced from field");
console.log("");

test("Stage labels in dealsByStage output appear in field state", () => {
  const r = new Report.ReportObserver({
    field: field, template: Report.TEMPLATES.dealsByStage
  });
  const out = r.generate();
  // Every stage label in the report's counts should be present in some
  // domain::deal-record intake record's value.stage (Phase 9 F2)
  const fieldStages = new Set();
  for (const rec of field.intake.records) {
    if (rec && rec.type === "domain::deal-record" && rec.value && rec.value.stage) {
      fieldStages.add(rec.value.stage);
    }
  }
  for (const stage of Object.keys(out.counts)) {
    assert(fieldStages.has(stage),
      "stage '" + stage + "' in report but not in field");
  }
});

test("Owner ids in dealsByOwner output appear in field state", () => {
  const r = new Report.ReportObserver({
    field: field, template: Report.TEMPLATES.dealsByOwner
  });
  const out = r.generate();
  const fieldOwners = new Set();
  for (const rec of field.intake.records) {
    if (rec && rec.type === "domain::deal-record" && rec.value && rec.value.owner) {
      fieldOwners.add(rec.value.owner);
    }
  }
  for (const owner of Object.keys(out.counts)) {
    assert(fieldOwners.has(owner),
      "owner '" + owner + "' in report but not in field");
  }
});

test("If field has no records of a type, report counts are empty", () => {
  // Build a field with NO deals; report should produce empty counts
  const fm2 = buildField();
  const f2 = fm2.Field;
  // Add only contacts
  publishContact(f2, "C1", "lead");
  const r = new Report.ReportObserver({
    field: f2, template: Report.TEMPLATES.dealsByStage
  });
  const out = r.generate();
  assert(out.total === 0);
  assert(Object.keys(out.counts).length === 0,
    "no stages should appear if no deals: " + JSON.stringify(out.counts));
});

// ----------------------------------------------------------------------------
// PART F: F3 - template errors do not crash
// ----------------------------------------------------------------------------
console.log("");
console.log("PART F: F3 - template errors handled gracefully");
console.log("");

test("Template throwing returns structured error output", () => {
  const r = new Report.ReportObserver({
    field: field,
    template: function () { throw new Error("template-blew-up"); }
  });
  const out = r.generate();
  assert(out.error === "template-blew-up");
  assert(out.partial === true);
  assert(r.observe().templateErrors === 1);
});

test("Template returning null produces structured error", () => {
  const r = new Report.ReportObserver({
    field: field,
    template: function () { return null; }
  });
  const out = r.generate();
  assert(out.partial === true);
  assert(typeof out.error === "string");
});

test("After a template error, observer remains usable for next call", () => {
  let throwOnce = true;
  const r = new Report.ReportObserver({
    field: field,
    template: function (s) {
      if (throwOnce) { throwOnce = false; throw new Error("once"); }
      return { ok: true, total: s.constraints.length };
    }
  });
  const out1 = r.generate();
  assert(out1.partial);
  const out2 = r.generate();
  assert(out2.ok === true);
  assert(out2.total > 0);
});

// ----------------------------------------------------------------------------
// PART G: closure
// ----------------------------------------------------------------------------
console.log("");
console.log("PART G: closure");
console.log("");

test("p6-report-observer.js: ASCII-only", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "p6-report-observer.js"), "utf8");
  const m = src.match(/[^\x00-\x7F]/);
  assert(!m, "non-ASCII: " + (m && m[0]));
});

test("p6-report-observer.js: no host APIs leaked", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "p6-report-observer.js"), "utf8");
  assert(src.indexOf("localStorage") < 0);
  assert(src.indexOf("fetch(") < 0);
  assert(src.indexOf("Date.now") < 0);
  assert(src.indexOf("XMLHttpRequest") < 0);
});

test("Observer holds no engine refs (F3)", () => {
  const r = new Report.ReportObserver({
    field: field, template: Report.TEMPLATES.dealsByStage
  });
  assert(!r.er, "no ER ref");
  assert(!r.ct, "no CT ref");
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
