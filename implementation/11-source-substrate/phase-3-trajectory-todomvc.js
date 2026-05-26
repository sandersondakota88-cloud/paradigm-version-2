// phase-3-trajectory-todomvc.js
// =============================================================================
// External-corpus trajectory run: the TodoMVC javascript-es5 reference SPA.
//
// Corpus: tastejs/todomvc/examples/javascript-es5/src/*.js, concatenated.
// 7 files, 933 lines, ~29KB of conventional vanilla ES5 JavaScript.
// Files: helpers.js, store.js, model.js, template.js, view.js, controller.js,
// app.js — a classic MVC SPA split.
//
// Source: https://github.com/tastejs/todomvc/tree/master/examples/javascript-es5
// Fetched 2026-05-26. License: MIT (per tastejs/todomvc).
//
// This corpus is genuinely external (not authored for this project, not
// canon-coupled, traditionally architected) and provides a fair test of
// the lattice's behavior on conventional JavaScript.
// =============================================================================

"use strict";

const fs   = require("node:fs");
const path = require("node:path");

const HERE        = __dirname;
const PROJ_ROOT   = path.resolve(HERE, "..", "..");
const KERNEL_DIR  = path.resolve(HERE, "..", "kernel");
const acorn       = require(path.join(HERE, "acorn.js"));
const FieldModule = require(path.join(KERNEL_DIR, "field.js"));
const SubstrateFactory = require(path.join(HERE, "substrate-factory.js"));
const PrimitiveVocabs  = require(path.join(HERE, "primitive-vocabs.js"));
const CorpusAdapter    = require(path.join(HERE, "corpus-adapter.js"));
const PeerSpecs        = require(path.join(HERE, "peer-specs.js"));
const Lattice          = require(path.join(HERE, "lattice.js"));

const TODOMVC_PATH = path.join(PROJ_ROOT,
  "exodus", "external-corpora", "todomvc-vanilla-es5", "todomvc-combined.js");

const args = process.argv.slice(2);
const WINDOW_SIZE = parseInt(args[0] || "150", 10);
const OUT_PATH    = args[1] ||
  path.join(HERE, "phase-3-trajectory-todomvc.tsv");

const corpusSrc = fs.readFileSync(TODOMVC_PATH, "utf8");

console.log("==============================================================");
console.log("External-corpus trajectory — TodoMVC javascript-es5");
console.log("==============================================================");
console.log("Corpus:        " + path.relative(process.cwd(), TODOMVC_PATH));
console.log("Bytes:         " + corpusSrc.length);
console.log("Lines:         " + corpusSrc.split("\n").length);
console.log("Window size:   " + WINDOW_SIZE + " tokens");
console.log("");

const stream = CorpusAdapter.adaptCorpus(corpusSrc, acorn);
console.log("Tokens emitted:    " + stream.metadata.total_tokens);
console.log("Distinct kinds:    " + stream.metadata.distinct_kinds);
console.log("Distinct texts:    " + stream.metadata.distinct_texts);
console.log("Parse errors:      " + stream.metadata.parse_errors.length);
if (stream.metadata.parse_errors.length > 0) {
  for (const e of stream.metadata.parse_errors) {
    console.log("  [" + e.phase + "] " + e.message + " @ pos " + e.pos);
  }
}
console.log("");

const lattice = Lattice.makeLattice({
  FieldModule:       FieldModule,
  SubstrateFactory:  SubstrateFactory,
  PeerSpecs:         PeerSpecs,
  PrimitiveVocabs:   PrimitiveVocabs
});

const peers = lattice.ALL_PEERS;
const METRICS = [
  "derived", "predictive", "ratified", "promoted",
  "evictions", "inventions", "constraintTotal",
  "uniqueAlphabetCovered", "scalar", "gap"
];
const headerCols = ["window_end_token"];
for (const peer of peers) for (const m of METRICS) headerCols.push(peer + "." + m);
const rows = [headerCols.join("\t")];

const promotionEvents = [];
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
    const curSubs = o.subcascades.length;
    if (curSubs > subBaselines[peer]) {
      for (let i = subBaselines[peer]; i < curSubs; i++) {
        const sc = o.subcascades[i];
        promotionEvents.push({
          tokenIdx: tokenIdx, peer: peer,
          name: sc.name, family: sc.familyType,
          members: sc.memberCount, fidAtBirth: sc.fidAtBirth
        });
      }
      subBaselines[peer] = curSubs;
    }
  }
  rows.push(row.join("\t"));
}

const t0 = Date.now();
for (let i = 0; i < stream.records.length; i++) {
  lattice.ingest(stream.records[i]);
  if ((i + 1) % WINDOW_SIZE === 0 || i === stream.records.length - 1) {
    snapshotRow(i + 1);
  }
}
const tIngest = Date.now() - t0;

console.log("Ingest+sample time: " + tIngest + "ms (" +
  (tIngest / stream.records.length).toFixed(3) + "ms/token across 6 peers)");
console.log("Windows captured:   " + (rows.length - 1));
console.log("Promotion events:   " + promotionEvents.length);
console.log("");

fs.writeFileSync(OUT_PATH, rows.join("\n") + "\n", "utf8");
const PROMO_PATH = OUT_PATH.replace(/\.tsv$/, "-promotions.tsv");
const promoLog = [["token_idx", "peer", "name", "family", "members", "fid_at_birth"].join("\t")];
for (const ev of promotionEvents) {
  promoLog.push([String(ev.tokenIdx), ev.peer, ev.name, ev.family,
                 String(ev.members), ev.fidAtBirth.toFixed(4)].join("\t"));
}
fs.writeFileSync(PROMO_PATH, promoLog.join("\n") + "\n", "utf8");

console.log("Trajectory TSV:    " + path.relative(process.cwd(), OUT_PATH));
console.log("Promotion log:     " + path.relative(process.cwd(), PROMO_PATH));
console.log("");

// ---- Per-axis productivity shape (early vs. late half) ----
console.log("==============================================================");
console.log("Productivity shape (per-peer)");
console.log("==============================================================");
console.log("peer        early_d  late_d  ratio  shape");
console.log("--------    -------  ------  -----  -----");

if (rows.length - 1 >= 4) {
  const data = rows.slice(1).map(function (r) { return r.split("\t"); });
  const midIdx = Math.floor(data.length / 2);
  for (const peer of peers) {
    const colOffset = 1 + peers.indexOf(peer) * METRICS.length;
    const derivedCol = colOffset + 0;
    const earlyEnd = parseInt(data[midIdx - 1][derivedCol], 10);
    const lateEnd = parseInt(data[data.length - 1][derivedCol], 10);
    const earlyGrowth = earlyEnd;
    const lateGrowth = lateEnd - earlyEnd;
    const ratio = earlyGrowth === 0 ? "—" : (lateGrowth / earlyGrowth).toFixed(2);
    let shape;
    if (earlyGrowth === 0 && lateGrowth === 0)  shape = "INERT";
    else if (lateGrowth === 0)                  shape = "TERMINAL";
    else if (lateGrowth >= earlyGrowth * 0.8)   shape = "O1-like (sustained)";
    else if (lateGrowth >= earlyGrowth * 0.3)   shape = "O2-like (slowing)";
    else                                         shape = "O2/O3-like (heavy saturation)";
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

// ---- Final per-peer summary ----
console.log("==============================================================");
console.log("Final per-peer summary");
console.log("==============================================================");
const obs = lattice.observe();
console.log("peer        derived  preds  rat   prom  inv   sub  cons  alphabet  gap");
console.log("--------    -------  -----  ----  ----  ----  ---  ----  --------  ----");
for (const peer of peers) {
  const o = obs.peers[peer];
  const ic = o.intakeConfig || {};
  const counts = ic.outputCounts || {};
  const covered = Object.keys(counts).length;
  const alphabetSize = (ic.alphabet || []).length;
  console.log(
    peer.padEnd(11) + " " +
    String(o.stats.derivedGenerated).padStart(7) + "  " +
    String(o.stats.predictionsGenerated).padStart(5) + "  " +
    String(o.stats.ratificationsObserved).padStart(4) + "  " +
    String(o.stats.promotionsObserved).padStart(4) + "  " +
    String(o.stats.inventionsGenerated).padStart(4) + "  " +
    String(o.subcascades.length).padStart(3) + "  " +
    String(o.constraintTotal).padStart(4) + "  " +
    (covered + "/" + alphabetSize).padStart(8) + "  " +
    o.delta.gap.toFixed(3)
  );
}
console.log("");

let totalSub = 0;
for (const peer of peers) totalSub += obs.peers[peer].subcascades.length;
console.log("Total promoted sub-cascades across lattice: " + totalSub);
console.log("");
console.log("Promotion timeline:");
for (const ev of promotionEvents) {
  console.log("  token " + String(ev.tokenIdx).padStart(5) + "  " +
    ev.peer.padEnd(11) + " " + ev.name.padEnd(30) +
    " family=" + ev.family.padEnd(36) +
    " m=" + String(ev.members).padStart(3) +
    " fid@birth=" + ev.fidAtBirth.toFixed(4));
}
console.log("");
console.log("==============================================================");
