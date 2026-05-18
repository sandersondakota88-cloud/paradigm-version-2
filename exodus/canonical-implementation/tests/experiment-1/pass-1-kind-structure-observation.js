// ============================================================================
// pass-1-kind-structure-observation.js -- Experiment 1, Pass 1
// ============================================================================
//
// Purpose
// -------
// Observe the structural surface of the canonical Phase A harness. What
// "kinds" of structural element does the proven byte-identical substrate
// actually produce when run across the full generated grammar?
//
// Hypothesis (going in)
// ---------------------
// The canonical 11-rule program plus the Phase A generator produce a
// minimal kind-less constraint vocabulary. Each constraint is a plain
// {when, then} record. The substrate's "kinds" (seed, derived, predictive,
// ratified, meta, compound, family) are NOT present in this layer; they
// live in richer implementations (bootstrap-fresh-v1, Phase 4b/4c).
//
// If this hypothesis is confirmed, Pass 1 establishes:
//   - The proven substrate vocabulary is small (effectively one kind:
//     "constraint", plus six output-record fields).
//   - All kind-shaped structure lives at richer implementation layers.
//   - The UTF foundations question (primitives vs enumerated kinds) needs
//     evidence from Pass 2, not Pass 1.
//
// If the hypothesis fails -- if Pass A's generated constraint sets
// actually produce structural variation we didn't notice -- that's an
// even more important finding and would tell us where to look next.
//
// What this instruments
// ---------------------
// For each generated constraint set (2,602 from Phase A's generators):
//   1. Constraint shape: what fields each constraint actually has
//   2. Output shape: what fields appear in resolved records
//   3. Distinct intern-table values exercised
//   4. Any field that varies in shape across the 2,602 sets
//
// Output: a markdown table summarizing what was observed, plus a JSON
// dump for programmatic inspection.
//
// Run with: node tests/experiment-1/pass-1-kind-structure-observation.js
// ============================================================================

"use strict";

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");
const C        = require(path.join(ROOT, "constraints.js"));
const cssOrig  = require(path.join(ROOT, "css-oracle.js"));
const jsOrig   = require(path.join(ROOT, "oracle.js"));
const compiler = require(path.join(ROOT, "compile-constraints.js"));

// ---------------------------------------------------------------------------
// Mirror of Phase A generators (deterministic, same as equivalence.test.js)
// ---------------------------------------------------------------------------

function allDimValueClauses() {
  const out = [];
  for (let d = 0; d < C.DIMS.length; d++) {
    const dimName = C.DIMS[d].name;
    for (let v = 0; v < C.DIMS[d].values.length; v++) {
      out.push({ [dimName]: C.DIMS[d].values[v] });
    }
  }
  return out;
}

function allTwoKeyClauses() {
  const dims = C.DIMS;
  const out = [];
  for (let d1 = 0; d1 < dims.length; d1++) {
    for (let v1 = 0; v1 < dims[d1].values.length; v1++) {
      for (let d2 = d1 + 1; d2 < dims.length; d2++) {
        for (let v2 = 0; v2 < dims[d2].values.length; v2++) {
          out.push({
            [dims[d1].name]: dims[d1].values[v1],
            [dims[d2].name]: dims[d2].values[v2]
          });
        }
      }
    }
  }
  return out;
}

function allThreeKeyClauses() {
  const dims = C.DIMS;
  const out = [];
  for (let d1 = 0; d1 < dims.length; d1++) {
    for (let v1 = 0; v1 < dims[d1].values.length; v1++) {
      for (let d2 = d1 + 1; d2 < dims.length; d2++) {
        for (let v2 = 0; v2 < dims[d2].values.length; v2++) {
          for (let d3 = d2 + 1; d3 < dims.length; d3++) {
            for (let v3 = 0; v3 < dims[d3].values.length; v3++) {
              out.push({
                [dims[d1].name]: dims[d1].values[v1],
                [dims[d2].name]: dims[d2].values[v2],
                [dims[d3].name]: dims[d3].values[v3]
              });
            }
          }
        }
      }
    }
  }
  return out;
}

function thenClauseCatalogue() {
  const cat = [];
  cat.push({ sdf: -1 });
  cat.push({ sdf: 1 });
  for (const v of C.RT_TABLE)   cat.push({ rt: v });
  for (const v of C.DOC_TABLE)  cat.push({ doc: v });
  for (const v of C.REG_TABLE)  cat.push({ reg: v });
  for (const v of C.DENY_TABLE) cat.push({ deny: v });
  for (const v of [0, 1, 127, 255]) cat.push({ rth: v });
  cat.push({ sdf: 1, deny: "SubPrime cannot hold BusinessLine" });
  cat.push({ rt: "A-PREFERRED", rth: 160, doc: "BASIC" });
  cat.push({ rt: "B-STANDARD",  rth: 130, doc: "ENHANCED" });
  cat.push({ rt: "C-ELEVATED",  rth:  95, doc: "ENHANCED" });
  return cat;
}

function makeRng(seed) {
  let s = (seed | 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) / 0x100000000);
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function compileRulesArray(rules) {
  const sorted = compiler.sortRules(rules);
  const all = [];
  for (const rule of sorted) {
    const insts = compiler.compileRule(rule);
    for (const inst of insts) all.push(inst);
  }
  return Uint32Array.from(all);
}

function buildAllRulesets() {
  const sets = [];

  // canonical 11
  sets.push({ id: "canonical-11", rules: C.CONSTRAINTS.map(r => ({ when: { ...r.when }, then: { ...r.then } })) });

  // exhaustive 1-key x thens
  const oneKey = allDimValueClauses();
  const thens  = thenClauseCatalogue();
  let idx = 0;
  for (const when of oneKey) {
    for (const then of thens) {
      sets.push({ id: "one-key-" + (idx++), rules: [{ when: { ...when }, then: { ...then } }] });
    }
  }

  // exhaustive 2-key x { deny then, classification then }
  const denyThen  = { sdf: 1, deny: "SubPrime cannot hold BusinessLine" };
  const classThen = { rt: "B-STANDARD", rth: 130, doc: "ENHANCED" };
  idx = 0;
  for (const when of allTwoKeyClauses()) {
    for (const then of [denyThen, classThen]) {
      sets.push({ id: "two-key-" + (idx++), rules: [{ when: { ...when }, then: { ...then } }] });
    }
  }

  // exhaustive 3-key x deny then
  idx = 0;
  for (const when of allThreeKeyClauses()) {
    sets.push({ id: "three-key-" + (idx++), rules: [{ when: { ...when }, then: { ...denyThen } }] });
  }

  // rule-count scaling, seeded
  const rng = makeRng(0xC0FFEE);
  const twoK = allTwoKeyClauses(), threeK = allThreeKeyClauses();
  function randomRule() {
    const w = rng();
    let when;
    if (w < 0.5)        when = pick(rng, oneKey);
    else if (w < 0.85)  when = pick(rng, twoK);
    else                when = pick(rng, threeK);
    return { when: { ...when }, then: { ...pick(rng, thens) } };
  }
  idx = 0;
  for (let n = 1; n <= 16; n++) {
    for (let s = 0; s < 24; s++) {
      const rules = [];
      for (let i = 0; i < n; i++) rules.push(randomRule());
      sets.push({ id: "scale-n" + n + "-s" + s + "-" + (idx++), rules });
    }
  }

  // overwrite pairs
  const valuesByField = {
    sdf:  [-1, 1],
    rt:   C.RT_TABLE.slice(),
    rth:  [0, 1, 127, 255],
    doc:  C.DOC_TABLE.slice(),
    reg:  C.REG_TABLE.slice(),
    deny: C.DENY_TABLE.slice()
  };
  const FIELDS = ["sdf", "rt", "rth", "doc", "reg", "deny"];
  const whenA = oneKey[0], whenB = twoK[0];
  idx = 0;
  for (const f of FIELDS) {
    const vs = valuesByField[f];
    for (const a of vs) {
      for (const b of vs) {
        if (a === b) continue;
        sets.push({
          id: "overwrite-" + f + "-" + (idx++),
          rules: [
            { when: { ...whenA }, then: { [f]: a } },
            { when: { ...whenB }, then: { [f]: b } }
          ]
        });
      }
    }
  }

  return sets;
}

// ---------------------------------------------------------------------------
// Observation: walk every constraint and every resolved record, report
// what fields each carries.
// ---------------------------------------------------------------------------

// Tracks the union of all keys seen across all constraints / records.
const observations = {
  rulesetsObserved: 0,
  totalConstraints: 0,
  totalResolvedRecords: 0,

  // Constraint-shape observations
  constraintFieldKeys: Object.create(null),     // key -> count of constraints carrying it
  whenClauseDimKeys: Object.create(null),       // dim name -> count
  thenClauseFieldKeys: Object.create(null),     // then-field name -> count

  // Output-record observations
  outputRecordFieldKeys: Object.create(null),   // field name -> count of records carrying it
  distinctOutputValuesByField: Object.create(null),  // field -> Set of values seen

  // "Kind" observations: does any constraint or record carry an explicit
  // `kind` field?
  explicitKindValuesSeen: Object.create(null),

  // Schema-shape variation: for each constraint, what's the sorted list
  // of top-level keys? count distinct shapes.
  constraintShapeCounts: Object.create(null),
  resolvedRecordShapeCounts: Object.create(null),

  // Intern-table value usage
  rtValuesUsed: new Set(),
  docValuesUsed: new Set(),
  regValuesUsed: new Set(),
  denyValuesUsed: new Set(),

  // Output-record cardinality: how many unique resolved (sdf,rt,rth,doc,reg,deny)
  // tuples appear across all rulesets x all 2,880 coords?
  uniqueOutputTuples: new Set()
};

function recordConstraint(rule) {
  observations.totalConstraints++;

  for (const k of Object.keys(rule)) {
    observations.constraintFieldKeys[k] = (observations.constraintFieldKeys[k] || 0) + 1;
  }

  if (rule.when) {
    for (const k of Object.keys(rule.when)) {
      observations.whenClauseDimKeys[k] = (observations.whenClauseDimKeys[k] || 0) + 1;
    }
  }
  if (rule.then) {
    for (const k of Object.keys(rule.then)) {
      observations.thenClauseFieldKeys[k] = (observations.thenClauseFieldKeys[k] || 0) + 1;
    }
  }

  if (Object.prototype.hasOwnProperty.call(rule, "kind")) {
    const k = String(rule.kind);
    observations.explicitKindValuesSeen[k] = (observations.explicitKindValuesSeen[k] || 0) + 1;
  }

  const shape = Object.keys(rule).sort().join(",");
  observations.constraintShapeCounts[shape] = (observations.constraintShapeCounts[shape] || 0) + 1;
}

function recordResolvedRecord(rec) {
  observations.totalResolvedRecords++;

  for (const k of Object.keys(rec)) {
    observations.outputRecordFieldKeys[k] = (observations.outputRecordFieldKeys[k] || 0) + 1;
    if (!observations.distinctOutputValuesByField[k]) {
      observations.distinctOutputValuesByField[k] = new Set();
    }
    observations.distinctOutputValuesByField[k].add(rec[k]);
  }

  if (Object.prototype.hasOwnProperty.call(rec, "kind")) {
    const k = String(rec.kind);
    observations.explicitKindValuesSeen[k] = (observations.explicitKindValuesSeen[k] || 0) + 1;
  }

  const shape = Object.keys(rec).sort().join(",");
  observations.resolvedRecordShapeCounts[shape] = (observations.resolvedRecordShapeCounts[shape] || 0) + 1;

  // Record unique output-tuple identity
  const tuple = rec.sdf + "|" + rec.rt + "|" + rec.rth + "|" + rec.doc + "|" + rec.reg + "|" + rec.deny;
  observations.uniqueOutputTuples.add(tuple);
}

function trackInternValue(table, value) {
  if (table === "rt")   observations.rtValuesUsed.add(value);
  if (table === "doc")  observations.docValuesUsed.add(value);
  if (table === "reg")  observations.regValuesUsed.add(value);
  if (table === "deny") observations.denyValuesUsed.add(value);
}

// ---------------------------------------------------------------------------
// Main loop: observe every ruleset, every constraint, every resolved record
// ---------------------------------------------------------------------------

const t0 = Date.now();
const sets = buildAllRulesets();
console.log("[pass-1] " + sets.length + " rulesets to observe");

for (let s = 0; s < sets.length; s++) {
  const { id, rules } = sets[s];
  observations.rulesetsObserved++;

  // Observe every constraint as authored
  for (const rule of rules) {
    recordConstraint(rule);
    // Intern-value usage from then clauses
    if (rule.then) {
      if (rule.then.rt   !== undefined) trackInternValue("rt",   rule.then.rt);
      if (rule.then.doc  !== undefined) trackInternValue("doc",  rule.then.doc);
      if (rule.then.reg  !== undefined) trackInternValue("reg",  rule.then.reg);
      if (rule.then.deny !== undefined) trackInternValue("deny", rule.then.deny);
    }
  }

  // Compile and resolve. Use CSS oracle (the reference); since CSS == JS ==
  // GPU byte-identical, the resolved structure is substrate-independent.
  // But we only need to walk one substrate's output to observe record shape.
  const compiled = compileRulesArray(rules);
  for (let coordIdx = 0; coordIdx < C.STATE_SPACE_SIZE; coordIdx++) {
    const coord = C.unpackCoord(coordIdx);
    const rec = jsOrig.execute(compiled, coord);
    recordResolvedRecord(rec);
  }

  if ((s + 1) % 500 === 0) {
    console.log("[pass-1]   " + (s + 1) + " / " + sets.length);
  }
}

const dt = Date.now() - t0;
console.log("[pass-1] observation complete in " + (dt / 1000).toFixed(1) + "s");

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function setToSortedArray(s) {
  return Array.from(s).sort();
}

const report = {
  experiment: "Experiment 1, Pass 1: kind-structure observation across canonical Phase A grammar",
  date: new Date().toISOString().slice(0, 10),
  generator: "phase-A equivalence harness (canonical + exhaustive 1-key/2-key/3-key + rule-count scaling + overwrite pairs)",

  totals: {
    rulesetsObserved: observations.rulesetsObserved,
    totalConstraints: observations.totalConstraints,
    totalResolvedRecords: observations.totalResolvedRecords,
    elapsedSeconds: Number((dt / 1000).toFixed(1))
  },

  constraintStructure: {
    distinctTopLevelKeysSeen: Object.keys(observations.constraintFieldKeys).sort(),
    keyCounts: observations.constraintFieldKeys,
    distinctConstraintShapes: Object.keys(observations.constraintShapeCounts).length,
    shapeCounts: observations.constraintShapeCounts,
    whenDimensionsExercised: Object.keys(observations.whenClauseDimKeys).sort(),
    whenDimCounts: observations.whenClauseDimKeys,
    thenFieldsExercised: Object.keys(observations.thenClauseFieldKeys).sort(),
    thenFieldCounts: observations.thenClauseFieldKeys
  },

  resolvedRecordStructure: {
    distinctTopLevelKeysSeen: Object.keys(observations.outputRecordFieldKeys).sort(),
    keyCounts: observations.outputRecordFieldKeys,
    distinctRecordShapes: Object.keys(observations.resolvedRecordShapeCounts).length,
    shapeCounts: observations.resolvedRecordShapeCounts,
    distinctValuesPerField: {
      sdf:  observations.distinctOutputValuesByField.sdf  ? observations.distinctOutputValuesByField.sdf.size  : 0,
      rt:   observations.distinctOutputValuesByField.rt   ? observations.distinctOutputValuesByField.rt.size   : 0,
      rth:  observations.distinctOutputValuesByField.rth  ? observations.distinctOutputValuesByField.rth.size  : 0,
      doc:  observations.distinctOutputValuesByField.doc  ? observations.distinctOutputValuesByField.doc.size  : 0,
      reg:  observations.distinctOutputValuesByField.reg  ? observations.distinctOutputValuesByField.reg.size  : 0,
      deny: observations.distinctOutputValuesByField.deny ? observations.distinctOutputValuesByField.deny.size : 0
    },
    uniqueOutputTuples: observations.uniqueOutputTuples.size
  },

  internTableUsage: {
    rtTableSize: C.RT_TABLE.length,
    rtValuesActuallyUsed: setToSortedArray(observations.rtValuesUsed),
    rtCoverage: observations.rtValuesUsed.size + " / " + C.RT_TABLE.length,
    docTableSize: C.DOC_TABLE.length,
    docValuesActuallyUsed: setToSortedArray(observations.docValuesUsed),
    docCoverage: observations.docValuesUsed.size + " / " + C.DOC_TABLE.length,
    regTableSize: C.REG_TABLE.length,
    regValuesActuallyUsed: setToSortedArray(observations.regValuesUsed),
    regCoverage: observations.regValuesUsed.size + " / " + C.REG_TABLE.length,
    denyTableSize: C.DENY_TABLE.length,
    denyValuesActuallyUsed: setToSortedArray(observations.denyValuesUsed),
    denyCoverage: observations.denyValuesUsed.size + " / " + C.DENY_TABLE.length
  },

  kindFieldObservation: {
    constraintsCarryingExplicitKindField: observations.constraintFieldKeys["kind"] || 0,
    recordsCarryingExplicitKindField: observations.outputRecordFieldKeys["kind"] || 0,
    explicitKindValuesSeen: Object.keys(observations.explicitKindValuesSeen).sort(),
    explicitKindValueCounts: observations.explicitKindValuesSeen
  }
};

// Write JSON for programmatic inspection
const outDir = path.dirname(path.resolve(__filename));
const jsonOut = path.join(outDir, "pass-1-observation.json");
fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2));
console.log("[pass-1] wrote " + jsonOut);

// Print human-readable summary
console.log("");
console.log("=== Pass 1 Summary ===");
console.log("");
console.log("Rulesets observed:        " + report.totals.rulesetsObserved);
console.log("Constraints walked:       " + report.totals.totalConstraints);
console.log("Resolved records walked:  " + report.totals.totalResolvedRecords);
console.log("");
console.log("--- Constraint structure ---");
console.log("Top-level keys seen on constraints: " + report.constraintStructure.distinctTopLevelKeysSeen.join(", "));
console.log("Distinct constraint shapes:         " + report.constraintStructure.distinctConstraintShapes);
console.log("");
for (const shape of Object.keys(report.constraintStructure.shapeCounts)) {
  console.log("  shape: {" + shape + "}  -> " + report.constraintStructure.shapeCounts[shape] + " constraints");
}
console.log("");
console.log("WHEN dims exercised: " + report.constraintStructure.whenDimensionsExercised.join(", "));
console.log("THEN fields exercised: " + report.constraintStructure.thenFieldsExercised.join(", "));
console.log("");
console.log("--- Resolved record structure ---");
console.log("Top-level keys seen on records: " + report.resolvedRecordStructure.distinctTopLevelKeysSeen.join(", "));
console.log("Distinct record shapes:         " + report.resolvedRecordStructure.distinctRecordShapes);
console.log("Distinct values per field:");
for (const f of ["sdf", "rt", "rth", "doc", "reg", "deny"]) {
  console.log("  " + f.padEnd(5) + ": " + report.resolvedRecordStructure.distinctValuesPerField[f]);
}
console.log("Unique output tuples across all runs: " + report.resolvedRecordStructure.uniqueOutputTuples);
console.log("");
console.log("--- Intern-table usage ---");
console.log("rt:   " + report.internTableUsage.rtCoverage   + "  (" + report.internTableUsage.rtValuesActuallyUsed.join(", ") + ")");
console.log("doc:  " + report.internTableUsage.docCoverage  + "  (" + report.internTableUsage.docValuesActuallyUsed.join(", ") + ")");
console.log("reg:  " + report.internTableUsage.regCoverage  + "  (" + report.internTableUsage.regValuesActuallyUsed.join(", ") + ")");
console.log("deny: " + report.internTableUsage.denyCoverage);
console.log("");
console.log("--- Kind-field observation ---");
console.log("Constraints carrying explicit 'kind' field: " + report.kindFieldObservation.constraintsCarryingExplicitKindField);
console.log("Records carrying explicit 'kind' field:     " + report.kindFieldObservation.recordsCarryingExplicitKindField);
console.log("Explicit 'kind' values seen anywhere:       " + (report.kindFieldObservation.explicitKindValuesSeen.length || "(none)"));
console.log("");
console.log("=== End Pass 1 ===");
