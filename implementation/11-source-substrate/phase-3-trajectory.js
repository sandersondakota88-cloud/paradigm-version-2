// phase-3-trajectory.js
// =============================================================================
// Phase 11 Phase 3.4 — windowed trajectory capture for the six-peer lattice.
//
// Per phase-3-spec.md §4.4: capture per-peer trajectory (constraint counts,
// ratification rates, promotion events, inventions, output token frequency)
// over the full corpus to support analysis against the canon's O1/O2/O3
// framework from canon/UTF/research/open-input-test-plan.md §1:
//
//   O1 — sustained productivity across the full corpus
//   O2 — input-driven saturation (vocab grows until input discriminative
//        demand saturates, then freezes; same pattern at higher saturation
//        point than Phase 2)
//   O3 — substrate-intrinsic lock (vocabulary growth stops well before input
//        diversity is exhausted)
//
// Sampling: every WINDOW_SIZE tokens we snapshot per-peer state. The TSV
// output is what phase-3-trajectory.md analyzes.
//
// Per discipline §2.5: honest reporting. The trajectory log is the raw
// data; the analysis doc names the shape we read.
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
const N_LINES     = parseInt(args[0] || "1326", 10);
const WINDOW_SIZE = parseInt(args[1] || "250", 10);
const OUT_PATH    = args[2] || path.join(HERE, "phase-3-trajectory.tsv");

const CORPUS_PATH = path.join(KERNEL_DIR, "field.js");
const fullSource  = fs.readFileSync(CORPUS_PATH, "utf8");
const corpusSrc   = fullSource.split("\n").slice(0, N_LINES).join("\n");

console.log("==============================================================");
console.log("Phase 3.4 trajectory capture");
console.log("==============================================================");
console.log("Corpus:        " + path.relative(process.cwd(), CORPUS_PATH));
console.log("Lines:         " + N_LINES);
console.log("Window size:   " + WINDOW_SIZE + " tokens");
console.log("Output TSV:    " + path.relative(process.cwd(), OUT_PATH));
console.log("");

const stream = CorpusAdapter.adaptCorpus(corpusSrc, acorn);
console.log("Tokens emitted: " + stream.metadata.total_tokens);
console.log("");

const lattice = Lattice.makeLattice({
  FieldModule:       FieldModule,
  SubstrateFactory:  SubstrateFactory,
  PeerSpecs:         PeerSpecs,
  PrimitiveVocabs:   PrimitiveVocabs
});

// ---- TSV header ----
// One row per (window, peer). Wide format is easier to read than long;
// we use one header row plus per-window rows with all six peers' metrics.
const peers = lattice.ALL_PEERS;
const METRICS = [
  "derived", "predictive", "ratified", "promoted",
  "evictions", "inventions", "constraintTotal",
  "uniqueAlphabetCovered", "scalar", "gap"
];

const headerCols = ["window_end_token"];
for (const peer of peers) {
  for (const m of METRICS) {
    headerCols.push(peer + "." + m);
  }
}
const rows = [];
rows.push(headerCols.join("\t"));

// Promotion events captured separately for the analysis doc
const promotionEvents = [];   // { tokenIdx, peer, subcascade, family, members, fidAtBirth }
const subBaselines = Object.create(null);
for (const p of peers) subBaselines[p] = 0;

function snapshotRow(tokenIdx) {
  const obs = lattice.observe();
  const row = [String(tokenIdx)];
  for (const peer of peers) {
    const o = obs.peers[peer];
    const ic = o.intakeConfig || {};
    const counts = ic.outputCounts || {};
    const covered = Object.keys(counts).length;

    row.push(String(o.stats.derivedGenerated));
    row.push(String(o.stats.predictionsGenerated));
    row.push(String(o.stats.ratificationsObserved));
    row.push(String(o.stats.promotionsObserved));
    row.push(String(o.stats.evictionsObserved));
    row.push(String(o.stats.inventionsGenerated));
    row.push(String(o.constraintTotal));
    row.push(String(covered));
    row.push(o.delta.scalar.toFixed(4));
    row.push(o.delta.gap.toFixed(4));

    // New promotions since last snapshot?
    const curSubs = o.subcascades.length;
    if (curSubs > subBaselines[peer]) {
      // Capture each new subcascade
      for (let i = subBaselines[peer]; i < curSubs; i++) {
        const sc = o.subcascades[i];
        promotionEvents.push({
          tokenIdx: tokenIdx,
          peer: peer,
          name: sc.name,
          family: sc.familyType,
          members: sc.memberCount,
          fidAtBirth: sc.fidAtBirth
        });
      }
      subBaselines[peer] = curSubs;
    }
  }
  rows.push(row.join("\t"));
}

// ---- Run ingest + sample ----
const t0 = Date.now();
for (let i = 0; i < stream.records.length; i++) {
  lattice.ingest(stream.records[i]);
  if ((i + 1) % WINDOW_SIZE === 0 || i === stream.records.length - 1) {
    snapshotRow(i + 1);
  }
}
const tIngest = Date.now() - t0;

console.log("Ingest + sample time: " + tIngest + "ms (" +
  (tIngest / stream.records.length).toFixed(3) + "ms/token across 6 peers)");
console.log("Windows captured: " + (rows.length - 1));
console.log("Promotion events: " + promotionEvents.length);
console.log("");

// ---- Write TSV ----
fs.writeFileSync(OUT_PATH, rows.join("\n") + "\n", "utf8");

// ---- Write promotion event log ----
const promoLog = [["token_idx", "peer", "name", "family", "members", "fid_at_birth"].join("\t")];
for (const ev of promotionEvents) {
  promoLog.push([
    String(ev.tokenIdx), ev.peer, ev.name, ev.family,
    String(ev.members), ev.fidAtBirth.toFixed(4)
  ].join("\t"));
}
const PROMO_PATH = OUT_PATH.replace(/\.tsv$/, "-promotions.tsv");
fs.writeFileSync(PROMO_PATH, promoLog.join("\n") + "\n", "utf8");

console.log("Trajectory TSV written:   " + path.relative(process.cwd(), OUT_PATH));
console.log("Promotion log written:    " + path.relative(process.cwd(), PROMO_PATH));
console.log("");

// ---- Per-axis productivity-shape readout ----
// For each peer, compare derivedGenerated growth in first vs. last half
// of the run; classify as O1 (sustained), O2 (saturating), or O3 (locked).
console.log("==============================================================");
console.log("Productivity shape (preliminary read, raw counts in TSV)");
console.log("==============================================================");
console.log("");
console.log("peer        early_d  late_d  ratio  shape");
console.log("--------    -------  ------  -----  -----");

// We need at least 4 windows for meaningful early/late split
if (rows.length - 1 >= 4) {
  const data = rows.slice(1).map(function (r) { return r.split("\t"); });
  const midIdx = Math.floor(data.length / 2);
  for (const peer of peers) {
    const colOffset = 1 + peers.indexOf(peer) * METRICS.length;
    const derivedCol = colOffset + 0;
    const earlyEnd = parseInt(data[midIdx - 1][derivedCol], 10);
    const earlyStart = 0;
    const lateEnd = parseInt(data[data.length - 1][derivedCol], 10);
    const lateStart = earlyEnd;
    const earlyGrowth = earlyEnd - earlyStart;
    const lateGrowth = lateEnd - lateStart;
    const ratio = earlyGrowth === 0 ? "—" : (lateGrowth / earlyGrowth).toFixed(2);
    let shape;
    if (earlyGrowth === 0 && lateGrowth === 0) {
      shape = "INERT (no derivation ever)";
    } else if (lateGrowth === 0) {
      shape = "TERMINAL (locked or saturated)";
    } else if (lateGrowth >= earlyGrowth * 0.8) {
      shape = "O1-like (sustained)";
    } else if (lateGrowth >= earlyGrowth * 0.3) {
      shape = "O2-like (slowing)";
    } else {
      shape = "O2/O3-like (heavy saturation)";
    }
    console.log(
      peer.padEnd(11) + " " +
      String(earlyGrowth).padStart(7) + "  " +
      String(lateGrowth).padStart(6) + "  " +
      String(ratio).padStart(5) + "  " +
      shape
    );
  }
}

console.log("");
console.log("Promotion timeline (first 20):");
for (const ev of promotionEvents.slice(0, 20)) {
  console.log("  token " + String(ev.tokenIdx).padStart(5) + "  " +
    ev.peer.padEnd(11) + " " + ev.name.padEnd(30) +
    " family=" + ev.family.padEnd(28) +
    " m=" + String(ev.members).padStart(3) +
    " fid@birth=" + ev.fidAtBirth.toFixed(4));
}
if (promotionEvents.length > 20) {
  console.log("  ... and " + (promotionEvents.length - 20) + " more (see promotions TSV)");
}
console.log("");
console.log("==============================================================");
