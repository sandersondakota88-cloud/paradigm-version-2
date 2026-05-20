// =============================================================================
// reproduce-divergence.js - Reproduce one specific failing fixture from the
// stratified harness and print per-coordinate diff between CSS-style oracle
// and JS oracle.
//
// Usage: node tests/reproduce-divergence.js <fixture-id>
// Example: node tests/reproduce-divergence.js scale-n4-s7-79
// =============================================================================

"use strict";

const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const C        = require(path.join(ROOT, "constraints.js"));
const cssOracle = require(path.join(ROOT, "css-oracle.js"));
const jsOracle  = require(path.join(ROOT, "oracle.js"));
const compiler  = require(path.join(ROOT, "compile-constraints.js"));

// ---- Generators copied from generate-gpu-fixtures.js (must match exactly) ---

function allDimValueClauses() {
  const out = [];
  for (let d = 0; d < C.DIMS.length; d++)
    for (let v = 0; v < C.DIMS[d].values.length; v++)
      out.push({ [C.DIMS[d].name]: C.DIMS[d].values[v] });
  return out;
}
function allTwoKeyClauses() {
  const out = [];
  for (let d1 = 0; d1 < C.DIMS.length; d1++)
    for (let v1 = 0; v1 < C.DIMS[d1].values.length; v1++)
      for (let d2 = d1 + 1; d2 < C.DIMS.length; d2++)
        for (let v2 = 0; v2 < C.DIMS[d2].values.length; v2++)
          out.push({
            [C.DIMS[d1].name]: C.DIMS[d1].values[v1],
            [C.DIMS[d2].name]: C.DIMS[d2].values[v2]
          });
  return out;
}
function allThreeKeyClauses() {
  const out = [];
  for (let d1 = 0; d1 < C.DIMS.length; d1++)
    for (let v1 = 0; v1 < C.DIMS[d1].values.length; v1++)
      for (let d2 = d1 + 1; d2 < C.DIMS.length; d2++)
        for (let v2 = 0; v2 < C.DIMS[d2].values.length; v2++)
          for (let d3 = d2 + 1; d3 < C.DIMS.length; d3++)
            for (let v3 = 0; v3 < C.DIMS[d3].values.length; v3++)
              out.push({
                [C.DIMS[d1].name]: C.DIMS[d1].values[v1],
                [C.DIMS[d2].name]: C.DIMS[d2].values[v2],
                [C.DIMS[d3].name]: C.DIMS[d3].values[v3]
              });
  return out;
}
function thenClauseCatalogue() {
  const cat = [];
  cat.push({ sdf: -1 });
  cat.push({ sdf: 1 });
  for (const v of C.RT_TABLE)   cat.push({ rt: v });
  for (const v of C.DOC_TABLE)  cat.push({ doc: v });
  for (const v of C.REG_TABLE)  cat.push({ reg: v });
  for (const v of C.DENY_TABLE) cat.push({ deny: v });
  for (const v of [0, 1, 127, 255]) cat.push({ rth: v });
  cat.push({ sdf: 1, deny: "SubPrime cannot hold BusinessLine" });
  cat.push({ rt: "A-PREFERRED", rth: 160, doc: "BASIC" });
  cat.push({ rt: "B-STANDARD",  rth: 130, doc: "ENHANCED" });
  cat.push({ rt: "C-ELEVATED",  rth:  95, doc: "ENHANCED" });
  return cat;
}
function makeRng(seed) {
  let s = (seed | 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) / 0x100000000);
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

// ---- Reproduce the fixture by walking the same enumeration order -----------

const targetId = process.argv[2];
if (!targetId) {
  console.error("Usage: node reproduce-divergence.js <fixture-id>");
  process.exit(1);
}

// Match the buildFixtures enumeration order from generate-gpu-fixtures.js.
// We only care about the scale-* fixtures here; if you ask for another fixture,
// we'll bail out with a TODO message.
if (!targetId.startsWith("scale-n")) {
  console.error("This tool currently only reproduces scale-* fixtures.");
  console.error("Target was: " + targetId);
  process.exit(2);
}

const match = /^scale-n(\d+)-s(\d+)-(\d+)$/.exec(targetId);
if (!match) {
  console.error("Unrecognized scale id format: " + targetId);
  process.exit(2);
}
const targetN = parseInt(match[1], 10);
const targetS = parseInt(match[2], 10);

const thens = thenClauseCatalogue();
const oneK  = allDimValueClauses();
const twoK  = allTwoKeyClauses();
const threeK = allThreeKeyClauses();

const rng = makeRng(0xC0FFEE);
function randomRule() {
  const w = rng();
  let when;
  if (w < 0.5)        when = pick(rng, oneK);
  else if (w < 0.85)  when = pick(rng, twoK);
  else                when = pick(rng, threeK);
  return { when: { ...when }, then: { ...pick(rng, thens) } };
}

// Advance the RNG through every prior n,s combination
let fxRules = null;
for (let n = 1; n <= 16; n++) {
  for (let s = 0; s < 24; s++) {
    const rules = [];
    for (let i = 0; i < n; i++) rules.push(randomRule());
    if (n === targetN && s === targetS) {
      fxRules = rules;
      break;
    }
  }
  if (fxRules) break;
}

if (!fxRules) {
  console.error("Could not reproduce fixture " + targetId);
  process.exit(3);
}

// ---- Print the rules ------------------------------------------------------

console.log("======================================================================");
console.log("Fixture: " + targetId);
console.log("======================================================================");
console.log("");
console.log("Source rules (declaration order):");
for (let i = 0; i < fxRules.length; i++) {
  console.log("  [" + i + "] when=" + JSON.stringify(fxRules[i].when) +
                     "  then=" + JSON.stringify(fxRules[i].then));
}
console.log("");

// ---- Compile to instructions and show sort order --------------------------

const sortedRules = compiler.sortRules(fxRules);
console.log("Sorted by |when| ascending (postfix emission order):");
for (let i = 0; i < sortedRules.length; i++) {
  const r = sortedRules[i];
  const orig = fxRules.indexOf(r);
  console.log("  [" + i + "] (was [" + orig + "])  |when|=" + Object.keys(r.when).length +
                     "  when=" + JSON.stringify(r.when) +
                     "  then=" + JSON.stringify(r.then));
}
console.log("");

// ---- Run both oracles -----------------------------------------------------

const instructions = (function () {
  const all = [];
  for (const r of sortedRules) {
    for (const inst of compiler.compileRule(r)) all.push(inst);
  }
  return Uint32Array.from(all);
})();

const cssResults = cssOracle.resolveAll
  ? cssOracle.resolveAll()
  : null;
// css-oracle.js's resolveAll uses the GLOBAL CONSTRAINTS, not our fxRules.
// We need a per-fixture version. Reimplement here using the same semantics
// as css-oracle.js (cascade with specificity-then-source-order).

function cssOracleAgainstRules(rules) {
  const sorted = (function () {
    const indexed = rules.map((r, i) => ({
      rule: r, origIdx: i, whenCount: Object.keys(r.when).length
    }));
    indexed.sort((x, y) => {
      const d = x.whenCount - y.whenCount;
      if (d !== 0) return d;
      return x.origIdx - y.origIdx;
    });
    return indexed.map(e => e.rule);
  })();

  function findDim(name) {
    for (let i = 0; i < C.DIMS.length; i++) if (C.DIMS[i].name === name) return i;
    throw new Error("unknown dim: " + name);
  }
  function matches(when, coord) {
    for (const dimName in when) {
      const dIdx = findDim(dimName);
      const expected = when[dimName];
      const actualIdx = coord[dIdx];
      const actualValue = C.DIMS[dIdx].values[actualIdx];
      if (actualValue !== expected) return false;
    }
    return true;
  }
  function applyThen(then, out) {
    for (const k of ["sdf","reg","deny","rt","rth","doc"]) {
      if (Object.prototype.hasOwnProperty.call(then, k)) out[k] = then[k];
    }
  }

  const out = new Array(C.STATE_SPACE_SIZE);
  for (let i = 0; i < C.STATE_SPACE_SIZE; i++) {
    const coord = C.unpackCoord(i);
    const rec = {
      sdf: -1, reg: "VALID", deny: "",
      rt: "UNCLASSIFIED", rth: 0, doc: "BASIC"
    };
    for (const r of sorted) {
      if (matches(r.when, coord)) applyThen(r.then, rec);
    }
    if (rec.sdf === 1) { rec.reg = "DENIED"; rec.rth = 0; }
    out[i] = rec;
  }
  return out;
}

const cssOut = cssOracleAgainstRules(fxRules);
const jsOut = jsOracle.executeAll(instructions);

// ---- Diff per-coordinate ---------------------------------------------------

// JS oracle returns index-form (rt, doc, reg, deny are ints into tables).
// CSS oracle returns string-form. Convert JS to string form for comparison.

function jsRecordToStrings(r) {
  return {
    sdf:  r.sdf,
    reg:  C.REG_TABLE[r.reg],
    deny: C.DENY_TABLE[r.deny],
    rt:   C.RT_TABLE[r.rt],
    rth:  r.rth,
    doc:  C.DOC_TABLE[r.doc]
  };
}

function recEqual(a, b) {
  return a.sdf === b.sdf && a.reg === b.reg && a.deny === b.deny &&
         a.rt === b.rt && a.rth === b.rth && a.doc === b.doc;
}

const divergent = [];
for (let i = 0; i < C.STATE_SPACE_SIZE; i++) {
  const cssR = cssOut[i];
  const jsR  = jsRecordToStrings(jsOut[i]);
  if (!recEqual(cssR, jsR)) {
    divergent.push({ coord: i, css: cssR, js: jsR });
  }
}

console.log("Divergent coordinates: " + divergent.length + " of " + C.STATE_SPACE_SIZE);
console.log("");

if (divergent.length === 0) {
  console.log("(no divergence found between css-oracle-against-rules and js-oracle)");
  console.log("If the browser harness reported a divergence, the in-browser");
  console.log("getComputedStyle resolution differs from this Node CSS oracle too --");
  console.log("meaning the divergence is between the REAL CSS engine and the");
  console.log("postfix machine, NOT between the CSS oracle and the postfix machine.");
  process.exit(0);
}

// Show first 5 divergent coordinates with full detail
const showCount = Math.min(divergent.length, 5);
console.log("First " + showCount + " divergent coordinates:");
console.log("");
for (let k = 0; k < showCount; k++) {
  const d = divergent[k];
  const coord = C.unpackCoord(d.coord);
  const coordLabel = coord.map((v, i) => C.DIMS[i].name + "=" + C.DIMS[i].values[v]).join(", ");
  console.log("  coord " + d.coord + ": " + coordLabel);
  console.log("    CSS: " + JSON.stringify(d.css));
  console.log("    JS:  " + JSON.stringify(d.js));
  // Which rules match this coord?
  console.log("    Rules that match this coord:");
  for (let r = 0; r < fxRules.length; r++) {
    const rule = fxRules[r];
    let matched = true;
    for (const k of Object.keys(rule.when)) {
      const dIdx = (function (name) {
        for (let i = 0; i < C.DIMS.length; i++) if (C.DIMS[i].name === name) return i;
        return -1;
      })(k);
      if (C.DIMS[dIdx].values[coord[dIdx]] !== rule.when[k]) { matched = false; break; }
    }
    if (matched) {
      console.log("      [orig#" + r + "] |when|=" + Object.keys(rule.when).length +
                  "  when=" + JSON.stringify(rule.when) +
                  "  then=" + JSON.stringify(rule.then));
    }
  }
  console.log("");
}

// Also show the field-by-field divergence pattern
console.log("Divergence pattern (which fields differ across all divergent coords):");
const fieldDiffs = { sdf: 0, reg: 0, deny: 0, rt: 0, rth: 0, doc: 0 };
for (const d of divergent) {
  for (const f of Object.keys(fieldDiffs)) {
    if (d.css[f] !== d.js[f]) fieldDiffs[f]++;
  }
}
for (const f of Object.keys(fieldDiffs)) {
  console.log("  " + f + ": " + fieldDiffs[f] + " divergent coords");
}
