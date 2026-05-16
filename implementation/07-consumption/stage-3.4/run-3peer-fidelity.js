// run-3peer-fidelity.js

"use strict";

const fs = require("fs");
const M1 = require("./stage1-lexical-typing-substrate.js");
const M2 = require("./stage2-emergent-structural-substrate.js");
const Mid = require("./stage2-identifier-substrate.js");
const Msa = require("./stage2-string-analysis-substrate.js");
const Mc3 = require("./composer-substrate-3peer.js");

function runThreePeer(label, source) {
  const t0 = Date.now();
  const sub1 = M1.createStage1Substrate({ id: label + "-s1", rowCap: 32768 });
  sub1.ingest(Buffer.from(source));
  const vsf1 = sub1.emitVsf();
  const stage1Rows = vsf1.split("\n---\n")[1].split("\n").filter(s => s.length > 0).length;

  const kp = M2.createStage2Substrate({ id: label + "-kp" });
  kp.ingestStage1Vsf(vsf1);
  const ks = kp.getState();

  const tp = Mid.createIdentifierSubstrate({ id: label + "-tp" });
  tp.ingestStage1Vsf(vsf1);
  const ts = tp.getState();

  const sp = Msa.createStringAnalysisSubstrate({ id: label + "-sp" });
  sp.ingestStage1Vsf(vsf1);
  const ss = sp.getState();

  const cmp = Mc3.createComposerSubstrate({ id: label + "-c3" });
  cmp.observe(ks, ts, ss);
  const cs = cmp.getState();

  const t1 = Date.now();

  return {
    label: label,
    elapsedMs: t1 - t0,
    sourceBytes: source.length,
    stage1Rows: stage1Rows,
    kindPeer: {
      constraints: ks.constraints.length,
      subcascades: ks.subcascades.map(sc => ({
        name: sc.name, family: sc.familyType,
        members: sc.memberIds.length, fid: sc.fidAtBirth
      }))
    },
    textPeer: {
      constraints: ts.constraints.length,
      subcascades: ts.subcascades.map(sc => ({
        name: sc.name, family: sc.familyType,
        members: sc.memberIds.length, fid: sc.fidAtBirth
      }))
    },
    stringPeer: {
      constraints: ss.constraints.length,
      subcascades: ss.subcascades.map(sc => ({
        name: sc.name, family: sc.familyType,
        members: sc.memberIds.length, fid: sc.fidAtBirth
      })),
      stringTokensSeen: ss.totalStringTokensSeen,
      subTokensSeen: ss.totalSubTokensSeen
    },
    composer: {
      constraints: cs.constraints.length,
      subcascades: cs.subcascades.map(sc => ({
        name: sc.name, family: sc.familyType,
        members: sc.memberIds.length, fid: sc.fidAtBirth
      })),
      familyBreakdown: countByFamily(cs.constraints),
      morphologicalBindings: extractMorphologicalBindings(cs)
    },
    domainPresence: domainPresence(ts, ss),
    rawStringPeerState: ss
  };
}

function countByFamily(constraints) {
  const out = {};
  for (const c of constraints) out[c.family] = (out[c.family] || 0) + 1;
  return out;
}

function extractMorphologicalBindings(compState) {
  const bindings = compState.constraints.filter(c => c.family === "morphological-bind");
  const compounds = {};
  for (const c of bindings) {
    const k = (c.pattern.compoundLhs || "?") + "-" + (c.pattern.compoundRhs || "?");
    if (!compounds[k]) compounds[k] = { uses: 0, bindings: 0 };
    compounds[k].uses += c.uses || 0;
    compounds[k].bindings++;
  }
  const sorted = Object.entries(compounds).sort((a, b) => b[1].uses - a[1].uses);
  return sorted.slice(0, 25);
}

function domainPresence(textState, stringState) {
  const dimensions = ["credit", "product", "applicant", "residency", "income", "employment"];
  const values = ["prime", "near-prime", "sub-prime", "mortgage", "personal", "auto", "business-line",
                  "individual", "joint", "business", "trust",
                  "domestic", "foreign", "diplomatic",
                  "under50", "50to100", "100to250", "over250",
                  "employed", "self-employed", "retired", "student", "unemployed"];
  const all = dimensions.concat(values);

  // Text axis: whole-token presence
  const textFound = {};
  for (const term of all) {
    const matches = textState.constraints.filter(c => {
      if (!c.pattern) return false;
      const text = c.pattern.text || "";
      return text === term || text === '"' + term + '"' || text === "'" + term + "'";
    });
    if (matches.length > 0) {
      textFound[term] = matches.reduce((s, c) => s + (c.uses || 0), 0);
    }
  }

  // String axis: sub-token and hyphen presence
  const stringFound = {};
  for (const term of all) {
    let totalUses = 0;
    for (const c of stringState.constraints) {
      if (!c.pattern) continue;
      const t = c.pattern.text;
      const lhs = c.pattern.prefix;
      const rhs = c.pattern.suffix;
      // For hyphenated terms, check both halves; for atomic, check direct
      if (t === term || lhs === term || rhs === term) {
        totalUses += c.uses || 0;
      }
      // For hyphenated terms like "sub-prime", also check the lhs-rhs
      // structure (if term is "sub-prime", look at constraints where
      // lhs="sub" and rhs="prime")
      if (term.indexOf("-") >= 0) {
        const idx = term.indexOf("-");
        const tLhs = term.substring(0, idx);
        const tRhs = term.substring(idx + 1);
        if (lhs === tLhs || rhs === tRhs) {
          // Already counted above if the constraint matches
        }
      }
    }
    if (totalUses > 0) stringFound[term] = totalUses;
  }

  return {
    text: Object.entries(textFound).sort((a, b) => b[1] - a[1]),
    string: Object.entries(stringFound).sort((a, b) => b[1] - a[1])
  };
}

// ============================================================================

function printRun(r) {
  console.log("\n" + "=".repeat(72));
  console.log("RUN: " + r.label);
  console.log("=".repeat(72));
  console.log("source: " + r.sourceBytes + " bytes, stage1 rows: " + r.stage1Rows + " (" + r.elapsedMs + "ms)");

  console.log("\n--- KIND PEER --- (" + r.kindPeer.constraints + " constraints)");
  for (const sc of r.kindPeer.subcascades) {
    console.log("  " + sc.name + "  members=" + sc.members + "  fid=" + sc.fid.toFixed(2));
  }

  console.log("\n--- TEXT PEER --- (" + r.textPeer.constraints + " constraints)");
  for (const sc of r.textPeer.subcascades) {
    console.log("  " + sc.name + "  members=" + sc.members + "  fid=" + sc.fid.toFixed(2));
  }

  console.log("\n--- STRING PEER --- (" + r.stringPeer.constraints + " constraints, " +
              r.stringPeer.stringTokensSeen + " strings observed, " + r.stringPeer.subTokensSeen + " sub-tokens)");
  for (const sc of r.stringPeer.subcascades) {
    console.log("  " + sc.name + "  members=" + sc.members + "  fid=" + sc.fid.toFixed(2));
  }

  console.log("\n--- COMPOSER --- (" + r.composer.constraints + " constraints)");
  console.log("  family breakdown: " + JSON.stringify(r.composer.familyBreakdown));
  console.log("  promoted sub-cascades:");
  if (r.composer.subcascades.length === 0) {
    console.log("    (none)");
  } else {
    for (const sc of r.composer.subcascades) {
      console.log("    " + sc.name + "  family=" + sc.family + "  members=" + sc.members + "  fid=" + sc.fid.toFixed(2));
    }
  }

  console.log("\n  MORPHOLOGICAL BINDINGS (top 15):");
  if (r.composer.morphologicalBindings.length === 0) {
    console.log("    (none surfaced)");
  } else {
    for (const [compound, info] of r.composer.morphologicalBindings.slice(0, 15)) {
      console.log("    " + compound.padEnd(30) + " uses=" + info.uses.toString().padStart(4) + " bindings=" + info.bindings);
    }
  }

  console.log("\n--- DOMAIN PRESENCE ---");
  console.log("  text axis (top 12): " + JSON.stringify(r.domainPresence.text.slice(0, 12)));
  console.log("  string axis (top 12): " + JSON.stringify(r.domainPresence.string.slice(0, 12)));
}

// ============================================================================

const inputs = [
  ["original",   fs.readFileSync("./canonical-source.html", "utf8")],
  ["min-format", fs.readFileSync("./canonical-min-a.html", "utf8")],
  ["min-rename", fs.readFileSync("./canonical-min-b.html", "utf8")],
  ["domain-fixt", fs.readFileSync("./constraints-only.js", "utf8")]
];

const results = {};
for (const [label, src] of inputs) {
  console.log("Running: " + label);
  results[label] = runThreePeer(label, src);
}

for (const label of Object.keys(results)) {
  printRun(results[label]);
}

// ============================================================================
// Cross-input structural fidelity comparison
// ============================================================================

console.log("\n" + "=".repeat(72));
console.log("CROSS-INPUT STRUCTURAL FIDELITY COMPARISON");
console.log("=".repeat(72));

const labels = Object.keys(results);
const compoundsAll = {};
for (const lbl of labels) {
  for (const [c, info] of results[lbl].composer.morphologicalBindings) {
    if (!compoundsAll[c]) compoundsAll[c] = {};
    compoundsAll[c][lbl] = info.uses;
  }
}

console.log("\nMorphological compound presence across runs:");
console.log("  compound".padEnd(30) + labels.map(l => l.padStart(11)).join(""));
console.log("  " + "-".repeat(28 + 11 * labels.length));
const sortedCompounds = Object.entries(compoundsAll)
  .map(([c, v]) => ({ c: c, total: Object.values(v).reduce((s, x) => s + x, 0), v: v }))
  .sort((a, b) => b.total - a.total);
for (const item of sortedCompounds.slice(0, 25)) {
  let line = "  " + item.c.padEnd(28);
  for (const lbl of labels) {
    line += (item.v[lbl] !== undefined ? item.v[lbl].toString() : "-").padStart(11);
  }
  console.log(line);
}

// Domain dimension presence in string axis across runs
console.log("\nDomain dimensions surfaced in STRING AXIS across runs:");
const domDims = ["credit", "product", "applicant", "residency", "income", "employment",
                 "prime", "near-prime", "sub-prime", "mortgage", "foreign", "trust",
                 "student", "unemployed", "under50", "business-line", "self-employed"];
console.log("  term".padEnd(20) + labels.map(l => l.padStart(11)).join(""));
console.log("  " + "-".repeat(18 + 11 * labels.length));
for (const term of domDims) {
  let line = "  " + term.padEnd(18);
  for (const lbl of labels) {
    const found = results[lbl].domainPresence.string.find(x => x[0] === term);
    line += (found ? found[1].toString() : "-").padStart(11);
  }
  console.log(line);
}

// Composer KIND_TEXT_BIND and MORPHOLOGICAL_BIND counts
console.log("\nComposer primitive firings across runs:");
console.log("  primitive".padEnd(22) + labels.map(l => l.padStart(11)).join(""));
console.log("  " + "-".repeat(20 + 11 * labels.length));
for (const fam of ["joint-recur", "joint-naming", "kind-text-bind", "morphological-bind"]) {
  let line = "  " + fam.padEnd(20);
  for (const lbl of labels) {
    const v = results[lbl].composer.familyBreakdown[fam];
    line += (v !== undefined ? v.toString() : "0").padStart(11);
  }
  console.log(line);
}

// Verdict
console.log("\n" + "=".repeat(72));
console.log("VERDICT");
console.log("=".repeat(72));

const morphOnDomain = (results["domain-fixt"].composer.familyBreakdown["morphological-bind"] || 0);
const morphOnOriginal = (results["original"].composer.familyBreakdown["morphological-bind"] || 0);
const morphOnMinFormat = (results["min-format"].composer.familyBreakdown["morphological-bind"] || 0);
const morphOnMinRename = (results["min-rename"].composer.familyBreakdown["morphological-bind"] || 0);

console.log("MORPHOLOGICAL_BIND firing counts:");
console.log("  domain fixture: " + morphOnDomain);
console.log("  original:       " + morphOnOriginal);
console.log("  min-format:     " + morphOnMinFormat);
console.log("  min-rename:     " + morphOnMinRename);
console.log("");

if (morphOnDomain > 0 && morphOnOriginal > 0) {
  console.log("STRUCTURAL FIDELITY: confirmed.");
  console.log("Three-axis composition surfaces morphological bindings on both");
  console.log("domain-dominant and full canonical inputs. The string analysis");
  console.log("axis is doing the load-bearing work the prior two axes alone");
  console.log("could not do: it makes string-internal structure visible to the");
  console.log("composer's intersection mechanism.");
} else if (morphOnDomain > 0) {
  console.log("PARTIAL FIDELITY: morphological bindings surface on domain-dominant");
  console.log("input but not on full canonical. Three-axis observation works; the");
  console.log("full canonical's signal-to-noise still requires Stage 1 refinement");
  console.log("or preparative representation for structural surfacing at scale.");
} else {
  console.log("NO FIDELITY DEMONSTRATED YET. Diagnose: check string peer surface,");
  console.log("composer firing thresholds, and Stage 1 row cap behavior.");
}
