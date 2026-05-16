// kernel-runtime-emitter.js - K1 emitter (Phase 8 Layer K1)

"use strict";

const fs = require("fs");
const path = require("path");

const KERNEL_FILES = [
  "field.js",
  "constraint-compiler.js",
  "cpu-oracle.js",
  "er-engine.js",
  "ct-engine.js"
];

// Phase 8 runtime additions - loaded after the canonical Phase 5.5 kernel.
// These extend the kernel for SE-08 (intake buffer), cascade evaluation,
// and the browser-side bidirectional bridge. All exempt from sec 3.1
// closure (they ARE the runtime, not application code).
const PHASE8_RUNTIME_FILES = [
  "field-intake-extension.js",
  "kernel-cascade-evaluator.js",
  "dom-bridge.js"
];

// ============================================================================
// Read kernel source
// ============================================================================

function readKernelSources(srcDir) {
  const sources = {};
  for (const f of KERNEL_FILES) {
    const fullPath = path.join(srcDir, f);
    sources[f] = fs.readFileSync(fullPath, "utf8");
  }
  // Phase 8 runtime files live in this emitter's directory, not kernel-src/
  const phase8Dir = path.join(__dirname);
  for (const f of PHASE8_RUNTIME_FILES) {
    const fullPath = path.join(phase8Dir, f);
    sources[f] = fs.readFileSync(fullPath, "utf8");
  }
  return sources;
}

// ============================================================================
// Skeleton init script
// ============================================================================
//
// The minimum init that satisfies acceptance criterion 1:
//   1. Find globals (FieldModule, CTengineModule, ERengineModule,
//      ConstraintCompiler) - kernel files write these to globalThis
//      via their IIFE wrappers
//   2. Field.reset() - establishes seed at constraints[0]
//   3. Verify F1 (defensive: throw if seed not present)
//   4. Construct CT, ER, wire
//   5. Start tick loop
//
// No DOM bridge yet (that's K2 work). No cascade rule loading (skeleton has
// no rules). No adapter contributor wiring.
// ============================================================================

const SKELETON_INIT = `
(function () {
  "use strict";

  // ---- Acquire kernel modules from global ----
  var FieldModule       = globalThis.FieldModule;
  var CTengineModule    = globalThis.CTengineModule;
  var ERengineModule    = globalThis.ERengineModule;
  var ConstraintCompiler = globalThis.ConstraintCompiler;

  // Phase 8 runtime additions (may not be present if loaded standalone)
  var FieldIntakeExtension   = globalThis.FieldIntakeExtension;
  var KernelCascadeEvaluator = globalThis.KernelCascadeEvaluator;
  var DOMbridge              = globalThis.DOMbridge;

  if (!FieldModule || !CTengineModule || !ERengineModule) {
    throw new Error("kernel runtime not loaded; modules missing on globalThis");
  }

  var Field = FieldModule.Field;
  var Trace = FieldModule.Trace;
  var SEED  = FieldModule.SEED;

  // ---- Install Field.intake (SE-08) per contract sec 2 ----
  if (FieldIntakeExtension) {
    FieldIntakeExtension.install(FieldModule);
  }

  // ---- Initialize field ----
  Field.reset();
  Trace.clear();

  // ---- F1 verification (post-reset) ----
  if (Field.constraints.length === 0) {
    throw new Error("F1 violation: Field.constraints empty after reset");
  }
  if (Field.constraints[0].id !== SEED.id) {
    throw new Error("F1 violation: seed not at constraints[0]");
  }
  if (!Field.constraints[0].permanent) {
    throw new Error("F1 violation: seed not marked permanent");
  }

  // ---- Load cascade rules (deposition geometry) ----
  // Per KERNEL_RUNTIME_CONTRACT sec 1: cascade rules are appended after
  // the seed. F1 invariant: seed remains at constraints[0].
  var cascadeRules = globalThis.__DEPOSITION_CASCADE_RULES__ || [];
  for (var i = 0; i < cascadeRules.length; i++) {
    Field.constraints.push(cascadeRules[i]);
  }

  // ---- F1 verification (post-load) ----
  if (Field.constraints[0].id !== SEED.id) {
    throw new Error("F1 violation post-load: seed displaced from [0]");
  }

  // ---- Construct engines ----
  var ER = new ERengineModule.ERengine();
  ER.state = "cpu-fallback";  // browser ER will upgrade to GPU later
  var CT = new CTengineModule.CTengine();
  CT.bind(ER, ConstraintCompiler);

  // ---- Initialize DOM bridge (browser only; degrades gracefully) ----
  var bridge = null;
  var stateElement = null;
  try {
    if (DOMbridge && typeof document !== "undefined" &&
        typeof document.getElementById === "function") {
      stateElement = document.getElementById("substrate-state");
      if (stateElement) {
        bridge = DOMbridge.createBridge();
        bridge.init(Field, stateElement);
        // Auto-wire [data-trigger] click handlers per contract sec 4 default
        if (typeof document.querySelectorAll === "function") {
          var triggers = document.querySelectorAll("[data-trigger]");
          for (var t = 0; t < triggers.length; t++) {
            // Skip the state element itself (don't make it a trigger source)
            if (triggers[t] !== stateElement) {
              bridge.addDOMEventListener(triggers[t], "click");
            }
          }
        }
      }
    }
  } catch (e) {
    // Bridge is best-effort; runtime continues without it
    bridge = null;
  }

  // Expose for inspection (read-only); not for command per F3
  var SUBSTRATE_HANDLE = {
    field: Field,
    trace: Trace,
    seed:  SEED,
    er:    ER,
    ct:    CT,
    bridge: bridge,
    tickCount: 0,
    cascadeRuleCount: cascadeRules.length
  };
  Object.defineProperty(globalThis, "substrate", {
    value: SUBSTRATE_HANDLE,
    writable: false,
    configurable: false
  });

  // ---- Tick loop (F4: indefinite operation) ----
  function tick() {
    // 1. Cascade evaluation: ER pass over cascade-match constraints
    if (KernelCascadeEvaluator) {
      KernelCascadeEvaluator.evaluateCascade(Field, { traceModule: Trace });
    }
    // 2. Project field to DOM (flow 4a) - so browser CSS engine can
    //    render the cascade visually as a parallel observation
    if (bridge) bridge.projectFieldToDOM();
    // 3. Bridge samples cascade output, dispatches to CT (flow 4b -> CT)
    if (bridge) bridge.dispatchToCT(CT);
    // 4. CT processes its queue
    CT.enqueueInternal("tick", {});
    CT.drainAll(8).then(function () {
      Field.refreshVectorDelta();
      SUBSTRATE_HANDLE.tickCount++;
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(tick);
      } else if (typeof setImmediate === "function") {
        setImmediate(tick);
      } else {
        setTimeout(tick, 0);
      }
    });
  }

  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(tick);
  } else if (typeof setImmediate === "function") {
    setImmediate(tick);
  } else {
    setTimeout(tick, 0);
  }
})();
`;

// ============================================================================
// HTML template
// ============================================================================

function buildHtml(opts) {
  opts = opts || {};
  const title = opts.title || "Substrate Skeleton (Phase 8 K1)";
  const sources = opts.sources;

  const lines = [];
  lines.push("<!DOCTYPE html>");
  lines.push("<html lang=\"en\">");
  lines.push("<head>");
  lines.push("<meta charset=\"utf-8\">");
  // I5: restrictive CSP. inline scripts allowed because we ship the kernel
  // inline; no external resources. Style restricted to inline.
  lines.push("<meta http-equiv=\"Content-Security-Policy\" " +
    "content=\"default-src 'none'; script-src 'unsafe-inline'; " +
    "style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self';\">");
  lines.push("<title>" + title + "</title>");
  lines.push("<style>");
  lines.push("body { font-family: monospace; padding: 20px; background: #fafafa; }");
  lines.push(".panel { background: white; padding: 16px; margin: 8px 0; " +
    "border: 1px solid #ddd; border-radius: 4px; }");
  lines.push(".panel h2 { margin-top: 0; font-size: 14px; color: #555; }");
  lines.push(".kv { display: grid; grid-template-columns: 200px 1fr; gap: 8px; }");
  lines.push(".kv .k { color: #888; }");
  lines.push(".kv .v { font-weight: bold; }");
  lines.push("</style>");
  lines.push("</head>");
  lines.push("<body>");
  lines.push("<h1>Substrate Skeleton</h1>");
  lines.push("<p>Phase 8 Layer K1 acceptance criterion 1: skeleton boots, " +
    "kernel ticks indefinitely.</p>");
  // Substrate-state element. The DOM bridge (Phase 8) projects field state
  // here as data-* attributes; the browser CSS engine reads them and
  // resolves cascade rules; --next-op surfaces as a custom property. The
  // kernel evaluator is the authoritative path; this element is the CSS
  // substrate's projection target per contract sec 4 flow 4a.
  lines.push("<div id=\"substrate-state\" data-substrate-state=\"\" " +
    "style=\"display:none\"></div>");
  lines.push("<div id=\"status\" class=\"panel\">");
  lines.push("<h2>Substrate state</h2>");
  lines.push("<div class=\"kv\">");
  lines.push("<span class=\"k\">Tick count</span><span class=\"v\" id=\"tick-count\">-</span>");
  lines.push("<span class=\"k\">Field.step</span><span class=\"v\" id=\"field-step\">-</span>");
  lines.push("<span class=\"k\">Constraints</span><span class=\"v\" id=\"constraint-count\">-</span>");
  lines.push("<span class=\"k\">Seed at [0]?</span><span class=\"v\" id=\"seed-ok\">-</span>");
  lines.push("<span class=\"k\">scalarDelta</span><span class=\"v\" id=\"scalar-delta\">-</span>");
  lines.push("<span class=\"k\">fastDelta</span><span class=\"v\" id=\"fast-delta\">-</span>");
  lines.push("<span class=\"k\">slowDelta</span><span class=\"v\" id=\"slow-delta\">-</span>");
  lines.push("<span class=\"k\">gap</span><span class=\"v\" id=\"gap\">-</span>");
  lines.push("<span class=\"k\">Trace entries</span><span class=\"v\" id=\"trace-len\">-</span>");
  lines.push("</div>");
  lines.push("</div>");
  lines.push("");

  // ---- Kernel runtime section ----
  lines.push("<!-- === KERNEL RUNTIME === -->");
  lines.push("<!-- Phase 5.5 substrate kernel + Phase 8 runtime extensions.");
  lines.push("     All files in this section are exempt from sec 3.1 closure");
  lines.push("     verification per KERNEL_RUNTIME_CONTRACT sec 7. -->");
  for (const f of KERNEL_FILES) {
    lines.push("<script>");
    lines.push("/* === " + f + " === */");
    lines.push(sources[f]);
    lines.push("</script>");
  }
  for (const f of PHASE8_RUNTIME_FILES) {
    lines.push("<script>");
    lines.push("/* === " + f + " (Phase 8 runtime) === */");
    lines.push(sources[f]);
    lines.push("</script>");
  }
  lines.push("<!-- === END KERNEL RUNTIME === -->");
  lines.push("");

  // ---- Application section ----
  lines.push("<!-- === APPLICATION === -->");
  // Cascade rule constraints injected as a global per KERNEL_RUNTIME_CONTRACT
  // sec 1. SKELETON_INIT reads __DEPOSITION_CASCADE_RULES__ after Field.reset()
  // and appends each constraint. F1 invariant honored: seed remains at [0].
  if (opts.cascadeConstraints && opts.cascadeConstraints.length > 0) {
    lines.push("<script>");
    lines.push("/* Cascade rule constraints (deposition geometry) */");
    lines.push("globalThis.__DEPOSITION_CASCADE_RULES__ = " +
      JSON.stringify(opts.cascadeConstraints, null, 2) + ";");
    lines.push("</script>");
    // Also include the original CSS for the cascade engine to evaluate. The
    // browser CSS engine is one substrate (per SE-06); the kernel ER is
    // another. Both read the same constraint geometry; per S2 they produce
    // identical match results.
    if (opts.cascadeCss) {
      lines.push("<style>");
      lines.push("/* Original cascade rules - the CSS substrate's representation");
      lines.push("   of the same constraint geometry the kernel substrate holds */");
      lines.push(opts.cascadeCss);
      lines.push("</style>");
    }
  } else {
    lines.push("<!-- Application source goes here. For K1 skeleton: empty. -->");
  }
  lines.push("<!-- === END APPLICATION === -->");
  lines.push("");

  // ---- Init + status display ----
  lines.push("<script>");
  lines.push(SKELETON_INIT);
  lines.push("</script>");
  lines.push("<script>");
  lines.push("// Status display poller. Reads substrate state via the read-");
  lines.push("// only handle exposed in skeleton init. This is an O-class");
  lines.push("// observer per INVARIANTS O1: read-only with respect to field.");
  lines.push("(function () {");
  lines.push("  function fmt(n) { return typeof n === 'number' ? n.toFixed(4) : String(n); }");
  lines.push("  function refresh() {");
  lines.push("    var s = globalThis.substrate;");
  lines.push("    if (!s) { setTimeout(refresh, 100); return; }");
  lines.push("    document.getElementById('tick-count').textContent = s.tickCount;");
  lines.push("    document.getElementById('field-step').textContent = s.field.step;");
  lines.push("    document.getElementById('constraint-count').textContent = s.field.constraints.length;");
  lines.push("    var seedOk = s.field.constraints[0] && s.field.constraints[0].id === s.seed.id;");
  lines.push("    document.getElementById('seed-ok').textContent = seedOk ? 'YES' : 'NO';");
  lines.push("    document.getElementById('scalar-delta').textContent = fmt(s.field.scalarDelta);");
  lines.push("    document.getElementById('fast-delta').textContent = fmt(s.field.fastDelta);");
  lines.push("    document.getElementById('slow-delta').textContent = fmt(s.field.slowDelta);");
  lines.push("    document.getElementById('gap').textContent = fmt(s.field.gap);");
  lines.push("    document.getElementById('trace-len').textContent = s.trace.entries.length;");
  lines.push("    setTimeout(refresh, 250);");
  lines.push("  }");
  lines.push("  refresh();");
  lines.push("})();");
  lines.push("</script>");

  lines.push("</body>");
  lines.push("</html>");
  return lines.join("\n");
}

// ============================================================================
// Public emit API
// ============================================================================

function emit(opts) {
  opts = opts || {};
  const srcDir = opts.kernelSrcDir || path.join(__dirname, "kernel-src");
  const sources = readKernelSources(srcDir);

  // Synthesize cascade-match constraints if cascadeRules is a CSS string,
  // pass through if already an array of constraints. Per contract sec 1.
  let cascadeConstraints = null;
  let cascadeCss = null;
  if (typeof opts.cascadeRules === "string") {
    const Synth = require("./cascade-rule-synthesizer.js");
    const r = Synth.synthesizeFromCss(opts.cascadeRules);
    if (!r.ok) {
      throw new Error("emit: cascade rule synthesis failed: " +
        JSON.stringify(r.errors));
    }
    cascadeConstraints = r.constraints;
    cascadeCss = opts.cascadeRules;
  } else if (Array.isArray(opts.cascadeRules)) {
    cascadeConstraints = opts.cascadeRules;
  }

  const html = buildHtml({
    title: opts.title,
    sources: sources,
    cascadeConstraints: cascadeConstraints,
    cascadeCss: cascadeCss
  });
  return html;
}

// ============================================================================
// Exports
// ============================================================================

module.exports = Object.freeze({
  emit: emit,
  buildHtml: buildHtml,
  readKernelSources: readKernelSources,
  KERNEL_FILES: KERNEL_FILES,
  SKELETON_INIT: SKELETON_INIT
});

// ============================================================================
// CLI
// ============================================================================

if (require.main === module) {
  const outFile = process.argv[2] || "skeleton-deposition.html";
  const html = emit();
  fs.writeFileSync(outFile, html, "utf8");
  console.log("Wrote " + outFile + " (" + html.length + " bytes)");
}
