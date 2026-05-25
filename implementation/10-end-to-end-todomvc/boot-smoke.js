// boot-smoke.js
// =============================================================================
// Headless sanity check: load each kernel/runtime/app script into a shared vm
// context, verify the expected globals appear, and exercise a few kernel
// operations to catch silent-break regressions before opening in a browser.
//
// NOT a substitute for a real browser test -- there is no DOM, no
// getComputedStyle, no requestAnimationFrame, no localStorage. This proves
// only:
//   - all scripts parse and execute without throwing
//   - all expected modules attach to globalThis
//   - FieldIntakeExtension.install + Field.reset + F1 check pass
//   - deposition cascade rules append cleanly
//   - CascadeOpDispatcher registers handlers
// =============================================================================

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const HERE = __dirname;
const IMPL = path.resolve(HERE, "..");

const FILES = [
  path.join(IMPL, "kernel/field.js"),
  path.join(IMPL, "kernel/constraint-compiler.js"),
  path.join(IMPL, "kernel/cpu-oracle.js"),
  path.join(IMPL, "kernel/er-engine.js"),
  path.join(IMPL, "kernel/ct-engine.js"),
  path.join(IMPL, "08-runtime-kernel/field-intake-extension.js"),
  path.join(IMPL, "08-runtime-kernel/kernel-cascade-evaluator.js"),
  path.join(IMPL, "08-runtime-kernel/dom-bridge.js"),
  path.join(HERE, "cascade-op-dispatcher.js"),
  path.join(HERE, "deposition.js"),
  path.join(HERE, "gpu-cascade-compiler.js"),
  path.join(HERE, "gpu-cascade-runner.js"),
];

// Minimal localStorage stub for deposition.js hydration path
function makeFakeLocalStorage() {
  const store = Object.create(null);
  return {
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; },
    clear() { for (const k of Object.keys(store)) delete store[k]; }
  };
}

// Minimal document stub so deposition.js's whenReady-registered handlers
// can run without throwing (handlers only fire when ops are dispatched,
// which we don't exercise here; but the IIFE may touch document)
function makeFakeElement(tag) {
  const children = [];
  const dataset = {};
  const el = {
    tagName: tag.toUpperCase(),
    dataset: dataset,
    style: {},
    classList: { add() {}, remove() {} },
    textContent: "",
    className: "",
    type: "",
    checked: false,
    value: "",
    children: children,
    setAttribute(k, v) {
      if (k.indexOf("data-") === 0) dataset[k.substring(5)] = String(v);
      else el[k] = v;
    },
    appendChild(c) { children.push(c); return c; },
    remove() {},
    querySelector(sel) {
      if (sel === '.text') return children.find(c => c.className === "text") || null;
      if (sel === 'input[type="checkbox"]') return children.find(c => c.type === "checkbox") || null;
      return null;
    }
  };
  return el;
}
function makeFakeDocument() {
  const todoList = makeFakeElement("ul");
  const newTodoInput = makeFakeElement("input");
  const idMap = { "todo-list": todoList, "new-todo": newTodoInput, "count": makeFakeElement("span"), "footer": makeFakeElement("div"), "clear-completed": makeFakeElement("button") };
  return {
    querySelectorAll() { return []; },
    querySelector() { return null; },
    getElementById(id) { return idMap[id] || null; },
    createElement(tag) { return makeFakeElement(tag); },
    body: { dataset: {} }
  };
}

const sandbox = {
  console: console,
  setTimeout: setTimeout,
  setInterval: setInterval,
  clearTimeout: clearTimeout,
  clearInterval: clearInterval,
  performance: { now: () => Date.now() },
  localStorage: makeFakeLocalStorage(),
  document: makeFakeDocument(),
  module: undefined,  // force IIFE files to use the global fallback
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
sandbox.self = sandbox;

vm.createContext(sandbox);

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
}

let allOk = true;

for (const f of FILES) {
  try {
    const code = fs.readFileSync(f, "utf8");
    vm.runInContext(code, sandbox, { filename: f });
    record("load " + path.basename(f), true);
  } catch (e) {
    record("load " + path.basename(f), false, e.message);
    allOk = false;
  }
}

const expectedGlobals = [
  "FieldModule", "ConstraintCompiler", "CpuOracle",
  "ERengineModule", "CTengineModule",
  "FieldIntakeExtension", "KernelCascadeEvaluator", "DOMbridge",
  "CascadeOpDispatcher",
  "__DEPOSITION_CASCADE_RULES__",
  "GpuCascadeCompiler", "GpuCascadeRunner",
  "__DEPOSITION_DIMS__", "__DEPOSITION_OUTPUT_PROPERTIES__"
];

for (const g of expectedGlobals) {
  const ok = typeof sandbox[g] !== "undefined";
  record("global " + g, ok, ok ? typeof sandbox[g] : "missing");
  if (!ok) allOk = false;
}

// Exercise the boot sequence in the sandbox
try {
  vm.runInContext(`
    FieldIntakeExtension.install(FieldModule);
    var Field = FieldModule.Field;
    var SEED = FieldModule.SEED;
    Field.reset();
    if (Field.constraints.length === 0) throw new Error("seed missing");
    if (Field.constraints[0].id !== SEED.id) throw new Error("seed not at [0]");
    var rules = __DEPOSITION_CASCADE_RULES__;
    for (var i = 0; i < rules.length; i++) Field.constraints.push(rules[i]);
    if (Field.constraints[0].id !== SEED.id) throw new Error("seed displaced");
    var ER = new ERengineModule.ERengine();
    ER.state = "cpu-fallback";
    var CT = new CTengineModule.CTengine();
    CT.bind(ER, ConstraintCompiler);
    globalThis.__BOOT_RESULT__ = {
      constraints: Field.constraints.length,
      cascadeRules: rules.length,
      registeredOps: CascadeOpDispatcher.listRegistered()
    };
  `, sandbox, { filename: "boot-sequence" });
  const r = sandbox.__BOOT_RESULT__;
  record("boot sequence", true,
    "constraints=" + r.constraints + " rules=" + r.cascadeRules +
    " ops=[" + r.registeredOps.join(",") + "]");
} catch (e) {
  record("boot sequence", false, e.message);
  allOk = false;
}

// Exercise the dispatcher: publish an intake record that should match a
// rule, run the evaluator, sample --next-op, enqueue cascade-op, drain.
try {
  vm.runInContext(`
    var Field = FieldModule.Field;
    Field.intake.publish({
      type: "dom::set-attr",
      value: { trigger: "submit", "input-new-todo": "hello", "input-present": "1" },
      timestamp: performance.now(),
      source: "smoke-test"
    });
    KernelCascadeEvaluator.evaluateCascade(Field, {});
    var entry = Field.cascadeOutput["--next-op"];
    if (!entry || entry.value !== "add-todo") {
      throw new Error("expected --next-op=add-todo, got " + JSON.stringify(entry));
    }
    var CT = new CTengineModule.CTengine();
    CT.bind(new ERengineModule.ERengine(), ConstraintCompiler);
    CT.enqueueInternal("cascade-op", {
      op: entry.value,
      sourceConstraintId: entry.sourceConstraintId,
      observedAtStep: entry.atStep
    });
    var preDrain = Field.ctPendingOps.length;
    var result = CascadeOpDispatcher.drainCascadeOps(Field);
    var postDrain = Field.ctPendingOps.length;
    globalThis.__DRAIN_RESULT__ = {
      preDrain: preDrain,
      postDrain: postDrain,
      drained: result.drained,
      dispatched: result.dispatched,
      errors: result.errors,
      nextOp: entry.value
    };
  `, sandbox, { filename: "dispatch-sequence" });
  const r = sandbox.__DRAIN_RESULT__;
  const ok = r.drained === 1 && r.dispatched === 1 && r.errors.length === 0;
  record("cascade -> dispatch", ok,
    "preDrain=" + r.preDrain + " postDrain=" + r.postDrain +
    " drained=" + r.drained + " dispatched=" + r.dispatched +
    " errors=" + JSON.stringify(r.errors));
  if (!ok) allOk = false;
} catch (e) {
  record("cascade -> dispatch", false, e.message);
  allOk = false;
}

// Exercise the GPU compiler against the same cascade rules. We can't run
// the shader in Node (no WebGPU), but we can verify the compiler emits a
// well-formed instruction stream and that the coord-index math agrees
// with the dim spec.
try {
  vm.runInContext(`
    var dims = __DEPOSITION_DIMS__;
    var outputProps = __DEPOSITION_OUTPUT_PROPERTIES__;
    if (!dims || !outputProps) throw new Error("deposition globals missing");
    var compiled = GpuCascadeCompiler.compile(__DEPOSITION_CASCADE_RULES__, dims, outputProps);
    if (compiled.stats.ruleCount !== __DEPOSITION_CASCADE_RULES__.length) {
      throw new Error("ruleCount mismatch: got " + compiled.stats.ruleCount + " expected " + __DEPOSITION_CASCADE_RULES__.length);
    }
    if (compiled.instructions.length === 0) {
      throw new Error("no instructions emitted");
    }
    // Each output slot has its own intern table, with slot 0 = "" default.
    for (var s = 0; s < outputProps.length; s++) {
      if (compiled.outputs.opTables[s][0] !== "") {
        throw new Error("opTable["+s+"][0] must be empty default");
      }
    }
    // --next-op table contains the new op names
    var nextOpTable = compiled.outputs.opTables[compiled.outputs.slotByProperty["--next-op"]];
    var expectedOps = ["add-todo","complete-todo","uncomplete-todo","delete-todo","clear-completed","set-filter"];
    for (var i = 0; i < expectedOps.length; i++) {
      if (nextOpTable.indexOf(expectedOps[i]) < 0) {
        throw new Error("nextOp table missing: " + expectedOps[i]);
      }
    }
    // --todo-visible table contains "0" and "1"
    var visTable = compiled.outputs.opTables[compiled.outputs.slotByProperty["--todo-visible"]];
    if (visTable.indexOf("0") < 0 || visTable.indexOf("1") < 0) {
      throw new Error("visible table missing 0 or 1");
    }
    // coord-index sanity: all-defaults coord is index 0
    var idx0 = GpuCascadeCompiler.coordToIndex({
      trigger: "", filter: "all", completed: "none",
      "target-completed": "none", "input-present": "0"
    }, dims);
    if (idx0 !== 0) throw new Error("default coord should be index 0, got " + idx0);
    globalThis.__GPU_COMPILE_RESULT__ = {
      ruleCount: compiled.stats.ruleCount,
      totalInstructions: compiled.stats.totalInstructions,
      perRule: compiled.stats.perRule,
      stateSpaceSize: compiled.stateSpaceSize,
      nextOpTable: nextOpTable,
      visTable: visTable
    };
  `, sandbox, { filename: "gpu-compile-sequence" });
  const r = sandbox.__GPU_COMPILE_RESULT__;
  record("gpu compiler", true,
    "rules=" + r.ruleCount + " insts=" + r.totalInstructions +
    " coords=" + r.stateSpaceSize +
    " next-ops=[" + r.nextOpTable.join(",") + "]" +
    " vis=[" + r.visTable.join(",") + "]");
} catch (e) {
  record("gpu compiler", false, e.message);
  allOk = false;
}

// Report
const PAD = 36;
for (const r of results) {
  const tag = r.ok ? "[PASS]" : "[FAIL]";
  const detail = r.detail ? "  -- " + r.detail : "";
  console.log(tag + " " + (r.name + " ").padEnd(PAD) + detail);
}
console.log("");
console.log(allOk ? "ALL OK" : "FAILURES");
process.exit(allOk ? 0 : 1);
