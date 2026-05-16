// ============================================================================
// harness.mjs  -  browser verification harness
// ============================================================================
// Loads in index.html. Runs three paths and compares their outputs:
//
//   1. CSS oracle (pure JS port of the canonical resolution procedure)
//   2. JS oracle  (plain-JS execution of the compiled bytecode)
//   3. GPU path   (WGSL compute shader execution via WebGPU)
//
// The Node-side test-oracle.js already proved (1) and (2) agree byte-for-byte.
// This harness exists to verify that (3) also agrees. If it does, the full
// GPU path is validated and "constraint geometry resolves identically on
// two radically different execution substrates" is demonstrated.
//
// If (3) diverges, the JS oracle (2) is the reference because it is already
// proven correct against (1) on Node.
// ============================================================================

import { SPEC_VERSION, STATE_SPACE_SIZE, unpackCoord } from "./constraints.mjs";
import { compileAll, disassemble } from "./compile-constraints.mjs";
import * as cssOracle from "./css-oracle.mjs";
import * as jsOracle  from "./oracle.mjs";
import { detectSupport, runGpuPath } from "./gpu-path.js";

const log = (msg, cls) => {
  const el = document.getElementById("log");
  const row = document.createElement("div");
  if (cls) row.className = cls;
  row.textContent = msg;
  el.appendChild(row);
  console.log(msg);
};

const clear = () => { document.getElementById("log").innerHTML = ""; };

// Diff two arrays of index-valued records. Returns list of divergences
// (at most maxReport entries collected).
function diffRecords(a, b, labelA, labelB, maxReport) {
  maxReport = maxReport || 10;
  const divergences = [];
  const fields = ["sdf", "rt", "rth", "doc", "reg", "deny"];
  if (a.length !== b.length) {
    throw new Error(`length mismatch: ${labelA}=${a.length}, ${labelB}=${b.length}`);
  }
  for (let i = 0; i < a.length; i++) {
    for (const f of fields) {
      if (a[i][f] !== b[i][f]) {
        if (divergences.length < maxReport) {
          divergences.push({
            coordIdx: i, coord: unpackCoord(i), field: f,
            [labelA]: a[i][f], [labelB]: b[i][f]
          });
        }
      }
    }
  }
  return divergences;
}

async function run() {
  clear();
  log(`[harness] spec version = ${SPEC_VERSION}`);
  log(`[harness] state space size = ${STATE_SPACE_SIZE}`);

  // --- Detect WebGPU early so we can report clearly ----------------------
  const support = detectSupport();
  if (!support.supported) {
    log(`[WARNING] WebGPU not available: ${support.reason}`, "warn");
    log(`[WARNING] Falling back to JS-only verification. GPU path will be skipped.`, "warn");
  } else {
    log(`[harness] navigator.gpu detected`);
  }

  // --- Compile -----------------------------------------------------------
  const t0 = performance.now();
  const compiled = compileAll();
  log(`[harness] compiled ${compiled.stats.ruleCount} rules to ${compiled.stats.totalInstructions} instructions (${compiled.stats.byteSize} bytes) in ${(performance.now() - t0).toFixed(2)} ms`);

  // --- CSS oracle --------------------------------------------------------
  const t1 = performance.now();
  const cssStr = cssOracle.resolveAll();
  const cssIdx = cssStr.map(r => cssOracle.recordToIndices(r));
  log(`[harness] CSS oracle resolved ${cssIdx.length} coords in ${(performance.now() - t1).toFixed(2)} ms`);

  // --- JS oracle ---------------------------------------------------------
  const t2 = performance.now();
  const jsIdx = jsOracle.executeAll(compiled.instructions);
  log(`[harness] JS oracle resolved ${jsIdx.length} coords in ${(performance.now() - t2).toFixed(2)} ms`);

  // --- Diff CSS vs JS (should be zero divergences by construction) ------
  const cssVsJs = diffRecords(cssIdx, jsIdx, "css", "js");
  if (cssVsJs.length === 0) {
    log(`[PASS] CSS oracle == JS oracle: byte-identical across ${STATE_SPACE_SIZE} coords`, "pass");
  } else {
    log(`[FAIL] CSS vs JS diverges at ${cssVsJs.length} places (reporting first):`, "fail");
    cssVsJs.slice(0, 3).forEach(d => log(`   coord=${d.coordIdx} ${JSON.stringify(d.coord)} field=${d.field} css=${d.css} js=${d.js}`, "fail"));
    log(`[harness] aborting; Node-side test-oracle.js should have caught this.`, "fail");
    return;
  }

  // --- GPU path ----------------------------------------------------------
  if (!support.supported) {
    log(`[harness] done (GPU path skipped, CSS vs JS agreement confirmed).`, "info");
    return;
  }

  log(`[harness] loading resolve.wgsl...`);
  let wgslSource;
  try {
    const res = await fetch("./resolve.wgsl");
    if (!res.ok) throw new Error("fetch returned " + res.status);
    wgslSource = await res.text();
  } catch (e) {
    log(`[FAIL] could not load resolve.wgsl: ${e.message}`, "fail");
    log(`   (serve this page over HTTP, not file:// -- browsers block module+fetch from file URLs)`, "fail");
    return;
  }
  log(`[harness] resolve.wgsl loaded (${wgslSource.length} bytes)`);

  const t3 = performance.now();
  let gpuResults;
  try {
    gpuResults = await runGpuPath(compiled.instructions, wgslSource);
  } catch (e) {
    log(`[FAIL] GPU path threw: ${e.message}`, "fail");
    console.error(e);
    return;
  }
  const gpuMs = performance.now() - t3;
  log(`[harness] GPU path resolved ${gpuResults.length} coords in ${gpuMs.toFixed(2)} ms (includes device warmup)`);

  // --- Diff JS vs GPU (the interesting comparison) -----------------------
  const jsVsGpu = diffRecords(jsIdx, gpuResults, "js", "gpu");
  if (jsVsGpu.length === 0) {
    log(`[PASS] JS oracle == GPU path: byte-identical across ${STATE_SPACE_SIZE} coords`, "pass");
    log(``);
    log(`[RESULT] All three paths agree. The constraint geometry resolves identically`, "pass");
    log(`         via CSS cascade semantics, JS stack machine, and WGSL compute shader.`, "pass");
  } else {
    log(`[FAIL] JS vs GPU diverges at ${jsVsGpu.length} places (reporting first):`, "fail");
    jsVsGpu.slice(0, 10).forEach(d => {
      log(`   coord=${d.coordIdx} ${JSON.stringify(d.coord)} field=${d.field} js=${d.js} gpu=${d.gpu}`, "fail");
    });
    log(`[harness] JS oracle is the reference (proven correct by test-oracle.js).`, "fail");
    log(`[harness] Divergence indicates a bug in resolve.wgsl or gpu-path.js host plumbing.`, "fail");
  }
}

document.getElementById("run-btn").addEventListener("click", run);
document.getElementById("disasm-btn").addEventListener("click", () => {
  clear();
  const compiled = compileAll();
  log(disassemble(compiled.instructions));
  log(``);
  log(`[${compiled.stats.totalInstructions} instructions, ${compiled.stats.byteSize} bytes]`);
});
