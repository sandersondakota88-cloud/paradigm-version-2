// f1-pemission-closure-verifier.js - Phase 9 F1: P-layer emission closure

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const Emitter = require("./kernel-runtime-emitter.js");
const Closure = require("./p8-closure-verifier.js");
const F1Harness = require("./f1-cascade-harness.js");
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

// ----------------------------------------------------------------------------
// Cascade rule strings used in P2 and P8 verifiers (lifted verbatim so
// closure-check operates on the same emission shape the verifiers test).
// ----------------------------------------------------------------------------

const P2_AUTH_CASCADE_CSS = [
  '[data-substrate-state][data-session-validity="valid"][data-user-role="admin"][data-target="user-edit"] { --next-op: "openUserEditor"; }',
  '[data-substrate-state][data-session-validity="valid"][data-user-role="admin"][data-target="user-edit"][data-user-role="manager"] { --next-op: "openUserEditor"; }',
  '[data-substrate-state][data-session-validity="valid"][data-target="contact-list"] { --next-op: "showContactList"; }'
].join("\n");

const P8_PER_FIELD_CASCADE_CSS = [
  '[data-substrate-state][data-field-email-format="invalid"] { --field-email-validity: "invalid"; }',
  '[data-substrate-state][data-field-email-format="valid"] { --field-email-validity: "valid"; }',
  '[data-substrate-state][data-field-name-length-ok="1"] { --field-name-validity: "valid"; }',
  '[data-substrate-state][data-field-name-length-ok="0"] { --field-name-validity: "invalid"; }'
].join("\n");

// ----------------------------------------------------------------------------
// DOM mock (lifted from k1-deposition-boot-verifier.js shape; minimal)
// ----------------------------------------------------------------------------

function makeElement(tag, id) {
  const attrs = {};
  const listeners = {};
  const children = [];
  return {
    tagName: tag, id: id || "", attrs, children, listeners,
    setAttribute(name, value) { attrs[name] = String(value); },
    getAttribute(name) { return attrs.hasOwnProperty(name) ? attrs[name] : null; },
    hasAttribute(name) { return attrs.hasOwnProperty(name); },
    removeAttribute(name) { delete attrs[name]; },
    addEventListener(t, h) { (listeners[t] = listeners[t] || []).push(h); },
    removeEventListener(t, h) {
      const arr = listeners[t]; if (!arr) return;
      const i = arr.indexOf(h); if (i >= 0) arr.splice(i, 1);
    },
    dispatchEvent(e) {
      const arr = listeners[e.type]; if (!arr) return;
      for (const h of arr) { try { h(e); } catch (err) {} }
    },
    appendChild(c) { children.push(c); return c; },
    querySelectorAll(sel) {
      const out = [];
      function walk(n) {
        if (!n) return;
        if (matchesSelector(n, sel)) out.push(n);
        for (const c of (n.children || [])) walk(c);
      }
      walk(this); return out;
    },
    querySelector(sel) {
      const all = this.querySelectorAll(sel);
      return all.length > 0 ? all[0] : null;
    }
  };
}

function matchesSelector(el, sel) {
  // Sufficient subset for what the deposition queries:
  //   "[data-substrate-state]"  - has attribute
  //   "[data-trigger]"          - has attribute
  if (!el || !el.attrs) return false;
  const m = sel.match(/^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/);
  if (!m) return false;
  const attr = m[1], val = m[2];
  if (val === undefined) return el.attrs.hasOwnProperty(attr);
  return el.attrs[attr] === val;
}

function makeDocument() {
  const elementsById = {};
  const stateEl = makeElement("div", "substrate-state");
  stateEl.setAttribute("data-substrate-state", "");
  elementsById["substrate-state"] = stateEl;

  const body = makeElement("body", "");
  body.appendChild(stateEl);

  // Status display elements that the deposition's status-poller reads
  for (const id of ["tick-count", "field-step", "constraint-count",
                    "seed-ok", "scalar-delta", "fast-delta", "slow-delta",
                    "gap", "trace-len"]) {
    const e = makeElement("span", id);
    body.appendChild(e);
    elementsById[id] = e;
  }

  return {
    body,
    documentElement: body,
    getElementById(id) { return elementsById[id] || null; },
    querySelector(sel) {
      if (sel === "[data-substrate-state]") return stateEl;
      return body.querySelector(sel);
    },
    querySelectorAll(sel) { return body.querySelectorAll(sel); },
    addEventListener() {},
    removeEventListener() {},
    createEvent() { return makeEvent("Event", {}); }
  };
}

function makeEvent(type, opts) {
  return Object.assign({ type, defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() {}
  }, opts || {});
}

function extractScripts(html) {
  const scripts = [];
  const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) scripts.push(m[1]);
  return scripts;
}

// ----------------------------------------------------------------------------
// Boot a deposition in a sandbox; return {sandbox, document}.
// ----------------------------------------------------------------------------
function bootDeposition(html) {
  const doc = makeDocument();
  const sandbox = {
    console, setTimeout, setImmediate, Promise,
    Object, Array, Math, JSON,
    Uint32Array, Float64Array, Float32Array, Uint8Array,
    Map, Set, Error, TypeError, RangeError,
    String, Number, Boolean, Date,
    performance: { now: () => Date.now() },
    document: doc,
    navigator: { gpu: null }
  };
  sandbox.globalThis = sandbox; sandbox.global = sandbox; sandbox.window = sandbox;
  vm.createContext(sandbox);

  const scripts = extractScripts(html);
  for (let i = 0; i < scripts.length; i++) {
    try {
      vm.runInContext(scripts[i], sandbox, { filename: "script-" + i });
    } catch (e) {
      throw new Error("script " + i + " failed: " + e.message);
    }
  }

  return { sandbox, document: doc };
}

// ----------------------------------------------------------------------------
// Project a coord state onto the deposition's state element by manually
// publishing intake records (same shape the bridge produces). Then wait
// for the tick loop to run the cascade.
// ----------------------------------------------------------------------------
async function projectCoordsAndSettle(boot, coords) {
  const value = {};
  for (const k of Object.keys(coords)) {
    const bare = k.indexOf("data-") === 0 ? k.substring(5) : k;
    value[bare] = String(coords[k]);
  }
  boot.sandbox.substrate.field.intake.publish({
    type: "dom::harness",
    value: value,
    timestamp: 0,
    source: "f1-emission-closure-verifier"
  });
  // Let the deposition's tick loop run a few times
  await new Promise(r => setTimeout(r, 80));
}

// ============================================================================
// PART A: closure verifier passes on P-layer emissions
// ============================================================================

console.log("f1-pemission-closure verification");
console.log("");
console.log("PART A: sec 3.1 closure on P-layer cascade emissions");
console.log("");

test("P2 auth cascade emission: closure passes (M2 criterion 2)", () => {
  const html = Emitter.emit({ cascadeRules: P2_AUTH_CASCADE_CSS });
  const tmp = path.join(__dirname, "_tmp_p2_emission.html");
  fs.writeFileSync(tmp, html, "utf8");
  const r = Closure.verify(tmp, { verbose: false });
  fs.unlinkSync(tmp);
  assert(r.ok, "closure violations: " + JSON.stringify(r.violationDetails));
  assert(r.violations === 0);
  assert(r.kernelRange);
  assert(r.appRange);
});

test("P8 per-field cascade emission: closure passes", () => {
  const html = Emitter.emit({ cascadeRules: P8_PER_FIELD_CASCADE_CSS });
  const tmp = path.join(__dirname, "_tmp_p8_emission.html");
  fs.writeFileSync(tmp, html, "utf8");
  const r = Closure.verify(tmp, { verbose: false });
  fs.unlinkSync(tmp);
  assert(r.ok, "violations: " + JSON.stringify(r.violationDetails));
  assert(r.violations === 0);
});

test("Combined P2 + P8 cascade emission: closure passes", () => {
  const combined = P2_AUTH_CASCADE_CSS + "\n" + P8_PER_FIELD_CASCADE_CSS;
  const html = Emitter.emit({ cascadeRules: combined });
  const tmp = path.join(__dirname, "_tmp_combined_emission.html");
  fs.writeFileSync(tmp, html, "utf8");
  const r = Closure.verify(tmp, { verbose: false });
  fs.unlinkSync(tmp);
  assert(r.ok);
});

// ============================================================================
// PART B: sandbox-boot P-layer emissions, project coords, verify cascade
// ============================================================================

console.log("");
console.log("PART B: sandbox-boot P-layer emissions, project coords through bridge");
console.log("");

(async function() {
  await asyncTest("P2 deposition + admin/valid/user-edit -> --next-op = openUserEditor", async () => {
    const html = Emitter.emit({ cascadeRules: P2_AUTH_CASCADE_CSS });
    const boot = bootDeposition(html);
    // The deposition installed substrate; field has seed + 3 cascade rules.
    assert(boot.sandbox.substrate, "substrate booted");
    assert(boot.sandbox.substrate.field.constraints.length === 4,
      "seed + 3 P2 rules; got " + boot.sandbox.substrate.field.constraints.length);

    await projectCoordsAndSettle(boot, {
      "data-session-validity": "valid",
      "data-user-role": "admin",
      "data-target": "user-edit"
    });

    const co = boot.sandbox.substrate.field.cascadeOutput || {};
    const next = co["--next-op"];
    assert(next, "cascadeOutput[--next-op] populated; got " + JSON.stringify(co));
    assert(next.value === "openUserEditor",
      "expected openUserEditor; got " + next.value);
  });

  await asyncTest("P2 deposition + non-admin/valid/user-edit -> no match (cascade silent)", async () => {
    const html = Emitter.emit({ cascadeRules: P2_AUTH_CASCADE_CSS });
    const boot = bootDeposition(html);

    await projectCoordsAndSettle(boot, {
      "data-session-validity": "valid",
      "data-user-role": "rep",
      "data-target": "user-edit"
    });

    const co = boot.sandbox.substrate.field.cascadeOutput || {};
    const next = co["--next-op"];
    // No rule matches -> cascadeOutput either has no --next-op OR has it
    // from a prior tick that didn't match either. Accept null, undefined,
    // or absent.
    if (next) {
      assert(next.value !== "openUserEditor",
        "non-admin should NOT trigger openUserEditor; got " + next.value);
    }
  });

  await asyncTest("P2 deposition + viewer/valid/contact-list -> showContactList", async () => {
    const html = Emitter.emit({ cascadeRules: P2_AUTH_CASCADE_CSS });
    const boot = bootDeposition(html);

    await projectCoordsAndSettle(boot, {
      "data-session-validity": "valid",
      "data-user-role": "viewer",
      "data-target": "contact-list"
    });

    const co = boot.sandbox.substrate.field.cascadeOutput || {};
    const next = co["--next-op"];
    assert(next, "cascadeOutput populated");
    assert(next.value === "showContactList", "got " + next.value);
  });

  // ===========================================================================
  // PART C: deposition cascade result agrees with F1Harness for same inputs
  // ===========================================================================

  console.log("");
  console.log("PART C: deposition cascade agrees with F1Harness");
  console.log("");

  await asyncTest("admin/valid/user-edit: deposition --next-op === harness --next-op", async () => {
    const r = Synth.synthesizeFromCss(P2_AUTH_CASCADE_CSS);
    assert(r.ok);
    const harnessCoords = {
      "data-substrate-state": "",
      "data-session-validity": "valid",
      "data-user-role": "admin",
      "data-target": "user-edit"
    };
    const harnessResult = F1Harness.runCascade(r.constraints, harnessCoords);

    const html = Emitter.emit({ cascadeRules: P2_AUTH_CASCADE_CSS });
    const boot = bootDeposition(html);
    await projectCoordsAndSettle(boot, harnessCoords);
    const depositionNext = boot.sandbox.substrate.field.cascadeOutput["--next-op"];

    assert(depositionNext, "deposition cascadeOutput populated");
    assert(harnessResult.currentNextOp === depositionNext.value,
      "harness=" + harnessResult.currentNextOp + " deposition=" + depositionNext.value);
  });

  await asyncTest("rep/valid/user-edit: harness no-match agrees with deposition no-match", async () => {
    const r = Synth.synthesizeFromCss(P2_AUTH_CASCADE_CSS);
    const harnessCoords = {
      "data-substrate-state": "",
      "data-session-validity": "valid",
      "data-user-role": "rep",
      "data-target": "user-edit"
    };
    const harnessResult = F1Harness.runCascade(r.constraints, harnessCoords);
    assert(harnessResult.currentNextOp === null,
      "harness should report no match; got " + harnessResult.currentNextOp);

    const html = Emitter.emit({ cascadeRules: P2_AUTH_CASCADE_CSS });
    const boot = bootDeposition(html);
    await projectCoordsAndSettle(boot, harnessCoords);
    const depositionNext = boot.sandbox.substrate.field.cascadeOutput["--next-op"];
    if (depositionNext) {
      assert(depositionNext.value !== "openUserEditor",
        "deposition should agree with harness (no openUserEditor); got " + depositionNext.value);
    }
  });

  await asyncTest("P8 valid email coord -> deposition emits --field-email-validity=valid", async () => {
    const html = Emitter.emit({ cascadeRules: P8_PER_FIELD_CASCADE_CSS });
    const boot = bootDeposition(html);
    await projectCoordsAndSettle(boot, {
      "data-field-email-format": "valid"
    });
    const co = boot.sandbox.substrate.field.cascadeOutput || {};
    const v = co["--field-email-validity"];
    assert(v, "field-email-validity populated; got cascadeOutput=" + JSON.stringify(Object.keys(co)));
    assert(v.value === "valid", "got " + v.value);
  });

  // ===========================================================================
  // PART D: closure
  // ===========================================================================

  console.log("");
  console.log("PART D: closure");
  console.log("");

  test("f1-pemission-closure-verifier.js: ASCII-only", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "f1-pemission-closure-verifier.js"), "utf8");
    const m = src.match(/[^\x00-\x7F]/);
    assert(!m, "non-ASCII: " + (m && m[0]));
  });

  test("Closure.FORBIDDEN_PATTERNS still 11 (Phase 7 sec 3.1 bound)", () => {
    assert(Closure.FORBIDDEN_PATTERNS.length === 11,
      "got " + Closure.FORBIDDEN_PATTERNS.length);
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
})().catch(e => { console.error("Fatal:", e); process.exit(2); });
