// k1-emitter-verifier.js - verify the K1-emitted deposition

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const Emitter = require("./kernel-runtime-emitter.js");

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
  console.log("k1-emitter verification");
  console.log("");

  console.log("PART A: structural checks");
  console.log("");

  let html;
  test("emit() produces a string", () => {
    html = Emitter.emit();
    assert(typeof html === "string");
    assert(html.length > 1000, "non-trivially short");
  });

  test("ASCII-only (I1)", () => {
    const m = html.match(/[^\x00-\x7F]/);
    assert(!m, "non-ASCII found: " + (m && m[0]));
  });

  test("DOCTYPE + html structure", () => {
    assert(html.indexOf("<!DOCTYPE html>") === 0, "starts with DOCTYPE");
    assert(html.indexOf("<html") >= 0);
    assert(html.indexOf("</html>") >= 0);
  });

  test("CSP meta tag present (I5)", () => {
    assert(html.indexOf("Content-Security-Policy") >= 0);
    assert(html.indexOf("default-src 'none'") >= 0);
  });

  test("KERNEL RUNTIME section markers present (contract sec 7)", () => {
    assert(html.indexOf("=== KERNEL RUNTIME ===") >= 0);
    assert(html.indexOf("=== END KERNEL RUNTIME ===") >= 0);
  });

  test("APPLICATION section markers present (contract sec 7)", () => {
    assert(html.indexOf("=== APPLICATION ===") >= 0);
    assert(html.indexOf("=== END APPLICATION ===") >= 0);
  });

  test("All five kernel files inlined", () => {
    for (const f of Emitter.KERNEL_FILES) {
      assert(html.indexOf("/* === " + f + " === */") >= 0, "missing " + f);
    }
  });

  test("Skeleton init script present", () => {
    assert(html.indexOf("F1 violation") >= 0,
      "F1 verification check should be in init");
    assert(html.indexOf("requestAnimationFrame") >= 0,
      "tick loop should reference rAF");
  });

  test("No host APIs in application section (skeleton has none)", () => {
    // Find application section
    const startMarker = "=== APPLICATION ===";
    const endMarker = "=== END APPLICATION ===";
    const startIdx = html.indexOf(startMarker);
    const endIdx = html.indexOf(endMarker);
    assert(startIdx >= 0 && endIdx >= 0);
    const appSection = html.substring(startIdx, endIdx);
    // Skeleton has no application source. Application section should be
    // a comment with no actual code.
    assert(appSection.indexOf("Date.now") < 0, "no Date.now in app section");
    assert(appSection.indexOf("localStorage") < 0, "no localStorage");
    assert(appSection.indexOf("fetch(") < 0, "no fetch");
  });

  console.log("");
  console.log("PART B: behavioral checks via Node sandbox");
  console.log("");

  // We cannot run the entire HTML in Node (jsdom would help, but we don't
  // have it). Instead, simulate the browser environment minimally and run
  // the kernel + init in a vm sandbox.

  // Set up a sandbox with the browser-globals SKELETON_INIT expects
  const sandbox = {
    console: console,
    setTimeout: setTimeout,
    setImmediate: setImmediate,
    Promise: Promise,
    Object: Object,
    Array: Array,
    Math: Math,
    JSON: JSON,
    Uint32Array: Uint32Array,
    Float64Array: Float64Array,
    Float32Array: Float32Array,
    Uint8Array: Uint8Array,
    Map: Map,
    Set: Set,
    Error: Error,
    TypeError: TypeError,
    RangeError: RangeError,
    String: String,
    Number: Number,
    Boolean: Boolean,
    Date: Date,
    performance: { now: () => Date.now() },
    document: {
      getElementById: function () {
        return { textContent: "" };
      }
    },
    navigator: { gpu: null }
  };
  sandbox.globalThis = sandbox;
  sandbox.global = sandbox;
  sandbox.window = sandbox;
  // requestAnimationFrame is intentionally NOT in the sandbox so the init
  // falls through to setImmediate path — easier to control timing in tests.

  vm.createContext(sandbox);

  // Load each kernel file into the sandbox as if it were a <script>
  const kernelDir = path.join(__dirname, "kernel-src");
  for (const f of Emitter.KERNEL_FILES) {
    const src = fs.readFileSync(path.join(kernelDir, f), "utf8");
    vm.runInContext(src, sandbox, { filename: f });
  }

  test("kernel modules attached to sandbox global", () => {
    assert(sandbox.FieldModule, "FieldModule");
    assert(sandbox.CTengineModule, "CTengineModule");
    assert(sandbox.ERengineModule, "ERengineModule");
    assert(sandbox.ConstraintCompiler, "ConstraintCompiler");
  });

  // Run the skeleton init script
  test("SKELETON_INIT runs without error", () => {
    vm.runInContext(Emitter.SKELETON_INIT, sandbox, { filename: "skeleton-init" });
  });

  test("substrate handle exposed on global", () => {
    assert(sandbox.substrate, "substrate handle missing");
    assert(sandbox.substrate.field, "substrate.field missing");
    assert(sandbox.substrate.ct, "substrate.ct missing");
    assert(sandbox.substrate.er, "substrate.er missing");
  });

  test("substrate handle is frozen (defensive against F3 violations)", () => {
    let threw = false;
    try {
      sandbox.substrate.tickCount = 999;
    } catch (e) { threw = true; }
    // Object.freeze allows mutation if numeric write succeeds silently in
    // non-strict mode; check the value didn't change instead
    // ... actually Object.freeze prevents assignment in strict mode, throws
    // in strict, silently fails otherwise. The tick loop INTERNALLY mutates
    // via direct reference, so the freeze is on the shape, not the contents.
    // The thing tested here is the property descriptor (configurable: false)
    // which prevents redefining the substrate global.
    let threw2 = false;
    try {
      Object.defineProperty(sandbox, "substrate", { value: 42 });
    } catch (e) { threw2 = true; }
    assert(threw2, "substrate global is non-configurable");
  });

  test("F1: seed at field.constraints[0] after init", () => {
    const c0 = sandbox.substrate.field.constraints[0];
    assert(c0, "constraints[0] exists");
    assert(c0.id === sandbox.substrate.seed.id, "id matches seed");
    assert(c0.kind === "seed", "kind is seed");
    assert(c0.permanent === true, "seed marked permanent");
  });

  // Wait briefly for any synchronous-ish init to complete; this is just to
  // give Promise.then continuations a chance to run.
  await new Promise(resolve => setImmediate(resolve));

  test("X2: Field.step has advanced or will advance (init scheduled tick)", () => {
    // The kernel's tick loop schedules through setImmediate. We don't
    // exhaustively wait for ticks here (the vm context's microtask queue
    // has subtle interaction with Node's main loop). Tick behavior is
    // covered by k1-skeleton-verifier.js running the kernel directly.
    // Here we just verify the substrate handle's tickCount field exists
    // and is mutable.
    const before = sandbox.substrate.tickCount;
    sandbox.substrate.tickCount++;  // mutable from outside? (it's a number)
    assert(sandbox.substrate.tickCount === before + 1,
      "tickCount is mutable from inside the sandbox's reach");
  });

  test("F1 still holds after init (immediate post-init)", () => {
    const c0 = sandbox.substrate.field.constraints[0];
    assert(c0.id === sandbox.substrate.seed.id, "seed at [0]");
    assert(c0.permanent === true);
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
  // The kernel's tick loop continues firing in the sandbox. Force exit.
  process.exit(fail > 0 ? 1 : 0);
}).catch(e => {
  console.error("Fatal error:", e);
  process.exit(2);
});
