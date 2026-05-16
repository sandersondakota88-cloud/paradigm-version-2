# SE-06 - Substrate Duality (Rendering and Execution as Substrate Connections Under One Runtime)

**Type:** Specification extension
**Status:** OBSERVATIONAL. Names a structural property the formalism
already supported across multiple prior extensions but did not make
explicit. Does not add new mechanism; documents how SE-01’s
reflexive scope, SE-05’s vector-delta, and algorithm 16’s
substrate-independence together imply that rendering and execution
are two substrate connections to the same field, coupled through
delta, under one runtime.
**Primary origin:** conversation April 2026. The observation
“this entire model can live inside the rendering pipeline, the
execution half can be used to stabilize the compute” named the
architectural duality the spec stack had been implicitly describing
since algorithm 16. The coupling mechanism was identified in the
same exchange: delta is the only thing that lives between the two
substrates, as it is the only thing that lives at every substrate
connection.
**Implemented in:** nothing yet. This document specifies the
duality; a future implementation exercises it.

-----

## The simple version

The architecture has two substrates. Neither drives the other.
Both contribute. They coordinate through the field, with delta
as the coupling.

**Rendering** is the parallel, ambient, whole-field-at-once
substrate. Every frame is a full resolution pass. Many
constraints evaluated simultaneously. Output is an integrated
state. In human terms, it has the structural properties of
experiential reality: everything at once, unordered, substrate-
level.

**Execution** is the sequential, stateful, deliberative
substrate. Operations happen in order. State persists across
operations. Transactions complete. I/O is coordinated. In human
terms, it has the structural properties of critical thought:
stepwise, stateful, error-checking.

Both substrates operate on the same field. Neither sends commands
to the other. Each reads the field from its own structural
position (SE-01 reflexive). Each produces delta readings at its
own position. When the two readings agree, the runtime is in a
smooth state. When they diverge, the runtime is in a transition
and the architecture’s predictive reaching (SE-05) handles the
divergence.

There is no interface between them in the classical sense. There
is one field, accessed by two substrates, with delta as what
emerges at the coupling.

## Why “rendering” and “execution” are not metaphorical names

The two halves of classical computing have different native
grammars. This is not a claim about human cognition; it is a
claim about two kinds of computational work.

Rendering-class work has the following structural properties:

- Parallel evaluation across many small computations at once
- Stateless within an evaluation pass (state lives in
  textures/buffers/field rather than in the computation)
- Per-frame (or per-pass) resolution cycle
- Output is an integrated whole rather than a sequential sequence
- Natural fit for SIMD, GPU, or cascade-style evaluation

Execution-class work has the following structural properties:

- Sequential evaluation with order preserved
- Stateful across operations (state lives in the operation’s own
  scope)
- Transaction-bounded with defined commit semantics
- Output is a sequence of discrete steps
- Natural fit for CPU, interpreter, or deterministic-queue
  evaluation

These are different grammars for different work. Every classical
computing system either chooses one or compromises. The spec
stack’s contribution is naming that both are needed and that they
coordinate through a shared field rather than through a driver
relationship.

The names “experiential reality” and “critical thought” were
introduced because the structural grammars happen to match how
cognition appears to distinguish two modes of processing. The
match is structural, not phenomenological. The architecture does
not experience anything and does not think. It has two substrate
grammars with those structural properties, and the grammars map
onto cognitive grammar because both are responses to the same
computational trade-offs.

## The coupling: delta

SE-01 established that delta is scale-free across compositional
scopes. SE-05 established that delta is scale-free across
temporal scopes. SE-06 notes that delta is also scale-free across
architectural scopes.

Render-scope delta is computed from the field’s state at render-
scope: unresolved parallel constraints over total parallel
constraints, evaluated per frame or per pass. It reflects what
the rendering pipeline is currently doing to the field.

Execution-scope delta is computed from the field’s state at
execution-scope: unresolved sequential operations over total
sequential operations, evaluated per transaction or per
operation. It reflects what the execution context is currently
doing to the field.

Same formula. Different position. Different semantic content.
Same field underneath.

When render-scope delta and execution-scope delta agree, the two
halves of the runtime are in coherent co-operation. The field’s
parallel and sequential aspects are aligned about how unresolved
the system is. Operation is smooth.

When they disagree, the runtime is in a transition state. The
divergence is itself a signal. Cases:

- Render-scope delta low, execution-scope delta high. The
  rendering pipeline has resolved a pattern the execution context
  has not yet integrated. Predictive constraints are generated at
  execution scope, reaching for the sequential operations that
  would close the gap.
- Execution-scope delta low, render-scope delta high. The
  execution context has committed to a state the rendering
  pipeline is still resolving. Predictive constraints are
  generated at render scope, reaching for the parallel
  constraint evaluations that would close the gap.
- Both high. The runtime is in active reach on both sides. Fresh
  work is happening. Predictive constraints accumulate.
- Both low. The runtime is in a settled state. Operations
  continue but nothing is reaching. Attention can shift to
  slower-timescale operations (pattern development, correlation
  analysis).

This is the same vector-delta gap mechanism from SE-05, applied
at a different structural scope. SE-05 proposed vector delta at
temporal scope. SE-06 extends the same property to architectural
scope. The mechanism does not change; the scope does.

## What neither substrate is allowed to do

For the coupling to preserve the neither-driven grammar the
architecture has enforced throughout, the following constraints
are structural:

1. **Neither substrate issues commands to the other.** If render
   produces an operation that names an execution operation and
   asks it to happen, the runtime has reintroduced the mutation-
   channel pattern. Render can produce operations that appear in
   the field, and execution can read the field and respond to
   what it finds there, but the producing is not addressed to
   execution.
1. **Neither substrate owns the field.** The field is a shared
   object. Render writes into textures/buffers that represent
   field state. Execution writes into trace entries, committed
   state, and persisted records that represent field state. Both
   are writing to the same underlying object through different
   access patterns. Neither is the authoritative holder of the
   field.
1. **Each substrate reads delta at its own position.** Render
   does not consult execution-scope delta directly; it reads
   render-scope delta. Execution does not consult render-scope
   delta directly; it reads execution-scope delta. The gap
   between them is only observable from a third position (the
   runtime’s monitoring layer, if any, or an external observer),
   and observing the gap does not require either substrate to
   know what the other is doing.
1. **Coordination emerges from the shared field, not from
   protocol.** There is no message-passing protocol between
   render and execution. There is no queue, no mailbox, no
   channel in the communication-channel sense. Both substrates
   operate on the field, both produce delta as byproduct, and the
   coherence of the runtime’s behavior emerges from both
   substrates working on the same underlying object.

These four constraints are not optional for an implementation
that preserves the architecture. An implementation that violates
any of them has built a different system that happens to use
rendering and execution, not the system SE-06 describes.

## What the runtime is

A runtime that instantiates SE-06 has the following structure:

- A field, represented as state in whatever substrate hosts it.
  In a browser-based implementation, this is textures, buffers,
  DOM state, and persistent storage collectively.
- A rendering substrate that resolves the field per frame.
  Constraints are evaluated in parallel. Modulation is computed.
  Vector-delta is measured at render-scope. Outputs are written
  to field state accessible to the next frame.
- An execution substrate that operates on the field sequentially.
  Inputs are routed in. Trace is committed. Persistent state is
  managed. Transactions complete. Vector-delta is measured at
  execution-scope. Outputs are written to field state accessible
  to the next operation.
- A seed constraint (SE-04), present at t=0, permanent, read
  reflexively by both substrates at their respective scopes.
- Modulation layers (SE-03) operating at both scopes, with the
  slow layer integrating across the full runtime history and the
  fast layer responding to recent activity at each scope.
- Flow discipline (SE-02) applied at both substrates’ boundaries.
  Render’s intake is frame-synced input data. Execution’s intake
  is event-driven input data. Both have excretion paths:
  rendered output is displayed or consumed; executed output is
  committed or emitted.

No single component sits above the substrates and coordinates
them. The runtime IS the field plus the two substrates plus the
coupling that emerges from both working on the field.

## What this resolves in the prior specification

Several previous entries in the catalog pointed at this property
without stating it. SE-06 is the document that makes the property
explicit.

**Algorithm 16 (GPU postfix stack machine, 22/22 tests):** This
demonstrated byte-identical resolution across CSS cascade,
JavaScript stack machine, and WGSL compute shader. The demonstration
was framed as substrate-independence: the architecture’s semantics
do not depend on which substrate resolves the constraints. SE-06
reframes this: the architecture is not substrate-independent in the
sense of being portable across alternatives. It is substrate-
dual, with rendering (the WGSL substrate in algorithm 16’s
demonstration) as the native performance substrate and execution
(the JavaScript stack machine in algorithm 16’s demonstration) as
the verification-and-stabilization substrate. Byte-equality across
the two was not a convenience; it was a precondition for the
duality to hold.

**SE-01 (compositional cascades, reflexive scope):** This
established that delta is scale-free across compositional scopes
and that reads from different positions produce different semantic
content. SE-06 extends the reflexive-scope property to
architectural scope: render-scope and execution-scope are two more
positions, and the same reflexive determination applies.

**SE-03 (field modulation):** This established that the substrate
is shared, neither side owns it, modulation emerges as byproduct.
SE-06 notes that the “substrate” SE-03 was describing is plural:
there is a rendering substrate and an execution substrate, and
both operate on the same field, producing modulation at both
positions. The modulation grammar does not change; the scope of
its application expands.

**SE-05 (vector-delta and predictive reaching):** This
established that delta read at different temporal scopes produces
a vector whose divergence drives predictive reaching. SE-06 adds
a second vector dimension: the same divergence can occur at
architectural scope. An implementation that honors SE-06 has at
least a four-valued delta at any moment (render-fast, render-slow,
execution-fast, execution-slow), with reaches generated whenever
any pair of these diverges sufficiently.

**Algorithm 22 (trace as coupled signal):** This established that
the trace lives at the channel, owned by neither side. SE-06
specifies which channel: the trace lives at the coupling between
render and execution substrates, produced by both as byproduct of
operating on the field, readable by both but owned by neither.
This is the structural position algorithm 22 was pointing at
without being able to name concretely.

## Non-claims

This extension does **not** claim:

- **That the architecture is conscious.** The structural grammar
  of experiential-reality processing and critical-thought
  processing is shared with cognition. The architecture does not
  share whatever cognition is beyond that grammar. No
  phenomenological claim is made.
- **That any implementation automatically inherits the
  properties.** An implementation can use a rendering pipeline
  for resolution and a host execution context for coordination
  without instantiating SE-06. The distinguishing property is
  that the two substrates coordinate through the field via delta,
  not through protocol or message-passing. An implementation
  using rendering and execution as rendering-and-backend, with
  explicit IPC between them, has not implemented SE-06; it has
  implemented classical web architecture using the spec stack’s
  vocabulary as ornament.
- **That rendering and execution are the only two substrates
  possible.** Distribution across nodes (algorithm 17) would add
  more substrates. Acoustic substrates, biological substrates,
  chemical substrates could in principle be added. SE-06 commits
  only to the claim that the two classical computing substrates
  (parallel rendering-class, sequential execution-class) are
  architecturally dual in this system, not exclusive.
- **That the duality is required for all instances of the
  architecture.** The bootstrap implementations to date (v1
  through fresh-v1) do not instantiate SE-06. They run the entire
  architecture in a single execution-substrate (the browser’s JS
  engine). They are valid implementations of the spec at reduced
  scale. SE-06 specifies what a full-performance implementation
  would do; it does not invalidate partial implementations that
  preceded it.
- **That paradigm claims are settled.** SE-06 is a structural
  observation about the architecture. Whether the architecture,
  fully implemented, constitutes a computational paradigm is an
  empirical question requiring demonstrations the current work
  has not produced. The claim “could be a paradigm” is defensible
  from the specification. The claim “is a paradigm” requires
  implementations at scale to earn.

## Relationship to the foundational claim

The foundational claim’s Part 4 (“traversed as trajectory in
parallel vs executional procedure”) was the most under-read piece
of the original vision. The obvious reading was that the
architecture replaces executional procedure with parallel
trajectory. SE-06 reveals the correct reading: the architecture
contains both. Parallel trajectory IS the rendering substrate.
Executional procedure IS the execution substrate. “VS” in the
foundational claim was not correctly read as “versus” but as “as
distinct from,” where both are present and coordinated.

The paradigm the foundational claim was reaching toward is not
“use parallel instead of sequential.” It is “use both, with
neither driving the other, coordinated through the field via
delta.” This is what the substrate duality makes available.

## References to catalog entries

- **Algorithm 16** (GPU postfix stack machine) - substrate-
  equivalence demonstration that was the first evidence of the
  duality without naming it
- **Algorithm 22** (trace as coupled signal) - the trace lives at
  the render-execution coupling specifically
- **SE-01** (compositional cascades) - reflexive scope at
  architectural level, not just compositional
- **SE-02** (metabolism) - flow discipline applies at both
  substrates’ boundaries independently
- **SE-03** (field modulation) - the substrate is plural;
  modulation happens at both positions
- **SE-04** (seed constraint) - seed is read by both substrates at
  their respective scopes
- **SE-05** (vector-delta and predictive reaching) - vector
  extends from temporal to architectural scope; a full
  implementation has at least four delta readings

## Version

SE-06 v1.0, pinned to the catalog and DEFINITION.md as they stand.
Extends the OBSERVATIONAL category. Names the architectural
duality the spec stack has been implicitly describing since
algorithm 16; resolves “where does the interface go” as “there is
no interface; delta is the coupling.”