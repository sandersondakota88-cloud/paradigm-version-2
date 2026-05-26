// phase-2-smoke.js
// =============================================================================
// Phase 2.5 deliverable. Per substrate-factory-spec.md §6:
//
// Instantiates one peer (defaults to kind-peer; configurable via CLI args),
// feeds each token through peer.ingest(token) in source-order, observes
// the trajectory: constraint counts per kind, fidelities per family,
// sub-cascade promotions, vector-delta over time.
//
// Falsification matrix (per spec §6):
//   - zero derived constraints       => vocab.generateDerivedFromNovelty wrong
//   - derived but no predictives     => gap never exceeds threshold OR
//                                       vocab coverage too narrow
//   - predictives but no ratifications => predictive `when` shape mismatches
//                                          actual input shapes
//   - ratifications but no promotions  => familyType wrong OR fidelity
//                                          threshold too high
//
// Each is a different diagnostic. The smoke test reports which stage of
// the canonical SE-05/K1 cycle does or does not happen.
//
// Per Phase 11 discipline (PLAN §2): no tuning to engineer outcomes.
// Whatever happens is the result.
// =============================================================================

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const HERE = __dirname;
const KERNEL_DIR = path.resolve(HERE, "..", "kernel");

// ---- Load dependencies ----
const acorn = require(path.join(HERE, "acorn.js"));
const FieldModule = require(path.join(KERNEL_DIR, "field.js"));
const SubstrateFactory = require(path.join(HERE, "substrate-factory.js"));
const PrimitiveVocabs = require(path.join(HERE, "primitive-vocabs.js"));
const CorpusAdapter = require(path.join(HERE, "corpus-adapter.js"));

// ---- CLI args ----
const args = process.argv.slice(2);
const PEER_AXIS = args[0] || "kind";       // kind | vocab | cooccur | position | frequency
const N_LINES = parseInt(args[1] || "50", 10);
const VERBOSE = args.indexOf("--verbose") >= 0;

if (!PrimitiveVocabs[PEER_AXIS]) {
  console.error("Unknown axis:", PEER_AXIS);
  console.error("Available:", Object.keys(PrimitiveVocabs).join(", "));
  process.exit(2);
}

// ---- Corpus selection ----
// For Phase 2 smoke: use the first N lines of field.js itself per spec §6.
// This is the smallest credible real source the substrate can ingest.
const CORPUS_PATH = path.join(KERNEL_DIR, "field.js");
const fullSource = fs.readFileSync(CORPUS_PATH, "utf8");
const lines = fullSource.split("\n");
const corpusSource = lines.slice(0, N_LINES).join("\n");

console.log("==============================================================");
console.log("Phase 2 smoke test");
console.log("==============================================================");
console.log("Corpus:        " + path.relative(process.cwd(), CORPUS_PATH));
console.log("Lines:         " + N_LINES + " (of " + lines.length + ")");
console.log("Source bytes:  " + corpusSource.length);
console.log("Peer axis:     " + PEER_AXIS);
console.log("");

// ---- Adapt ----
const t0 = Date.now();
const stream = CorpusAdapter.adaptCorpus(corpusSource, acorn);
const tAdapt = Date.now() - t0;

console.log("--- adapter ---");
console.log("Tokens emitted:   " + stream.metadata.total_tokens);
console.log("Distinct kinds:   " + stream.metadata.distinct_kinds);
console.log("Distinct texts:   " + stream.metadata.distinct_texts);
console.log("Parse errors:     " + stream.metadata.parse_errors.length);
console.log("Adapt time:       " + tAdapt + "ms");
if (stream.metadata.parse_errors.length > 0) {
  for (const e of stream.metadata.parse_errors) {
    console.log("  [" + e.phase + " err] " + e.message + " (pos " + e.pos + ")");
  }
}

// Quick distribution print so we can see what the adapter produced
if (VERBOSE) {
  const kindHist = Object.create(null);
  const posHist = Object.create(null);
  for (const r of stream.records) {
    kindHist[r.kind] = (kindHist[r.kind] || 0) + 1;
    posHist[r.position_class] = (posHist[r.position_class] || 0) + 1;
  }
  console.log("  kind histogram: " + JSON.stringify(kindHist));
  console.log("  position histogram: " + JSON.stringify(posHist));
}
console.log("");

// ---- Instantiate peer ----
const peer = SubstrateFactory.makePeer({
  FieldModule: FieldModule,
  id:          PEER_AXIS + "-peer",
  axis:        PEER_AXIS,
  primitiveVocab: PrimitiveVocabs[PEER_AXIS]
});

console.log("--- peer instantiated ---");
console.log("Peer id:          " + peer.id);
console.log("Peer axis:        " + peer.axis);
console.log("Initial constraints: " + peer.field.constraints.length + " (seed only)");
console.log("");

// ---- Ingest stream ----
console.log("--- ingesting " + stream.records.length + " tokens ---");
const t1 = Date.now();
const eventLog = [];

for (let i = 0; i < stream.records.length; i++) {
  const r = peer.ingest(stream.records[i]);
  if (r.ratified > 0 || r.promoted > 0) {
    eventLog.push({ tokenIdx: i, step: r.step, event: r });
  }
}
const tIngest = Date.now() - t1;
console.log("Ingest time:      " + tIngest + "ms");
console.log("Per-token avg:    " + (tIngest / stream.records.length).toFixed(3) + "ms");
console.log("");

// ---- Final observation ----
const obs = peer.observe();

console.log("==============================================================");
console.log("Phase 2 smoke result for " + obs.id);
console.log("==============================================================");
console.log("Steps:               " + obs.step);
console.log("");
console.log("Constraint counts by kind:");
for (const k of Object.keys(obs.constraintsByKind).sort()) {
  if (obs.constraintsByKind[k] > 0) {
    console.log("  " + k.padEnd(12) + " " + obs.constraintsByKind[k]);
  }
}
console.log("  total              " + obs.constraintTotal);
console.log("  ratifications      " + obs.ratCount);
console.log("");

console.log("Stats from cycle:");
console.log("  tokensIngested      " + obs.stats.tokensIngested);
console.log("  derivedGenerated    " + obs.stats.derivedGenerated);
console.log("  predictionsGenerated " + obs.stats.predictionsGenerated);
console.log("  ratificationsObserved " + obs.stats.ratificationsObserved);
console.log("  promotionsObserved   " + obs.stats.promotionsObserved);
console.log("  evictionsObserved    " + obs.stats.evictionsObserved);
console.log("");

console.log("Vector-delta:");
console.log("  scalar              " + obs.delta.scalar.toFixed(4));
console.log("  fast                " + obs.delta.fast.toFixed(4));
console.log("  slow                " + obs.delta.slow.toFixed(4));
console.log("  gap                 " + obs.delta.gap.toFixed(4));
console.log("");

console.log("Modulation:");
console.log("  fast                " + obs.mod.fast.toFixed(4));
console.log("  slow                " + obs.mod.slow.toFixed(4));
console.log("");

const famNames = Object.keys(obs.fidelities);
if (famNames.length > 0) {
  console.log("Family fidelities (avg delta-drop per family):");
  for (const fam of famNames.sort()) {
    const f = obs.fidelities[fam];
    console.log("  " + fam.padEnd(28) + " avg=" + f.avg.toFixed(4) +
      " fires=" + f.totalFires + " window=" + f.observations);
  }
  console.log("");
} else {
  console.log("Family fidelities: (none recorded)");
  console.log("");
}

if (obs.subcascades.length > 0) {
  console.log("Promoted sub-cascades:");
  for (const sc of obs.subcascades) {
    console.log("  " + sc.name + " (" + sc.familyType + ")  members=" +
      sc.memberCount + " fid@birth=" + sc.fidAtBirth.toFixed(4));
  }
  console.log("");
} else {
  console.log("Promoted sub-cascades: (none)");
  console.log("");
}

// ---- Falsification diagnosis ----
console.log("--- falsification diagnosis (spec §6) ---");
const checks = [
  ["derived constraints generated?",       obs.stats.derivedGenerated > 0],
  ["predictive constraints generated?",    obs.stats.predictionsGenerated > 0],
  ["ratifications observed?",              obs.stats.ratificationsObserved > 0],
  ["sub-cascade promotions observed?",     obs.stats.promotionsObserved > 0]
];
for (const [q, ok] of checks) {
  console.log("  " + (ok ? "[YES]" : "[NO] ") + " " + q);
}
console.log("");

if (!checks[0][1]) {
  console.log("DIAGNOSIS: vocab.generateDerivedFromNovelty produced zero output.");
  console.log("           Either novelty never exceeded GEN_NOVELTY_THRESH (=0.35)");
  console.log("           or the vocab declined to generate for every input.");
} else if (!checks[1][1]) {
  console.log("DIAGNOSIS: gap never exceeded GAP_PREDICT_THRESH (=0.12) OR");
  console.log("           vocab.generatePredictionsFromGap returned empty when it fired.");
  console.log("           Final gap reading: " + obs.delta.gap.toFixed(4));
} else if (!checks[2][1]) {
  console.log("DIAGNOSIS: predictives generated but no input matched any of them.");
  console.log("           The predictive `when` shape may not correspond to inputs the");
  console.log("           adapter actually produces from this corpus.");
} else if (!checks[3][1]) {
  console.log("DIAGNOSIS: ratifications happened but no family reached promotion threshold.");
  console.log("           FIDELITY_PROMOTE = 0.03, FIDELITY_MIN_FIRES = 3.");
  console.log("           Either fidelity averages stayed low or fires didn't accumulate.");
} else {
  console.log("DIAGNOSIS: full SE-05/K1 cycle observed on real source input. Phase 2");
  console.log("           earned its deliverable. Phase 3 (composer) can begin.");
}

console.log("");
console.log("==============================================================");

// Exit code for CI-friendliness: 0 if any constraint generation observed,
// 1 if nothing happened. Per the discipline, "nothing happened" is itself
// an honest finding -- but we mark it distinct.
process.exit(checks[0][1] ? 0 : 1);
