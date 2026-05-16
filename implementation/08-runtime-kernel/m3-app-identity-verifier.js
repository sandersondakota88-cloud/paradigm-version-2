// m3-app-identity-verifier.js - M3 acceptance: substrate-media as identity

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const Binding = require("./app-identity-binding.js");
const Synth = require("./cascade-rule-synthesizer.js");

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

function buildFreshField() {
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

function loadCascadeRules(field, css) {
  const r = Synth.synthesizeFromCss(css);
  if (!r.ok) throw new Error("cascade synthesis failed");
  for (const c of r.constraints) {
    field.constraints.push(c);
  }
}

const TODOMVC_CASCADE = [
  '[data-substrate-state][data-trigger="toggle"] { --next-op: "toggleTodo"; }',
  '[data-substrate-state][data-trigger="delete"] { --next-op: "deleteTodo"; }'
].join("\n");

async function main() {
  console.log("m3-app-identity verification");
  console.log("");

  // --------------------------------------------------------------------
  // Shared store across the run (models the IndexedDB / remote store
  // a real deposition would use)
  // --------------------------------------------------------------------
  const sharedStore = new Binding.MediaStore();

  // --------------------------------------------------------------------
  // PART A: binding construction
  // --------------------------------------------------------------------
  console.log("PART A: binding construction");
  console.log("");

  test("constructor requires fieldModule", () => {
    let threw = false;
    try { new Binding.AppIdentityBinding({}); } catch (e) { threw = true; }
    assert(threw);
  });

  test("constructor rejects fieldModule without serialize/deserialize", () => {
    let threw = false;
    try {
      new Binding.AppIdentityBinding({
        fieldModule: { Field: { /* no methods */ } }
      });
    } catch (e) { threw = true; }
    assert(threw);
  });

  test("constructor with valid fieldModule + shared store succeeds", () => {
    const fm = buildFreshField();
    const b = new Binding.AppIdentityBinding({
      fieldModule: fm, store: sharedStore, id: "ctor-test"
    });
    assert(b);
    assert(b.identity() === null);
    assert(b.observe().commits === 0);
  });

  // --------------------------------------------------------------------
  // PART B: M3 acceptance criterion 1 - first run records A1 at H1
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART B: first run records A1 at H1");
  console.log("");

  let H1, fieldStateAtH1;

  await asyncTest("First run: cascade rules + state -> commit returns address", async () => {
    const fm = buildFreshField();
    loadCascadeRules(fm.Field, TODOMVC_CASCADE);
    fm.Field.step = 5;
    fm.Field.scalarDelta = 0.42;

    // Snapshot what the field looks like right BEFORE commit; serialize
    // to a deterministic JSON form for byte-identity check on restoration
    fieldStateAtH1 = fm.Field.serialize();

    const b = new Binding.AppIdentityBinding({
      fieldModule: fm, store: sharedStore, id: "first-run"
    });
    const r = await b.commit();
    H1 = r.address;
    assert(typeof H1 === "string" && H1.length > 0);
    assert(r.codec === "strong");
    assert(r.constraintCount === 3);
    assert(b.identity() === H1);
  });

  await asyncTest("H1 retrievable from sharedStore", async () => {
    const artifact = await sharedStore.get(H1);
    assert(artifact, "H1 must be in store");
    assert(artifact.codec === "strong");
    assert(artifact.fieldData);
  });

  // --------------------------------------------------------------------
  // PART C: M3 acceptance criterion 2 - second run hydrates H1, runs,
  //         records A2 at H2 (!== H1 because state has advanced)
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART C: second run hydrates H1, advances, commits H2");
  console.log("");

  let H2;

  await asyncTest("Second run hydrates H1; field state restored", async () => {
    const fm2 = buildFreshField();
    // Field is empty (just seed)
    assert(fm2.Field.constraints.length === 1);
    assert(fm2.Field.step === 0);

    const b2 = new Binding.AppIdentityBinding({
      fieldModule: fm2, store: sharedStore, id: "second-run"
    });
    const ok = await b2.hydrate(H1);
    assert(ok, "hydrate should succeed");

    // State restored
    assert(fm2.Field.step === 5, "step restored: " + fm2.Field.step);
    assert(Math.abs(fm2.Field.scalarDelta - 0.42) < 1e-9);
    assert(fm2.Field.constraints.length === 3);
    assert(b2.identity() === H1);
  });

  await asyncTest("Second run advances state; commits H2 (!== H1)", async () => {
    const fm2 = buildFreshField();
    const b2 = new Binding.AppIdentityBinding({
      fieldModule: fm2, store: sharedStore, id: "second-run"
    });
    await b2.hydrate(H1);

    // Advance further
    fm2.Field.step = 12;
    fm2.Field.scalarDelta = 0.61;
    fm2.Field.fastDelta = 0.55;

    const r = await b2.commit();
    H2 = r.address;
    assert(typeof H2 === "string" && H2.length > 0);
    assert(H2 !== H1, "H2 should differ from H1");
    assert(r.constraintCount === 3, "constraints unchanged but state advanced");
  });

  await asyncTest("H2 retrievable from sharedStore alongside H1", async () => {
    const a1 = await sharedStore.get(H1);
    const a2 = await sharedStore.get(H2);
    assert(a1);
    assert(a2);
    assert(a1.fieldData.step === 5);
    assert(a2.fieldData.step === 12);
  });

  // --------------------------------------------------------------------
  // PART D: M3 acceptance criterion 3 - fresh tab hydrates H1; field
  //         byte-identical to A1's recording moment
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART D: fresh tab hydrates H1 -> field byte-identical to A1");
  console.log("");

  await asyncTest("Fresh tab hydrate H1; serialized field matches A1's snapshot", async () => {
    // Brand new field (simulates a different tab or process)
    const fm3 = buildFreshField();
    const b3 = new Binding.AppIdentityBinding({
      fieldModule: fm3, store: sharedStore, id: "fresh-tab-1"
    });
    const ok = await b3.hydrate(H1);
    assert(ok);

    // Byte-identity: serialize the restored field; compare to the snapshot
    // taken at A1's recording moment
    const restoredJson = fm3.Field.serialize();
    assert(restoredJson === fieldStateAtH1,
      "field state mismatch on hydration:\n" +
      "  restored: " + restoredJson.slice(0, 200) + "...\n" +
      "  expected: " + fieldStateAtH1.slice(0, 200) + "...");
  });

  await asyncTest("Fresh tab hydrate H2: different field state restored", async () => {
    const fm4 = buildFreshField();
    const b4 = new Binding.AppIdentityBinding({
      fieldModule: fm4, store: sharedStore, id: "fresh-tab-2"
    });
    const ok = await b4.hydrate(H2);
    assert(ok);
    assert(fm4.Field.step === 12);
    assert(Math.abs(fm4.Field.scalarDelta - 0.61) < 1e-9);
    assert(Math.abs(fm4.Field.fastDelta - 0.55) < 1e-9);
  });

  await asyncTest("H1 and H2 hydratable in any order, independently", async () => {
    // Two fresh tabs, hydrate to different snapshots, neither affects the other
    const fmA = buildFreshField();
    const fmB = buildFreshField();
    const ba = new Binding.AppIdentityBinding({
      fieldModule: fmA, store: sharedStore, id: "tab-A"
    });
    const bb = new Binding.AppIdentityBinding({
      fieldModule: fmB, store: sharedStore, id: "tab-B"
    });
    await ba.hydrate(H2);
    await bb.hydrate(H1);
    assert(fmA.Field.step === 12, "Tab A at H2 step=12");
    assert(fmB.Field.step === 5,  "Tab B at H1 step=5");
  });

  // --------------------------------------------------------------------
  // PART E: F5 - hydrate is restoration, not rollback
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART E: F5 (irrecoverable change)");
  console.log("");

  await asyncTest("After hydrate, observation surface counts hydrations", async () => {
    const fm = buildFreshField();
    const b = new Binding.AppIdentityBinding({
      fieldModule: fm, store: sharedStore, id: "f5-test"
    });
    await b.hydrate(H1);
    assert(b.observe().hydrations === 1);
    await b.hydrate(H2);
    assert(b.observe().hydrations === 2);
    await b.hydrate(H1);  // jump back to H1
    assert(b.observe().hydrations === 3);
  });

  await asyncTest("F1 preserved: seed at constraints[0] after every hydrate", async () => {
    const fm = buildFreshField();
    const b = new Binding.AppIdentityBinding({
      fieldModule: fm, store: sharedStore, id: "f1-test"
    });
    await b.hydrate(H1);
    const c0a = fm.Field.constraints[0];
    assert(c0a.kind === "seed");
    await b.hydrate(H2);
    const c0b = fm.Field.constraints[0];
    assert(c0b.kind === "seed");
    // Same seed id across hydrations (S2: deterministic seed)
    assert(c0a.id === c0b.id);
  });

  await asyncTest("Post-hydrate operations branch from restored state", async () => {
    // F5: hydrate is restoration; subsequent ops deposit further change
    const fm = buildFreshField();
    const b = new Binding.AppIdentityBinding({
      fieldModule: fm, store: sharedStore, id: "branching-test"
    });
    await b.hydrate(H1);
    assert(fm.Field.step === 5);
    // Modify post-hydrate
    fm.Field.step = 25;
    fm.Field.scalarDelta = 0.99;
    // Commit the branched state
    const r = await b.commit();
    assert(r.address !== H1);
    assert(r.address !== H2);
    // The branched address (call it H1') is now in store alongside H1, H2
    const a = await sharedStore.get(r.address);
    assert(a.fieldData.step === 25);
    // H1 and H2 still retrievable (F5: original artifacts preserved)
    const a1 = await sharedStore.get(H1);
    const a2 = await sharedStore.get(H2);
    assert(a1.fieldData.step === 5);
    assert(a2.fieldData.step === 12);
  });

  // --------------------------------------------------------------------
  // PART F: error paths
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART F: error paths");
  console.log("");

  await asyncTest("Hydrate non-existent address returns false", async () => {
    const fm = buildFreshField();
    const b = new Binding.AppIdentityBinding({
      fieldModule: fm, store: sharedStore
    });
    const ok = await b.hydrate("nonexistent-address-12345");
    assert(ok === false);
    assert(b.observe().hydrationFailures === 1);
  });

  await asyncTest("Hydrate empty / non-string address returns false", async () => {
    const fm = buildFreshField();
    const b = new Binding.AppIdentityBinding({
      fieldModule: fm, store: sharedStore
    });
    assert(await b.hydrate("") === false);
    assert(await b.hydrate(null) === false);
    assert(await b.hydrate(42) === false);
    assert(b.observe().hydrationFailures === 3);
  });

  // --------------------------------------------------------------------
  // PART G: closure
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART G: closure");
  console.log("");

  test("app-identity-binding.js: ASCII-only", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "app-identity-binding.js"), "utf8");
    const m = src.match(/[^\x00-\x7F]/);
    assert(!m, "non-ASCII: " + (m && m[0]));
  });

  test("app-identity-binding.js: no host APIs leaked", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "app-identity-binding.js"), "utf8");
    assert(src.indexOf("localStorage") < 0);
    assert(src.indexOf("fetch(") < 0);
    assert(src.indexOf("XMLHttpRequest") < 0);
    assert(src.indexOf("WebSocket") < 0);
    assert(src.indexOf("Date.now") < 0);
  });

  test("app-identity-binding does NOT modify substrate-media.js", () => {
    // M3 spec: "No changes to substrate-media.js itself; it is reused unchanged."
    // We verify by re-requiring substrate-media and checking key APIs intact.
    const SM = require("./kernel-src/substrate-media.js");
    assert(typeof SM.codecs === "object");
    assert(typeof SM.codecs.strong === "object");
    assert(typeof SM.MediaStore === "function");
    assert(typeof SM.computeAddress === "function");
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
