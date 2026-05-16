// test-stage2.js - verify Stage 2 substrate against architectural invariants

"use strict";

const fs = require("fs");
const path = require("path");
const M1 = require("./stage1-lexical-typing-substrate.js");
const M2 = require("./stage2-emergent-structural-substrate.js");

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
function eq(name, a, b) { ok(name, a === b, { actual: a, expected: b }); }
function group(name, fn) { console.log("\n[" + name + "]"); fn(); }

// ============================================================================
// VSF parsing
// ============================================================================

group("parse stage1 VSF", function () {
  const sub1 = M1.createStage1Substrate({ id: "p1" });
  sub1.ingest(Buffer.from('var x = 42;', "ascii"));
  const vsf = sub1.emitVsf();

  const parsed = M2.parseStage1Vsf(vsf);
  ok("parsed has header triads", parsed.headerTriads.length > 0);
  ok("parsed has rows", parsed.rows.length > 0);

  const r0 = parsed.rows[0];
  ok("first row has start", typeof r0.start === "number");
  ok("first row has end", typeof r0.end === "number");
  ok("first row has kind", typeof r0.kind === "string");
  ok("first row has text", typeof r0.text === "string");
});

group("parse rejects non-ASCII", function () {
  const bad = "header\n---\nx|y|z\xFF";
  let threw = false;
  try { M2.parseStage1Vsf(bad); } catch (e) { threw = true; }
  ok("non-ASCII vsf throws", threw);
});

group("parse rejects missing separator", function () {
  let threw = false;
  try { M2.parseStage1Vsf("no separator here"); } catch (e) { threw = true; }
  ok("missing separator throws", threw);
});

// ============================================================================
// F1: Seed permanent
// ============================================================================

group("F1 seed permanent", function () {
  const sub2 = M2.createStage2Substrate({ id: "f1" });
  const s0 = sub2.getState();
  ok("seed at init", !!s0.seed);
  ok("seed permanent", s0.seed.permanent === true);

  const sub1 = M1.createStage1Substrate({ id: "f1-pre" });
  sub1.ingest(Buffer.from("var x = 1;", "ascii"));
  sub2.ingestStage1Vsf(sub1.emitVsf());

  const s1 = sub2.getState();
  ok("seed still present after ingest", !!s1.seed);
  eq("seed identity stable", s1.seed.id, s0.seed.id);
});

// ============================================================================
// F2: Delta single formula
// ============================================================================

group("F2 delta in [0,1]", function () {
  const sub2 = M2.createStage2Substrate({ id: "f2" });
  eq("initial delta is 1.0", sub2.getState().delta, 1.0);

  const sub1 = M1.createStage1Substrate({ id: "f2-pre" });
  sub1.ingest(Buffer.from("var x = 1; var y = 2; var z = 3;", "ascii"));
  sub2.ingestStage1Vsf(sub1.emitVsf());

  const s1 = sub2.getState();
  ok("delta is in [0,1]", s1.delta >= 0 && s1.delta <= 1);
  ok("delta below 1 after ingest", s1.delta < 1.0);
});

// ============================================================================
// F3: No supervision (determinism)
// ============================================================================

group("F3 determinism across instances", function () {
  const sub1a = M1.createStage1Substrate({ id: "src" });
  sub1a.ingest(Buffer.from('function add(a, b) { return a + b; }', "ascii"));
  const vsf = sub1a.emitVsf();

  const sub2a = M2.createStage2Substrate({ id: "a" });
  const sub2b = M2.createStage2Substrate({ id: "b" });
  sub2a.ingestStage1Vsf(vsf);
  sub2b.ingestStage1Vsf(vsf);

  const ra = sub2a.getState().rows;
  const rb = sub2b.getState().rows;
  eq("row count matches", ra.length, rb.length);

  let allHashesMatch = true;
  for (let i = 0; i < ra.length; i++) {
    if (!rb[i] || ra[i].hash !== rb[i].hash) { allHashesMatch = false; break; }
  }
  ok("all row hashes match across instances", allHashesMatch);

  // Sub-cascade names also match
  const namesA = sub2a.getState().subcascades.map(function (s) { return s.name; }).sort();
  const namesB = sub2b.getState().subcascades.map(function (s) { return s.name; }).sort();
  eq("sub-cascade name sets match", JSON.stringify(namesA), JSON.stringify(namesB));
});

// ============================================================================
// F4: Indefinite operation
// ============================================================================

group("F4 indefinite operation", function () {
  const sub2 = M2.createStage2Substrate({ id: "f4" });
  const sub1a = M1.createStage1Substrate({ id: "f4-a" });
  sub1a.ingest(Buffer.from("var a = 1;", "ascii"));
  sub2.ingestStage1Vsf(sub1a.emitVsf());
  const r1 = sub2.getState();

  const sub1b = M1.createStage1Substrate({ id: "f4-b" });
  sub1b.ingest(Buffer.from("var b = 2;", "ascii"));
  sub2.ingestStage1Vsf(sub1b.emitVsf());
  const r2 = sub2.getState();

  ok("step counter advances on second ingest", r2.step > r1.step);
  ok("not sealed without explicit seal", r2.sealed === false);
});

// ============================================================================
// F5: Observation irreversible
// ============================================================================

group("F5 observation irreversible", function () {
  const sub2 = M2.createStage2Substrate({ id: "f5" });
  const sub1 = M1.createStage1Substrate({ id: "f5-pre" });
  sub1.ingest(Buffer.from("var x = 1;", "ascii"));
  sub2.ingestStage1Vsf(sub1.emitVsf());

  const before = sub2.getState().rows.slice();
  const sub1b = M1.createStage1Substrate({ id: "f5-pre-b" });
  sub1b.ingest(Buffer.from("var y = 2;", "ascii"));
  sub2.ingestStage1Vsf(sub1b.emitVsf());
  const after = sub2.getState().rows;

  // Prior rows must remain (append-only)
  let preserved = true;
  for (let i = 0; i < before.length; i++) {
    if (!after[i] || after[i].hash !== before[i].hash) { preserved = false; break; }
  }
  ok("prior rows preserved", preserved);

  // Sealing is final
  const root = sub2.seal();
  ok("seal returns merkle-root-shaped string", typeof root === "string" && root.length === 64);
  let threw = false;
  const sub1c = M1.createStage1Substrate({ id: "f5-pre-c" });
  sub1c.ingest(Buffer.from("var z;", "ascii"));
  try { sub2.ingestStage1Vsf(sub1c.emitVsf()); } catch (e) { threw = true; }
  ok("ingest after seal throws", threw);
});

// ============================================================================
// M5: Trace at channel
// ============================================================================

group("M5 trace at channel", function () {
  const sub2 = M2.createStage2Substrate({ id: "m5" });
  const sub1 = M1.createStage1Substrate({ id: "m5-pre" });
  sub1.ingest(Buffer.from("var a; var b; var c; var d; var e;", "ascii"));
  sub2.ingestStage1Vsf(sub1.emitVsf());
  const trace = sub2.getState().trace;
  ok("trace has entries", trace.length > 0);

  const ops = trace.map(function (t) { return t.op; });
  ok("trace contains 'crawl-complete'", ops.indexOf("crawl-complete") >= 0);

  let monotonic = true;
  for (let i = 1; i < trace.length; i++) {
    if (trace[i].step <= trace[i - 1].step) { monotonic = false; break; }
  }
  ok("trace steps monotonic", monotonic);
});

// ============================================================================
// I1: ASCII-only emission
// ============================================================================

group("I1 ASCII-only emission", function () {
  const sub2 = M2.createStage2Substrate({ id: "i1" });
  const sub1 = M1.createStage1Substrate({ id: "i1-pre" });
  sub1.ingest(Buffer.from('var s = "hello"; // a note', "ascii"));
  sub2.ingestStage1Vsf(sub1.emitVsf());

  const rows = sub2.getState().rows;
  let allAscii = true;
  for (const r of rows) {
    if (!M2.asciiOnly(r.body)) allAscii = false;
  }
  ok("every row body ASCII", allAscii);

  const vsf = sub2.emitVsf();
  ok("VSF text ASCII", M2.asciiOnly(vsf));
});

// ============================================================================
// K1-K3: Sub-cascade promotion happens when fidelity surfaces recurrence
// ============================================================================

group("K1-K3 promotion mechanism", function () {
  // A source with strong recurrence should produce sub-cascades.
  // The loan-app constraint pattern is the test: when/then pairs repeated
  // many times. Here we use a synthetic source with the same shape.
  const synthetic = `
    { when: { credit: "prime" }, then: { rt: "A" } },
    { when: { credit: "near" }, then: { rt: "B" } },
    { when: { credit: "subprime" }, then: { rt: "C" } },
    { when: { credit: "thin" }, then: { rt: "D" } },
    { when: { credit: "deep" }, then: { rt: "E" } },
    { when: { credit: "newcredit" }, then: { rt: "F" } },
    { when: { credit: "noscore" }, then: { rt: "G" } }
  `;
  const sub1 = M1.createStage1Substrate({ id: "k-pre", rowCap: 65536 });
  sub1.ingest(Buffer.from(synthetic, "ascii"));

  const sub2 = M2.createStage2Substrate({ id: "k-test", rowCap: 65536, constraintCap: 65536 });
  sub2.ingestStage1Vsf(sub1.emitVsf());

  const state = sub2.getState();
  ok("recurrence produced sub-cascades", state.subcascades.length > 0,
     { count: state.subcascades.length });
  ok("sub-cascade count under cap", state.subcascades.length <= M2.SUB_CASCADE_CAP);

  // Promoted sub-cascades have meaningful names (non-empty after sanitization)
  let allNamed = true;
  for (const sc of state.subcascades) {
    if (!sc.name || sc.name.length === 0) allNamed = false;
  }
  ok("all sub-cascades have names (K3)", allNamed);

  // Sub-cascade rows match sub-cascade count (after dedup)
  const subRows = state.rows.filter(function (r) { return r.kind === "subcascade"; });
  eq("sub-cascade rows match promoted count", subRows.length, state.subcascades.length);
});

// ============================================================================
// Idempotence: multiple ingests of identical bytes don't multiply rows
// ============================================================================

group("idempotent emission across re-ingest", function () {
  const sub1 = M1.createStage1Substrate({ id: "idem-pre" });
  sub1.ingest(Buffer.from("var x = 1; var y = 2; var z = 3;", "ascii"));
  const vsf = sub1.emitVsf();

  const sub2 = M2.createStage2Substrate({ id: "idem" });
  sub2.ingestStage1Vsf(vsf);
  const rowsAfter1 = sub2.getState().rows.length;

  sub2.ingestStage1Vsf(vsf);  // re-ingest same bytes
  const rowsAfter2 = sub2.getState().rows.length;

  ok("rows did not multiply on re-ingest", rowsAfter2 === rowsAfter1,
     { afterFirst: rowsAfter1, afterSecond: rowsAfter2 });
});

// ============================================================================
// Real loan-app source through Stage 1 -> Stage 2 chain
// ============================================================================

group("loan-app chain Stage 1 -> Stage 2", function () {
  const candidates = [
    "/home/claude/work/v2/Paradigm Version 1/PROJECT EXODUS/Demonstration/Canonocial/canonical1.1/exodus-canonical.html"
  ];
  let bytes = null;
  let resolved = null;
  for (const p of candidates) {
    try { bytes = fs.readFileSync(p); resolved = p; break; }
    catch (e) { /* try next */ }
  }
  if (!bytes) {
    console.log("  skip  loan-app source not found");
    return;
  }

  console.log("  loan-app: " + bytes.length + " bytes");
  const sub1 = M1.createStage1Substrate({ id: "loan-1", rowCap: 65536, traceCap: 65536 });
  const r1 = sub1.ingest(bytes);
  console.log("  stage 1 emitted " + r1.emitted + " rows; delta=" + r1.delta);

  const vsf1 = sub1.emitVsf();
  console.log("  stage 1 VSF: " + vsf1.length + " bytes");

  const sub2 = M2.createStage2Substrate({
    id: "loan-2",
    rowCap: 65536,
    constraintCap: 65536,
    traceCap: 65536,
    correlationCap: 65536
  });
  const r2 = sub2.ingestStage1Vsf(vsf1);

  const state2 = sub2.getState();
  console.log("  stage 2 tokens seen:    " + r2.tokensSeen);
  console.log("  stage 2 constraints:    " + r2.constraints);
  console.log("  stage 2 sub-cascades:   " + r2.subcascades);
  console.log("  stage 2 delta:          " + r2.delta);
  console.log("  stage 2 family count:   " + state2.familyCount);
  console.log("  stage 2 correlations:   " + state2.correlationCount);
  console.log("  stage 2 namingPref:     " + state2.namingPref);

  // The test isn't "did it emit a specific structural pattern" - the test is:
  // did the substrate actually settle around what extrudes from the source?
  ok("stage 2 ingested all stage 1 tokens", r2.tokensSeen > 1000);
  ok("stage 2 derived constraints", r2.constraints > 50);
  ok("stage 2 promoted sub-cascades from recurrence",
     r2.subcascades >= 1, { actual: r2.subcascades });

  // What surfaced - print for inspection
  console.log("");
  console.log("  surfaced sub-cascades (top 15 by uses):");
  const subs = state2.subcascades.slice().sort(function (a, b) {
    let auses = 0, buses = 0;
    for (const id of a.memberIds) {
      const c = state2.constraints.find(function (x) { return x.id === id; });
      if (c) auses += c.uses || 0;
    }
    for (const id of b.memberIds) {
      const c = state2.constraints.find(function (x) { return x.id === id; });
      if (c) buses += c.uses || 0;
    }
    return buses - auses;
  });
  for (let i = 0; i < Math.min(15, subs.length); i++) {
    const sc = subs[i];
    console.log("    " + (i + 1).toString().padStart(2) + ". " +
                sc.name.padEnd(38) +
                " family=" + sc.familyType.padEnd(40) +
                " members=" + sc.memberIds.length);
  }

  // Top families by total fires
  console.log("");
  console.log("  top families by total firings:");
  const allFamilies = state2.constraints.reduce(function (acc, c) {
    if (!acc[c.family]) acc[c.family] = { fires: 0, count: 0 };
    acc[c.family].fires += c.uses || 0;
    acc[c.family].count++;
    return acc;
  }, {});
  const famArr = Object.keys(allFamilies).map(function (k) {
    return { family: k, fires: allFamilies[k].fires, count: allFamilies[k].count };
  }).sort(function (a, b) { return b.fires - a.fires; });
  for (let i = 0; i < Math.min(20, famArr.length); i++) {
    console.log("    " + famArr[i].family.padEnd(64) +
                " fires=" + String(famArr[i].fires).padStart(6) +
                " count=" + famArr[i].count);
  }

  // Stage 2 emits its own VSF for downstream stages
  const vsf2 = sub2.emitVsf();
  ok("stage 2 emits valid VSF", typeof vsf2 === "string" && vsf2.indexOf("\n---\n") > 0);
  ok("stage 2 VSF is ASCII", M2.asciiOnly(vsf2));

  console.log("\n  stage 2 VSF body sample (first 5 rows):");
  const body = vsf2.split("\n---\n")[1];
  const lines = body.split("\n").filter(function (s) { return s.length > 0; });
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    console.log("    " + lines[i]);
  }
});

// ============================================================================
// Summary
// ============================================================================

console.log("\n----------------------------------------------------------------");
console.log("PASS: " + PASS + "    FAIL: " + FAIL);
if (FAIL > 0) {
  console.log("\nFailures:");
  for (const f of FAILURES) {
    console.log("  - " + f.name);
    if (f.detail) console.log("      " + JSON.stringify(f.detail).slice(0, 200));
  }
  process.exit(1);
} else {
  console.log("ALL TESTS PASS");
  process.exit(0);
}
