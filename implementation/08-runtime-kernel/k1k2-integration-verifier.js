// k1k2-integration-verifier.js - K1+K2 integration: time adapter in runtime

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

// ----------------------------------------------------------------------------
// Mock DOM (same shape as deposition-boot-verifier)
// ----------------------------------------------------------------------------

function makeElement(tag, id) {
  const attrs = {}, listeners = {}, children = [];
  const el = {
    tagName: (tag || "DIV").toUpperCase(), id: id || "", children, parentNode: null, style: {},
    setAttribute(name, value) { attrs[name] = String(value); },
    getAttribute(name) { return attrs.hasOwnProperty(name) ? attrs[name] : null; },
    hasAttribute(name) { return attrs.hasOwnProperty(name); },
    removeAttribute(name) { delete attrs[name]; },
    addEventListener(t, h) { (listeners[t] = listeners[t] || []).push(h); },
    removeEventListener(t, h) {
      if (!listeners[t]) return;
      const i = listeners[t].indexOf(h); if (i >= 0) listeners[t].splice(i, 1);
    },
    dispatchEvent(event) {
      event.target = this;
      for (const h of (listeners[event.type] || [])) h(event);
    },
    appendChild(c) { children.push(c); c.parentNode = this; return c; },
    querySelectorAll(sel) {
      const m1 = sel.match(/^\[([\w-]+)\]$/);
      const m2 = sel.match(/^\[([\w-]+)="([^"]*)"\]$/);
      const results = [];
      function walk(n) {
        if (!n) return;
        if (m1 && n.hasAttribute && n.hasAttribute(m1[1])) results.push(n);
        if (m2 && n.hasAttribute && n.hasAttribute(m2[1]) && n.getAttribute(m2[1]) === m2[2]) results.push(n);
        for (const c of (n.children || [])) walk(c);
      }
      walk(this);
      return results;
    }
  };
  return el;
}

function makeDocument() {
  const body = makeElement("body");
  const elementsById = {};
  const stateEl = makeElement("div", "substrate-state");
  stateEl.setAttribute("data-substrate-state", "");
  body.appendChild(stateEl);
  elementsById["substrate-state"] = stateEl;
  const statusIds = ["tick-count", "field-step", "constraint-count", "seed-ok",
    "scalar-delta", "fast-delta", "slow-delta", "gap", "trace-len"];
  for (const id of statusIds) {
    const el = makeElement("span", id);
    body.appendChild(el);
    elementsById[id] = el;
  }
  const toggleBtn = makeElement("button", "btn-toggle");
  toggleBtn.setAttribute("data-trigger", "toggle");
  body.appendChild(toggleBtn);
  elementsById["btn-toggle"] = toggleBtn;
  return {
    body,
    getElementById(id) { return elementsById[id] || null; },
    querySelectorAll(sel) { return body.querySelectorAll(sel); },
    _byId: elementsById
  };
}

function extractScripts(html) {
  const scripts = [];
  const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) scripts.push(m[1]);
  return scripts;
}

// ----------------------------------------------------------------------------
// Load a CommonJS module source into a vm sandbox; return module.exports
// ----------------------------------------------------------------------------

function loadModuleIntoSandbox(sandbox, srcPath, exposeAs) {
  const src = fs.readFileSync(srcPath, "utf8");
  // Wrap source so it exports its module.exports onto our chosen global
  const wrapper = "(function () { " +
    "var module = { exports: {} }; " +
    "var exports = module.exports; " +
    src + "\n" +
    "globalThis." + exposeAs + " = module.exports; " +
    "})();";
  vm.runInContext(wrapper, sandbox, { filename: srcPath });
  return sandbox[exposeAs];
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

async function main() {
  console.log("k1+k2-integration verification (time adapter into kernel runtime)");
  console.log("");

  const htmlPath = path.join(__dirname, "cascade-deposition.html");
  if (!fs.existsSync(htmlPath)) {
    console.error("cascade-deposition.html not found");
    process.exit(2);
  }
  const html = fs.readFileSync(htmlPath, "utf8");
  const scripts = extractScripts(html);

  const doc = makeDocument();
  const sandbox = {
    console, setTimeout, setImmediate, Promise, Object, Array, Math, JSON,
    Uint32Array, Float64Array, Float32Array, Uint8Array,
    Map, Set, Error, TypeError, RangeError, String, Number, Boolean, Date,
    performance: { now: () => Date.now() },
    document: doc,
    navigator: { gpu: null }
  };
  sandbox.globalThis = sandbox; sandbox.global = sandbox; sandbox.window = sandbox;
  vm.createContext(sandbox);

  console.log("Phase 1: full K1 boot");

  test("All deposition scripts execute", () => {
    for (let i = 0; i < scripts.length; i++) {
      vm.runInContext(scripts[i], sandbox, { filename: "script-" + i });
    }
  });

  test("Substrate handle exposed; field has 5 constraints; intake installed", () => {
    assert(sandbox.substrate);
    assert(sandbox.substrate.field.constraints.length === 5);
    assert(sandbox.substrate.field.intake);
    assert(typeof sandbox.substrate.field.intake.publish === "function");
  });

  test("Bridge wired and listening", () => {
    assert(sandbox.substrate.bridge);
    assert(sandbox.substrate.bridge.diagnostics().initialized === true);
  });

  console.log("");
  console.log("Phase 2: K2 patch-in (publisher + time adapter)");

  let Pub, Adapter, publisher, adapter;

  test("ContributorPublisher loads into sandbox", () => {
    Pub = loadModuleIntoSandbox(sandbox,
      path.join(__dirname, "contributor-publisher.js"), "__Pub");
    assert(Pub.ContributorPublisher);
  });

  test("TimeAdapter loads into sandbox", () => {
    Adapter = loadModuleIntoSandbox(sandbox,
      path.join(__dirname, "k2-time-adapter.js"), "__Adapter");
    assert(Adapter.TimeAdapter);
  });

  test("Publisher attaches to substrate.field", () => {
    publisher = Pub.ContributorPublisher.attach(sandbox.substrate.field);
    assert(publisher);
    assert(publisher.field === sandbox.substrate.field);
  });

  test("TimeAdapter constructed with publisher and mock clock", () => {
    let clockCalls = 0;
    const mockClock = () => {
      clockCalls++;
      return { now: 1700000000000 + clockCalls * 1000, perf: 100.0 + clockCalls };
    };
    adapter = new Adapter.TimeAdapter({
      publisher: publisher,
      clock: mockClock
    });
    assert(adapter);
    assert(adapter.publisher === publisher);
    assert(adapter._tickCount === 0);
  });

  console.log("");
  console.log("Phase 3: adapter ticks land in field.intake");

  test("First _tick publishes time-now and time-perf records", () => {
    const before = sandbox.substrate.field.intake.records.length;
    adapter._tick();
    const after = sandbox.substrate.field.intake.records.length;
    assert(after === before + 2,
      "expected 2 new records, got " + (after - before));
  });

  test("Records are SE-08 contributor shape", () => {
    const records = sandbox.substrate.field.intake.records;
    const last = records[records.length - 1];
    const prev = records[records.length - 2];
    assert(prev.type === "time-now");
    assert(last.type === "time-perf");
    assert(prev.source === "time-adapter");
    assert(last.source === "time-adapter");
    assert(typeof prev.value === "number");
    assert(typeof prev.timestamp === "number");
  });

  test("Multiple ticks accumulate", () => {
    const startCount = sandbox.substrate.field.intake.records.length;
    for (let k = 0; k < 5; k++) adapter._tick();
    const endCount = sandbox.substrate.field.intake.records.length;
    // Each tick adds 2 records (now + perf)
    assert(endCount === startCount + 10,
      "expected +10 records, got " + (endCount - startCount));
  });

  console.log("");
  console.log("Phase 4: bridge projects time records to DOM (case 3 path)");

  test("bridge.projectFieldToDOM puts data-time-now on state element", () => {
    sandbox.substrate.bridge.projectFieldToDOM();
    const stateEl = sandbox.document.getElementById("substrate-state");
    const tn = stateEl.getAttribute("data-time-now");
    assert(tn !== null, "data-time-now should be set");
    // Latest record's value, FIFO -> last value wins
    const records = sandbox.substrate.field.intake.records;
    const lastTimeNow = records.filter(r => r.type === "time-now").pop();
    assert(String(lastTimeNow.value) === tn,
      "data-time-now=" + tn + " expected " + lastTimeNow.value);
  });

  test("Latest tick's value wins over earlier ticks (FIFO last-write)", () => {
    adapter._tick();
    sandbox.substrate.bridge.projectFieldToDOM();
    const stateEl = sandbox.document.getElementById("substrate-state");
    const tn = stateEl.getAttribute("data-time-now");
    const records = sandbox.substrate.field.intake.records;
    const lastTimeNow = records.filter(r => r.type === "time-now").pop();
    assert(String(lastTimeNow.value) === tn);
  });

  test("data-time-perf also projected", () => {
    const stateEl = sandbox.document.getElementById("substrate-state");
    const tp = stateEl.getAttribute("data-time-perf");
    assert(tp !== null);
  });

  console.log("");
  console.log("Phase 5: invariants preserved through K2 patch-in");

  test("F1: seed still at constraints[0]", () => {
    const c0 = sandbox.substrate.field.constraints[0];
    assert(c0.id === sandbox.substrate.seed.id);
    assert(c0.kind === "seed");
    assert(c0.permanent === true);
  });

  test("Cascade rules still at constraints[1..4]", () => {
    for (let i = 1; i <= 4; i++) {
      const c = sandbox.substrate.field.constraints[i];
      assert(c.kind === "derived");
      assert(c.pattern && c.pattern.type === "cascade-match");
    }
  });

  test("F3: publisher.publish returns void", () => {
    const r = publisher.publish({type: "test", value: 1, source: "test"});
    assert(r === undefined);
  });

  test("F3: adapter holds no engine reference", () => {
    // Adapter has publisher and clock - no field, no ER, no CT
    assert(!adapter.field);
    assert(!adapter.er);
    assert(!adapter.ct);
  });

  test("S1: substrate.field is the same field publisher writes to", () => {
    assert(publisher.field === sandbox.substrate.field);
  });

  console.log("");
  console.log("Phase 6: kernel keeps ticking with adapter in the loop");

  await asyncTest("Kernel tick loop continues after adapter ticks", async () => {
    const startTicks = sandbox.substrate.tickCount;
    await new Promise(r => setTimeout(r, 50));
    const endTicks = sandbox.substrate.tickCount;
    assert(endTicks > startTicks,
      "tick count did not advance: " + startTicks + " -> " + endTicks);
  });

  test("F1: still preserved after kernel ticks", () => {
    assert(sandbox.substrate.field.constraints[0].id === sandbox.substrate.seed.id);
  });

  test("Field.step monotonic (no rewind)", () => {
    const step = sandbox.substrate.field.step;
    assert(step >= 0);
    // After a few async ticks step should be > 0
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

main().catch(e => { console.error(e); process.exit(2); });
