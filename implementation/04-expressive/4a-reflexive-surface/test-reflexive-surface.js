// test-reflexive-surface.js - Phase 4a integration test

"use strict";

const FieldModule = require("./field.js");
const CompilerModule = require("./constraint-compiler.js");
const ERengineModule = require("./er-engine.js");
const CTengineModule = require("./ct-engine.js");
const ReflexiveSurfaceModule = require("./reflexive-surface.js");

const Field = FieldModule.Field;
const Trace = FieldModule.Trace;
const OpsLog = FieldModule.OpsLog;
const CFG = FieldModule.CFG;

function setup() {
  Field.reset();
  Trace.clear();
  OpsLog.clear();

  const er = new ERengineModule.ERengine();
  er.state = "cpu-fallback";

  const ct = new CTengineModule.CTengine();
  ct.bind(er, CompilerModule);

  const surface = new ReflexiveSurfaceModule.ReflexiveSurface();
  return { er: er, ct: ct, surface: surface };
}

// ----------------------------------------------------------------
// Test 1: Initial observe captures baseline, no clauses
// ----------------------------------------------------------------
async function testBaseline() {
  console.log("=== Test 1: baseline observation ===");
  const { surface } = setup();

  const result = surface.observe();
  console.log("  baseline clauses emitted: " + result.length);
  console.log("  surface initialized: " + surface.initialized);
  console.log("  snapshot taken: " + (surface.snapshot !== null));

  return {
    pass: result.length === 0
       && surface.initialized
       && surface.snapshot !== null
  };
}

// ----------------------------------------------------------------
// Test 2: REACHING clause fires when predictive constraints appear
// ----------------------------------------------------------------
async function testReachingClause() {
  console.log("\n=== Test 2: REACHING clause on predictive generation ===");
  const { ct, surface } = setup();
  surface.observe(); // baseline

  // Feed inputs that should trigger predictive generation
  ct.enqueueInput("hello world abc");
  ct.enqueueInput("more letters here");
  await ct.drainAll(10);

  const result = surface.observe();
  const reaching = result.filter(c => c.kind === "reaching");
  console.log("  total clauses: " + result.length);
  console.log("  reaching clauses: " + reaching.length);
  if (reaching.length > 0) {
    console.log("  first: " + reaching[0].text);
  }

  return {
    pass: reaching.length > 0
       && reaching[0].text.indexOf("reaching:") === 0
  };
}

// ----------------------------------------------------------------
// Test 3: LANDED clause fires when predictive ratifies
// ----------------------------------------------------------------
async function testLandedClause() {
  console.log("\n=== Test 3: LANDED clause on ratification ===");
  const { ct, surface } = setup();
  surface.observe();

  // Build up predictions
  ct.enqueueInput("hello world abc");
  ct.enqueueInput("more letters here");
  await ct.drainAll(10);
  surface.observe(); // capture state with predictions

  // Feed input that should ratify a digits prediction
  ct.enqueueInput("42 numbers go here");
  await ct.drainAll(5);

  const result = surface.observe();
  const landed = result.filter(c => c.kind === "landed");
  console.log("  total clauses: " + result.length);
  console.log("  landed clauses: " + landed.length);
  if (landed.length > 0) {
    console.log("  first: " + landed[0].text);
  }

  return {
    pass: landed.length > 0
       && landed[0].text.indexOf("reach landed:") === 0
  };
}

// ----------------------------------------------------------------
// Test 4: FORMED clause fires when meta-constraint emerges
// ----------------------------------------------------------------
async function testFormedClause() {
  console.log("\n=== Test 4: FORMED clause on meta-constraint creation ===");
  const { ct, surface } = setup();
  surface.observe();

  // Build correlated inputs that will produce meta-constraints
  const inputs = [
    "hello world", "hello again", "world of ideas",
    "hello world again", "hello world one more time"
  ];
  for (const i of inputs) ct.enqueueInput(i);
  await ct.drainAll(20);

  // Run develop to create meta-constraints
  ct.enqueueInternal("develop", {});
  await ct.drainAll(2);

  const result = surface.observe();
  const formed = result.filter(c => c.kind === "formed");
  console.log("  total clauses: " + result.length);
  console.log("  formed clauses: " + formed.length);
  if (formed.length > 0) {
    console.log("  first: " + formed[0].text);
  }

  return {
    pass: formed.length > 0
       && formed[0].text.indexOf("structure formed:") === 0
  };
}

// ----------------------------------------------------------------
// Test 5: CONSOLIDATED + NAMED clauses on sub-cascade lifecycle
// ----------------------------------------------------------------
async function testConsolidatedAndNamed() {
  console.log("\n=== Test 5: CONSOLIDATED and NAMED clauses ===");
  const { ct, surface } = setup();
  surface.observe();

  // Use the same input pattern Phase 3 t8 used (which reliably promotes)
  const inputs = [
    "hello world", "hello again my friend", "the quick brown fox",
    "hello quick", "world of ideas", "another phrase here", "hello again",
    "42 numbers here", "mixing letters and 7 digits", "symbols ! @ #",
    "hello world again", "hello world", "hello quick brown",
    "hello quick fox", "world quick"
  ];
  for (const i of inputs) ct.enqueueInput(i);
  await ct.drainAll(50);
  ct.enqueueInternal("develop", {});
  ct.enqueueInternal("promote", {});
  await ct.drainAll(5);

  const r1 = surface.observe();
  const consolidated = r1.filter(c => c.kind === "consolidated");
  console.log("  consolidated clauses: " + consolidated.length);
  if (consolidated.length > 0) console.log("    " + consolidated[0].text);

  // If we got a sub-cascade, address it by name
  let namedClause = null;
  if (Field.subcascades.length > 0) {
    const sc = Field.subcascades[0];
    for (let k = 0; k < 6; k++) ct.enqueueInput(sc.name + " is here");
    await ct.drainAll(10);
    const r2 = surface.observe();
    const named = r2.filter(c => c.kind === "named");
    if (named.length > 0) {
      namedClause = named[0];
      console.log("  named clause: " + namedClause.text);
    } else {
      console.log("  no named clauses (but sub-cascade exists)");
    }
  } else {
    console.log("  no sub-cascade promoted (skip named-clause check)");
  }

  return {
    pass: consolidated.length > 0
       && (Field.subcascades.length === 0 || namedClause !== null)
  };
}

// ----------------------------------------------------------------
// Test 6: SETTLED clause fires when gap drops below threshold
// ----------------------------------------------------------------
async function testSettledClause() {
  console.log("\n=== Test 6: SETTLED clause on gap drop ===");
  const { ct, surface } = setup();
  surface.observe();

  // Force a high gap by injecting predictive activity
  ct.enqueueInput("hello world abc");
  ct.enqueueInput("more letters");
  await ct.drainAll(10);
  Field.gap = 0.20;          // force above-threshold
  Field.fastDelta = 0.6;
  Field.slowDelta = 0.4;
  surface.observe();         // snapshot with gap=0.20

  // Now drop gap manually
  Field.gap = 0.05;          // below 0.10 threshold
  Field.fastDelta = 0.45;
  Field.slowDelta = 0.40;

  const result = surface.observe();
  const settled = result.filter(c => c.kind === "settled");
  console.log("  total clauses: " + result.length);
  console.log("  settled clauses: " + settled.length);
  if (settled.length > 0) {
    console.log("  first: " + settled[0].text);
  }

  return {
    pass: settled.length > 0
       && settled[0].text.indexOf("settled:") === 0
  };
}

// ----------------------------------------------------------------
// Test 7: DIVERGED clause fires when gap diff crosses threshold
// ----------------------------------------------------------------
async function testDivergedClause() {
  console.log("\n=== Test 7: DIVERGED clause on scope divergence ===");
  const { ct, surface } = setup();
  surface.observe();

  // Set similar gaps initially, snapshot
  Field.gap = 0.10;
  Field.execGap = 0.10;
  surface.observe();

  // Force divergence
  Field.execGap = 0.50;       // gap diff = 0.40 > 0.25 threshold
  Field.gap = 0.10;

  const result = surface.observe();
  const diverged = result.filter(c => c.kind === "diverged");
  console.log("  total clauses: " + result.length);
  console.log("  diverged clauses: " + diverged.length);
  if (diverged.length > 0) {
    console.log("  first: " + diverged[0].text);
  }

  return {
    pass: diverged.length > 0
       && diverged[0].text.indexOf("diverged:") === 0
  };
}

// ----------------------------------------------------------------
// Test 8: O1 - observation is read-only
//
// Heavy stress: run many observations with random Field activity,
// verify that the surface never modifies any Field property.
// ----------------------------------------------------------------
async function testObservationReadOnly() {
  console.log("\n=== Test 8: O1 - observation is read-only ===");
  const { ct, surface } = setup();

  // Build state, snapshot it
  ct.enqueueInput("hello world abc");
  ct.enqueueInput("42 numbers");
  await ct.drainAll(5);

  const beforeSnapshot = {
    constraintCount: Field.constraints.length,
    ratCount: Field.ratCount,
    namedCount: Field.namedCount,
    subcascadeCount: Field.subcascades.length,
    inputCount: Field.inputCount,
    step: Field.step,
    correlationCount: Object.keys(Field.correlations).length,
    constraintIds: Field.constraints.map(c => c.id).slice(),
    serialized: Field.serialize()
  };

  // Run many observations
  for (let i = 0; i < 50; i++) surface.observe();

  // Check that nothing about Field has changed
  const afterSnapshot = {
    constraintCount: Field.constraints.length,
    ratCount: Field.ratCount,
    namedCount: Field.namedCount,
    subcascadeCount: Field.subcascades.length,
    inputCount: Field.inputCount,
    step: Field.step,
    correlationCount: Object.keys(Field.correlations).length,
    constraintIds: Field.constraints.map(c => c.id).slice(),
    serialized: Field.serialize()
  };

  let fails = 0;
  function check(label, before, after) {
    const equal = JSON.stringify(before) === JSON.stringify(after);
    if (!equal) { console.log("  FAIL: " + label + " changed"); fails += 1; }
  }
  check("constraintCount", beforeSnapshot.constraintCount, afterSnapshot.constraintCount);
  check("ratCount", beforeSnapshot.ratCount, afterSnapshot.ratCount);
  check("namedCount", beforeSnapshot.namedCount, afterSnapshot.namedCount);
  check("subcascadeCount", beforeSnapshot.subcascadeCount, afterSnapshot.subcascadeCount);
  check("inputCount", beforeSnapshot.inputCount, afterSnapshot.inputCount);
  check("step", beforeSnapshot.step, afterSnapshot.step);
  check("correlationCount", beforeSnapshot.correlationCount, afterSnapshot.correlationCount);
  check("constraint ids", beforeSnapshot.constraintIds, afterSnapshot.constraintIds);
  check("serialized state", beforeSnapshot.serialized, afterSnapshot.serialized);

  if (fails === 0) console.log("  ok: 50 observations produced zero Field mutations");
  return { pass: fails === 0 };
}

// ----------------------------------------------------------------
// Test 9: O2 - observers are bounded
// ----------------------------------------------------------------
async function testBuffer() {
  console.log("\n=== Test 9: O2 - buffer is bounded ===");
  const { ct, surface } = setup();
  surface.observe();

  // Generate enough activity to overflow buffer
  for (let i = 0; i < 30; i++) {
    ct.enqueueInput("input " + i + " with words");
    await ct.drainAll(2);
    surface.observe();
  }

  const stats = surface.stats();
  console.log("  total emitted: " + stats.totalEmitted);
  console.log("  buffered: " + stats.buffered + " / cap: " + stats.cap);
  console.log("  by-kind: " + JSON.stringify(stats.byKind));

  return {
    pass: stats.buffered <= stats.cap
       && stats.totalEmitted > 0
  };
}

// ----------------------------------------------------------------
// Test 10: O3 - vocabulary sources from field
//
// Verify that clause text contains substrings present in Field
// elements (constraint descriptions, sub-cascade names, etc.)
// when those clauses reference field content.
// ----------------------------------------------------------------
async function testVocabularySource() {
  console.log("\n=== Test 10: O3 - vocabulary sources from field ===");
  const { ct, surface } = setup();
  surface.observe();

  ct.enqueueInput("hello world abc");
  ct.enqueueInput("hello again");
  ct.enqueueInput("42 numbers");
  await ct.drainAll(10);

  const result = surface.observe();
  let checked = 0, ok = 0;

  for (const clause of result) {
    if (clause.kind === "landed" || clause.kind === "formed") {
      // Should reference a constraint id or description from Field
      const constraintId = clause.evidence && clause.evidence.constraintId;
      if (!constraintId) continue;
      const c = Field.constraints.find(c => c.id === constraintId);
      if (c) {
        checked += 1;
        // Either the description or some pattern element should appear
        // in the clause text
        const patternToken = c.pattern && (c.pattern.token || c.pattern.cls);
        const desc = c.desc || "";
        if (clause.text.indexOf(desc.substring(0, 20)) >= 0
            || (patternToken && clause.text.indexOf(patternToken) >= 0)) {
          ok += 1;
        } else {
          console.log("  no field vocab in: " + clause.text);
        }
      }
    }
  }

  if (checked === 0) {
    console.log("  no constraint-referencing clauses to check (skipping)");
    return { pass: true };
  }

  console.log("  checked " + checked + " clauses, " + ok + " sourced from field");
  return { pass: ok === checked };
}

// ----------------------------------------------------------------
// Test 11: Phase 3 invariants still hold
// ----------------------------------------------------------------
async function testPhase3Invariants() {
  console.log("\n=== Test 11: Phase 3 invariants intact ===");
  const { ct, surface } = setup();
  surface.observe();

  const inputs = [
    "hello world", "hello again", "the quick brown fox",
    "42 numbers here", "hello quick", "world of ideas",
    "hello world again", "brown fox quick"
  ];
  for (const i of inputs) ct.enqueueInput(i);
  await ct.drainAll(30);

  // Observe several times during execution
  for (let i = 0; i < 5; i++) surface.observe();

  let fails = 0;
  function inv(label, cond) {
    if (cond) console.log("  ok:   " + label);
    else { console.log("  FAIL: " + label); fails += 1; }
  }

  inv("seed at index 0", Field.constraints[0] && Field.constraints[0].kind === "seed");
  inv("scalar in [0,1]", Field.scalarDelta >= 0 && Field.scalarDelta <= 1);
  inv("constraints bounded", Field.constraints.length <= CFG.FIELD_LIVE_CAP);
  inv("CT ops executed", ct.opsExecuted > 0);
  inv("exec-delta in [0,1]", Field.execScalarDelta >= 0 && Field.execScalarDelta <= 1);
  inv("trace bounded", Trace.entries.length <= CFG.TRACE_CAP);

  return { pass: fails === 0 };
}

// ----------------------------------------------------------------
// Test 12: structural verbs only
//
// Confirm that no clause text contains agency-suggesting words
// like "intends", "wants", "knows", "chooses". The surface uses
// only the structural verbs enumerated in SURFACE_CFG.
// ----------------------------------------------------------------
async function testNoAgencyWords() {
  console.log("\n=== Test 12: no agency-suggesting words ===");
  const { ct, surface } = setup();
  surface.observe();

  // Stress with varied activity
  const inputs = [
    "hello world", "hello fox", "hello quick",
    "42 numbers", "more digits 7", "letters and 9 mixed",
    "symbols ! @ #", "world quick brown"
  ];
  for (const i of inputs) ct.enqueueInput(i);
  await ct.drainAll(25);
  ct.enqueueInternal("develop", {});
  ct.enqueueInternal("promote", {});
  await ct.drainAll(5);

  const r = surface.observe();

  const forbidden = [
    "intend", "want", "know", "choose", "decide", "try",
    "think", "believe", "feel", "wish", "desire", "aware"
  ];

  let violations = 0;
  for (const clause of surface.all()) {
    const text = clause.text.toLowerCase();
    for (const word of forbidden) {
      if (text.indexOf(word) >= 0) {
        console.log("  FAIL: agency word '" + word + "' in: " + clause.text);
        violations += 1;
      }
    }
  }

  console.log("  total clauses: " + surface.all().length);
  console.log("  agency-word violations: " + violations);

  return { pass: violations === 0 };
}

// ----------------------------------------------------------------
// Test driver
// ----------------------------------------------------------------
(async () => {
  const results = {};
  try {
    results.t1 = await testBaseline();
    results.t2 = await testReachingClause();
    results.t3 = await testLandedClause();
    results.t4 = await testFormedClause();
    results.t5 = await testConsolidatedAndNamed();
    results.t6 = await testSettledClause();
    results.t7 = await testDivergedClause();
    results.t8 = await testObservationReadOnly();
    results.t9 = await testBuffer();
    results.t10 = await testVocabularySource();
    results.t11 = await testPhase3Invariants();
    results.t12 = await testNoAgencyWords();

    console.log("\n=== Summary ===");
    let total = 0, passed = 0;
    for (const k in results) {
      total += 1;
      const r = results[k];
      const status = r.pass ? "ok  " : "FAIL";
      console.log("  " + status + "  " + k);
      if (r.pass) passed += 1;
    }
    console.log("\n" + passed + "/" + total + " tests passed");
    process.exit(passed === total ? 0 : 1);
  } catch (e) {
    console.error("Test runner failed:", e.stack || e.message || e);
    process.exit(2);
  }
})();
