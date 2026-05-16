// m1-substrate-instance-verifier.js - M1 acceptance: factory works

"use strict";

const fs = require("fs");
const path = require("path");

const M1 = require("./m1-substrate-instance.js");
const Pub = require("./contributor-publisher.js");
const IdentityModule = require("./p2-identity-adapter.js");
const Persistence = require("./p3-persistence-binding.js");

let pass = 0, fail = 0;
const failures = [];

function test(name, fn) {
  try { fn(); pass++; console.log("  OK   " + name); }
  catch (e) { fail++; failures.push({ name, error: e }); console.log("  FAIL " + name + ": " + e.message); }
}
async function asyncTest(name, fn) {
  try { await fn(); pass++; console.log("  OK   " + name); }
  catch (e) { fail++; failures.push({ name, error: e }); console.log("  FAIL " + name + ": " + e.message); }
}
function assert(c, m) { if (!c) throw new Error("assertion failed: " + (m || "")); }

async function main() {
  console.log("m1-substrate-instance verification");
  console.log("");

  // --------------------------------------------------------------------
  // PART A: factory produces isolated instance
  // --------------------------------------------------------------------
  console.log("PART A: factory basics");
  console.log("");

  test("createSubstrate returns instance with id, fieldModule, field", () => {
    const inst = M1.createSubstrate({ id: "test-1" });
    assert(inst.id === "test-1");
    assert(inst.fieldModule);
    assert(inst.field);
    assert(typeof inst.field.serialize === "function");
    assert(typeof inst.field.deserialize === "function");
  });

  test("Default id when not specified", () => {
    const inst = M1.createSubstrate({});
    assert(inst.id === "substrate-anon");
  });

  test("F1: each instance has its own seed at constraints[0]", () => {
    const inst = M1.createSubstrate({ id: "f1-test" });
    assert(inst.field.constraints.length === 1);
    assert(inst.field.constraints[0].kind === "seed");
    assert(inst.field.constraints[0].permanent === true);
  });

  test("Intake extension installed: field.intake works", () => {
    const inst = M1.createSubstrate({ id: "intake-test" });
    assert(inst.field.intake);
    assert(typeof inst.field.intake.publish === "function");
    assert(Array.isArray(inst.field.intake.records));
  });

  // --------------------------------------------------------------------
  // PART B: instance independence (the key invariant)
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART B: instance independence (no leakage)");
  console.log("");

  test("Two instances: different field references", () => {
    const a = M1.createSubstrate({ id: "A" });
    const b = M1.createSubstrate({ id: "B" });
    assert(a.field !== b.field);
    assert(a.fieldModule !== b.fieldModule);
  });

  test("Mutating A's field does NOT affect B's field", () => {
    const a = M1.createSubstrate({ id: "A" });
    const b = M1.createSubstrate({ id: "B" });

    // Capture B's defaults BEFORE A mutates
    const bStepDefault = b.field.step;
    const bScalarDefault = b.field.scalarDelta;
    const bConstraintCountDefault = b.field.constraints.length;

    a.field.step = 999;
    a.field.scalarDelta = 0.7;
    a.field.constraints.push({
      id: "test", kind: "derived", pattern: { type: "test" },
      birth: 0, lastUsed: 0, uses: 0, weight: 1, permanent: false
    });

    // B's state unchanged: still at its defaults (whatever they are)
    assert(b.field.step === bStepDefault, "B's step unchanged");
    assert(b.field.scalarDelta === bScalarDefault,
      "B's scalarDelta unchanged: was " + bScalarDefault + ", now " + b.field.scalarDelta);
    assert(b.field.constraints.length === bConstraintCountDefault,
      "B's constraint count unchanged");
    // A's mutations isolated to A
    assert(a.field.step === 999);
    assert(a.field.scalarDelta === 0.7);
  });

  test("Three instances side-by-side: independent constraint arrays", () => {
    const a = M1.createSubstrate({ id: "A" });
    const b = M1.createSubstrate({ id: "B" });
    const c = M1.createSubstrate({ id: "C" });

    a.field.constraints.push({ id: "a1", kind: "derived", birth: 0, lastUsed: 0, uses: 0, weight: 1, permanent: false });
    a.field.constraints.push({ id: "a2", kind: "derived", birth: 0, lastUsed: 0, uses: 0, weight: 1, permanent: false });
    b.field.constraints.push({ id: "b1", kind: "derived", birth: 0, lastUsed: 0, uses: 0, weight: 1, permanent: false });
    // C unchanged

    assert(a.field.constraints.length === 3, "A: seed + 2 data");
    assert(b.field.constraints.length === 2, "B: seed + 1 data");
    assert(c.field.constraints.length === 1, "C: seed only");
  });

  test("Trace state per-instance", () => {
    const a = M1.createSubstrate({ id: "A" });
    const b = M1.createSubstrate({ id: "B" });
    a.fieldModule.Trace.entries.push({ step: 1, op: "test", scope: "A" });
    assert(a.fieldModule.Trace.entries.length === 1);
    assert(b.fieldModule.Trace.entries.length === 0,
      "B's trace independent of A's: " + b.fieldModule.Trace.entries.length);
  });

  test("Intake records per-instance (no leakage between intake streams)", () => {
    const a = M1.createSubstrate({ id: "A" });
    const b = M1.createSubstrate({ id: "B" });
    const pubA = Pub.ContributorPublisher.attach(a.field);
    const pubB = Pub.ContributorPublisher.attach(b.field);

    pubA.publish({ type: "test", value: "from-A", source: "A" });
    pubA.publish({ type: "test", value: "from-A2", source: "A" });
    pubB.publish({ type: "test", value: "from-B", source: "B" });

    assert(a.field.intake.records.length === 2);
    assert(b.field.intake.records.length === 1);
    // Verify content distinct
    assert(a.field.intake.records[0].value === "from-A");
    assert(b.field.intake.records[0].value === "from-B");
  });

  // --------------------------------------------------------------------
  // PART C: M1 composes with K2/P-layer
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART C: M1 composes with K2 + P-layer");
  console.log("");

  test("M1 + K2 publisher: publish flow works on factory-built instance", () => {
    const inst = M1.createSubstrate({ id: "k2-compose" });
    const pub = Pub.ContributorPublisher.attach(inst.field);
    pub.publish({ type: "x", value: 1, source: "test" });
    assert(inst.field.intake.records.length === 1);
  });

  test("M1 + P2 identity adapter: setSession publishes through factory instance", () => {
    const inst = M1.createSubstrate({ id: "p2-compose" });
    const pub = Pub.ContributorPublisher.attach(inst.field);
    const id = new IdentityModule.IdentityAdapter({ publisher: pub });
    id.setSession({ user_id: "u-1", role: "admin" });
    const recs = inst.field.intake.records.filter(
      r => r.source === "identity-adapter");
    assert(recs.length === 3);
  });

  await asyncTest("M1 + P3 persistence: commit + restore on factory instance", async () => {
    const inst = M1.createSubstrate({ id: "p3-compose" });
    const persist = new Persistence.PersistenceBinding({
      fieldModule: inst.fieldModule,
      store: new Persistence.MediaStore()
    });
    inst.field.step = 42;
    const r = await persist.commit();
    assert(typeof r.address === "string");

    // Restore in a fresh M1 instance
    const inst2 = M1.createSubstrate({ id: "p3-compose-2" });
    const persist2 = new Persistence.PersistenceBinding({
      fieldModule: inst2.fieldModule,
      store: persist.identity.store
    });
    const ok = await persist2.restore(r.address);
    assert(ok);
    assert(inst2.field.step === 42, "step restored across factory instances");
  });

  // --------------------------------------------------------------------
  // PART D: F1 across many instances
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART D: F1 - seed permanence per instance");
  console.log("");

  test("Each instance's seed has same content but distinct identity", () => {
    const a = M1.createSubstrate({ id: "seed-A" });
    const b = M1.createSubstrate({ id: "seed-B" });
    // Same content (seed is canonical)
    assert(a.field.constraints[0].kind === b.field.constraints[0].kind);
    // But different objects (instance independence)
    assert(a.field.constraints[0] !== b.field.constraints[0],
      "seed objects should be distinct refs");
  });

  test("After teardown: instance can be reset; independence preserved", () => {
    const a = M1.createSubstrate({ id: "teardown-A" });
    const b = M1.createSubstrate({ id: "teardown-B" });
    a.field.step = 100;
    b.field.step = 200;
    a.teardown();
    assert(a.field.step === 0, "A reset");
    assert(b.field.step === 200, "B unaffected by A teardown");
  });

  // --------------------------------------------------------------------
  // PART E: observation surface
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART E: observation surface");
  console.log("");

  test("observe() reports per-instance state", () => {
    const a = M1.createSubstrate({ id: "obs-A" });
    a.field.step = 5;
    a.field.constraints.push({ id: "x", kind: "derived", birth: 0, lastUsed: 0, uses: 0, weight: 1, permanent: false });
    const o = a.observe();
    assert(o.id === "obs-A");
    assert(o.step === 5);
    assert(o.constraintCount === 2);
  });

  // --------------------------------------------------------------------
  // PART F: closure
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART F: closure");
  console.log("");

  test("m1-substrate-instance.js: ASCII-only", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "m1-substrate-instance.js"), "utf8");
    const m = src.match(/[^\x00-\x7F]/);
    assert(!m, "non-ASCII: " + (m && m[0]));
  });

  test("m1-substrate-instance.js: no host APIs leaked", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "m1-substrate-instance.js"), "utf8");
    assert(src.indexOf("localStorage") < 0);
    assert(src.indexOf("fetch(") < 0);
    assert(src.indexOf("XMLHttpRequest") < 0);
    assert(src.indexOf("WebSocket") < 0);
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
}

main().catch(e => { console.error("Fatal:", e); process.exit(2); });
