// test-phase4d.js - Pass B reflexive surface templates from promoted compounds

"use strict";

const FieldModule = require("./field.js");
const CompilerModule = require("./constraint-compiler.js");
const ERengineModule = require("./er-engine.js");
const CTengineModule = require("./ct-engine.js");
const SurfaceModule = require("./reflexive-surface.js");
const StorageModule = require("./storage-adapter.js");

const Field = FieldModule.Field;
const Trace = FieldModule.Trace;
const OpsLog = FieldModule.OpsLog;
const CFG = FieldModule.CFG;

async function setup() {
  Field.reset();
  Trace.clear();
  OpsLog.clear();
  const er = new ERengineModule.ERengine();
  er.state = "cpu-fallback";
  const ct = new CTengineModule.CTengine();
  ct.bind(er, CompilerModule);
  const surface = new SurfaceModule.ReflexiveSurface();
  return { er: er, ct: ct, surface: surface };
}

// ----------------------------------------------------------------
// Test 1: PASS_B_TEMPLATES registry covers expected combinations
// ----------------------------------------------------------------
function testTemplateRegistry() {
  console.log("=== Test 1: Pass B template registry ===");
  const T = SurfaceModule.PASS_B_TEMPLATES;
  const keys = Object.keys(T);
  console.log("  registered keys: " + keys.length);

  const renderTypes = ["has-token", "length-range", "char-class", "co-occurs"];
  const execTypes = ["queue-depth", "recent-op", "exec-gap-state"];
  let missing = 0;
  for (const r of renderTypes) {
    for (const e of execTypes) {
      const k = r + "::" + e;
      if (!T[k]) {
        console.log("  MISSING: " + k);
        missing += 1;
      }
    }
  }
  // Verify each template has slot placeholders
  let malformed = 0;
  for (const k of keys) {
    const tmpl = T[k];
    if (!/\{[a-zA-Z]+\}/.test(tmpl)) {
      console.log("  MALFORMED (no slots): " + k + " -> " + tmpl);
      malformed += 1;
    }
  }

  return {
    pass: keys.length === 12 && missing === 0 && malformed === 0
  };
}

// ----------------------------------------------------------------
// Test 2: templateKeyForCompound derives correct keys
// ----------------------------------------------------------------
function testTemplateKey() {
  console.log("\n=== Test 2: templateKeyForCompound ===");

  const compounds = [
    {
      pattern: { type: "compound",
        render: { type: "has-token", token: "x" },
        exec: { type: "queue-depth", min: 0, max: 10 } }
    },
    {
      pattern: { type: "compound",
        render: { type: "char-class", cls: "digits" },
        exec: { type: "exec-gap-state", state: "high" } }
    },
    {
      pattern: { type: "compound",
        render: { type: "co-occurs", a: "p", b: "q" },
        exec: { type: "recent-op", kind: "tick" } }
    },
    { pattern: null },                       // null pattern
    { pattern: { type: "has-token" } },      // not compound
  ];
  const expected = [
    "has-token::queue-depth",
    "char-class::exec-gap-state",
    "co-occurs::recent-op",
    null,
    null
  ];
  let fails = 0;
  for (let i = 0; i < compounds.length; i += 1) {
    const got = SurfaceModule.templateKeyForCompound(compounds[i]);
    if (got === expected[i]) {
      console.log("  ok:   case " + i + " -> " + got);
    } else {
      console.log("  FAIL: case " + i + " -> " + got + " (expected " + expected[i] + ")");
      fails += 1;
    }
  }
  return { pass: fails === 0 };
}

// ----------------------------------------------------------------
// Test 3: renderPassBTemplate fills slots correctly
// ----------------------------------------------------------------
async function testRenderTemplate() {
  console.log("\n=== Test 3: renderPassBTemplate slot filling ===");
  await setup();

  // Set field state we want exec slot to read
  Field.ctPendingOps = [{ kind: "tick" }, { kind: "develop" }];

  const cases = [
    {
      compound: {
        pattern: { type: "compound",
          render: { type: "has-token", token: "hello" },
          exec: { type: "queue-depth", min: 0, max: 10 } }
      },
      // Token slot -> 'hello', depth slot -> 2 (current ctPendingOps length)
      expectContains: ["'hello'", "2"]
    },
    {
      compound: {
        pattern: { type: "compound",
          render: { type: "char-class", cls: "digits" },
          exec: { type: "exec-gap-state", state: "high" } }
      },
      expectContains: ["digits", "high"]
    },
    {
      compound: {
        pattern: { type: "compound",
          render: { type: "co-occurs", a: "alpha", b: "beta" },
          exec: { type: "recent-op", kind: "develop" } }
      },
      expectContains: ["'alpha'", "'beta'", "develop"]
    },
    {
      compound: {
        pattern: { type: "compound",
          render: { type: "length-range", min: 5, max: 12 },
          exec: { type: "queue-depth", min: 0, max: 64 } }
      },
      expectContains: ["5-12", "2"]
    }
  ];
  let fails = 0;
  for (const c of cases) {
    const text = SurfaceModule.renderPassBTemplate(c.compound, Field);
    let ok = true;
    for (const sub of c.expectContains) {
      if (text.indexOf(sub) === -1) {
        ok = false;
        break;
      }
    }
    if (ok) {
      console.log("  ok:   " + text);
    } else {
      console.log("  FAIL: " + text + "  expected to contain " + JSON.stringify(c.expectContains));
      fails += 1;
    }
  }
  return { pass: fails === 0 };
}

// ----------------------------------------------------------------
// Test 4: CLAUSE_SOURCE distinguishes pass-a from pass-b
// ----------------------------------------------------------------
async function testClauseSource() {
  console.log("\n=== Test 4: clause source field ===");
  const { surface } = await setup();
  surface.observe();  // baseline

  // Cause Pass A clause to fire (e.g., a meta-constraint formed)
  Field.constraints.push({
    id: "m::test",
    kind: "meta",
    metaKind: "pair",
    refs: [],
    desc: "test pair meta",
    birth: Field.step,
    lastUsed: Field.step,
    uses: 0,
    weight: 1.0
  });

  const emitted = surface.observe();
  const formedClauses = emitted.filter(c => c.kind === "formed");
  console.log("  formed clauses: " + formedClauses.length);
  if (formedClauses.length) {
    console.log("  source: " + formedClauses[0].source);
  }

  return {
    pass: formedClauses.length >= 1
       && formedClauses[0].source === SurfaceModule.CLAUSE_SOURCE.PASS_A
  };
}

// ----------------------------------------------------------------
// Test 5: compound-active fires only when compound is promoted
// ----------------------------------------------------------------
async function testPromotionGate() {
  console.log("\n=== Test 5: Pass B requires promoted compound ===");
  const { surface } = await setup();
  surface.observe();  // baseline

  // Add an unpromoted compound
  const compound = {
    id: "x::unpromoted",
    kind: "compound",
    pattern: {
      type: "compound",
      render: { type: "has-token", token: "test" },
      exec: { type: "queue-depth", min: 0, max: 10 }
    },
    promoted: false,
    desc: "test compound unpromoted",
    birth: Field.step, lastUsed: Field.step, uses: 0, weight: 1.0
  };
  Field.constraints.push(compound);
  Field.lastMatchedCompoundIds = ["x::unpromoted"];

  const emitted1 = surface.observe();
  const active1 = emitted1.filter(c => c.kind === "compound-active");
  console.log("  unpromoted: compound-active clauses = " + active1.length + " (expected 0)");

  // Now mark it promoted
  compound.promoted = true;
  Field.lastMatchedCompoundIds = ["x::unpromoted"];  // matched again

  const emitted2 = surface.observe();
  const active2 = emitted2.filter(c => c.kind === "compound-active");
  console.log("  promoted: compound-active clauses = " + active2.length + " (expected 1)");
  if (active2.length) {
    console.log("  source: " + active2[0].source);
    console.log("  text: " + active2[0].text);
  }

  return {
    pass: active1.length === 0
       && active2.length === 1
       && active2[0].source === SurfaceModule.CLAUSE_SOURCE.PASS_B
  };
}

// ----------------------------------------------------------------
// Test 6: compound-active fires only for compounds in lastMatchedCompoundIds
// ----------------------------------------------------------------
async function testMatchGate() {
  console.log("\n=== Test 6: Pass B requires compound in lastMatchedCompoundIds ===");
  const { surface } = await setup();
  surface.observe();

  // Add a promoted compound but don't match it
  const compound = {
    id: "x::not-matched",
    kind: "compound",
    pattern: {
      type: "compound",
      render: { type: "char-class", cls: "alpha" },
      exec: { type: "exec-gap-state", state: "low" }
    },
    promoted: true,
    desc: "promoted but not matched",
    birth: Field.step, lastUsed: Field.step, uses: 0, weight: 1.0
  };
  Field.constraints.push(compound);
  Field.lastMatchedCompoundIds = [];  // empty - no matches

  const emitted = surface.observe();
  const active = emitted.filter(c => c.kind === "compound-active");
  console.log("  not matched: compound-active clauses = " + active.length + " (expected 0)");

  return { pass: active.length === 0 };
}

// ----------------------------------------------------------------
// Test 7: Same compound emits at most one compound-active per step
// ----------------------------------------------------------------
async function testOnePerStep() {
  console.log("\n=== Test 7: one compound-active per compound per step ===");
  const { surface } = await setup();
  surface.observe();

  const compound = {
    id: "x::dedup-test",
    kind: "compound",
    pattern: {
      type: "compound",
      render: { type: "has-token", token: "dedup" },
      exec: { type: "queue-depth", min: 0, max: 10 }
    },
    promoted: true,
    desc: "dedup test",
    birth: Field.step, lastUsed: Field.step, uses: 0, weight: 1.0
  };
  Field.constraints.push(compound);
  Field.lastMatchedCompoundIds = ["x::dedup-test"];

  const emitted1 = surface.observe();
  const active1 = emitted1.filter(c => c.kind === "compound-active");
  // Observe again WITHOUT advancing step - should NOT re-emit
  const emitted2 = surface.observe();
  const active2 = emitted2.filter(c => c.kind === "compound-active");
  console.log("  first observe: " + active1.length);
  console.log("  second observe (same step): " + active2.length);

  // Advance step and observe - should re-emit if still matched
  Field.step += 1;
  Field.lastMatchedCompoundIds = ["x::dedup-test"];
  const emitted3 = surface.observe();
  const active3 = emitted3.filter(c => c.kind === "compound-active");
  console.log("  third observe (next step): " + active3.length);

  return {
    pass: active1.length === 1
       && active2.length === 0
       && active3.length === 1
  };
}

// ----------------------------------------------------------------
// Test 8: Field.lastMatchedCompoundIds is wired through CT engine
// ----------------------------------------------------------------
async function testCtIntegration() {
  console.log("\n=== Test 8: CT engine wires lastMatchedCompoundIds ===");
  const { ct } = await setup();

  // Add a compound to the field that will match our input
  const compound = {
    id: "x::ct-wired",
    kind: "compound",
    pattern: {
      type: "compound",
      render: { type: "has-token", token: "trigger" },
      exec: { type: "queue-depth", min: 0, max: 100 }
    },
    promoted: true,
    desc: "ct integration test",
    birth: 0, lastUsed: 0, uses: 0, weight: 1.0
  };
  Field.constraints.push(compound);

  ct.enqueueInput("trigger word here");
  await ct.drainAll(3);

  console.log("  lastMatchedCompoundIds: " + JSON.stringify(Field.lastMatchedCompoundIds));

  return {
    pass: Array.isArray(Field.lastMatchedCompoundIds)
       && Field.lastMatchedCompoundIds.indexOf("x::ct-wired") !== -1
  };
}

// ----------------------------------------------------------------
// Test 9: O1 honored - surface observation does not write to Field
// ----------------------------------------------------------------
async function testO1Honored() {
  console.log("\n=== Test 9: O1 - surface does not write to Field ===");
  const { surface } = await setup();
  surface.observe();

  const compound = {
    id: "x::o1-test",
    kind: "compound",
    pattern: {
      type: "compound",
      render: { type: "char-class", cls: "alpha" },
      exec: { type: "exec-gap-state", state: "high" }
    },
    promoted: true,
    desc: "O1 test compound",
    birth: Field.step, lastUsed: Field.step, uses: 5, weight: 1.5
  };
  Field.constraints.push(compound);
  Field.lastMatchedCompoundIds = ["x::o1-test"];

  // Capture state before observation
  const before = {
    constraintCount: Field.constraints.length,
    compoundUses: compound.uses,
    compoundWeight: compound.weight,
    matchedIds: Field.lastMatchedCompoundIds.slice(),
    step: Field.step,
    scalarDelta: Field.scalarDelta
  };

  surface.observe();

  // Verify nothing in Field was modified by observation
  const after = {
    constraintCount: Field.constraints.length,
    compoundUses: compound.uses,
    compoundWeight: compound.weight,
    matchedIds: Field.lastMatchedCompoundIds.slice(),
    step: Field.step,
    scalarDelta: Field.scalarDelta
  };

  let fails = 0;
  for (const k of Object.keys(before)) {
    if (Array.isArray(before[k])) {
      if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
        console.log("  FAIL: " + k + " changed");
        fails += 1;
      } else {
        console.log("  ok:   " + k + " unchanged");
      }
    } else if (before[k] !== after[k]) {
      console.log("  FAIL: " + k + " changed " + before[k] + " -> " + after[k]);
      fails += 1;
    } else {
      console.log("  ok:   " + k + " = " + before[k]);
    }
  }

  return { pass: fails === 0 };
}

// ----------------------------------------------------------------
// Test 10: clause carries evidence for downstream observation
// ----------------------------------------------------------------
async function testClauseEvidence() {
  console.log("\n=== Test 10: compound-active clause evidence ===");
  const { surface } = await setup();
  surface.observe();

  const compound = {
    id: "x::evidence-test",
    kind: "compound",
    pattern: {
      type: "compound",
      render: { type: "has-token", token: "evidence" },
      exec: { type: "queue-depth", min: 0, max: 10 }
    },
    promoted: true,
    fidAtPromotion: 0.08,
    desc: "evidence test",
    birth: Field.step, lastUsed: Field.step, uses: 0, weight: 1.5
  };
  Field.constraints.push(compound);
  Field.lastMatchedCompoundIds = ["x::evidence-test"];

  const emitted = surface.observe();
  const active = emitted.filter(c => c.kind === "compound-active");
  if (active.length === 0) {
    console.log("  FAIL: no compound-active emitted");
    return { pass: false };
  }
  const ev = active[0].evidence;
  console.log("  compoundId: " + ev.compoundId);
  console.log("  templateKey: " + ev.templateKey);
  console.log("  renderType: " + ev.renderType);
  console.log("  execType: " + ev.execType);
  console.log("  fidelity: " + ev.fidelity);
  console.log("  weight: " + ev.weight);

  return {
    pass: ev.compoundId === "x::evidence-test"
       && ev.templateKey === "has-token::queue-depth"
       && ev.renderType === "has-token"
       && ev.execType === "queue-depth"
       && ev.fidelity === 0.08
       && ev.weight === 1.5
  };
}

// ----------------------------------------------------------------
// Test 11: bounded - compound-active does not feed back to promotion
// ----------------------------------------------------------------
async function testBoundedFeedback() {
  console.log("\n=== Test 11: compound-active does not feed back ===");
  const fs = require("fs");
  const surfSrc = fs.readFileSync("./reflexive-surface.js", "utf-8");
  const ctSrc = fs.readFileSync("./ct-engine.js", "utf-8");
  const fieldSrc = fs.readFileSync("./field.js", "utf-8");

  // The surface module should NOT contain code that calls
  // compound-promotion or compound-generation methods. The surface
  // observes; engines write.
  const surfaceCallsPromotion = /checkCompoundPromotions\(\)|generateCompounds\(/.test(surfSrc);
  console.log("  surface module calls promotion/generation (should be false): "
    + surfaceCallsPromotion);

  // The CT engine's compound generation should NOT consider Surface
  // state - it generates from Field state alone.
  const ctReadsSurface = /reflexiveSurface\.|surfaceBinding|surface\.observe/.test(ctSrc);
  console.log("  CT engine reads surface state (should be false): "
    + ctReadsSurface);

  // Field's generateCompounds should NOT read surface clauses
  const fieldReadsClauses = /this\.clauses|surface\./.test(fieldSrc);
  console.log("  Field reads surface clauses (should be false): "
    + fieldReadsClauses);

  return {
    pass: surfaceCallsPromotion === false
       && ctReadsSurface === false
       && fieldReadsClauses === false
  };
}

// ----------------------------------------------------------------
// Test 12: end-to-end flow - input -> compound match -> Pass B clause
// ----------------------------------------------------------------
async function testEndToEnd() {
  console.log("\n=== Test 12: end-to-end - input drives Pass B clause ===");
  const { ct, surface } = await setup();

  // Inject a promoted compound into the field
  const compound = {
    id: "x::e2e-test",
    kind: "compound",
    pattern: {
      type: "compound",
      render: { type: "has-token", token: "endgame" },
      exec: { type: "queue-depth", min: 0, max: 100 }
    },
    promoted: true,
    fidAtPromotion: 0.06,
    desc: "endgame compound",
    birth: 0, lastUsed: 0, uses: 3, weight: 1.4
  };
  Field.constraints.push(compound);
  surface.observe();  // baseline

  ct.enqueueInput("endgame strategy");
  await ct.drainAll(3);

  // After CT processes, observe with the surface
  const emitted = surface.observe();
  const active = emitted.filter(c => c.kind === "compound-active");
  console.log("  emitted compound-active: " + active.length);
  if (active.length) {
    console.log("  source: " + active[0].source);
    console.log("  text: " + active[0].text);
  }

  return {
    pass: active.length === 1
       && active[0].source === SurfaceModule.CLAUSE_SOURCE.PASS_B
       && active[0].text.indexOf("endgame") !== -1
  };
}

// ----------------------------------------------------------------
// Test 13: Pass A clauses still fire and are tagged pass-a
// ----------------------------------------------------------------
async function testPassACoexists() {
  console.log("\n=== Test 13: Pass A clauses coexist and are tagged pass-a ===");
  const { ct, surface } = await setup();
  surface.observe();

  // Drive inputs that will produce Pass A clauses (e.g., predictive
  // generation for char-class diversity)
  ct.enqueueInput("hello world abc");
  ct.enqueueInput("more letters ghi");
  await ct.drainAll(5);

  surface.observe();
  const all = surface.recent(50);
  const passA = all.filter(c => c.source === "pass-a");
  const passB = all.filter(c => c.source === "pass-b");
  console.log("  total clauses: " + all.length);
  console.log("  pass-a count: " + passA.length);
  console.log("  pass-b count: " + passB.length);

  // The proportion is observable. Without promoted compounds,
  // pass-b is zero.

  return {
    pass: all.length >= 1
       && passA.length >= 1
       && passA.every(c => c.source === "pass-a")
  };
}

// ----------------------------------------------------------------
// Test driver
// ----------------------------------------------------------------
(async () => {
  const results = {};
  try {
    results.t1  = testTemplateRegistry();
    results.t2  = testTemplateKey();
    results.t3  = await testRenderTemplate();
    results.t4  = await testClauseSource();
    results.t5  = await testPromotionGate();
    results.t6  = await testMatchGate();
    results.t7  = await testOnePerStep();
    results.t8  = await testCtIntegration();
    results.t9  = await testO1Honored();
    results.t10 = await testClauseEvidence();
    results.t11 = await testBoundedFeedback();
    results.t12 = await testEndToEnd();
    results.t13 = await testPassACoexists();

    console.log("\n=== Summary ===");
    let total = 0, passed = 0;
    const sorted = Object.keys(results).sort((a, b) =>
      parseInt(a.slice(1)) - parseInt(b.slice(1)));
    for (const k of sorted) {
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
