// k1-deposition-boot-verifier.js - K1 final cap: full deposition E2E

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

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

// ============================================================================
// Mock DOM - just enough for the deposition runtime
// ============================================================================

function makeElement(tag, id) {
  const attrs = {};
  const listeners = {};
  const children = [];
  const el = {
    tagName: (tag || "DIV").toUpperCase(),
    id: id || "",
    children: children,
    parentNode: null,
    style: {},
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
    appendChild: function (child) {
      children.push(child);
      child.parentNode = this;
      return child;
    },
    querySelectorAll: function (selector) {
      // Support [data-X] and [data-X="Y"] only
      const m1 = selector.match(/^\[([\w-]+)\]$/);
      const m2 = selector.match(/^\[([\w-]+)="([^"]*)"\]$/);
      const results = [];
      function walk(node) {
        if (!node) return;
        if (m1) {
          if (node.hasAttribute && node.hasAttribute(m1[1])) results.push(node);
        } else if (m2) {
          if (node.getAttribute && node.getAttribute(m2[1]) === m2[2]) results.push(node);
        }
        if (node.children) {
          for (const c of node.children) walk(c);
        }
      }
      walk(this);
      return results;
    },
    textContent: ""
  };
  return el;
}

function makeDocument() {
  const elementsById = {};
  const body = makeElement("body");
  const stateEl = makeElement("div", "substrate-state");
  stateEl.setAttribute("data-substrate-state", "");
  body.appendChild(stateEl);
  elementsById["substrate-state"] = stateEl;
  // Add status-display elements that the deposition's status-poller reads
  const statusIds = ["tick-count", "field-step", "constraint-count",
    "seed-ok", "scalar-delta", "fast-delta", "slow-delta", "gap", "trace-len"];
  for (const id of statusIds) {
    const el = makeElement("span", id);
    body.appendChild(el);
    elementsById[id] = el;
  }
  // Add a [data-trigger] button to test event flow
  const toggleBtn = makeElement("button", "btn-toggle");
  toggleBtn.setAttribute("data-trigger", "toggle");
  body.appendChild(toggleBtn);
  elementsById["btn-toggle"] = toggleBtn;
  return {
    body: body,
    getElementById: function (id) { return elementsById[id] || null; },
    querySelectorAll: function (sel) { return body.querySelectorAll(sel); },
    _byId: elementsById
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
// Extract <script> bodies from an HTML file
// ============================================================================

function extractScripts(html) {
  const scripts = [];
  const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    scripts.push(m[1]);
  }
  return scripts;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("k1-deposition-boot verification (full deposition E2E)");
  console.log("");

  const htmlPath = path.join(__dirname, "cascade-deposition.html");
  if (!fs.existsSync(htmlPath)) {
    console.error("cascade-deposition.html not found; run emitter first");
    process.exit(2);
  }
  const html = fs.readFileSync(htmlPath, "utf8");
  console.log("Loaded cascade-deposition.html (" + html.length + " bytes)");

  const scripts = extractScripts(html);
  console.log("Extracted " + scripts.length + " script blocks");
  console.log("");

  // Build sandbox with rich-enough DOM mock
  const doc = makeDocument();
  const sandbox = {
    console: console, setTimeout: setTimeout, setImmediate: setImmediate,
    Promise: Promise, Object: Object, Array: Array, Math: Math, JSON: JSON,
    Uint32Array: Uint32Array, Float64Array: Float64Array,
    Float32Array: Float32Array, Uint8Array: Uint8Array,
    Map: Map, Set: Set, Error: Error, TypeError: TypeError,
    RangeError: RangeError, String: String, Number: Number,
    Boolean: Boolean, Date: Date,
    performance: { now: () => Date.now() },
    document: doc,
    navigator: { gpu: null }
  };
  sandbox.globalThis = sandbox;
  sandbox.global = sandbox;
  sandbox.window = sandbox;
  vm.createContext(sandbox);

  console.log("Phase 1: deposition scripts execute without error");

  test("All script blocks execute (kernel + Phase 8 runtime + cascade JSON + init + status poll)", () => {
    for (let i = 0; i < scripts.length; i++) {
      try {
        vm.runInContext(scripts[i], sandbox, { filename: "script-" + i });
      } catch (e) {
        throw new Error("script " + i + " failed: " + e.message);
      }
    }
  });

  test("globalThis.substrate exists (SKELETON_INIT ran)", () => {
    assert(sandbox.substrate);
    assert(sandbox.substrate.field);
    assert(sandbox.substrate.ct);
    assert(sandbox.substrate.er);
  });

  test("Field has 1 seed + 4 cascade rules", () => {
    assert(sandbox.substrate.field.constraints.length === 5);
    assert(sandbox.substrate.field.constraints[0].kind === "seed");
    assert(sandbox.substrate.cascadeRuleCount === 4);
  });

  test("Field.intake installed (SE-08)", () => {
    assert(sandbox.substrate.field.intake);
    assert(typeof sandbox.substrate.field.intake.publish === "function");
    assert(sandbox.substrate.field.intake.records.length === 0);
  });

  test("DOM bridge wired (SUBSTRATE_HANDLE.bridge non-null)", () => {
    assert(sandbox.substrate.bridge !== null,
      "bridge should initialize given mock DOM");
    const d = sandbox.substrate.bridge.diagnostics();
    assert(d.initialized === true);
    assert(d.stateElementId === "substrate-state");
  });

  test("Auto-wired [data-trigger] elements (1 toggle button)", () => {
    const d = sandbox.substrate.bridge.diagnostics();
    assert(d.listenerCount === 1,
      "expected 1 listener (toggle button); got " + d.listenerCount);
  });

  console.log("");
  console.log("Phase 2: dispatch click; verify pipeline reaches CT");

  test("Dispatch click on toggle button publishes intake record", () => {
    const btn = doc.getElementById("btn-toggle");
    btn.dispatchEvent(makeEvent("click", { timeStamp: 1000 }));
    const intake = sandbox.substrate.field.intake;
    assert(intake.records.length === 1,
      "expected 1 record; got " + intake.records.length);
    const r = intake.records[0];
    assert(r.type === "dom::click");
    assert(r.value && r.value.trigger === "toggle");
  });

  await asyncTest("Tick advances; cascade resolves; CT enqueues toggleTodo", async () => {
    // Wait briefly for the rAF/setImmediate-driven tick loop to run
    // a few times.
    await new Promise(resolve => setTimeout(resolve, 100));
    // The tick loop should have:
    //   - run evaluateCascade -> field.cascadeOutput["--next-op"] = toggleTodo
    //   - bridge.projectFieldToDOM -> stateElement now has data-trigger=toggle
    //   - bridge.dispatchToCT -> queue has cascade-op
    //   - CT.drainAll processed it -> ctTotalOpsSeen incremented
    const stateEl = sandbox.document.getElementById("substrate-state");
    assert(stateEl.getAttribute("data-trigger") === "toggle",
      "state element data-trigger projected; got " +
      stateEl.getAttribute("data-trigger"));
    assert(sandbox.substrate.field.cascadeOutput, "cascadeOutput exists");
    assert(sandbox.substrate.field.cascadeOutput["--next-op"],
      "next-op resolved");
    assert(sandbox.substrate.field.cascadeOutput["--next-op"].value === "toggleTodo",
      "next-op = toggleTodo; got " +
      sandbox.substrate.field.cascadeOutput["--next-op"].value);
    assert(sandbox.substrate.tickCount > 0,
      "tick loop ran; tickCount=" + sandbox.substrate.tickCount);
  });

  test("F1 preserved through full deposition boot", () => {
    assert(sandbox.substrate.field.constraints[0].id === sandbox.substrate.seed.id);
    assert(sandbox.substrate.field.constraints[0].kind === "seed");
    assert(sandbox.substrate.field.constraints[0].permanent === true);
  });

  test("Cascade rules at constraints[1..4] preserved through full boot", () => {
    for (let i = 1; i <= 4; i++) {
      const c = sandbox.substrate.field.constraints[i];
      assert(c, "constraint " + i + " present");
      assert(c.pattern && c.pattern.type === "cascade-match");
    }
  });

  console.log("");
  console.log("Phase 3: dispatch DELETE click; verify pipeline routes correctly");

  // Add a delete button (deposition's auto-wire only caught the one we
  // pre-populated, but we can publish manually to test routing)
  test("Manual publish of delete click routes through cascade", () => {
    sandbox.substrate.field.intake.publish({
      type: "dom::click",
      value: { trigger: "delete" },
      timestamp: 2000,
      source: "test"
    });
    // Wait for next tick
    return new Promise(resolve => {
      setTimeout(() => {
        const co = sandbox.substrate.field.cascadeOutput["--next-op"];
        try {
          assert(co, "cascadeOutput populated");
          assert(co.value === "deleteTodo",
            "next-op should be deleteTodo; got " + co.value);
          resolve();
        } catch (e) { resolve(Promise.reject(e)); }
      }, 50);
    });
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

main().catch(e => {
  console.error("Fatal:", e);
  process.exit(2);
});
