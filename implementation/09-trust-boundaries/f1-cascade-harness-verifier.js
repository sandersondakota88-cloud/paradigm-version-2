// f1-cascade-harness-verifier.js - Phase 9 F1 acceptance

"use strict";

const fs = require("fs");
const path = require("path");

const F1 = require("./f1-cascade-harness.js");
const Synth = require("./cascade-rule-synthesizer.js");

let pass = 0, fail = 0;
const failures = [];

function test(name, fn) {
  try { fn(); pass++; console.log("  OK   " + name); }
  catch (e) { fail++; failures.push({name, error: e}); console.log("  FAIL " + name + ": " + e.message); }
}
function assert(c, m) { if (!c) throw new Error("assertion failed: " + (m || "")); }

console.log("f1-cascade-harness verification (closure on emitted form)");
console.log("");

// --------------------------------------------------------------------
// PART A: harness construction
// --------------------------------------------------------------------
console.log("PART A: harness construction");
console.log("");

test("buildSandbox returns field + evaluator + sandbox", () => {
  const ctx = F1.buildSandbox();
  assert(ctx.field);
  assert(ctx.fieldModule);
  assert(ctx.evaluator);
  assert(typeof ctx.evaluator.evaluateCascade === "function");
});

test("Each buildSandbox call produces an isolated field", () => {
  const a = F1.buildSandbox();
  const b = F1.buildSandbox();
  assert(a.field !== b.field);
  a.field.step = 99;
  assert(b.field.step === 0, "B's step unaffected by A's mutation");
});

test("F1: seed at constraints[0] in fresh harness sandbox", () => {
  const ctx = F1.buildSandbox();
  assert(ctx.field.constraints.length === 1);
  assert(ctx.field.constraints[0].kind === "seed");
  assert(ctx.field.constraints[0].permanent === true);
});

// --------------------------------------------------------------------
// PART B: coord injection
// --------------------------------------------------------------------
console.log("");
console.log("PART B: coord injection round-trip");
console.log("");

test("coordsToIntakeRecords strips data- prefix", () => {
  const records = F1.coordsToIntakeRecords({
    "data-foo": "bar",
    "data-user-role": "admin",
    "trigger": "submit"  // no data- prefix; pass through
  });
  assert(records.length === 1);
  assert(records[0].type === "dom::harness");
  assert(records[0].value.foo === "bar");
  assert(records[0].value["user-role"] === "admin");
  assert(records[0].value.trigger === "submit");
});

// --------------------------------------------------------------------
// PART C: match against bare-dim selector keys
// --------------------------------------------------------------------
console.log("");
console.log("PART C: match logic agrees with evaluator");
console.log("");

test("Single rule, all coords match -> resolves --next-op", () => {
  const synth = Synth.synthesizeFromCss(
    '[data-substrate-state][data-target="x"] { --next-op: "doX"; }');
  const r = F1.runCascade(synth.constraints, {
    "data-substrate-state": "",
    "data-target": "x"
  });
  assert(r.op === "doX", "expected doX, got " + r.op);
  assert(r.matchedCount === 1);
});

test("Single rule, value mismatch -> no match", () => {
  const synth = Synth.synthesizeFromCss(
    '[data-substrate-state][data-target="x"] { --next-op: "doX"; }');
  const r = F1.runCascade(synth.constraints, {
    "data-substrate-state": "",
    "data-target": "y"
  });
  assert(r.op === null);
  assert(r.matchedCount === 0);
});

test("Single rule, missing presence-only -> still matches (* is permissive at runtime)", () => {
  // Per matchConstraintWithoutGeometry: "*" is treated as always-true
  // because the deposition's state element always has the bare attribute.
  // The harness honors that semantic.
  const synth = Synth.synthesizeFromCss(
    '[data-substrate-state][data-target="x"] { --next-op: "doX"; }');
  // Don't include data-substrate-state in coords; match anyway
  const r = F1.runCascade(synth.constraints, { "data-target": "x" });
  assert(r.op === "doX",
    "presence-only data-substrate-state should be treated as always-true; got op=" + r.op);
});

// --------------------------------------------------------------------
// PART D: latest-match-per-property cascade override
// --------------------------------------------------------------------
console.log("");
console.log("PART D: cascade override (latest match per property)");
console.log("");

test("Two rules emit to same property; latest wins (cascade order)", () => {
  // Construct two rules that BOTH match the same coord set; second
  // should override first per cascade semantics.
  const css = [
    '[data-substrate-state][data-target="x"] { --next-op: "first"; }',
    '[data-substrate-state][data-target="x"] { --next-op: "second"; }'
  ].join("\n");
  const synth = Synth.synthesizeFromCss(css);
  const r = F1.runCascade(synth.constraints, {
    "data-substrate-state": "",
    "data-target": "x"
  });
  assert(r.op === "second",
    "expected 'second' (cascade override), got " + r.op);
  assert(r.matchedCount === 2,
    "both rules should report matched");
});

test("Two rules emit to DIFFERENT properties; both surface", () => {
  const css = [
    '[data-substrate-state][data-target="x"] { --next-op: "doX"; }',
    '[data-substrate-state][data-target="x"] { --form-validity: "valid"; }'
  ].join("\n");
  const synth = Synth.synthesizeFromCss(css);
  const r = F1.runCascadeAll(synth.constraints, {
    "data-substrate-state": "",
    "data-target": "x"
  });
  assert(r.emitted["--next-op"] === "doX");
  assert(r.emitted["--form-validity"] === "valid");
});

// --------------------------------------------------------------------
// PART E: agreement with old simulation on representative cases
// --------------------------------------------------------------------
console.log("");
console.log("PART E: agreement with old simulation logic");
console.log("");

// The old simulation logic from P2/P8. Compare its output to the harness
// on a battery of cases. Differences are real divergences.
function oldSim(rules, coords) {
  for (const rule of rules) {
    const sel = rule.pattern.selector;
    let allMatch = true;
    for (const k of Object.keys(sel)) {
      if (sel[k] === "*") {
        if (!(k in coords)) { allMatch = false; break; }
      } else if (coords[k] !== sel[k]) {
        allMatch = false; break;
      }
    }
    if (allMatch) return { matched: true, op: rule.emit.value };
  }
  return { matched: false };
}

const TEST_CASES = [
  {
    name: "admin+valid+user-edit",
    css: '[data-substrate-state][data-session-validity="valid"][data-user-role="admin"][data-target="user-edit"] { --next-op: "openUserEditor"; }',
    coords: {
      "data-substrate-state": "",
      "data-session-validity": "valid",
      "data-user-role": "admin",
      "data-target": "user-edit"
    },
    coordsForOldSim: {
      "data-substrate-state": "",
      "data-session-validity": "valid",
      "data-user-role": "admin",
      "data-target": "user-edit"
    }
  },
  {
    name: "rep+valid+user-edit (no match)",
    css: '[data-substrate-state][data-session-validity="valid"][data-user-role="admin"][data-target="user-edit"] { --next-op: "openUserEditor"; }',
    coords: {
      "data-substrate-state": "",
      "data-session-validity": "valid",
      "data-user-role": "rep",
      "data-target": "user-edit"
    },
    coordsForOldSim: {
      "data-substrate-state": "",
      "data-session-validity": "valid",
      "data-user-role": "rep",
      "data-target": "user-edit"
    }
  },
  {
    name: "admin+expired (no match)",
    css: '[data-substrate-state][data-session-validity="valid"][data-user-role="admin"][data-target="user-edit"] { --next-op: "openUserEditor"; }',
    coords: {
      "data-substrate-state": "",
      "data-session-validity": "expired",
      "data-user-role": "admin",
      "data-target": "user-edit"
    },
    coordsForOldSim: {
      "data-substrate-state": "",
      "data-session-validity": "expired",
      "data-user-role": "admin",
      "data-target": "user-edit"
    }
  }
];

for (const tc of TEST_CASES) {
  test("Agreement: " + tc.name, () => {
    const synth = Synth.synthesizeFromCss(tc.css);
    const harnessResult = F1.runCascade(synth.constraints, tc.coords);
    const oldResult = oldSim(synth.constraints, tc.coordsForOldSim);
    assert(harnessResult.matched === oldResult.matched,
      "matched: harness=" + harnessResult.matched + " old=" + oldResult.matched);
    if (oldResult.matched) {
      assert(harnessResult.op === oldResult.op,
        "op: harness=" + harnessResult.op + " old=" + oldResult.op);
    }
  });
}

// --------------------------------------------------------------------
// PART F: closure
// --------------------------------------------------------------------
console.log("");
console.log("PART F: closure");
console.log("");

test("f1-cascade-harness.js: ASCII-only", () => {
  const src = fs.readFileSync(path.join(__dirname, "f1-cascade-harness.js"), "utf8");
  const m = src.match(/[^\x00-\x7F]/);
  assert(!m, "non-ASCII: " + (m && m[0]));
});

test("f1-cascade-harness.js: no host APIs leaked", () => {
  const src = fs.readFileSync(path.join(__dirname, "f1-cascade-harness.js"), "utf8");
  assert(src.indexOf("localStorage") < 0);
  assert(src.indexOf("fetch(") < 0);
  assert(src.indexOf("XMLHttpRequest") < 0);
});

console.log("");
console.log("==========================================================");
console.log("Summary: " + pass + " passed, " + fail + " failed");
if (fail > 0) {
  for (const f of failures) {
    console.log("  - " + f.name + ": " + f.error.message);
  }
  process.exit(1);
}
process.exit(0);
