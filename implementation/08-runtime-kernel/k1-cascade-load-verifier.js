// k1-cascade-load-verifier.js - K1 acceptance criterion 2

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const Emitter = require("./kernel-runtime-emitter.js");
const Synth = require("./cascade-rule-synthesizer.js");

const TODOMVC_CASCADE = [
  '[data-substrate-state][data-trigger="toggle"] { --next-op: "toggleTodo"; }',
  '[data-substrate-state][data-trigger="delete"] { --next-op: "deleteTodo"; }',
  '[data-substrate-state][data-trigger="submit"][data-input-present="1"] { --next-op: "addTodo"; }',
  '[data-substrate-state][data-trigger="clear-completed"] { --next-op: "clearCompleted"; }'
].join("\n");

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

async function main() {
  console.log("k1-cascade-load verification (criterion 2)");
  console.log("");

  console.log("PART A: emitter produces deposition with cascade rules");
  console.log("");

  let html;

  test("emit() accepts cascadeRules CSS string", () => {
    html = Emitter.emit({ cascadeRules: TODOMVC_CASCADE });
    assert(typeof html === "string");
    assert(html.length > 1000);
  });

  test("ASCII-only (I1)", () => {
    const m = html.match(/[^\x00-\x7F]/);
    assert(!m, "non-ASCII found: " + (m && m[0]));
  });

  test("APPLICATION section contains __DEPOSITION_CASCADE_RULES__ global", () => {
    assert(html.indexOf("__DEPOSITION_CASCADE_RULES__") >= 0);
    // Must be inside the APPLICATION section
    const startIdx = html.indexOf("=== APPLICATION ===");
    const endIdx = html.indexOf("=== END APPLICATION ===");
    assert(startIdx >= 0 && endIdx > startIdx);
    const appSection = html.substring(startIdx, endIdx);
    assert(appSection.indexOf("__DEPOSITION_CASCADE_RULES__") >= 0,
      "global declared in app section");
  });

  test("Cascade constraints embedded in JSON form", () => {
    assert(html.indexOf('"id": "deposit::1"') >= 0 ||
           html.indexOf('"id":"deposit::1"') >= 0);
    assert(html.indexOf('"kind": "derived"') >= 0 ||
           html.indexOf('"kind":"derived"') >= 0);
    assert(html.indexOf('"type": "cascade-match"') >= 0 ||
           html.indexOf('"type":"cascade-match"') >= 0);
  });

  test("Original CSS embedded in <style> for browser cascade", () => {
    // Per emitter: the CSS substrate evaluates same geometry the kernel does;
    // both must be present for S2 cross-substrate verification.
    assert(html.indexOf('[data-substrate-state]') >= 0);
    assert(html.indexOf('--next-op') >= 0);
    assert(html.indexOf('"toggleTodo"') >= 0);
  });

  test("Section markers preserved (kernel runtime / application)", () => {
    assert(html.indexOf("=== KERNEL RUNTIME ===") >= 0);
    assert(html.indexOf("=== END KERNEL RUNTIME ===") >= 0);
    assert(html.indexOf("=== APPLICATION ===") >= 0);
    assert(html.indexOf("=== END APPLICATION ===") >= 0);
  });

  test("No host APIs in application section", () => {
    const startIdx = html.indexOf("=== APPLICATION ===");
    const endIdx = html.indexOf("=== END APPLICATION ===");
    const appSection = html.substring(startIdx, endIdx);
    assert(appSection.indexOf("Date.now") < 0, "no Date.now");
    assert(appSection.indexOf("localStorage") < 0, "no localStorage");
    assert(appSection.indexOf("fetch(") < 0, "no fetch");
    assert(appSection.indexOf("setTimeout") < 0, "no setTimeout in app");
  });

  console.log("");
  console.log("PART B: SKELETON_INIT loads cascade rules, F1 preserved");
  console.log("");

  // Set up a sandbox per K1 emitter verifier
  const sandbox = {
    console: console, setTimeout: setTimeout, setImmediate: setImmediate,
    Promise: Promise, Object: Object, Array: Array, Math: Math, JSON: JSON,
    Uint32Array: Uint32Array, Float64Array: Float64Array,
    Float32Array: Float32Array, Uint8Array: Uint8Array,
    Map: Map, Set: Set, Error: Error, TypeError: TypeError,
    RangeError: RangeError, String: String, Number: Number,
    Boolean: Boolean, Date: Date,
    performance: { now: () => Date.now() },
    document: { getElementById: () => ({ textContent: "" }) },
    navigator: { gpu: null }
  };
  sandbox.globalThis = sandbox;
  sandbox.global = sandbox;
  sandbox.window = sandbox;
  vm.createContext(sandbox);

  // Load kernel files
  const kernelDir = path.join(__dirname, "kernel-src");
  for (const f of Emitter.KERNEL_FILES) {
    const src = fs.readFileSync(path.join(kernelDir, f), "utf8");
    vm.runInContext(src, sandbox, { filename: f });
  }

  // Synthesize cascade constraints and inject the global
  const synthResult = Synth.synthesizeFromCss(TODOMVC_CASCADE);
  vm.runInContext(
    "globalThis.__DEPOSITION_CASCADE_RULES__ = " +
      JSON.stringify(synthResult.constraints) + ";",
    sandbox, { filename: "cascade-rules-load" }
  );

  // Run skeleton init
  test("SKELETON_INIT runs without error with cascade rules in scope", () => {
    vm.runInContext(Emitter.SKELETON_INIT, sandbox, { filename: "skeleton-init" });
  });

  test("F1: seed at Field.constraints[0] (post-load)", () => {
    const c0 = sandbox.substrate.field.constraints[0];
    assert(c0.id === sandbox.substrate.seed.id, "seed id at [0]");
    assert(c0.kind === "seed", "seed kind at [0]");
    assert(c0.permanent === true, "seed permanent");
  });

  test("Total constraint count = 1 seed + 4 cascade rules", () => {
    assert(sandbox.substrate.field.constraints.length === 5,
      "expected 5 constraints, got " + sandbox.substrate.field.constraints.length);
  });

  test("constraints[1..4] are derived cascade-match constraints", () => {
    for (let i = 1; i <= 4; i++) {
      const c = sandbox.substrate.field.constraints[i];
      assert(c, "constraint " + i + " exists");
      assert(c.kind === "derived",
        "[" + i + "] kind=derived (got " + c.kind + ")");
      assert(c.pattern && c.pattern.type === "cascade-match",
        "[" + i + "] pattern.type=cascade-match");
      assert(c.pattern.selector,
        "[" + i + "] has selector map");
      assert(c.emit && c.emit.property === "--next-op",
        "[" + i + "] emit.property=--next-op");
    }
  });

  test("First cascade rule: toggle -> toggleTodo", () => {
    const c1 = sandbox.substrate.field.constraints[1];
    assert(c1.pattern.selector["data-trigger"] === "toggle");
    assert(c1.emit.value === "toggleTodo");
  });

  test("Third cascade rule has multi-attribute selector", () => {
    const c3 = sandbox.substrate.field.constraints[3];
    assert(c3.pattern.selector["data-trigger"] === "submit");
    assert(c3.pattern.selector["data-input-present"] === "1");
    assert(c3.emit.value === "addTodo");
  });

  test("substrate handle reports cascadeRuleCount = 4", () => {
    assert(sandbox.substrate.cascadeRuleCount === 4,
      "cascadeRuleCount=" + sandbox.substrate.cascadeRuleCount);
  });

  test("Engines wire correctly with cascade rules loaded", () => {
    assert(sandbox.substrate.ct);
    assert(sandbox.substrate.er);
    assert(sandbox.substrate.ct.erBinding === sandbox.substrate.er,
      "CT bound to ER");
  });

  console.log("");
  console.log("==========================================================");
  console.log("Summary: " + pass + " passed, " + fail + " failed");
  if (fail > 0) {
    console.log("");
    for (const f of failures) {
      console.log("  - " + f.name);
      console.log("    " + (f.error.stack || f.error.message));
    }
    process.exit(1);
  }
}

main().then(() => {
  process.exit(fail > 0 ? 1 : 0);
}).catch(e => {
  console.error("Fatal error:", e);
  process.exit(2);
});
