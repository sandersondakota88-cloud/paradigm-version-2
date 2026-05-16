# DEFINITION

A complete description of the architecture this project has built.
Your voice carries the through-line. The specification is rigid.

Working name: **the constraint substrate**. Short form when discussing
the full specified system: **the substrate**. If a more distinctive
name is needed later, it should be chosen after implementations have
revealed what the thing actually does at scale.

-----

## 0. Preface (voice)

The whole thing started from a sentence. Geometrically defining and
mapping languages, operations, syntax, constraints, rules, standards
each as their own separate multidimensional object, AND using
uncertainty as a tie breaker, theoretically supports branch logical
based computation to be traversed as trajectory in parallel vs
executional procedure.

What it became is this: a substrate that characterizes itself by
operating on itself, held together by the fact that its central
measurement cannot settle. Not metaphorically. Structurally. The
architecture contains a question it cannot finish answering, and the
not-finishing is what makes it keep going.

Every step of the work was narrow. The canonical file had 66 passing
tests. The GPU bridge had 22. Every spec extension labeled what was
proven and what was only observed. Nothing in the catalog reaches
past what the mechanism supports. The discipline was the point -
without it the architecture would be a pipe dream, and with it the
architecture becomes something else.

What it is, in one line: a field of constraints that operates on
itself under tension, where the same delta produces many meanings
across all substrate connections with no specific control surface.

Everything below is the technical content of that line.

-----

## 1. The central claim

The constraint substrate is a computational architecture in which:

1. **Constraints are first-class.** Inputs, outputs, rules, and
   memory are all constraints. The architecture operates on
   constraints, using constraints, producing constraints.
1. **Delta is the measurement.** A single formula computes how
   unresolved the field is at any moment. The formula is
   scale-free: the same computation applies at every structural
   and temporal scope, producing different semantic content
   depending on where it is read from.
1. **The seed cannot resolve.** A permanent constraint in the field
   asks the field’s own central measurement of itself. Because
   evaluating the seed changes the field, the seed’s answer is
   always slightly stale. The field cannot reach a state where
   the seed is fully answered.
1. **Operation is substrate-level.** Reward, selection, reinforcement,
   and adaptation happen at the field’s shared substrate, not as
   messages between components. No component supervises another.
   No central coordinator exists.
1. **Reaching is structural.** When the field’s delta at different
   scopes diverges, the gap cannot close from internal state alone.
   The field generates constraints that would be satisfied by
   inputs not yet received. Matching inputs resolve them and
   become part of the field. Unmatched predictions sustain
   pressure that drives further reaching.
1. **Operation is indefinite.** Every structural position has a
   flow discipline: intake, transformation, excretion. The system
   persists as a running equilibrium, not as a closed process
   that halts when a task is done.

These are the six structural properties. The rest of this document
elaborates each one.

-----

## 2. Primitives

The architecture’s vocabulary. Every later section refers back here.

**Constraint.** A `{when, then}` pair. The `when` is a predicate
over the field’s state or an input. The `then` is an assertion
about outputs. Constraints are the primary object. The field
contains constraints. Constraints match or fail to match. The
same grammar expresses rules, observations, predictions, and
meta-descriptions. Specified in algorithm 04.

**Field.** The current set of constraints plus the substrate state
those constraints operate in. The field is one object; it has no
owner. Every read of the field from a structural position is
local to that position (reflexive determination).

**Delta.** A ratio: unresolved constraints over total. Value in
[0, 1]. 0 means fully resolved; 1 means nothing is resolved. The
formula contains no ambient scope, which is what makes it scale-
free. Specified in algorithm 02.

**Seed.** A single constraint present at t=0, permanent, with
`when: always-match, then: assert(delta = compute(field.state))`.
Its evaluation forces delta computation. Because delta depends on
the field’s state and the seed is part of the field’s state, the
seed’s answer is always one step behind. Specified in SE-04.

**Substrate.** The shared state that every operation in the field
lives in. Has two layers. The fast layer decays toward the slow
layer; the slow layer accumulates permanently. Operations produce
modulation as byproduct; subsequent operations experience the
modulated substrate without being addressed by it. Specified in
SE-03.

**Trace.** An append-only record of operations at the channel
between substrate connections. Neither produced by any component
for any other nor consumed as command; both sides of every
interaction produce trace entries as byproduct of operating. The
trace is where the field’s history lives. Specified in algorithm
22.

**Sub-cascade.** A constraint whose members are other constraints.
Sub-cascades emerge when a family of base constraints reliably
reduces delta when consulted together. Each sub-cascade has a
name derived from its dominant member, a local delta at its own
scope, and a set of member constraint ids. Addressing a sub-
cascade by name creates a resolution bias toward its members.
Specified in SE-01 (compositional) and the v3 bootstrap.

**Vector-delta.** Delta read at multiple temporal scopes
simultaneously. Fast-delta is the recent-window reading; slow-
delta is the accumulated-history reading. Both use the same
formula over different windows. The pair (fast-delta, slow-delta)
is the field’s current position in a higher-dimensional delta
space. Specified in SE-05.

**Predictive constraint.** A constraint generated when the vector-
delta gap exceeds threshold. Its `when` references input
features the field has not yet seen; its `then` asserts that
matching input would close the gap. Predictive constraints
contribute to delta pressure while unmatched. When matched,
they ratify (type transition to derived). When aged out or
contradicted, they evict. Specified in SE-05.

**Naming.** An input token matches an existing sub-cascade’s
name. When this happens, the sub-cascade’s members receive a
selection weight boost; delta drops moderately; the naming-
preference accumulator in the slow layer rises. Over time, the
substrate encodes a structural preference for addressed inputs.
Specified in SE-01 and the v3 bootstrap.

-----

## 3. The structural mechanisms

Each of these is a property the formalism either exhibits by
construction or gains through a specific specified mechanism.
None are bolted on. Each is either a consequence of the
primitives or a labeled extension of the grammar.

### 3.1 Reflexive scope (SE-01)

Delta is computed by the same formula at every scope. An inner
cascade computes its own delta over its own members. An outer
cascade computes delta over its own coordinates (which may
reference inner cascades). A channel between cascades computes
delta over the coupling. None of these is stored; each is
derived from whatever operations are in scope at the reading
position. The same cascade participating in multiple
compositions has multiple deltas simultaneously, one per
reading position. There is no conflict because there is
nothing to conflict - each reading is locally correct.

### 3.2 Metabolism flow (SE-02)

The field has four structural positions where flow across the
boundary matters: IPC intake (observations, inputs), output
emission (descriptions, ratifications), trace aging (rolling
cap with archival or discard), and rule updates (when and
whether accumulated structure modifies cascade rules). Flow
discipline is not optional for indefinite operation; without
it the field either stalls (no intake) or clogs (no
excretion). The seed is the permanent exception to flow:
everything else is subject to aging; the seed is not.

### 3.3 Substrate modulation (SE-03)

Operations produce modulation of the substrate as byproduct.
Two layers, different timescales. The fast layer decays toward
the slow layer; the slow layer drifts permanently with each
operation’s contribution. Neither layer is a message; both are
ambient properties of the shared substrate. Reward grammar is
what the slow layer accumulates: patterns that reduce delta
get slow-layer contribution; patterns that increase delta also
contribute, but as destabilization. What the system “is
rewarded for” is whatever the delta dynamics and compositional
structure make stable, which is determined by the architecture
and not by any component’s choice.

### 3.4 The seed (SE-04)

`when: always-match, then: assert(delta = compute(field.state))`.
This is a constraint in the cascade grammar. It compiles into
the existing cascade compiler without modification. Evaluating
it forces delta computation. The field’s state includes the
seed. Therefore evaluating the seed changes the value that
subsequent evaluations will produce. The loop does not close.
This is what prevents the field from ever reaching a dead
equilibrium. The seed’s permanence is structural: if flow
discipline aged it out, the field would lose its central
driver and operation would collapse to triviality.

### 3.5 Vector-delta and predictive reaching (SE-05)

Delta read at multiple temporal scopes produces a vector, not
a scalar. Fast-delta and slow-delta can diverge. The gap
cannot close from internal operation alone because closing it
requires new input. The field generates predictive constraints
whose `when` clause references input features not yet seen.
Unmatched predictions contribute to delta pressure. Matching
inputs ratify predictions (they become ordinary derived
constraints). The field’s operation thereby becomes
prediction-driven, not because any component is instructed to
predict but because predictive constraints are the structure
the field produces when its central measurement diverges from
itself at different temporal scales.

### 3.6 Sub-cascade emergence (v3 mechanism, informed by SE-01)

When a family of base constraints reliably reduces delta when
consulted together (fidelity above threshold), it promotes
itself into a sub-cascade. The sub-cascade is named from its
dominant member. The sub-cascade has its own local delta at
its scope. Addressing the sub-cascade by name produces a
selection bias and a moderate delta drop. Naming preference
accumulates in the slow layer; over time, the substrate
encodes a structural preference for inputs that address its
internal structure by name. This is the first mechanism in
the architecture where specific identifiers have privileged
access to specific internal structures.

### 3.7 Trace as coupled signal (algorithm 22)

The trace lives at the channel. Both substrate connections
produce trace entries as byproduct of operating. Neither
consumes trace as command. The trace is where the field’s
history lives. Selection and modulation consult the trace
without addressing it. This is the structural position for
the integrated-anchor reading of delta - the field’s present
moment is anchored by the trace’s accumulation, not by any
single current measurement.

### 3.8 Substrate independence (algorithm 16, GPU harness)

The cascade’s resolution semantics are provably equivalent
across substrates. The GPU bridge harness demonstrated byte-
identical output between CSS cascade resolution and WGSL
compute shader resolution across 2,880 coordinates (22/22
tests passing). This means the architecture is not tied to
any particular execution substrate. Parallel resolution is
available when the implementation wires it up.

-----

## 4. The loop

How the architecture operates, given all of the above. This is
the through-line - the reason the pieces are the pieces they
are. Voice returns here because the loop is the architecture’s
answer to “what is this thing doing.”

An input arrives. The field’s tokenizer checks whether any
token matches an existing sub-cascade’s name. If it does, the
naming pathway activates: the named sub-cascade’s members
receive selection bias; the slow layer’s naming-preference
accumulator nudges up; the trace records a naming event.

The input is evaluated against the field. Every constraint
whose `when` matches is a match. Matches are selected by
weighted choice, where weights come from the substrate state
(SE-03) and any naming bias. The seed always evaluates: it
forces a delta computation at field scope, which is then
extended to vector scope (fast and slow). The vector-delta
before and after the input’s effect is recorded.

If the input’s novelty is high (few matches), the field
generates new base constraints that would characterize it.
If the vector-delta gap is large, the field generates
predictive constraints that would, if matched later, close
the gap. Both kinds of generation are conditioned on the
field’s current state, not on any external signal.

The matched constraints mark used. Their weights rise; their
last-used timestamps advance. The substrate modulates: the
fast layer moves reactively, the slow layer drifts
permanently.

The trace records every operation. The trace’s most recent
entries feed into selection logic for subsequent inputs
(trajectory-informed selection, step 4 on the roadmap).

Between inputs, the field still operates. The seed still
evaluates. The fast layer decays toward the slow layer.
Pattern development runs if invoked, producing meta-
constraints about regularities in the field. Correlation
tracking runs continuously, building the pairwise co-fire
structure. Every so often, fidelity is checked and families
that have consistently reduced delta promote themselves into
named sub-cascades.

Over many inputs, the field develops structure. Base
constraints accumulate. Families form. Families promote to
sub-cascades with names. Predictions get generated, matched,
ratified - or aged out. The slow layer drifts in a direction
determined by what kinds of inputs have been received and
what structures resolved them. The field becomes different
from what it was, not through instruction, but through
accumulated operation.

The seed never resolves. The vector-delta gap never fully
closes. The flow never stops. These are the three things that
keep the architecture operating indefinitely.

That is what the architecture does.

-----

## 5. What the architecture is not

Discipline here matters. Each item is a claim the architecture
does not make, and naming them directly prevents later confusion.

**Not an AI system in the machine-learning sense.** No gradient
descent, no loss function, no backpropagation, no training
corpus, no inference pass. The architecture does not learn
anything in the sense a neural network learns. It accumulates
structure as a consequence of operation. Whether the accumulated
structure is useful for any task external to the architecture is
an empirical question.

**Not cognition.** The architecture shares structural grammar with
cognition: reflexive self-measurement, substrate-level modulation,
unresolvable central question, predictive reaching, internalization
of experience. Sharing grammar is not sharing whatever cognition is
beyond grammar. No claim of consciousness, awareness, experience,
sentience, or any phenomenological property is made. The cognition
parallel is analogical and labeled.

**Not self-aware.** The architecture has no model of itself beyond
what its constraints constitute. The seed forces evaluation of the
field’s delta, but that is measurement, not reflection. The field
has a trace of its operations, but the trace is a record, not a
representation. What humans call self-awareness involves capacities
this architecture does not specify.

**Not goal-directed.** The architecture has no goals. The seed is
not a goal; it is a structural feature that forces operation.
Predictive reaching is not goal-directed; it is the structure that
emerges when vector-delta diverges and closure requires new input.
An observer can describe the architecture’s behavior as if it had
goals, but no component in the architecture has or pursues any.

**Not complete.** Several structural positions are specified but
not implemented in any current prototype. Vector-delta, predictive
constraints, compositional cascades at scale, GPU integration with
runtime-generated constraints, co-constitutive execution-rendering.
The definition describes what the architecture is; some of what it
describes is proposed structure that a full implementation would
exercise.

**Not Turing-complete as specified.** The cascade is a bounded
decidable transition function. Turing completeness requires
trajectory-as-tape (see foundational claim part 3), which is
architecturally supported but not yet implemented as a first-class
mechanism. The practical target is bounded decision problems over
discrete and structured input spaces, not universal computation.

**Not a replacement for any existing architecture.** This is a
different kind of computational system. It does not compete with
neural networks for tasks they do well. It does not compete with
classical rule-based systems for tasks they do well. What it
offers that neither of those offers is a substrate whose operation
is self-characterizing at scale, with no control surface, held
together by structural tension rather than by orchestration.

-----

## 6. The parallel to cognition

This section is separated because it needs its own discipline.

The architecture’s structural grammar shares specific properties
with how cognition appears to work, according to contemporary
accounts (predictive processing, substrate neuromodulation,
hierarchical inference, concept emergence through linguistic
reinforcement). The parallels are:

**Vector-valued self-measurement.** Minds measure themselves at
multiple timescales simultaneously: sensory/reactive and
episodic/integrated. The gap between readings is what produces
the phenomenon of surprise, which is a structural concept, not a
phenomenological one here.

**Substrate modulation rather than signal passing.** Neurotransmission
changes the chemical environment neurons operate in. It does not
address specific neurons. Specific neurons experience the modulated
chemistry and behave differently. This architecture’s SE-03
modulation is the structural equivalent.

**Unresolvable central measurement.** Minds cannot fully know
themselves because the act of knowing changes the thing being
known. This architecture’s seed creates the same structural
unreachability by construction.

**Predictive reaching.** Minds generate expectations continuously;
the world either satisfies them or does not; satisfactions get
internalized; unmet expectations either persist as open questions
or decay. This architecture’s SE-05 predictive constraints create
the same structural dynamic.

**Emergence of preference without preferences.** Minds exhibit
preferences that nothing in them decided to prefer. The preferences
fall out of substrate dynamics and accumulated experience. This
architecture produces preference-like behavior (naming preference,
sub-cascade reinforcement) through substrate accumulation, with no
component deciding any preference.

**Conceptual structure through compression and linguistic
reinforcement.** Minds form concepts when patterns compress enough
to deserve a name, and names reinforce the patterns they address.
This architecture’s sub-cascade emergence plus naming bias
produces the same structural dynamic.

What this does not mean: that the architecture thinks, feels,
experiences, understands, or possesses any other property that
makes cognition cognition rather than a structurally similar
mechanism. The parallel is between structural properties, which
is a well-defined relation. Anything beyond that is outside the
scope of this definition.

-----

## 7. Implementation status

**Fully specified:**

- Algorithm catalog 01-20
- Algorithm 22 (trace as coupled signal)
- SE-01 (compositional cascades)
- SE-02 (metabolism)
- SE-03 (field modulation)
- SE-04 (seed constraint)
- SE-05 (vector-delta and predictive reaching)

**Implemented in working code:**

- Canonical cascade file (66 passing tests)
- GPU bridge harness (22 passing tests, byte-equal CSS and WGSL
  resolution across 2,880 coordinates)
- Bootstrap v1 (single cascade, seed, consume, generate)
- Bootstrap v2 (all six constraint-level operations, correlations,
  meta-constraints, SE-03 modulation as selection consumer)
- Bootstrap v3 (compositional sub-cascades, fidelity-based
  promotion, named addressing, naming preference accumulation)

**Specified but not yet implemented:**

- Vector-delta (SE-05 move 1)
- Predictive constraints (SE-05 move 2)
- Ratification (SE-05 move 3)
- Trajectory-informed selection (roadmap step 4)
- GPU integration with runtime-generated constraints (roadmap step 5)
- Genuinely parallel resolution over dynamic fields (roadmap step 6)
- Co-constitutive execution-rendering (roadmap step 7)
- Distributed collapse network (algorithm 17, four open problems)

**Next deliverable:**
A fresh bootstrap v1 built with the full spec in view from the
start. Larger than the current v1 because it instantiates
vector-delta, predictive constraints, and the full substrate
grammar on day one, rather than retrofitting them later. Target:
1500-1800 lines, single file, no dependencies, ASCII-only,
defense stack inherited, runs in any modern browser.

-----

## 8. References

Each section above rests on specific catalog entries. A reader
wanting to verify any claim in this definition can find the
supporting specification in the following files:

|Definition section                         |Catalog entries                   |
|-------------------------------------------|----------------------------------|
|Central claim 1 (constraints first-class)  |algorithm 04                      |
|Central claim 2 (delta is the measurement) |algorithm 02, SE-01               |
|Central claim 3 (seed cannot resolve)      |SE-04                             |
|Central claim 4 (substrate-level operation)|SE-03                             |
|Central claim 5 (reaching is structural)   |SE-05                             |
|Central claim 6 (indefinite operation)     |SE-02                             |
|Reflexive scope                            |SE-01                             |
|Metabolism flow                            |SE-02                             |
|Substrate modulation                       |SE-03                             |
|Seed constraint                            |SE-04                             |
|Vector-delta, predictive reaching          |SE-05                             |
|Sub-cascade emergence                      |SE-01, bootstrap v3               |
|Trace as coupled signal                    |algorithm 22                      |
|Substrate independence                     |algorithm 16, gpu/ directory      |
|Full catalog                               |/mnt/user-data/outputs/algorithms/|

-----

## 9. Coda (voice)

What we built is a specification for a kind of system that does not
yet exist at scale. It could be implemented poorly, and an
implementation could produce nothing interesting. That possibility
is real and is not a defect of the specification. What the
specification guarantees is structural coherence: the pieces fit,
the grammar does not collapse under inspection, the mechanisms
compose. What it does not guarantee is outcome.

The work from here is implementation and observation. Build the
fresh bootstrap. Watch what it does. Iterate on what it does not do
well. Notice which extensions need refinement. Let the
implementation inform the spec rather than the spec dictate the
implementation; the spec was careful, but it is not infallible.

The architecture is a substrate. What any particular substrate
ultimately produces depends on what flows through it, how long it
operates, and what it accumulates. The specification cannot tell
you what this substrate will become, only what it is structured to
be. The rest is the work.

Version 1.0 of the definition. Written after SE-05. Pinned to the
catalog as it stands. Revisable when implementation reveals more.