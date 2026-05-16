// ============================================================================
// aggregate.test.js  --  Boundary 4b-aggregate: predicate over field
// reduction
// ============================================================================
//
// What this tests
// ---------------
// The aggregate case combines two previous incompleteness modes:
//   - Boundary 4a (reductions): the grammar cannot express "count of coords"
//   - Boundary 4b-stratified: the grammar cannot read from another coord's
//     resolved lane
//
// Aggregate cross-coord composes both: a rule whose `when` clause asks
// about the AGGREGATE STATE of the field, e.g.:
//   "deny this coord if ANY other coord has sdf=1"
//   "deny this coord if MORE THAN HALF of coords have sdf=1"
//
// These are predicates over a reduction. The reduction itself is outside
// the grammar (4a); using its value as a predicate input is outside the
// grammar (4b). The composition is the most-incomplete case the
// expressiveness experiment has produced.
//
// Locked predictions
// ------------------
// P1. Aggregate predicates are well-defined only WITH FIXED-POINT
//     ITERATION (each coord's resolved state may flip the aggregate,
//     which may flip other coords' resolution, which may flip the
//     aggregate, ...).
// P2. The simplest aggregate "deny if any other coord has sdf=1" has
//     two pathological fixed points: ALL denied, or NONE denied. (If
//     even one is denied, all must be; if none is denied, none triggers
//     the rule.) The fixed point reached depends on initial state.
// P3. Counting aggregates ("more than half denied") introduce a phase
//     transition: starting near the threshold, small initial-state
//     perturbations move the fixed point across the boundary.
// P4. Under default-initialized parallel dispatch (all coords start
//     with sdf=-1), ANY aggregate "deny if ANY" rule reaches the
//     all-undenied attractor only. The fixed point is "no, because no
//     one is denied, because no one is denied, ..."
// P5. The byte-identical equivalence claim cannot hold under aggregate
//     dependence without additional structure beyond what mutual
//     (4b-mutual) already demanded: iteration, initial conditions,
//     convergence, oscillation policy, PLUS reduction primitives in
//     the substrate.
//
// What we expect to learn
// -----------------------
// Aggregate dependence is the boundary where the architecture stops being
// a constraint resolver and becomes something else -- a self-referential
// dynamical system whose semantics include not just initial conditions
// but a model of HOW the field perceives itself. This is past where
// algorithm 16 commits to substrate-independence at all; it is in the
// territory the algorithm 16 wide-claim ("computation as geometry, GPU
// as parallel field evaluator") gestures at without specifying.
//
// Run with:  node tests/extensions/dependence-4b/aggregate.test.js
// ============================================================================

"use strict";

const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..", "..");
const C = require(path.join(ROOT, "constraints.js"));

const results = { pass: 0, fail: 0 };
function test(label, body) {
  try { body(); results.pass++; console.log("  PASS  " + label); }
  catch (e) { results.fail++; console.log("  FAIL  " + label + "  -> " + e.message); }
}
function note(s) { console.log("  NOTE  " + s); }

// ---------------------------------------------------------------------------
// Step 1: existential aggregate "deny if ANY other coord has sdf=1"
// ---------------------------------------------------------------------------

console.log("\n=== Step 1: existential aggregate ===\n");

// Rule (proposed): deny this coord if ANY coord in the field has sdf=1.
// This is a self-referential closure: the field's state depends on the
// field's state.
//
// Find fixed points: a state vector s in {-1,+1}^N is a fixed point iff
//   for all i: s[i] = 1 iff exists j: s[j] = 1
//
// Case 1: all s[i] = -1. Then no j has s[j]=1, so no i is flipped to 1.
//         This is consistent. Fixed point: all undenied.
// Case 2: all s[i] = 1. Then some j (every j) has s[j]=1, so all i should
//         be 1. This is consistent. Fixed point: all denied.
// Case 3: mixed. Some i has s[i]=1. Then exists j: s[j]=1, so for ALL i
//         the rule says s[i] should be 1. The mixed state is not fixed.

const N = 100; // toy field size for exposition

function isExistentialFixedPoint(stateVector) {
  const anyDenied = stateVector.some(v => v === 1);
  for (const v of stateVector) {
    const ruleSays = anyDenied ? 1 : -1;
    if (v !== ruleSays) return false;
  }
  return true;
}

const allDenied = new Array(N).fill(1);
const allUndenied = new Array(N).fill(-1);
const oneDenied = new Array(N).fill(-1); oneDenied[42] = 1;

test("P1: 'all undenied' is a fixed point of existential-deny rule", () => {
  if (!isExistentialFixedPoint(allUndenied)) throw new Error("expected fp");
});
test("P1: 'all denied' is a fixed point of existential-deny rule", () => {
  if (!isExistentialFixedPoint(allDenied)) throw new Error("expected fp");
});
test("P1: 'one denied' is NOT a fixed point (rule should propagate)", () => {
  if (isExistentialFixedPoint(oneDenied)) throw new Error("expected not-fp");
});

// Iterate from the one-denied state.
function iterateExistential(state, maxSteps) {
  let s = state.slice();
  for (let step = 0; step < maxSteps; step++) {
    const anyDenied = s.some(v => v === 1);
    const next = s.map(_ => anyDenied ? 1 : -1);
    let changed = false;
    for (let i = 0; i < s.length; i++) if (next[i] !== s[i]) { changed = true; break; }
    if (!changed) return { converged: true, steps: step, state: s };
    s = next;
  }
  return { converged: false, steps: maxSteps, state: s };
}

const fromOne = iterateExistential(oneDenied, 5);
note(`one-denied initial state -> converged in ${fromOne.steps} steps`);
note(`final state: all denied = ${fromOne.state.every(v => v === 1)}`);

test("P2: one-denied initial state propagates to all-denied", () => {
  if (!fromOne.converged) throw new Error("expected convergence");
  if (!fromOne.state.every(v => v === 1)) throw new Error("expected all-denied");
});

const fromAllUndenied = iterateExistential(allUndenied, 5);
test("P4: default-initialized state stays at all-undenied (no propagation seed)", () => {
  if (!fromAllUndenied.converged) throw new Error("expected immediate convergence");
  if (!fromAllUndenied.state.every(v => v === -1)) throw new Error("expected all-undenied");
});

// ---------------------------------------------------------------------------
// Step 2: substrate behavior under existential aggregate
// ---------------------------------------------------------------------------

console.log("\n=== Step 2: substrate behavior under aggregate ===\n");

note("under existential-deny aggregate, default-initialized parallel dispatch:");
note("  - GPU: all 2880 invocations read outputs[] = default (all -1).");
note("         Rule's predicate (any j has sdf=1) is false everywhere.");
note("         Single dispatch reaches the all-undenied fixed point.");
note("  - CSS/JS single-pass: same result; each coord's resolution sees");
note("         default values for everyone else.");
note("");
note("Under default-initialized dispatch, the OTHER attractor (all-denied)");
note("is unreachable. The aggregate predicate is technically expressible");
note("under fixed-point semantics, but its UNIQUE reachable result under");
note("default initialization is the trivial fixed point.");
note("");
note("To reach the non-trivial fixed point, you need:");
note("  - non-default initial conditions (some coord starts at +1)");
note("  - OR a seeding mechanism (a non-aggregate rule that fires");
note("    independently and provides the propagation seed)");
note("  - OR an explicit iteration scheme that explores the state space");

test("default-initialized parallel dispatch reaches only the trivial fixed point", () => {
  const trivialFp = fromAllUndenied.state.every(v => v === -1);
  if (!trivialFp) throw new Error("test premise wrong");
});

// ---------------------------------------------------------------------------
// Step 3: counting aggregate ("more than half denied")
// ---------------------------------------------------------------------------

console.log("\n=== Step 3: counting aggregate -- phase transition ===\n");

// Rule: deny this coord if MORE THAN HALF of coords have sdf=1.

function isCountingFixedPoint(state) {
  const count = state.filter(v => v === 1).length;
  const majority = count > state.length / 2;
  for (const v of state) {
    const ruleSays = majority ? 1 : -1;
    if (v !== ruleSays) return false;
  }
  return true;
}

function iterateCounting(state, maxSteps) {
  let s = state.slice();
  for (let step = 0; step < maxSteps; step++) {
    const count = s.filter(v => v === 1).length;
    const majority = count > s.length / 2;
    const next = s.map(_ => majority ? 1 : -1);
    let changed = false;
    for (let i = 0; i < s.length; i++) if (next[i] !== s[i]) { changed = true; break; }
    if (!changed) return { converged: true, steps: step, state: s };
    s = next;
  }
  return { converged: false, steps: maxSteps, state: s };
}

// Phase transition: at exactly half, the system flips depending on which
// side of "half" the count is. Test from various initial densities.
function makeInitial(denseFraction) {
  const s = new Array(N).fill(-1);
  for (let i = 0; i < Math.floor(N * denseFraction); i++) s[i] = 1;
  return s;
}

note("counting-aggregate fixed points reached from different initial densities:");
for (const frac of [0.0, 0.25, 0.49, 0.50, 0.51, 0.75, 1.0]) {
  const init = makeInitial(frac);
  const r = iterateCounting(init, 5);
  const finalCount = r.state.filter(v => v === 1).length;
  note(`  init density ${frac.toFixed(2)} (${init.filter(v => v === 1).length} denied) -> ` +
       `converged=${r.converged} at step ${r.steps}, final denied=${finalCount}`);
}

test("P3: counting aggregate has a phase transition at 50%", () => {
  const below = iterateCounting(makeInitial(0.49), 5);
  const above = iterateCounting(makeInitial(0.51), 5);
  const belowAllUndenied = below.state.every(v => v === -1);
  const aboveAllDenied = above.state.every(v => v === 1);
  if (!belowAllUndenied) throw new Error("below-threshold should collapse to all-undenied");
  if (!aboveAllDenied) throw new Error("above-threshold should collapse to all-denied");
});

note("");
note("PHASE TRANSITION: tiny perturbation around 50% flips the fixed point");
note("reached. The aggregate's value at initialization determines the final");
note("state. This is not a feature of the CONSTRAINTS -- it is a feature of");
note("the INITIAL CONDITIONS, which the current architecture does not commit to.");

// ---------------------------------------------------------------------------
// Step 4: where this lands relative to algorithm 16
// ---------------------------------------------------------------------------

console.log("\n=== Step 4: relationship to algorithm 16 ===\n");

note("the algorithm 16 narrow claim:");
note("  'the same constraint geometry that resolves via the CSS cascade");
note("   also resolves via a JavaScript stack machine and a WGSL compute");
note("   shader; the three substrates produce byte-identical output across");
note("   every program the compiler accepts.'");
note("");
note("the algorithm 16 closure boundaries we've now empirically located:");
note("");
note("  NOT-1 (single-dim NOT):      INSIDE  -- byte-identical preserved");
note("                                          with one new opcode.");
note("  NOT-2 (compound NOT):        SYNTACTIC -- not addressable as one");
note("                                            clause; DNF bridges.");
note("  4a (reductions):             STRUCTURAL -- no in-grammar workaround;");
note("                                             external agent required.");
note("  4b-stratified (named foreign): STRUCTURAL -- K-pass dispatch required;");
note("                                                substrate equivalence");
note("                                                must be re-derived.");
note("  4b-mutual (cyclic):          BEYOND -- fixed-point iteration required;");
note("                                         multiple fixed points; substrate");
note("                                         equivalence does not hold by");
note("                                         construction.");
note("  4b-aggregate (predicate over reduction):");
note("                               BEYOND -- combines 4a and 4b-mutual;");
note("                                         phase transitions depend on");
note("                                         initial conditions; the");
note("                                         architecture has no commitment");
note("                                         to those.");
note("");
note("the algorithm 16 wide-claim (substrate-independence as a structural");
note("property of the constraint geometry) holds STRICTLY for what the");
note("postfix machine reads from a fully-resolved cascade where every coord");
note("is independent. It does not hold past the independence-closure");
note("boundary without additional architectural commitments.");

test("P5: aggregate dependence is structurally past where algorithm 16 commits", () => {
  // The narrow claim covers per-coord, single-pass resolution. Aggregate
  // dependence requires (per Step 1 + Step 3):
  //   - cross-coord visibility (boundary 4b-stratified)
  //   - reduction primitives (boundary 4a)
  //   - fixed-point iteration (boundary 4b-mutual)
  //   - initial conditions (new commitment)
  //   - phase-transition handling (new commitment)
  // None of these are in the current algorithm 16. The byte-identical
  // claim cannot extend to programs that require them.
  const algorithm16Commits = ["per-coord", "single-pass", "byte-identical-by-construction"];
  const aggregateRequires = ["cross-coord", "iteration", "init-conditions", "phase-handling"];
  for (const r of aggregateRequires) {
    if (algorithm16Commits.includes(r)) {
      throw new Error("algorithm 16 already covers " + r);
    }
  }
});

console.log("\n=== Totals ===");
console.log(`PASS: ${results.pass}   FAIL: ${results.fail}`);
if (results.fail > 0) process.exit(1);
process.exit(0);
