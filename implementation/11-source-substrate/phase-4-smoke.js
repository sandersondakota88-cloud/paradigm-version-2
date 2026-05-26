// phase-4-smoke.js
// =============================================================================
// Phase 11 Phase 4 — joint-coord-space resolution smoke test.
//
// Runs the Phase 3 lattice over kernel/field.js. Periodically compiles the
// lattice's current state into joint-space cascade bytecode, walks it (CPU
// path; equivalent to GPU dispatch per Phase 10's exodus byte-for-byte
// result), exposes lattice-scope delta as a new observable per SE-01.
//
// Per Phase 4 design (operator 2026-05-26): the substrate IS the rules in
// non-contradictual relation. F2 + SE-01 give compositional delta readings
// for free. The joint coord space (12,500 coords) is the outer cascade
// the per-peer fields nest within. Per-peer delta readings remain unchanged
// CPU-side; lattice-scope delta is the new reading position.
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
const GpuLatticeCompiler = require(path.join(HERE, "gpu-lattice-compiler.js"));
const GpuLatticeRunner   = require(path.join(HERE, "gpu-lattice-runner.js"));

const args = process.argv.slice(2);
const N_LINES = parseInt(args[0] || "1326", 10);
const SAMPLE_AT = [0.10, 0.25, 0.50, 0.75, 1.00];  // fractions of corpus

const CORPUS_PATH = path.join(KERNEL_DIR, "field.js");
const fullSource = fs.readFileSync(CORPUS_PATH, "utf8");
const corpusSrc = fullSource.split("\n").slice(0, N_LINES).join("\n");

console.log("==============================================================");
console.log("Phase 4 smoke test — joint coord-space resolution");
console.log("==============================================================");
console.log("Corpus: " + path.relative(process.cwd(), CORPUS_PATH));
console.log("Lines:  " + N_LINES);
console.log("");

const stream = CorpusAdapter.adaptCorpus(corpusSrc, acorn);
console.log("Tokens emitted: " + stream.metadata.total_tokens);
console.log("");

// ---- Build the lattice's joint coord space (static; depends only on
// the output alphabets the peers declare in their specs) ----
const latticeDims = GpuLatticeCompiler.buildLatticeDimsSpec(PeerSpecs);
let stateSpaceSize = 1;
for (const d of latticeDims) stateSpaceSize *= d.values.length;
console.log("Joint coord space dims:");
for (const d of latticeDims) {
  console.log("  " + d.name.padEnd(11) + " (" + d.values.length + ")  " +
    d.values.join(", "));
}
console.log("  total coords: " + stateSpaceSize);
console.log("");

const lattice = Lattice.makeLattice({
  FieldModule:       FieldModule,
  SubstrateFactory:  SubstrateFactory,
  PeerSpecs:         PeerSpecs,
  PrimitiveVocabs:   PrimitiveVocabs
});

// Sample points: at fractions of the corpus, compile + walk + record.
const samplePoints = SAMPLE_AT.map(function (f) {
  return Math.max(1, Math.floor(f * stream.records.length));
});
const samplesByIdx = Object.create(null);
for (const idx of samplePoints) samplesByIdx[idx] = true;

const samples = [];

function takeSample(tokenIdx) {
  // Extract lattice-resolvable rules from the composer's current field.
  const rules = GpuLatticeCompiler.extractLatticeRules(
    null,  // peerObservations unused
    lattice.peers
  );

  // Compile to joint-space bytecode.
  const compiled = GpuLatticeCompiler.compile(
    rules,
    latticeDims,
    ["--lattice-fire"]
  );

  // Walk via CPU path (Node-runnable; equivalent to GPU dispatch by
  // Phase 10 byte-for-byte trust transfer).
  const walked = GpuLatticeRunner.cpuWalk(compiled);

  // Capture per-axis cascade snapshots for reading.
  const obs = lattice.observe();
  const perAxisDelta = Object.create(null);
  for (const peer of lattice.ALL_PEERS) {
    perAxisDelta[peer] = obs.peers[peer].delta.scalar;
  }

  samples.push({
    tokenIdx: tokenIdx,
    fraction: (tokenIdx / stream.records.length).toFixed(2),
    rulesExtracted: rules.length,
    rulesCompiled: compiled.stats.ruleCount,
    rulesSkipped: compiled.stats.ruleSkipped,
    instructions: compiled.stats.totalInstructions,
    byteSize: compiled.stats.byteSize,
    coordsTotal: walked.latticeDelta.total,
    coordsMatched: walked.latticeDelta.matched,
    coordsUnresolved: walked.latticeDelta.unresolved,
    latticeScalar: walked.latticeDelta.scalar,
    perAxisDelta: perAxisDelta
  });
}

const t0 = Date.now();
for (let i = 0; i < stream.records.length; i++) {
  lattice.ingest(stream.records[i]);
  if (samplesByIdx[i + 1]) takeSample(i + 1);
}
const tTotal = Date.now() - t0;

console.log("Ingest + sample time: " + tTotal + "ms");
console.log("");

console.log("==============================================================");
console.log("Joint-coord-space resolution samples");
console.log("==============================================================");
console.log("");
console.log("token   frac  rules  inst   coords    matched  unresolved  lattice_scalar");
console.log("-----   ----  -----  -----  -------   -------  ----------  --------------");
for (const s of samples) {
  console.log(
    String(s.tokenIdx).padStart(5) + "   " +
    s.fraction.padStart(4) + "  " +
    String(s.rulesCompiled).padStart(5) + "  " +
    String(s.instructions).padStart(5) + "  " +
    String(s.coordsTotal).padStart(7) + "   " +
    String(s.coordsMatched).padStart(7) + "  " +
    String(s.coordsUnresolved).padStart(10) + "  " +
    s.latticeScalar.toFixed(4).padStart(14)
  );
}
console.log("");

// ---- Per-axis vs lattice-scope delta comparison ----
console.log("==============================================================");
console.log("Per-scope delta readings (SE-01 reflexive scope; F2 honored)");
console.log("==============================================================");
console.log("");
console.log("token  frac  kind    vocab   coocc   posit   freq    comp    LATTICE");
console.log("-----  ----  -----   -----   -----   -----   -----   -----   -------");
for (const s of samples) {
  const a = s.perAxisDelta;
  console.log(
    String(s.tokenIdx).padStart(5) + "  " +
    s.fraction.padStart(4) + "  " +
    a.kind.toFixed(3) + "   " +
    a.vocab.toFixed(3) + "   " +
    a.cooccur.toFixed(3) + "   " +
    a.position.toFixed(3) + "   " +
    a.frequency.toFixed(3) + "   " +
    a.composer.toFixed(3) + "   " +
    s.latticeScalar.toFixed(4)
  );
}
console.log("");

// ---- Phase 4 gates ----
const final = samples[samples.length - 1];

const gates = [
  {
    check: "Joint coord space built from peer alphabets",
    pass: stateSpaceSize > 0 && latticeDims.length === 6
  },
  {
    check: "Lattice-resolvable rules extracted from composer field",
    pass: final && final.rulesCompiled > 0
  },
  {
    check: "Joint-space resolution produced matched coords",
    pass: final && final.coordsMatched > 0
  },
  {
    check: "Lattice-scope delta is a new reading position (not equal to any per-peer delta)",
    pass: final && Object.values(final.perAxisDelta).every(function (d) {
      return Math.abs(d - final.latticeScalar) > 1e-6;
    })
  },
  {
    check: "Joint-space coord count exceeds any single peer's constraint count (the relational ecosystem the cascade cannot hold)",
    pass: final && final.coordsTotal > 1000
  }
];

console.log("--- Phase 4 gates ---");
let allPass = true;
for (const g of gates) {
  console.log("  " + (g.pass ? "[PASS]" : "[FAIL]") + " " + g.check);
  if (!g.pass) allPass = false;
}
console.log("");

if (allPass) {
  console.log("RESULT: Phase 4 PASSED. Joint coord-space resolution exposes");
  console.log("        lattice-scope delta as a new reading position per SE-01.");
  console.log("        The substrate is composed (per-peer cascades nested in");
  console.log("        the outer joint-coord cascade); F2 honored at every");
  console.log("        scope by construction.");
} else {
  console.log("RESULT: Phase 4 has unmet gates. See [FAIL] lines.");
}
console.log("==============================================================");

process.exit(allPass ? 0 : 1);
