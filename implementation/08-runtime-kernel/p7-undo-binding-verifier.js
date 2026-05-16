// p7-undo-binding-verifier.js - P7 acceptance: undo as commit-history nav

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const Persistence = require("./p3-persistence-binding.js");
const Undo = require("./p7-undo-binding.js");

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

// Helper: create persistence + undo wired together with auto-record
function makeStack() {
  const fm = buildField();
  const store = new Persistence.MediaStore();
  const persistence = new Persistence.PersistenceBinding({
    fieldModule: fm,
    store: store
    // onAddressChanged set after undo is constructed
  });
  const undo = new Undo.UndoBinding({ persistence: persistence });
  // Wire callback to record each commit
  persistence.onAddressChanged = function (addr) { undo.recordCommit(addr); };
  return { fm, store, persistence, undo };
}

async function main() {
  console.log("p7-undo-binding verification");
  console.log("");

  // --------------------------------------------------------------------
  // PART A: construction
  // --------------------------------------------------------------------
  console.log("PART A: construction");
  console.log("");

  test("constructor requires persistence", () => {
    let threw = false;
    try { new Undo.UndoBinding({}); } catch (e) { threw = true; }
    assert(threw);
  });

  test("constructor rejects persistence missing methods", () => {
    let threw = false;
    try {
      new Undo.UndoBinding({ persistence: { commit: () => {} } });
    } catch (e) { threw = true; }
    assert(threw);
  });

  test("Initial state: empty history; canUndo/canRedo false", () => {
    const stack = makeStack();
    assert(stack.undo.history().length === 0);
    assert(stack.undo.cursor() === -1);
    assert(stack.undo.canUndo() === false);
    assert(stack.undo.canRedo() === false);
  });

  // --------------------------------------------------------------------
  // PART B: recordCommit + history
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART B: recordCommit + history");
  console.log("");

  await asyncTest("After 3 commits: history has 3 entries; cursor=2", async () => {
    const stack = makeStack();
    stack.fm.Field.step = 1;
    await stack.persistence.commit();
    stack.fm.Field.step = 2;
    await stack.persistence.commit();
    stack.fm.Field.step = 3;
    await stack.persistence.commit();

    assert(stack.undo.history().length === 3);
    assert(stack.undo.cursor() === 2);
    assert(stack.undo.canUndo() === true);
    assert(stack.undo.canRedo() === false);   // cursor at tail
  });

  test("recordCommit ignores empty/non-string addresses", () => {
    const stack = makeStack();
    stack.undo.recordCommit("");
    stack.undo.recordCommit(null);
    stack.undo.recordCommit(42);
    assert(stack.undo.history().length === 0);
  });

  // --------------------------------------------------------------------
  // PART C: undo / redo navigation
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART C: undo / redo navigation");
  console.log("");

  await asyncTest("Undo restores prior state; cursor decrements", async () => {
    const stack = makeStack();
    stack.fm.Field.step = 10;
    stack.fm.Field.scalarDelta = 0.1;
    await stack.persistence.commit();

    stack.fm.Field.step = 20;
    stack.fm.Field.scalarDelta = 0.2;
    await stack.persistence.commit();

    stack.fm.Field.step = 30;
    stack.fm.Field.scalarDelta = 0.3;
    await stack.persistence.commit();

    // Undo: should restore step=20 state
    const r = await stack.undo.undo();
    assert(r.applied === true);
    assert(stack.fm.Field.step === 20, "step restored to 20: " + stack.fm.Field.step);
    assert(Math.abs(stack.fm.Field.scalarDelta - 0.2) < 1e-9);
    assert(stack.undo.cursor() === 1);
    assert(stack.undo.canUndo() === true);
    assert(stack.undo.canRedo() === true);
  });

  await asyncTest("Multiple undos walk back; eventually canUndo=false", async () => {
    const stack = makeStack();
    for (let i = 1; i <= 4; i++) {
      stack.fm.Field.step = i * 10;
      await stack.persistence.commit();
    }
    // 4 commits; cursor=3; can undo 3 times (to cursor=0)
    let count = 0;
    while (stack.undo.canUndo()) {
      const r = await stack.undo.undo();
      assert(r.applied);
      count++;
    }
    assert(count === 3, "should undo 3 times, did " + count);
    assert(stack.undo.cursor() === 0);
    assert(stack.fm.Field.step === 10, "back at first commit's state");
  });

  await asyncTest("Redo: walks forward through history", async () => {
    const stack = makeStack();
    for (let i = 1; i <= 3; i++) {
      stack.fm.Field.step = i * 100;
      await stack.persistence.commit();
    }
    // Currently at cursor=2 (step=300)
    await stack.undo.undo();   // cursor=1, step=200
    await stack.undo.undo();   // cursor=0, step=100
    assert(stack.fm.Field.step === 100);

    // Redo back to the future
    const r1 = await stack.undo.redo();
    assert(r1.applied);
    assert(stack.fm.Field.step === 200);
    const r2 = await stack.undo.redo();
    assert(r2.applied);
    assert(stack.fm.Field.step === 300);
    assert(stack.undo.canRedo() === false);
  });

  await asyncTest("Undo at start: refused (canUndo false)", async () => {
    const stack = makeStack();
    stack.fm.Field.step = 1;
    await stack.persistence.commit();
    // Only 1 commit; cursor=0; canUndo=false
    const r = await stack.undo.undo();
    assert(r.applied === false);
    assert(stack.undo.observe().navigationsRefused === 1);
  });

  await asyncTest("Redo at tail: refused (canRedo false)", async () => {
    const stack = makeStack();
    stack.fm.Field.step = 1;
    await stack.persistence.commit();
    const r = await stack.undo.redo();
    assert(r.applied === false);
  });

  // --------------------------------------------------------------------
  // PART D: redo path truncation (standard undo semantics)
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART D: redo path truncation on new commit");
  console.log("");

  await asyncTest("Undo then commit: redo path discarded", async () => {
    const stack = makeStack();
    for (let i = 1; i <= 3; i++) {
      stack.fm.Field.step = i * 10;
      await stack.persistence.commit();
    }
    // History: [a, b, c]; cursor=2 (c)
    await stack.undo.undo();   // cursor=1 (b)
    assert(stack.undo.canRedo() === true);

    // New commit (branches from b)
    stack.fm.Field.step = 50;
    await stack.persistence.commit();
    // History should now be [a, b, NEW]; cursor=2 (NEW); c is discarded

    assert(stack.undo.history().length === 3);
    assert(stack.undo.canRedo() === false, "redo path truncated");
    assert(stack.undo.observe().redosLost === 1, "1 redo entry lost");

    // Verify by restoring NEW
    assert(stack.fm.Field.step === 50);
  });

  await asyncTest("After truncation: undo still walks the new branch", async () => {
    const stack = makeStack();
    for (let i = 1; i <= 4; i++) {
      stack.fm.Field.step = i * 10;
      await stack.persistence.commit();
    }
    await stack.undo.undo();   // back from step=40 to step=30
    await stack.undo.undo();   // step=30 to step=20
    // Branch
    stack.fm.Field.step = 25;
    await stack.persistence.commit();

    // Now history is [10, 20, 25]; cursor=2
    assert(stack.fm.Field.step === 25);
    await stack.undo.undo();
    assert(stack.fm.Field.step === 20);
    await stack.undo.undo();
    assert(stack.fm.Field.step === 10);
  });

  // --------------------------------------------------------------------
  // PART E: F5 - all commits remain hydratable after navigation
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART E: F5 - all commits remain in store");
  console.log("");

  await asyncTest("All committed addresses still retrievable from store", async () => {
    const stack = makeStack();
    const addresses = [];
    for (let i = 1; i <= 5; i++) {
      stack.fm.Field.step = i * 100;
      const r = await stack.persistence.commit();
      addresses.push(r.address);
    }
    // Even after undos and redos, all addresses retrievable
    await stack.undo.undo();
    await stack.undo.undo();
    await stack.undo.undo();
    await stack.undo.redo();

    for (const addr of addresses) {
      const a = await stack.store.get(addr);
      assert(a, "address still in store: " + addr);
    }
  });

  await asyncTest("After truncation: discarded redo addresses STILL in store", async () => {
    const stack = makeStack();
    for (let i = 1; i <= 3; i++) {
      stack.fm.Field.step = i * 10;
      await stack.persistence.commit();
    }
    const c_addr = stack.undo.history()[2];   // before truncation

    await stack.undo.undo();
    stack.fm.Field.step = 99;
    await stack.persistence.commit();
    // c_addr no longer in undo history
    assert(stack.undo.history().indexOf(c_addr) < 0,
      "c_addr removed from history");

    // But it IS still in the store (F5: artifacts are append-only)
    const c_artifact = await stack.store.get(c_addr);
    assert(c_artifact, "c_addr still in store after truncation");
  });

  // --------------------------------------------------------------------
  // PART F: I3 - bounded history
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART F: I3 - bounded history");
  console.log("");

  await asyncTest("History capped at MAX_HISTORY", async () => {
    const stack = makeStack();
    // Override to small cap for testing
    stack.undo.config = { MAX_HISTORY: 5 };
    for (let i = 1; i <= 12; i++) {
      stack.fm.Field.step = i;
      await stack.persistence.commit();
    }
    assert(stack.undo.history().length === 5,
      "history capped at 5; got " + stack.undo.history().length);
    // cursor should be at tail of capped history
    assert(stack.undo.cursor() === 4);
  });

  // --------------------------------------------------------------------
  // PART G: closure
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART G: closure");
  console.log("");

  test("p7-undo-binding.js: ASCII-only", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "p7-undo-binding.js"), "utf8");
    const m = src.match(/[^\x00-\x7F]/);
    assert(!m, "non-ASCII: " + (m && m[0]));
  });

  test("p7-undo-binding.js: no host APIs leaked", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "p7-undo-binding.js"), "utf8");
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
