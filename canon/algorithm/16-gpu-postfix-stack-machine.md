# 16 - GPU Postfix Stack Machine + SDF CSG

**Status:** IMPLEMENTED. Three independent resolvers (CSS oracle, JS
stack machine, WGSL compute shader) verified byte-identical across
the full grammar the compiler accepts. Status change is justified
by the empirical record in section "Empirical record" below, on the
structural argument in section "Why the encodings agree."

**Primary origin:** `Encoding_Computation_as_Geometry_for_GPU-Parallel_Resolution.md`
**Secondary origin:** `Development_Roadmap` scaling table,
`constraints.md` section 5 (canonical string tables)
**Implementation:** `exodus/canonical-implementation/` (the GPU bridge
harness, the JS oracle, the CSS oracle, the compiler, the shared
constraints spec)
**Test record:** `exodus/canonical-implementation/test-oracle.js`
(Node-side CSS=JS, 11 rules), `exodus/canonical-implementation/tests/
equivalence.test.js` (Phase A: CSS=JS across the grammar),
`exodus/canonical-implementation/tests/gpu-equivalence.html` (Phase B:
CSS=JS=GPU across the grammar)

---

## Narrow-claim scope

A WebGPU compute shader that resolves the same constraint geometry
as the CSS cascade, reading a postfix-encoded instruction buffer
and writing per-coordinate output records. Byte-identical output
across all three substrates is the correctness contract.

This is the **vertical scaling proof** for the architecture: the GPU
path produces bit-identical output over the full state space across
every program the grammar accepts, so the constraint geometry is the
primary artifact and the execution substrate is interchangeable.

## Specification

### Input buffers (read-only storage)

```
struct Constants {
  state_space_size:  u32, # 2880 for the loan domain
  instruction_count: u32,
  dim_count:         u32, # 6
  _pad:              u32,
  dim_cards:         array<vec4<u32>, 2>, # cardinalities, up to 8 dims
}

instructions: array<u32>
  # Postfix-encoded constraint program.
  # Each u32: [opcode:8, operand_a:8, operand_b:8, reserved:8]
```

### Output buffer (read-write storage)

```
struct Output {
  sdf:  i32, # -1 or 1
  rth:  u32,
  rt:   u32, # index into rt_table
  doc:  u32, # index into doc_table
  reg:  u32, # index into reg_table
  deny: u32, # index into deny_table
}

outputs: array<Output> # one per coordinate
```

Note: field order in `Output` is the WGSL layout
(`sdf, rth, rt, doc, reg, deny`). The byte-identical comparison is
defined on this layout.

### Instruction set

Small, closed opcode set that the constraint compiler targets:

```
OP_MATCH_DIM  0x01 a=dim_index b=value_index
  # Push 1 if coord[a] == b else 0

OP_AND        0x02
  # Pop two, push (top & next)

OP_BEGIN_THEN 0x10
  # Marks start of then-block. Pops condition; if 0, skips to next
  # OP_END_RULE; if 1, continues.

OP_SET_SDF    0x11 a={0,1}      # 0 for -1, 1 for +1
OP_SET_RT     0x12 a=rt_index
OP_SET_RTH    0x13 a=rth_value  # 0..255, raw byte
OP_SET_DOC    0x14 a=doc_index
OP_SET_REG    0x15 a=reg_index
OP_SET_DENY   0x16 a=deny_index

OP_END_RULE   0xFF              # end of one constraint; return to default path
```

Ten opcodes. Closed.

### Shader structure

```wgsl
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let coord_index = gid.x;
  if (coord_index >= constants.state_space_size) { return; }

  # Decode coord from coord_index using dim_table cardinalities
  let coord = unpack_coord(coord_index);

  # Initialize output to defaults
  var sdf: i32 = -1;
  var rt: u32 = 0u; var rth: u32 = 0u; var doc: u32 = 0u;
  var reg: u32 = 0u; var deny: u32 = 0u;

  # Stack for condition evaluation; compile-time bound
  var stack: array<u32, 8>;
  var sp: u32 = 0u;
  var skipping: bool = false;

  var pc: u32 = 0u;
  loop {
    if (pc >= constants.instruction_count) { break; }
    let inst = instructions[pc];
    let op = inst & 0xFFu;
    let a  = (inst >> 8u)  & 0xFFu;
    let b  = (inst >> 16u) & 0xFFu;

    if (skipping) {
      if (op == 0xFFu) { skipping = false; } # END_RULE
      pc = pc + 1u; continue;
    }

    switch (op) {
      case 0x01u: { # MATCH_DIM
        let v = coord[a];
        stack[sp] = select(0u, 1u, v == b);
        sp = sp + 1u;
      }
      case 0x02u: { # AND
        stack[sp - 2u] = stack[sp - 2u] & stack[sp - 1u];
        sp = sp - 1u;
      }
      case 0x10u: { # BEGIN_THEN
        sp = sp - 1u;
        if (stack[sp] == 0u) { skipping = true; }
      }
      case 0x11u: { sdf  = select(-1, 1, a == 1u); }
      case 0x12u: { rt   = a; }
      case 0x13u: { rth  = a; }
      case 0x14u: { doc  = a; }
      case 0x15u: { reg  = a; }
      case 0x16u: { deny = a; }
      case 0xFFu: { } # END_RULE: nothing to do when not skipping
      default:    { } # caught by harness via output-shape divergence
    }
    pc = pc + 1u;
  }

  # Post-pass derivation: sdf=1 implies reg=DENIED, rth=0
  if (sdf == 1) { reg = 1u; rth = 0u; }

  outputs[coord_index] = Output(sdf, rth, rt, doc, reg, deny);
}
```

The above is the reference shape; `resolve.wgsl` is the canonical text.

### Dispatch

```
workgroup_count = ceil(state_space_size / 64)
                = ceil(2880 / 64) = 45
```

One compute pass covers the full space.

## The constraint algebra

Resolution is defined as a function over five named objects. Every
piece of the structural argument that follows is grounded in this
definition.

**The coordinate space.** A finite discrete product
`D = D_0 x D_1 x ... x D_{n-1}`, where each `D_i` is an ordered set
of `c_i` named values. For the deployed loan domain, `n = 6` and the
cardinalities are `[3, 4, 4, 3, 4, 5]`, giving `|D| = 2880`. A
coordinate is a tuple `x = (x_0, ..., x_{n-1})` with `0 <= x_i < c_i`.

**The predicate language.** Predicates are conjunctions of dim-value
equalities: `phi(x) = AND_{i in K} (x_i = v_i)` where `K` is a
subset of dim indices and each `v_i` is a value in `D_i`. The arity
`|K|` is bounded by the stack depth (currently 8, exercised up to 3).
Negation, disjunction, range comparisons, and cross-dim comparisons
are not in the language as it stands; their absence is documented
under closure boundaries below.

**The output record.** A fixed-shape tuple
`R = (sdf, rt, rth, doc, reg, deny)` over the field types declared
in the `Output` struct above. Each field has a designated default
value, drawn from `DEFAULTS` in the shared spec.

**The rule set.** An ordered finite list of pairs
`(phi_k, theta_k)` where `phi_k` is a predicate and `theta_k` is a
partial assignment to `R` (some subset of the six fields). The
ordering is *specificity-first, source-order tiebreak*: rules with
fewer predicate clauses appear before rules with more clauses; ties
between rules of equal arity are broken by their position in the
source. The compiler enforces this ordering at compile time via a
stable sort.

**The resolution function.** For a coordinate `x`:

  `resolve(x) = post(apply(rules, init, x))`

where `init` is the all-defaults record, `apply(rules, r, x)` is a
left fold over the ordered rule list updating `r` with `theta_k`
whenever `phi_k(x)` holds, and `post` applies the single derivation
`sdf == 1 -> (reg := DENIED_idx, rth := 0)`.

This is the entire algebra. Everything else is encoding.

## Why the encodings agree

The CSS oracle, the JS stack machine, and the WGSL compute shader
are three syntactically different programs that compute `resolve`.
Their byte-identical output is not an empirical accident; it is a
consequence of how each is constructed.

**The CSS oracle** implements `resolve` directly. It sorts the rules
by `|when|` ascending with source-order tiebreak, then for each
coordinate iterates over the sorted list, applies `theta_k` whenever
`phi_k(x)` holds, and runs the post-pass derivation. This is the
reference implementation: it defines what `resolve` is.

**The JS stack machine** executes a compiled bytecode. The compiler
maps each rule to a postfix sequence:

  `MATCH_DIM_{i_1,v_1} ... MATCH_DIM_{i_k,v_k} AND...AND BEGIN_THEN <SET_* sequence> END_RULE`

The `MATCH_DIM` opcodes push one boolean per predicate clause;
`k-1` ANDs reduce them to a single conjunction; `BEGIN_THEN` pops
that conjunction and either runs the `SET_*` writes that follow or
skips to `END_RULE`. The compiler emits rules in the same
specificity-first order as the CSS oracle's sort. The result is a
flat instruction stream whose execution is one left fold over the
ordered rules, structurally identical to `resolve`. The post-pass
derivation runs after the loop.

**The WGSL compute shader** consumes the *same* compiled bytecode.
It implements the same opcodes with the same stack discipline. The
only structural difference is dispatch: rather than iterating over
coordinates sequentially, each GPU invocation handles one
coordinate, walking the same instruction buffer once. The
instruction buffer is read-only storage; the output buffer holds
one `Output` record per coordinate; there is no inter-thread
communication and no shared mutable state. The per-coordinate
computation is byte-identical to the JS stack machine because the
opcode handlers are byte-identical.

**Why postfix is forced, not chosen.** Three constraints force this
shape. (a) WGSL has no recursion: any encoding must be a flat
loop with bounded state. (b) The shader cannot allocate per-thread
heap; the condition stack must be a fixed-size array. (c) The
instruction buffer is read-only storage shared across all
invocations; the encoding must be position-independent so any
invocation can execute any rule. Postfix with a small bounded
stack is the canonical form that satisfies all three. Infix or
prefix encodings require either an operator-precedence parser
(precluded by no-recursion) or a more complex stack discipline
(precluded by the per-thread state limit). The form is structural.

**Equivalence by construction.** Given:
  - the CSS oracle implements `resolve` directly,
  - the compiler emits a bytecode whose execution is one fold over
    the rules in the same order,
  - the JS stack machine and WGSL compute shader execute that
    bytecode with identical opcode semantics,
the three substrates compute the same function. Byte-identity is a
consequence of the construction, not a property to test for.

The test record below empirically confirms this consequence over a
shape-exhaustive sample of programs the grammar can produce. The
construction argument is what makes the consequence general; the
tests are what verify the construction has no hidden assumptions.

## Rule ordering

The CSS cascade orders rules by specificity (more `[data-x]` = higher
specificity wins). The compiler sorts the rule list by `|when|`
ascending with source-order tiebreak; the resulting linear
instruction stream's evaluation order equals CSS specificity order.
The resolvers do not implement specificity at runtime; they rely on
the compile-time sort. This is a load-bearing assumption for the
equivalence claim and is exhaustively tested under the
"overwrite-pair" suite of the equivalence harness, where every
output field is verified to be correctly overwritten by a higher-
specificity rule.

## Closure boundaries

The equivalence-by-construction argument depends on closure
properties of the current grammar. Each property is named here
together with the consequence of relaxing it; this is the surface
along which the architecture can be extended.

**Predicate closure.** The predicate language is conjunctive
equality only. Adding disjunction (OR) requires either preprocessing
into disjunctive normal form (a structural rewrite, not an opcode
addition) or new opcodes that compose with the existing stack
discipline. Adding negation (NOT) is a single-opcode extension if
the stack uses signed booleans; otherwise requires careful semantics.
Either extension changes what predicates the encoding represents but
does not require a different machine shape; the postfix form remains
forced. The equivalence claim must be re-verified at the extended
grammar.

*Empirical fill-in (NOT extension, single-dim).* The single-dim NOT
extension was implemented as one new opcode (`OP_NOT`, unary, pops
and pushes the boolean negation) and verified against a CSS-correct
reference oracle across the grammar's shape space. Test artifact:
[tests/extensions/not-1/not1-equivalence.test.js](../../exodus/canonical-implementation/tests/extensions/not-1/not1-equivalence.test.js).
Result: 2,734 generated rule sets with mixed positive/negated clauses,
byte-identical across the extended toolchain. The structural argument
held: one opcode, no change to the machine shape.

*Empirical fill-in (compound NOT boundary).* A second test located
the syntactic boundary at compound negation -- `NOT (A AND B)` over
two distinct dims, which the cascade resolves as a single region but
the current grammar cannot phrase as a single clause. Test artifact:
[tests/extensions/not-1/not2-boundary.test.js](../../exodus/canonical-implementation/tests/extensions/not-1/not2-boundary.test.js).
Result: the cascade-correct region for `NOT (A AND B)` over
(credit=prime, product=mortgage) is 2,640 coords; componentwise
negation `(NOT A) AND (NOT B)` reaches only 1,440 coords (a strict
subset); DNF expansion via two separate rules reaches the full 2,640
coords (byte-equivalent to the reference). The grammar cannot address
compound NOT as one clause -- the compiler throws -- but DNF
expansion via multiple rules reaches the same resolved region. The
boundary is syntactic (which regions can be named in one clause),
not semantic (which regions can be read). The cascade's resolved
field already contains every region the propositional algebra can
express; the postfix grammar is a read protocol that can read all
of them, possibly at the cost of multiple rules.

**Arity closure.** The stack depth bound is currently 8; the
deployed grammar exercises depths up to 3. Predicates of arity `k`
require stack depth `k`. Extension beyond 8 is a buffer-size change,
not a structural change. The encoding shape does not change.

**Output closure.** Output fields are `u8`-indexed or `i32`-typed.
The instruction word reserves 8 bits for each operand. Output values
exceeding `u8` require either a wider instruction word or operand
extension via multiple opcodes; in either case the encoding changes
but the machine shape remains a postfix instruction walk.

**Independence closure.** Each coordinate's resolution is
independent of every other coordinate's. The shader's embarrassingly-
parallel dispatch depends on this. Introducing cross-coordinate
predicates would change the resolution model from one-pass to
fixed-point iteration; substrate-independence would need to be
re-established under the iterated model. This is the deepest
boundary; crossing it is a different algorithm.

*Empirical fill-in (reduction incompleteness).* The independence
property has a consequence beyond what the prediction names. Reductions
over the resolved field -- "how many coords have sdf=1," "what is the
maximum rth value across the field," etc. -- are answers the cascade
implicitly holds (every coord is resolved; an external walk produces
the scalar) but the grammar cannot pose. The instruction set is
closed at ten opcodes, all of which read only from the current coord
or the stack and write only to the current coord's Output or the
stack. No opcode reads another coord's Output; no opcode writes to
global state; no opcode is a reduction primitive. Test artifact:
[tests/extensions/reduction-4a/reduction-4a.test.js](../../exodus/canonical-implementation/tests/extensions/reduction-4a/reduction-4a.test.js).
The test confirms (a) the cascade-correct denied-coord count for the
canonical 11-rule program is 852 of 2,880, agreed between CSS and JS
oracles by external for-loop; (b) no opcode in the grammar produces
or addresses this scalar; (c) unlike the compound-NOT boundary,
there is no DNF-style workaround inside the grammar -- the per-coord
independence rules out any constellation of rules that could
accumulate a cross-coord value.

This is qualitatively stronger incompleteness than the predicate-closure
case. The compound-NOT boundary was syntactic: certain regions could
not be named in one clause but could be reached by combining multiple
rules whose match regions union to the target. Reductions cannot be
reached by any combination of rules within the current grammar; the
answer can only be assembled by an agent outside the read protocol
walking the resolved field. The byte-identical equivalence claim
covers field RESOLUTION (three substrates produce the same field);
it is silent about field CONSUMPTION (any external consumer of the
resolved output -- DOM queries, accumulators, layout engines --
operates outside what the byte-identical claim covers). This
delineation is a precise structural statement about what the read
protocol does and what lives outside it.

*Empirical fill-in (cross-coordinate predicates, three sub-cases).*
The prediction that cross-coord predicates change the machine shape
was tested at three depths of dependence, with progressively stronger
falsification of the byte-identical claim.

The **stratified** case (a single named foreign coord read; acyclic
dependence graph) requires the compiler to compute a topological
sort and the shader to dispatch in K passes where K is the longest
dependence chain plus one. Test artifact:
[tests/extensions/dependence-4b/stratified.test.js](../../exodus/canonical-implementation/tests/extensions/dependence-4b/stratified.test.js).
The test confirms (a) the cascade-correct two-pass answer is
constructible by an external resolver; (b) no opcode addresses a
foreign coord, and no key in the rule shape resolves to a cross-coord
read; (c) the 8-bit operand cannot carry a 12-bit coord index for the
deployed state space; (d) the shader has no inter-invocation barriers,
so single-pass dispatch cannot safely support cross-coord reads. The
byte-identical claim must be re-derived under the K-pass model; the
three substrates' default dispatch behavior does not extend to it.

The **mutual** case (two coords whose resolutions depend on each
other; cyclic dependence graph) admits no topological sort. The
system has multiple fixed points reachable from different initial
states, and asymmetric initial states oscillate indefinitely under
synchronous update. Test artifact:
[tests/extensions/dependence-4b/mutual.test.js](../../exodus/canonical-implementation/tests/extensions/dependence-4b/mutual.test.js).
The test enumerates the two fixed points of `sdf(A) iff sdf(B)` =>
`sdf(B) iff sdf(A)`: `(-1, -1)` and `(+1, +1)`, both self-consistent;
asymmetric inits `(-1, +1)` and `(+1, -1)` oscillate. The three
substrates' default behaviors diverge on this structure: CSS and JS
single-pass dispatch commits one snapshot based on rule order; GPU
parallel dispatch reaches only the default-attractor `(-1, -1)`
because all invocations read the zero-initialized output state. The
byte-identical claim fails by inspection; restoring it requires four
new architectural commitments -- iteration to fixed point, explicit
initial conditions, a convergence criterion, and an oscillation
policy -- each of which is a semantic decision, not a technical
detail. The prediction "crossing it is a different algorithm" is
precise: the new algorithm is a fixed-point iterator whose semantics
include initial conditions and convergence, not a postfix-stack
machine.

The **aggregate** case (a predicate whose truth depends on a
reduction over the resolved field) composes 4a's reduction
incompleteness with 4b's cyclic dependence. Test artifact:
[tests/extensions/dependence-4b/aggregate.test.js](../../exodus/canonical-implementation/tests/extensions/dependence-4b/aggregate.test.js).
The test confirms (a) "deny if any other coord has sdf=1" has two
fixed points (all-undenied and all-denied); default-initialized
parallel dispatch reaches only the trivial fixed point because no
seed exists; (b) "deny if more than half of coords have sdf=1"
exhibits a phase transition at density 0.50/0.51 -- a one-coord
perturbation flips the reachable fixed point. This case is
structurally past where algorithm 16 commits: it requires every
machine-shape change from 4b-mutual plus reduction primitives in
the substrate itself.

The combined cross-coord findings sharpen the prediction: the
single-pass postfix-stack machine is closed over predicates that
read only from the current coord. Any cross-coord dependence --
stratified, mutual, or aggregate -- pushes the resolution model
past where byte-identical equivalence holds by construction.
Substrate-independence becomes contingent on architectural
commitments the current algorithm does not make.

**Determinism closure.** The post-pass derivation
`sdf == 1 -> (reg, rth)` is the only derivation outside the
instruction set. Adding additional derivations requires they be
implemented identically in every substrate. The current single
derivation is implemented byte-identically in the JS oracle
([oracle.mjs:58-61](../../exodus/canonical-implementation/oracle.mjs))
and the WGSL shader
([resolve.wgsl:157-160](../../exodus/canonical-implementation/resolve.wgsl)).
Each new derivation widens the verification surface.

## Empirical record

Three test artifacts establish the byte-identical equivalence claim
at progressively stronger levels.

**Level 0 - canonical program, single substrate pair (Node).**
`test-oracle.js` verifies the CSS oracle against the JS oracle on the
canonical 11-rule loan program across all 2,880 coordinates.
*Result: 66/66 tests, byte-identical.* This is the original
verification that established the equivalence claim for the deployed
program.

**Level 1 - canonical program, all three substrates (browser).**
`harness.mjs` adds the GPU path: CSS oracle vs JS oracle vs WGSL
compute shader on the canonical 11-rule program, all 2,880 coords.
*Result: byte-identical across all three substrates, 22/22 tests in
the GPU bridge directory.* This is the original substrate-
independence demonstration cited by SE-01, SE-02, SE-03, SE-06,
SE-07, SE-08, SE-10, SE-11.

**Level 2 - shape-exhaustive coverage, all three substrates.**
`tests/equivalence.test.js` (Phase A) and
`tests/gpu-equivalence.html` (Phase B) extend Level 1 from one
specific program to every program the compiler accepts within
documented shape bounds:

```
constraint sets verified                  2,602
coords per set                            2,880
output fields per coord                       6
total field-level comparisons      ~45,000,000

(dim, value) MATCH_DIM combinations:    23 / 23
output fields written by some rule:      6 / 6
|when| lengths exercised:               1, 2, 3 (exhaustive)
rule-counts exercised:                  1..16
overwrite pairs per field:               6 / 6
negative tests (compiler rejection):   10 / 10
```

Three suites are exhaustive over their domain:
- `exhaustive-1key`: every `(dim, value)` clause paired with every
  legal `then` clause from a representative catalogue.
- `exhaustive-2key`: every legal 2-key clause paired with both a
  denial and a classification `then`.
- `exhaustive-3key`: every legal 3-key clause with a denial `then`
  (1,105 distinct triples, all 6 dims).

Two suites are sampled with documented coverage:
- `rule-count-scaling`: 24 deterministically-seeded random
  constraint sets at each rule-count from 1 to 16, drawing from the
  union of 1/2/3-key clauses and the full `then` catalogue.
- `overwrite-pairs`: every output field, every distinct value pair,
  exercised under a 1-key-then-2-key composition.

The Node-side Phase A runs in seconds; the browser-side Phase B
runs in approximately 22.5 seconds on a hardware-accelerated GPU
adapter (Edge 148, Windows).

**Verification contract** (preserved from the original spec):
1. All three paths produce exactly `state_space_size` output records.
2. For every coord, all six output fields match across all paths.
3. No CSS output string is missing from the canonical tables in the
   shared spec.
4. Divergence is always a bug. Never "close enough."

The Level 2 record extends the contract from "for the deployed
program" to "for every program the compiler accepts."

## SDF CSG correspondence (continuous extension, research-only)

The binary `sdf` field is a stand-in for a continuous signed-distance
field. On the GPU, CSG composition of SDFs gives boolean logic over
spatial membership:

```
Union (A OR B)         : min(a, b)
Intersection (A AND B) : max(a, b)
Complement (NOT A)     : -a
Subtraction (A AND NOT B): max(a, -b)
```

This is equivalent to boolean logic at the sign level (union's sign
is negative iff either input is; intersection's sign is negative iff
both are). With continuous magnitudes, you also get "how deep inside"
and "how far outside," which binary `sdf` discards.

The current implementation uses `-1/+1`. A continuous-SDF variant
would grade constraint satisfaction rather than classifying it; this
is a research extension, not a requirement, and not part of the
equivalence claim above.

## Pitfalls (operational; from `CLAUDE.md` section 7)

- WGSL has no recursion. Instruction loop must be bounded at
  compile time. The instruction count is a pipeline constant.
- String comparison must go through interning tables. GPU writes
  indices; CSS returns strings. Harness maps one through the
  canonical tables to compare.
- Cascade specificity ordering must be replicated in the emit order
  (the compile-time stable sort).
- `sdf=1 implies reg=DENIED, rth=0` is a derivation, not a stored
  rule. Both byte-resolvers implement it identically as a post-pass.
- ASCII-only source is enforced at runtime by a self-check that
  refuses to boot on violation; preserves byte-identity from source
  ingestion through resolution.

## Dependencies

- WebGPU available in browser (Chrome 113+, Edge 113+, Safari 26+,
  Firefox 141+).
- Hardware-accelerated GPU adapter for the runtime path; software
  adapters work but are dramatically slower.
- Shared constraints spec as source of truth. All paths pin to its
  version; the harness aborts on a version mismatch.

## Wide-claim scope

The narrow fact this algorithm establishes is precisely: **the same
constraint geometry that resolves via the CSS cascade also resolves
via a JavaScript stack machine and a WGSL compute shader; the three
substrates produce byte-identical output across every program the
compiler accepts.** This is the substrate-independence property
cited by SE-01, SE-02, SE-03, SE-06, SE-07, SE-08, SE-10, and SE-11.

Wider framings - "computation is geometric," "the cascade is the
runtime" - are made elsewhere in the manuscript and rest on this
algorithm as their existence proof, not the other way around. This
algorithm establishes that the property holds; what the property
*means* for the architecture is the work of the spec extensions.

## Related algorithms in this catalog

- `04-constraint-compilation.md` - the CSS path this parallels
- `06-parallel-probe-array.md` - the original substrate for full-
  space resolution
- `07-vessel-dom-bfs.md` - what the 3D texture sampling would
  replace at scale
- `11-vsf-binary-encoding.md` - natural fit for GPU buffers
- `22-delta-trace-coupled-signal.md` - the substrate-coupling
  primitive that observes resolution across substrates
