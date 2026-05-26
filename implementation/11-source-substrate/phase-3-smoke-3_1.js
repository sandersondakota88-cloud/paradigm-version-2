// phase-3-smoke-3_1.js
// =============================================================================
// Phase 3.1 smoke test. Verifies makePeer hosts an intake-configuration spec
// (dimsFn / tokensFn / domainRules / outputVar / centroids / onRatify) without
// requiring canonical Field changes.
//
// Per phase-3-spec.md Phase 3.1 falsification condition: if makePeer cannot
// host the intake-config spec without modifying implementation/kernel/field.js,
// this test halts and we record a kernel gap.
//
// This is a MINIMAL intake-config — just enough to exercise the kernel's
// support for the spec shape. Phase 3.2 authors the full five-axis configs.
// The point of Phase 3.1 is the kernel gate, not the axis content.
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

// ---- Corpus: same as Phase 2 (kernel/field.js, first 50 lines) ----
const CORPUS_PATH = path.join(KERNEL_DIR, "field.js");
const fullSource  = fs.readFileSync(CORPUS_PATH, "utf8");
const N_LINES     = parseInt(process.argv[2] || "50", 10);
const lines       = fullSource.split("\n");
const corpusSrc   = lines.slice(0, N_LINES).join("\n");

console.log("==============================================================");
console.log("Phase 3.1 smoke test — intake-configuration kernel gate");
console.log("==============================================================");
console.log("Corpus:        " + path.relative(process.cwd(), CORPUS_PATH));
console.log("Lines:         " + N_LINES);
console.log("");

// ---- Adapt ----
const stream = CorpusAdapter.adaptCorpus(corpusSrc, acorn);
console.log("Tokens emitted:   " + stream.metadata.total_tokens);
console.log("Distinct kinds:   " + stream.metadata.distinct_kinds);
console.log("");

// ---- Build minimal intake-config for kind peer ----
//
// dimsFn projects the token + ctx into the peer's coord shape. For the
// kind axis, the coord captures: current kind, previous-token kind,
// next-token kind, run-length-so-far. These coord dims are what
// domainRules match against.
//
// Per phase-3-spec.md §2.2: this output alphabet names structural-shape
// roles only (run-start / run-mid / run-end / transition / isolated),
// not domain-content roles. Discipline §2.1 honored.
const kindIntakeConfig = {
  dimsFn: function (token, ctx) {
    const prev = (token.neighbors_pre && token.neighbors_pre.length > 0)
      ? token.neighbors_pre[token.neighbors_pre.length - 1] : null;
    const next = (token.neighbors_post && token.neighbors_post.length > 0)
      ? token.neighbors_post[0] : null;
    const prevSame = prev && prev.kind === token.kind;
    const nextSame = next && next.kind === token.kind;
    return {
      kind:     token.kind,
      prevSame: prevSame ? "yes" : "no",
      nextSame: nextSame ? "yes" : "no"
    };
  },

  tokensFn: function (token, ctx) {
    // Phase 3.1: single peer in isolation. tokensFn returns an intake
    // projection that's available on input.intakeTokens for vocab.matches().
    // The Phase 2 vocab still receives the canonical input record alongside.
    const t = ["kind-" + token.kind];
    if (ctx && ctx.selfLastOutput) t.push("prev-self-" + ctx.selfLastOutput);
    return t;
  },

  outputVar:      "--kind-role",
  defaultOutput:  "kind-isolated",
  outputAlphabet: [
    "kind-run-start", "kind-run-mid", "kind-run-end",
    "kind-transition", "kind-isolated"
  ],

  // Placeholder domain rules per discipline §2.3 (canonical shape, simpler
  // content). Structure of the rules (most-specific-match wins) is
  // canonical; the specific mappings here are starting points for the
  // substrate to accumulate fidelity around.
  domainRules: [
    { when: { prevSame: "no",  nextSame: "no"  }, then: "kind-isolated" },
    { when: { prevSame: "no",  nextSame: "yes" }, then: "kind-run-start" },
    { when: { prevSame: "yes", nextSame: "yes" }, then: "kind-run-mid" },
    { when: { prevSame: "yes", nextSame: "no"  }, then: "kind-run-end" }
  ],

  // Centroid templates per output token. When onRatify fires, the hook
  // samples a new pattern from the centroid keyed by current lastOutput.
  // Templates use substrate-internal vocabulary only (kinds, slots) per
  // discipline §2.1 / O3.
  centroids: {
    "kind-run-start":  { kind_var: true, contextSlot: "post" },
    "kind-run-mid":    { kind_var: true, contextSlot: "both" },
    "kind-run-end":    { kind_var: true, contextSlot: "pre" },
    "kind-transition": { kind_var: true, contextSlot: "transition" },
    "kind-isolated":   { kind_var: true, contextSlot: "neither" }
  },

  // Invention at ratification (closes Phase 2 gap C). Hook returns a new
  // pattern object that integrateInvention() wraps as a derived constraint.
  // Pattern uses substrate-internal vocabulary only.
  onRatify: function (c, field, ctx) {
    const centroid = this && this.centroids && this.centroids[ctx.selfLastOutput];
    // Sample a kind from current field state (substrate-internal vocab)
    const kindsSeen = Object.create(null);
    for (const cc of field.constraints) {
      if (cc.pattern && cc.pattern.kind) kindsSeen[cc.pattern.kind] = true;
      if (cc.pattern && cc.pattern.a)    kindsSeen[cc.pattern.a]    = true;
      if (cc.pattern && cc.pattern.b)    kindsSeen[cc.pattern.b]    = true;
    }
    const kindList = Object.keys(kindsSeen);
    if (kindList.length === 0) return null;
    const sampled = kindList[Math.floor(Math.random() * kindList.length)];
    return {
      pattern: {
        type:    "kind-context-pattern",
        kind:    sampled,
        context: ctx.selfLastOutput,
        slot:    centroid ? centroid.contextSlot : "unknown"
      },
      desc: "invented at ratification (output=" + ctx.selfLastOutput + ")"
    };
  }
};

// Bind centroids to the onRatify closure via Function.prototype.bind so
// `this` inside the hook references the spec.
kindIntakeConfig.onRatify = kindIntakeConfig.onRatify.bind(kindIntakeConfig);

// ---- Instantiate peer with intake-config ----
let peer;
try {
  peer = SubstrateFactory.makePeer({
    FieldModule:    FieldModule,
    id:             "kind-peer-intake",
    axis:           "kind",
    primitiveVocab: PrimitiveVocabs.kind,
    // Phase 3.1 intake-configuration:
    dimsFn:         kindIntakeConfig.dimsFn,
    tokensFn:       kindIntakeConfig.tokensFn,
    outputVar:      kindIntakeConfig.outputVar,
    defaultOutput:  kindIntakeConfig.defaultOutput,
    outputAlphabet: kindIntakeConfig.outputAlphabet,
    domainRules:    kindIntakeConfig.domainRules,
    centroids:      kindIntakeConfig.centroids,
    onRatify:       kindIntakeConfig.onRatify
  });
} catch (e) {
  console.error("FALSIFICATION: makePeer rejected the intake-config spec.");
  console.error("Error: " + e.message);
  console.error("This is the Phase 3.1 kernel gate — recording the gap.");
  process.exit(2);
}

console.log("--- peer instantiated ---");
console.log("Peer id:             " + peer.id);
console.log("Intake-config active: " + peer.intakeConfigActive);
console.log("Output var:          " + peer.outputVar);
console.log("Output alphabet:     " + JSON.stringify(peer.outputAlphabet));
console.log("Initial lastOutput:  " + peer.getLastOutput());
console.log("");

// ---- Ingest stream ----
console.log("--- ingesting " + stream.records.length + " tokens ---");
const t0 = Date.now();
const outputTimeline = [];
for (let i = 0; i < stream.records.length; i++) {
  const r = peer.ingest(stream.records[i]);
  outputTimeline.push(r.lastOutput);
}
const tIngest = Date.now() - t0;
console.log("Ingest time: " + tIngest + "ms");
console.log("Per-token avg: " + (tIngest / stream.records.length).toFixed(3) + "ms");
console.log("");

// ---- Final observation ----
const obs = peer.observe();

console.log("==============================================================");
console.log("Phase 3.1 result for " + obs.id);
console.log("==============================================================");
console.log("Steps:               " + obs.step);
console.log("");

console.log("Canonical cycle (Phase 2 metrics preserved):");
console.log("  derivedGenerated      " + obs.stats.derivedGenerated);
console.log("  predictionsGenerated  " + obs.stats.predictionsGenerated);
console.log("  ratificationsObserved " + obs.stats.ratificationsObserved);
console.log("  promotionsObserved    " + obs.stats.promotionsObserved);
console.log("  evictionsObserved     " + obs.stats.evictionsObserved);
console.log("");

console.log("Phase 3.1 additions:");
console.log("  outputResolutions     " + obs.stats.outputResolutions);
console.log("  inventionsGenerated   " + obs.stats.inventionsGenerated);
console.log("  current lastOutput    " + obs.intakeConfig.lastOutput);
console.log("");

console.log("Output token frequencies:");
const outCounts = obs.intakeConfig.outputCounts;
const keys = Object.keys(outCounts).sort(function (a, b) {
  return outCounts[b] - outCounts[a];
});
for (const k of keys) {
  console.log("  " + k.padEnd(20) + " " + outCounts[k]);
}
console.log("");

console.log("Vector-delta:");
console.log("  scalar               " + obs.delta.scalar.toFixed(4));
console.log("  fast                 " + obs.delta.fast.toFixed(4));
console.log("  slow                 " + obs.delta.slow.toFixed(4));
console.log("  gap                  " + obs.delta.gap.toFixed(4));
console.log("");

// ---- Phase 3.1 kernel-gate checks ----
console.log("--- Phase 3.1 kernel-gate checks ---");
const checks = [
  ["makePeer accepted intake-config",       peer.intakeConfigActive === true],
  ["lastOutput resolved per token",         obs.stats.outputResolutions === stream.records.length],
  ["output alphabet honored (no surprises)", keys.every(function (k) {
    return obs.intakeConfig.alphabet.indexOf(k) >= 0;
  })],
  ["canonical cycle still runs",            obs.stats.derivedGenerated > 0],
  ["domain rules produced varied outputs",  keys.length >= 2],
];
let allPass = true;
for (const [q, ok] of checks) {
  console.log("  " + (ok ? "[PASS]" : "[FAIL]") + " " + q);
  if (!ok) allPass = false;
}

// Invention check: only meaningful if ratifications occurred
if (obs.stats.ratificationsObserved > 0) {
  const inventionCheck = obs.stats.inventionsGenerated > 0;
  console.log("  " + (inventionCheck ? "[PASS]" : "[FAIL]") +
    " onRatify hook invented patterns (" + obs.stats.inventionsGenerated +
    " inventions / " + obs.stats.ratificationsObserved + " ratifications)");
  if (!inventionCheck) allPass = false;
} else {
  console.log("  [INFO] no ratifications this run; invention untested " +
    "(run with more lines to provoke ratifications)");
}

console.log("");
if (allPass) {
  console.log("RESULT: Phase 3.1 kernel gate PASSED.");
  console.log("        makePeer hosts intake-configuration spec without");
  console.log("        canonical Field modifications. Phase 3.2 (author");
  console.log("        five-axis intake configs) can begin.");
} else {
  console.log("RESULT: Phase 3.1 kernel gate FAILED.");
  console.log("        See [FAIL] lines above. Phase 3.1 halts per spec.");
}
console.log("==============================================================");

process.exit(allPass ? 0 : 1);
