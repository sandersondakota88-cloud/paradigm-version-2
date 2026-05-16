# SE-08 - Render-Substrate Intake (the rendering substrate as continuous observation surface for sensor input)

**Type:** Specification extension
**Status:** OBSERVATIONAL. Names a structural property the formalism
already supports across SE-06 (substrate duality), algorithm 16
(substrate independence), SE-01 (scale-free reflexive scope), and
the F3/S1/S3 invariant cluster, but did not make explicit. Does not
add new mechanism; names where high-rate input enters the
architecture and how it is observable from outside ER.

**Primary origin:** conversation April 2026, in the input-stream
design exchange following SE-06 / IMPLEMENTATION_PATH Phase 4.
The articulation arrived from the observation that ER is the
continuously-resolved observation surface for input, and that CT
samples that surface at its own clock - which collapses
“intake-then-evaluate-then-observe” into a single substrate-level
activity from any position outside ER. The reframing is
representational; the mechanical consequence is that CT’s existing
input-op path (`_opInput`) is not load-bearing for the architecture’s
intake position and can be retired.

**Secondary origin:** the rate analysis in the same exchange. Audio
at 48kHz feature rates and video at 30-60Hz frame rates exceed any
sequential queue’s metabolism by orders of magnitude. SE-06 had
already named the parallel/sequential duality; SE-08 names the
intake position that follows from taking that duality seriously
where rate matters most.

**Implemented in:** nothing yet. Implementation requires retiring
CT-side intake (refactoring `_opInput`), adding a render-substrate
input-feature buffer to shared field state, and writing per-modality
adapters that contribute to that buffer. This document specifies the
property; a future implementation exercises it.

-----

## The simple version

Sensor input enters the field at the rendering substrate. Sensor
adapters write per-frame feature records to a shared input buffer.
ER reads the buffer alongside the live constraint set in its
existing parallel resolution pass. Match results land in shared
field state. CT samples shared field state on its own clock and
observes whatever ER currently shows.

From CT’s reading position, intake and evaluation do not decompose.
There is no “frame is ready” event, no synchronization primitive, no
protocol. There is the field as currently observable. ER is the
locality where input-as-feature-stream and field-state-as-sampleable
coincide; SE-08 names that locality and the consequences of locating
intake there.

-----

## What this extension does

It names the structural position of input intake under SE-06’s
substrate duality, and articulates the consequence: CT’s
observation of input is not “CT receives input” but “CT samples a
shared field whose state ER is continuously updating from the
input world.” The two phrasings describe the same mechanism only
if SE-06 is taken seriously; pre-SE-06 readings (where CT owns
the intake op queue) treat them as different.

It does not add new opcodes, new shader bindings, new constraint
kinds, or new metabolism positions. It names which substrate
sensor adapters write to, names what is observable from the other
substrate, and names what becomes a bookkeeping question internal
to CT (rather than an architectural question across the spec
stack) once intake leaves CT.

It supersedes the implicit reading that intake is a CT
responsibility. That reading was correct for the text-only,
human-paced implementations through Phase 4, where the only
intake source produced one event per multiple seconds and CT’s
op queue was a sufficient metabolism. It is not correct for
multi-modal sensor input, where the rate argument forces the
issue and SE-06’s parallel substrate is the only structurally
honest answer.

-----

## The structural commitment

**Render-substrate intake.** Sensor adapters contribute to a
shared input-feature record that lives at the field. The record
is part of the substrate (S1: substrate is shared, owned by
neither). Adapters are contributors, not engines; they do not
hold authoritative copies; they do not coordinate with ER beyond
writing to the shared record on their own clock.

**ER reads the record per resolution pass.** ER’s existing
parallel evaluation reads constraints + the current input record
and produces match results, exactly as it does today. The only
change is the source of the input record: today CT writes it
during `_opInput`; under SE-08 sensor adapters write it
continuously. Resolution semantics are unchanged.

**CT samples shared field state.** CT runs its sequential ops on
its own clock. Its observation of input arrives implicitly as
state changes in the field: match flags flip, ratification counts
increment, novelty patterns appear. CT does not “process input
ops”; it processes field-state observations. The op kind
`OP_KIND.INPUT` either retires or becomes a thin reaction-to-
observed-novelty kind that does not own intake.

**Trace records intake at the channel.** Per M5, trace lives at
the channel. Sensor adapter writes are intake events at the
boundary; they produce trace entries when ER’s resolution pass
observes them as match-flag changes. The trace does not record
adapter-internal events. This preserves M5’s commitment that the
trace is byproduct-of-operating, not push-from-source.

-----

## Why the formalism already supports this

Each piece of SE-08 is a consequence of a prior commitment:

**Algorithm 16** establishes that constraint resolution semantics
are substrate-independent. The same compiled instruction stream
resolves byte-identically across CSS cascade, JS stack machine,
and WGSL compute shader. SE-08 chooses the rendering substrate as
the locus of resolution-with-input; algorithm 16 is the existence
proof that this choice does not change what resolution computes.

**SE-06** establishes that rendering and execution are two
substrate connections to one field, coupled through delta. SE-06
named what each substrate is suited for: render is parallel and
ambient, execution is sequential and transactional. SE-08 follows
the implication: continuous high-rate input matches the parallel-
and-ambient profile, not the sequential-and-transactional one.
Locating intake at ER is not a new commitment; it is naming where
SE-06’s logic was already pointing.

**SE-01** establishes scale-free reflexive scope. Delta over the
input-feature buffer (a population of feature tokens or feature
values) is a valid scope under SE-01 by construction. No new
formula is needed; the existing formula applies wherever a
population can be named.

**S1, S3, F3** together establish that the input-feature buffer
can be a contribution to shared substrate, read by ER, observable
to CT, with no command path between adapter and engine and no
engine commanding another. SE-08 does not introduce supervision;
it names where in the existing no-supervision graph the input
arrives.

The phrase “OBSERVATIONAL extension” applies in its strict sense:
SE-08 articulates a property of the existing formalism, not a
mechanism added to it.

-----

## Invariants this extension stresses

These are the load-bearing invariants implementations must honor
under SE-08. None are violated by the spec; all are exposed to a
new failure surface that earlier specs did not expose.

### S1. Substrate is shared, owned by neither.

**How SE-08 stresses S1:** The input-feature buffer is a new
shared resource. Implementations must treat it as substrate, not
as adapter-owned state copied to ER. If adapters hold their own
buffer and “send” it to ER, S1 is violated and the architecture
splits into private adapter fields with synchronization. The
correct reading is that adapters write to substrate; ER reads
substrate; neither owns.

**Failure mode:** double-buffering schemes that introduce a
“current frame” owned by the adapter and a “presented frame”
owned by ER. This is the wrong shape; the buffer is one buffer
and concurrent writes/reads are a property of the substrate, not
a synchronization problem.

### S3. Rendering and execution couple through delta only.

**How SE-08 stresses S3:** With CT no longer owning intake, S3
is the entire mechanism by which CT learns about input. Delta
read at execution scope by CT is the only signal that input has
changed; match-flag observations are the only data that input
produced anything. If implementations introduce any other
coupling - an “input arrived” event that wakes CT, a callback
from ER on match, a shared scheduler that aligns ER frames with
CT op-steps - S3 is violated and SE-06 reduces to “renderer with
a backend.”

**Failure mode:** the urge to add a frame-sync primitive so CT
“doesn’t miss” inputs. CT does not miss inputs; it samples at
its own clock. Whatever it samples is what it observes.
Determinism here is the architecture’s, not a scheduler’s.

### F3. No component supervises another.

**How SE-08 stresses F3:** Sensor adapters now write to substrate
on their own clocks. The temptation to make them respect ER’s
frame boundary, or to wake ER when a high-priority input arrives,
introduces supervision in both directions. The discipline is that
adapters write when their source produces; ER reads when its
resolution pass runs; each operates on its own clock; the field
is the only coordination.

**Failure mode:** “the audio adapter notifies ER when a voice
event is detected, so ER can prioritize that frame.” This is
supervision. Audio writes to substrate; ER’s next resolution
pass sees what is in substrate; CT’s next sample sees what ER
has produced. No notification.

### F2. Delta is one formula at every scope.

**How SE-08 stresses F2:** A render-scope delta computed over the
input-feature population is a new reading of an existing formula.
Implementations must use the same formula as for any other scope -
unresolved-plus-stale-half over population size - not a modality-
specific or input-specific variant. The temptation is real
because feature tokens are easy to count differently than
constraints; the discipline is that they are a population and the
formula does not care what the population is made of.

**Failure mode:** a “feature freshness” metric that treats input-
feature delta as how-recent-features-arrived rather than how-
unresolved-the-feature-population-is. This is a different
quantity, and using “delta” for it is a vocabulary collision that
violates F2.

### M5. Trace lives at the channel.

**How SE-08 stresses M5:** With sensor adapters writing to
substrate continuously, naive implementations may write trace
entries from inside the adapter (“adapter frame N committed”),
which moves the trace away from the channel and into the source.
The discipline is that adapter writes are not trace events; the
trace fires when ER’s resolution pass observes a state change
worth recording - a match flag flip, a ratification, a render-
scope delta movement past a threshold. The trace remains
byproduct-of-operating at the channel where ER’s evaluation
becomes observable to CT.

**Failure mode:** rich adapter logging that becomes the trace.
This loses the “neither produced for the other, neither consumed
as command” property M5 inherits from algorithm 22.

### O1. Observation is read-only with respect to the field.

**How SE-08 stresses O1:** Sensor adapters are not observers in
the O1 sense. They are contributors - they write to substrate.
This is correct under S1 (substrate is shared) and is not a
violation of O1 (which constrains what observers do). But the
distinction must be maintained explicitly because the reflexive
surface is an observer (read-only) and the sensor adapter is a
contributor (writes substrate) and they look superficially
similar in a code review. Naming the distinction prevents future
adapters from drifting into observer territory or future
observers from drifting into contributor territory.

**Failure mode:** a sensor adapter that writes a derived “summary
clause” into the reflexive surface’s clause buffer. This blurs
contributor and observer roles; it is the wrong shape.

### I3. Bounded everything.

**How SE-08 stresses I3:** Sensor input rates can swamp. The
input-feature buffer needs explicit caps just as `CT_OP_QUEUE_CAP`
caps the CT op queue. Per-frame feature-token counts, per-
modality buffer sizes, ER feature-buffer storage allocations -
all bounded by frozen config, all enforced by adapter-side
backpressure (which reads buffer occupancy from substrate and
self-throttles, per F3 and SE-02 metabolism).

**Failure mode:** unbounded growth of the feature buffer as input
rate increases beyond ER’s resolution rate. Backpressure must be
substrate-readable and adapter-respected.

-----

## Consequences for implementation

**Retirement of CT intake op.** CT’s `_opInput` is refactored: it
either retires entirely (replaced by reactive ops triggered by
observed field-state deltas) or shrinks to a host-side glue
function that exists only for compatibility with text-only
input during the migration. Either is honest; the decision is a
migration choice, not a structural one.

**New module: input-feature buffer.** Lives in `field.js` as
shared state. Has bounded capacity per I3. Adapters write to it;
ER reads it; CT does not write it (CT writes constraints into
the field, which ER then evaluates against the buffer’s contents,
which is a different surface).

**Per-modality adapters.** Each writes the same buffer with its
own vocabulary prefix (continuing the marker discipline from the
channels conversation). Adapters do not call into engines. They
read substrate to determine backpressure; they write substrate
when their source produces; they own no other state visible to
the architecture.

**Shader bindings.** ER’s compute pipeline gains a binding for
the input-feature buffer. Under Path A (token-projected
modalities), the buffer is a token-set per frame and existing
opcodes work unchanged. Under a future Path B (native feature
matching), new opcodes and bindings are required and a separate
SE-N entry should specify them.

**S2 verification.** Whatever changes to ER’s resolution pass
must remain byte-identical with the CPU oracle. The Phase 2
verification harness extends to cover the new buffer binding.
This is non-negotiable and is the reason CPU oracle and shader
must be updated in lockstep.

-----

## What this extension does not claim

**Not a multi-modal feature-matching specification.** SE-08 says
sensor input enters at ER. It does not say what features each
modality should produce, what opcodes can match against feature
vectors, or how audio and video should be tokenized. Those are
implementation choices (Path A) or future spec extensions
(Path B). SE-08 is silent on them.

**Not a frame-clock specification.** SE-08 does not commit to a
single shared clock for all modalities. Whether audio adapter
and video adapter write to one buffer that ER samples on a video
vsync, or whether each modality has its own ER pass on its own
clock, is a design decision at the implementation layer. SE-08
is compatible with both.

**Not a claim about real-time guarantees.** ER runs at whatever
rate the substrate allows. Browsers, GPUs, and shared hosts do
not provide hard real-time guarantees. SE-08 does not promise
that every sensor input will be observed; it commits to the
property that whatever is observed is observed via shared
substrate, with no protocol, on each substrate’s own clock.

**Not a replacement for SE-06.** SE-08 is downstream of SE-06.
If SE-06 is read incorrectly (e.g., as “two engines with a
message bus”), SE-08 cannot rescue it; the corruption is upstream.
SE-08 inherits SE-06 and falls if SE-06 is misread.

-----

## References

- DEFINITION.md section 0.5 (closed abstraction; reading mode)
- SE-01 (compositional cascades / scale-free reflexive scope)
- SE-02 (metabolism / flow discipline at intake)
- SE-06 (substrate duality / rendering and execution as substrate
  connections)
- algorithm 02 (delta computation)
- algorithm 16 (GPU postfix stack machine; substrate independence)
- algorithm 22 (delta-trace as coupled signal; trace at the channel)
- INVARIANTS S1, S2, S3, F2, F3, M5, O1, I3

-----

## Reading mode

This extension is OBSERVATIONAL. It names where in the existing
formalism sensor input enters and what becomes observable from
each substrate’s reading position. The mechanical consequence
(CT’s `_opInput` retires or shrinks) is implementation work, not
a structural change to the architecture. The architecture was
always this shape under SE-06; SE-08 makes the shape visible at
the input boundary.

Implementations honoring SE-08 must honor every invariant cited
above. Implementations claiming to honor SE-08 while violating
S3 (e.g., adding a frame-sync primitive between adapters and ER,
or a callback from ER to CT on input) have produced a different
architecture that shares vocabulary with this one.