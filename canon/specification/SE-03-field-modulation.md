# SE-03 - Field Modulation (Reward as Substrate Grammar)

**Type:** Specification extension
**Status:** OBSERVATIONAL. Names the substrate-level grammar the
architecture uses in place of component-level reward mechanisms.
**Primary origin:** conversation April 2026, arising from the question
of what structurally corresponds to chemistry in a cognition-parallel
system, and the discipline that rejected per-cascade / per-composition
decisions in favor of reflexive determination.
**Secondary origin:** SE-01 (scale-free compositionality), SE-02 (flow
at the boundary), algorithm 22 (delta-trace coupling) - each established
a substrate-level grammar this extension continues rather than
deviates from.
**Implemented in:** nothing yet.

---

## What this extension does

It names the grammar of reward in the architecture. The grammar is
substrate-level, not component-level. It does not describe a reward
system, a reward signal, a reward function, or a reward component.
It describes field modulation - a property of the shared substrate
that operations produce as byproduct and that other operations read
in context.

Like SE-01 and SE-02, this extension names a property the formalism
already supports, so that other entries can rely on it without
re-deriving the grammar.

## Why substrate-level and not component-level

The reward-system frame from classical machine learning specifies
three things: a source that emits a signal, a target that receives
it, a mechanism that updates the target's behavior based on the
signal. Source, target, mechanism - three architectural decisions.

Each of these decisions reintroduces the pattern the rest of the
architecture rejects. A source is a driver. A target is a driven
element. A mechanism is a command path. Adopting this frame would
erase the gravity-anchor reading of delta, the byproduct-signal
reading of algorithm 22, the neither-driven coupling that SE-01 and
SE-02 presuppose.

Biological systems do not use this frame. In a real brain, reward
is chemistry - substance released into the ambient environment that
modulates how subsequent operations happen. No neuron is addressed.
No command is sent. The substrate is altered and every component
operating in that substrate experiences the alteration. The reward
is not information passing between components; it is a property of
the space the components operate in.

This extension adopts the same grammar. Reward in this architecture
is a property of the field - the shared substrate every cascade
resolution, every trajectory step, every composition operates in.
Operations modulate the field as byproduct of happening. Subsequent
operations happen in the modulated field and produce different
consequences than they would have in an unmodulated field. No
operation addresses another. No component decides what to reward.
The system's coupled behavior over time emerges from the field's
state, which emerges from the operations' history.

## Two layers

The field has two layers, operating at different timescales, sharing
the same substrate:

### Fast layer (modulation with decay)

The fast layer is reactive. Operations produce modulation as they
happen. The modulation is experienced by subsequent operations in
the same neighborhood of the field. The modulation decays over time,
recovering toward the baseline.

Decay is essential. Without decay, modulation accumulates in the
reactive layer and every operation experiences maximum modulation,
which eliminates the layer's ability to distinguish recent events
from distant ones. With decay, the fast layer is sensitive to
near-term history and progressively forgets distant history.

The decay rate is an empirical parameter per implementation, not
specified here. What the specification fixes is that decay exists
and is toward the baseline - not toward zero, toward whatever the
baseline currently is.

### Slow layer (baseline accumulation)

The baseline itself moves. Every operation contributes, through its
modulation of the fast layer, a small permanent change to the
baseline. The slow layer accumulates what the fast layer has been
doing, integrated across the system's full operational history.

The slow layer does not decay. Permanent accumulation is the feature
that separates this architecture from pure-decay reward systems.
Without it, two instances of the system with identical constraints
and identical current inputs would produce identical outputs
regardless of their operational histories. With it, history shapes
the substrate, and the substrate shapes what operations mean.

The slow layer is not stored as content. It is not a retrievable
record of what happened. It is a transformation that what-happened
performed on the substrate. Two systems with identical fast-layer
states but different slow-layer histories have different baselines
and therefore different subsequent behavior, even though neither
system can enumerate the history that produced the difference.

### How the layers relate

Fast-layer modulation recovers toward the current baseline, not
toward a fixed constant. The current baseline is the integrated
effect of all past fast-layer activity at the appropriate scope.
The layers operate at different timescales on the same field. An
operation at the fast layer produces a small, permanent contribution
to the slow layer in the same moment it produces a large, decaying
contribution to the fast layer.

## Reflexive determination

The slow layer is not stored per-cascade. It is not stored per-
composition. It is not stored anywhere as a separate object.

The baseline at any structural position is a reflexive derivation
from the operations at that position. A read of the baseline from
inside an inner cascade returns the baseline derivable from that
cascade's operation history. A read from an outer cascade returns
the baseline derivable from operations at that outer scope -
operations that are about compositions, not about the contents of
constituent cascades. A read from a coupling between cascades
returns the baseline of that coupling's interactions.

Same field. Same formula. Different scope of read produces
different baseline content, because different operations are in
scope at different positions.

This is the same grammar SE-01 established for delta's scale-free
formula and algorithm 22 established for the trace living at the
channel. The baseline does not belong to any component. It is what
each structural position sees when it reads the field from where it
stands.

Specifically: a cascade participating in multiple compositions
simultaneously has multiple baselines simultaneously, one per
reading position. No conflict, no inheritance rule, no propagation
mechanism. Each reading is locally correct because it derives from
that reading's scope, and no reading interferes with any other.

## What modulation looks like structurally

Modulation is a change in the field's state that alters how
subsequent operations at that position produce their outputs. The
specification does not fix the mechanism of alteration; an
implementation may realize modulation as probability shifts,
selection biases, attention weights, or gradient biases in any
optimization step. What the specification fixes is:

1. **Modulation is produced as byproduct.** No operation exists
   whose purpose is to produce modulation. Operations happen for
   their own reasons (cascade resolution, trajectory step,
   composition); modulation is what their happening does to the
   field.

2. **Modulation is local to structural position.** An operation at
   position X modulates the field at position X. Readers at other
   positions do not see this modulation directly; they see whatever
   the field at their own position has accumulated.

3. **Modulation is unaddressed.** No target component receives the
   modulation. Every subsequent operation at the same position
   experiences it without the modulation being intended for any of
   them.

4. **Modulation is cumulative across layers differently.** Fast-layer
   modulation decays; slow-layer contribution persists. A single
   operation produces both effects.

## What determines whether an operation is "rewarded"

The RL-textbook question "what gets rewarded" assumes a reward
function that assigns scalar value to operations. This extension
rejects that framing. There is no reward function. There is no
scalar being assigned.

What happens instead: operations produce modulation whose character
is determined by the delta-dynamics of the operation (algorithm 22)
and by the compositional context (SE-01). Operations that reduce
delta along their trajectory produce modulation that stabilizes the
field in the direction of that reduction. Operations that increase
delta produce modulation that destabilizes. Compositional coherence
(constituents producing mutually-consistent outputs) produces
stabilizing modulation; compositional incoherence produces
destabilizing modulation.

None of this is a reward decision. It is structural consequence of
how modulation emerges from operation. The system is "rewarded for"
whatever the delta-dynamics and compositional structure make stable,
which is determined by the architecture itself and not by any
component's choice.

This means the system cannot be instructed to value something the
architecture does not structurally stabilize. It also means the
system will develop whatever preferences the delta-trace and
composition structure produce, whether or not an external observer
considers those preferences correct. This is a feature in the
narrow-claim sense (the system is self-organizing and not
externally-driven) and a research question in the wide-claim sense
(whether the preferences that emerge are useful depends on the
architecture and domain).

## Non-claims

This extension does **not** claim:

- That the system exhibits reward-seeking behavior in any
  cognitive-science or behavioral sense. The structural grammar of
  modulation is named; whether observed behavior resembles
  reward-seeking is an empirical question per implementation.

- That field modulation produces learning in the machine-learning
  sense. Modulation can shift operation outcomes; whether this
  constitutes learning depends on what one means by learning.
  Connectionist backprop, symbolic rule revision, and substrate
  modulation are distinct mechanisms; only the third is specified
  here.

- That the baseline can be read as content. The slow layer is not a
  record, a history, a log, or a memory in any retrievable sense.
  It is a transformation of the substrate. Reads return the current
  baseline; no read returns the sequence of operations that produced
  it.

- That decay rates, modulation magnitudes, or baseline drift rates
  are specified. These are empirical parameters per implementation.
  The specification fixes the grammar, not the numbers.

- That the slow layer is literally permanent. Flow discipline (SE-02)
  applies here as everywhere: a system that operates indefinitely
  must have some treatment of aged substrate state, or it saturates.
  Whether aged slow-layer contributions decay on very long
  timescales, are archived and removed, or saturate at ceilings, is
  an implementation choice not forced by this extension.

- That this architecture is equivalent to human reward chemistry.
  It shares a structural grammar with it - substrate modulation,
  ambient rather than addressed, reflexively determined - and no
  more than that.

## Relationship to the cognition parallel

This session has consistently pointed at human cognition as a
structural reference without claiming the architecture IS cognition.
SE-03 is where that reference pays the most specific dividend.

Biological reward chemistry has properties that component-level ML
reward systems lack: it is ambient rather than addressed, it acts
at two timescales simultaneously, it modulates substrate rather than
components, and it produces system-level behavioral shifts without
any component deciding to shift. These are the properties SE-03
adopts.

The architecture is not cognition. It does share, with cognition,
the structural grammar that makes cognition's reward-chemistry
behavior possible. The foundational claim's wider readings depend on
the architecture being capable of substrate-level modulation. SE-03
documents that the formalism permits this without architectural
changes, because substrate modulation is a property of how the field
is used, not a new object to be added.

## References to catalog entries

Algorithms whose content is relevant to the grammar documented here:

- **Algorithm 02** (delta computation) - Delta dynamics determine
  what modulation an operation produces. Reducing delta produces
  stabilizing modulation; increasing delta produces destabilizing
  modulation. This is the mechanism by which operations have
  "reward character" without a reward function existing.

- **Algorithm 03** (delta_IPC channel fidelity) - Cross-side delta
  contributes to modulation at the coupling position. Operations
  that improve channel fidelity modulate the coupling field
  stabilizing; operations that degrade it modulate destabilizing.

- **Algorithm 04** (constraint compilation) - Rule firing at
  resolution is unchanged by SE-03. Modulation happens to the field
  in which rules fire, not to the rules themselves. A modulated
  field produces different downstream trajectory continuations from
  the same rule-firing pattern, which is how modulation shifts
  behavior without changing rules.

- **Algorithm 12** (synchronous logged IPC) - The channel is the
  position where coupling-level modulation happens. SE-03 does not
  require changes to the IPC mechanism; it observes that modulation
  at the channel level is a reflexive read from that position.

- **Algorithm 13** (content-addressing and Merkle) - Integrity
  guarantees apply to committed content. Substrate state (field
  modulation) is not committed content; it is a property of the
  substrate. SE-03 does not expand Merkle scope.

- **Algorithm 16** (GPU postfix stack machine) - The substrate-
  independence of cascade resolution is preserved. A modulated field
  on CSS and a modulated field on GPU produce the same downstream
  behavior given the same modulation state, because the modulation
  affects selection and weighting, not rule semantics.

- **Algorithm 17** (distributed collapse network) - Cross-node field
  state is an unaddressed question in SE-03. A distributed system
  has substrate-level questions this extension does not resolve:
  whether nodes share baseline, how inter-node operations modulate,
  how consensus on modulation state (if needed) is reached. Named
  as open, not solved.

- **Algorithm 22** (delta-trace as coupled signal) - The trace is
  the record of what happened; the baseline is a transformation of
  the substrate produced by what happened. Trace and baseline are
  related but distinct: trace can be enumerated and aged; baseline
  cannot be enumerated and does not age in the same way. Operations
  produce both simultaneously.

- **SE-01** (compositional cascades) - Reflexive determination of
  baseline at each structural position relies directly on SE-01's
  compositional grammar. A cascade that participates in multiple
  compositions has multiple baselines because it has multiple
  structural positions; this follows immediately from SE-01 without
  additional specification.

- **SE-02** (metabolism) - Flow discipline applies to field
  modulation as it applies to all long-timescale system state. An
  indefinite-operation implementation has to treat aged slow-layer
  contributions through the same flow grammar SE-02 establishes for
  other accumulating state. SE-03 does not resolve what aged
  modulation does; it names the position where the question lives.

## Version

SE-03 v1.0, pinned to the algorithm catalog as of this writing.
Revises only by addition; no existing entry is modified by this
document. Extends the OBSERVATIONAL category established by SE-01
and SE-02.
