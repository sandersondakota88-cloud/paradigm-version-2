// k1-closure-test.js - K1 acceptance criterion 5

"use strict";

const fs = require("fs");
const path = require("path");

const Emitter = require("./kernel-runtime-emitter.js");
const Closure = require("./p8-closure-verifier.js");

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

const TODOMVC_CASCADE = [
  '[data-substrate-state][data-trigger="toggle"] { --next-op: "toggleTodo"; }',
  '[data-substrate-state][data-trigger="delete"] { --next-op: "deleteTodo"; }',
  '[data-substrate-state][data-trigger="submit"][data-input-present="1"] { --next-op: "addTodo"; }',
  '[data-substrate-state][data-trigger="clear-completed"] { --next-op: "clearCompleted"; }'
].join("\n");

console.log("k1-closure verification (criterion 5)");
console.log("");

// -- Test 1: skeleton deposition (no cascade rules) closure
test("skeleton deposition has KERNEL RUNTIME and APPLICATION sections", () => {
  const html = Emitter.emit();
  const tmpPath = path.join(__dirname, "_tmp_skeleton.html");
  fs.writeFileSync(tmpPath, html, "utf8");
  const r = Closure.verify(tmpPath, { verbose: false });
  fs.unlinkSync(tmpPath);
  assert(r.kernelRange, "kernel range present");
  assert(r.appRange, "app range present");
});

test("skeleton closure: PASS (no application scripts)", () => {
  const html = Emitter.emit();
  const tmpPath = path.join(__dirname, "_tmp_skeleton.html");
  fs.writeFileSync(tmpPath, html, "utf8");
  const r = Closure.verify(tmpPath, { verbose: false });
  fs.unlinkSync(tmpPath);
  assert(r.ok, "closure ok");
  assert(r.violations === 0, "no violations");
  assert(r.counts.application === 0, "no app scripts in skeleton");
  assert(r.counts.kernel === 8,
    "8 kernel scripts (5 canonical + 3 Phase 8 runtime); got " + r.counts.kernel);
});

// -- Test 2: cascade-rules deposition closure
test("cascade deposition: KERNEL RUNTIME + APPLICATION sections present", () => {
  const html = Emitter.emit({ cascadeRules: TODOMVC_CASCADE });
  const tmpPath = path.join(__dirname, "_tmp_cascade.html");
  fs.writeFileSync(tmpPath, html, "utf8");
  const r = Closure.verify(tmpPath, { verbose: false });
  fs.unlinkSync(tmpPath);
  assert(r.kernelRange);
  assert(r.appRange);
});

test("cascade closure: PASS (cascade rule JSON has no host APIs)", () => {
  const html = Emitter.emit({ cascadeRules: TODOMVC_CASCADE });
  const tmpPath = path.join(__dirname, "_tmp_cascade.html");
  fs.writeFileSync(tmpPath, html, "utf8");
  const r = Closure.verify(tmpPath, { verbose: false });
  fs.unlinkSync(tmpPath);
  assert(r.ok, "closure ok; reason: " + r.reason);
  assert(r.violations === 0,
    "no violations; got " + r.violations + " - " +
    JSON.stringify(r.violationDetails && r.violationDetails.slice(0, 3)));
  assert(r.counts.application === 1, "1 application script (cascade JSON)");
  assert(r.counts.kernel === 8,
    "8 kernel scripts (5 canonical + 3 Phase 8 runtime); got " + r.counts.kernel);
});

// -- Test 3: synthetic violation: app section with localStorage
//   This is a defensive check - if a future deposition emitter accidentally
//   placed host-API code in the application section, closure should catch it.
test("synthetic test: localStorage in app section is detected as violation", () => {
  const Emitter2 = Emitter;
  const html = Emitter2.emit();
  // Inject a forbidden pattern into the application section
  const malformed = html.replace(
    "<!-- === END APPLICATION === -->",
    "<script>var x = localStorage.getItem('test');</script>\n<!-- === END APPLICATION === -->"
  );
  const tmpPath = path.join(__dirname, "_tmp_synthetic.html");
  fs.writeFileSync(tmpPath, malformed, "utf8");
  const r = Closure.verify(tmpPath, { verbose: false });
  fs.unlinkSync(tmpPath);
  assert(!r.ok, "synthetic violation should NOT pass");
  assert(r.violations >= 1, "at least one violation detected");
  let foundLS = false;
  for (const v of r.violationDetails) {
    if (v.pattern === "localStorage.getItem") foundLS = true;
  }
  assert(foundLS, "localStorage.getItem detected as violation");
});

// -- Test 4: all 11 forbidden patterns enumerated
test("all 11 forbidden patterns from Phase 7 sec 3.1 enumerated", () => {
  assert(Closure.FORBIDDEN_PATTERNS.length === 11,
    "got " + Closure.FORBIDDEN_PATTERNS.length + " patterns");
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
