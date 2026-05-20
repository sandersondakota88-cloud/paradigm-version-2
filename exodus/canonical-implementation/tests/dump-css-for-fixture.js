// Dump the CSS that the stratified harness would generate for a given fixture.
// Compares to what the canonical exodus-canonical.html generator emits.

"use strict";

const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const C = require(path.join(ROOT, "constraints.js"));

// Reproduce the rules for scale-n4-s7-79 by walking RNG state (same as
// reproduce-divergence.js)

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

let fxRules = null;
const targetN = 4, targetS = 7;
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

// --- Harness's CSS compilation (copied from stratified-harness.html) ---
function sortRules(rules) {
  const indexed = rules.map((r, i) => ({
    rule: r, origIdx: i, whenCount: Object.keys(r.when).length
  }));
  indexed.sort((x, y) => {
    const d = x.whenCount - y.whenCount;
    return d !== 0 ? d : x.origIdx - y.origIdx;
  });
  return indexed.map(e => e.rule);
}
function cssEscapeString(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
function cssSafeToken(v) {
  if (typeof v !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(v))
    throw new Error("Unsafe CSS token: " + JSON.stringify(String(v).slice(0, 32)));
  return v;
}

function harnessCssCompile(rules) {
  let css = "";
  const SELECTOR = ".probe";

  css += SELECTOR + " {\n";
  css += "  --sdf: -1;\n";
  css += "  --deny: \"\";\n";
  css += "  --reg: VALID;\n";
  css += "  --rt: UNCLASSIFIED;\n";
  css += "  --rth: 0;\n";
  css += "  --doc: BASIC;\n";
  css += "}\n\n";

  const sorted = sortRules(rules);

  for (const c of sorted) {
    let tail = "";
    for (const dim of Object.keys(c.when)) {
      const val = c.when[dim];
      tail += '[data-' + dim + '="' + val + '"]';
    }
    const decls = [];
    const t = c.then;
    if ("sdf"  in t) decls.push("--sdf: " + (t.sdf === 1 ? 1 : -1));
    if ("deny" in t) decls.push("--deny: \"" + cssEscapeString(t.deny) + "\"");
    if ("rt"   in t) decls.push("--rt: " + cssSafeToken(t.rt));
    if ("rth"  in t) decls.push("--rth: " + (t.rth | 0));
    if ("doc"  in t) decls.push("--doc: " + cssSafeToken(t.doc));
    if ("reg"  in t) decls.push("--reg: " + cssSafeToken(t.reg));
    if ("sdf" in t && t.sdf === 1) {
      decls.push("--reg: DENIED");
      decls.push("--rth: 0");
    }
    if (decls.length > 0) {
      css += SELECTOR + tail + " {\n  " + decls.join(";\n  ") + ";\n}\n";
    }
  }
  return css;
}

console.log("=== HARNESS-GENERATED CSS FOR scale-n4-s7-79 ===");
console.log("");
console.log(harnessCssCompile(fxRules));
