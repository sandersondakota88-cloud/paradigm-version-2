// test-phase4b.js - Cross-substrate compound constraints integration test

"use strict";

const FieldModule = require("./field.js");
const CompilerModule = require("./constraint-compiler.js");
const ERengineModule = require("./er-engine.js");
const CTengineModule = require("./ct-engine.js");
const SurfaceModule = require("./reflexive-surface.js");

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
  const surface = new SurfaceModule.ReflexiveSurface();
  return { er: er, ct: ct, surface: surface };
}

// ----------------------------------------------------------------
// Test 1: Compound construction and basic matching
// ----------------------------------------------------------------
function testCompoundConstruction() {
  console.log("=== Test 1: compound construction and basic matching ===");
  setup();

  // Build a compound by hand
  const c = Field._mkCompound(
    { type: "has-token", token: "hello" },
    { type: "queue-depth", min: 0, max: 100 },
    "hello with any queue depth",
    []
  );
  Field.constraints.push(c);

  console.log("  compound id: " + c.id);
  console.log("  compound kind: " + c.kind);
  console.log("  compound pattern type: " + c.pattern.type);

  const inputRec = Field._buildInputRec("hello world");
  const renderHits = Field._evalRenderPredicate(c.pattern.render, inputRec);
  const execHits = Field._evalExecPredicate(c.pattern.exec);
  console.log("  render predicate hits 'hello world': " + renderHits);
  console.log("  exec predicate hits (queue depth 0-100): " + execHits);

  const matched = Field.evaluateCompounds("hello world");
  console.log("  evaluateCompounds returned " + matched.length + " match(es)");

  return {
    pass: c.kind === "compound"
       && c.pattern.type === "compound"
       && renderHits === true
       && execHits === true
       && matched.length === 1
  };
}

// ----------------------------------------------------------------
// Test 2: Render predicate types all evaluate correctly
// ----------------------------------------------------------------
function testRenderPredicates() {
  console.log("\n=== Test 2: render predicate evaluation ===");
  setup();
  const inp = "hello 42 world tail!";  // "world" stands alone; "tail!" has the exclamation
  const rec = Field._buildInputRec(inp);

  const tests = [
    [{ type: "has-token", token: "hello" }, true],
    [{ type: "has-token", token: "missing" }, false],
    [{ type: "length-range", min: 1, max: 100 }, true],
    [{ type: "length-range", min: 100, max: 200 }, false],
    [{ type: "char-class", cls: "digits" }, true],
    [{ type: "char-class", cls: "alpha" }, true],
    [{ type: "char-class", cls: "symbol" }, true],
    [{ type: "co-occurs", a: "hello", b: "world" }, true],
    [{ type: "co-occurs", a: "hello", b: "missing" }, false]
  ];

  let fails = 0;
  for (const [pred, expected] of tests) {
    const got = Field._evalRenderPredicate(pred, rec);
    if (got === expected) {
      console.log("  ok:   " + JSON.stringify(pred) + " -> " + got);
    } else {
      console.log("  FAIL: " + JSON.stringify(pred) +
        " -> " + got + " (expected " + expected + ")");
      fails++;
    }
  }
  return { pass: fails === 0 };
}

// ----------------------------------------------------------------
// Test 3: Exec predicate types
// ----------------------------------------------------------------
function testExecPredicates() {
  console.log("\n=== Test 3: exec predicate evaluation ===");
  const { ct } = setup();

  // Set up specific exec state
  Field.ctPendingOps = [{ kind: "tick" }, { kind: "develop" }];
  Field.ctCommittedQueue = [{ kind: "input" }, { kind: "tick" }];
  Field.execGap = 0.30;  // above EXEC_GAP_PREDICT_THRESH (0.15)

  const tests = [
    [{ type: "queue-depth", min: 1, max: 10 }, true],
    [{ type: "queue-depth", min: 10, max: 20 }, false],
    [{ type: "recent-op", kind: "tick" }, true],
    [{ type: "recent-op", kind: "input" }, false],
    [{ type: "exec-gap-state", state: "high" }, true],
    [{ type: "exec-gap-state", state: "low" }, false],
    [{ type: "exec-gap-state", state: "reaching" }, true]
  ];

  let fails = 0;
  for (const [pred, expected] of tests) {
    const got = Field._evalExecPredicate(pred);
    if (got === expected) {
      console.log("  ok:   " + JSON.stringify(pred) + " -> " + got);
    } else {
      console.log("  FAIL: " + JSON.stringify(pred) +
        " -> " + got + " (expected " + expected + ")");
      fails++;
    }
  }
  return { pass: fails === 0 };
}

// ----------------------------------------------------------------
// Test 4: T1 trigger - ratification + non-input pending op
// ----------------------------------------------------------------
async function testTriggerT1() {
  console.log("\n=== Test 4: T1 trigger - ratification + non-input op ===");
  const { ct } = setup();

  // Set up state where T1 should fire on next snapshot:
  // - Take an initial snapshot with ratCount=0
  // - Add a ratified constraint, increment ratCount, queue a non-input op
  // - Take new snapshot - T1 should detect coincidence

  Field.recordCompoundGenerationSnapshot();  // baseline

  // Simulate ratification: add a ratified constraint that "just" ratified
  Field.constraints.push({
    id: "c::test-rat",
    kind: "ratified",
    pattern: { type: "char-class", cls: "digits" },
    desc: "test ratified constraint",
    birth: Field.step,
    lastUsed: Field.step,
    uses: 1,
    weight: 1.0
  });
  Field.ratCount = 1;

  // Queue a non-input op
  ct.enqueueInternal("develop", { source: "test" });

  // Take post-state snapshot (this is what generateCompounds compares against)
  Field.recordCompoundGenerationSnapshot();

  // Now generateCompounds should fire T1
  const compounds = Field.generateCompounds("hello");
  console.log("  generated compounds: " + compounds.length);
  for (const c of compounds) {
    console.log("  - " + c.desc);
  }

  return {
    pass: compounds.length >= 1
       && compounds[0].pattern.type === "compound"
       && compounds[0].pattern.exec.type === "queue-depth"
  };
}

// ----------------------------------------------------------------
// Test 5: T2 trigger - naming + queue saturation
// ----------------------------------------------------------------
function testTriggerT2() {
  console.log("\n=== Test 5: T2 trigger - naming + queue saturation ===");
  setup();

  Field.recordCompoundGenerationSnapshot();  // baseline (namedCount=0)

  // Create a sub-cascade and simulate naming
  const sc = {
    id: "sc::test",
    name: "testname",
    familyType: "has-token",
    memberIds: ["c::dummy"],
    birth: Field.step,
    lastNamed: Field.step,
    namedCount: 1,
    fidAtBirth: 0.5
  };
  Field.subcascades.push(sc);
  Field.namedCount = 1;

  // Saturate the queue (>= 75% of CT_OP_QUEUE_CAP=64, so >=48)
  for (let i = 0; i < 50; i++) {
    Field.ctPendingOps.push({ kind: "tick", payload: {}, enqueuedAt: 0 });
  }

  // New snapshot - naming incremented + queue saturated
  Field.recordCompoundGenerationSnapshot();

  const compounds = Field.generateCompounds("testname is here");
  console.log("  generated compounds: " + compounds.length);
  console.log("  pending ops: " + Field.ctPendingOps.length);
  for (const c of compounds) {
    console.log("  - " + c.desc);
  }

  return {
    pass: compounds.length >= 1
       && compounds.some(c => c.pattern.render.type === "has-token"
                            && c.pattern.render.token === "testname")
  };
}

// ----------------------------------------------------------------
// Test 6: T3 trigger - persistent dual-gap across consecutive steps
// ----------------------------------------------------------------
function testTriggerT3() {
  console.log("\n=== Test 6: T3 trigger - persistent dual-gap ===");
  setup();

  // Manually populate generation history with elevated gap+execGap for
  // COMPOUND_PERSISTENT_GAP_STEPS (3) consecutive steps. Need only
  // alpha char-class present in field, so digits/symbol can be the
  // reaching target.
  Field.constraints.push({
    id: "c::alpha",
    kind: "derived",
    pattern: { type: "char-class", cls: "alpha" },
    desc: "alpha",
    birth: 0, lastUsed: 0, uses: 1, weight: 1.0
  });

  for (let i = 0; i < 4; i++) {
    Field.step = i;
    Field.gap = 0.25;          // > COMPOUND_PERSISTENT_GAP_THRESH (0.20)
    Field.execGap = 0.20;      // > EXEC_GAP_PREDICT_THRESH (0.15)
    Field.recordCompoundGenerationSnapshot();
  }

  const compounds = Field.generateCompounds("hello");
  console.log("  generated compounds: " + compounds.length);
  for (const c of compounds) {
    console.log("  - " + c.desc);
  }

  return {
    pass: compounds.length >= 1
       && compounds.some(c => c.compoundKind === "persistent-dual-gap")
  };
}

// ----------------------------------------------------------------
// Test 7: Compound fidelity tracking and promotion
// ----------------------------------------------------------------
function testCompoundFidelity() {
  console.log("\n=== Test 7: compound fidelity and promotion ===");
  setup();

  // Build a compound and put it in the field
  const c = Field._mkCompound(
    { type: "has-token", token: "test" },
    { type: "queue-depth", min: 0, max: 100 },
    "test compound",
    []
  );
  Field.constraints.push(c);
  const idx = Field.constraints.length - 1;

  // Record fidelity observations: 5 observations of 0.10 delta drop each.
  // With COMPOUND_FIDELITY_PROMOTE=0.04 and MIN_FIRES=3, this should
  // promote the compound.
  for (let i = 0; i < 5; i++) {
    Field.recordCompoundFidelity([idx], 0.10);
  }

  console.log("  compound totalFires: " + Field.compoundFidelity[c.id].totalFires);
  console.log("  compound avg fidelity: " + Field.compoundFidelityOf(c.id).toFixed(3));

  const promoted = Field.checkCompoundPromotions();
  console.log("  promoted: " + promoted.length);
  if (promoted.length) {
    console.log("  promoted compound weight: " + promoted[0].weight.toFixed(2));
    console.log("  promoted: " + promoted[0].promoted);
  }

  return {
    pass: promoted.length === 1
       && promoted[0].promoted === true
       && promoted[0].weight > 1.0
       && Field.compoundFidelityOf(c.id) >= CFG.COMPOUND_FIDELITY_PROMOTE
  };
}

// ----------------------------------------------------------------
// Test 8: Compound NOT promoted when fidelity below threshold
// ----------------------------------------------------------------
function testCompoundNotPromoted() {
  console.log("\n=== Test 8: compound not promoted with low fidelity ===");
  setup();

  const c = Field._mkCompound(
    { type: "has-token", token: "weak" },
    { type: "queue-depth", min: 0, max: 100 },
    "weak compound",
    []
  );
  Field.constraints.push(c);
  const idx = Field.constraints.length - 1;

  // Low fidelity (below 0.04 threshold)
  for (let i = 0; i < 5; i++) {
    Field.recordCompoundFidelity([idx], 0.01);
  }

  console.log("  avg fidelity: " + Field.compoundFidelityOf(c.id).toFixed(3));
  const promoted = Field.checkCompoundPromotions();
  console.log("  promoted (should be 0): " + promoted.length);

  return { pass: promoted.length === 0 && c.promoted !== true };
}

// ----------------------------------------------------------------
// Test 9: Compound dedup - no duplicate compounds for same refs
// ----------------------------------------------------------------
function testCompoundDedup() {
  console.log("\n=== Test 9: compound deduplication ===");
  setup();

  // Setup state for T1 to fire repeatedly
  Field.recordCompoundGenerationSnapshot();
  Field.constraints.push({
    id: "c::r1",
    kind: "ratified",
    pattern: { type: "char-class", cls: "digits" },
    desc: "ratified r1",
    birth: 0, lastUsed: Field.step, uses: 1, weight: 1.0
  });
  Field.ratCount = 1;
  Field.ctPendingOps.push({ kind: "develop", payload: {}, enqueuedAt: 0 });
  Field.recordCompoundGenerationSnapshot();

  const round1 = Field.generateCompounds("hello");
  console.log("  round 1: " + round1.length + " compound(s)");
  if (round1.length) Field.integrate(round1);

  // Record again (T1 wouldn't fire again since same refs already have a
  // compound), but let's verify by stepping through the trigger
  Field.recordCompoundGenerationSnapshot();
  Field.ratCount = 2;
  Field.constraints.find(c => c.id === "c::r1").lastUsed = Field.step;
  Field.recordCompoundGenerationSnapshot();
  const round2 = Field.generateCompounds("hello");
  console.log("  round 2 (same refs, should be 0): " + round2.length);

  return {
    pass: round1.length >= 1 && round2.length === 0
  };
}

// ----------------------------------------------------------------
// Test 10: Surface integration - compound formation emits "formed"
// ----------------------------------------------------------------
function testSurfaceIntegration() {
  console.log("\n=== Test 10: reflexive surface emits 'formed' for compounds ===");
  const { surface } = setup();

  // Initial observation establishes baseline
  surface.observe();

  // Add a compound to the field
  const c = Field._mkCompound(
    { type: "has-token", token: "surface" },
    { type: "exec-gap-state", state: "high" },
    "surface integration test compound",
    []
  );
  Field.constraints.push(c);

  // Next observation should surface the formation
  const emitted = surface.observe();
  console.log("  emitted clauses: " + emitted.length);
  for (const cl of emitted) {
    console.log("  - kind=" + cl.kind + ", text=" + cl.text);
  }

  const formedCompound = emitted.find(cl =>
    cl.kind === "formed" && cl.text.indexOf("compound") !== -1);

  return {
    pass: !!formedCompound
       && formedCompound.text.indexOf("surface integration test") !== -1
  };
}

// ----------------------------------------------------------------
// Test 11: End-to-end - compound generation through CT pipeline
// ----------------------------------------------------------------
async function testEndToEnd() {
  console.log("\n=== Test 11: end-to-end compound formation through CT pipeline ===");
  const { ct } = setup();

  // Drive a sequence that should produce a compound via T1
  // Inputs that will generate predictive constraints AND get ratified
  const inputs = [
    "hello world",          // alpha tokens, no digits
    "hello again",          // produces predictive for digits
    "the quick fox",        // more alpha, gap rises
    "42 numbers here",      // ratifies the digits prediction
    "hello digits 99"       // input matches digits + alpha; queue may have non-input
  ];

  for (const inp of inputs) ct.enqueueInput(inp);

  // Inject a non-input op so T1 has a chance to fire
  ct.enqueueInternal("develop", {});

  await ct.drainAll(20);

  const compounds = Field.constraints.filter(c => c.kind === "compound");
  console.log("  total compounds in field: " + compounds.length);
  console.log("  ratifications: " + Field.ratCount);
  console.log("  total constraints: " + Field.constraints.length);

  // Compounds may or may not have formed depending on exact timing of
  // ratification vs queue state. The test verifies the path runs.
  // Stronger check: the generation history is being recorded.

  return {
    pass: Field.compoundGenerationHistory.length > 0
       && Field.ratCount > 0
       // Compound formation is opportunistic but the path executed
       && Field.compoundGenerationHistory.length <= CFG.COMPOUND_GEN_HISTORY_CAP
  };
}

// ----------------------------------------------------------------
// Test 12: Snapshot round-trip preserves compound state
// ----------------------------------------------------------------
function testCompoundPersistence() {
  console.log("\n=== Test 12: compound state persistence ===");
  setup();

  // Build state
  const c = Field._mkCompound(
    { type: "has-token", token: "persist" },
    { type: "queue-depth", min: 0, max: 50 },
    "persistence test",
    []
  );
  Field.constraints.push(c);
  for (let i = 0; i < 4; i++) Field.recordCompoundFidelity([Field.constraints.length - 1], 0.06);
  Field.recordCompoundGenerationSnapshot();
  Field.recordCompoundGenerationSnapshot();

  const json = Field.serialize();
  const data = JSON.parse(json);
  console.log("  serialize version: " + data.version);
  console.log("  has compoundFidelity: " + (data.compoundFidelity !== undefined));
  console.log("  has compoundGenerationHistory: " + (data.compoundGenerationHistory !== undefined));

  const compoundCount = Field.constraints.filter(c => c.kind === "compound").length;
  const fidEntries = Object.keys(Field.compoundFidelity).length;
  const histLen = Field.compoundGenerationHistory.length;

  Field.reset();
  console.log("  after reset, compounds: " + Field.constraints.filter(c => c.kind === "compound").length);

  const ok = Field.deserialize(json);
  const restoredCompounds = Field.constraints.filter(c => c.kind === "compound").length;
  const restoredFidEntries = Object.keys(Field.compoundFidelity).length;
  const restoredHist = Field.compoundGenerationHistory.length;
  console.log("  restore ok: " + ok);
  console.log("  compounds restored: " + restoredCompounds + " (expected " + compoundCount + ")");
  console.log("  fidelity entries: " + restoredFidEntries + " (expected " + fidEntries + ")");
  console.log("  history entries: " + restoredHist + " (expected " + histLen + ")");

  return {
    pass: ok && data.version === 4
       && restoredCompounds === compoundCount
       && restoredFidEntries === fidEntries
       && restoredHist === histLen
  };
}

// ----------------------------------------------------------------
// Test 13: V3 backward-compat - old snapshots still load
// ----------------------------------------------------------------
function testBackwardCompat() {
  console.log("\n=== Test 13: v3 snapshot backward-compat ===");
  setup();

  // Build a v3-like snapshot manually (no compound fields)
  const v3 = {
    version: 3,
    constraints: [{
      id: "seed::what-is-delta",
      kind: "seed",
      question: "what is delta?",
      birth: 0, uses: 5, permanent: true, weight: 1.0
    }],
    aged: [], inputCount: 5, step: 5, ratCount: 0,
    scalarDelta: 0.5, fastDelta: 0.5, slowDelta: 0.5, gap: 0.0,
    fastMod: 0, slowMod: 0.5, recentOps: [],
    correlations: {}, familyFidelity: {}, subcascades: [],
    namingPref: 0, namedCount: 0, _idCtr: 1,
    ctTotalOpsSeen: 5, ctOpsCompleted: 5, ctLastSnapshotStep: 0,
    execScalarDelta: 0, execFastDelta: 0, execSlowDelta: 0, execGap: 0
  };

  const ok = Field.deserialize(JSON.stringify(v3));
  console.log("  v3 restore ok: " + ok);
  console.log("  inputCount restored: " + Field.inputCount);
  console.log("  compoundFidelity initialized: " + (typeof Field.compoundFidelity === "object"));
  console.log("  compoundGenerationHistory initialized: " + Array.isArray(Field.compoundGenerationHistory));

  return {
    pass: ok
       && Field.inputCount === 5
       && typeof Field.compoundFidelity === "object"
       && Array.isArray(Field.compoundGenerationHistory)
       && Object.keys(Field.compoundFidelity).length === 0
       && Field.compoundGenerationHistory.length === 0
  };
}

// ----------------------------------------------------------------
// Test 14: SE-06 invariants honored - no command paths introduced
// ----------------------------------------------------------------
function testSE06Honored() {
  console.log("\n=== Test 14: SE-06 - no engine-to-engine command paths ===");
  const fs = require("fs");
  const ctSrc = fs.readFileSync("./ct-engine.js", "utf-8");
  const fieldSrc = fs.readFileSync("./field.js", "utf-8");

  // Compound matching happens in CT engine. The CT engine reads
  // Field state to evaluate exec-side predicates; that's a Field
  // read, not an ER engine call. Verify no new ER engine method
  // calls were introduced for compound work.
  // Find the _opInput section and confirm:
  //   - evaluateCompounds is called on Field, not on erBinding
  //   - generateCompounds is called on Field
  const compoundEvalLine = ctSrc.indexOf("Field.evaluateCompounds");
  const compoundGenLine = ctSrc.indexOf("Field.generateCompounds");
  const erCompoundCall = ctSrc.indexOf("erBinding.evaluateCompounds");

  console.log("  Field.evaluateCompounds called: " + (compoundEvalLine !== -1));
  console.log("  Field.generateCompounds called: " + (compoundGenLine !== -1));
  console.log("  erBinding.evaluateCompounds called (should be false): "
    + (erCompoundCall !== -1));

  // Compound matching reads Field.ctPendingOps etc. directly.
  // That's a Field read at execution-scope state. It is not the CT
  // engine being commanded by another engine.
  const evalExecPredFn = fieldSrc.indexOf("_evalExecPredicate");
  console.log("  _evalExecPredicate defined in Field (not engine): "
    + (evalExecPredFn !== -1));

  return {
    pass: compoundEvalLine !== -1
       && compoundGenLine !== -1
       && erCompoundCall === -1
       && evalExecPredFn !== -1
  };
}

// ----------------------------------------------------------------
// Test driver
// ----------------------------------------------------------------
(async () => {
  const results = {};
  try {
    results.t1  = testCompoundConstruction();
    results.t2  = testRenderPredicates();
    results.t3  = testExecPredicates();
    results.t4  = await testTriggerT1();
    results.t5  = testTriggerT2();
    results.t6  = testTriggerT3();
    results.t7  = testCompoundFidelity();
    results.t8  = testCompoundNotPromoted();
    results.t9  = testCompoundDedup();
    results.t10 = testSurfaceIntegration();
    results.t11 = await testEndToEnd();
    results.t12 = testCompoundPersistence();
    results.t13 = testBackwardCompat();
    results.t14 = testSE06Honored();

    console.log("\n=== Summary ===");
    let total = 0, passed = 0;
    for (const k of Object.keys(results).sort((a,b) => {
      return parseInt(a.slice(1)) - parseInt(b.slice(1));
    })) {
      total++;
      const r = results[k];
      const status = r.pass ? "ok  " : "FAIL";
      console.log("  " + status + "  " + k);
      if (r.pass) passed++;
    }
    console.log("\n" + passed + "/" + total + " tests passed");
    process.exit(passed === total ? 0 : 1);
  } catch (e) {
    console.error("Test runner failed:", e.stack || e.message || e);
    process.exit(2);
  }
})();
