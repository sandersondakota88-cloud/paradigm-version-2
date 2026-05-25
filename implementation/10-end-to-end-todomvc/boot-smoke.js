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
    // --substrate-mode table contains the three bands
    var modeTable = compiled.outputs.opTables[compiled.outputs.slotByProperty["--substrate-mode"]];
    var expectedModes = ["settled","transitioning","reaching"];
    for (var mi = 0; mi < expectedModes.length; mi++) {
      if (modeTable.indexOf(expectedModes[mi]) < 0) {
        throw new Error("substrate-mode table missing: " + expectedModes[mi]);
      }
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

// Exercise the GPU reduction primitives against a synthetic resolved
// field. We can't run the shader in Node, but we can:
//   1. compile the deposition rules to bytecode (real compiler)
//   2. CPU-walk that bytecode for every coord (mirroring what the shader
//      does, in JS) to produce a synthetic latestResult
//   3. run the pure reduction helpers on it
//   4. check counts against what we know about the deposition geometry
try {
  vm.runInContext(`
    var dims = __DEPOSITION_DIMS__;
    var outputProps = __DEPOSITION_OUTPUT_PROPERTIES__;
    var compiled = GpuCascadeCompiler.compile(__DEPOSITION_CASCADE_RULES__, dims, outputProps);

    // --- CPU walker that mirrors resolve-deposition.wgsl per-coord logic ---
    function unpackCoord(linearIdx) {
      var out = new Array(dims.length);
      var rem = linearIdx;
      for (var d = dims.length - 1; d >= 0; d--) {
        var card = dims[d].values.length;
        out[d] = rem % card;
        rem = (rem - out[d]) / card;
      }
      return out;
    }
    function resolveCoordOnCpu(coordIdx) {
      var coord = unpackCoord(coordIdx);
      var slots = [0,0,0,0]; var matched = 0;
      var stack = []; var sp = 0; var skipping = false; var pc = 0;
      while (pc < compiled.instructions.length) {
        var inst = compiled.instructions[pc];
        var op = inst & 0xFF;
        var a = (inst >>> 8) & 0xFF;
        var b = (inst >>> 16) & 0xFF;
        if (skipping) {
          if (op === 0xFF) skipping = false;
          pc++; continue;
        }
        if (op === 0x01) {           // MATCH_DIM
          stack[sp++] = (coord[a] === b) ? 1 : 0;
        } else if (op === 0x02) {    // AND
          stack[sp - 2] = stack[sp - 2] & stack[sp - 1]; sp--;
        } else if (op === 0x10) {    // BEGIN_THEN
          sp--; var cond = stack[sp];
          if (cond === 0) skipping = true;
        } else if (op === 0x12) {    // SET_OUTPUT
          slots[a] = b; matched++;
        } else if (op === 0xFF) {
          /* END_RULE */
        }
        pc++;
      }
      return { slots: slots, matched: matched };
    }

    // Build synthetic latestResult shape
    var n = compiled.stateSpaceSize;
    var slotsByCoord = [
      new Uint32Array(n), new Uint32Array(n),
      new Uint32Array(n), new Uint32Array(n)
    ];
    var matchedByCoord = new Uint32Array(n);
    for (var i = 0; i < n; i++) {
      var r = resolveCoordOnCpu(i);
      for (var s = 0; s < 4; s++) slotsByCoord[s][i] = r.slots[s];
      matchedByCoord[i] = r.matched;
    }
    var synthLatest = {
      tick: 1, slotsByCoord: slotsByCoord, matchedByCoord: matchedByCoord
    };

    // --- Run the pure reductions ---
    var counts = GpuCascadeRunner.pureCountByValue(synthLatest, compiled.outputs, "--next-op");
    var visCounts = GpuCascadeRunner.pureCountByValue(synthLatest, compiled.outputs, "--todo-visible");
    var matched = GpuCascadeRunner.pureMatchedCoordCount(synthLatest);
    var hidden = GpuCascadeRunner.pureCoordsMatching(
      synthLatest, compiled.outputs, "--todo-visible", "0",
      GpuCascadeRunner.makeCoordFromIndex(dims)
    );

    // --- Checks ---
    // Total counts add up to stateSpaceSize for each property
    var totalNext = 0; for (var k in counts) totalNext += counts[k];
    if (totalNext !== n) throw new Error("--next-op counts don't sum to " + n + ": " + JSON.stringify(counts));
    var totalVis = 0; for (var k2 in visCounts) totalVis += visCounts[k2];
    if (totalVis !== n) throw new Error("--todo-visible counts don't sum to " + n);

    // Density bound: at most n coords matched
    if (matched.matched + matched.unmatched !== n) {
      throw new Error("matched+unmatched != total");
    }

    // Specific geometric fact: --next-op=clear-completed should fire at
    // every coord where trigger=clear-completed (regardless of other dims)
    var triggerIdx = -1;
    for (var di = 0; di < dims.length; di++) if (dims[di].name === "trigger") triggerIdx = di;
    var clearTriggerValIdx = dims[triggerIdx].values.indexOf("clear-completed");
    var dimsAfterTrigger = dims.slice(triggerIdx + 1)
      .reduce(function (acc, d) { return acc * d.values.length; }, 1);
    var expectedClearCount = dimsAfterTrigger;
    if (counts["clear-completed"] !== expectedClearCount) {
      throw new Error("expected clear-completed count " + expectedClearCount +
                      ", got " + counts["clear-completed"]);
    }

    // Hidden coords: --todo-visible=0 fires for (filter=active,completed=1)
    // and (filter=completed,completed=0). Each combination is 1*1*1 along
    // (filter, completed) times the cardinality of remaining dims
    // (trigger, target-completed, input-present, gap-band).
    var hiddenExpected = 2 * 6 * 3 * 2 * 3;  // 2 combos * 6 triggers * 3 target-completed * 2 input-present * 3 gap-band
    if (hidden.length !== hiddenExpected) {
      throw new Error("hidden coords mismatch: expected " + hiddenExpected + ", got " + hidden.length);
    }

    globalThis.__REDUCTIONS_RESULT__ = {
      stateSpaceSize: n,
      matchedCount: matched.matched,
      nextOpCounts: counts,
      visibleCounts: visCounts,
      hiddenCount: hidden.length
    };
  `, sandbox, { filename: "reductions-sequence" });
  const r = sandbox.__REDUCTIONS_RESULT__;
  record("gpu reductions", true,
    "coords=" + r.stateSpaceSize + " matched=" + r.matchedCount +
    " hidden=" + r.hiddenCount +
    " nextOps=" + JSON.stringify(Object.fromEntries(Object.entries(r.nextOpCounts).filter(([k,v])=>k!=="" && v > 0))));
} catch (e) {
  record("gpu reductions", false, e.message);
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
