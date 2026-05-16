// k1-bridge-verifier.js - K1 DOM bridge verification

"use strict";

let pass = 0, fail = 0;
const failures = [];

function test(name, fn) {
  try { fn(); pass++; console.log("  OK   " + name); }
  catch (e) { fail++; failures.push({ name, error: e }); console.log("  FAIL " + name + ": " + e.message); }
}
function assert(c, m) { if (!c) throw new Error("assertion failed: " + (m || "")); }

// ============================================================================
// Minimal DOM mock - just enough for the bridge
// ============================================================================

function makeElement(tag, id) {
  const attrs = {};
  const listeners = {};  // eventType -> array of handlers
  return {
    tagName: (tag || "DIV").toUpperCase(),
    id: id || "",
    setAttribute: function (name, value) { attrs[name] = String(value); },
    getAttribute: function (name) {
      return attrs.hasOwnProperty(name) ? attrs[name] : null;
    },
    hasAttribute: function (name) { return attrs.hasOwnProperty(name); },
    removeAttribute: function (name) { delete attrs[name]; },
    addEventListener: function (eventType, handler) {
      if (!listeners[eventType]) listeners[eventType] = [];
      listeners[eventType].push(handler);
    },
    removeEventListener: function (eventType, handler) {
      if (!listeners[eventType]) return;
      const idx = listeners[eventType].indexOf(handler);
      if (idx >= 0) listeners[eventType].splice(idx, 1);
    },
    dispatchEvent: function (event) {
      event.target = this;
      const handlers = listeners[event.type] || [];
      for (const h of handlers) h(event);
    },
    _attrs: attrs,
    _listeners: listeners
  };
}

function makeEvent(type, opts) {
  opts = opts || {};
  return {
    type: type,
    timeStamp: opts.timeStamp || 0,
    target: opts.target || null
  };
}

// ============================================================================
// Test setup
// ============================================================================

console.log("k1-bridge verification (criterion 4 - DOM bridge)");
console.log("");

// Fresh require cache - tests in same process share Field state via require
delete require.cache[require.resolve("./kernel-src/field.js")];

const FieldModule = require("./kernel-src/field.js");
const Extension = require("./field-intake-extension.js");
const Evaluator = require("./kernel-cascade-evaluator.js");
const DOMbridge = require("./dom-bridge.js");
const Synth = require("./cascade-rule-synthesizer.js");

const TODOMVC_CASCADE = [
  '[data-substrate-state][data-trigger="toggle"] { --next-op: "toggleTodo"; }',
  '[data-substrate-state][data-trigger="delete"] { --next-op: "deleteTodo"; }',
  '[data-substrate-state][data-trigger="submit"][data-input-present="1"] { --next-op: "addTodo"; }',
  '[data-substrate-state][data-trigger="clear-completed"] { --next-op: "clearCompleted"; }'
].join("\n");

// Setup field with cascade rules and intake
const Field = FieldModule.Field;
const Trace = FieldModule.Trace;
Field.reset();
Trace.clear();
Extension.install(FieldModule, { cap: 64 });
Field.reset();
const synthResult = Synth.synthesizeFromCss(TODOMVC_CASCADE);
for (const c of synthResult.constraints) Field.constraints.push(c);

// ============================================================================
// Phase 1: bridge construction + init
// ============================================================================

console.log("Phase 1: construction + init");

let bridge;
let stateElement;

test("createBridge returns an object with expected API", () => {
  bridge = DOMbridge.createBridge();
  assert(bridge);
  assert(typeof bridge.init === "function");
  assert(typeof bridge.projectFieldToDOM === "function");
  assert(typeof bridge.addDOMEventListener === "function");
  assert(typeof bridge.sampleNextOp === "function");
  assert(typeof bridge.dispatchToCT === "function");
  assert(typeof bridge.teardown === "function");
});

test("init() requires field and stateElement", () => {
  let threw = false;
  try { bridge.init(null, null); } catch (e) { threw = true; }
  assert(threw, "init(null) should throw");
});

test("init() requires Field.intake to be installed", () => {
  // Field has intake from setup, so this should succeed
  stateElement = makeElement("div", "substrate-state");
  bridge.init(Field, stateElement);
  const d = bridge.diagnostics();
  assert(d.initialized === true);
  assert(d.stateElementId === "substrate-state");
});

// ============================================================================
// Phase 2: flow 4a - field state -> DOM projection
// ============================================================================

console.log("");
console.log("Phase 2: flow 4a (field -> DOM projection)");

test("projectFieldToDOM with empty intake adds substrate-state marker", () => {
  bridge.projectFieldToDOM();
  assert(stateElement.hasAttribute("data-substrate-state"),
    "data-substrate-state present");
});

test("publish + project: data-* attrs reflect intake state", () => {
  Field.intake.publish({
    type: "dom::click",
    value: { trigger: "toggle" },
    timestamp: 1000,
    source: "test"
  });
  bridge.projectFieldToDOM();
  assert(stateElement.getAttribute("data-trigger") === "toggle",
    "data-trigger=" + stateElement.getAttribute("data-trigger"));
});

test("multi-attr publish projects multiple data-* attrs", () => {
  Field.intake.publish({
    type: "dom::click",
    value: { trigger: "submit", "input-present": "1" },
    timestamp: 1100,
    source: "test"
  });
  bridge.projectFieldToDOM();
  assert(stateElement.getAttribute("data-trigger") === "submit");
  assert(stateElement.getAttribute("data-input-present") === "1");
});

test("S1: bridge holds NO authoritative state - regenerated each call", () => {
  // Mutate the DOM externally - simulating concurrent change
  stateElement.setAttribute("data-trigger", "tampered");
  // Bridge regenerates from field state
  bridge.projectFieldToDOM();
  // Last published value should win, not the tampered value
  assert(stateElement.getAttribute("data-trigger") === "submit",
    "field state authoritative; got " + stateElement.getAttribute("data-trigger"));
});

// ============================================================================
// Phase 3: flow 4b - DOM events -> field intake
// ============================================================================

console.log("");
console.log("Phase 3: flow 4b (DOM events -> intake publish)");

let triggerButton;

test("addDOMEventListener attaches a listener", () => {
  triggerButton = makeElement("button", "btn-toggle");
  triggerButton.setAttribute("data-trigger", "toggle");
  bridge.addDOMEventListener(triggerButton, "click");
  assert(triggerButton._listeners["click"]);
  assert(triggerButton._listeners["click"].length === 1);
});

test("DOM click publishes intake record with data-trigger value", () => {
  // Fresh button so we don't accumulate listeners from prior tests
  const btn = makeElement("button", "btn-toggle-2");
  btn.setAttribute("data-trigger", "toggle");
  Field.reset();  // clear intake
  bridge.addDOMEventListener(btn, "click");
  btn.dispatchEvent(makeEvent("click", { timeStamp: 5000 }));
  assert(Field.intake.records.length === 1,
    "expected 1 record, got " + Field.intake.records.length);
  const r = Field.intake.records[0];
  assert(r.type === "dom::click");
  assert(r.value && r.value.trigger === "toggle");
  assert(r.source === "dom-bridge");
});

test("DOM event with data-input-present captures both attrs", () => {
  const submitButton = makeElement("button", "btn-submit");
  submitButton.setAttribute("data-trigger", "submit");
  submitButton.setAttribute("data-input-present", "1");
  bridge.addDOMEventListener(submitButton, "click");
  Field.intake.clear();
  submitButton.dispatchEvent(makeEvent("click"));
  assert(Field.intake.records.length === 1);
  const r = Field.intake.records[0];
  assert(r.value.trigger === "submit");
  assert(r.value["input-present"] === "1");
});

test("DOM event without data-trigger publishes nothing", () => {
  const plainElement = makeElement("div", "no-trigger");
  bridge.addDOMEventListener(plainElement, "click");
  Field.intake.clear();
  plainElement.dispatchEvent(makeEvent("click"));
  assert(Field.intake.records.length === 0,
    "no record published when no data-trigger");
});

// ============================================================================
// Phase 4: end-to-end flow - DOM event -> intake -> evaluate -> sample -> CT
// ============================================================================

console.log("");
console.log("Phase 4: end-to-end pipeline");

const CTengineModule = require("./kernel-src/ct-engine.js");
const ERengineModule = require("./kernel-src/er-engine.js");
const ConstraintCompiler = require("./kernel-src/constraint-compiler.js");

let ER, CT;

test("E2E: setup CT/ER, dispatch click, dispatch reaches CT queue", () => {
  // Reset everything for a clean E2E test
  Field.reset();  // clears intake AND prior cascade state
  Trace.clear();
  // Re-add cascade rules (Field.reset wipes constraints back to seed only)
  for (const c of synthResult.constraints) Field.constraints.push(c);

  ER = new ERengineModule.ERengine();
  ER.state = "cpu-fallback";
  CT = new CTengineModule.CTengine();
  CT.bind(ER, ConstraintCompiler);

  // Re-init bridge (state element is still good)
  bridge.teardown();
  bridge.init(Field, stateElement);

  // Wire up click handler
  const btn = makeElement("button");
  btn.setAttribute("data-trigger", "toggle");
  bridge.addDOMEventListener(btn, "click");

  // Step 1: user clicks
  btn.dispatchEvent(makeEvent("click", { timeStamp: 9999 }));
  assert(Field.intake.records.length === 1, "intake has the click");

  // Step 2: bridge projects field to DOM (CSS substrate would now resolve)
  bridge.projectFieldToDOM();
  assert(stateElement.getAttribute("data-trigger") === "toggle",
    "DOM reflects current field state");

  // Step 3: kernel evaluator runs (the kernel-authoritative cascade)
  const evalRes = Evaluator.evaluateCascade(Field, { traceModule: Trace });
  assert(evalRes.currentNextOp === "toggleTodo",
    "evaluator resolved next-op; got " + evalRes.currentNextOp);

  // Step 4: bridge samples and dispatches to CT
  const enqueued = bridge.dispatchToCT(CT);
  assert(enqueued === true, "first dispatch enqueued");
  assert(Field.ctPendingOps.length >= 1, "CT queue non-empty");
  const op = Field.ctPendingOps[Field.ctPendingOps.length - 1];
  assert(op.kind === "cascade-op");
  assert(op.payload.op === "toggleTodo");
});

test("E2E: dedup - re-sampling same output does not re-enqueue", () => {
  const beforeLen = Field.ctPendingOps.length;
  const enqueued = bridge.dispatchToCT(CT);
  assert(enqueued === false, "dedup blocks re-enqueue");
  assert(Field.ctPendingOps.length === beforeLen);
});

test("E2E: new event -> new cascade output -> new dispatch", () => {
  const btn2 = makeElement("button");
  btn2.setAttribute("data-trigger", "delete");
  bridge.addDOMEventListener(btn2, "click");
  btn2.dispatchEvent(makeEvent("click"));

  bridge.projectFieldToDOM();
  Field.step++;  // simulate tick advance for atStep dedup
  Evaluator.evaluateCascade(Field, { traceModule: Trace });

  const enqueued = bridge.dispatchToCT(CT);
  assert(enqueued === true, "new op (different value) enqueues");
  const op = Field.ctPendingOps[Field.ctPendingOps.length - 1];
  assert(op.payload.op === "deleteTodo");
});

// ============================================================================
// Phase 5: invariants honored
// ============================================================================

console.log("");
console.log("Phase 5: invariants honored");

test("F1: seed at constraints[0] preserved through full bridge flow", () => {
  assert(Field.constraints[0].id === FieldModule.SEED.id);
  assert(Field.constraints[0].kind === "seed");
});

test("M5: bridge does not write to Trace directly", () => {
  // Filter trace entries: any from bridge?
  const bridgeEntries = Trace.entries.filter(e =>
    e.detail && typeof e.detail === "string" &&
    e.detail.indexOf("bridge") >= 0 &&
    e.scope !== "er"   // ER may mention bridge in its own trace; that's OK
  );
  assert(bridgeEntries.length === 0,
    "bridge wrote " + bridgeEntries.length + " trace entries directly");
});

test("F3: bridge has no callbacks that engines invoke", () => {
  // Bridge methods are called by tick loop / event listeners. Engines
  // (CT/ER) never call into bridge. The bridge is unidirectional from
  // engine perspective. This is structural; the test confirms by
  // construction (the bridge surface area has no register-callback API).
  assert(typeof bridge.registerCallback === "undefined",
    "bridge has no registerCallback API");
  assert(typeof bridge.onTick === "undefined",
    "bridge has no onTick API");
});

test("teardown clears listeners and state", () => {
  const beforeDiag = bridge.diagnostics();
  assert(beforeDiag.listenerCount > 0);
  bridge.teardown();
  const afterDiag = bridge.diagnostics();
  assert(afterDiag.listenerCount === 0);
  assert(afterDiag.initialized === false);
});

// ============================================================================
// Summary
// ============================================================================

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
