# SE-01  -  Compositional Cascades

**Type:** Specification extension
**Status:** OBSERVATIONAL. Documents a property the existing cascade
formalism permits without modification. No new mechanisms proposed.
**Primary origin:** conversation April 2026, arising from the question
of whether the three delta readings (shared-value-with-dual-semantics,
integrated-trace, relational-anchor) can hold simultaneously.
**Resolution of that question:** they can, trivially, because the
formalism is compositional. This extension names the property so it
can be relied on elsewhere.

---

## What this extension does

It notes a property of the cascade formalism that is already present
by construction, and gives it a name so other algorithms can reference
it. It does not propose an addition to the architecture. It does not
propose a new data structure. It does not require any implementation
work to "enable."

The specification extension exists because the property, once named,
has downstream consequences that other catalog entries can build on
without having to re-derive it.

## The property

A cascade is a function from a coordinate to an output record, defined
by a constraint set. The formalism places no restriction on what
coordinates or outputs may *be*. In particular:

1. A coordinate is a tuple of value indices, one per dimension. The
   value indices are drawn from the dimension's declared value set.
   The formalism does not require that value set to contain only
   scalars. The value set may contain references to other cascades,
   or resolved outputs of other cascades, or labels that identify
   other cascades.

2. An output record is a map from property names to values. The
   formalism does not require those values to be scalars. A cascade's
   output may include a reference to another cascade, a resolved
   output from another cascade, or the result of another cascade
   applied to a sub-coordinate.

3. delta is defined as `unresolved / total` at whatever resolution scope
   it is measured in. The formula has no ambient scope. Applied at
   one cascade, it measures unresolved coordinates in that cascade.
   Applied at a cascade whose coordinates reference other cascades,
   it measures unresolved sub-cascades. The formula is unchanged.

These three properties are consequences of how the cascade is
specified in the existing algorithms, not additions to them.

## Consequences

### Compositional structure is available without new mechanism

A cascade may be arranged such that its coordinates reference other
cascades. The outer cascade resolves first  -  its rules determine which
sub-cascade is active for a given outer coordinate. The sub-cascade
then resolves against its own rules. Either cascade is a cascade in
the existing sense; neither requires a new kind of object.

This is compositional by construction. It is what the cascade formalism
permits when the value space of a dimension is itself a cascade.

### delta is scale-free

Because `unresolved / total` contains no ambient reference to scale,
the same formula applies at every compositional level. The semantic
content of what "unresolved" and "total" mean differs by level:

- At a base cascade, "unresolved" means probabilistic dimensions not
  yet resolved, "total" means all dimensions of that cascade.
- At a composing cascade, "unresolved" means sub-cascades whose
  outputs are not yet determined, "total" means all sub-cascades
  referenced by the outer cascade.
- At a trajectory across the composition, "unresolved" means steps
  in the trajectory whose cascades have not yet resolved, "total"
  means steps in the trajectory scope under consideration.

The formula is the same at each level. The semantic content is
determined by the level at which it is measured. No translation is
required.

### The three delta readings hold simultaneously in any composed system

This is the direct consequence that motivated this extension.

- **Dual-semantics** (delta means different things to execution and to
  render, but is the same value): this holds at any single cascade.
  It is a property of delta being computed at a boundary where the
  measurement is read by both sides.

- **Integrated trace** (delta accumulates along a trajectory, anchoring
  the present relative to the history): this holds when the
  trajectory is tracked as an object and delta is emitted at each
  resolution. Algorithm 22 specifies the mechanism.

- **Relational anchor** (delta is the relation that makes sides
  relatable, not a value owned by either side): this holds at the
  coupling between cascades  -  whether the coupling is
  execution/render within one cascade, or cascade/cascade in a
  composition.

None of these readings require architectural additions to coexist.
They are three views of what a scale-free delta does at three different
structural positions in a compositional system. When the system is
compositional, all three are visible simultaneously, at different
levels.

### Compilation is a reading, not an operation

When an outer cascade resolves a coordinate to an output that selects
or determines a sub-cascade's applicability, this is classical
compilation in a precise sense: the outer cascade takes input (an
outer coordinate) and produces output (a resolved sub-geometry ready
to be resolved in turn). This is what compilers do.

"Compiler of fields" is therefore a reading of the compositional
cascade structure, not a new mechanism. The system does not need to
be made into a compiler. When composed, it *is* one, at the outer
level, by the definition of compilation.

## Invariants preserved under composition

Composition does not weaken any invariant established for base
cascades. Specifically:

1. **Determinism.** A composed resolution is deterministic given the
   outer coordinate, the outer constraints, the sub-cascade
   constraints, and the sub-coordinate. This follows from the
   determinism of each constituent cascade; composition of
   deterministic functions is deterministic.

2. **Memoryless-at-coord.** Each constituent cascade remains
   memoryless at its coord level. Trajectory-layer memory (algorithm
   22) layers on top of composition without conflicting with it.

3. **Content-addressable integrity.** Algorithm 13's Merkle
   construction applies at each compositional level. A composed
   system has a Merkle root per cascade; the outer cascade's Merkle
   root can include the inner cascades' roots as committed content,
   preserving content-addressability across composition.

4. **Specificity semantics.** Algorithm 04's rule-ordering by
   specificity applies within each cascade. Composition does not
   introduce cross-cascade specificity competition; each cascade's
   ordering is local to itself.

5. **Substrate independence.** Algorithm 16's GPU-CSS byte-equality
   applies per cascade. A composed system can resolve each cascade
   on whichever substrate is appropriate for it; the composition
   does not require substrate uniformity across levels.

## Non-claims

This extension does **not** claim:

- That the system should be implemented as a composed structure. The
  current canonical implementation is a single cascade. That is a
  correct base case and a sufficient implementation for its narrow
  domain.

- That composition produces Turing completeness. The foundational
  claim's Part 3 (branch-logical computation as trajectory) makes a
  separate argument about that, resting on trajectory-as-tape
  semantics. Compositionality is orthogonal to universality.

- That every system built on VSF should expose compositional
  structure. The extension documents that composition is permitted
  by the formalism. Whether to use it is a design decision per
  application.

- That composition resolves any open research question. Trust
  (algorithm 17 item 1), header consensus (item 2), merge strategies
  (item 3), and convergence (item 4) remain unresolved. Composition
  is compatible with these problems but does not solve them.

- That this extension proposes new algorithms. Nothing in the catalog
  needs to be rewritten because of this document. The property was
  already present; the document names it.

## Relationship to foundational claim

The foundational claim's Part 1  -  "Geometrically defining and mapping
languages, operations, syntax, constraints, rules, standards each as
their own separate multidimensional object"  -  implies compositional
structure directly. A system that encodes multiple domains as separate
geometric objects and uses them together *is* a compositional cascade
system. The foundational claim's wide reading is supported by the
formalism to exactly the extent that the formalism is compositional,
which this extension documents that it is.

## References to catalog entries

Algorithms whose content is relevant to the structure documented here:

- **Algorithm 01** (Manifold Reflex primitives)  -  The S, M, C, E, H,
  delta, MR vocabulary is scale-invariant by intent. Composition is
  one concrete instantiation of that scale-invariance at the level
  of the cascade object itself rather than only at the level of
  individual primitives.

- **Algorithm 02** (delta computation)  -  The base delta formula is
  scale-free by construction. This extension's observation that delta
  semantics differ by compositional level is a direct consequence of
  the formula containing no ambient scope.

- **Algorithm 03** (delta_IPC channel fidelity)  -  The dual-direction
  delta pattern (S to C and C to S, composed) is already an instance
  of delta at a coupling boundary. Composition generalizes this
  pattern from a two-endpoint boundary to an N-cascade structure.

- **Algorithm 04** (constraint compilation)  -  The compilation of
  {when, then} rules to CSS selectors works unchanged on each
  constituent cascade in a composition. Rule-ordering by specificity
  remains local to each cascade; no cross-cascade specificity rule
  is introduced.

- **Algorithm 06** (parallel probe array)  -  Parallel resolution of a
  state space works on each constituent cascade independently. The
  outer cascade can probe its coords in parallel; each inner cascade
  can probe its coords in parallel. No new parallelism mechanism is
  required.

- **Algorithm 09** (VSF header triads)  -  A composed system may be
  expressed as a single VSF file with nested dimension triads, or as
  multiple VSF files referencing each other. The header grammar
  supports both forms without modification.

- **Algorithm 10** (VSF body rows)  -  Rows of a composing cascade
  reference sub-cascade outputs in their output columns. The existing
  row grammar supports string-valued outputs; reference strings fit
  this grammar.

- **Algorithm 13** (content-addressing and Merkle)  -  Composition
  preserves Merkle integrity when each cascade's root is included
  as committed content in the parent cascade. This is a
  straightforward application of Merkle tree recursion.

- **Algorithm 14** (security defense stack)  -  All seven threat
  classes and their defenses apply per cascade. Composition does not
  introduce new threat classes; each constituent cascade inherits the
  defenses.

- **Algorithm 16** (GPU postfix stack machine)  -  Each constituent
  cascade may be resolved on CSS or GPU substrate. Substrate choice
  is per cascade; the composition does not require uniformity.

- **Algorithm 17** (distributed collapse network)  -  Composition and
  distribution are orthogonal. A composed system may be distributed
  across nodes; a distributed system may compose local cascades.
  The four open DCN problems apply unchanged.

- **Algorithm 19** (observer as channel, triadic)  -  The |A to C from
  B| framing characterizes a coupling between two cascades through
  a mediating channel. Composition generalizes this to N cascades
  coupled through N-1 channels. The framing scales.

- **Algorithm 22** (delta-trace as coupled signal)  -  The trace
  property specified there applies at any compositional level. A
  trajectory through a composed system produces trace data at each
  level it traverses; the trace is integrated across levels by the
  same append-only mechanism algorithm 22 specifies.

Algorithms not referenced above (05, 07, 08, 11, 12, 15, 18, 20, 21)
are either base-case mechanisms unaffected by composition, pure
theory, or open research directions whose relationship to composition
is not yet specified.

## Version

SE-01 v1.0, pinned to constraint formalism as of canonical
implementation v1.0 and algorithm catalog as of this writing.
