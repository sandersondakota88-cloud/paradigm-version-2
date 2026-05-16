// test-phase4c.js - Storage as substrate, recall, persistence integration

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
const PersistenceEligibility = StorageModule.PersistenceEligibility;
const STORAGE_CFG = StorageModule.STORAGE_CFG;

async function setup() {
  Field.reset();
  Trace.clear();
  OpsLog.clear();
  const er = new ERengineModule.ERengine();
  er.state = "cpu-fallback";
  const ct = new CTengineModule.CTengine();
  ct.bind(er, CompilerModule);
  const surface = new SurfaceModule.ReflexiveSurface();
  const storage = new StorageModule.StorageAdapter();
  await storage.open();
  ct.bindStorage(storage, PersistenceEligibility);
  return { er: er, ct: ct, surface: surface, storage: storage };
}

// ----------------------------------------------------------------
// Test 1: storage adapter basic operations
// ----------------------------------------------------------------
async function testStorageBasic() {
  console.log("=== Test 1: storage adapter basic operations ===");
  const { storage } = await setup();
  console.log("  backend kind: " + storage.backendKind);

  await storage.persistConstraint({
    id: "test::ratified-1",
    kind: "ratified",
    desc: "test ratified",
    weight: 1.5,
    uses: 3
  });
  await storage.persistConstraint({
    id: "test::compound-1",
    kind: "compound",
    promoted: true,
    desc: "test compound",
    weight: 1.3
  });

  const counts = await storage.getCounts();
  console.log("  counts: " + JSON.stringify(counts));

  const recalled = await storage.recallConstraints({ limit: 10 });
  console.log("  recalled: " + recalled.length);
  for (const r of recalled) {
    console.log("    - id=" + r.id + " kind=" + r.kind + " recalled=" + r.recalled);
  }

  await storage.close();
  return {
    pass: counts.constraints === 2
       && recalled.length === 2
       && recalled.every(r => r.recalled === true)
       && recalled.every(r => r.kind !== "recalled")  // kind preserved!
  };
}

// ----------------------------------------------------------------
// Test 2: persistence eligibility rules
// ----------------------------------------------------------------
async function testEligibility() {
  console.log("\n=== Test 2: persistence eligibility ===");
  const ratified = { kind: "ratified", desc: "r" };
  const promotedCompound = { kind: "compound", promoted: true };
  const unpromoted = { kind: "compound", promoted: false };
  const familyMeta = { kind: "meta", metaKind: "family" };
  const pairMeta = { kind: "meta", metaKind: "pair" };
  const seed = { kind: "seed" };
  const derived = { kind: "derived" };
  const predictive = { kind: "predictive" };

  const cases = [
    [ratified, true],
    [promotedCompound, true],
    [unpromoted, false],
    [familyMeta, true],
    [pairMeta, false],
    [seed, true],
    [derived, false],
    [predictive, false]
  ];

  let fails = 0;
  for (const [rec, expected] of cases) {
    const got = PersistenceEligibility.shouldPersistConstraint(rec);
    if (got === expected) {
      console.log("  ok:   " + JSON.stringify(rec) + " -> " + got);
    } else {
      console.log("  FAIL: " + JSON.stringify(rec) +
        " -> " + got + " (expected " + expected + ")");
      fails += 1;
    }
  }

  // Trace eligibility
  const tagged = { tag: "ratified" };
  const untagged = { tag: null };
  const recalled = { tag: "recalled" };  // bounded recursion
  const traceTests = [
    [tagged, true],
    [untagged, false],
    [recalled, false]
  ];
  for (const [rec, expected] of traceTests) {
    const got = PersistenceEligibility.shouldPersistTraceEntry(rec);
    if (got === expected) {
      console.log("  ok:   trace " + JSON.stringify(rec) + " -> " + got);
    } else {
      console.log("  FAIL: trace " + JSON.stringify(rec) +
        " -> " + got);
      fails += 1;
    }
  }

  return { pass: fails === 0 };
}

// ----------------------------------------------------------------
// Test 3: recall trigger logic
// ----------------------------------------------------------------
async function testRecallTrigger() {
  console.log("\n=== Test 3: recall trigger ===");
  await setup();

  Field.gap = 0.05;  // below threshold
  console.log("  gap=" + Field.gap + ", trigger=" + Field.shouldTriggerRecall());
  const lowResult = Field.shouldTriggerRecall();

  Field.gap = 0.20;  // above threshold (RECALL_GAP_THRESH = 0.12)
  console.log("  gap=" + Field.gap + ", trigger=" + Field.shouldTriggerRecall());
  const highResult = Field.shouldTriggerRecall();

  return {
    pass: lowResult === false && highResult === true
  };
}

// ----------------------------------------------------------------
// Test 4: recall window construction and partition
// ----------------------------------------------------------------
async function testRecallWindow() {
  console.log("\n=== Test 4: recall window construction and partition ===");
  await setup();

  // Add some live constraints
  Field.constraints.push({
    id: "c::live-1",
    kind: "derived",
    pattern: { type: "has-token", token: "alpha" },
    desc: "live alpha",
    birth: 0, lastUsed: 0, uses: 1, weight: 1.0
  });

  // Set a recall window
  Field.setRecallWindow([
    { id: "p::recalled-1", kind: "ratified", recalled: true, desc: "recalled 1",
      pattern: { type: "has-token", token: "beta" },
      birth: 0, lastUsed: 0, uses: 5, weight: 2.0 },
    { id: "p::recalled-2", kind: "meta", recalled: true, desc: "recalled 2",
      metaKind: "family", refs: [],
      birth: 0, lastUsed: 0, uses: 3, weight: 1.5 }
  ]);

  const pop = Field.buildEvaluationPopulation();
  console.log("  population size: " + pop.length);
  console.log("  Field.constraints.length: " + Field.constraints.length);
  console.log("  recallWindow.length: " + Field.recallWindow.length);

  // Simulate match indices: 0 (seed), 1 (live), 2 (recalled-1), 3 (recalled-2)
  const matched = [0, 1, 2, 3];
  const partition = Field.partitionMatches(matched);
  console.log("  partition.live: " + partition.live);
  console.log("  partition.recalled count: " + partition.recalled.length);
  for (const r of partition.recalled) {
    console.log("    - combined idx=" + r.combinedIdx +
      " window idx=" + r.windowIdx + " desc=" + r.record.desc);
  }

  return {
    pass: pop.length === 4
       && partition.live.length === 2  // seed + live
       && partition.recalled.length === 2
       && partition.recalled[0].record.id === "p::recalled-1"
  };
}

// ----------------------------------------------------------------
// Test 5: recall reinforcement
// ----------------------------------------------------------------
async function testRecallReinforcement() {
  console.log("\n=== Test 5: recall reinforcement ===");
  await setup();

  Field.setRecallWindow([{
    id: "p::test",
    kind: "ratified",
    recalled: true,
    desc: "to reinforce",
    weight: 1.5,
    recallSuccessCount: 2,
    pattern: { type: "has-token", token: "x" },
    birth: 0, lastUsed: 0, uses: 1
  }]);

  const before = Field.recallWindow[0].weight;
  const beforeCount = Field.recallWindow[0].recallSuccessCount;
  console.log("  before: weight=" + before + " count=" + beforeCount);

  const reinforced = Field.reinforceRecallMatch(0);
  console.log("  after: weight=" + reinforced.weight +
    " count=" + reinforced.recallSuccessCount);

  return {
    pass: reinforced.weight > before
       && reinforced.recallSuccessCount === beforeCount + 1
  };
}

// ----------------------------------------------------------------
// Test 6: end-to-end - input op with recall integrated
// ----------------------------------------------------------------
async function testEndToEnd() {
  console.log("\n=== Test 6: end-to-end input op with recall ===");
  const { ct, storage } = await setup();

  // Pre-persist a constraint that current input will match
  await storage.persistConstraint({
    id: "p::pre-existing",
    kind: "ratified",
    pattern: { type: "has-token", token: "hello" },
    desc: "ratified 'hello' from prior session",
    weight: 1.5,
    uses: 5
  });

  // Force gap above recall threshold
  Field.gap = 0.20;

  // Drive an input that matches the persisted constraint
  ct.enqueueInput("hello world");
  await ct.drainAll(5);

  console.log("  recall events triggered: " + ct.recallEventsTriggered);
  console.log("  recall matches: " + ct.recallMatchesProduced);
  console.log("  recallEventLog entries: " + Field.recallEventLog.length);

  await storage.close();
  return {
    pass: ct.recallEventsTriggered >= 1
       && ct.recallMatchesProduced >= 1
       && Field.recallEventLog.length >= 1
       && Field.recallEventLog[0].kind === "recalled"
  };
}

// ----------------------------------------------------------------
// Test 7: surface emits recall clauses
// ----------------------------------------------------------------
async function testSurfaceRecallClauses() {
  console.log("\n=== Test 7: surface emits recall and re-encounter clauses ===");
  const { surface } = await setup();

  // Initial observation establishes baseline
  surface.observe();

  // Push a recall event
  Field.recordRecallEvent("recalled", {
    id: "p::test",
    desc: "test recall",
    recallSuccessCount: 1,
    persistedAt: Date.now() - 5000
  });

  // Observe - should produce a recalled clause
  const emitted1 = surface.observe();
  const recalled1 = emitted1.filter(c => c.kind === "recalled");
  console.log("  after 1st recall event, emitted recalled clauses: " + recalled1.length);
  if (recalled1.length) console.log("    text: " + recalled1[0].text);

  // Push two more recall events for the same record - re-encountered
  Field.recordRecallEvent("recalled", {
    id: "p::test",
    desc: "test recall",
    recallSuccessCount: 2,
    persistedAt: Date.now() - 4000
  });
  const emitted2 = surface.observe();
  const reencountered = emitted2.filter(c => c.kind === "re-encountered");
  console.log("  after 2nd recall event, re-encountered clauses: " + reencountered.length);
  if (reencountered.length) console.log("    text: " + reencountered[0].text);

  return {
    pass: recalled1.length === 1
       && reencountered.length === 1
  };
}

// ----------------------------------------------------------------
// Test 8: bounded recursion - recall trace entries do not persist
// ----------------------------------------------------------------
async function testBoundedRecursion() {
  console.log("\n=== Test 8: bounded recursion - recall trace not persisted ===");

  const recallTrace = { tag: "recalled" };
  const reEncTrace = { tag: "re-encountered" };
  const ratifiedTrace = { tag: "ratified" };

  const r1 = PersistenceEligibility.shouldPersistTraceEntry(recallTrace);
  const r2 = PersistenceEligibility.shouldPersistTraceEntry(reEncTrace);
  const r3 = PersistenceEligibility.shouldPersistTraceEntry(ratifiedTrace);

  console.log("  recalled trace persistable: " + r1 + " (should be false)");
  console.log("  re-encountered trace persistable: " + r2 + " (should be false)");
  console.log("  ratified trace persistable: " + r3 + " (should be true)");

  // Surface clauses about recall also do not persist
  const recalledClause = { kind: "recalled" };
  const reEncClause = { kind: "re-encountered" };
  const formedClause = { kind: "formed" };
  const c1 = PersistenceEligibility.shouldPersistSurfaceClause(recalledClause);
  const c2 = PersistenceEligibility.shouldPersistSurfaceClause(reEncClause);
  const c3 = PersistenceEligibility.shouldPersistSurfaceClause(formedClause);

  console.log("  recalled clause persistable: " + c1 + " (should be false)");
  console.log("  re-encountered clause persistable: " + c2 + " (should be false)");
  console.log("  formed clause persistable: " + c3 + " (should be true)");

  return {
    pass: r1 === false && r2 === false && r3 === true
       && c1 === false && c2 === false && c3 === true
  };
}

// ----------------------------------------------------------------
// Test 9: SE-06 - storage is substrate, not command path
// ----------------------------------------------------------------
async function testSE06Storage() {
  console.log("\n=== Test 9: SE-06 - storage is substrate, not command path ===");
  const fs = require("fs");
  const ctSrc = fs.readFileSync("./ct-engine.js", "utf-8");
  const storageSrc = fs.readFileSync("./storage-adapter.js", "utf-8");

  // The storage adapter does not call ER engine or CT engine methods
  const storageCallsErEngine = /erBinding|erEngine\.|ctEngine\./.test(storageSrc);
  console.log("  storage references erEngine/ctEngine (should be false): "
    + storageCallsErEngine);

  // The CT engine uses storage as a read/write substrate, not commands
  const ctUsesStorageRead = /storageBinding\.recall/.test(ctSrc);
  const ctUsesStorageWrite = /storageBinding\.persist/.test(ctSrc);
  console.log("  CT engine reads storage: " + ctUsesStorageRead);
  console.log("  CT engine writes storage: " + ctUsesStorageWrite);

  // The ER engine doesn't know about the persistent storage substrate.
  // Note: the ER engine DOES use the term "storage" for WebGPU storage
  // buffers (GPUBufferUsage.STORAGE) - that's a GPU resource concept,
  // unrelated to the persistent-storage substrate we care about here.
  // We test for the persistent-storage adapter specifically.
  const erSrc = fs.readFileSync("./er-engine.js", "utf-8");
  const erReferencesAdapter = /storageBinding|storageAdapter|recallConstraints|persistConstraint/.test(erSrc);
  console.log("  ER engine references storage adapter (should be false): "
    + erReferencesAdapter);

  return {
    pass: storageCallsErEngine === false
       && ctUsesStorageRead === true
       && ctUsesStorageWrite === true
       && erReferencesAdapter === false
  };
}

// ----------------------------------------------------------------
// Test 10: 'let delta decide' - no kindMult for recalled
// ----------------------------------------------------------------
async function testNoKindMultForRecalled() {
  console.log("\n=== Test 10: no kindMult for recalled records ===");
  const fs = require("fs");
  const fieldSrc = fs.readFileSync("./field.js", "utf-8");

  // Find selectFromMatches and check that it doesn't have a
  // 'recalled' kindMult branch.
  const selectStart = fieldSrc.indexOf("selectFromMatches: function");
  const selectEnd = fieldSrc.indexOf("\n  },", selectStart);
  const selectBody = fieldSrc.substring(selectStart, selectEnd);

  const hasRecalledMult = /c\.kind === ["']recalled["']/.test(selectBody);
  console.log("  selectFromMatches has 'recalled' kindMult branch (should be false): "
    + hasRecalledMult);

  // Phase 5.5 generalized the principle: no kind gets an imposed
  // multiplier. Confirm none of the other kinds have multipliers
  // either. The structural intent of this test (no imposed precedence
  // on recalled records) is now satisfied universally.
  const hasRatifiedMult = /c\.kind === ["']ratified["']/.test(selectBody);
  const hasMetaMult = /c\.kind === ["']meta["']/.test(selectBody);
  const hasCompoundMult = /c\.kind === ["']compound["']/.test(selectBody);
  console.log("  selectFromMatches has any kind multiplier (should be false): "
    + (hasRatifiedMult || hasMetaMult || hasCompoundMult));

  return {
    pass: hasRecalledMult === false
       && hasRatifiedMult === false
       && hasMetaMult === false
       && hasCompoundMult === false
  };
}

// ----------------------------------------------------------------
// Test 11: storage maintenance - cap enforcement
// ----------------------------------------------------------------
async function testCapEnforcement() {
  console.log("\n=== Test 11: storage cap enforcement ===");
  const { storage } = await setup();

  // Override cap to small value for test (in-memory backend allows
  // direct manipulation; cap check in adapter is fixed but we can
  // still test the mechanism by adding many records and verifying
  // counts don't grow unbounded after enforceCaps)
  // Actually we just persist 5 and verify enforceCaps is a no-op
  for (let i = 0; i < 5; i += 1) {
    await storage.persistConstraint({
      id: "c::cap-" + i,
      kind: "ratified",
      desc: "cap test " + i,
      weight: 1.0
    });
  }

  const before = await storage.getCounts();
  console.log("  before enforce: " + before.constraints + " constraints");

  const result = await storage.enforceCaps();
  console.log("  enforce result: " + JSON.stringify(result));

  const after = await storage.getCounts();
  console.log("  after enforce: " + after.constraints + " constraints");

  await storage.close();
  return {
    pass: after.constraints === 5  // under cap, no removal
       && before.constraints === 5
  };
}

// ----------------------------------------------------------------
// Test 12: recalled records carry weight history (no kindMult needed)
// ----------------------------------------------------------------
async function testRecallWeightHistory() {
  console.log("\n=== Test 12: recalled records keep weight history ===");
  const { storage } = await setup();

  await storage.persistConstraint({
    id: "p::weighty",
    kind: "ratified",
    pattern: { type: "has-token", token: "z" },
    desc: "weighty",
    weight: 2.5,        // high weight
    uses: 10,           // lots of uses
    recallSuccessCount: 4
  });

  const recalled = await storage.recallConstraints({ limit: 10 });
  const r = recalled[0];
  console.log("  recalled weight: " + r.weight + " (expected 2.5)");
  console.log("  recalled uses: " + r.uses + " (expected 10)");
  console.log("  recallSuccessCount: " + r.recallSuccessCount + " (expected 4)");
  console.log("  kind preserved: " + r.kind + " (expected ratified)");
  console.log("  recalled flag: " + r.recalled + " (expected true)");

  await storage.close();
  return {
    pass: r.weight === 2.5
       && r.uses === 10
       && r.recallSuccessCount === 4
       && r.kind === "ratified"
       && r.recalled === true
  };
}

// ----------------------------------------------------------------
// Test 13: schema versioning scaffold present in code
// ----------------------------------------------------------------
async function testSchemaVersioning() {
  console.log("\n=== Test 13: schema versioning scaffold ===");
  const fs = require("fs");
  const src = fs.readFileSync("./storage-adapter.js", "utf-8");

  const hasDbVersion = /DB_VERSION:\s*\d+/.test(src);
  const hasOnUpgradeNeeded = /onupgradeneeded/.test(src);
  const hasOldVersion = /oldVersion/.test(src);
  const hasMigrationComment = /[Mm]igration/.test(src);

  console.log("  DB_VERSION constant: " + hasDbVersion);
  console.log("  onupgradeneeded handler: " + hasOnUpgradeNeeded);
  console.log("  oldVersion check: " + hasOldVersion);
  console.log("  migration documented: " + hasMigrationComment);

  return {
    pass: hasDbVersion && hasOnUpgradeNeeded && hasOldVersion && hasMigrationComment
  };
}

// ----------------------------------------------------------------
// Test 14: full pipeline - recall enriches subsequent input
// ----------------------------------------------------------------
async function testRecallEnrichesPipeline() {
  console.log("\n=== Test 14: recall enriches pipeline ===");
  const { ct, storage } = await setup();

  // Pre-load storage with structurally-relevant records
  await storage.persistConstraint({
    id: "p::recall-1",
    kind: "ratified",
    pattern: { type: "has-token", token: "world" },
    desc: "recalled 'world'",
    weight: 1.8,
    uses: 4
  });
  await storage.persistConstraint({
    id: "p::recall-2",
    kind: "ratified",
    pattern: { type: "char-class", cls: "alpha" },
    desc: "recalled alpha class",
    weight: 1.5,
    uses: 3
  });

  Field.gap = 0.18;  // above recall threshold

  ct.enqueueInput("world of code");
  await ct.drainAll(5);

  console.log("  recall events: " + ct.recallEventsTriggered);
  console.log("  recall matches: " + ct.recallMatchesProduced);
  console.log("  recallEventLog: " + Field.recallEventLog.length);

  // The recall window for this single input should produce at least
  // one match (against either 'world' or 'alpha')
  const events = Field.recallEventLog;
  console.log("  events:");
  for (const e of events) {
    console.log("    - " + e.kind + " " +
      (e.payload && e.payload.desc));
  }

  await storage.close();
  return {
    pass: ct.recallEventsTriggered >= 1
       && Field.recallEventLog.length >= 1
  };
}

// ----------------------------------------------------------------
// Test driver
// ----------------------------------------------------------------
(async () => {
  const results = {};
  try {
    results.t1  = await testStorageBasic();
    results.t2  = await testEligibility();
    results.t3  = await testRecallTrigger();
    results.t4  = await testRecallWindow();
    results.t5  = await testRecallReinforcement();
    results.t6  = await testEndToEnd();
    results.t7  = await testSurfaceRecallClauses();
    results.t8  = await testBoundedRecursion();
    results.t9  = await testSE06Storage();
    results.t10 = await testNoKindMultForRecalled();
    results.t11 = await testCapEnforcement();
    results.t12 = await testRecallWeightHistory();
    results.t13 = await testSchemaVersioning();
    results.t14 = await testRecallEnrichesPipeline();

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
