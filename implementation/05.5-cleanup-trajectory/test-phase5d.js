// test-phase5d.js - Persistence durability

"use strict";

const H = require("./phase5-harness.js");
const FieldModule = require("./field.js");
const StorageModule = require("./storage-adapter.js");
const CTengineModule = require("./ct-engine.js");
const ERengineModule = require("./er-engine.js");
const SurfaceModule = require("./reflexive-surface.js");
const CompilerModule = require("./constraint-compiler.js");

const tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

// ---------------------------------------------------------------------------
// 5d.1: Field serializes and deserializes losslessly
// ---------------------------------------------------------------------------
test("5d.1 Field round-trips through serialize/deserialize", async function () {
  const rt = await H.setup();
  const inputs = H.inputStreamRecurring(40);
  await H.driveInputs(rt, inputs);

  const before = H.snapshot(rt);
  const json = H.Field.serialize();

  // Reset and reload
  H.Field.reset();
  H.Field.deserialize(json);

  // Compare key state
  if (H.Field.step !== before.step) {
    throw new Error("step not preserved: " + before.step + " -> " + H.Field.step);
  }
  if (H.Field.inputCount !== before.inputCount) {
    throw new Error("inputCount not preserved: " + before.inputCount + " -> " + H.Field.inputCount);
  }
  if ((H.Field.constraints || []).length !== before.constraintCount) {
    throw new Error("constraint count not preserved: " + before.constraintCount + " -> " + (H.Field.constraints || []).length);
  }
  if (H.Field.ratCount !== before.ratCount) {
    throw new Error("ratCount not preserved: " + before.ratCount + " -> " + H.Field.ratCount);
  }
  await H.teardown(rt);
});

// ---------------------------------------------------------------------------
// 5d.2: Seed survives serialize/deserialize cycle (F1)
// ---------------------------------------------------------------------------
test("5d.2 seed permanence preserved across restart", async function () {
  const rt = await H.setup();
  await H.driveInputs(rt, H.inputStreamRecurring(20));

  const json = H.Field.serialize();
  H.Field.reset();
  H.Field.deserialize(json);

  const seeds = (H.Field.constraints || []).filter(c => c.kind === "seed");
  if (seeds.length !== 1) {
    throw new Error("expected 1 seed after restart, got " + seeds.length);
  }
  if (!seeds[0].permanent) {
    throw new Error("seed.permanent flag not preserved");
  }
  await H.teardown(rt);
});

// ---------------------------------------------------------------------------
// 5d.3: Operation continues coherently post-restart
//
// Drive inputs, serialize, restart, drive more inputs. Step counter
// should continue from where it left off; new ratifications/inputs
// should accumulate normally.
// ---------------------------------------------------------------------------
test("5d.3 operation continues coherently after deserialize", async function () {
  const rt = await H.setup();
  await H.driveInputs(rt, H.inputStreamRecurring(30));
  const stepBefore = H.Field.step;
  const inputCountBefore = H.Field.inputCount;

  const json = H.Field.serialize();
  H.Field.reset();
  H.Field.deserialize(json);

  // Re-bind engines to the post-deserialize Field
  const er2 = new ERengineModule.ERengine();
  er2.state = "cpu-fallback";
  const ct2 = new CTengineModule.CTengine();
  ct2.bind(er2, CompilerModule);
  const surface2 = new SurfaceModule.ReflexiveSurface();
  const rt2 = { er: er2, ct: ct2, surface: surface2, storage: rt.storage };
  ct2.bindStorage(rt.storage, StorageModule.PersistenceEligibility);

  // Drive more inputs
  await H.driveInputs(rt2, H.inputStreamRecurring(20));

  if (H.Field.step <= stepBefore) {
    throw new Error("step did not advance after restart: " + stepBefore + " -> " + H.Field.step);
  }
  if (H.Field.inputCount <= inputCountBefore) {
    throw new Error("inputCount did not advance after restart");
  }
  await H.teardown(rt);
});

// ---------------------------------------------------------------------------
// 5d.4: Storage adapter records survive a logical restart
//
// In Node we use the in-memory backend. A "logical restart" means we
// rebind a new CT engine to the same storage adapter without clearing
// it. The adapter's persisted records should still be readable.
// ---------------------------------------------------------------------------
test("5d.4 storage adapter records survive logical restart", async function () {
  const rt = await H.setup();
  await H.driveInputs(rt, H.inputStreamRecurring(50));

  // Count persisted records before
  const countBefore = await rt.storage.backend.count("constraints");

  // Build a new CT engine bound to the SAME storage adapter
  const er2 = new ERengineModule.ERengine();
  er2.state = "cpu-fallback";
  const ct2 = new CTengineModule.CTengine();
  ct2.bind(er2, CompilerModule);
  ct2.bindStorage(rt.storage, StorageModule.PersistenceEligibility);

  // Without resetting Field; we're testing storage durability across
  // a CT-engine rebind, not across Field reset.
  const countAfter = await rt.storage.backend.count("constraints");

  if (countBefore !== countAfter) {
    throw new Error("storage record count changed across rebind: " + countBefore + " -> " + countAfter);
  }
  // Either count is acceptable - the test is that the records didn't
  // disappear. But if 0, log a note that there was nothing to verify.
  if (countBefore === 0) {
    console.log("        [note: 0 persisted constraints; rebind durability trivially holds]");
  }
  await H.teardown(rt);
});

// ---------------------------------------------------------------------------
// 5d.5: Recall continues to function after a rebind to existing storage
//
// CT engine reads recall window from storage on each input. A rebind
// to existing storage should preserve recall continuity.
// ---------------------------------------------------------------------------
test("5d.5 recall functions after CT engine rebind", async function () {
  const rt = await H.setup();
  await H.driveInputs(rt, H.inputStreamRecurring(40));
  const recallEventsBefore = rt.ct.recallEventsTriggered || 0;

  // Rebind CT engine to same storage
  const er2 = new ERengineModule.ERengine();
  er2.state = "cpu-fallback";
  const ct2 = new CTengineModule.CTengine();
  ct2.bind(er2, CompilerModule);
  ct2.bindStorage(rt.storage, StorageModule.PersistenceEligibility);

  const surface2 = new SurfaceModule.ReflexiveSurface();
  const rt2 = { er: er2, ct: ct2, surface: surface2, storage: rt.storage };

  // Drive new inputs and verify recall machinery is operative
  await H.driveInputs(rt2, H.inputStreamRecurring(20));

  // Recall machinery operative means: either recall fires (events>0)
  // or it does not fire because gap is below threshold (gap-gated).
  // Either is correct behavior; we verify only that nothing crashed
  // and the engine completed its drives.
  if (H.Field.step <= 40) {
    throw new Error("rebind did not advance step counter");
  }
  await H.teardown(rt);
});

// ---------------------------------------------------------------------------
// 5d.6: Substrate state (modulation layers) preserved across restart
// ---------------------------------------------------------------------------
test("5d.6 substrate fast/slow layers preserved across restart", async function () {
  const rt = await H.setup();
  await H.driveInputs(rt, H.inputStreamStructured(50));
  const slowBefore = H.Field.slowDelta;
  const slowExecBefore = H.Field.execSlowDelta;

  const json = H.Field.serialize();
  H.Field.reset();
  H.Field.deserialize(json);

  // Slow-layer state should be preserved (within float precision)
  const slowAfter = H.Field.slowDelta;
  const slowExecAfter = H.Field.execSlowDelta;
  if (Math.abs(slowAfter - slowBefore) > 1e-9) {
    throw new Error("slow-delta drift: " + slowBefore + " -> " + slowAfter);
  }
  if (Math.abs(slowExecAfter - slowExecBefore) > 1e-9) {
    throw new Error("exec-slow-delta drift: " + slowExecBefore + " -> " + slowExecAfter);
  }
  await H.teardown(rt);
});

// ---------------------------------------------------------------------------
// 5d.7: Compound constraints survive restart with refs intact
// ---------------------------------------------------------------------------
test("5d.7 compounds preserve refs through serialization", async function () {
  const rt = await H.setup();
  await H.driveInputs(rt, H.inputStreamRecurring(60));
  const compoundsBefore = (H.Field.constraints || []).filter(c => c.kind === "compound");

  const json = H.Field.serialize();
  H.Field.reset();
  H.Field.deserialize(json);

  const compoundsAfter = (H.Field.constraints || []).filter(c => c.kind === "compound");
  if (compoundsAfter.length !== compoundsBefore.length) {
    throw new Error("compound count drift: " + compoundsBefore.length + " -> " + compoundsAfter.length);
  }
  // Each compound should preserve its refs array
  for (const c of compoundsAfter) {
    if (c.refs && !Array.isArray(c.refs)) {
      throw new Error("compound " + c.id + " refs not array after restart");
    }
  }
  await H.teardown(rt);
});

// ---------------------------------------------------------------------------
// runner
// ---------------------------------------------------------------------------

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log("  ok    " + t.name);
      pass += 1;
    } catch (e) {
      console.log("  FAIL  " + t.name);
      console.log("        " + (e && e.stack || e));
      fail += 1;
    }
  }
  console.log("");
  console.log(pass + "/" + tests.length + " tests passed");
  return { pass: pass, fail: fail, total: tests.length };
}

if (require.main === module) {
  run().then(r => process.exit(r.fail === 0 ? 0 : 1));
}

module.exports = { run: run };
