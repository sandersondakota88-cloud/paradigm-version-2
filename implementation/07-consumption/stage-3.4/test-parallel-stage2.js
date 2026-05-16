// test-parallel-stage2.js - verify parallel substrates and composer

"use strict";

const fs = require("fs");
const M1 = require("./stage1-lexical-typing-substrate.js");
const M2 = require("./stage2-emergent-structural-substrate.js");
const Mid = require("./stage2-identifier-substrate.js");
const Mc = require("./composer-substrate.js");

let PASS = 0;
let FAIL = 0;
const FAILURES = [];

function ok(name, cond, detail) {
  if (cond) {
    PASS++;
    console.log("  ok   " + name);
  } else {
    FAIL++;
    FAILURES.push({ name: name, detail: detail });
    console.log("  FAIL " + name + (detail ? "  -- " + JSON.stringify(detail).slice(0, 200) : ""));
  }
}

function group(name, fn) {
  console.log("\n[" + name + "]");
  fn();
}

// ============================================================================
// Toy fixture (loan-app-shaped, small enough to inspect)
// ============================================================================

const TOY_FIXTURE = `
[data-debt='heavy'][data-employed='true'] { --sdf: 1; --reg: DENIED; }
[data-debt='heavy'][data-mortgage='sub-prime'] { --sdf: 1; --reg: DENIED; }
[data-mortgage='sub-prime'][data-foreign='yes'] { --sdf: 1; --reg: DENIED; }
[data-foreign='yes'][data-under50='yes'] { --sdf: 1; --reg: DENIED; }
[data-employed='false'] { --sdf: 1; --reg: DENIED; }
[data-debt='light'][data-employed='true'] { --sdf: 0; --reg: APPROVED; }

var x = "heavy"; var y = "sub-prime"; var z = "foreign";
function check(debt, mortgage) { return debt === "heavy" && mortgage === "sub-prime"; }
function decide(profile) {
  if (profile.debt === "heavy") return "DENIED";
  if (profile.mortgage === "sub-prime") return "DENIED";
  if (profile.foreign === "yes" && profile.under50 === "yes") return "DENIED";
  return "APPROVED";
}
`;

// ============================================================================
// I1: ASCII-only source
// ============================================================================

group("I1 ASCII-only source files", function () {
  const files = ["./stage2-identifier-substrate.js", "./composer-substrate.js"];
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8");
    let badIdx = -1;
    for (let i = 0; i < src.length; i++) {
      const c = src.charCodeAt(i);
      if (c > 0x7E && c !== 0x0A && c !== 0x09) { badIdx = i; break; }
    }
    ok(f.replace("./", "") + " is ASCII", badIdx === -1, badIdx >= 0 ? { badIdx: badIdx } : null);
  }
});

// ============================================================================
// Identifier substrate sanity
// ============================================================================

group("identifier substrate creates and ingests", function () {
  const sub = Mid.createIdentifierSubstrate({ id: "test" });
  ok("instance has id", sub.id === "test");
  ok("instance has version", typeof sub.version === "string" && sub.version.length > 0);

  const s0 = sub.getState();
  ok("seed present at init", !!s0.seed);
  ok("seed permanent", s0.seed.permanent === true);
  ok("seed has correct id", s0.seed.id === "seed::what-is-delta");
  ok("delta=1.0 initially", s0.delta === 1.0);
  ok("step=0 initially", s0.step === 0);

  const sub1 = M1.createStage1Substrate({ id: "s1" });
  sub1.ingest(Buffer.from(TOY_FIXTURE, "ascii"));
  const result = sub.ingestStage1Vsf(sub1.emitVsf());
  ok("ingestion returns tokensSeen", typeof result.tokensSeen === "number");
  ok("ingestion produces text tokens", result.textTokens > 0);
  ok("ingestion produces constraints", result.constraints > 0);

  const s1 = sub.getState();
  ok("seed persists after ingestion", s1.seed.id === s0.seed.id);
  ok("step advanced", s1.step > 0);
  ok("delta less than 1 after ingestion", s1.delta < 1.0);
});

// ============================================================================
// F1: seed permanent across observation
// ============================================================================

group("F1 seed permanent (identifier substrate)", function () {
  const sub = Mid.createIdentifierSubstrate({ id: "f1" });
  const s0 = sub.getState();

  const sub1 = M1.createStage1Substrate({ id: "f1-pre" });
  sub1.ingest(Buffer.from(TOY_FIXTURE, "ascii"));
  sub.ingestStage1Vsf(sub1.emitVsf());

  const s1 = sub.getState();
  ok("seed still present", !!s1.seed);
  ok("seed identity stable", s1.seed.id === s0.seed.id);
  ok("seed still permanent", s1.seed.permanent === true);
});

// ============================================================================
// F4: indefinite operation
// ============================================================================

group("F4 indefinite operation (substrate stays active)", function () {
  const sub = Mid.createIdentifierSubstrate({ id: "f4" });
  const sub1 = M1.createStage1Substrate({ id: "f4-pre" });
  sub1.ingest(Buffer.from(TOY_FIXTURE, "ascii"));
  sub.ingestStage1Vsf(sub1.emitVsf());

  const s = sub.getState();
  ok("delta non-zero (substrate active)", s.delta > 0);
  ok("step counter advanced", s.step > 0);
});

// ============================================================================
// F5: irreversibility (trace appends)
// ============================================================================

group("F5 trace append-only (identifier substrate)", function () {
  const sub = Mid.createIdentifierSubstrate({ id: "f5" });
  const sub1 = M1.createStage1Substrate({ id: "f5-pre" });
  sub1.ingest(Buffer.from(TOY_FIXTURE, "ascii"));
  sub.ingestStage1Vsf(sub1.emitVsf());

  const s = sub.getState();
  const traceLen = s.trace.length;
  ok("trace has entries", traceLen > 0);

  // Steps in trace are strictly monotonic
  let mono = true;
  for (let i = 1; i < s.trace.length; i++) {
    if (s.trace[i].step <= s.trace[i - 1].step) { mono = false; break; }
  }
  ok("trace steps strictly monotonic", mono);
});

// ============================================================================
// I5: bounded caps with aging
// ============================================================================

group("I5 bounded caps", function () {
  // Tiny cap to force eviction
  const sub = Mid.createIdentifierSubstrate({ id: "i5", constraintCap: 16, traceCap: 8 });
  const sub1 = M1.createStage1Substrate({ id: "i5-pre" });
  sub1.ingest(Buffer.from(TOY_FIXTURE, "ascii"));
  sub.ingestStage1Vsf(sub1.emitVsf());

  const s = sub.getState();
  ok("constraint count respects cap", s.constraints.length <= 16, { actual: s.constraints.length });
  ok("trace respects cap", s.trace.length <= 8, { actual: s.trace.length });
});

// ============================================================================
// Position class derivation
// ============================================================================

group("position class derivation", function () {
  const sub = Mid.createIdentifierSubstrate({ id: "pc" });
  // Build a minimal token list
  const toks = [
    { kind: "PUNCT_OPEN", text: "[" },
    { kind: "ALPHA_RUN", text: "data-debt" },
    { kind: "PUNCT_OP", text: "=" },
    { kind: "STRING_SGL", text: "'heavy'" }
  ];
  ok("[ATTR after [", sub._deriveTextPosClass(toks, 1) === "ATTR");
  ok("STRING_SGL is STR pos", sub._deriveTextPosClass(toks, 3) === "STR");

  const decl = [
    { kind: "KEYWORD", text: "var" },
    { kind: "WHITESPACE", text: " " },
    { kind: "ALPHA_RUN", text: "x" }
  ];
  ok("alpha after var is DECL", sub._deriveTextPosClass(decl, 2) === "DECL");

  const ref = [
    { kind: "ALPHA_RUN", text: "callme" }
  ];
  ok("bare alpha is REF", sub._deriveTextPosClass(ref, 0) === "REF");

  const num = [
    { kind: "DIGIT_RUN", text: "42" }
  ];
  ok("digit run is NUM", sub._deriveTextPosClass(num, 0) === "NUM");
});

// ============================================================================
// Substrate independence (S3): identifier substrate doesn't call Stage 1 or 2
// ============================================================================

group("S3 no command path (identifier substrate)", function () {
  // Construct identifier substrate; it should not require Stage 2
  // (stage2-emergent-structural-substrate.js) at all.
  const idsrc = fs.readFileSync("./stage2-identifier-substrate.js", "utf8");
  ok("does not require stage2-emergent",
     idsrc.indexOf("require(\"./stage2-emergent-structural-substrate\")") === -1 &&
     idsrc.indexOf("require('./stage2-emergent-structural-substrate')") === -1);
  ok("does not require stage1 (autonomous parsing)",
     idsrc.indexOf("require(\"./stage1-lexical-typing-substrate\")") === -1 &&
     idsrc.indexOf("require('./stage1-lexical-typing-substrate')") === -1);
});

group("S3 no command path (composer)", function () {
  const csrc = fs.readFileSync("./composer-substrate.js", "utf8");
  ok("composer does not require stage2-emergent",
     csrc.indexOf("require(\"./stage2-emergent") === -1);
  ok("composer does not require stage2-identifier",
     csrc.indexOf("require(\"./stage2-identifier") === -1);
  ok("composer does not require stage1",
     csrc.indexOf("require(\"./stage1-lexical") === -1);
  ok("composer is read-only of peer state (observe takes state objects)",
     csrc.indexOf("function observe(kindPeerState, textPeerState)") >= 0);
});

// ============================================================================
// PARALLELISM: composer surfaces something neither peer surfaces alone
// ============================================================================

group("composer surfaces joint structure neither peer alone surfaces", function () {
  const sub1 = M1.createStage1Substrate({ id: "p1" });
  sub1.ingest(Buffer.from(TOY_FIXTURE, "ascii"));
  const vsf1 = sub1.emitVsf();

  const sub2 = M2.createStage2Substrate({ id: "kp" });
  sub2.ingestStage1Vsf(vsf1);
  const sid = Mid.createIdentifierSubstrate({ id: "tp" });
  sid.ingestStage1Vsf(vsf1);

  const sc = Mc.createComposerSubstrate({ id: "comp" });
  const r = sc.observe(sub2.getState(), sid.getState());

  ok("composer fires on observation", r.fired > 0);
  ok("composer accumulates constraints", r.constraints > 0);

  const compState = sc.getState();
  const fams = {};
  for (const c of compState.constraints) fams[c.family] = (fams[c.family] || 0) + 1;

  // The three primitives should produce constraints on the toy fixture.
  // joint-recur fires when both peers see strong recurrence in
  // string-bearing patterns; the toy fixture has plenty.
  ok("joint-recur present", (fams["joint-recur"] || 0) > 0);
  // joint-naming fires when both peers have promoted sub-cascades
  ok("joint-naming present", (fams["joint-naming"] || 0) > 0);
  // kind-text-bind fires for punct-bearing kind patterns paired with
  // meaningful-pos text values
  ok("kind-text-bind present", (fams["kind-text-bind"] || 0) > 0);

  // Promotion. On the toy fixture with one observation, at least one
  // family should clear fidelity threshold.
  ok("composer promotes at least one sub-cascade", compState.subcascades.length >= 1,
     { count: compState.subcascades.length });
});

// ============================================================================
// LOAD-BEARING: domain structure surfaces on domain-dominant fixture
// ============================================================================

group("composer surfaces domain values on domain-dominant fixture", function () {
  // The toy fixture above is roughly half domain (constraint blocks)
  // and half code. The constraints-only.js extract from the canonical
  // source is much more domain-dominant.
  const path = "./constraints-only.js";
  if (!fs.existsSync(path)) {
    console.log("  (skip - constraints-only.js not present)");
    return;
  }
  const source = fs.readFileSync(path);
  const sub1 = M1.createStage1Substrate({ id: "dp1" });
  sub1.ingest(source);
  const vsf1 = sub1.emitVsf();

  const sub2 = M2.createStage2Substrate({ id: "dkp" });
  sub2.ingestStage1Vsf(vsf1);
  const sid = Mid.createIdentifierSubstrate({ id: "dtp" });
  sid.ingestStage1Vsf(vsf1);
  const sc = Mc.createComposerSubstrate({ id: "dcomp" });
  sc.observe(sub2.getState(), sid.getState());

  const compState = sc.getState();
  // The composer should accumulate constraints
  ok("composer accumulates constraints on domain fixture", compState.constraints.length > 0);

  // joint-recur should surface domain values: sub-prime, mortgage, etc.
  // We check that AT LEAST one well-known domain value appears as a
  // textValue in some joint-recur constraint.
  const domainValues = ["sub-prime", "mortgage", "foreign", "trust", "student", "unemployed"];
  const jrConstraints = compState.constraints.filter(c => c.family === "joint-recur");
  let foundCount = 0;
  for (const c of jrConstraints) {
    const tv = (c.pattern && c.pattern.textValue) || "";
    if (domainValues.indexOf(tv) >= 0) foundCount++;
  }
  ok("composer joint-recur surfaces domain values",
     foundCount > 0,
     { foundCount: foundCount, jrTotal: jrConstraints.length });

  // The identifier substrate should have domain dimension names present
  // as constraints, even if their use counts are low.
  const sidState = sid.getState();
  const dimNames = ["credit", "product", "applicant", "residency", "income", "employment"];
  let dimsPresent = 0;
  for (const dim of dimNames) {
    if (sidState.constraints.some(c => c.pattern && c.pattern.text === dim)) {
      dimsPresent++;
    }
  }
  ok("identifier substrate detects domain dimension names",
     dimsPresent >= 4,
     { dimsPresent: dimsPresent, total: dimNames.length });
});

// ============================================================================
// Determinism: same input twice produces same field shape (S2-class)
// ============================================================================

group("identifier substrate determinism", function () {
  const sub1a = M1.createStage1Substrate({ id: "d1a" });
  sub1a.ingest(Buffer.from(TOY_FIXTURE, "ascii"));
  const subA = Mid.createIdentifierSubstrate({ id: "da" });
  subA.ingestStage1Vsf(sub1a.emitVsf());

  const sub1b = M1.createStage1Substrate({ id: "d1b" });
  sub1b.ingest(Buffer.from(TOY_FIXTURE, "ascii"));
  const subB = Mid.createIdentifierSubstrate({ id: "db" });
  subB.ingestStage1Vsf(sub1b.emitVsf());

  const sa = subA.getState();
  const sb = subB.getState();
  ok("same delta", Math.abs(sa.delta - sb.delta) < 1e-9);
  ok("same constraint count", sa.constraints.length === sb.constraints.length);
  ok("same subcascade count", sa.subcascades.length === sb.subcascades.length);
  ok("same step count", sa.step === sb.step);
});

// ============================================================================
// Composer determinism
// ============================================================================

group("composer determinism", function () {
  function build() {
    const s1 = M1.createStage1Substrate({ id: "cd1" });
    s1.ingest(Buffer.from(TOY_FIXTURE, "ascii"));
    const s2 = M2.createStage2Substrate({ id: "cd2" });
    s2.ingestStage1Vsf(s1.emitVsf());
    const sid = Mid.createIdentifierSubstrate({ id: "cdid" });
    sid.ingestStage1Vsf(s1.emitVsf());
    const sc = Mc.createComposerSubstrate({ id: "cdc" });
    sc.observe(s2.getState(), sid.getState());
    return sc.getState();
  }
  const a = build();
  const b = build();
  ok("composer same constraint count", a.constraints.length === b.constraints.length);
  ok("composer same subcascade count", a.subcascades.length === b.subcascades.length);
  ok("composer same delta", Math.abs(a.delta - b.delta) < 1e-9);
});

// ============================================================================
// Summary
// ============================================================================

console.log("\n===========================================");
console.log("PASS: " + PASS + "   FAIL: " + FAIL);
if (FAIL > 0) {
  console.log("\nFailures:");
  for (const f of FAILURES) {
    console.log("  " + f.name + (f.detail ? " :: " + JSON.stringify(f.detail).slice(0, 200) : ""));
  }
  process.exit(1);
}
console.log("===========================================\n");
