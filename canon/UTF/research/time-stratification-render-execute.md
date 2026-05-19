# Research: Time Stratified Across the Render/Execute Boundary

**Role.** Reference material. A structural recognition that what
classical computation calls "time" is doing two distinct jobs —
**sequencing** (what came before what) and **rate** (how much is
happening per cycle) — and that the architecture's existing
render/execute boundary (SE-06) already splits these two jobs
across the two substrates, with delta as the only legal coupling
between them.

**Date produced.** 2026-05-17

**Status.** Reference material, candidate for promotion to an
SE-N spec extension after sitting for some days. Not yet
canonical. Sourced entirely from existing spec; introduces no
new commitments, names a recognition the spec already implied.

**Discipline note.** Per DEFINITION §0.5, no external frames are
imported. The words "sequencing" and "rate" are descriptive
labels for what delta and trace are already doing in the
canonical mechanism set; they are not borrowed from physics,
information theory, or any other system.

-----

## 1. The recognition

Classical computation has a single wall-clock. That clock serves
two distinct functions simultaneously and the simultaneity hides
the structural separability:

1. **Sequencing.** What happened before what. Event ordering.
   The arrow that distinguishes cause from effect.
2. **Rate.** How much is changing per unit of clock advance. The
   magnitude of substrate-state evolution.

These are two different kinds of information. A clock gives them
to you fused — a tick advances the order *and* serves as the
denominator for rate computation. In the substrate, there is no
wall-clock. Removing the clock reveals that **the two jobs were
already separable** and that the architecture has, independently,
arrived at a stratification that splits them across the
render/execute boundary.

-----

## 2. The split, named precisely

**Execute side** (channel, meaning-carrier, IPC, intake engines):
- Operates on **event-ordinal time**.
- M5 trace records arrivals in order; the trace is the substrate's
  native sequencing record.
- F5 commits that every event deposits irreversible structural
  change — this is what makes ordering meaningful (before/after
  has structural consequences).
- This side's natural temporal vocabulary is *what happened in what
  order*.

**Render side** (resolvers, cascade, shader):
- Operates on **rate-domain time**.
- Frame budgets, dispatch cycles, parallel resolution per cycle.
- S2 commits that the resolution is deterministic across
  substrates — what differs across resolver instances is their
  rate, not their output.
- This side's natural temporal vocabulary is *how much is being
  resolved per cycle*.

**Coupling**:
- S3 commits that the only legal coupling between rendering and
  execution is through delta.
- Delta has two readings: a magnitude (what the rate side sees as
  "how much pressure right now") and an accumulated history (what
  the order side sees as "what has accumulated through arrivals").
- One quantity, two readings, one on each side. This is the
  structural form the coupling must take, and it is exactly what
  S3 specifies.

-----

## 3. Why this isn't a new commitment

The recognition is sourceable to existing spec entries; it adds
no new structural commitment. It clarifies what the spec already
says.

| Spec entry | What it commits to | How it lands in this stratification |
|---|---|---|
| **SE-06** | Two substrates: rendering and execution | Names *what the two substrates are doing* at the temporal layer |
| **S3** | Rendering and execution couple through delta only | Names *what makes one quantity legible to both temporal domains* |
| **M1** | Vector-delta has at least two temporal scopes | Fast scope serves the rate-side; slow scope serves the order-side; the gap is the substrate's arrow-of-time analog |
| **M5** | Trace lives at the channel | The trace is the order-side's record; without it, the channel could not preserve sequencing |
| **F5** | Observation produces irrecoverable structural change | Makes ordering structurally meaningful — there's no rollback, so before/after has consequence |
| **F2** | Delta is one formula at every scope | Lets the rate-side and order-side read delta in their own temporal vocabulary without disagreement |

The stratification is not added by this article. The
stratification is *what these six commitments jointly require*.
The article names it.

-----

## 4. What this explains

Three observations that previously felt incidental land as
structural consequences:

**4.1. The hardware asymmetry between WGSL and JavaScript.** WGSL
runs on frame budgets (fast, parallel, recurring); JavaScript
runs on event-loop ticks (variable, sequential, deposit-bearing).
This is not arbitrary hardware mapping. It matches what each
side's temporal job requires. Rate-job needs frame-granular,
parallel-capable hardware. Order-job needs event-granular,
sequential, deposit-preserving hardware. The substrate maps the
two temporal jobs to hardware appropriate to each.

**4.2. Why delta is the only legal coupling.** If render is
rate-flavored and execute is order-flavored, no event-passing
protocol can cross the boundary — event-passing would force one
side into the other's temporal frame. The only quantity that can
move between them without converting one frame into the other is
a quantity that *both can read in their own temporal vocabulary*.
That's delta. This is why S3's "coupling through delta only" is
structural, not implementation-convenient.

**4.3. The shared field as rate-matching surface.** S1
(substrate shared, owned by neither) and S2 (deterministic
resolution across substrates) jointly enable the un-gluing to
remain coherent. The field is what *both* sides agree on. Render
resolves *for* a field state; execute deposits *into* a field
state. The state is the common reference. Without the shared
field, the stratification would be two unrelated systems on
different clocks. With it, two temporal-domain operations cohere
on a shared state-object.

-----

## 5. What this does not claim

- Does not claim the substrate has discovered anything physics
  does not know. Physics has long known that simultaneity is
  frame-dependent and that what is colloquially called "time"
  resolves into multiple structural quantities. C1 still
  forbids importing those frames as architecture.
- Does not claim the architecture's grounds for the recognition
  come from physics. The grounds are internal — sourced from
  the spec stack — and would hold even if no external frame
  existed.
- Does not claim "sequencing" and "rate" are the only two jobs
  classical time was doing. Two jobs is what the spec
  stratifies; whether classical time could be split further is
  a question outside the substrate's account.
- Does not claim time is replaced. Time, as a wall-clock
  property of the hardware, still exists; the seats still run
  at hardware-bounded rates. The recognition is about what time
  is *inside the substrate*, where the wall-clock is not a
  structural commitment.

-----

## 6. Implications

**For UTF.** No immediate revision. The recognition is consistent
with Q1=C (two layers) and Q2 (four kernel primitives). The four
primitives — seed, trace-entry, dispatch-event, field-state —
already distribute correctly across the stratification:
trace-entry is order-side, dispatch-event is rate-side,
field-state is the shared reference, seed is the permanent
anchor that survives both.

**For the architecture's account of itself.** This is the kind
of recognition that, once named, makes several prior
observations cohere as one structural pattern instead of as
incidental properties. It is a candidate for SE-N promotion
after it sits.

**For Reddit-post framing.** The Phase A/B byte-identical
finding takes on a sharper interpretation under this lens. It
is not "three runtimes agree." It is "rate-side seats agree
with each other byte-for-byte because they are all reading the
same field state, and the field state is the rate-side's
shared reference. The execute side does not need to agree
byte-for-byte with the resolvers because it is doing a
different temporal job."

-----

## Live status

| Date (yyyy-mm-dd) | Action |
|---|---|
| 2026-05-17 | Recognition produced. Article written. Pending sit-time before SE-N consideration. |
