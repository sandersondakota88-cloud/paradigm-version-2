// k2-sensor-adapter-verifier.js - K2 acceptance for sensor adapter (A3)

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const Pub = require("./contributor-publisher.js");
const Adapter = require("./k2-sensor-adapter.js");

let pass = 0, fail = 0;
const failures = [];

function test(name, fn) {
  try { fn(); pass++; console.log("  OK   " + name); }
  catch (e) { fail++; failures.push({ name, error: e }); console.log("  FAIL " + name + ": " + e.message); }
}
function assert(c, m) { if (!c) throw new Error("assertion failed: " + (m || "")); }

// ----------------------------------------------------------------------------
// Field fixture
// ----------------------------------------------------------------------------
function buildFieldFixture() {
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
  return sandbox;
}

// ----------------------------------------------------------------------------
// Mock document with addEventListener, dispatchEvent
// ----------------------------------------------------------------------------
function makeDocument() {
  const listeners = {};
  return {
    addEventListener(type, fn) {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    removeEventListener(type, fn) {
      const arr = listeners[type] || [];
      const i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    },
    dispatch(type, event) {
      for (const h of (listeners[type] || [])) h(event);
    },
    _listeners: listeners
  };
}

console.log("k2-sensor-adapter verification (A3)");
console.log("");

// ----------------------------------------------------------------------------
// PART A: construction
// ----------------------------------------------------------------------------

console.log("PART A: adapter construction");
console.log("");

test("constructor requires publisher", () => {
  let threw = false;
  try { new Adapter.SensorAdapter({}); } catch (e) { threw = true; }
  assert(threw);
});

test("default channels: pointer + keyboard on", () => {
  const a = new Adapter.SensorAdapter({
    publisher: { publish: () => {} },
    doc: makeDocument()
  });
  assert(a.channels.pointer === true);
  assert(a.channels.keyboard === true);
});

test("CONFIG: 16ms throttle (60Hz), 8 keys held cap", () => {
  assert(Adapter.CONFIG.MOUSE_THROTTLE_MS === 16);
  assert(Adapter.CONFIG.MAX_KEYS_HELD === 8);
});

// ----------------------------------------------------------------------------
// PART B: pointer flow
// ----------------------------------------------------------------------------

console.log("");
console.log("PART B: pointer event flow");
console.log("");

let sandbox, field, publisher;

test("fixture: field + intake wired", () => {
  sandbox = buildFieldFixture();
  field = sandbox.FieldModule.Field;
  field.reset();
  publisher = Pub.ContributorPublisher.attach(field);
});

test("mousemove publishes mouse-x and mouse-y records", () => {
  field.intake.clear();
  const doc = makeDocument();
  let now = 1000;
  const a = new Adapter.SensorAdapter({
    publisher: publisher,
    doc: doc,
    clock: () => now
  });
  a.start();

  doc.dispatch("mousemove", { clientX: 100, clientY: 200 });

  const recs = field.intake.records;
  assert(recs.length === 2, "expected 2 records, got " + recs.length);
  assert(recs[0].type === "mouse-x");
  assert(recs[0].value === 100);
  assert(recs[1].type === "mouse-y");
  assert(recs[1].value === 200);
  assert(recs[0].source === "sensor-adapter");
});

test("mousemove throttle: rapid events skipped within 16ms window", () => {
  field.intake.clear();
  const doc = makeDocument();
  let now = 1000;
  const a = new Adapter.SensorAdapter({
    publisher: publisher,
    doc: doc,
    clock: () => now
  });
  a.start();

  doc.dispatch("mousemove", { clientX: 1, clientY: 1 });    // accepted (now=1000)
  now = 1005;
  doc.dispatch("mousemove", { clientX: 2, clientY: 2 });    // skipped (delta=5ms)
  now = 1015;
  doc.dispatch("mousemove", { clientX: 3, clientY: 3 });    // skipped (delta=15ms)
  now = 1020;
  doc.dispatch("mousemove", { clientX: 4, clientY: 4 });    // accepted (delta=20ms)

  // Two accepted events = 4 records (x+y for each)
  assert(field.intake.records.length === 4,
    "expected 4 records, got " + field.intake.records.length);
  assert(a.stats.mouseThrottleSkips === 2);
});

test("mousedown publishes mouse-buttons record", () => {
  field.intake.clear();
  const doc = makeDocument();
  const a = new Adapter.SensorAdapter({
    publisher: publisher,
    doc: doc,
    clock: () => 1000
  });
  a.start();

  doc.dispatch("mousedown", { buttons: 1 });
  assert(field.intake.records.length === 1);
  assert(field.intake.records[0].type === "mouse-buttons");
  assert(field.intake.records[0].value === 1);
});

// ----------------------------------------------------------------------------
// PART C: keyboard flow
// ----------------------------------------------------------------------------

console.log("");
console.log("PART C: keyboard event flow");
console.log("");

test("keydown publishes key-<name> = '1'", () => {
  field.intake.clear();
  const doc = makeDocument();
  const a = new Adapter.SensorAdapter({
    publisher: publisher,
    doc: doc,
    clock: () => 1000
  });
  a.start();

  doc.dispatch("keydown", { key: "a" });
  doc.dispatch("keydown", { key: "Enter" });

  const recs = field.intake.records;
  assert(recs.length === 2);
  assert(recs[0].type === "key-a");
  assert(recs[0].value === "1");
  assert(recs[1].type === "key-Enter");
  assert(recs[1].value === "1");
});

test("keyup publishes key-<name> = '0'; repeated keydown filtered", () => {
  field.intake.clear();
  const doc = makeDocument();
  const a = new Adapter.SensorAdapter({
    publisher: publisher,
    doc: doc,
    clock: () => 1000
  });
  a.start();

  doc.dispatch("keydown", { key: "x" });
  doc.dispatch("keydown", { key: "x" });   // repeat - filtered
  doc.dispatch("keyup",   { key: "x" });

  assert(field.intake.records.length === 2);
  assert(field.intake.records[0].value === "1");
  assert(field.intake.records[1].value === "0");
});

test("MAX_KEYS_HELD enforced (I3)", () => {
  field.intake.clear();
  const doc = makeDocument();
  const a = new Adapter.SensorAdapter({
    publisher: publisher,
    doc: doc,
    clock: () => 1000,
    config: { MAX_KEYS_HELD: 3 }
  });
  a.start();

  for (let i = 0; i < 5; i++) {
    doc.dispatch("keydown", { key: "k" + i });
  }

  // First 3 accepted, last 2 rejected
  assert(field.intake.records.length === 3);
  assert(a.stats.keyCapRejections === 2);
});

test("space key sanitized to 'Space'", () => {
  field.intake.clear();
  const doc = makeDocument();
  const a = new Adapter.SensorAdapter({
    publisher: publisher,
    doc: doc,
    clock: () => 1000
  });
  a.start();

  doc.dispatch("keydown", { key: " " });
  assert(field.intake.records[0].type === "key-Space");
});

test("unsafe key chars replaced with _", () => {
  field.intake.clear();
  const doc = makeDocument();
  const a = new Adapter.SensorAdapter({
    publisher: publisher,
    doc: doc,
    clock: () => 1000
  });
  a.start();

  doc.dispatch("keydown", { key: "a.b" });
  assert(field.intake.records[0].type === "key-a_b");
});

// ----------------------------------------------------------------------------
// PART D: F3 (no supervision)
// ----------------------------------------------------------------------------

console.log("");
console.log("PART D: F3 (no supervision)");
console.log("");

test("Adapter holds no engine references", () => {
  const doc = makeDocument();
  const a = new Adapter.SensorAdapter({
    publisher: publisher,
    doc: doc
  });
  assert(!a.field);
  assert(!a.er);
  assert(!a.ct);
});

test("stop() removes listeners; subsequent dispatches no-op", () => {
  field.intake.clear();
  const doc = makeDocument();
  const a = new Adapter.SensorAdapter({
    publisher: publisher,
    doc: doc,
    clock: () => 1000
  });
  a.start();
  a.stop();

  doc.dispatch("keydown", { key: "z" });
  doc.dispatch("mousemove", { clientX: 1, clientY: 1 });
  // No records published after stop
  assert(field.intake.records.length === 0);
});

// ----------------------------------------------------------------------------
// PART E: closure
// ----------------------------------------------------------------------------

console.log("");
console.log("PART E: closure");
console.log("");

test("k2-sensor-adapter source: Date.now is permitted (clock site)", () => {
  const src = fs.readFileSync(path.join(__dirname, "k2-sensor-adapter.js"), "utf8");
  // The default clock uses Date.now; tests inject a mock
  assert(src.indexOf("Date.now") >= 0);
});

test("k2-sensor-adapter.js: no localStorage, no fetch, no XMLHttpRequest", () => {
  const src = fs.readFileSync(path.join(__dirname, "k2-sensor-adapter.js"), "utf8");
  assert(src.indexOf("localStorage") < 0);
  assert(src.indexOf("fetch(") < 0);
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
