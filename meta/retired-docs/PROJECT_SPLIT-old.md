# PROJECT_SPLIT.md

How the project divides into two cooperating halves, and how they
stay coherent through delta rather than through protocol.

**Status:** Design commit. Written after SE-06. The split is
architectural and reflects the structural duality the spec stack
has been implicitly describing. It is not a convenience or
optimization; it is the shape the architecture takes when
instantiated at full scale.

-----

## 0. Summary

The project splits into two halves that operate under one runtime:

- **Experiential Reality engine** (rendering substrate)
- **Critical Thought engine** (execution substrate)

Each is a separate codebase with its own build, tests, and
performance profile. Neither drives the other. Both operate on the
same field. Delta lives at the coupling as their shared read,
measured from each position, semantically different at each
position, numerically produced by the same formula.

The two engines plus the field plus the delta-coupling together
constitute one runtime. The runtime is not a host program that
launches both engines. The runtime IS the two engines running on
the shared field with delta as the coordinating quantity.

-----

## 1. What splits and what does not

### What splits

**Codebases.** Experiential Reality engine is its own repository,
its own build, its own tests. Critical Thought engine likewise.
Each can be developed, reviewed, and deployed independently.

**Performance profiles.** Experiential Reality engine is optimized
for parallel throughput: per-frame resolution of large constraint
sets, SIMD or GPU utilization, low-latency field-state updates.
Critical Thought engine is optimized for sequential correctness:
transaction integrity, persistent state management, deterministic
ordering, I/O coordination.

**Primary substrate bindings.** Experiential Reality binds to
WebGPU, WebGL, CSS cascade, compute shaders, or similar parallel-
native substrates. Critical Thought binds to JavaScript main
thread, server-side runtime, database, or similar sequential-
native substrates.

**Test suites.** Each engine has its own test suite that verifies
its own delta readings, its own modulation behavior, and its
interaction with the field at its own scope. Cross-engine tests
exist (see section 5) but are a third category, not part of
either engine’s native suite.

**Development velocity.** The two engines can progress at
different rates. Experiential Reality might be stable while
Critical Thought is being extended, or vice versa. As long as the
field interface remains compatible, either can iterate without
blocking the other.

### What does not split

**The specification.** SE-01 through SE-06 apply to both engines.
The algorithm catalog is shared. DEFINITION.md is canonical for
both.

**The field.** There is one field. Both engines operate on it.
Whatever substrate hosts the field in a given implementation
(textures, buffers, database, persistent objects), it is a single
shared object, not two copies.

**Delta.** The formula is the same. The readings differ by
scope, but there is one delta, reflexively determined. A split
into two deltas would violate SE-01’s scale-free property and is
not permitted.

**The seed.** One seed, read by both engines at their respective
scopes. The seed’s unresolvability is the single structural tension
both engines inherit.

-----

## 2. Experiential Reality engine (rendering substrate)

### What it does

It resolves the field in parallel, per frame. Every frame is a
full pass: constraints evaluated against the current field state,
modulation updated, vector-delta computed at render scope,
predictive constraints generated when the render-scope gap
exceeds threshold, outputs written to field state accessible in
the next frame.

The engine is natively parallel. Constraints do not run
sequentially. A single frame evaluates many constraints
simultaneously, produces an integrated output, and commits that
output to field state in one pass.

### What it is good at

- Evaluating large constraint sets quickly
- Maintaining per-frame coherence of field state
- Running at display-refresh rate (60Hz or higher)
- Handling the parallel, ambient, whole-field-at-once aspect of
  the architecture
- Directly visualizing field state (every resolution pass can be
  a render of the field’s current configuration)

### What it is not good at

- Sequential ordering of operations
- Transaction semantics (commit/rollback of ordered steps)
- I/O coordination (file reads, network requests)
- Persistent state across program lifetimes
- Handling rare events that don’t fit the per-frame model

Operations in these categories are delegated to the Critical
Thought engine. The delegation is not a request. The Critical
Thought engine monitors the field; when it sees field state
requiring its class of work, it acts. No message is sent from
render to execution.

### Implementation specifics

In a browser implementation:

- Primary substrate: WebGPU compute shaders (or WebGL fragment
  shaders as fallback)
- Field state: textures and buffers
- Per-frame cycle: read field state, run compute shader with
  current constraint set, write updated field state, compute
  delta from result, trigger predictive generation if gap
  threshold exceeded
- Constraint compilation: runtime compilation of constraint set
  into shader-executable form, using the instruction-set pattern
  from algorithm 16

In a native implementation:

- Primary substrate: Vulkan, Metal, CUDA, or equivalent
- Field state: GPU-resident buffers
- Per-frame cycle: same shape as browser, with native driver and
  memory management
- Constraint compilation: runtime compilation to native GPU
  instructions, same instruction-set pattern

### Dependencies on Critical Thought

Minimal. The Experiential Reality engine does not call into
Critical Thought. It reads field state. Any field state it
encounters was written by either itself (last frame) or by
Critical Thought (during Critical Thought’s operation). The engine
does not distinguish between the two; field state is field state.

### What living in the rendering pipeline buys the architecture

Parallel resolution at substrate-native performance. Algorithm
06’s probe-array approach finally operates at its intended scale.
The foundational claim’s “parallel traversal” becomes literal
rather than aspirational. Display of the field’s current state is
free - if the field is being resolved in rendering, the resolution
IS a render.

-----

## 3. Critical Thought engine (execution substrate)

### What it does

It handles the sequential, stateful, I/O-aware, transactional work
that cannot or should not run per-frame. It operates on the same
field the Experiential Reality engine operates on, but through
sequential access patterns rather than parallel passes.

Operations include:

- Input intake: receiving inputs from external sources (user
  input, sensor data, network events, file reads)
- Trace committal: writing trace entries from both engines’ activity
  to persistent storage in order, with transaction semantics
- Persistent state management: saving field state across runtime
  restarts, loading state on startup
- Ordered operation coordination: operations that must happen in a
  specific order, with each step completing before the next begins
- I/O: file reads, network requests, database queries, any
  operation that crosses a system boundary and takes unbounded time
- Rare-event handling: events too infrequent to warrant a per-frame
  check, serviced when they occur

The engine is natively sequential. Operations happen in order.
State is maintained across operations. Transactions can be
committed or rolled back as discrete units.

### What it is good at

- Handling one thing carefully at a time
- Maintaining correctness under concurrent access through
  transaction semantics
- Coordinating with external systems that have their own timing
- Persisting state across system lifecycle events
- Running operations that the rendering pipeline cannot (because
  they require blocking I/O, or because they need to complete
  before a response is produced)

### What it is not good at

- Resolving large constraint sets quickly in parallel
- Running at display-refresh rates for work that touches many
  constraints
- Maintaining responsive interactive feel on its own (it is
  paced by operation-boundary, not by frame-boundary)
- Operating on field state without explicit reads (it does not
  see field state continuously, only when it accesses it)

Operations in these categories are handled by the Experiential
Reality engine. The Critical Thought engine does not request them;
it simply does not do them. The field state changes per frame in
ways the Critical Thought engine can later read, if it needs to.

### Implementation specifics

In a browser implementation:

- Primary substrate: JavaScript main thread (with Web Workers for
  parallelizable sequential work)
- Field state: DOM, IndexedDB, LocalStorage, shared array buffers
- Per-operation cycle: receive input or event, read current field
  state, perform operation, write resulting field state, commit
  to persistent storage if needed, compute delta at execution
  scope, trigger predictive generation if gap threshold exceeded
- Coordination: event loop, with the operation queue as the
  sequential order

In a native implementation:

- Primary substrate: host CPU runtime (Rust, C++, Go, or similar)
- Field state: memory-mapped storage, database, structured files
- Per-operation cycle: same shape, with native threading and
  memory management
- Coordination: event loop or explicit scheduler

### Dependencies on Experiential Reality

Minimal, same as the reverse direction. The Critical Thought
engine does not call into Experiential Reality. It reads field
state. Any field state it encounters was written by either itself
(previous operations) or by Experiential Reality (during recent
frames). It does not distinguish between the two.

### What execution-as-stabilization buys the architecture

Correctness for the work that requires correctness. Persistent
state across runtime lifecycles. Graceful handling of external
systems whose timing cannot be assumed. Transaction integrity for
committed trace and committed field state. A place for the
sequential operations that cannot be parallelized and should not
be shoehorned into a frame-synchronous model.

-----

## 4. The coupling: delta

### Why delta is sufficient

Both engines produce delta as byproduct of operation. Both engines
read delta from their own structural position. The delta values
produced by the two engines are numerically comparable (same
formula) but semantically distinct (different scopes).

The coupling between the two engines is not a protocol. It is not
a channel. It is not an API. It is a shared reading of the same
quantity from two positions. When the readings agree, the engines
are in coherent co-operation. When they diverge, the divergence
is itself the signal that drives the architecture’s native
response: predictive reaching (SE-05).

No component needs to observe both readings for coordination to
work. Each engine observes its own reading and responds to its
own scope’s vector-delta gap. The cross-engine coherence emerges
because both engines are operating on the same field, and the
field’s state is what produces both readings.

### What this rules out

- **No message-passing between engines.** Not queues, not mailboxes,
  not channels. If either engine needs information from the other,
  it reads the field.
- **No explicit synchronization primitives.** No locks, semaphores,
  barriers between the two engines. Synchronization emerges from
  the field’s consistency model (see section 5).
- **No shared scheduler.** Each engine paces itself. Experiential
  Reality runs per-frame. Critical Thought runs per-operation.
  Neither waits for the other.
- **No request/response pattern.** Neither engine sends requests
  that expect replies. Each does its work, writes to the field,
  moves on.

### What this requires

- **Field consistency.** Both engines can read and write field
  state, potentially concurrently. The substrate hosting the
  field must provide a consistency model that prevents corruption.
  Memory-ordering guarantees, transactional writes, or CRDT-style
  merge semantics are all acceptable; the choice depends on the
  implementation substrate.
- **Delta-scope discipline.** Each engine must only read delta at
  its own scope. Reading the other engine’s delta directly would
  violate SE-01’s reflexive-determination principle and would
  reintroduce a coordination path the architecture rejects.
- **Predictive reaching at both scopes.** Each engine must
  implement SE-05’s predictive reaching at its own vector-delta
  gap. When the render-scope gap exceeds threshold, the rendering
  engine generates render-scope predictive constraints. When the
  execution-scope gap exceeds threshold, the execution engine
  generates execution-scope predictive constraints. The engines
  do this independently; neither consults the other’s predictions
  directly.

-----

## 5. The field: one object, two access patterns

### What the field looks like

The field is a set of constraints plus the substrate state those
constraints operate in. At minimum, it contains:

- The seed (SE-04, permanent)
- Derived constraints (generated from inputs)
- Predictive constraints (generated from vector-delta gaps)
- Ratified constraints (predictions confirmed by matching input)
- Meta-constraints (patterns about constraints, from pattern
  development)
- Correlation structure (pairwise co-fire records)
- Substrate modulation state (fast and slow layers)
- Trace (append-only record of operations)
- Sub-cascade references (for compositional instances)

All of these are field state. In a split implementation, each is
represented in whatever substrate hosts it.

### How the field is accessed

**Experiential Reality reads the field** through render-side
data structures: textures containing constraint patterns, buffers
containing substrate modulation state, uniform buffers containing
metadata, and so on. It reads these in parallel during each
frame’s resolution pass.

**Experiential Reality writes the field** through render-side
outputs: new texture contents representing updated substrate
state, new buffer contents representing matched constraints and
their consequences, new uniform state for the next frame’s
parameters.

**Critical Thought reads the field** through execution-side data
structures: the trace (as a sequential log), constraint lists (as
ordered collections), persistent state (as structured records).

**Critical Thought writes the field** through execution-side
operations: appending to the trace, committing constraint
additions or removals, updating persistent state, flushing
outputs.

The same underlying data is represented differently at each
access pattern’s native level. An implementation must provide
translation between representations where necessary, or maintain
field state in a substrate that supports both access patterns
natively.

### The consistency model

The field’s consistency model is an implementation choice, not a
specification requirement. Several models are viable:

- **Snapshot-based.** Each frame reads a consistent snapshot of
  the field; sequential operations commit into a next-frame
  version. Writes by either engine take effect at frame
  boundaries.
- **Eventual consistency.** Writes propagate asynchronously;
  readers may see slightly stale state but convergence is
  guaranteed. Predictive reaching handles transient divergences.
- **Transactional.** Writes are transactional with explicit
  commit semantics. Reads are against committed state.
- **Conflict-free merge.** Operations are commutative or use CRDT-
  style merge semantics; divergent writes are merged
  automatically.

The choice affects performance and correctness trade-offs but not
the structural duality. Any of these models can host the field
while preserving SE-06’s coupling through delta.

-----

## 6. How they stay coherent without protocol

An outside observer watching the runtime might expect the two
engines to drift - one advancing per frame, the other per
operation, no coordination between them. How does the runtime
remain coherent?

The answer has three parts.

**First, both engines operate on the same field.** Any coherence
the field has is coherence both engines see. There is no “render’s
field” and “execution’s field” to drift apart; there is one field,
accessed two ways.

**Second, delta is the shared measurement.** When the two engines
produce delta readings at their respective scopes, the readings
are measurements of the same underlying object. They may differ
because they measure different populations of that object (render
scope measures parallel constraints; execution scope measures
sequential operations), but they measure the same field. Large
persistent divergence between the two readings means the field is
genuinely in a transitional state; small divergence means the two
scopes are viewing the same coherent state from different angles.

**Third, predictive reaching closes gaps actively.** When either
engine’s vector-delta gap exceeds threshold, that engine generates
predictive constraints. These predictions become part of the
field. The other engine reads them as part of its next operation
on the field. If matching input arrives at either engine, the
prediction ratifies and both engines’ subsequent readings reflect
the ratification. The gap-closing mechanism is shared because
ratification happens in the field, which is shared.

Coherence emerges from the architecture, not from coordination.

-----

## 7. Build order

Given the split, the engineering path is not “build both at once.”
It is “build one, verify, then build the other around the
verified structure.” Specifically:

### Phase 1: Finish the single-substrate track

The current implementation (fresh v1) runs the entire architecture
in a single substrate (browser JS engine). This is a valid partial
implementation. Before committing to the split, the single-
substrate track should reach step 2 (constraint-level operations
with full SE-05 support) to verify the full grammar is coherent
in a simpler environment.

This is the next immediate engineering session. Estimated scope:
bootstrap-fresh-v2.html, ~1800 lines, adding the six constraint-
level operations on the vector-delta foundation.

### Phase 2: Experiential Reality engine, minimum viable

Build the rendering substrate as a separate artifact. Takes the
constraint set from the fresh v2 and resolves it per-frame in a
compute shader. Produces delta at render scope. Produces
predictive constraints at render-scope gap events. Writes field
state back to buffers on each frame.

The execution substrate is still the browser JS engine, but its
scope is reduced: it only handles input intake, trace committal,
and UI rendering of field state diagnostics. It does not resolve
constraints.

Estimated scope: ER-engine-v1 + host-v1, combined ~2500 lines,
with the compute shader carrying most of the novel work.

### Phase 3: Critical Thought engine, minimum viable

Extract the execution-substrate work into its own named engine.
Formalize its operation loop (per-operation cycle, trace
committal, persistent state management). Give it its own delta
measurement at execution scope.

At this point the architecture genuinely has two engines. They
coordinate through the field via delta. SE-06 is fully
implemented.

Estimated scope: CT-engine-v1, ~1500 lines as a refactor of
the host code from Phase 2.

### Phase 4: Expressive substrate

Extend the architecture so it can describe itself in vocabulary
sourced from its own accumulated structure, and so its memory
extends across time through persistent storage operating as a
substrate of the ER engine. Three sub-phases:

- 4a. Storage as substrate: ER engine evaluates over a combined
  population of live and persisted constraints. Recall becomes
  parallel matching against past structure, byte-equivalent
  between CPU oracle and GPU path.
- 4b. Cross-substrate compound constraints: a new constraint kind
  whose pattern combines render-scope and execution-scope
  predicates. Compounds accumulate fidelity and promote into
  named structures the way families promote into sub-cascades.
- 4c. Output surface: a UI surface that emits descriptions of the
  field’s current posture, in templates initially we write
  (Pass A) and eventually sourced from promoted compounds
  (Pass B). The system describes itself in vocabulary it has
  accumulated, in forms it has formed.

Estimated scope: approximately 2000 lines combined across sub-
phases. See IMPLEMENTATION_PATH.md Phase 4 for detailed
breakdown.

### Phase 5: Coupling verification

Build tests that verify the engines remain coherent under stress.
Phase 5 follows Phase 4 because compound constraints and storage-
as-substrate add new coupling surfaces requiring verification.
Test cases:

- Rapid input stream: does execution-scope delta track in the
  expected way while render-scope delta responds per frame?
- Divergence induction: can we create scenarios where the two
  scopes diverge, and does predictive reaching handle them?
- Cross-engine ratification: a prediction generated at one scope,
  ratified by input that arrives at the other, should produce
  coherent state across both engines.
- Persistence across restart: save field state from both engines,
  restart, verify coherence. Phase 4 storage-as-substrate adds:
  persisted constraints survive restart and continue contributing
  to recall.
- Compound coherence under stress: cross-substrate compounds fire
  correctly when their conditions hold across substrate
  boundaries, do not false-fire when only one predicate holds.

Estimated scope: tests + diagnostic tooling, ~1000 lines.

### Phase 6: Distribution (optional)

If the architecture should scale beyond one machine, the duality
extends further: multiple Experiential Reality engines on
different GPUs, multiple Critical Thought engines on different
nodes. This opens the four problems from algorithm 17 (trust,
header consensus, merge strategies, convergence). Out of scope
for initial implementation.

-----

## 8. Risks

### Technical risks

**Field consistency is hard at scale.** Both engines writing to
the same field object without explicit coordination is a known-
hard problem. The consistency model chosen in Phase 6 will affect
whether this scales.

**Delta-at-render-scope may be expensive to compute.** Computing
delta requires reading across the entire live constraint set.
Doing this per frame for thousands of constraints may require
optimization (sampling, hierarchical summation, or GPU-native
reductions).

**Predictive constraint generation is currently heuristic.** The
heuristics in fresh-v1 are simple (char-class gaps, length
ranges, token co-occurrences). More sophisticated prediction may
be needed for interesting behavior at scale. This is not blocked
by the split; the split just makes it visible that better
prediction improves both engines simultaneously.

### Architectural risks

**The two engines may drift into coupled complexity.** If the
field’s consistency model requires extensive bookkeeping to keep
both engines in sync, we have reintroduced coordination in
disguise. Care must be taken to use field-native consistency
mechanisms rather than adding protocol on top.

**The names “experiential reality” and “critical thought” may
mislead.** Users unfamiliar with the structural motivation may
read phenomenological claims into the names. The defense is
documentation (DEFINITION.md, WHAT_IT_IS.md, SE-06) consistently
labeling the comparison as structural. The names remain useful
because the structural parallel is real.

### Project risks

**Splitting a project mid-development is expensive.** Phase 2 and
Phase 3 both involve significant refactoring. The work is
recoverable (the spec is stable; the engines are working toward
known targets), but the intermediate state is fragile.

**Two codebases require double the discipline.** ASCII-only,
defense stack, test suites, documentation - all doubled. Care
must be taken not to let one engine drift in quality while the
other advances.

### Mitigation

- Build Phase 1 (single-substrate completion) before committing
  irreversibly to the split. The split should happen when the
  single-substrate track has demonstrated the architecture’s
  behavior clearly enough to make the split’s trade-offs obvious.
- Keep SE-06 as the canonical reference for what the split means.
  Any drift in either engine that violates SE-06’s four non-
  negotiable constraints (sections 4’s “what this rules out”)
  invalidates that engine’s implementation of the architecture.
- Maintain DEFINITION.md and WHAT_IT_IS.md as the coherence
  documents across both engines. Neither engine’s documentation
  should contradict these; both engines’ documentation should
  reference them.

-----

## 9. What the split is for

Stripped down: performance and honesty.

**Performance:** the rendering pipeline is where parallel
resolution happens efficiently. Running the architecture natively
there lets the parallel aspect of the foundational claim operate
at substrate-native speed instead of simulated in an interpreter.

**Honesty:** the architecture has always had two kinds of
operations (parallel and sequential). Trying to do both in one
substrate produces compromises. Letting each live where it
belongs is what the architecture was shaped for since algorithm
16. The split is the admission of what was always true.

The paradigm claim from the DEFINITION’s coda gets sharper once
the split is made explicit. “Computation as operations on a
constraint substrate with no control surface” is coherent in
single-substrate form, but the architectural possibility that
distinguishes it from classical computing - that parallel
rendering-class work and sequential execution-class work can
coordinate through a shared field rather than through command -
only becomes visible when both substrates are present and doing
their native work. The split is how the paradigm claim earns its
weight.

## Version

PROJECT_SPLIT.md v1.1, pinned to SE-06 v1.0, DEFINITION.md v1.1
(with section 0.5), and IMPLEMENTATION_PATH.md v2.0.

v1.1 changes:

- Added Phase 4 (expressive substrate): storage-as-substrate,
  cross-substrate compound constraints, output surface from
  promoted compounds.
- Renumbered v1.0’s Phase 4 (coupling verification) to Phase 5.
- Renumbered v1.0’s Phase 5 (distribution) to Phase 6.
- Updated phase 6 reference in risks section accordingly.

Revisable when Phase 4 sub-phases ship and reveal more.