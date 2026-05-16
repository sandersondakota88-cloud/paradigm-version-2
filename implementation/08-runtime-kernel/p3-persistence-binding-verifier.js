// p3-persistence-binding-verifier.js - P3 acceptance: no CRUD, just field

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

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
  sandbox.FieldModule.Field.reset();
  return sandbox.FieldModule;
}

async function main() {
  console.log("p3-persistence-binding verification");
  console.log("");

  // --------------------------------------------------------------------
  // PART A: construction
  // --------------------------------------------------------------------
  console.log("PART A: construction");
  console.log("");

  test("constructor requires fieldModule", () => {
    let threw = false;
    try { new Persistence.PersistenceBinding({}); } catch (e) { threw = true; }
    assert(threw);
  });

  test("CONFIG: default cadence + codec", () => {
    assert(Persistence.CONFIG.COMMIT_EVERY_TICKS === 10);
    assert(Persistence.CONFIG.CODEC === "strong");
  });

  test("Constructible with valid fieldModule", () => {
    const fm = buildField();
    const p = new Persistence.PersistenceBinding({ fieldModule: fm });
    assert(p);
    assert(p.currentAddress() === null);
    assert(p.observe().autocommits === 0);
  });

  // --------------------------------------------------------------------
  // PART B: bootHydrate
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART B: bootHydrate from lastKnownAddress");
  console.log("");

  // Set up: pre-seed a store with a known artifact
  let sharedStore, knownAddress;

  await asyncTest("Setup: pre-seed an artifact in shared store", async () => {
    sharedStore = new Persistence.MediaStore();
    const fm = buildField();
    fm.Field.step = 7;
    fm.Field.scalarDelta = 0.33;
    const p = new Persistence.PersistenceBinding({
      fieldModule: fm,
      store: sharedStore
    });
    const r = await p.commit();
    knownAddress = r.address;
    assert(typeof knownAddress === "string");
  });

  await asyncTest("bootHydrate without lastKnownAddress: hydrated=false", async () => {
    const fm = buildField();
    const p = new Persistence.PersistenceBinding({
      fieldModule: fm,
      store: sharedStore
    });
    const r = await p.bootHydrate();
    assert(r.hydrated === false);
    assert(r.address === null);
  });

  await asyncTest("bootHydrate with valid lastKnownAddress: state restored", async () => {
    const fm = buildField();
    // Field starts empty
    assert(fm.Field.step === 0);
    const p = new Persistence.PersistenceBinding({
      fieldModule: fm,
      store: sharedStore,
      lastKnownAddress: knownAddress
    });
    const r = await p.bootHydrate();
    assert(r.hydrated === true);
    assert(r.address === knownAddress);
    // State restored
    assert(fm.Field.step === 7);
    assert(Math.abs(fm.Field.scalarDelta - 0.33) < 1e-9);
    assert(p.observe().bootHydrations === 1);
  });

  await asyncTest("bootHydrate with bad address: hydrated=false; counter incremented", async () => {
    const fm = buildField();
    const p = new Persistence.PersistenceBinding({
      fieldModule: fm,
      store: sharedStore,
      lastKnownAddress: "nonexistent-address"
    });
    const r = await p.bootHydrate();
    assert(r.hydrated === false);
    assert(p.observe().bootHydrationFailures === 1);
  });

  // --------------------------------------------------------------------
  // PART C: tick-driven autocommit
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART C: tick-driven autocommit at metabolism cadence");
  console.log("");

  await asyncTest("First tick: baseline commit", async () => {
    const fm = buildField();
    const p = new Persistence.PersistenceBinding({
      fieldModule: fm,
      store: new Persistence.MediaStore()
    });
    const r = await p.tick();
    assert(r !== null, "first tick should commit baseline");
    assert(typeof r.address === "string");
    assert(p.observe().autocommits === 1);
  });

  await asyncTest("Subsequent ticks: only commit at cadence", async () => {
    const fm = buildField();
    const p = new Persistence.PersistenceBinding({
      fieldModule: fm,
      store: new Persistence.MediaStore(),
      config: { COMMIT_EVERY_TICKS: 5, CODEC: "strong" }
    });
    await p.tick();   // baseline at step=0

    // Step the field forward; mid-cadence ticks return null
    fm.Field.step = 2;
    const r1 = await p.tick();
    assert(r1 === null, "step=2 should not commit (cadence=5)");

    fm.Field.step = 4;
    const r2 = await p.tick();
    assert(r2 === null, "step=4 still under cadence");

    fm.Field.step = 5;
    const r3 = await p.tick();
    assert(r3 !== null, "step=5 should commit (cadence reached)");
    assert(p.observe().autocommits === 2);

    fm.Field.step = 8;
    const r4 = await p.tick();
    assert(r4 === null, "step=8 within next cadence window");

    fm.Field.step = 10;
    const r5 = await p.tick();
    assert(r5 !== null, "step=10 should commit");
    assert(p.observe().autocommits === 3);
  });

  // --------------------------------------------------------------------
  // PART D: addressChanged callback - the save-state boundary
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART D: addressChanged callback - save-state boundary");
  console.log("");

  await asyncTest("onAddressChanged fires after each autocommit", async () => {
    const fm = buildField();
    const captured = [];
    const p = new Persistence.PersistenceBinding({
      fieldModule: fm,
      store: new Persistence.MediaStore(),
      config: { COMMIT_EVERY_TICKS: 3, CODEC: "strong" },
      onAddressChanged: function (addr, fullResult) {
        captured.push({ addr, step: fullResult.committedAtStep });
      }
    });
    await p.tick();   // step=0 baseline
    fm.Field.step = 3;
    await p.tick();   // step=3 commit
    fm.Field.step = 6;
    await p.tick();   // step=6 commit
    assert(captured.length === 3);
    assert(typeof captured[0].addr === "string");
    assert(captured[0].step === 0);
    assert(captured[1].step === 3);
    assert(captured[2].step === 6);
  });

  await asyncTest("Callback throwing does NOT propagate (F3)", async () => {
    const fm = buildField();
    const p = new Persistence.PersistenceBinding({
      fieldModule: fm,
      store: new Persistence.MediaStore(),
      onAddressChanged: function () { throw new Error("callback-error"); }
    });
    let threw = false;
    try { await p.tick(); } catch (e) { threw = true; }
    assert(!threw, "tick should not propagate callback error");
    // Commit still recorded
    assert(p.observe().autocommits === 1);
  });

  // --------------------------------------------------------------------
  // PART E: "load a contact" = hydrate; "save a contact" = commit
  //         The structural claim that there is no CRUD layer.
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART E: no CRUD layer - just field state");
  console.log("");

  await asyncTest("Loading a contact: hydrate a known address", async () => {
    // Demonstration: a "contact" is identified by the field state
    // at a particular content address. No table lookup; the field
    // itself IS the contact.
    const fm = buildField();
    // Pretend we put contact data into field.constraints
    fm.Field.constraints.push({
      id: "contact::alice",
      kind: "data",
      pattern: { type: "contact-record" },
      data: { name: "Alice Smith", email: "alice@example.com", company: "Acme" },
      birth: 0, lastUsed: 0, uses: 0, weight: 1, permanent: false
    });
    const p1 = new Persistence.PersistenceBinding({
      fieldModule: fm,
      store: sharedStore,
      id: "alice-contact"
    });
    const r = await p1.commit();
    const aliceAddress = r.address;

    // Now in a fresh process: hydrate from aliceAddress
    const fm2 = buildField();
    const p2 = new Persistence.PersistenceBinding({
      fieldModule: fm2,
      store: sharedStore,
      lastKnownAddress: aliceAddress
    });
    await p2.bootHydrate();

    // Field state restored; contact is in constraints
    const aliceConstraint = fm2.Field.constraints.find(
      c => c.id === "contact::alice"
    );
    assert(aliceConstraint, "alice constraint restored");
    assert(aliceConstraint.data.name === "Alice Smith");
    assert(aliceConstraint.data.email === "alice@example.com");
  });

  await asyncTest("Saving a contact: coord write + commit (no CRUD API)", async () => {
    const fm = buildField();
    const p = new Persistence.PersistenceBinding({
      fieldModule: fm,
      store: sharedStore
    });
    // The "save" sequence: write a coord, commit
    fm.Field.constraints.push({
      id: "contact::bob",
      kind: "data",
      pattern: { type: "contact-record" },
      data: { name: "Bob Jones" },
      birth: 0, lastUsed: 0, uses: 0, weight: 1, permanent: false
    });
    const r = await p.commit();
    assert(typeof r.address === "string");

    // Verify by hydrating into a fresh field
    const fm2 = buildField();
    const p2 = new Persistence.PersistenceBinding({
      fieldModule: fm2,
      store: sharedStore
    });
    const ok = await p2.restore(r.address);
    assert(ok);
    const bob = fm2.Field.constraints.find(c => c.id === "contact::bob");
    assert(bob);
    assert(bob.data.name === "Bob Jones");
  });

  await asyncTest("'Updating a contact': re-write coord; new artifact", async () => {
    const fm = buildField();
    const p = new Persistence.PersistenceBinding({
      fieldModule: fm,
      store: sharedStore
    });
    fm.Field.constraints.push({
      id: "contact::carol",
      kind: "data",
      pattern: { type: "contact-record" },
      data: { name: "Carol", email: "old@example.com" },
      birth: 0, lastUsed: 0, uses: 0, weight: 1, permanent: false
    });
    const r1 = await p.commit();

    // "Update": modify the constraint's data; commit
    const carol = fm.Field.constraints.find(c => c.id === "contact::carol");
    carol.data.email = "new@example.com";
    fm.Field.step++;  // metabolism advanced

    const r2 = await p.commit();
    assert(r2.address !== r1.address, "update produces new address");

    // Both addresses still hydratable (F5)
    const fm_old = buildField();
    const p_old = new Persistence.PersistenceBinding({
      fieldModule: fm_old, store: sharedStore
    });
    await p_old.restore(r1.address);
    const carol_old = fm_old.Field.constraints.find(c => c.id === "contact::carol");
    assert(carol_old.data.email === "old@example.com");

    const fm_new = buildField();
    const p_new = new Persistence.PersistenceBinding({
      fieldModule: fm_new, store: sharedStore
    });
    await p_new.restore(r2.address);
    const carol_new = fm_new.Field.constraints.find(c => c.id === "contact::carol");
    assert(carol_new.data.email === "new@example.com");
  });

  // --------------------------------------------------------------------
  // PART F: restore() - runtime-driven hydration (P7's pathway)
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART F: restore() for runtime hydration");
  console.log("");

  await asyncTest("restore() switches the field to a different prior state", async () => {
    const fm = buildField();
    fm.Field.step = 100;
    const store = new Persistence.MediaStore();
    const p = new Persistence.PersistenceBinding({
      fieldModule: fm, store: store
    });
    const r1 = await p.commit();    // step=100

    fm.Field.step = 200;
    const r2 = await p.commit();    // step=200

    fm.Field.step = 300;
    // Now restore back to r1 (step=100) at runtime
    const ok = await p.restore(r1.address);
    assert(ok);
    assert(fm.Field.step === 100, "restored to step=100");
    assert(p.currentAddress() === r1.address);
  });

  // --------------------------------------------------------------------
  // PART G: F5 - artifacts append-only
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART G: F5 - artifacts append-only");
  console.log("");

  await asyncTest("Many commits accumulate; old addresses always retrievable", async () => {
    const fm = buildField();
    const store = new Persistence.MediaStore();
    const p = new Persistence.PersistenceBinding({
      fieldModule: fm, store: store
    });
    const addresses = [];
    for (let i = 0; i < 5; i++) {
      fm.Field.step = i * 10;
      fm.Field.scalarDelta = i * 0.1;
      const r = await p.commit();
      addresses.push({ addr: r.address, step: i * 10 });
    }
    // All 5 addresses retrievable
    for (const { addr, step } of addresses) {
      const fmCheck = buildField();
      const pCheck = new Persistence.PersistenceBinding({
        fieldModule: fmCheck, store: store
      });
      const ok = await pCheck.restore(addr);
      assert(ok, "restore failed for step=" + step);
      assert(fmCheck.Field.step === step,
        "expected step=" + step + ", got " + fmCheck.Field.step);
    }
  });

  // --------------------------------------------------------------------
  // PART H: closure
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART H: closure");
  console.log("");

  test("p3-persistence-binding.js: ASCII-only", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "p3-persistence-binding.js"), "utf8");
    const m = src.match(/[^\x00-\x7F]/);
    assert(!m, "non-ASCII: " + (m && m[0]));
  });

  test("p3-persistence-binding.js: no host APIs leaked", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "p3-persistence-binding.js"), "utf8");
    assert(src.indexOf("localStorage") < 0);
    assert(src.indexOf("fetch(") < 0);
    assert(src.indexOf("Date.now") < 0);
    assert(src.indexOf("XMLHttpRequest") < 0);
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
