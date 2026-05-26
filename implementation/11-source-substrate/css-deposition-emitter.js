// css-deposition-emitter.js
// =============================================================================
// Phase 11 Phase 6 — emit the substrate's settled state as a self-contained
// CSS stylesheet that the canonical cascade can resolve against.
//
// Per algorithm 04: constraints compile to CSS attribute-selector rules with
// custom-property declarations. The selector IS the `when`; the declaration
// IS the `then`. CSS cascade resolution IS the canonical evaluation
// mechanism.
//
// Per algorithm 16 + exodus/canonical-implementation/: CSS deposition
// resolves byte-identically to JS/WGSL deposition. This emitter rides on
// that empirical floor — we don't re-verify, we use the trust.
//
// What this emits
// ----------------
//
// The substrate's joint coord space (kind × vocab × cooccur × position ×
// frequency × composer = 12,500 coords) is encoded as data-attributes on
// a probe element. Each composer constraint promoted in the substrate's
// settled state becomes a cascade rule:
//
//   #substrate-probe[data-kind="kind-isolated"][data-vocab="vocab-recurring"]
//      { --composer-fire: "composer-pair-7"; }
//
// The selector pins which joint configurations the rule applies to (the
// `when`); the declaration emits which substrate constraint fired (the
// `then`). Per K2, the emitted value is the constraint's identity, which
// is the substrate's name for the structural pattern it found.
//
// The stylesheet is self-contained — no script, no external dependencies.
// Load it into ANY browser with a probe element matching the selector
// shape, set the data-attributes to a joint-coord configuration, read
// getComputedStyle(probe).getPropertyValue("--composer-fire"), and the
// browser's cascade engine resolves the substrate's understanding of
// what fires at that coord.
//
// This is the substrate's settled configuration made portable.
// =============================================================================

"use strict";

(function (global) {

  // ---------------------------------------------------------------------
  // Extract cascade-match rules from the substrate's settled state.
  // Mirrors gpu-lattice-compiler.js extractLatticeRules() but emits a
  // pure data structure (no postfix bytecode encoding); the CSS emitter
  // walks this directly.
  // ---------------------------------------------------------------------
  function _extractRules(lattice) {
    const rules = [];
    const composer = lattice.peers.composer;
    if (!composer || !composer.field) return rules;

    let counter = 0;
    function _push(type, selector, constraintId, kind) {
      counter++;
      rules.push({
        id: constraintId || (type + "-" + counter),
        type: type,
        selector: selector,
        constraintKind: kind || "derived"
      });
    }

    for (const c of composer.field.constraints) {
      if (!c.pattern) continue;
      const t = c.pattern.type;
      if (t === "composer-pair" || t === "composer-axis-affinity") {
        const sel = Object.create(null);
        sel[c.pattern.aAxis] = c.pattern.aOut;
        sel[c.pattern.bAxis] = c.pattern.bOut;
        _push(t, sel, c.id, c.kind);
      } else if (t === "composer-extension") {
        const sel = Object.create(null);
        sel[c.pattern.aAxis] = c.pattern.aOut;
        sel[c.pattern.bAxis] = c.pattern.bOut;
        _push(t, sel, c.id, c.kind);
      } else if (t === "composer-tuple") {
        if (!c.pattern.outputs || typeof c.pattern.outputs !== "object") continue;
        const sel = Object.create(null);
        for (const axis in c.pattern.outputs) sel[axis] = c.pattern.outputs[axis];
        if (Object.keys(sel).length === 0) continue;
        _push(t, sel, c.id, c.kind);
      }
    }
    return rules;
  }

  // ---------------------------------------------------------------------
  // Selector specificity ordering. The canonical cascade resolves
  // most-specific-wins; we sort rules ascending by |selector| so the
  // emitted stylesheet's source order matches what most-specific-wins
  // would produce (later rules override earlier ones when both match).
  // This is algorithm 04's sort discipline.
  // ---------------------------------------------------------------------
  function _sortBySpecificity(rules) {
    return rules.slice().sort(function (a, b) {
      const ka = Object.keys(a.selector).length;
      const kb = Object.keys(b.selector).length;
      if (ka !== kb) return ka - kb;
      // Stable tiebreak by id
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  }

  // ---------------------------------------------------------------------
  // CSS string escapers per algorithm 04 / algorithm 14 (defense stack).
  // Selector attribute values are constrained to [A-Za-z0-9_.-]; our
  // output alphabet members already conform. Declaration values are
  // emitted as CSS strings with quote escaping.
  // ---------------------------------------------------------------------
  const ATTR_VALUE_OK = /^[A-Za-z0-9_.-]{1,64}$/;
  function _escAttr(v) {
    const s = String(v == null ? "" : v);
    if (!ATTR_VALUE_OK.test(s)) {
      // Conservative: replace anything outside the allowlist
      return s.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 64);
    }
    return s;
  }
  function _escDeclString(v) {
    const s = String(v == null ? "" : v);
    let out = '"';
    for (let i = 0; i < s.length && i < 256; i++) {
      const c = s.charCodeAt(i);
      if (c < 0x20 || c === 0x7F)        out += "\\" + c.toString(16) + " ";
      else if (c === 0x22 || c === 0x5C) out += "\\" + s.charAt(i);
      else if (c > 0x7E)                  out += "\\" + c.toString(16) + " ";
      else                                out += s.charAt(i);
    }
    return out + '"';
  }

  // ---------------------------------------------------------------------
  // Emit one CSS rule per substrate constraint.
  //
  // Rule shape:
  //   #substrate-probe[data-<axis1>="<value1>"][data-<axis2>="<value2>"] {
  //     --lattice-fire: "<constraint-id>";
  //   }
  //
  // The probe element has one data-* attribute per axis. The cascade
  // resolves which rules apply to the current coord by attribute match.
  // ---------------------------------------------------------------------
  function emitCSS(lattice, options) {
    options = options || {};
    const probeId = options.probeId || "substrate-probe";
    const outputProp = options.outputProperty || "--lattice-fire";

    const rules = _sortBySpecificity(_extractRules(lattice));

    const header = [
      "/* =============================================================== */",
      "/* Substrate-state deposition · emitted " + new Date().toISOString() + " */",
      "/* Phase 11 Phase 6 — algorithm 04 cascade-shape rules.            */",
      "/* The substrate's settled understanding of the corpus's relational */",
      "/* dynamics, deposited as portable CSS. Resolution mechanism is the */",
      "/* canonical CSS cascade per algorithm 16 byte-for-byte trust.     */",
      "/* =============================================================== */",
      "",
      "/* Default: --" + outputProp.slice(2) + " is empty unless a rule fires. */",
      "#" + probeId + " { " + outputProp + ": \"\"; }",
      ""
    ];

    const body = [];
    let emittedCount = 0;
    let skippedCount = 0;

    for (const r of rules) {
      const selectorParts = ["#" + probeId];
      let bad = false;
      for (const axis of Object.keys(r.selector).sort()) {
        const v = _escAttr(r.selector[axis]);
        if (!v) { bad = true; break; }
        selectorParts.push("[data-" + axis + '="' + v + '"]');
      }
      if (bad) { skippedCount++; continue; }
      const selector = selectorParts.join("");
      const declaration = outputProp + ": " + _escDeclString(r.id) + ";";
      body.push(selector + " {");
      body.push("  " + declaration);
      body.push("}");
      emittedCount++;
    }

    const stats = {
      rulesExtracted: rules.length,
      rulesEmitted: emittedCount,
      rulesSkipped: skippedCount,
      probeId: probeId,
      outputProperty: outputProp
    };

    return {
      css: header.concat(body).join("\n") + "\n",
      stats: stats,
      rules: rules
    };
  }

  // ---------------------------------------------------------------------
  // Emit a probe HTML page that loads the stylesheet and demonstrates
  // resolution: iterates over the full 12,500-coord joint space, sets
  // the probe element's data-attributes, reads getComputedStyle, records
  // the resolved value.
  //
  // The page exposes a window.runProbe() that returns the full
  // coord-to-fire mapping for verification against the substrate's
  // own joint-space walk.
  // ---------------------------------------------------------------------
  function emitProbeHTML(latticeDims, cssURL, options) {
    options = options || {};
    const probeId = options.probeId || "substrate-probe";

    const dimsJSON = JSON.stringify(latticeDims, null, 2);

    return [
      "<!DOCTYPE html>",
      "<html lang='en'>",
      "<head>",
      "<meta charset='UTF-8'>",
      "<title>Substrate deposition probe</title>",
      "<link rel='stylesheet' href='" + cssURL + "'>",
      "<style>body{font-family:monospace;background:#0e1116;color:#d6dde6;padding:12px;font-size:11px;}</style>",
      "</head>",
      "<body>",
      "<h2>Substrate-state deposition probe</h2>",
      "<p>The substrate's settled understanding deposited as CSS. The browser's cascade engine resolves the joint coord space.</p>",
      "<div id='" + probeId + "' style='position:absolute;left:-9999px'></div>",
      "<button onclick='runProbe()'>RESOLVE FULL JOINT COORD SPACE</button>",
      "<pre id='out' style='margin-top:12px; white-space: pre-wrap; max-height: 70vh; overflow-y: scroll'></pre>",
      "<script>",
      "const LATTICE_DIMS = " + dimsJSON + ";",
      "const PROBE_ID = " + JSON.stringify(probeId) + ";",
      "function runProbe() {",
      "  const probe = document.getElementById(PROBE_ID);",
      "  let stateSpaceSize = 1;",
      "  for (const d of LATTICE_DIMS) stateSpaceSize *= d.values.length;",
      "  const results = new Array(stateSpaceSize);",
      "  let matched = 0;",
      "  for (let i = 0; i < stateSpaceSize; i++) {",
      "    let rem = i;",
      "    for (let d = LATTICE_DIMS.length - 1; d >= 0; d--) {",
      "      const dim = LATTICE_DIMS[d];",
      "      probe.setAttribute('data-' + dim.name, dim.values[rem % dim.values.length]);",
      "      rem = Math.floor(rem / dim.values.length);",
      "    }",
      "    const v = getComputedStyle(probe).getPropertyValue('--lattice-fire').trim().replace(/^['\"]|['\"]$/g, '');",
      "    results[i] = v;",
      "    if (v && v !== '') matched++;",
      "  }",
      "  document.getElementById('out').textContent =",
      "    'stateSpaceSize: ' + stateSpaceSize + '\\n' +",
      "    'matched: ' + matched + '\\n' +",
      "    'unresolved: ' + (stateSpaceSize - matched) + '\\n' +",
      "    'lattice-scope delta: ' + ((stateSpaceSize - matched) / stateSpaceSize).toFixed(4) + '\\n\\n' +",
      "    'Sample (first 30 matched coords):\\n' +",
      "    results.map((v, i) => v ? (i + ': ' + v) : null).filter(x => x).slice(0, 30).join('\\n');",
      "  window.__probeResults = results;",
      "  return { stateSpaceSize, matched, results };",
      "}",
      "</script>",
      "</body>",
      "</html>"
    ].join("\n");
  }

  // ---------------------------------------------------------------------
  // Module
  // ---------------------------------------------------------------------
  const CSSDepositionEmitter = Object.freeze({
    emitCSS: emitCSS,
    emitProbeHTML: emitProbeHTML
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = CSSDepositionEmitter;
  } else {
    global.CSSDepositionEmitter = CSSDepositionEmitter;
  }

})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));
