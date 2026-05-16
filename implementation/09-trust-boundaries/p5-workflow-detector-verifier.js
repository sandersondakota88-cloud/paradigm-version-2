// p5-workflow-detector-verifier.js - P5 acceptance: commitment projection

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

function publishDealState(field, dealId, stage, updatedAt) {
  field.intake.publish({
    type: "deal-stage",
    value: { dealId: dealId, stage: stage },
    timestamp: 0,
    source: "fixture"
  });
  field.intake.publish({
    type: "deal-updated-at",
    value: { dealId: dealId, timestamp: updatedAt },
    timestamp: 0,
    source: "fixture"
  });
}

function publishTimeNow(field, t) {
  field.intake.publish({
    type: "time-now",
    value: t,
    timestamp: t,
    source: "time-adapter"
  });
}

function signalsInIntake(field) {
  return field.intake.records.filter(
    r => r && r.type === "domain::workflow-signal");
}

console.log("p5-workflow-detector verification (F3 corrected: commitment projector)");
console.log("");

// ----------------------------------------------------------------------------
// PART A: construction
// ----------------------------------------------------------------------------
console.log("PART A: construction");
console.log("");

test("constructor requires field", () => {
  let threw = false;
  try { new WorkflowMod.WorkflowCommitmentProjector({}); }
  catch (_) { threw = true; }
  assert(threw, "expected throw");
});

test("constructor requires field.intake", () => {
  let threw = false;
  try { new WorkflowMod.WorkflowCommitmentProjector({ field: {} }); }
  catch (_) { threw = true; }
  assert(threw, "expected throw");
});

test("DEFAULT_COMMITMENTS: 7-day stale threshold; 4 active stages", () => {
  const c = WorkflowMod.DEFAULT_COMMITMENTS;
  assert(c.staleThresholdMs === 7 * 24 * 60 * 60 * 1000);
  assert(c.activeStages.length === 4);
  assert(c.activeStages.indexOf("discovery") >= 0);
  assert(c.activeStages.indexOf("won") < 0);
});

test("Backward-compatible export: WorkflowDetector aliases new class", () => {
  assert(WorkflowMod.WorkflowDetector === WorkflowMod.WorkflowCommitmentProjector);
});

// ----------------------------------------------------------------------------
// PART B: project() publishes signals to intake (NOT to field.constraints)
// ----------------------------------------------------------------------------
console.log("");
console.log("PART B: project() publishes workflow signals to intake");
console.log("");

test("Single stalled deal: project() publishes 1 signal to intake", () => {
  const fm = buildField();
  const field = fm.Field;
  const constraintsBefore = field.constraints.length;

  const eightDays = 8 * 24 * 60 * 60 * 1000;
  publishDealState(field, "D1", "qualified", 0);
  publishTimeNow(field, eightDays);

  const proj = new WorkflowMod.WorkflowCommitmentProjector({ field: field });
  const r = proj.project();

  assert(r.published === 1, "published 1 signal; got " + r.published);
  assert(r.signals[0].dealId === "D1");
  assert(r.signals[0].signal === "follow-up-due");

  // Critical structural check: field.constraints UNCHANGED.
  // The projector does not push predictives.
  assert(field.constraints.length === constraintsBefore,
    "constraints unchanged; was " + constraintsBefore +
    ", now " + field.constraints.length);

  // Signal lives in intake.
  const sigs = signalsInIntake(field);
  assert(sigs.length === 1);
  assert(sigs[0].value.dealId === "D1");
});

test("Signal record shape: type + dealId + signal + stage + ageMs", () => {
  const fm = buildField();
  const eightDays = 8 * 24 * 60 * 60 * 1000;
  publishDealState(fm.Field, "D2", "proposed", 0);
  publishTimeNow(fm.Field, eightDays);
  const proj = new WorkflowMod.WorkflowCommitmentProjector({ field: fm.Field });
  proj.project();

  const sig = signalsInIntake(fm.Field)[0];
  assert(sig.type === "domain::workflow-signal");
  assert(sig.value.dealId === "D2");
  assert(sig.value.signal === "follow-up-due");
  assert(sig.value.stage === "proposed");
  assert(sig.value.ageMs === eightDays);
  assert(sig.source === "workflow-commitment-projector");
});

test("Multiple stalled deals -> multiple signals", () => {
  const fm = buildField();
  const eightDays = 8 * 24 * 60 * 60 * 1000;
  publishDealState(fm.Field, "D1", "qualified", 0);
  publishDealState(fm.Field, "D2", "discovery", 0);
  publishDealState(fm.Field, "D3", "negotiation", 0);
  publishTimeNow(fm.Field, eightDays);
  const proj = new WorkflowMod.WorkflowCommitmentProjector({ field: fm.Field });
  const r = proj.project();
  assert(r.published === 3);
  assert(signalsInIntake(fm.Field).length === 3);
});

test("Won/lost deals do NOT generate signals (closed stages)", () => {
  const fm = buildField();
  const eightDays = 8 * 24 * 60 * 60 * 1000;
  publishDealState(fm.Field, "Dwon", "won", 0);
  publishDealState(fm.Field, "Dlost", "lost", 0);
  publishTimeNow(fm.Field, eightDays);
  const proj = new WorkflowMod.WorkflowCommitmentProjector({ field: fm.Field });
  const r = proj.project();
  assert(r.published === 0);
  assert(signalsInIntake(fm.Field).length === 0);
});

test("Recently-updated deals (1 day ago) do NOT generate signals", () => {
  const fm = buildField();
  const oneDay = 24 * 60 * 60 * 1000;
  const sevenDays = 7 * oneDay;
  publishDealState(fm.Field, "Dfresh", "qualified", sevenDays - oneDay);
  publishTimeNow(fm.Field, sevenDays);
  const proj = new WorkflowMod.WorkflowCommitmentProjector({ field: fm.Field });
  const r = proj.project();
  assert(r.published === 0);
});

test("Threshold edge: 5 days ago does NOT trigger (< 7-day threshold)", () => {
  const fm = buildField();
  const oneDay = 24 * 60 * 60 * 1000;
  publishDealState(fm.Field, "Dedge", "qualified", 0);
  publishTimeNow(fm.Field, 5 * oneDay);
  const proj = new WorkflowMod.WorkflowCommitmentProjector({ field: fm.Field });
  const r = proj.project();
  assert(r.published === 0);
});

// ----------------------------------------------------------------------------
// PART C: signal clearance is NATURAL - no kernel ratify call
// ----------------------------------------------------------------------------
console.log("");
console.log("PART C: signal clearance (deal update -> no new signal)");
console.log("");

test("After deal update refreshes updatedAt: project() does NOT re-publish", () => {
  const fm = buildField();
  const oneDay = 24 * 60 * 60 * 1000;
  const tNow = 8 * oneDay;
  // Initial: D1 stale at qualified
  publishDealState(fm.Field, "D1", "qualified", 0);
  publishTimeNow(fm.Field, tNow);
  const proj = new WorkflowMod.WorkflowCommitmentProjector({ field: fm.Field });

  const r1 = proj.project();
  assert(r1.published === 1, "first project publishes signal");

  // Follow-up arrives: deal-updated-at refreshed to NOW
  fm.Field.intake.publish({
    type: "deal-updated-at",
    value: { dealId: "D1", timestamp: tNow },
    timestamp: tNow,
    source: "followup"
  });

  const r2 = proj.project();
  assert(r2.published === 0,
    "second project: deal is fresh, no new signal; got " + r2.published);
});

test("Projector NEVER calls field.ratify", () => {
  const fm = buildField();
  let ratifyCalled = false;
  const origRatify = fm.Field.ratify.bind(fm.Field);
  fm.Field.ratify = function (idx) {
    ratifyCalled = true;
    return origRatify(idx);
  };
  const eightDays = 8 * 24 * 60 * 60 * 1000;
  publishDealState(fm.Field, "D1", "qualified", 0);
  publishTimeNow(fm.Field, eightDays);
  const proj = new WorkflowMod.WorkflowCommitmentProjector({ field: fm.Field });
  proj.project();
  assert(!ratifyCalled, "projector should never call field.ratify");
});

test("Projector NEVER mutates field.constraints", () => {
  const fm = buildField();
  const eightDays = 8 * 24 * 60 * 60 * 1000;
  publishDealState(fm.Field, "D1", "qualified", 0);
  publishTimeNow(fm.Field, eightDays);
  const before = fm.Field.constraints.slice();
  const proj = new WorkflowMod.WorkflowCommitmentProjector({ field: fm.Field });
  for (let i = 0; i < 10; i++) proj.project();
  assert(fm.Field.constraints.length === before.length,
    "constraints array length unchanged");
  for (let i = 0; i < before.length; i++) {
    assert(fm.Field.constraints[i] === before[i],
      "constraint identity preserved at " + i);
  }
});

// ----------------------------------------------------------------------------
// PART D: configurability (Phase 10 boilerplate site)
// ----------------------------------------------------------------------------
console.log("");
console.log("PART D: configurable commitments (Phase 10 boilerplate)");
console.log("");

test("Custom commitment threshold: stricter SLA produces more signals", () => {
  const fm = buildField();
  const oneDay = 24 * 60 * 60 * 1000;
  publishDealState(fm.Field, "D1", "qualified", 0);
  publishTimeNow(fm.Field, 3 * oneDay);

  // Default 7-day: D1 not stale yet
  const projDefault = new WorkflowMod.WorkflowCommitmentProjector({ field: fm.Field });
  assert(projDefault.project().published === 0);

  // Strict 2-day commitment: same deal IS stale
  const fm2 = buildField();
  publishDealState(fm2.Field, "D1", "qualified", 0);
  publishTimeNow(fm2.Field, 3 * oneDay);
  const projStrict = new WorkflowMod.WorkflowCommitmentProjector({
    field: fm2.Field,
    commitments: { staleThresholdMs: 2 * oneDay }
  });
  assert(projStrict.project().published === 1);
});

test("Custom active stages: different commitments yield different signals", () => {
  const fm = buildField();
  const eightDays = 8 * 24 * 60 * 60 * 1000;
  publishDealState(fm.Field, "Dwon", "won", 0);
  publishTimeNow(fm.Field, eightDays);

  // Custom commitment includes "won" as active (e.g., post-sale follow-up policy)
  const proj = new WorkflowMod.WorkflowCommitmentProjector({
    field: fm.Field,
    commitments: { activeStages: ["won"] }
  });
  const r = proj.project();
  assert(r.published === 1, "won deal stale under custom commitment");
});

// ----------------------------------------------------------------------------
// PART E: F1 - seed never affected
// ----------------------------------------------------------------------------
console.log("");
console.log("PART E: F1 - seed permanence");
console.log("");

test("F1: seed at constraints[0] preserved through many project() cycles", () => {
  const fm = buildField();
  const seed = fm.Field.constraints[0];
  const eightDays = 8 * 24 * 60 * 60 * 1000;
  publishDealState(fm.Field, "D1", "qualified", 0);
  publishTimeNow(fm.Field, eightDays);
  const proj = new WorkflowMod.WorkflowCommitmentProjector({ field: fm.Field });
  for (let i = 0; i < 50; i++) proj.project();
  assert(fm.Field.constraints[0] === seed, "seed identity preserved");
  assert(fm.Field.constraints[0].kind === "seed");
  assert(fm.Field.constraints[0].permanent === true);
});

// ----------------------------------------------------------------------------
// PART F: I3 - bounded
// ----------------------------------------------------------------------------
console.log("");
console.log("PART F: I3 - bounded");
console.log("");

test("MAX_SIGNALS_PER_PROJECT cap enforced", () => {
  const fm = buildField();
  const eightDays = 8 * 24 * 60 * 60 * 1000;
  // Publish 30 stalled deals
  for (let i = 0; i < 30; i++) {
    publishDealState(fm.Field, "deal_" + i, "qualified", 0);
  }
  publishTimeNow(fm.Field, eightDays);
  const proj = new WorkflowMod.WorkflowCommitmentProjector({ field: fm.Field });
  const r = proj.project();
  assert(r.published <= 16, "cap honored; published " + r.published);
});

// ----------------------------------------------------------------------------
// PART G: O-class observer
// ----------------------------------------------------------------------------
console.log("");
console.log("PART G: O-class observer (read-only stats)");
console.log("");

test("observe() returns stats including activeSignals and commitments", () => {
  const fm = buildField();
  const eightDays = 8 * 24 * 60 * 60 * 1000;
  publishDealState(fm.Field, "D1", "qualified", 0);
  publishTimeNow(fm.Field, eightDays);
  const proj = new WorkflowMod.WorkflowCommitmentProjector({ field: fm.Field });
  proj.project();
  const o = proj.observe();
  assert(o.projectCalls === 1);
  assert(o.signalsPublished === 1);
  assert(o.activeSignals === 1);
  assert(typeof o.commitments.staleThresholdMs === "number");
  assert(Array.isArray(o.commitments.activeStages));
});

test("observe() does not mutate field state", () => {
  const fm = buildField();
  const eightDays = 8 * 24 * 60 * 60 * 1000;
  publishDealState(fm.Field, "D1", "qualified", 0);
  publishTimeNow(fm.Field, eightDays);
  const proj = new WorkflowMod.WorkflowCommitmentProjector({ field: fm.Field });
  proj.project();
  const intakeBefore = fm.Field.intake.records.length;
  const constraintsBefore = fm.Field.constraints.length;
  for (let i = 0; i < 10; i++) proj.observe();
  assert(fm.Field.intake.records.length === intakeBefore);
  assert(fm.Field.constraints.length === constraintsBefore);
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
  assert(src.indexOf("XMLHttpRequest") < 0);
  assert(src.indexOf("WebSocket") < 0);
});

test("p5-workflow-detector: no predictive constraint pushed (F3)", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "p5-workflow-detector.js"), "utf8");
  // Strip comments before checking; docstring mentions are explanatory,
  // actual code is what matters
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, "")  // block comments
    .replace(/\/\/.*$/gm, "");          // line comments

  assert(stripped.indexOf('kind: "predictive"') < 0,
    "F3 violation: module code pushes kind=\"predictive\"");
  assert(stripped.indexOf("constraints.push") < 0,
    "F3 violation: module code pushes to constraints array");
  // Function-call pattern, not bare reference
  assert(!/field\.ratify\s*\(/.test(stripped),
    "F3 violation: module code calls field.ratify(...)");
  assert(!/_mkPredictive/.test(stripped),
    "F3 violation: module code calls kernel _mkPredictive");
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
