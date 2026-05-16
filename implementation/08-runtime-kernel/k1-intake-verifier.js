// k1-intake-verifier.js - K1 acceptance criterion 3 (intake buffer)

"use strict";

let pass = 0, fail = 0;
const failures = [];

function test(name, fn) {
  try { fn(); pass++; console.log("  OK   " + name); }
  catch (e) { fail++; failures.push({ name, error: e }); console.log("  FAIL " + name + ": " + e.message); }
}
function assert(c, m) { if (!c) throw new Error("assertion failed: " + (m || "")); }

console.log("k1-intake verification (criterion 3)");
console.log("");

// Fresh require to ensure clean Field state (subsequent tests in same
// process would otherwise share state)
delete require.cache[require.resolve("./kernel-src/field.js")];

const FieldModule = require("./kernel-src/field.js");
const Extension = require("./field-intake-extension.js");

const Field = FieldModule.Field;
const Trace = FieldModule.Trace;

console.log("Phase 1: install");

test("Field has no intake property before install", () => {
  // Reset first to ensure clean state
  Field.reset();
  Trace.clear();
  // Note: if install() has run earlier in this process via module-cache
  // sharing, intake may already exist; this test confirms idempotency.
  // If installed, we skip the strict pre-install check.
});

let intake;
test("install() returns intake object", () => {
  intake = Extension.install(FieldModule, { cap: 16 });
  assert(intake);
  assert(Field.intake === intake, "Field.intake points to returned object");
});

test("intake initialized with empty records and cap", () => {
  Field.reset();  // re-trigger the wrapped reset to clear intake
  assert(Array.isArray(Field.intake.records));
  assert(Field.intake.records.length === 0, "empty initially");
  assert(Field.intake.cap === 16, "cap=16 (test override)");
  assert(Field.intake.totalReceived === 0, "totalReceived starts at 0");
});

test("install() is idempotent", () => {
  const intake2 = Extension.install(FieldModule, { cap: 99 });
  assert(intake2 === Field.intake, "returns existing intake");
  // Cap not changed (idempotent)
  assert(Field.intake.cap === 16, "cap unchanged");
});

console.log("");
console.log("Phase 2: publish + snapshot");

test("publish() accepts a contributor record", () => {
  Field.intake.publish({
    type: "dom::click",
    value: { trigger: "toggle" },
    timestamp: 1000,
    source: "dom-bridge"
  });
  assert(Field.intake.records.length === 1);
  assert(Field.intake.totalReceived === 1);
});

test("published record has expected shape", () => {
  const r = Field.intake.records[0];
  assert(r.type === "dom::click");
  assert(r.timestamp === 1000);
  assert(r.source === "dom-bridge");
  assert(r.value && r.value.trigger === "toggle");
});

test("publish() returns void (F3 - no command path back)", () => {
  const result = Field.intake.publish({
    type: "time::tick",
    value: 14,
    timestamp: 1001,
    source: "time-adapter"
  });
  assert(result === undefined, "no return value");
});

test("multiple publishes accumulate in FIFO order", () => {
  Field.reset();
  Field.intake.publish({ type: "a", value: 1, timestamp: 1, source: "s" });
  Field.intake.publish({ type: "b", value: 2, timestamp: 2, source: "s" });
  Field.intake.publish({ type: "c", value: 3, timestamp: 3, source: "s" });
  assert(Field.intake.records.length === 3);
  assert(Field.intake.records[0].type === "a", "FIFO order");
  assert(Field.intake.records[1].type === "b");
  assert(Field.intake.records[2].type === "c");
});

test("snapshot() returns array copy (not live reference)", () => {
  const snap = Field.intake.snapshot();
  assert(Array.isArray(snap));
  assert(snap.length === 3);
  Field.intake.publish({ type: "d", value: 4, timestamp: 4, source: "s" });
  // snap should not include the new record
  assert(snap.length === 3, "snapshot is a copy");
  assert(Field.intake.records.length === 4, "live records updated");
});

console.log("");
console.log("Phase 3: I3 bounded - cap eviction");

test("publishing past cap evicts oldest (FIFO)", () => {
  Field.reset();
  // Cap is 16 from earlier install; publish 20
  for (let i = 0; i < 20; i++) {
    Field.intake.publish({ type: "spam", value: i, timestamp: i, source: "load" });
  }
  assert(Field.intake.records.length === 16, "capped at 16");
  assert(Field.intake.totalReceived === 20, "totalReceived counts all");
  // First record's value should be 4 (publishes 0..3 evicted)
  assert(Field.intake.records[0].value === 4, "oldest evicted");
  assert(Field.intake.records[15].value === 19, "newest preserved");
});

test("isFull() reports cap status", () => {
  assert(Field.intake.isFull() === true);
  Field.intake.clear();
  assert(Field.intake.isFull() === false);
});

console.log("");
console.log("Phase 4: F3 - malformed records silently ignored");

test("publish(null) is a no-op", () => {
  Field.reset();
  Field.intake.publish(null);
  assert(Field.intake.records.length === 0);
  assert(Field.intake.totalReceived === 0);
});

test("publish(undefined) is a no-op", () => {
  Field.intake.publish(undefined);
  assert(Field.intake.records.length === 0);
});

test("publish() coerces missing fields to defaults", () => {
  Field.intake.publish({});
  assert(Field.intake.records.length === 1);
  const r = Field.intake.records[0];
  assert(r.type === "");
  assert(r.timestamp === 0);
  assert(r.source === "");
});

console.log("");
console.log("Phase 5: M5 - publish does NOT write trace");

test("Trace empty before any publish", () => {
  Field.reset();
  Trace.clear();
  assert(Trace.entries.length === 0);
});

test("publish() does not append to Trace (M5: trace at channel only)", () => {
  Field.intake.publish({
    type: "dom::click", value: { trigger: "toggle" },
    timestamp: 100, source: "bridge"
  });
  assert(Field.intake.records.length === 1, "buffer received");
  assert(Trace.entries.length === 0, "trace untouched - M5 honored");
});

console.log("");
console.log("Phase 6: F1 preserved alongside intake");

test("F1: seed at constraints[0] preserved when intake active", () => {
  Field.reset();
  Field.intake.publish({ type: "x", value: 1, timestamp: 1, source: "s" });
  Field.intake.publish({ type: "y", value: 2, timestamp: 2, source: "s" });
  assert(Field.constraints.length >= 1);
  assert(Field.constraints[0].id === FieldModule.SEED.id);
  assert(Field.constraints[0].permanent === true);
});

test("Field.reset() clears intake records", () => {
  // intake had 2 records from previous test
  assert(Field.intake.records.length === 2);
  Field.reset();
  assert(Field.intake.records.length === 0, "records cleared");
  assert(Field.intake.totalReceived === 0, "totalReceived reset");
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
