// p5-workflow-detector-verifier.js - P5 acceptance: workflow as predictive

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const Pub = require("./contributor-publisher.js");
const WorkflowMod = require("./p5-workflow-detector.js");

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

// Time helpers
const NOW = 1700000000000;     // arbitrary "current time" in ms
const TEN_DAYS_AGO = NOW - 10 * 24 * 60 * 60 * 1000;
const FIVE_DAYS_AGO = NOW - 5 * 24 * 60 * 60 * 1000;
const ONE_DAY_AGO = NOW - 1 * 24 * 60 * 60 * 1000;

console.log("p5-workflow-detector verification (workflow as predictive reaching)");
console.log("");

// ----------------------------------------------------------------------------
// PART A: construction
// ----------------------------------------------------------------------------
console.log("PART A: detector construction");
console.log("");

test("constructor requires field", () => {
  let threw = false;
  try { new WorkflowMod.WorkflowDetector({}); } catch (e) { threw = true; }
  assert(threw);
});

test("constructor requires field.intake + constraints", () => {
  let threw = false;
  try { new WorkflowMod.WorkflowDetector({ field: {} }); } catch (e) { threw = true; }
  assert(threw);
});

test("CONFIG: 7-day stale threshold; 4 active stages; cap=16", () => {
  assert(WorkflowMod.CONFIG.STALE_THRESHOLD_MS === 7 * 24 * 60 * 60 * 1000);
  assert(WorkflowMod.CONFIG.ACTIVE_STAGES.length === 4);
  assert(WorkflowMod.CONFIG.ACTIVE_STAGES.indexOf("discovery") >= 0);
  assert(WorkflowMod.CONFIG.ACTIVE_STAGES.indexOf("won") < 0);
  assert(WorkflowMod.CONFIG.MAX_PREDICTIVES_PER_DETECT === 16);
});

// ----------------------------------------------------------------------------
// PART B: stalled-deal detection generates predictive constraint
// ----------------------------------------------------------------------------
console.log("");
console.log("PART B: detect() generates predictive constraints for stalled deals");
console.log("");

let FieldMod, field, publisher;

test("fixture: field + intake + publisher wired", () => {
  FieldMod = buildField();
  field = FieldMod.Field;
  publisher = Pub.ContributorPublisher.attach(field);
});

test("Single stalled deal: detect() generates 1 predictive", () => {
  field.reset();
  // Simulate intake state: deal D-1 is in "proposed" stage, last
  // updated 10 days ago; current time NOW
  publisher.publish({
    type: "deal-stage",
    value: { dealId: "D-1", stage: "proposed" },
    source: "test"
  });
  publisher.publish({
    type: "deal-updated-at",
    value: { dealId: "D-1", timestamp: TEN_DAYS_AGO },
    source: "test"
  });
  publisher.publish({
    type: "time-now", value: NOW, source: "time-adapter"
  });

  const det = new WorkflowMod.WorkflowDetector({ field: field });
  const r = det.detect();
  assert(r.generated === 1, "expected 1 generated; got " + r.generated);
  assert(r.stalledDeals.length === 1);
  assert(r.stalledDeals[0].dealId === "D-1");
  assert(r.stalledDeals[0].stage === "proposed");

  // Verify the predictive constraint was appended
  const preds = field.constraints.filter(c =>
    c.kind === "predictive" && c.pattern && c.pattern.type === "deal-followup"
  );
  assert(preds.length === 1);
  assert(preds[0].pattern.dealId === "D-1");
  assert(preds[0].pattern.currentStage === "proposed");
});

test("Predictive constraint shape per SE-05: kind, pattern, birth, weight", () => {
  const pred = field.constraints.find(c =>
    c.kind === "predictive" && c.pattern && c.pattern.dealId === "D-1"
  );
  assert(pred);
  assert(pred.kind === "predictive");
  assert(pred.weight === 1.0);
  assert(typeof pred.birth === "number");
  assert(typeof pred.id === "string" && pred.id.indexOf("wf::") === 0);
  assert(pred.permanent === false);
});

test("Multiple stalled deals -> multiple predictives", () => {
  field.reset();
  // Three stalled deals at different stages
  for (const dealId of ["D-A", "D-B", "D-C"]) {
    publisher.publish({
      type: "deal-stage",
      value: { dealId: dealId, stage: "qualified" },
      source: "test"
    });
    publisher.publish({
      type: "deal-updated-at",
      value: { dealId: dealId, timestamp: TEN_DAYS_AGO },
      source: "test"
    });
  }
  publisher.publish({
    type: "time-now", value: NOW, source: "time-adapter"
  });

  const det = new WorkflowMod.WorkflowDetector({ field: field });
  const r = det.detect();
  assert(r.generated === 3);
  assert(r.stalledDeals.length === 3);
});

// ----------------------------------------------------------------------------
// PART C: detect() respects active-stages, threshold, one-per-deal
// ----------------------------------------------------------------------------
console.log("");
console.log("PART C: detect() filters appropriately");
console.log("");

test("Won/lost deals do NOT generate predictives (closed stages)", () => {
  field.reset();
  publisher.publish({
    type: "deal-stage", value: { dealId: "D-W", stage: "won" }, source: "test"
  });
  publisher.publish({
    type: "deal-updated-at", value: { dealId: "D-W", timestamp: TEN_DAYS_AGO }, source: "test"
  });
  publisher.publish({
    type: "deal-stage", value: { dealId: "D-L", stage: "lost" }, source: "test"
  });
  publisher.publish({
    type: "deal-updated-at", value: { dealId: "D-L", timestamp: TEN_DAYS_AGO }, source: "test"
  });
  publisher.publish({
    type: "time-now", value: NOW, source: "time-adapter"
  });

  const det = new WorkflowMod.WorkflowDetector({ field: field });
  const r = det.detect();
  assert(r.generated === 0);
});

test("Recently-updated deals (1 day ago) do NOT generate predictives", () => {
  field.reset();
  publisher.publish({
    type: "deal-stage", value: { dealId: "D-R", stage: "discovery" }, source: "test"
  });
  publisher.publish({
    type: "deal-updated-at", value: { dealId: "D-R", timestamp: ONE_DAY_AGO }, source: "test"
  });
  publisher.publish({
    type: "time-now", value: NOW, source: "time-adapter"
  });

  const det = new WorkflowMod.WorkflowDetector({ field: field });
  const r = det.detect();
  assert(r.generated === 0);
  assert(r.stalledDeals.length === 0);
});

test("Threshold edge: 5 days ago does NOT trigger (< 7-day threshold)", () => {
  field.reset();
  publisher.publish({
    type: "deal-stage", value: { dealId: "D-E", stage: "negotiation" }, source: "test"
  });
  publisher.publish({
    type: "deal-updated-at", value: { dealId: "D-E", timestamp: FIVE_DAYS_AGO }, source: "test"
  });
  publisher.publish({
    type: "time-now", value: NOW, source: "time-adapter"
  });
  const det = new WorkflowMod.WorkflowDetector({ field: field });
  assert(det.detect().generated === 0);
});

test("Repeated detect(): one-per-deal policy honored (alreadyTracked)", () => {
  field.reset();
  publisher.publish({
    type: "deal-stage", value: { dealId: "D-1", stage: "proposed" }, source: "test"
  });
  publisher.publish({
    type: "deal-updated-at", value: { dealId: "D-1", timestamp: TEN_DAYS_AGO }, source: "test"
  });
  publisher.publish({
    type: "time-now", value: NOW, source: "time-adapter"
  });

  const det = new WorkflowMod.WorkflowDetector({ field: field });
  const r1 = det.detect();
  assert(r1.generated === 1);
  // Second pass: should not generate again
  const r2 = det.detect();
  assert(r2.generated === 0);
  assert(r2.alreadyTracked === 1);
  // Field has 2 constraints: seed + 1 predictive (not 2)
  const preds = field.constraints.filter(c =>
    c.kind === "predictive" && c.pattern.type === "deal-followup"
  );
  assert(preds.length === 1);
});

// ----------------------------------------------------------------------------
// PART D: ratifyPending - matching follow-up action ratifies predictive
// ----------------------------------------------------------------------------
console.log("");
console.log("PART D: ratifyPending - follow-up action ratifies predictive");
console.log("");

test("Follow-up record matching predictive: ratifies it", () => {
  field.reset();
  publisher.publish({
    type: "deal-stage", value: { dealId: "D-RAT", stage: "proposed" }, source: "test"
  });
  publisher.publish({
    type: "deal-updated-at", value: { dealId: "D-RAT", timestamp: TEN_DAYS_AGO }, source: "test"
  });
  publisher.publish({
    type: "time-now", value: NOW, source: "time-adapter"
  });

  const det = new WorkflowMod.WorkflowDetector({ field: field });
  det.detect();
  // Predictive exists
  const idx1 = field.constraints.findIndex(c =>
    c.kind === "predictive" && c.pattern.dealId === "D-RAT"
  );
  assert(idx1 >= 0);

  // User takes follow-up action; record arrives at intake
  publisher.publish({
    type: "deal-followup",
    value: { dealId: "D-RAT", action: "called" },
    source: "test"
  });

  const ratifiedCount = det.ratifyPending();
  assert(ratifiedCount === 1, "expected 1 ratification; got " + ratifiedCount);

  // Constraint kind transitioned to ratified
  const c = field.constraints[idx1];
  assert(c.kind === "ratified");
});

test("Ratified constraint: weight boosted (per SE-05)", () => {
  // The kernel's Field.ratify boosts weight by PRED_WEIGHT_BOOST
  const c = field.constraints.find(cc =>
    cc.kind === "ratified" && cc.pattern && cc.pattern.dealId === "D-RAT"
  );
  assert(c);
  assert(c.weight > 1.0, "weight should be > 1.0 after ratification: " + c.weight);
});

test("Follow-up for non-stalled deal: nothing to ratify", () => {
  field.reset();
  publisher.publish({
    type: "deal-followup",
    value: { dealId: "D-NONE", action: "called" },
    source: "test"
  });
  const det = new WorkflowMod.WorkflowDetector({ field: field });
  const ratifiedCount = det.ratifyPending();
  assert(ratifiedCount === 0);
});

test("Multiple deals with mixed actions: only matching ones ratify", () => {
  field.reset();
  // Two stalled deals
  for (const dealId of ["D-X", "D-Y"]) {
    publisher.publish({
      type: "deal-stage", value: { dealId: dealId, stage: "qualified" }, source: "test"
    });
    publisher.publish({
      type: "deal-updated-at", value: { dealId: dealId, timestamp: TEN_DAYS_AGO }, source: "test"
    });
  }
  publisher.publish({ type: "time-now", value: NOW, source: "time-adapter" });

  const det = new WorkflowMod.WorkflowDetector({ field: field });
  det.detect();   // generate 2 predictives

  // Only D-X gets follow-up
  publisher.publish({
    type: "deal-followup", value: { dealId: "D-X", action: "called" }, source: "test"
  });

  const ratifiedCount = det.ratifyPending();
  assert(ratifiedCount === 1);

  const dxConstraint = field.constraints.find(c => c.pattern && c.pattern.dealId === "D-X");
  const dyConstraint = field.constraints.find(c => c.pattern && c.pattern.dealId === "D-Y");
  assert(dxConstraint.kind === "ratified");
  assert(dyConstraint.kind === "predictive", "D-Y should still be predictive");
});

// ----------------------------------------------------------------------------
// PART E: F5 - ratified state irreversible
// ----------------------------------------------------------------------------
console.log("");
console.log("PART E: F5 - ratified state irreversible");
console.log("");

test("Ratified constraints stay ratified even if follow-up arrives again", () => {
  field.reset();
  publisher.publish({
    type: "deal-stage", value: { dealId: "D-IDEM", stage: "proposed" }, source: "test"
  });
  publisher.publish({
    type: "deal-updated-at", value: { dealId: "D-IDEM", timestamp: TEN_DAYS_AGO }, source: "test"
  });
  publisher.publish({ type: "time-now", value: NOW, source: "time-adapter" });

  const det = new WorkflowMod.WorkflowDetector({ field: field });
  det.detect();
  publisher.publish({
    type: "deal-followup", value: { dealId: "D-IDEM", action: "first" }, source: "test"
  });
  det.ratifyPending();

  // Second follow-up: predictive is already ratified; ratifyPending
  // should not find an active predictive to ratify
  publisher.publish({
    type: "deal-followup", value: { dealId: "D-IDEM", action: "second" }, source: "test"
  });
  const ratified2 = det.ratifyPending();
  assert(ratified2 === 0, "no active predictive remaining for D-IDEM");

  const c = field.constraints.find(cc => cc.pattern && cc.pattern.dealId === "D-IDEM");
  assert(c.kind === "ratified");
});

// ----------------------------------------------------------------------------
// PART F: F1 - seed never affected
// ----------------------------------------------------------------------------
console.log("");
console.log("PART F: F1 - seed at constraints[0] preserved");
console.log("");

test("F1: seed at [0] after detect + ratify cycles", () => {
  field.reset();
  // Start: only seed
  assert(field.constraints[0].kind === "seed");

  publisher.publish({
    type: "deal-stage", value: { dealId: "D-F1", stage: "proposed" }, source: "test"
  });
  publisher.publish({
    type: "deal-updated-at", value: { dealId: "D-F1", timestamp: TEN_DAYS_AGO }, source: "test"
  });
  publisher.publish({ type: "time-now", value: NOW, source: "time-adapter" });

  const det = new WorkflowMod.WorkflowDetector({ field: field });
  det.detect();
  assert(field.constraints[0].kind === "seed", "seed at [0] after detect");

  publisher.publish({
    type: "deal-followup", value: { dealId: "D-F1", action: "x" }, source: "test"
  });
  det.ratifyPending();
  assert(field.constraints[0].kind === "seed", "seed at [0] after ratify");
});

// ----------------------------------------------------------------------------
// PART G: I3 - bounded predictives per detect
// ----------------------------------------------------------------------------
console.log("");
console.log("PART G: I3 - bounded predictives per detect");
console.log("");

test("MAX_PREDICTIVES_PER_DETECT cap enforced", () => {
  field.reset();
  // 25 stalled deals; cap is 16
  for (let i = 0; i < 25; i++) {
    publisher.publish({
      type: "deal-stage", value: { dealId: "D-cap-" + i, stage: "discovery" }, source: "test"
    });
    publisher.publish({
      type: "deal-updated-at", value: { dealId: "D-cap-" + i, timestamp: TEN_DAYS_AGO }, source: "test"
    });
  }
  publisher.publish({ type: "time-now", value: NOW, source: "time-adapter" });

  const det = new WorkflowMod.WorkflowDetector({ field: field });
  const r = det.detect();
  assert(r.generated <= WorkflowMod.CONFIG.MAX_PREDICTIVES_PER_DETECT,
    "generated " + r.generated + " > cap " + WorkflowMod.CONFIG.MAX_PREDICTIVES_PER_DETECT);
});

// ----------------------------------------------------------------------------
// PART H: closure
// ----------------------------------------------------------------------------
console.log("");
console.log("PART H: closure");
console.log("");

test("p5-workflow-detector.js: ASCII-only", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "p5-workflow-detector.js"), "utf8");
  const m = src.match(/[^\x00-\x7F]/);
  assert(!m, "non-ASCII: " + (m && m[0]));
});

test("p5-workflow-detector.js: no host APIs leaked", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "p5-workflow-detector.js"), "utf8");
  assert(src.indexOf("localStorage") < 0);
  assert(src.indexOf("fetch(") < 0);
  assert(src.indexOf("Date.now") < 0);
  assert(src.indexOf("XMLHttpRequest") < 0);
  assert(src.indexOf("document.cookie") < 0);
});

test("p5-workflow-detector: no engine ref on detector (F3)", () => {
  const det = new WorkflowMod.WorkflowDetector({ field: field });
  assert(!det.er, "no ER ref");
  assert(!det.ct, "no CT ref");
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
