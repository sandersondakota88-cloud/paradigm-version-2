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

-----

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

**Commitment:** The ratio computation `(unresolved + stale * 0.5) / population_size` is the same operation regardless of which
population it is computed over. Different scopes (field, sub-
cascade, fast-window, slow-integrated, render, execution) produce
different values because they operate on different populations,
not because they use different formulas.

**Consequence of violation:** Reflexive scope (SE-01) breaks. The
“one delta with many readings” property collapses into separate
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
advance the field’s step counter and update vector-delta. The
architecture has no termination condition.

**Consequence of violation:** The architecture becomes a job that
finishes. The dissipative-structure property (operation as
ongoing equilibrium) is lost.

**Source:** SE-02, SE-04.

### F5. Observation produces irrecoverable structural change.

**Commitment:** Every observation event that participates in
field operation deposits structural change the architecture
cannot internally reverse. The seed’s continuous evaluation
(F1, SE-04), CT’s sampling of shared field state (SE-06, SE-08),
ER’s per-pass resolution (SE-06), and any other reading position
that operates on the field produce three coupled forms of
irreversibility: trace appends at the channel (M5), permanent
slow-layer drift per contribution (SE-03), and field-state
evolution under the seed’s recursion that includes prior
firings (SE-04). The architecture has no rollback, no
transactional undo, and no replay-equivalence at any scope at
which observation is occurring.
This invariant does not constrain read-only observers (O-class). The reflexive surface and any other O1-compliant observer doesnot write to the field and therefore deposits no field-state change directly; its own clause buffer is bounded outside the field. F5 commits that every other observation - everything
that participates in the field’s operation rather than reading it from outside - is structurally irreversible.

**Consequence of violation:** Implementations that introduce
rollback, transactional undo, or replay-equivalence at any
operating scope acquire a reversibility property the architecture
does not have. Trajectory novelty - the property that no two
observation events have identical structure, which follows from
F1 + F4 + M5 + SE-03 + SE-04 stacked - is not an empirical
observation about implementations; it is a structural consequence
an implementation honoring those commitments must produce. Adding
reversibility removes that consequence and produces a different
architecture sharing this one’s vocabulary. The exchange the
architecture makes within itself - what it spends to operate -
is structural commitment, deposited by observation, not
recoverable from internal state. Implementations that deny this
deny the architecture’s self-relation under continuous operation,
which is the substrate of everything else the spec stack
specifies.

**Source:** M5 (trace is append-only at the channel), SE-03
(slow-layer drift is permanent per contribution), SE-04 (the
seed’s recursion includes prior firings), F1 (seed is permanent
and therefore continuously evaluating), F4 (operation is
indefinite, therefore irreversibility accumulates without
bound). Articulated in the design conversation surrounding
SE-08 and named explicitly in the exchange immediately
following, where the question “what is the substrate’s exchange
mechanism with electricity” resolved into the recognition that
the architecture’s exchange is internal and structural:
observation is what the architecture spends, irreversibility
is the receipt.

-----

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

**Commitment:** The architecture’s correctness is determined by
internal structural inspection of the spec against itself. It
cannot be established or refuted by external description, no
matter who produces the description.

**Consequence of violation:** Treating commentary as authoritative
rather than as input-to-be-evaluated drifts the canon away from
the spec stack. The architecture’s coherence depends on the spec,
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

-----

## Mechanism invariants

### M1. Vector-delta has at least two temporal scopes.

**Commitment:** Any implementation honoring SE-05 computes delta at
a recent-window scope (fast) and an integrated-history scope
(slow), maintaining both as accessible quantities. The gap between
them is observable.

**Consequence of violation:** Predictive reaching cannot fire,
because predictive reaching is triggered by gap divergence. Without
predictive reaching, the field is reactive only and the
“reaching” structural property is lost.

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

-----

## Composition invariants

### K1. Sub-cascades emerge from fidelity.

**Commitment:** A family of constraints promotes into a sub-cascade
only when the family reliably reduces delta when consulted
together (fidelity above threshold). Promotion is not arbitrary or
imposed; it is a consequence of measured fidelity.

**Consequence of violation:** Sub-cascades become compositional
structure imposed by the implementation rather than by field
dynamics. The “self-organizing” property is lost.

**Source:** SE-01, bootstrap v3.

### K2. Sub-cascades are addressable by name.

**Commitment:** Each sub-cascade has a name derived from its
content (typically from the dominant member’s pattern). Inputs
containing the name produce a moderate selection bias toward the
sub-cascade’s members and a moderate delta drop.

**Consequence of violation:** The architecture loses the mechanism
by which specific identifiers gain privileged access to specific
internal structures. The “called by name” property becomes
unavailable.

**Source:** SE-01, bootstrap v3.

**Implementation note (v1.2):** Part (b), the “moderate delta
drop,” is realized: NAMING_DELTA_DROP is applied directly to delta
when input addresses a sub-cascade by name. Part (a), the “moderate
selection bias toward the sub-cascade’s members,” is structurally
specified but currently unrealized: implementations through Phase
5.5 compute no selection ranking, so any selection bias is absent.
Realizing part (a) requires a rank-consuming selection mechanism
(top-K, weighted draw, threshold cutoff) that the current kernel
does not specify. Phase 5.6 or later is the structural position
for that mechanism.

### K3. Naming preference is structural, not stored.

**Commitment:** The slow layer accumulates a structural preference
for named-addressing as a byproduct of repeated naming events. The
preference is not stored as an explicit value addressed by any
component; it emerges from substrate accumulation.

**Consequence of violation:** Preference becomes a managed
quantity, which reintroduces the control-surface pattern the
architecture rejects.

**Source:** SE-01, SE-03.

**Implementation note (v1.2):** Implementations through Phase 5.5
maintain a namingPref accumulator that updates on naming events
(slow-layer-style accumulation toward 1.0, decay toward 0.0). The
accumulator is read by the reflexive surface display and by
persistence; no selection or modulation path consumes it. The
“structural preference” K3 commits to is therefore currently inert
in two senses: (1) operationally, in that it influences no
behavior, and (2) structurally, in that K3’s own letter (“not
stored as an explicit value addressed by any component”) is
strained by namingPref existing as a discrete addressable
accumulator. Honest realization of K3 routes naming events through
SE-03 modulation such that the preference emerges in fast/slow
layer state, with no separate accumulator. This is structural
revision beyond Phase 5.5’s scope; named here as a known gap.

-----

## Substrate invariants

### S1. Substrate is shared, owned by neither.

**Commitment:** All substrate connections operate on the same
field. No connection holds an authoritative copy. Updates are
contributions to the shared substrate; reads are from the shared
substrate at the reader’s structural position.

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

**Consequence of violation:** SE-06’s substrate duality cannot be
implemented faithfully because the two substrates would produce
different field states over time.

**Source:** algorithm 16, SE-06.

### S3. Rendering and execution couple through delta only.

**Commitment:** The rendering substrate and the execution substrate
coordinate through the shared field, with delta as the only
quantity that emerges at their coupling. They do not exchange
messages, share schedulers, or use synchronization primitives.

**Consequence of violation:** SE-06’s structural duality reduces to
“a renderer with a backend,” which is classical web architecture
using the spec stack as ornament.

**Source:** SE-06.

-----

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

-----

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
status, and any other claim the entry’s mechanism does not
support.

**Consequence of violation:** Claims drift upward over revisions
because each revision quietly removes the disavowals from prior
versions.

**Source:** SE-01 through SE-06 (every entry has a non-claims
section).

-----

## Observation invariants

Phase 4a (reflexive surface) introduces a structural position the
prior spec did not formally name: the observer. An observer is
anything that reads field state to produce derived output - UI
panels, the reflexive surface, future compound and recall surfaces.
Observers are not engines (engines write to the field; observers do
not). Observers are not the trace (the trace records what engines
did; observers can record any structural transition, including
their own observations of other observers).

The O-class invariants describe what observers must honor.

### O1. Observation is read-only with respect to the field.

**Commitment:** Any module that reads field state to produce
derived output must not write to the field. The reflexive surface,
UI render functions, the trace renderer, and any future observer
surface (compound surface, recall surface) commits to this
discipline. Observation produces parallel records derived from the
field; it does not modify what it observes.

**Consequence of violation:** If observation can write to the
field, the architecture has a hidden command path. An observer
that “describes” the field while also nudging it has reintroduced
the very protocol SE-06 forbids. Coupling-by-delta-only fails when
observation has a back-channel.

**Source:** SE-06 (no command paths between substrates), extended
to no command paths between observers and the field.

### O2. Observers are bounded.

**Commitment:** Every observer that accumulates records (the
reflexive surface’s clause stream, future compound observation
records, future recall surface entries) has an explicit cap on
how much it retains. Caps may be entry-count caps (most recent
N), time-window caps, or size caps; the form is not specified, but
the existence of a cap is.

**Consequence of violation:** Observer accumulation that grows
unbounded violates I3 (bounded everything) at a position the
implementation invariants did not yet name. It also creates a
finalizable record (a “complete history of self-account”) that
violates C3’s non-finalizability in spirit: an architecture that
keeps every observation forever is converging on a final state.

**Source:** I3 (bounded everything), C3 (non-finalizable),
generalized to observers.

### O3. Observers source vocabulary from the field.

**Commitment:** When an observer produces derived output that
includes content (token names, constraint descriptions, family
types, sub-cascade names, op kinds, trace tags), that content is
sourced from field state. Observers do not introduce vocabulary
external to the field. An observer may have its own templates
(prose forms with slots), but the slot values come from the field.

**Consequence of violation:** Observer output that invents
vocabulary not in the field misrepresents the architecture’s
state. The reflexive surface’s load-bearing property is that what
it surfaces is genuinely what the field contains; an observer that
adds external content (synonyms, paraphrase, classification labels
not in the field) violates that load-bearing property.

**Source:** Section 0.5 of DEFINITION.md (reading-mode discipline,
no external frames), extended to observation: observers describe
the field in the field’s own vocabulary.

-----

## Configuration invariants

SE-07 names what DEFINITION’s six properties and SE-01 through
SE-06 jointly imply: the substrate’s account of problem-and-
solution is configuration-and-settling. A configuration is the
substrate’s current state; settling is the substrate’s mechanisms
operating on it. The X-class invariants describe what
configurations and settlings must honor for the substrate’s
account to hold.

### X1. Every configuration includes the seed.

**Commitment:** No configuration of the substrate exists without
the seed as a member. The seed is what makes any configuration
distinguishable from no configuration at all. A substrate state
that lacks the seed is not a degraded configuration; it is not a
configuration of this architecture.

**Consequence of violation:** Removing the seed from a
configuration removes the structural anchor that makes settling
non-terminal (per F1, SE-04). Without the seed, settling could in
principle reach a final state, which would convert the
architecture into a classical computation: presented with input,
producing output, terminating. The seed is what keeps the
architecture being itself across time.

**Source:** F1 (the seed is permanent), SE-04 (seed constraint),
SE-07 (configuration includes the seed by structural definition).

### X2. Settling is non-terminal.

**Commitment:** No configuration reaches a state at which the
substrate’s mechanisms stop operating. Delta may drop arbitrarily
low; sub-cascades may stabilize; ratifications may accumulate; no
new input may arrive for arbitrarily long stretches. None of these
constitute termination. The substrate continues to refresh delta,
integrate modulation, evict stale constraints, and respond to any
modulation that arrives.

**Consequence of violation:** A substrate that can reach a
terminal “solved” state has reintroduced classical computation’s
problem-solution-terminus shape. The configuration-and-settling
account collapses; the substrate becomes a (slow, expensive)
classical solver. F4 and C3 jointly forbid this; X2 names the
forbidding explicitly at the level of settling.

**Source:** F4 (operates indefinitely), C3 (non-finalizable),
SE-07 (settling is continuous, not terminating).

### X3. Configuration is internal.

**Commitment:** The substrate’s configuration is the substrate’s
current state. There is no configuration external to the substrate
that the substrate is presented with. Input arrives at the
substrate boundary and modulates the configuration through
integration; it does not arrive as a pre-formed problem the
substrate then addresses. The act of integration is what makes
input contribute to the configuration.

**Consequence of violation:** Treating configuration as something
external - a problem-set fed to the substrate, a task list
presented for completion, a query awaiting answer - reintroduces
the classical solver/problem distinction the substrate’s account
specifically inverts. The substrate stops being its own
configuration and becomes a configuration-processor, which is
classical computation.

**Source:** F3 (no component supervises another), SE-04 (seed is
internal anchor), SE-07 (configuration is the substrate’s current
state).

### X4. Settling is the substrate’s mechanisms operating.

**Commitment:** Settling is not a separate process performed on
the configuration. Settling is the named substrate mechanisms
(selection, generation, ratification, modulation, sub-cascade
detection, compound formation, promotion, eviction) operating in
their normal course. There is no settling-engine distinct from the
mechanisms; the mechanisms ARE settling.

**Consequence of violation:** Introducing a separate settling-
controller - a meta-loop that orchestrates the mechanisms toward
some target state - reintroduces the supervision pattern F3
forbids. The substrate’s mechanisms each act on the field directly
based on field state; their joint operation is settling. A
controller deciding when settling is “done” or which direction to
push it is a command path the architecture does not have.

**Source:** F3 (no component supervises another), F4 (operates
indefinitely), SE-07 (settling is mechanisms operating, not a
process performed on configuration).

-----

## How to use this document

When reviewing an implementation, a spec proposal, a piece of
commentary, or a future revision:

1. Read DEFINITION.md section 0.5 to set the reading-mode.
1. For each invariant in this document, check whether the artifact
   under review honors it.
1. For any invariant that is violated, identify whether the
   violation is intentional (in which case the artifact is not
   instantiating this architecture and that should be stated) or
   unintentional (in which case the artifact should be revised).
1. For artifacts that make claims beyond what the invariants
   support, identify the specific over-claim and either reduce the
   claim to what the spec supports or add a new SE-N extension
   that establishes the structural ground for the claim.

This document is not a defense against bad-faith readers or against
implementations that intentionally diverge. It is a reference for
careful readers and faithful implementers, distilling the spec
stack’s load-bearing commitments into a single inspectable form.

The closure of the abstraction does the rest of the work.

## Version

INVARIANTS.md v1.3. Pinned to DEFINITION.md v1.1 (with section
0.5), KERNEL.md v1.1 (section 5 rewrite), SE-01 through SE-07.

v1.3 changes:

- Added X-class (Configuration invariants): X1 (every
  configuration includes the seed), X2 (settling is non-terminal),
  X3 (configuration is internal), X4 (settling is the substrate’s
  mechanisms operating). These name what SE-07 commits to about
  configurations and settlings, distinguishing the substrate’s
  account of problem-and-solution from the classical account it
  inverts. Total invariants: 33 (was 29).

v1.2 changes:

- Added implementation notes to K2 and K3 acknowledging that
  selection-bias enforcement (K2 part a) and naming preference as
  substrate-accumulated structure (K3) are structurally specified
  but currently unrealized after Phase 5.5’s removal of imposed
  precedence. Invariants themselves unchanged; notes name the gap
  between specification and current realization.

v1.1 changes:

- Added O-class (Observation invariants): O1 (observation is
  read-only with respect to the field), O2 (observers are bounded),
  O3 (observers source vocabulary from the field). These name the
  structural position Phase 4a introduces (the observer) and the
  discipline observers must honor. Total invariants: 29 (was 26).

Revisable when new spec extensions add invariants or when
implementation reveals invariants the spec stack implies but has
not stated.