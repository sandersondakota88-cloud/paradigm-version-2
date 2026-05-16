// k2-time-adapter-verifier.js - K2 acceptance for the time adapter (A1)

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const Pub = require("./contributor-publisher.js");
const Adapter = require("./k2-time-adapter.js");

let pass = 0, fail = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log("  OK   " + name);
  } catch (e) {
    fail++;
    failures.push({ name: name, error: e });
    console.log("  FAIL " + name + ": " + e.message);
  }
}

function assert(c, m) {
  if (!c) throw new Error("assertion failed: " + (m || ""));
}

// ----------------------------------------------------------------------------
// Test fixture: load kernel + intake extension into a sandbox so we have a
// real Field with intake buffer attached.
// ----------------------------------------------------------------------------

function buildFieldFixture() {
  const sandbox = {
    console: console, setTimeout: setTimeout, setImmediate: setImmediate,
    Promise: Promise, Object: Object, Array: Array, Math: Math, JSON: JSON,
    Uint32Array: Uint32Array, Float64Array: Float64Array,
    Float32Array: Float32Array, Uint8Array: Uint8Array,
    Map: Map, Set: Set, Error: Error, TypeError: TypeError,
    RangeError: RangeError, String: String, Number: Number,
    Boolean: Boolean, Date: Date,
    performance: { now: () => Date.now() }
  };
  sandbox.globalThis = sandbox;
  sandbox.global = sandbox;
  vm.createContext(sandbox);

  // For the time-adapter verifier we only need field.js (FieldModule, Field,
  // Trace) and the intake extension. ct-engine, er-engine, etc. are not
  // touched by this verifier.
  const kernelDir = path.join(__dirname, "kernel-src");
  const fieldSrc = fs.readFileSync(path.join(kernelDir, "field.js"), "utf8");
  vm.runInContext(fieldSrc, sandbox, { filename: "field.js" });

  // Apply field-intake-extension via Node-side require; it mutates Field
  // (which lives in the sandbox).
  const ext = require(path.join(__dirname, "field-intake-extension.js"));
  ext.install(sandbox.FieldModule);

  return sandbox;
}

console.log("k2-time-adapter verification (A1)");
console.log("");

// ----------------------------------------------------------------------------
// Adapter construction
// ----------------------------------------------------------------------------

console.log("PART A: adapter construction (no DOM dependency)");
console.log("");

test("adapter requires publisher", () => {
  let threw = false;
  try { new Adapter.TimeAdapter({}); } catch (e) { threw = true; }
  assert(threw, "constructor threw without publisher");
});

test("adapter constructible with publisher only (no DOM)", () => {
  const fakePublisher = { publish: () => {} };
  const a = new Adapter.TimeAdapter({ publisher: fakePublisher });
  assert(a.publisher === fakePublisher);
  assert(!a.doc, "no doc field");
  assert(!a.stateSelector, "no stateSelector");
});

test("default config: 50ms interval, type names time-now/time-perf", () => {
  assert(Adapter.CONFIG.SAMPLE_INTERVAL_MS === 50);
  assert(Adapter.CONFIG.TYPE_NOW === "time-now");
  assert(Adapter.CONFIG.TYPE_PERF === "time-perf");
});

// ----------------------------------------------------------------------------
// Publisher integration
// ----------------------------------------------------------------------------

console.log("");
console.log("PART B: SE-08 contributor record flow");
console.log("");

let sandbox, field, publisher;

test("fixture: kernel field + intake extension wired", () => {
  sandbox = buildFieldFixture();
  field = sandbox.FieldModule.Field;
  field.reset();
  assert(field.intake, "field.intake exists");
  assert(typeof field.intake.publish === "function");
});

test("ContributorPublisher.attach succeeds on field with intake", () => {
  publisher = Pub.ContributorPublisher.attach(field);
  assert(publisher);
  assert(publisher.field === field);
});

test("ContributorPublisher rejects field without intake", () => {
  let threw = false;
  try { Pub.ContributorPublisher.attach({}); } catch (e) { threw = true; }
  assert(threw);
});

test("adapter._tick() publishes time-now record into field.intake", () => {
  // Use a mock clock to make the value deterministic
  const mockClock = () => ({ now: 1700000000000, perf: 12345.6 });
  const a = new Adapter.TimeAdapter({ publisher: publisher, clock: mockClock });

  field.intake.clear();
  a._tick();

  const records = field.intake.records;
  assert(records.length === 2, "2 records (time-now + time-perf), got " + records.length);

  const now = records[0];
  assert(now.type === "time-now");
  assert(now.value === 1700000000000);
  assert(now.source === "time-adapter");
  assert(typeof now.timestamp === "number");

  const perf = records[1];
  assert(perf.type === "time-perf");
  assert(perf.value === 12345.6);
  assert(perf.source === "time-adapter");
});

test("perf-absent clock publishes only time-now", () => {
  const mockClock = () => ({ now: 1700000001000, perf: null });
  const a = new Adapter.TimeAdapter({ publisher: publisher, clock: mockClock });

  field.intake.clear();
  a._tick();

  assert(field.intake.records.length === 1);
  assert(field.intake.records[0].type === "time-now");
});

test("multiple ticks accumulate FIFO", () => {
  const values = [100, 200, 300, 400];
  let i = 0;
  const mockClock = () => ({ now: values[i++], perf: null });
  const a = new Adapter.TimeAdapter({ publisher: publisher, clock: mockClock });

  field.intake.clear();
  for (let k = 0; k < values.length; k++) a._tick();

  assert(field.intake.records.length === 4);
  for (let k = 0; k < values.length; k++) {
    assert(field.intake.records[k].value === values[k],
      "record " + k + " value=" + field.intake.records[k].value);
  }
});

// ----------------------------------------------------------------------------
// F3: no supervision
// ----------------------------------------------------------------------------

console.log("");
console.log("PART C: F3 (no supervision)");
console.log("");

test("publisher.publish returns void (no command path)", () => {
  const r = publisher.publish({
    type: "test-type", value: 42, source: "test-source"
  });
  assert(r === undefined, "publish returned " + r);
});

test("invalid record validation does not throw, only counts", () => {
  const before = publisher.observe().validationFailures;
  publisher.publish(null);
  publisher.publish({});
  publisher.publish({type: "x"}); // missing source
  publisher.publish({type: "x", source: "y"}); // missing value
  const after = publisher.observe().validationFailures;
  assert(after === before + 4, "got " + (after - before) + " new failures");
});

test("adapter timer fires on its own cadence (mocked setInterval)", () => {
  let intervalFn = null;
  let intervalMs = 0;
  const mockSetInterval = (fn, ms) => { intervalFn = fn; intervalMs = ms; return 1; };
  const mockClearInterval = () => { intervalFn = null; };
  const a = new Adapter.TimeAdapter({
    publisher: publisher,
    clock: () => ({ now: 1, perf: null }),
    setInterval: mockSetInterval,
    clearInterval: mockClearInterval
  });
  a.start();
  assert(intervalMs === 50, "interval=" + intervalMs);
  assert(typeof intervalFn === "function");
  a.stop();
  assert(intervalFn === null);
});

// ----------------------------------------------------------------------------
// I3: bounded
// ----------------------------------------------------------------------------

console.log("");
console.log("PART D: I3 (bounded everything)");
console.log("");

test("intake buffer has cap; eviction is FIFO at cap", () => {
  field.intake.clear();
  const cap = field.intake.cap;
  assert(typeof cap === "number" && cap > 0, "cap=" + cap);

  const a = new Adapter.TimeAdapter({
    publisher: publisher,
    clock: (function () { let i = 0; return () => ({ now: i++, perf: null }); })()
  });
  // Publish cap+10 records
  for (let k = 0; k < cap + 10; k++) a._tick();

  assert(field.intake.records.length === cap, "buffer at cap, got " + field.intake.records.length);
  // FIFO eviction: first remaining record is the (10+1)th publish (value 10)
  assert(field.intake.records[0].value === 10,
    "expected first record value 10, got " + field.intake.records[0].value);
});

// ----------------------------------------------------------------------------
// M5: trace at the channel
// ----------------------------------------------------------------------------

console.log("");
console.log("PART E: M5 (trace at channel)");
console.log("");

test("publish does NOT write trace entries", () => {
  field.intake.clear();
  sandbox.FieldModule.Trace.clear();
  const traceLenBefore = sandbox.FieldModule.Trace.entries.length;
  publisher.publish({type: "trace-test", value: 1, source: "test"});
  publisher.publish({type: "trace-test", value: 2, source: "test"});
  const traceLenAfter = sandbox.FieldModule.Trace.entries.length;
  assert(traceLenAfter === traceLenBefore,
    "publish wrote trace; before=" + traceLenBefore + " after=" + traceLenAfter);
});

// ----------------------------------------------------------------------------
// SE-08 ratio: adapters are independent
// ----------------------------------------------------------------------------

console.log("");
console.log("PART F: SE-08 ratio (independent adapter cadences)");
console.log("");

test("two simulated adapters publish independently to same buffer", () => {
  field.intake.clear();
  const pub2 = Pub.ContributorPublisher.attach(field);
  pub2.publish({type: "click", value: "btn-1", source: "click-bridge"});
  publisher.publish({type: "time-now", value: 1700000003000, source: "time-adapter"});
  pub2.publish({type: "click", value: "btn-2", source: "click-bridge"});
  publisher.publish({type: "time-now", value: 1700000003050, source: "time-adapter"});
  assert(field.intake.records.length === 4);
  // Order is interleaved, by FIFO publish order
  assert(field.intake.records[0].type === "click");
  assert(field.intake.records[1].type === "time-now");
  assert(field.intake.records[2].type === "click");
  assert(field.intake.records[3].type === "time-now");
});

test("publisher observe() reports counts but no engine state", () => {
  const obs = publisher.observe();
  assert(typeof obs.publishCount === "number");
  assert(typeof obs.validationFailures === "number");
  assert(typeof obs.intakeRecordCount === "number");
});

// ----------------------------------------------------------------------------
// Closure: adapter is closure-clean except for permitted host calls
// ----------------------------------------------------------------------------

console.log("");
console.log("PART G: closure - adapter is the legitimate host-API site");
console.log("");

test("k2-time-adapter source contains Date.now (permitted in adapter)", () => {
  const src = fs.readFileSync(path.join(__dirname, "k2-time-adapter.js"), "utf8");
  assert(src.indexOf("Date.now()") >= 0, "Date.now is the time intake");
});

test("k2-time-adapter.js: no localStorage, no fetch, no XMLHttpRequest", () => {
  const src = fs.readFileSync(path.join(__dirname, "k2-time-adapter.js"), "utf8");
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
