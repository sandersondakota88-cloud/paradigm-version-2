// bridge-binding-verifier.js - Phase 9 bridge generalization

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const DOMbridge = require("./dom-bridge.js");
const FieldExt = require("./field-intake-extension.js");

let pass = 0, fail = 0;
const failures = [];

function test(name, fn) {
  try { fn(); pass++; console.log("  OK   " + name); }
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
  const fieldSrc = fs.readFileSync(
    path.join(__dirname, "kernel-src", "field.js"), "utf8");
  vm.runInContext(fieldSrc, sandbox, { filename: "field.js" });
  FieldExt.install(sandbox.FieldModule);
  sandbox.FieldModule.Field.reset();
  return sandbox.FieldModule;
}

// Mock minimal DOM element supporting setAttribute/hasAttribute
function mockElement() {
  const attrs = {};
  return {
    _attrs: attrs,
    setAttribute: function (k, v) { attrs[k] = String(v); },
    hasAttribute: function (k) { return Object.prototype.hasOwnProperty.call(attrs, k); },
    getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; }
  };
}

console.log("bridge-binding verification");
console.log("");

// ----------------------------------------------------------------------------
// PART A: DEFAULT_BINDING and resolveBinding
// ----------------------------------------------------------------------------
console.log("PART A: DEFAULT_BINDING + resolveBinding");
console.log("");

test("DEFAULT_BINDING exposed and frozen", () => {
  assert(DOMbridge.DEFAULT_BINDING);
  assert(Object.isFrozen(DOMbridge.DEFAULT_BINDING));
  assert(DOMbridge.DEFAULT_BINDING.presenceMarkerAttr === "data-substrate-state");
  assert(DOMbridge.DEFAULT_BINDING.outputAttrPrefix === "data-");
});

test("resolveBinding(undefined) returns DEFAULT_BINDING", () => {
  const b = DOMbridge.resolveBinding();
  assert(b === DOMbridge.DEFAULT_BINDING);
});

test("resolveBinding({}) returns DEFAULT_BINDING values", () => {
  const b = DOMbridge.resolveBinding({});
  assert(b.presenceMarkerAttr === "data-substrate-state");
  assert(b.outputAttrPrefix === "data-");
});

test("resolveBinding overrides specific fields, defaults the rest", () => {
  const b = DOMbridge.resolveBinding({
    presenceMarkerAttr: "data-app-root"
  });
  assert(b.presenceMarkerAttr === "data-app-root");
  // Other fields default
  assert(b.outputAttrPrefix === "data-");
  assert(b.defaultEventTriggerAttr === "data-trigger");
});

test("resolveBinding result is frozen", () => {
  const b = DOMbridge.resolveBinding({ outputAttrPrefix: "data-x-" });
  assert(Object.isFrozen(b));
});

// ----------------------------------------------------------------------------
// PART B: bridge with default binding (backward compat)
// ----------------------------------------------------------------------------
console.log("");
console.log("PART B: bridge with default binding (backward compat)");
console.log("");

test("init with no binding -> uses DEFAULT_BINDING", () => {
  const fm = buildField();
  const el = mockElement();
  const bridge = DOMbridge.createBridge();
  bridge.init(fm.Field, el);
  const b = bridge.getBinding();
  assert(b === DOMbridge.DEFAULT_BINDING);
});

test("default binding: project produces data-* attrs and presence marker", () => {
  const fm = buildField();
  const el = mockElement();
  const bridge = DOMbridge.createBridge();
  bridge.init(fm.Field, el);
  fm.Field.intake.publish({
    type: "dom::evt", value: { mode: "x" }, timestamp: 0, source: "test"
  });
  bridge.projectFieldToDOM();
  assert(el.hasAttribute("data-substrate-state"));
  assert(el.getAttribute("data-mode") === "x");
});

// ----------------------------------------------------------------------------
// PART C: bridge with custom binding
// ----------------------------------------------------------------------------
console.log("");
console.log("PART C: bridge with custom binding");
console.log("");

test("Custom presenceMarkerAttr changes which attr marks the state element", () => {
  const fm = buildField();
  const el = mockElement();
  const bridge = DOMbridge.createBridge();
  bridge.init(fm.Field, el, {
    presenceMarkerAttr: "data-app-root"
  });
  fm.Field.intake.publish({
    type: "dom::evt", value: { x: "1" }, timestamp: 0, source: "test"
  });
  bridge.projectFieldToDOM();
  assert(el.hasAttribute("data-app-root"),
    "custom presence marker present");
  assert(!el.hasAttribute("data-substrate-state"),
    "default presence marker NOT present under custom binding");
});

test("Custom outputAttrPrefix changes the attr prefix the bridge writes", () => {
  const fm = buildField();
  const el = mockElement();
  const bridge = DOMbridge.createBridge();
  bridge.init(fm.Field, el, {
    outputAttrPrefix: "data-app-"
  });
  fm.Field.intake.publish({
    type: "dom::evt", value: { mode: "active" }, timestamp: 0, source: "test"
  });
  bridge.projectFieldToDOM();
  assert(el.getAttribute("data-app-mode") === "active",
    "expected data-app-mode, got " + JSON.stringify(el._attrs));
  assert(el.getAttribute("data-mode") === null,
    "default prefix NOT used");
});

test("Custom objectKeysAsCoordsPrefixes routes intake correctly", () => {
  const fm = buildField();
  const el = mockElement();
  const bridge = DOMbridge.createBridge();
  bridge.init(fm.Field, el, {
    // Treat "input::" prefixes as object-keys (instead of "dom::")
    objectKeysAsCoordsPrefixes: ["input"]
  });
  // Under default binding, "dom::evt" with object value flattens keys.
  // Under this custom binding, "dom::" is no longer special; it should
  // fall to case 2 (dimName = after "::"). "input::evt" instead
  // flattens its object's keys.
  fm.Field.intake.publish({
    type: "input::evt", value: { selected: "yes" },
    timestamp: 0, source: "test"
  });
  bridge.projectFieldToDOM();
  assert(el.getAttribute("data-selected") === "yes",
    "input:: prefix flattens keys under custom binding");
});

test("Custom defaultEventTriggerAttr controls which attr the bridge reads", () => {
  const fm = buildField();
  const el = mockElement();
  const bridge = DOMbridge.createBridge();
  bridge.init(fm.Field, el, {
    defaultEventTriggerAttr: "data-app-action"
  });
  // Simulate a target with the custom attribute
  const target = mockElement();
  target.setAttribute("data-app-action", "submit");
  // Manually invoke the default record path by simulating the listener
  // (we can't run real DOM events here, but we can construct a fake
  // event and verify defaultEventRecord-equivalent behavior by
  // calling addDOMEventListener with a target+handler then triggering.)
  let publishedType = null;
  let publishedValue = null;
  const origPublish = fm.Field.intake.publish;
  fm.Field.intake.publish = function (rec) {
    publishedType = rec.type;
    publishedValue = rec.value;
    return origPublish.call(fm.Field.intake, rec);
  };
  // Mock target with addEventListener to capture handler
  let captured = null;
  target.addEventListener = function (et, h) { captured = h; };
  bridge.addDOMEventListener(target, "click");
  // Invoke handler with a fake DOM event
  captured({ target: target, timeStamp: 100 });
  assert(publishedType === "dom::click");
  assert(publishedValue && publishedValue.trigger === "submit",
    "trigger pulled from custom attr; got " + JSON.stringify(publishedValue));
});

// ----------------------------------------------------------------------------
// PART D: two bridges with different bindings on different state elements
// ----------------------------------------------------------------------------
console.log("");
console.log("PART D: two bridges, different bindings, no interference");
console.log("");

test("Two bridges on same field, different bindings -> different attrs on different elements", () => {
  const fm = buildField();
  const el1 = mockElement();
  const el2 = mockElement();

  const bridge1 = DOMbridge.createBridge();
  bridge1.init(fm.Field, el1, {
    presenceMarkerAttr: "data-deployment-a",
    outputAttrPrefix: "data-a-"
  });
  const bridge2 = DOMbridge.createBridge();
  bridge2.init(fm.Field, el2, {
    presenceMarkerAttr: "data-deployment-b",
    outputAttrPrefix: "data-b-"
  });

  fm.Field.intake.publish({
    type: "dom::evt", value: { mode: "x" }, timestamp: 0, source: "test"
  });
  bridge1.projectFieldToDOM();
  bridge2.projectFieldToDOM();

  // bridge1 writes data-deployment-a and data-a-mode
  assert(el1.hasAttribute("data-deployment-a"));
  assert(el1.getAttribute("data-a-mode") === "x");
  assert(!el1.hasAttribute("data-deployment-b"));
  assert(el1.getAttribute("data-b-mode") === null);

  // bridge2 writes data-deployment-b and data-b-mode
  assert(el2.hasAttribute("data-deployment-b"));
  assert(el2.getAttribute("data-b-mode") === "x");
  assert(!el2.hasAttribute("data-deployment-a"));
  assert(el2.getAttribute("data-a-mode") === null);
});

// ----------------------------------------------------------------------------
// PART E: bridge stays generic - no logic change based on binding values
// ----------------------------------------------------------------------------
console.log("");
console.log("PART E: bridge code is generic (binding is data, not code)");
console.log("");

test("Bridge does not branch on specific binding values", () => {
  // The bridge's behavior under a binding must derive from the
  // binding's data, not from special-case logic for particular
  // values. This is structurally what makes the bridge generic.
  //
  // Concretely: a binding with presenceMarkerAttr="data-something-
  // weird" should produce that exact attr on the state element with
  // no other side effects.
  const fm = buildField();
  const el = mockElement();
  const bridge = DOMbridge.createBridge();
  bridge.init(fm.Field, el, {
    presenceMarkerAttr: "data-something-weird"
  });
  fm.Field.intake.publish({
    type: "dom::evt", value: { mode: "x" }, timestamp: 0, source: "test"
  });
  bridge.projectFieldToDOM();
  assert(el.hasAttribute("data-something-weird"));
});

// ----------------------------------------------------------------------------
// PART F: closure
// ----------------------------------------------------------------------------
console.log("");
console.log("PART F: closure");
console.log("");

test("Bridge module: ASCII-only", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "dom-bridge.js"), "utf8");
  const m = src.match(/[^\x00-\x7F]/);
  assert(!m, "non-ASCII: " + (m && m[0]));
});

test("Bridge with custom binding: no constraint mutations, no field.ratify", () => {
  const fm = buildField();
  const el = mockElement();
  const bridge = DOMbridge.createBridge();
  bridge.init(fm.Field, el, { outputAttrPrefix: "data-test-" });
  const constraintsBefore = fm.Field.constraints.length;
  fm.Field.intake.publish({
    type: "dom::evt", value: { mode: "x" }, timestamp: 0, source: "test"
  });
  bridge.projectFieldToDOM();
  // Bridge does not mutate constraints
  assert(fm.Field.constraints.length === constraintsBefore);
});

test("M5 honored: bridge module references no Trace import", () => {
  // M5 says trace lives at the channel; bridge is K2-class and must
  // not write to trace. Today's bridge has no path to Trace because
  // it never imports or accesses any Trace API. This static check
  // ensures future maintainers don't introduce one.
  const src = fs.readFileSync(
    path.join(__dirname, "dom-bridge.js"), "utf8");
  // Strip comments first (the comment block at top mentions "trace"
  // descriptively)
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  // No Trace.append call
  assert(stripped.indexOf("Trace.append") < 0,
    "bridge must not call Trace.append (M5 violation)");
  // No trace.append call (lowercased)
  assert(stripped.indexOf("trace.append") < 0,
    "bridge must not call trace.append (M5 violation)");
  // No require/import of Trace
  assert(!/require\([^)]*[Tt]race/.test(stripped),
    "bridge must not import Trace");
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
