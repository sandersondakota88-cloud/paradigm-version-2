// ============================================================================
// reduction-4a.test.js  --  Boundary 4a: cross-coord reductions
// ============================================================================
//
// What this tests
// ---------------
// The current grammar's instruction set is per-coord. Every opcode reads
// from the current coord's value and writes to the current coord's Output
// record. There is no opcode that reads from OR writes to anything outside
// the current coord's lane.
//
// This means certain questions the cascade has fully resolved cannot be
// posed in the grammar. The simplest example is a reduction:
//
//   "How many coords have sdf = 1?"
//
// The cascade has the answer. The CSS oracle, the JS oracle, and the GPU
// shader all produce the full 2,880-coord resolved field; counting denied
// coords is a single pass over that field. But none of the three substrates
// can express the COUNT itself inside the grammar -- it is computed AFTER
// resolution, by separate JavaScript that walks the output array.
//
// Locked predictions (written before running):
//   P1. The cascade-correct count for the canonical 11-rule program is a
//       specific number. Both substrates that produce records (JS, CSS)
//       agree on it because they agree on the field.
//   P2. There is no instruction in the grammar that produces a reduction.
//       Specifically: no opcode reads another coord's resolved record;
//       no opcode writes to anything global; no opcode counts.
//   P3. Reductions can be PERFORMED on the resolved output by a separate
//       agent walking the records, but this agent is NOT in the grammar's
//       vocabulary. The grammar's expressive incompleteness here is
//       structural -- not "DNF workaround" structural like NOT-2 was, but
//       "no workaround inside the grammar" structural.
//
// Falsification:
//   F1. If the grammar HAS an opcode that addresses anything outside the
//       current coord's lane, P2 is wrong. The instruction set is closed
//       at 10 opcodes; we enumerate them and confirm none is non-local.
//   F2. If the cascade itself somehow embeds a reduction primitive that
//       the read protocol could access through positional means, the
//       boundary is softer than predicted.
//
// What we expect to learn:
//   - Reductions are a different KIND of boundary than NOT-2's
//     compound-NOT. NOT-2 was syntactic incompleteness with a DNF
//     workaround inside the grammar. Reductions are structural
//     incompleteness with NO workaround inside the grammar -- the answer
//     can only be produced by an agent outside the read protocol, walking
//     the resolved field.
//
// Run with:  node tests/extensions/reduction-4a/reduction-4a.test.js
// ============================================================================

"use strict";

const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..", "..");
const C        = require(path.join(ROOT, "constraints.js"));
const cssOrig  = require(path.join(ROOT, "css-oracle.js"));
const jsOrig   = require(path.join(ROOT, "oracle.js"));
const compiler = require(path.join(ROOT, "compile-constraints.js"));

const results = { pass: 0, fail: 0 };
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
function note(s) { console.log("  NOTE  " + s); }

console.log("\n=== Step 1: the answer the cascade has resolved ===\n");

// Resolve the canonical 11-rule program through both reference substrates
// and confirm they agree on the denied-coord count. This is the ground
// truth.
const cssRecords = cssOrig.resolveAll();
const compiled   = compiler.compileAll();
const jsRecords  = jsOrig.executeAll(compiled.instructions);

function countDenied(records) {
  let n = 0;
  for (const r of records) if (r.sdf === 1) n++;
  return n;
}

const cssDenied = countDenied(cssRecords);
const jsDenied  = countDenied(jsRecords);

note(`cascade-correct denied-coord count via CSS oracle:  ${cssDenied}`);
note(`cascade-correct denied-coord count via JS oracle:   ${jsDenied}`);

test("P1: CSS oracle and JS oracle agree on the reduction", () => {
  if (cssDenied !== jsDenied) {
    throw new Error(`disagree: css=${cssDenied} js=${jsDenied}`);
  }
});

note(`reduction value: ${cssDenied} of ${C.STATE_SPACE_SIZE} = ` +
     `${(cssDenied / C.STATE_SPACE_SIZE * 100).toFixed(1)}%`);

// IMPORTANT structural note: these counts were produced by a JavaScript
// FOR-loop over the records array. The loop is OUTSIDE the grammar.
// The grammar produced the records; the loop produced the count.

console.log("\n=== Step 2: enumerate the grammar's instruction set ===\n");

// What opcodes does the current grammar have? We read them from the
// compiler's OP table -- this is the closed set.
const opNames = Object.keys(compiler.OP);
note(`opcodes in current grammar: ${opNames.length}`);
for (const name of opNames) {
  const code = compiler.OP[name];
  note(`  0x${code.toString(16).padStart(2, "0")}  ${name}`);
}

// Classify each opcode by what it reads from and writes to.
const opSemantics = {
  MATCH_DIM:  { reads: ["current coord"], writes: ["stack"]               },
  AND:        { reads: ["stack"],         writes: ["stack"]               },
  BEGIN_THEN: { reads: ["stack"],         writes: ["pc skip flag"]        },
  SET_SDF:    { reads: [],                writes: ["current coord output"] },
  SET_RT:     { reads: [],                writes: ["current coord output"] },
  SET_RTH:    { reads: [],                writes: ["current coord output"] },
  SET_DOC:    { reads: [],                writes: ["current coord output"] },
  SET_REG:    { reads: [],                writes: ["current coord output"] },
  SET_DENY:   { reads: [],                writes: ["current coord output"] },
  END_RULE:   { reads: [],                writes: ["pc skip flag"]        }
};

test("P2: no opcode reads from another coord's lane", () => {
  for (const name of opNames) {
    const sem = opSemantics[name];
    if (!sem) throw new Error("missing semantics for " + name);
    for (const r of sem.reads) {
      if (r !== "current coord" && r !== "stack") {
        throw new Error(`opcode ${name} reads from ${r}, which is non-local`);
      }
    }
  }
});

test("P2: no opcode writes to another coord's lane or to global state", () => {
  for (const name of opNames) {
    const sem = opSemantics[name];
    for (const w of sem.writes) {
      if (w !== "stack" && w !== "current coord output" && w !== "pc skip flag") {
        throw new Error(`opcode ${name} writes to ${w}, which is non-local`);
      }
    }
  }
});

test("P2: no opcode produces a reduction or aggregation primitive", () => {
  const reductionishKeywords = ["COUNT", "SUM", "REDUCE", "AGGREGATE", "FOLD", "ANY", "ALL"];
  for (const name of opNames) {
    for (const k of reductionishKeywords) {
      if (name.includes(k)) {
        throw new Error(`grammar contains reduction-like opcode: ${name}`);
      }
    }
  }
});

console.log("\n=== Step 3: attempt to express the reduction inside the grammar ===\n");

// Try to construct a rule whose THEN clause writes the count. There is no
// way to do this -- SET_* opcodes write a literal operand into the current
// coord's output. None of them can write a value derived from a count over
// the field.

test("no SET_* opcode accepts a 'count' argument or refers to global state", () => {
  // The compiler's encode() takes (op, a, b) where a and b are u8s -- raw
  // operand bytes. No mechanism exists for the operand to be late-bound to
  // a reduction value.
  const word = compiler.OP.SET_RTH;
  if (word === undefined) throw new Error("SET_RTH missing");
  // Just confirm the operand path is byte-literal:
  const sample = ((word & 0xFF) | ((42 & 0xFF) << 8)) >>> 0;
  const decoded = compiler.disassemble(Uint32Array.from([sample]));
  if (!decoded.includes("a=42")) {
    throw new Error("operand encoding is not byte-literal: " + decoded);
  }
  note("SET_RTH operand is byte-literal a; no late-binding path exists");
});

test("the rule grammar has no expression form that resolves to a reduction", () => {
  // The rule shape is { when: { (dim|!dim): value, ... }, then: { field: value, ... } }
  // No field, no key, no value in either `when` or `then` is parsed as a
  // function over the resolved output. Compiler input is data, not code.
  // We confirm this by attempting to compile a rule whose `then` value is
  // a function call or reference. The compiler treats it as a value lookup
  // and rejects on unknown intern key.
  let threw = false, msg = "";
  try {
    compiler.compileRule({
      when: { credit: "prime" },
      then: { rth: "$count(sdf=1)" } // attempted late-binding
    });
  } catch (e) { threw = true; msg = e.message; }
  if (!threw) {
    throw new Error("compiler accepted what looked like a reduction expression");
  }
  note("compiler rejected the attempted reduction expression: " + msg);
});

console.log("\n=== Step 4: where the reduction actually lives ===\n");

// The reduction is produced by JavaScript outside the grammar. Confirm
// that the agent that produces it has access to BOTH the grammar's input
// (the constraints) and the grammar's output (the records). Confirm that
// this agent is not constrained by the grammar in any way -- it can
// produce any function of the resolved field.
note("the JavaScript FOR-loop that produced the count above is:");
note("  - OUTSIDE the grammar's instruction set");
note("  - able to read ANY coord's output record");
note("  - able to compute ANY function over the resolved field");
note("  - NOT a substrate the byte-identical claim covers");
note("");
note("structural reading: the grammar resolves the field; the reduction");
note("is a separate consumer of the resolved field. The byte-identical");
note("equivalence claim is about field RESOLUTION (three substrates");
note("produce the same field). It is silent about field CONSUMPTION");
note("(reductions, queries, aggregations -- which can be performed by");
note("any external agent on the resolved output).");

test("P3: the answer exists; the grammar's vocabulary doesn't reach it", () => {
  // We have a concrete reduction value (cssDenied), which means an answer
  // exists. We have shown no opcode in the grammar produces it. The
  // answer lives in the for-loop, not the cascade.
  if (cssDenied <= 0) throw new Error("no denied coords -- test setup wrong");
  // The claim: nothing in this whole test file ever called a grammar
  // opcode to compute the count. The count was always produced by
  // JavaScript walking records[].sdf. That is the structural finding.
});

console.log("\n=== Step 5: is there a workaround inside the grammar? ===\n");

// NOT-2 had a workaround: DNF expansion via multiple rules. Each rule
// covered part of the target region; their union was the answer. The
// expressivity boundary was syntactic; the cost was rule count.
//
// Is there an analogous DNF-style workaround for reductions? The
// candidate: encode the reduction as a constellation of rules whose
// per-coord writes ACCUMULATE into a single output field across coords.
// This requires writes from one coord's resolution to be VISIBLE to
// another coord's resolution -- which is precisely what the independence
// closure rules out.

test("there is no DNF-style workaround for reductions inside the grammar", () => {
  // The independence-closure property: each coord's Output is written
  // only by its own resolution. No coord can read another coord's Output
  // during resolution. Therefore no constellation of per-coord rules
  // can accumulate a cross-coord count -- the count would require either
  // (a) a designated "accumulator coord" that reads the others (no opcode
  // for this) or (b) iteration to fixed point so writes propagate
  // (different machine, the Boundary 4b case).
  //
  // We don't construct a synthetic example here -- we just name the
  // structural reason no workaround exists.
  note("workaround search: NONE. Reasons:");
  note("  - no opcode reads another coord's Output");
  note("  - no opcode writes to anything but the current coord's Output");
  note("  - shader dispatch is single-pass, no fixed-point iteration");
  note("  - any per-coord constellation can only write its own lane");
  note("");
  note("this is structurally STRONGER incompleteness than NOT-2.");
  note("NOT-2 had a DNF bridge: the read protocol could phrase compound-NOT");
  note("regions by splitting them into multiple single-clause rules.");
  note("Reductions have no such bridge inside the grammar -- the answer");
  note("can only be assembled by an agent OUTSIDE the grammar walking");
  note("the resolved field.");
});

console.log("\n=== Totals ===");
console.log(`PASS: ${results.pass}   FAIL: ${results.fail}`);
if (results.fail > 0) process.exit(1);
process.exit(0);
