// ============================================================================
// not2-boundary.test.js  --  Boundary-1: NOT over a conjunction
// ============================================================================
//
// What this tests, in the reframed experiment
// -------------------------------------------
// The postfix machine is a read protocol over the cascade's resolved field.
// Boundary-1 is the first region the cascade can resolve natively that the
// current grammar (positive AND/NOT over single-dim clauses) cannot address
// directly: NOT (A AND B) for two distinct dims.
//
// CSS reading (the reference):
//   :not([credit=prime][product=mortgage])
//   = NOT (x_credit = prime AND x_product = mortgage)
//   = NOT A OR NOT B          (De Morgan)
//   = the entire field MINUS the (prime, mortgage) slice
//
// We compare three encodings against this reference:
//
//   Expression A (what NOT-1 supports):
//     { "!credit": "prime", "!product": "mortgage" }
//     = (NOT A) AND (NOT B)   -- componentwise negation
//     = the field MINUS (anywhere prime) MINUS (anywhere mortgage)
//     = a STRICT SUBSET of the De Morgan region
//
//   Expression B (DNF-expanded -- two rules, same `then`):
//     [
//       { when: { "!credit":  "prime"    }, then: T },
//       { when: { "!product": "mortgage" }, then: T }
//     ]
//     = the union of (NOT A) and (NOT B)
//     = exactly NOT (A AND B)        -- by De Morgan
//     A coord matches if EITHER rule fires; cascade unions the writes.
//
//   Expression C (single rule with compound NOT):
//     { when: { not: { credit: "prime", product: "mortgage" } } }
//     = NOT (A AND B)        -- direct expression
//     This is what the current grammar CANNOT phrase.
//
// What this test verifies:
//   T1. Expression A produces a strict-subset region (the cascade and the
//       grammar agree that A != NOT(A AND B)).
//   T2. Expression B produces the same region the CSS-correct oracle does
//       for NOT(A AND B) -- DNF expansion via two rules is byte-equivalent
//       to a compound NOT.
//   T3. Expression C cannot be compiled with the current grammar; the
//       compiler must reject or fail. This is the boundary, named.
//
// What this tells us:
//   - If T1, T2, T3 all hold, the boundary is exactly where the structural
//     reframe predicted: the cascade can resolve NOT(A AND B) as a single
//     region; the grammar can READ it (via DNF) but cannot ADDRESS it
//     directly as a single clause.
//   - The grammar's expressive incompleteness is at the syntactic level
//     (clause shape), not the semantic level (regions reachable). DNF
//     expansion is the bridge.
// ============================================================================

"use strict";

const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..", "..");
const C = require(path.join(ROOT, "constraints.js"));

// Pull in the extended toolchain from not1.
const not1 = require("./not1-toolchain.js");

const FIELDS = ["sdf", "rt", "rth", "doc", "reg", "deny"];

// ---------------------------------------------------------------------------
// Reference: a CSS-correct oracle that natively understands NOT(A AND B)
// ---------------------------------------------------------------------------
// This is the ground truth. It evaluates the cascade's resolved field
// directly, using whatever predicate shape we choose. For Boundary-1 we
// need to evaluate { not: { dim1: v1, dim2: v2 } } as a compound-NOT.
//
// Algorithm: same as NOT-1's CSS oracle (left fold over specificity-sorted
// rules, partial-assignment SET, post-pass derivation), with one
// extension: a `when` clause may have key "not" whose value is itself an
// object of positive equality clauses. The clause holds when the inner
// AND of equalities does NOT hold.

function clauseHoldsAtCoord(when, coord) {
  for (const key of Object.keys(when)) {
    if (key === "not") {
      // Compound NOT: NOT (AND of inner clauses)
      const inner = when.not;
      let innerHolds = true;
      for (const innerKey of Object.keys(inner)) {
        const dIdx = C.dimIndex(innerKey);
        const expectedValue = inner[innerKey];
        const actualValue = C.DIMS[dIdx].values[coord[dIdx]];
        if (actualValue !== expectedValue) { innerHolds = false; break; }
      }
      if (innerHolds) return false; // NOT of true = false
      continue;
    }
    const negated = key.startsWith("!");
    const dimName = negated ? key.slice(1) : key;
    const dIdx = C.dimIndex(dimName);
    const expectedValue = when[key];
    const actualValue = C.DIMS[dIdx].values[coord[dIdx]];
    const matches = (actualValue === expectedValue);
    const clauseHolds = negated ? !matches : matches;
    if (!clauseHolds) return false;
  }
  return true;
}

function specificityCount(when) {
  // Number of constraint clauses. A `not` key counts as ONE clause
  // (matches CSS where :not() contributes the specificity of its
  // argument's most-specific element, but for our purposes the
  // compound-NOT is one named region).
  return Object.keys(when).length;
}

function referenceResolve(rules, coord) {
  const sorted = rules.slice().map((r, i) => ({ r, i }))
    .sort((x, y) => {
      const d = specificityCount(x.r.when) - specificityCount(y.r.when);
      return d !== 0 ? d : x.i - y.i;
    })
    .map(e => e.r);

  const out = {
    sdf: C.DEFAULTS.sdf, reg: C.DEFAULTS.reg, deny: C.DEFAULTS.deny,
    rt: C.DEFAULTS.rt, rth: C.DEFAULTS.rth, doc: C.DEFAULTS.doc
  };
  for (const r of sorted) {
    if (clauseHoldsAtCoord(r.when, coord)) {
      if ("sdf"  in r.then) out.sdf  = r.then.sdf;
      if ("reg"  in r.then) out.reg  = r.then.reg;
      if ("deny" in r.then) out.deny = r.then.deny;
      if ("rt"   in r.then) out.rt   = r.then.rt;
      if ("rth"  in r.then) out.rth  = r.then.rth;
      if ("doc"  in r.then) out.doc  = r.then.doc;
    }
  }
  if (out.sdf === 1) { out.reg = "DENIED"; out.rth = 0; }
  return out;
}

function recordToIndices(rec) {
  return {
    sdf:  rec.sdf | 0,
    rth:  rec.rth >>> 0,
    rt:   C.lookupIndex(C.RT_TABLE,   rec.rt)   >>> 0,
    doc:  C.lookupIndex(C.DOC_TABLE,  rec.doc)  >>> 0,
    reg:  C.lookupIndex(C.REG_TABLE,  rec.reg)  >>> 0,
    deny: C.lookupIndex(C.DENY_TABLE, rec.deny) >>> 0
  };
}

// ---------------------------------------------------------------------------
// The denial then-clause we use across all three expressions
// ---------------------------------------------------------------------------
const DENY_THEN = {
  sdf: 1,
  deny: "SubPrime cannot hold BusinessLine" // any legal deny string
};

// ---------------------------------------------------------------------------
// Test orchestration
// ---------------------------------------------------------------------------

const results = { pass: 0, fail: 0, notes: [] };
function test(label, body) {
  try {
    body();
    results.pass++;
    console.log("  PASS  " + label);
  } catch (e) {
    results.fail++;
    console.log("  FAIL  " + label + "  -> " + e.message);
  }
}
function note(s) { results.notes.push(s); console.log("  NOTE  " + s); }

function regionAt(rules, useReference) {
  // Returns the set of coord indices where sdf=1 (the denial region).
  const region = new Set();
  for (let i = 0; i < C.STATE_SPACE_SIZE; i++) {
    const coord = C.unpackCoord(i);
    let r;
    if (useReference) r = recordToIndices(referenceResolve(rules, coord));
    else {
      const insts = not1.compileAllExt(rules);
      r = not1.executeExt(insts, coord);
    }
    if (r.sdf === 1) region.add(i);
  }
  return region;
}

function sizeOf(s) { return s.size; }
function isSubset(a, b) { for (const x of a) if (!b.has(x)) return false; return true; }
function setsEqual(a, b) { return a.size === b.size && isSubset(a, b); }

// ---------------------------------------------------------------------------
// The three expressions, evaluated as denial regions
// ---------------------------------------------------------------------------

console.log("\n=== Boundary-1: NOT (A AND B) ===\n");

// Reference region: NOT (credit=prime AND product=mortgage)
// Computed via the reference oracle with a compound NOT clause.
const referenceRules = [{
  when: { not: { credit: "prime", product: "mortgage" } },
  then: DENY_THEN
}];
const referenceRegion = regionAt(referenceRules, true);
note(`reference NOT(A AND B) region size: ${sizeOf(referenceRegion)}`);
// Sanity: A AND B = (credit=prime AND product=mortgage) = 1 * 1 = 1/12 of dims.
// 6 dims with cards [3,4,4,3,4,5]; the A&B slice is 1*1*4*3*4*5 = 240.
// NOT(A AND B) should be 2880 - 240 = 2640.
test("reference region size = 2880 - 240 = 2640 (sanity)", () => {
  if (referenceRegion.size !== 2640)
    throw new Error("got " + referenceRegion.size);
});

// Expression A: componentwise negation via NOT-1 grammar.
const rulesA = [{
  when: { "!credit": "prime", "!product": "mortgage" },
  then: DENY_THEN
}];
const regionA = regionAt(rulesA, false);
note(`Expression A componentwise region size: ${sizeOf(regionA)}`);
// (NOT A) AND (NOT B) = NOT-prime AND NOT-mortgage
// = 2 of 3 credit values * 3 of 4 product values * 4*3*4*5 = 2*3*240 = 1440.
test("Expression A region size = 2 * 3 * 4 * 3 * 4 * 5 = 1440", () => {
  if (regionA.size !== 1440) throw new Error("got " + regionA.size);
});

test("T1: Expression A is a STRICT SUBSET of the reference region", () => {
  if (!isSubset(regionA, referenceRegion))
    throw new Error("A is not subset of reference");
  if (setsEqual(regionA, referenceRegion))
    throw new Error("A equals reference -- expected strict subset");
});

// Expression B: DNF-expanded into two rules.
const rulesB = [
  { when: { "!credit":  "prime"    }, then: DENY_THEN },
  { when: { "!product": "mortgage" }, then: DENY_THEN }
];
const regionB = regionAt(rulesB, false);
note(`Expression B DNF-expanded region size: ${sizeOf(regionB)}`);

test("T2: Expression B equals the reference region (DNF == compound NOT)", () => {
  if (!setsEqual(regionB, referenceRegion)) {
    throw new Error(`B.size=${regionB.size} ref.size=${referenceRegion.size}`);
  }
});

// Expression C: direct compound NOT in the grammar.
// We expect this to fail at the compiler. We test that failure is what we
// observe (not silent acceptance with surprising semantics).
console.log("");
console.log("=== Expression C: direct compound NOT in current grammar ===\n");

const rulesC = [{
  when: { not: { credit: "prime", product: "mortgage" } },
  then: DENY_THEN
}];

test("T3: compiler refuses (or mis-handles) Expression C", () => {
  let threw = false, surprisingAccept = false, regionC = null;
  try {
    regionC = regionAt(rulesC, false);
  } catch (e) {
    threw = true;
    note("compiler threw: " + e.message);
  }
  if (!threw && regionC) {
    // The compiler accepted it. That's a SOFTER form of the boundary:
    // it didn't refuse, but it almost certainly handled `not` as a key
    // name (which the parser interprets as a dim name "not", which is
    // an unknown dim) or silently treated it as an unmatched clause.
    if (regionC.size === referenceRegion.size && setsEqual(regionC, referenceRegion)) {
      throw new Error("Expression C SILENTLY produced the correct region -- " +
        "the current grammar already supports compound NOT, contradicting " +
        "the boundary claim. Investigate.");
    }
    surprisingAccept = true;
    note(`compiler did NOT throw but produced region size ${regionC.size} ` +
         `(reference is ${referenceRegion.size}). The grammar accepted ` +
         "the syntax but did not produce compound-NOT semantics.");
  }
  // Pass condition: either the compiler threw, or it accepted-but-misinterpreted.
  // Both demonstrate that the current grammar cannot ADDRESS compound NOT
  // as a single clause.
  if (!threw && !surprisingAccept) {
    throw new Error("unexpected control flow");
  }
});

console.log("");
console.log("=== Summary ===");
console.log(`  reference region (cascade-correct NOT(A AND B)): ${referenceRegion.size} coords`);
console.log(`  Expression A (componentwise NOT-1):              ${regionA.size} coords`);
console.log(`  Expression B (DNF, two rules):                   ${regionB.size} coords`);
console.log(`  reference == B?  ${setsEqual(referenceRegion, regionB)}`);
console.log(`  A subset-of reference?  ${isSubset(regionA, referenceRegion)}`);
console.log(`  A == reference?  ${setsEqual(regionA, referenceRegion)}`);

console.log("\n=== Totals ===");
console.log(`PASS: ${results.pass}   FAIL: ${results.fail}`);
if (results.fail > 0) process.exit(1);
process.exit(0);
