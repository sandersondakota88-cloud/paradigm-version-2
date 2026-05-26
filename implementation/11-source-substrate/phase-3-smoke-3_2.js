// phase-3-smoke-3_2.js
// =============================================================================
// Phase 3.2 smoke test. Instantiates each of the five intake-configured peers
// in isolation against the corpus, reports per-peer trajectory.
//
// Per phase-3-spec.md Phase 3.2 scope: per peer in ISOLATION. No cross-peer
// wiring (that's Phase 3.3). Each peer runs against the corpus alone.
//
// Per phase-3-spec.md Phase 3.2 falsification: if an output alphabet cannot
// be written using substrate-internal vocabulary only, halt and re-examine
// the axis's discriminative surface. Since peer-specs.js was written with
// substrate-internal vocabulary throughout, no axis halts this smoke test.
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

// ---- CLI ----
const args = process.argv.slice(2);
const N_LINES = parseInt(args[0] || "1326", 10);
const onlyAxis = args[1] || null;   // optional: run a single axis

// ---- Corpus ----
const CORPUS_PATH = path.join(KERNEL_DIR, "field.js");
const fullSource  = fs.readFileSync(CORPUS_PATH, "utf8");
const corpusSrc   = fullSource.split("\n").slice(0, N_LINES).join("\n");

console.log("==============================================================");
console.log("Phase 3.2 smoke test — five peers in isolation");
console.log("==============================================================");
console.log("Corpus:        " + path.relative(process.cwd(), CORPUS_PATH));
console.log("Lines:         " + N_LINES);
if (onlyAxis) console.log("Only axis:     " + onlyAxis);
console.log("");

const stream = CorpusAdapter.adaptCorpus(corpusSrc, acorn);
console.log("Tokens emitted:   " + stream.metadata.total_tokens);
console.log("Distinct kinds:   " + stream.metadata.distinct_kinds);
console.log("");

const AXES = onlyAxis ? [onlyAxis] : ["kind", "vocab", "cooccur", "position", "frequency"];

const summary = [];

for (const axis of AXES) {
  const spec = PeerSpecs[axis];
  const vocab = PrimitiveVocabs[axis];
  if (!spec || !vocab) {
    console.error("Skipping axis " + axis + " (no spec or vocab)");
    continue;
  }

  console.log("--- axis: " + axis + " ---");

  let peer;
  try {
    peer = SubstrateFactory.makePeer({
      FieldModule:    FieldModule,
      id:             axis + "-peer-intake",
      axis:           axis,
      primitiveVocab: vocab,
      dimsFn:         spec.dimsFn,
      tokensFn:       spec.tokensFn,
      outputVar:      spec.outputVar,
      defaultOutput:  spec.defaultOutput,
      outputAlphabet: spec.outputAlphabet,
      domainRules:    spec.domainRules,
      centroids:      spec.centroids,
      onRatify:       spec.onRatify
    });
  } catch (e) {
    console.error("FALSIFICATION on axis " + axis + ": " + e.message);
    process.exit(2);
  }

  const t0 = Date.now();
  for (const r of stream.records) peer.ingest(r);
  const tIngest = Date.now() - t0;

  const obs = peer.observe();

  // Find a few representative output samples by walking the token stream
  // again (just for log output — small subset)
  const sampleStream = stream.records.slice(0, 5).concat(
    stream.records.slice(Math.floor(stream.records.length / 2),
                         Math.floor(stream.records.length / 2) + 3)
  );

  console.log("  outputVar:           " + obs.intakeConfig.outputVar);
  console.log("  alphabet size:       " + obs.intakeConfig.alphabet.length);
  console.log("  final lastOutput:    " + obs.intakeConfig.lastOutput);
  console.log("  outputResolutions:   " + obs.stats.outputResolutions);
  console.log("");
  console.log("  Output token frequencies:");
  const counts = obs.intakeConfig.outputCounts;
  const sortedKeys = Object.keys(counts).sort(function (a, b) {
    return counts[b] - counts[a];
  });
  for (const k of sortedKeys) {
    const pct = (100 * counts[k] / obs.stats.outputResolutions).toFixed(1);
    console.log("    " + k.padEnd(28) + " " + counts[k] + " (" + pct + "%)");
  }
  // Check for uncovered alphabet members
  const uncovered = obs.intakeConfig.alphabet.filter(function (a) {
    return !counts[a];
  });
  if (uncovered.length > 0) {
    console.log("  Uncovered alphabet:  " + uncovered.join(", "));
  }
  console.log("");

  console.log("  Canonical cycle:");
  console.log("    derivedGenerated      " + obs.stats.derivedGenerated);
  console.log("    predictionsGenerated  " + obs.stats.predictionsGenerated);
  console.log("    ratificationsObserved " + obs.stats.ratificationsObserved);
  console.log("    promotionsObserved    " + obs.stats.promotionsObserved);
  console.log("    evictionsObserved     " + obs.stats.evictionsObserved);
  console.log("    inventionsGenerated   " + obs.stats.inventionsGenerated);
  console.log("");

  if (obs.subcascades.length > 0) {
    console.log("  Promoted sub-cascades (" + obs.subcascades.length + "):");
    for (const sc of obs.subcascades.slice(0, 5)) {
      console.log("    " + sc.name.padEnd(28) + " family=" + sc.familyType +
                  " members=" + sc.memberCount + " fid@birth=" + sc.fidAtBirth.toFixed(4));
    }
    if (obs.subcascades.length > 5) {
      console.log("    ... and " + (obs.subcascades.length - 5) + " more");
    }
  } else {
    console.log("  Promoted sub-cascades: (none)");
  }
  console.log("");

  console.log("  Vector-delta:");
  console.log("    scalar               " + obs.delta.scalar.toFixed(4));
  console.log("    fast                 " + obs.delta.fast.toFixed(4));
  console.log("    slow                 " + obs.delta.slow.toFixed(4));
  console.log("    gap                  " + obs.delta.gap.toFixed(4));
  console.log("");

  console.log("  Ingest time:         " + tIngest + "ms (" +
    (tIngest / stream.records.length).toFixed(3) + "ms / token)");
  console.log("");

  summary.push({
    axis:                axis,
    derived:             obs.stats.derivedGenerated,
    predictions:         obs.stats.predictionsGenerated,
    ratifications:       obs.stats.ratificationsObserved,
    promotions:          obs.stats.promotionsObserved,
    inventions:          obs.stats.inventionsGenerated,
    subcascades:         obs.subcascades.length,
    alphabetCovered:     sortedKeys.length,
    alphabetSize:        obs.intakeConfig.alphabet.length,
    uncovered:           uncovered,
    gap:                 obs.delta.gap,
    scalar:              obs.delta.scalar
  });
}

// ---- Summary table ----
console.log("==============================================================");
console.log("Phase 3.2 summary (per-peer in isolation)");
console.log("==============================================================");
console.log("");
console.log("axis        derived  preds  rat  prom  inv  sub  alpha   gap");
console.log("--------    -------  -----  ---  ----  ---  ---  -----   ----");
for (const s of summary) {
  console.log(
    s.axis.padEnd(11) + " " +
    String(s.derived).padStart(7) + "  " +
    String(s.predictions).padStart(5) + "  " +
    String(s.ratifications).padStart(3) + "  " +
    String(s.promotions).padStart(4) + "  " +
    String(s.inventions).padStart(3) + "  " +
    String(s.subcascades).padStart(3) + "  " +
    (s.alphabetCovered + "/" + s.alphabetSize).padStart(5) + "  " +
    s.gap.toFixed(3)
  );
}
console.log("");

// ---- Phase 3.2 gates ----
const gates = [];
for (const s of summary) {
  gates.push({
    axis:  s.axis,
    check: "alphabet has ≥2 outputs (substrate discriminates)",
    pass:  s.alphabetCovered >= 2
  });
  gates.push({
    axis:  s.axis,
    check: "canonical cycle still runs",
    pass:  s.derived > 0
  });
  if (s.ratifications > 0) {
    gates.push({
      axis:  s.axis,
      check: "invention occurred at ratification (Phase 2 gap C)",
      pass:  s.inventions > 0
    });
  }
}

console.log("--- Phase 3.2 per-axis gates ---");
let allPass = true;
for (const g of gates) {
  console.log("  " + (g.pass ? "[PASS]" : "[FAIL]") + " " +
    g.axis.padEnd(11) + " " + g.check);
  if (!g.pass) allPass = false;
}
console.log("");

if (allPass) {
  console.log("RESULT: Phase 3.2 PASSED. Five axis-intake configs run in");
  console.log("        isolation. Each peer's settling produces output tokens");
  console.log("        from its alphabet and invents at ratification.");
  console.log("        Phase 3.3 (cross-channels + composer) can begin.");
} else {
  console.log("RESULT: Phase 3.2 FAILED on one or more axes. See [FAIL]");
  console.log("        lines above. Halting per phase-3-spec.md §4.2.");
}
console.log("==============================================================");

process.exit(allPass ? 0 : 1);
