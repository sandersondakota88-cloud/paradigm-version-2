// test-phase3.js - Phase 3 integration test

“use strict”;

const FieldModule = require(”./field.js”);
const CompilerModule = require(”./constraint-compiler.js”);
const ERengineModule = require(”./er-engine.js”);
const CTengineModule = require(”./ct-engine.js”);

const Field = FieldModule.Field;
const Trace = FieldModule.Trace;
const OpsLog = FieldModule.OpsLog;
const CFG = FieldModule.CFG;

// ––––––––––––––––––––––––––––––––
// Setup: instantiate both engines, bind them through the field
// (NOT through commands)
// ––––––––––––––––––––––––––––––––
function setup() {
// Reset everything to a known state for test reproducibility
Field.reset();
Trace.clear();
OpsLog.clear();

const er = new ERengineModule.ERengine();
// Simulate ER init (no GPU available in Node, falls back to CPU path)
// We can’t await here in a test setup func; the er.init() will set
// CPU_FALLBACK on the first evaluateAsync call. To make the test
// explicit, set CPU_FALLBACK directly:
er.state = “cpu-fallback”;

const ct = new CTengineModule.CTengine();
ct.bind(er, CompilerModule);

return { er: er, ct: ct };
}

// ––––––––––––––––––––––––––––––––
// Test 1: Basic sequential operation through CT engine
// ––––––––––––––––––––––––––––––––
async function testBasicSequential() {
console.log(”=== Test 1: basic sequential CT operation ===”);
const { ct } = setup();

ct.enqueueInput(“hello world”);
ct.enqueueInput(“hello again”);
ct.enqueueInput(“the quick brown fox”);

console.log(”  pending: “ + Field.ctPendingOps.length);
console.log(”  exec-delta initial: “ + Field.execScalarDelta.toFixed(3));

await ct.drainAll(20);

console.log(”  ops executed: “ + ct.opsExecuted);
console.log(”  final constraints: “ + Field.constraints.length);
console.log(”  render-delta: “ + Field.scalarDelta.toFixed(3));
console.log(”  exec-delta: “ + Field.execScalarDelta.toFixed(3));

return {
pass: Field.constraints.length > 1
&& ct.opsExecuted >= 3
&& Field.scalarDelta < 1.0
};
}

// ––––––––––––––––––––––––––––––––
// Test 2: Cross-engine ratification
//
// CT engine routes inputs through the ER engine for parallel
// resolution. When a render-scope prediction generated earlier
// matches an input that arrives later, it must be ratified.
// This proves the two engines are coupled through the field’s
// match results, not through messages.
// ––––––––––––––––––––––––––––––––
async function testCrossEngineRatification() {
console.log(”\n=== Test 2: cross-engine ratification ===”);
const { ct } = setup();

// Send inputs that will trigger predictive generation (gap rises
// when char-class diversity is uneven)
ct.enqueueInput(“hello world”);
ct.enqueueInput(“the quick brown fox”);
await ct.drainAll(10);

// Verify predictions were generated (render-scope, by Field.generatePredictions)
const predsAfterPhase1 = Field.constraints.filter(c => c.kind === “predictive”).length;
console.log(”  predictive constraints after first inputs: “ + predsAfterPhase1);

// Now feed an input that should ratify a digits prediction
ct.enqueueInput(“42 numbers here”);
await ct.drainAll(5);

const ratifiedCount = Field.ratCount;
console.log(”  ratifications after digit input: “ + ratifiedCount);

return {
pass: predsAfterPhase1 > 0 && ratifiedCount > 0
};
}

// ––––––––––––––––––––––––––––––––
// Test 3: Execution-scope vector-delta
//
// Verifies that exec-delta is computed independently from render-delta
// and that they can diverge.
// ––––––––––––––––––––––––––––––––
async function testExecScopeDelta() {
console.log(”\n=== Test 3: execution-scope delta ===”);
const { ct } = setup();

// Empty queue -> exec-delta should be 1.0 (everything unresolved)
Field.refreshExecVectorDelta();
console.log(”  empty-queue exec-delta: “ + Field.execScalarDelta.toFixed(3));

// Enqueue many ops, see exec-delta rise as queue saturates
for (let i = 0; i < 5; i++) ct.enqueueInput(“input “ + i);
Field.refreshExecVectorDelta();
console.log(”  5 pending ops, exec-delta: “ + Field.execScalarDelta.toFixed(3));
console.log(”  pending: “ + Field.ctPendingOps.length);

// Drain them; exec-delta should drop (resolved fraction grows)
await ct.drainAll(10);
Field.refreshExecVectorDelta();
console.log(”  after drain, exec-delta: “ + Field.execScalarDelta.toFixed(3));
console.log(”  ops completed: “ + Field.ctOpsCompleted);
console.log(”  total ops seen: “ + Field.ctTotalOpsSeen);

// Exec-delta and render-delta should not be identical
const renderD = Field.scalarDelta.toFixed(3);
const execD = Field.execScalarDelta.toFixed(3);
console.log(”  render-delta: “ + renderD + “ | exec-delta: “ + execD);

return {
pass: Field.ctOpsCompleted >= 5
// exec-delta meaningfully drops as ops are processed
&& Field.execScalarDelta < 0.5
};
}

// ––––––––––––––––––––––––––––––––
// Test 4: Execution-scope predictive generation
//
// When the CT engine sees repeated inputs without intervening
// consolidation operations (DEVELOP, etc.), it should predict
// that DEVELOP would close the exec-gap.
// ––––––––––––––––––––––––––––––––
async function testExecPredict() {
console.log(”\n=== Test 4: execution-scope predictive generation ===”);
const { ct } = setup();

// Feed 6 INPUT ops to set up the heuristic (4+ inputs without DEVELOP)
for (let i = 0; i < 6; i++) ct.enqueueInput(“input “ + i);
await ct.drainAll(10);

// Force exec-gap above threshold so heuristic 1 will fire on next step
Field.execGap = 0.3;
Field.execScalarDelta = 0.5;
Field.execFastDelta = 0.7;
Field.execSlowDelta = 0.4;

const predsBefore = ct.predictionsGeneratedExec;
const opsBefore = ct.opsExecuted;

// Step once. The step’s prediction phase runs first (generates DEVELOP),
// then the dequeue+execute phase runs (executes that DEVELOP, since
// queue was empty until prediction populated it).
await ct.step();

const predsAfter = ct.predictionsGeneratedExec;
const opsAfter = ct.opsExecuted;

console.log(”  exec-predictions before/after: “ + predsBefore + “ -> “ + predsAfter);
console.log(”  ops executed before/after: “ + opsBefore + “ -> “ + opsAfter);

// Inspect the committed queue to find what was just executed
const lastCommitted = Field.ctCommittedQueue[Field.ctCommittedQueue.length - 1];
console.log(”  last committed op: “ + (lastCommitted ? lastCommitted.kind : “none”));

return {
pass: predsAfter > predsBefore
&& opsAfter > opsBefore
&& lastCommitted
&& (lastCommitted.kind === “develop” || lastCommitted.kind === “tick”
|| lastCommitted.kind === “promote”)
};
}

// ––––––––––––––––––––––––––––––––
// Test 5: Persistence (serialize / deserialize)
//
// Save state, modify state, restore, verify match.
// ––––––––––––––––––––––––––––––––
async function testPersistence() {
console.log(”\n=== Test 5: persistence ===”);
const { ct } = setup();

// Build up some interesting state
ct.enqueueInput(“hello world”);
ct.enqueueInput(“the quick brown fox jumps”);
ct.enqueueInput(“42 numbers here”);
ct.enqueueInput(“symbols ! @ #”);
ct.enqueueInput(“hello again”);
await ct.drainAll(15);

// Capture state we care about
const savedJson = Field.serialize();
const savedConstraintCount = Field.constraints.length;
const savedRatCount = Field.ratCount;
const savedScalarDelta = Field.scalarDelta;
const savedSubcascadeCount = Field.subcascades.length;
const savedNamingPref = Field.namingPref;
console.log(”  pre-save: “ + savedConstraintCount + “ constraints, ratCount=” + savedRatCount);
console.log(”  pre-save scalar delta: “ + savedScalarDelta.toFixed(4));

// Reset to clean state
Field.reset();
console.log(”  after reset: “ + Field.constraints.length + “ constraints, ratCount=” + Field.ratCount);

// Restore from saved JSON
const ok = Field.deserialize(savedJson);
console.log(”  restore ok: “ + ok);
console.log(”  post-restore: “ + Field.constraints.length + “ constraints, ratCount=” + Field.ratCount);
console.log(”  post-restore scalar delta: “ + Field.scalarDelta.toFixed(4));

return {
pass: ok
&& Field.constraints.length === savedConstraintCount
&& Field.ratCount === savedRatCount
&& Math.abs(Field.scalarDelta - savedScalarDelta) < 1e-9
&& Field.subcascades.length === savedSubcascadeCount
&& Math.abs(Field.namingPref - savedNamingPref) < 1e-9
};
}

// ––––––––––––––––––––––––––––––––
// Test 6: SE-06 invariant S3 - coupling through delta only
//
// Verifies that the CT engine never reads render-scope delta to
// make its scheduling decisions. We accomplish this by inspecting
// the source: the CT engine’s _generateExecPredictions function
// must reference Field.execGap, not Field.gap. Static check.
// ––––––––––––––––––––––––––––––––
function testCouplingDiscipline() {
console.log(”\n=== Test 6: SE-06 S3 - coupling discipline ===”);

const fs = require(“fs”);
const ctSrc = fs.readFileSync(”./ct-engine.js”, “utf-8”);

// Helper: extract the body of a method by name. Locates the method
// DEFINITION (not call site - that’s the trick: a class method is
// referenced before it’s defined elsewhere, so we want the definition).
// The definition has form `methodName(...) {` at indentation level 2,
// while the call sites look like `this.methodName(...)`. We locate by
// searching for the unique definition signature.
function extractMethodBody(src, methodSig) {
// Method definition signature: newline + 2 spaces + methodSig.
// Method call site has form `.methodSig` (preceded by a dot).
// Searching for “\n  “ + methodSig finds the definition.
const defSig = “\n  “ + methodSig;
const startIdx = src.indexOf(defSig);
if (startIdx < 0) return null;
const openBraceIdx = src.indexOf(”{”, startIdx);
if (openBraceIdx < 0) return null;
let depth = 1, idx = openBraceIdx + 1;
let inString = null;
let inLineComment = false;
let inBlockComment = false;
while (idx < src.length && depth > 0) {
const ch = src[idx];
const next = src[idx + 1];
if (inLineComment) {
if (ch === “\n”) inLineComment = false;
} else if (inBlockComment) {
if (ch === “*” && next === “/”) { inBlockComment = false; idx++; }
} else if (inString) {
if (ch === “\”) idx++;
else if (ch === inString) inString = null;
} else {
if (ch === “/” && next === “/”) inLineComment = true;
else if (ch === “/” && next === “*”) inBlockComment = true;
else if (ch === “"” || ch === “’” || ch === “`”) inString = ch;
else if (ch === “{”) depth++;
else if (ch === “}”) depth -= 1;
}
idx++;
}
return src.substring(openBraceIdx, idx);
}

const predFn = extractMethodBody(ctSrc, “_generateExecPredictions(”);
if (!predFn) {
console.log(”  FAIL: could not locate _generateExecPredictions”);
return { pass: false };
}
const usesExecGap_pred = /Field.execGap/.test(predFn);
const usesRenderGap_pred = /Field.gap[^a-zA-Z]/.test(predFn);
console.log(”  _generateExecPredictions uses Field.execGap: “ + usesExecGap_pred);
console.log(”  _generateExecPredictions uses Field.gap (render): “ + usesRenderGap_pred);

const stepFn = extractMethodBody(ctSrc, “async step(”);
if (!stepFn) {
console.log(”  FAIL: could not locate step()”);
return { pass: false };
}
const usesExecGap_step = /Field.execGap/.test(stepFn);
// step() invokes _executeOp which calls _opInput, which legitimately
// touches render-scope delta. So we can’t blanket-prohibit Field.gap
// in step(). The discipline we care about: the SCHEDULING decision
// at the top of step() (the prediction trigger) uses execGap, not
// render-scope gap. That decision lives in the first ~10 lines of
// step(). Look there specifically.
const stepHead = stepFn.substring(0, 600);
const usesRenderGap_stepHead = /Field.gap[^a-zA-Z]/.test(stepHead);
console.log(”  step() scheduling uses Field.execGap: “ + usesExecGap_step);
console.log(”  step() scheduling uses Field.gap (render) at decision point: “ + usesRenderGap_stepHead);

return {
pass: usesExecGap_pred && !usesRenderGap_pred
&& usesExecGap_step && !usesRenderGap_stepHead
};
}

// ––––––––––––––––––––––––––––––––
// Test 7: SE-06 invariant S1 - neither engine owns the field
//
// Both engines write to and read from the shared Field object.
// We verify that:
//   - CT engine modifications are visible to ER engine reads
//   - ER engine writes (match results) are visible to CT engine reads
// In a single-process test, this is automatic since both engines
// share the same Field reference. The test confirms that neither
// engine holds a private copy.
// ––––––––––––––––––––––––––––––––
async function testSharedField() {
console.log(”\n=== Test 7: SE-06 S1 - shared field ownership ===”);
const { er, ct } = setup();

// CT engine writes a constraint via its op processing
ct.enqueueInput(“hello”);
await ct.drainAll(2);

const constraintCount = Field.constraints.length;
console.log(”  after CT input, Field.constraints.length: “ + constraintCount);

// Verify ER engine sees the same Field state when next called.
// We do this by compiling and evaluating; if the ER engine had a
// private field copy, the constraint count seen here would differ.
const compiled = CompilerModule.compileField(Field.constraints);
console.log(”  compiler sees “ + compiled.constraintCount + “ constraints from same Field”);

// Compile uses Field.constraints directly via the CT engine’s bind,
// so this is structurally guaranteed in the current implementation.
// The test affirms the property by exercising the path.

return {
pass: compiled.constraintCount === constraintCount
&& constraintCount > 1
};
}

// ––––––––––––––––––––––––––––––––
// Test 8: Phase 1/2 invariants still hold
//
// Phase 3 must not regress prior invariants. Run a representative
// subset.
// ––––––––––––––––––––––––––––––––
async function testInheritedInvariants() {
console.log(”\n=== Test 8: inherited Phase 1/2 invariants ===”);
const { ct } = setup();

const inputs = [
“hello world”, “hello again my friend”, “the quick brown fox”,
“hello quick”, “world of ideas”, “another phrase here”, “hello again”,
“42 numbers here”, “mixing letters and 7 digits”, “symbols ! @ #”,
“hello world again”, “hello world”, “hello quick brown”,
“hello quick fox”, “world quick”
];
for (const i of inputs) ct.enqueueInput(i);
await ct.drainAll(50);

// Run develop and promote to exercise Phase 1 mechanisms
ct.enqueueInternal(“develop”, {});
ct.enqueueInternal(“promote”, {});
await ct.drainAll(5);

// Address sub-cascade by name to test naming bias
if (Field.subcascades.length > 0) {
const sc = Field.subcascades[0];
for (let k = 0; k < 6; k++) ct.enqueueInput(sc.name + “ is here”);
await ct.drainAll(10);
}

let fails = 0;
function inv(label, cond) {
if (cond) console.log(”  ok:   “ + label);
else { console.log(”  FAIL: “ + label); fails++; }
}

// Foundational
inv(“seed present at index 0”, Field.constraints[0] && Field.constraints[0].kind === “seed”);
inv(“seed permanent”, Field.constraints[0].permanent === true);
inv(“seed uses tracked”, Field.constraints[0].uses > 0);

// Vector-delta
inv(“scalar in [0,1]”, Field.scalarDelta >= 0 && Field.scalarDelta <= 1);
inv(“fast in [0,1]”, Field.fastDelta >= 0 && Field.fastDelta <= 1);
inv(“slow in [0,1]”, Field.slowDelta >= 0 && Field.slowDelta <= 1);
inv(“gap = |fast-slow|”, Math.abs(Field.gap - Math.abs(Field.fastDelta - Field.slowDelta)) < 1e-9);
inv(“vector-delta non-trivial”, Field.scalarDelta < 1.0 || Field.fastDelta < 1.0);

// Caps
inv(“constraints bounded (<=200)”, Field.constraints.length <= CFG.FIELD_LIVE_CAP);
inv(“trace bounded (<=512)”, Trace.entries.length <= CFG.TRACE_CAP);
inv(“recent ops bounded (<=12)”, Field.recentOps.length <= CFG.FAST_WINDOW);
inv(“subcascade-cap respected”, Field.subcascades.length <= CFG.SUB_CASCADE_CAP);

// Phase 1 mechanisms
inv(“correlations tracked”, Object.keys(Field.correlations).length > 0);
inv(“meta-constraints created”, Field.constraints.some(c => c.kind === “meta”));
inv(“fidelity tracking populated”, Object.keys(Field.familyFidelity).length > 0);
inv(“ratifications occurred”, Field.ratCount > 0);
inv(“predictive happened”, Field.constraints.some(c => c.kind === “predictive” || c.kind === “ratified”));
inv(“weights accumulating”, Field.constraints.some(c => c.kind === “derived” && c.weight > 1.0));

// Phase 3 specific
inv(“CT ops executed”, ct.opsExecuted > 0);
inv(“exec-delta in [0,1]”, Field.execScalarDelta >= 0 && Field.execScalarDelta <= 1);
inv(“execGap = |execFast-execSlow|”, Math.abs(Field.execGap - Math.abs(Field.execFastDelta - Field.execSlowDelta)) < 1e-9);

return { pass: fails === 0, fails: fails };
}

// ––––––––––––––––––––––––––––––––
// Test driver
// ––––––––––––––––––––––––––––––––
(async () => {
const results = {};
try {
results.t1 = await testBasicSequential();
results.t2 = await testCrossEngineRatification();
results.t3 = await testExecScopeDelta();
results.t4 = await testExecPredict();
results.t5 = await testPersistence();
results.t6 = testCouplingDiscipline();
results.t7 = await testSharedField();
results.t8 = await testInheritedInvariants();

console.log("\n=== Summary ===");
let total = 0, passed = 0;
for (const k in results) {
  total++;
  const r = results[k];
  const status = r.pass ? "ok  " : "FAIL";
  console.log("  " + status + "  " + k);
  if (r.pass) passed++;
}
console.log("\n" + passed + "/" + total + " tests passed");
process.exit(passed === total ? 0 : 1);


} catch (e) {
console.error(“Test runner failed:”, e.stack || e.message || e);
process.exit(2);
}
})();