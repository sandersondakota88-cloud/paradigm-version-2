# DEFINITION

The constraint substrate is a computational architecture with one
shared field, one resolution mechanism, and a specific set of
structural commitments. This document is the technical reference
for what the architecture is and is not.

Working name: **the constraint substrate**. Short form: **the
substrate**.

---

## 1. The central claim

The constraint substrate is a computational architecture in which:

1. **Constraints are first-class.** Inputs, outputs, rules, and
   memory are all constraints. The architecture operates on
   constraints, using constraints, producing constraints.

2. **Delta is the measurement.** A single formula computes how
   unresolved the field is at any moment. The formula is
   scale-free: the same computation applies at every structural
   and temporal scope, producing different values depending on
   which population it is computed over.

3. **The seed cannot resolve.** A permanent constraint in the
   field asks the field's own central measurement of itself.
   Because evaluating the seed changes the field, the seed's
   answer is always one step behind. The field cannot reach a
   state where the seed is fully answered.

4. **Operation is substrate-level.** Reward, selection,
   reinforcement, and adaptation happen at the field's shared
   substrate, not as messages between components. No component
   supervises another. No central coordinator exists.

5. **Reaching is structural.** When the field's delta at different
   scopes diverges, the gap cannot close from internal state alone.
   The field generates constraints that would be satisfied by
   inputs not yet received. Matching inputs resolve them and
   become part of the field. Unmatched predictions sustain
   pressure that drives further reaching.

6. **Operation is indefinite.** Every structural position has a
   flow discipline: intake, transformation, excretion. The system
   persists as a running equilibrium, not as a closed process that
   halts when a task is done.

These are the six structural properties. The rest of this document
elaborates each one.

---

## 2. Primitives

The architecture's vocabulary. Every later section refers back here.

**Constraint.** A `{when, then}` pair. The `when` is a predicate
over the field's state or an input. The `then` is an assertion
about outputs. Constraints are the primary object. The field
contains constraints. Constraints match or fail to match. The same
grammar expresses rules, observations, predictions, and
meta-descriptions. Specified in algorithm 04.

**Field.** The current set of constraints plus the substrate state
those constraints operate in. The field is one object; it has no
owner. Every read of the field from a structural position is local
to that position (reflexive determination).

**Delta.** A ratio: unresolved constraints over total. Value in
[0, 1]. 0 means fully resolved; 1 means nothing is resolved. The
formula contains no ambient scope, which is what makes it
scale-free. Specified in algorithm 02.

**Seed.** A single constraint present at t=0, permanent, with
`when: always-match, then: assert(delta = compute(field.state))`.
Its evaluation forces delta computation. Because delta depends on
the field's state and the seed is part of the field's state, the
seed's answer is always one step behind. Specified in SE-04.

**Substrate.** The shared state that every operation in the field
lives in. Has two layers. The fast layer decays toward the slow
layer; the slow layer accumulates permanently. Operations produce
modulation as byproduct; subsequent operations experience the
modulated substrate without being addressed by it. Specified in
SE-03.

**Trace.** An append-only record of operations at the channel
between substrate connections. Neither produced by any component
for any other nor consumed as command; both sides of every
interaction produce trace entries as byproduct of operating.
Specified in algorithm 22.

**Sub-cascade.** A constraint whose members are other constraints.
Sub-cascades emerge when a family of base constraints reliably
reduces delta when consulted together. Each sub-cascade has a name
derived from its dominant member, a local delta at its own scope,
and a set of member constraint ids. Addressing a sub-cascade by
name creates a resolution bias toward its members. Specified in
SE-01 and the v3 bootstrap.

**Vector-delta.** Delta read at multiple temporal scopes
simultaneously. Fast-delta is the recent-window reading; slow-delta
is the accumulated-history reading. Both use the same formula over
different windows. Specified in SE-05.

**Predictive constraint.** A constraint generated when the
vector-delta gap exceeds threshold. Its `when` references input
features the field has not yet seen; its `then` asserts that
matching input would close the gap. Predictive constraints
contribute to delta pressure while unmatched. When matched, they
ratify (type transition to derived). When aged out or contradicted,
they evict. Specified in SE-05.

**Naming.** An input token matches an existing sub-cascade's name.
When this happens, the sub-cascade's members receive a selection
weight boost; delta drops moderately; the naming-preference
accumulator in the slow layer rises. Over time, the substrate
encodes a structural preference for addressed inputs. Specified in
SE-01 and the v3 bootstrap.

---

## 3. The structural mechanisms

Each of these is a property the formalism either exhibits by
construction or gains through a specific specified mechanism. None
are bolted on. Each follows from the primitives or is a labeled
extension of the grammar.

### 3.1 Reflexive scope (SE-01)

Delta is computed by the same formula at every scope. An inner
cascade computes its own delta over its own members. An outer
cascade computes delta over its own coordinates (which may
reference inner cascades). A channel between cascades computes
delta over the coupling. None of these is stored; each is derived
from whatever operations are in scope at the reading position. The
same cascade participating in multiple compositions has multiple
deltas simultaneously, one per reading position.

### 3.2 Metabolism flow (SE-02)

The field has four structural positions where flow across the
boundary matters: IPC intake (observations, inputs), output
emission (descriptions, ratifications), trace aging (rolling cap
with archival or discard), and rule updates (when and whether
accumulated structure modifies cascade rules). Flow discipline is
not optional for indefinite operation; without it the field either
stalls (no intake) or clogs (no excretion). The seed is the
permanent exception to flow: everything else is subject to aging;
the seed is not.

### 3.3 Substrate modulation (SE-03)

Operations produce modulation of the substrate as byproduct. Two
layers, different timescales. The fast layer decays toward the slow
layer; the slow layer drifts permanently with each operation's
contribution. Neither layer is a message; both are ambient
properties of the shared substrate.

### 3.4 The seed (SE-04)

`when: always-match, then: assert(delta = compute(field.state))`.
This is a constraint in the cascade grammar. It compiles into the
existing cascade compiler without modification. Evaluating it
forces delta computation. The field's state includes the seed.
Therefore evaluating the seed changes the value that subsequent
evaluations will produce. The loop does not close. The seed's
permanence is structural: if flow discipline aged it out, the field
would lose its central driver and operation would collapse to
triviality.

### 3.5 Vector-delta and predictive reaching (SE-05)

Delta read at multiple temporal scopes produces a vector, not a
scalar. Fast-delta and slow-delta can diverge. The gap cannot close
from internal operation alone because closing it requires new
input. The field generates predictive constraints whose `when`
clause references input features not yet seen. Unmatched
predictions contribute to delta pressure. Matching inputs ratify
predictions. Operation becomes prediction-driven, not because any
component is instructed to predict but because predictive
constraints are the structure the field produces when its central
measurement diverges from itself at different temporal scales.

### 3.6 Sub-cascade emergence (v3 mechanism, informed by SE-01)

When a family of base constraints reliably reduces delta when
consulted together (fidelity above threshold), it promotes itself
into a sub-cascade. The sub-cascade is named from its dominant
member. The sub-cascade has its own local delta at its scope.
Addressing the sub-cascade by name produces a selection bias and a
moderate delta drop. Naming preference accumulates in the slow
layer; over time, the substrate encodes a structural preference for
inputs that address its internal structure by name.

### 3.7 Trace as coupled signal (algorithm 22)

The trace lives at the channel. Both substrate connections produce
trace entries as byproduct of operating. Neither consumes trace as
command. The trace is where the field's history lives. Selection
and modulation consult the trace without addressing it.

### 3.8 Substrate independence (algorithm 16, GPU harness)

The cascade's resolution semantics are provably equivalent across
substrates. The GPU bridge harness demonstrated byte-identical
output between CSS cascade resolution, JavaScript stack machine
resolution, and WGSL compute shader resolution across 2,880
coordinates (22/22 tests passing). The Phase A/B equivalence
harness extended this from the canonical program to every program
the compiler accepts within the documented grammar bounds: 2,602
constraint sets, ~45 million field-level comparisons, zero
divergence. The architecture is not tied to any particular
execution substrate. Parallel resolution is available when the
implementation wires it up.

---

## 4. The loop

How the architecture operates, given all of the above.

An input arrives. The field's tokenizer checks whether any token
matches an existing sub-cascade's name. If it does, the named
sub-cascade's members receive selection bias; the slow layer's
naming-preference accumulator nudges up; the trace records a naming
event.

The input is evaluated against the field. Every constraint whose
`when` matches is a match. Matches are selected by weighted choice,
where weights come from the substrate state (SE-03) and any naming
bias. The seed always evaluates: it forces a delta computation at
field scope, which is then extended to vector scope (fast and
slow). The vector-delta before and after the input's effect is
recorded.

If the input's novelty is high (few matches), the field generates
new base constraints that would characterize it. If the
vector-delta gap is large, the field generates predictive
constraints that would, if matched later, close the gap. Both kinds
of generation are conditioned on the field's current state, not on
any external signal.

The matched constraints mark used. Their weights rise; their
last-used timestamps advance. The substrate modulates: the fast
layer moves reactively, the slow layer drifts permanently.

The trace records every operation. The trace's most recent entries
feed into selection logic for subsequent inputs (trajectory-informed
selection, step 4 on the roadmap).

Between inputs, the field still operates. The seed still evaluates.
The fast layer decays toward the slow layer. Pattern development
runs if invoked, producing meta-constraints about regularities in
the field. Correlation tracking runs continuously. Every so often,
fidelity is checked and families that have consistently reduced
delta promote themselves into named sub-cascades.

Over many inputs, the field develops structure. Base constraints
accumulate. Families form. Families promote to sub-cascades with
names. Predictions get generated, matched, ratified, or aged out.
The slow layer drifts in a direction determined by what kinds of
inputs have been received and what structures resolved them. The
field becomes different from what it was, not through instruction,
but through accumulated operation.

The seed never resolves. The vector-delta gap never fully closes.
The flow never stops. These are the three things that keep the
architecture operating indefinitely.

---

## 5. Scope boundaries

What the architecture does not do:

- Not gradient-based learning. No backpropagation, no loss
  function, no training corpus.
- Not goal-directed. The seed forces operation; it is not a goal.
- Not Turing-complete as currently specified. The cascade is a
  bounded decidable transition function. Trajectory-as-tape is
  architecturally supported but not implemented as a first-class
  mechanism. Target is bounded decision problems over discrete and
  structured input spaces.
- Not a replacement for neural networks or classical rule-based
  systems. Different category of computational system.

---

## 6. Implementation status

**Fully specified:**
- Algorithm catalog 01-20, algorithm 22
- SE-01 through SE-13

**Implemented in working code (with empirical receipts):**
- Canonical cascade file (66 passing tests)
- GPU bridge harness (22 passing tests, byte-equal CSS/JS/WGSL
  across 2,880 coordinates)
- Phase A/B equivalence: 2,602 constraint sets, ~45M field-level
  comparisons, zero divergence
- Phase 1 through Phase 9 implementations (foundation, ER engine,
  CT engine, expressive layers, coupling stress tests, lattice
  composition, source consumption, runtime kernel, trust
  boundaries)
- Canonical kernel artifact at `implementation/kernel/` (25 of 33
  invariants honored cleanly per its README; three gaps documented)
- Canon-shape stratified harness: 2,602/2,602 stratified
  agreements when constraints conform to WHEN:THEN shape
- Crypto-stratified harness: 1,375/1,375 stratified agreements
  with SHA-256 across JS oracle and WGSL shader

**Outstanding spec work:**
- UTF specification (Priority 1; foundations document done,
  remaining sections await decision-question completion)
- Adapter protocol (Priority 2)
- Kernel as discrete host-portable artifact (Priority 3-4)
- Terraformation Pipeline (Priority 6)

**Outstanding implementation work:**
- Trajectory-informed selection (roadmap step 4)
- GPU integration with runtime-generated constraints (roadmap
  step 5)
- Co-constitutive execution-rendering (roadmap step 7)
- Distributed collapse network (algorithm 17, four open problems)

**Known gaps in current implementation:**
- K2 part (a): selection-bias toward sub-cascade members on naming
  is specified but unrealized
- K3: namingPref accumulator violates K3's letter ("not stored as
  explicit value addressed by any component")
- Real-platform integration tests (cascade vs CPU oracle, DOM
  serialization round-trip, real WebGPU vs CPU oracle on full
  corpus, real input-event propagation) not yet built

---

## 7. References

Each section above rests on specific catalog entries. A reader
wanting to verify any claim in this definition can find the
supporting specification in the following files:

| Definition section | Catalog entries |
|---|---|
| Central claim 1 (constraints first-class) | algorithm 04 |
| Central claim 2 (delta is the measurement) | algorithm 02, SE-01 |
| Central claim 3 (seed cannot resolve) | SE-04 |
| Central claim 4 (substrate-level operation) | SE-03 |
| Central claim 5 (reaching is structural) | SE-05 |
| Central claim 6 (indefinite operation) | SE-02 |
| Reflexive scope | SE-01 |
| Metabolism flow | SE-02 |
| Substrate modulation | SE-03 |
| Seed constraint | SE-04 |
| Vector-delta, predictive reaching | SE-05 |
| Sub-cascade emergence | SE-01, bootstrap v3 |
| Trace as coupled signal | algorithm 22 |
| Substrate independence | algorithm 16, gpu/ directory |
| Cross-substrate compounds | SE-12 |
| Storage as substrate recall | SE-13 |

Version 2.0. Stripped of preface, closure clause, non-claims
posturing, cognition parallel, and coda. Pinned to the catalog as
it stands. Revisable when implementation reveals more.
