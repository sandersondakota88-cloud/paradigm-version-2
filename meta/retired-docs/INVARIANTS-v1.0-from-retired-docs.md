# INVARIANTS

What cannot be violated in any implementation that claims to
instantiate the constraint substrate. Read DEFINITION.md section
0.5 first; this document inherits that reading-mode.

This document distills load-bearing commitments from the spec stack
into a checklist form. It is not exhaustive (the spec contains more
detail than fits a checklist); it is the minimum set such that an
implementation honoring all of them can be considered a faithful
instance of the architecture, and an implementation violating any
of them cannot.

Structural commitments are organized by the section of the spec
they are sourced from. Each invariant has a short label, the
commitment statement, the consequence of violation, and a reference
to the spec entry that establishes it.

---

## Foundational invariants

### F1. The seed is permanent.

**Commitment:** A constraint with `kind = seed` exists at
initialization, persists across all operations, and is never
evicted by flow discipline, cap enforcement, or any other
mechanism.

**Consequence of violation:** The architecture loses its central
unresolvable measurement and collapses into a reactive engine that
operates only when input arrives. This is no longer the
architecture; it is constraint satisfaction with logging.

**Source:** SE-04.

### F2. Delta is one formula at every scope.

**Commitment:** The ratio computation `(unresolved + stale * 0.5)
/ population_size` is the same operation regardless of which
population it is computed over. Different scopes (field, sub-
cascade, fast-window, slow-integrated, render, execution) produce
different values because they operate on different populations,
not because they use different formulas.

**Consequence of violation:** Reflexive scope (SE-01) breaks. The
"one delta with many readings" property collapses into separate
per-scope quantities that have to be reconciled, which reintroduces
the coordination paths the architecture rejects.

**Source:** SE-01, algorithm 02.

### F3. No component supervises another.

**Commitment:** No part of the architecture sends commands to
another part. No central coordinator exists. Coordination emerges
from substrate state and shared field reads, not from explicit
control flow between components.

**Consequence of violation:** The neither-driven grammar fails. The
architecture becomes a controlled system with a hidden controller,
which is a different architecture.

**Source:** SE-03, throughout the spec stack.

### F4. The architecture operates indefinitely.

**Commitment:** Operation does not halt on completion of any task.
Between inputs, the seed evaluates, modulation continues, ticks
advance the field's step counter and update vector-delta. The
architecture has no termination condition.

**Consequence of violation:** The architecture becomes a job that
finishes. The dissipative-structure property (operation as
ongoing equilibrium) is lost.

**Source:** SE-02, SE-04.

---

## Closure invariants

### C1. The abstraction is closed.

**Commitment:** Every property the architecture has is a structural
consequence of prior commitments specified in DEFINITION.md or the
catalog. Nothing is bolted on. External assumptions
(thermodynamic, ML, cognitive, philosophical, or otherwise) may be
useful for comparison but are not part of the architecture.

**Consequence of violation:** Importing outside frames produces a
different system that shares vocabulary with this one. Such
systems may be coherent on their own terms; they are not this
architecture.

**Source:** DEFINITION section 0.5.

### C2. Misreadings do not change the architecture.

**Commitment:** The architecture's correctness is determined by
internal structural inspection of the spec against itself. It
cannot be established or refuted by external description, no
matter who produces the description.

**Consequence of violation:** Treating commentary as authoritative
rather than as input-to-be-evaluated drifts the canon away from
the spec stack. The architecture's coherence depends on the spec,
not on any particular reading.

**Source:** DEFINITION section 0.5.

### C3. AI commentary is treated as any commentary.

**Commitment:** AI-produced commentary on this work is held to the
same standard as any commentary: useful where it engages
structurally with the spec, set aside where it imports outside
frames or inflates claims beyond what the spec supports. This
standard applies regardless of which AI produced the commentary,
including the AI that helped build the spec.

**Consequence of violation:** The closure of the abstraction is
compromised. AI commentary that drifts becomes embedded in the
canon, and subsequent commentary builds on the drift.

**Source:** DEFINITION section 0.5.

---

## Mechanism invariants

### M1. Vector-delta has at least two temporal scopes.

**Commitment:** Any implementation honoring SE-05 computes delta at
a recent-window scope (fast) and an integrated-history scope
(slow), maintaining both as accessible quantities. The gap between
them is observable.

**Consequence of violation:** Predictive reaching cannot fire,
because predictive reaching is triggered by gap divergence. Without
predictive reaching, the field is reactive only and the
"reaching" structural property is lost.

**Source:** SE-05.

### M2. Predictive constraints and derived constraints are distinct.

**Commitment:** Constraint generation has at least two trigger
paths: novelty-based (input that does not match well produces
derived constraints describing it) and gap-based (vector-delta
divergence produces predictive constraints describing inputs that
would close the gap). These triggers are distinct; collapsing them
into a single mechanism loses the structural distinction between
intake and reaching.

**Consequence of violation:** Reaching becomes indistinguishable
from generation, and the architecture cannot exhibit the SE-05
property where unmatched predictions sustain delta pressure
between inputs.

**Source:** SE-05.

### M3. Predictive constraints can ratify.

**Commitment:** When input matches a predictive constraint, the
constraint type-transitions to ratified (a subkind of derived with
weight reinforcement). The transition is explicit and observable
in the trace.

**Consequence of violation:** The internalization of experience
mechanism is lost. Predictions can be matched but cannot become
permanent structure, which means the field cannot grow from
reaching.

**Source:** SE-05.

### M4. Substrate has fast and slow layers.

**Commitment:** Modulation operates at two timescales: a fast layer
that decays (reactive) and a slow layer that accumulates
permanently (integrated). Both are byproducts of operation, not
addressed signals.

**Consequence of violation:** The architecture loses the structural
analog of habituation and integration. Reward grammar (slow
accumulation) collapses, and the modulation reduces to single-
timescale state.

**Source:** SE-03.

### M5. Trace lives at the channel.

**Commitment:** The trace is owned by neither side of any
substrate coupling. Both sides produce trace entries as byproduct
of operating. Neither side consumes trace as command.

**Consequence of violation:** The trace becomes a message channel,
which violates F3 (no component supervises another) and converts
the architecture into a logged-message-passing system.

**Source:** algorithm 22.

---

## Composition invariants

### K1. Sub-cascades emerge from fidelity.

**Commitment:** A family of constraints promotes into a sub-cascade
only when the family reliably reduces delta when consulted
together (fidelity above threshold). Promotion is not arbitrary or
imposed; it is a consequence of measured fidelity.

**Consequence of violation:** Sub-cascades become compositional
structure imposed by the implementation rather than by field
dynamics. The "self-organizing" property is lost.

**Source:** SE-01, bootstrap v3.

### K2. Sub-cascades are addressable by name.

**Commitment:** Each sub-cascade has a name derived from its
content (typically from the dominant member's pattern). Inputs
containing the name produce a moderate selection bias toward the
sub-cascade's members and a moderate delta drop.

**Consequence of violation:** The architecture loses the mechanism
by which specific identifiers gain privileged access to specific
internal structures. The "called by name" property becomes
unavailable.

**Source:** SE-01, bootstrap v3.

### K3. Naming preference is structural, not stored.

**Commitment:** The slow layer accumulates a structural preference
for named-addressing as a byproduct of repeated naming events. The
preference is not stored as an explicit value addressed by any
component; it emerges from substrate accumulation.

**Consequence of violation:** Preference becomes a managed
quantity, which reintroduces the control-surface pattern the
architecture rejects.

**Source:** SE-01, SE-03.

---

## Substrate invariants

### S1. Substrate is shared, owned by neither.

**Commitment:** All substrate connections operate on the same
field. No connection holds an authoritative copy. Updates are
contributions to the shared substrate; reads are from the shared
substrate at the reader's structural position.

**Consequence of violation:** The architecture splits into multiple
private fields with synchronization between them, which is a
different architecture.

**Source:** SE-03, SE-06.

### S2. Substrate-resolution is deterministic across substrates.

**Commitment:** Constraint resolution produces identical output
regardless of which substrate computes it (CSS cascade, JS stack
machine, GPU compute shader, native CPU evaluator). This is the
property algorithm 16 demonstrated empirically across 2,880
coordinates with byte-identical results.

**Consequence of violation:** SE-06's substrate duality cannot be
implemented faithfully because the two substrates would produce
different field states over time.

**Source:** algorithm 16, SE-06.

### S3. Rendering and execution couple through delta only.

**Commitment:** The rendering substrate and the execution substrate
coordinate through the shared field, with delta as the only
quantity that emerges at their coupling. They do not exchange
messages, share schedulers, or use synchronization primitives.

**Consequence of violation:** SE-06's structural duality reduces to
"a renderer with a backend," which is classical web architecture
using the spec stack as ornament.

**Source:** SE-06.

---

## Implementation invariants

### I1. ASCII-only source.

**Commitment:** Implementation source code uses only ASCII
characters in the printable range plus newlines and tabs.

**Consequence of violation:** Visual ambiguity (smart quotes,
en-dashes, lookalike characters) introduces bugs that are
invisible to readers and can break parsers, character classes, or
hash equivalence checks.

**Source:** algorithm 14 (defense stack).

### I2. No prototype pollution.

**Commitment:** Implementations guard against `__proto__`,
`constructor`, and `prototype` as keys in any user-controllable
input that becomes an object property.

**Consequence of violation:** A class of injection attacks that
modify shared object behavior across the runtime.

**Source:** algorithm 14.

### I3. Bounded everything.

**Commitment:** Every accumulating structure (constraints, trace,
substrate state, output queue, correlations) has a finite cap with
defined eviction or aging behavior.

**Consequence of violation:** The architecture cannot operate
indefinitely (F4) because resources are exhausted in finite time.

**Source:** SE-02, algorithm 14.

### I4. No eval, no Function, no document.write.

**Commitment:** Implementations do not use dynamic code execution
primitives, dynamic Function construction, or document.write. The
constraint compiler converts constraints to executable form
through a restricted instruction set, not through string
evaluation.

**Consequence of violation:** Code injection via input becomes
possible; the substrate is no longer trustable.

**Source:** algorithm 14.

### I5. CSP meta tag with restrictive policy.

**Commitment:** Browser implementations include a Content Security
Policy meta tag that disallows external resources except where
explicitly required, blocks inline scripts where possible, and
prevents the document from being embedded in iframes or framed by
other origins.

**Consequence of violation:** The implementation can be
contaminated by external resources or embedded in attacker-
controlled contexts.

**Source:** algorithm 14.

---

## Documentation invariants

### D1. The spec is canonical.

**Commitment:** DEFINITION.md plus the algorithm catalog plus
SE-01 through SE-N constitute the canonical reference. Any other
document (KERNEL.md, INVARIANTS.md, PROJECT_SPLIT.md, WHAT_IT_IS.md,
implementation source, test code, commentary) is downstream. When
downstream documentation conflicts with canonical documentation,
the canonical wins.

**Consequence of violation:** Drift accumulates in downstream
documentation and gradually replaces the spec as the reference,
which violates C1 (closure).

**Source:** DEFINITION.md.

### D2. Spec extensions are formal.

**Commitment:** A new structural commitment enters the architecture
only as a numbered SE-N spec extension following the established
template (status, primary origin, implementation status, simple
version, mechanism, non-claims, references, version). Extensions
do not appear as inline edits to existing documents or as
pseudocode in supporting materials.

**Consequence of violation:** Extensions sneak in through
commentary, eventually creating a canon that no longer matches the
formal spec.

**Source:** SE-01 through SE-06 establish the template by example.

### D3. Non-claims are first-class.

**Commitment:** Every spec entry that makes structural claims also
explicitly names what it does not claim. This includes phenomenal
properties (consciousness, awareness), goal-directedness, paradigm
status, and any other claim the entry's mechanism does not
support.

**Consequence of violation:** Claims drift upward over revisions
because each revision quietly removes the disavowals from prior
versions.

**Source:** SE-01 through SE-06 (every entry has a non-claims
section).

---

## How to use this document

When reviewing an implementation, a spec proposal, a piece of
commentary, or a future revision:

1. Read DEFINITION.md section 0.5 to set the reading-mode.
2. For each invariant in this document, check whether the artifact
   under review honors it.
3. For any invariant that is violated, identify whether the
   violation is intentional (in which case the artifact is not
   instantiating this architecture and that should be stated) or
   unintentional (in which case the artifact should be revised).
4. For artifacts that make claims beyond what the invariants
   support, identify the specific over-claim and either reduce the
   claim to what the spec supports or add a new SE-N extension
   that establishes the structural ground for the claim.

This document is not a defense against bad-faith readers or against
implementations that intentionally diverge. It is a reference for
careful readers and faithful implementers, distilling the spec
stack's load-bearing commitments into a single inspectable form.

The closure of the abstraction does the rest of the work.

## Version

INVARIANTS.md v1.0. Pinned to DEFINITION.md v1.1 (with section
0.5), KERNEL.md v1.0, and SE-01 through SE-06. Revisable when
new spec extensions add invariants or when implementation reveals
invariants the spec stack implies but has not stated.
