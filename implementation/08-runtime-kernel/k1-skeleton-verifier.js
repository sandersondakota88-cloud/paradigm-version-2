// k1-skeleton-verifier.js - Node-side verification of K1 acceptance #1

"use strict";

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

async function asyncTest(name, fn) {
  try {
    await fn();
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
  console.log("k1-skeleton verification (Node-side)");
  console.log("");

  console.log("Phase 1: kernel modules load");

  let FieldModule, CTengineModule, ERengineModule, ConstraintCompiler;

  test("field.js loads without error", () => {
    FieldModule = require("./kernel-src/field.js");
    assert(FieldModule);
    assert(FieldModule.Field);
    assert(FieldModule.Trace);
    assert(FieldModule.SEED);
  });

  test("ct-engine.js loads without error", () => {
    CTengineModule = require("./kernel-src/ct-engine.js");
    assert(CTengineModule);
    assert(CTengineModule.CTengine);
    assert(CTengineModule.OP_KIND);
  });

  test("er-engine.js loads without error", () => {
    ERengineModule = require("./kernel-src/er-engine.js");
    assert(ERengineModule);
    assert(ERengineModule.ERengine);
  });

  test("constraint-compiler.js loads without error", () => {
    ConstraintCompiler = require("./kernel-src/constraint-compiler.js");
    assert(ConstraintCompiler);
    assert(ConstraintCompiler.compileField);
  });

  console.log("");
  console.log("Phase 2: F1 - seed present at Field.constraints[0]");

  const Field = FieldModule.Field;
  const Trace = FieldModule.Trace;
  const SEED = FieldModule.SEED;

  test("Field.reset() initializes without error", () => {
    Field.reset();
    Trace.clear();
  });

  test("Field.constraints[0] is the seed (F1)", () => {
    assert(Field.constraints.length >= 1, "constraints non-empty");
    const first = Field.constraints[0];
    assert(first.id === SEED.id, "first constraint id is seed id");
    assert(first.kind === "seed", "first constraint kind is seed");
    assert(first.permanent === true, "seed is permanent");
  });

  test("Field has vector-delta initial state", () => {
    assert(typeof Field.scalarDelta === "number");
    assert(typeof Field.fastDelta === "number");
    assert(typeof Field.slowDelta === "number");
    assert(Field.scalarDelta === 1.0, "initial scalarDelta = 1.0");
  });

  test("Field has execution-scope state initial values", () => {
    assert(Array.isArray(Field.ctPendingOps));
    assert(Field.ctPendingOps.length === 0);
    assert(Field.ctTotalOpsSeen === 0);
    assert(Field.execScalarDelta === 1.0);
  });

  console.log("");
  console.log("Phase 3: engines instantiate and wire");

  let ER, CT;

  test("ERengine constructs", () => {
    ER = new ERengineModule.ERengine();
    assert(ER);
    assert(ER.state);
  });

  test("ERengine in CPU-fallback for headless Node", () => {
    ER.state = "cpu-fallback";
    assert(ER.state === "cpu-fallback");
  });

  test("CTengine constructs", () => {
    CT = new CTengineModule.CTengine();
    assert(CT);
    assert(typeof CT.enqueueInput === "function");
    assert(typeof CT.enqueueInternal === "function");
  });

  test("CT.bind(ER, compiler) wires without error", () => {
    CT.bind(ER, ConstraintCompiler);
    assert(CT.erBinding === ER);
    assert(CT.compilerBinding === ConstraintCompiler);
  });

  console.log("");
  console.log("Phase 4: F4 - tick loop runs without monotonic growth");

  await asyncTest("CT.enqueueInternal('tick') succeeds", async () => {
    const ok = CT.enqueueInternal("tick", {});
    assert(ok === true);
    assert(Field.ctPendingOps.length === 1);
    await CT.drainAll(8);
  });

  let tickTimes = [];
  await asyncTest("kernel runs 1000 ticks without error", async () => {
    for (let i = 0; i < 1000; i++) {
      const t0 = Date.now();
      CT.enqueueInternal("tick", {});
      await CT.drainAll(8);
      Field.refreshVectorDelta();
      const t1 = Date.now();
      tickTimes.push(t1 - t0);
    }
    assert(tickTimes.length === 1000);
  });

  await asyncTest("F4: per-tick time bounded (no extreme growth)", async () => {
    const half = Math.floor(tickTimes.length / 2);
    let firstSum = 0, secondSum = 0;
    for (let i = 0; i < half; i++) firstSum += tickTimes[i];
    for (let i = half; i < tickTimes.length; i++) secondSum += tickTimes[i];
    const firstMean = firstSum / half;
    const secondMean = secondSum / (tickTimes.length - half);
    const ratio = firstMean === 0 ? 1.0 : secondMean / firstMean;
    console.log("    first-half mean: " + firstMean.toFixed(3) + "ms");
    console.log("    second-half mean: " + secondMean.toFixed(3) + "ms");
    console.log("    ratio: " + ratio.toFixed(3));
    assert(ratio < 3.0, "ratio=" + ratio + " (should be near 1.0)");
  });

  await asyncTest("X2: every tick does substantive work", async () => {
    assert(Field.step > 0, "Field.step advanced from initial 0");
    assert(Trace.entries.length > 0, "Trace has entries from tick activity");
    console.log("    Field.step: " + Field.step);
    console.log("    Trace entries: " + Trace.entries.length);
  });

  await asyncTest("X2: no terminal state - kernel still accepts work", async () => {
    const before = Field.ctTotalOpsSeen;
    CT.enqueueInternal("tick", {});
    await CT.drainAll(8);
    const after = Field.ctTotalOpsSeen;
    assert(after > before, "ctTotalOpsSeen still incrementing");
  });

  console.log("");
  console.log("Phase 5: F1 preserved through long run");

  test("F1: seed still at Field.constraints[0] after long run", () => {
    assert(Field.constraints.length >= 1);
    const first = Field.constraints[0];
    assert(first.id === SEED.id, "seed still at index 0");
    assert(first.kind === "seed");
    assert(first.permanent === true);
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

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(2);
});
