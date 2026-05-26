// phase-5-projection-smoke.js
// =============================================================================
// Phase 5.6 — falsification check for the 2D projection.
//
// PLAN §3 Phase 5 falsification: "if the cascade-resolved 2D layout produces
// a meaningless cluster (e.g., everything stacks at origin because no
// signature differentiates), Phase 5 halts."
//
// This Node smoke runs the lattice over the corpus, emulates source-nav.html's
// projection computation, and reports the cluster distribution:
//   - how many distinct (composer, kind, position, frequency) tuples appear
//   - how concentrated the distribution is (Gini-like ratio: top-1 cluster
//     size / total; top-5 / total)
//   - whether dots are spread across the 2D plane or stack in one cell
//
// Discipline note (§2.5): we report whatever distribution arises. We do NOT
// retune to make the projection look prettier.
// =============================================================================

"use strict";

const fs   = require("node:fs");
const path = require("node:path");

const HERE        = __dirname;
const KERNEL_DIR  = path.resolve(HERE, "..", "kernel");
const acorn       = require(path.join(HERE, "acorn.js"));
const FieldModule = require(path.join(KERNEL_DIR, "field.js"));
const SubstrateFactory = require(path.join(HERE, "substrate-factory.js"));
const PrimitiveVocabs  = require(path.join(HERE, "primitive-vocabs.js"));
const CorpusAdapter    = require(path.join(HERE, "corpus-adapter.js"));
const PeerSpecs        = require(path.join(HERE, "peer-specs.js"));
const Lattice          = require(path.join(HERE, "lattice.js"));

const args = process.argv.slice(2);
const N_LINES = parseInt(args[0] || "1326", 10);

const CORPUS_PATH = path.join(KERNEL_DIR, "field.js");
const corpusSrc = fs.readFileSync(CORPUS_PATH, "utf8").split("\n").slice(0, N_LINES).join("\n");
const stream = CorpusAdapter.adaptCorpus(corpusSrc, acorn);

console.log("==============================================================");
console.log("Phase 5.6 — 2D projection distribution falsification check");
console.log("==============================================================");
console.log("Corpus: " + path.relative(process.cwd(), CORPUS_PATH));
console.log("Tokens: " + stream.metadata.total_tokens);
console.log("");

const lattice = Lattice.makeLattice({
  FieldModule:      FieldModule,
  SubstrateFactory: SubstrateFactory,
  PeerSpecs:        PeerSpecs,
  PrimitiveVocabs:  PrimitiveVocabs
});

const perTokenOutputs = new Array(stream.records.length);
for (let i = 0; i < stream.records.length; i++) {
  lattice.ingest(stream.records[i]);
  const snap = Object.create(null);
  for (const axis of lattice.ALL_PEERS) {
    snap[axis] = lattice.peers[axis].getLastOutput();
  }
  perTokenOutputs[i] = snap;
}

// Replicate source-nav.html's renderProjection() clustering
const composerVals = PeerSpecs.composer.outputAlphabet;
const kindVals = PeerSpecs.kind.outputAlphabet;
const positionVals = PeerSpecs.position.outputAlphabet;
const freqVals = PeerSpecs.frequency.outputAlphabet;
const xCells = composerVals.length * kindVals.length;
const yCells = positionVals.length * freqVals.length;
const totalCells = xCells * yCells;

console.log("Projection grid:");
console.log("  x axis: composer (" + composerVals.length + ") × kind (" + kindVals.length + ") = " + xCells + " cells");
console.log("  y axis: position (" + positionVals.length + ") × frequency (" + freqVals.length + ") = " + yCells + " cells");
console.log("  total 2D cells: " + totalCells);
console.log("");

const clusters = Object.create(null);
let degenerateOriginCount = 0;
for (let i = 0; i < stream.records.length; i++) {
  const o = perTokenOutputs[i];
  if (!o) continue;
  const cIdx = composerVals.indexOf(o.composer);
  const kIdx = kindVals.indexOf(o.kind);
  const pIdx = positionVals.indexOf(o.position);
  const fIdx = freqVals.indexOf(o.frequency);
  if (cIdx < 0 || kIdx < 0 || pIdx < 0 || fIdx < 0) {
    degenerateOriginCount++;
    continue;
  }
  const key = cIdx + ":" + kIdx + ":" + pIdx + ":" + fIdx;
  if (!clusters[key]) clusters[key] = { keys: { cIdx, kIdx, pIdx, fIdx }, count: 0 };
  clusters[key].count++;
}

const clusterList = Object.values(clusters).sort(function (a, b) { return b.count - a.count; });
const distinctClusters = clusterList.length;
const totalTokens = stream.records.length;
const top1Share = clusterList[0].count / totalTokens;
const top5Share = clusterList.slice(0, 5).reduce(function (s, c) { return s + c.count; }, 0) / totalTokens;
const cellCoverage = distinctClusters / totalCells;

console.log("Cluster distribution:");
console.log("  distinct (composer × kind × position × freq) tuples: " + distinctClusters);
console.log("  cell coverage:    " + (cellCoverage * 100).toFixed(1) + "% of " + totalCells + " cells");
console.log("  top-1 cluster:    " + clusterList[0].count + " tokens (" + (top1Share * 100).toFixed(1) + "% of all tokens)");
console.log("  top-5 share:      " + (top5Share * 100).toFixed(1) + "%");
console.log("  degenerate (axis output not in alphabet): " + degenerateOriginCount);
console.log("");

console.log("Top 10 clusters:");
for (let i = 0; i < Math.min(10, clusterList.length); i++) {
  const c = clusterList[i];
  console.log("  " + String(c.count).padStart(4) + "  " +
    "[" + composerVals[c.keys.cIdx] + " · " + kindVals[c.keys.kIdx] +
    " · " + positionVals[c.keys.pIdx] + " · " + freqVals[c.keys.fIdx] + "]");
}
console.log("");

// Falsification gates per PLAN §3 Phase 5
const gates = [
  {
    check: "distinct clusters >= 5 (projection not degenerate)",
    pass: distinctClusters >= 5
  },
  {
    check: "top-1 cluster < 80% of tokens (no single-point stack)",
    pass: top1Share < 0.8
  },
  {
    check: "cell coverage >= 5% (substrate's discriminations spread over multiple regions)",
    pass: cellCoverage >= 0.05
  },
  {
    check: "no degenerate tokens (all per-token outputs map to known alphabet)",
    pass: degenerateOriginCount === 0
  }
];

console.log("--- Phase 5 falsification gates (PLAN §3 Phase 5) ---");
let allPass = true;
for (const g of gates) {
  console.log("  " + (g.pass ? "[PASS]" : "[FAIL]") + " " + g.check);
  if (!g.pass) allPass = false;
}
console.log("");

if (allPass) {
  console.log("RESULT: Phase 5.6 PASSED. 2D projection distribution is");
  console.log("        non-degenerate; the substrate's discriminations spread");
  console.log("        across the cascade-resolved 2D plane. PLAN §3 Phase 5");
  console.log("        falsification condition does not trip.");
} else {
  console.log("RESULT: Phase 5.6 has unmet gates. PLAN §3 Phase 5 falsification");
  console.log("        tripped. Halt Phase 5 deliverable; diagnose whether");
  console.log("        the failure is in the cascade rules or in the substrate.");
}
console.log("==============================================================");

process.exit(allPass ? 0 : 1);
