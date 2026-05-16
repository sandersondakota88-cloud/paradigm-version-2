# 22 - delta-Trace as Coupled Signal (neither-driven coupling)

**Status:** PROPOSED. Architecturally compatible with current
implementation. Requires three specific extensions listed below.
**Primary origin:** conversation April 2026, synthesized from the
cognition-framing question and the "signal produced by both sides,
driven by neither" insight.
**Secondary origin:** none in prior project docs. This is novel to
this catalog.
**Implemented in:** nothing yet.

---

## The move this algorithm makes

Every prior delta in the project (algorithms 2, 3, and the proposed
delta-as-tie-breaker) is **delta at a point**. It measures. It is a
snapshot. It differs from the others in what point it measures at and
what sets it ratios, but the grammar is the same: single value,
produced at a moment.

This algorithm proposes **delta over time** as a separate object. Not a
single value; a trace across a trajectory. The trace is produced as a
byproduct of cascade and trajectory operating together. Neither side
produces it for the other. Neither side consumes it as a command. But
the system's next state is shaped by it, because future selections
within the trajectory can be sensitive to the history of delta in its
own record.

This is the first delta role in the project that lives at the
trajectory layer rather than at the cascade layer.

## Narrow-claim scope

When delta is computed at every cascade-trajectory meeting (not only at
explicit observe() calls), and when the trajectory is a first-class
input to subsequent resolutions, the delta trace becomes a system-level
signal that neither side controls and both sides shape. This is
structurally different from mutation-channel feedback (where one side
updates the other) and opens a class of coupled dynamics not
expressible in CPU-drives-GPU architectures.

## Specification

### The three required extensions

For delta-trace to be load-bearing rather than decorative, three things
must be true in the implementation:

**1. Delta is computed at every resolution, not just at explicit
observe() calls.**

Currently delta is computed when the server observes state. For the
temporal signal to exist, every cascade resolution during a trajectory
has to carry a delta value - not just sealed ones, not just ones where
someone asked. The trajectory becomes a delta-trace by construction,
not by instrumentation.

**2. The trajectory is a first-class object the next resolution can
consult.**

Currently the cascade is memoryless at the coord level. For the trace
to matter, the cascade - or the selection between candidate next-coords
- has to be sensitive to what the trace has been. Not as a mutation.
As input alongside the current coord. The cascade stays stateless; the
selection layer above it becomes trajectory-aware.

**3. Neither side owns the trace.**

The trace cannot live in the server ("the server tracks delta over
time"). It cannot live in the client ("the client accumulates delta").
It has to live at the relation - in the same structural position
delta_IPC already occupies. The channel is the trace's home because
the channel is the only part of the system that neither side can call
"mine."

### Data structure (sketch)

```
trace : append-only sequence of {
    step     : int,            // monotonic step counter
    coord    : coord,          // where the trajectory was
    delta    : float in [0,1], // resolution at that moment
    source   : "cascade" | "observe" | "commit" | "nav",
}
```

Append happens at the channel. Both server-side operations (server
observes, server commits) and client-side operations (cascade resolves,
nav moves) produce append events. The trace grows; nothing reads it as
a command; selection logic consults it when deciding the next trajectory
step.

### Selection sensitivity

The trajectory's next step is selected from a candidate set. Currently
the selection is user-driven (click) or server-driven (bounds). Adding
delta-trace sensitivity means the selection function takes the trace as
input:

```
next_coord = select(candidates, current_coord, trace)
```

The function can look at:

- **instantaneous delta** : current unresolved ratio (the existing role)
- **delta trend** : sign of d(delta)/d(step) over a window
- **delta variance** : stability of resolution across recent steps
- **delta basin** : did we return to a low-delta region, or escape one

None of these require the cascade to change. They are properties of
the trace, computed above the cascade, applied at the selection layer.

## Falsification criteria

"Elegance plus specificity plus matches architecture" has been the
pattern that lit up under every previous rhetorical move that turned
out to be decorative. This algorithm's framing must earn its weight
against three falsifiable predictions:

**F1. Coupled dynamics must appear.** A system with delta-trace
sensitivity should exhibit coupled dynamics that do NOT appear when
cascade and trajectory are run without the trace. If behavior is
indistinguishable from the current cascade-plus-navigation, the
framing is decorative.

**F2. Production must be symmetric.** The trace must be producible
by both sides. If the server produces it and the client does not, or
vice versa, a hidden mutation channel exists and the neither-driven
claim fails.

**F3. Shape must matter, not only value.** The system must be
sensitive to the trajectory of delta over time, not just its
instantaneous value. If only the current delta matters,
delta-as-observation is sufficient and delta-trace adds nothing.

An implementation that satisfies all three earned the framing. One
that satisfies none or one did not. Two of three is ambiguous and
points at where to look.

## Invariants

1. **Trace is append-only.** Past entries never change. This preserves
   the property that the trace is a record of what happened, not a
   mutable state of what is currently true.
2. **Trace is channel-owned.** Neither server nor client exposes a
   read/write interface to the trace. Both produce events that the
   channel appends. Consumers (the selection function) read the
   trace through the channel's interface.
3. **Cascade stays memoryless at the coord level.** The cascade does
   not read the trace. A given coord always resolves to the same
   output given the same constraint set, regardless of trajectory
   history. The trajectory's sensitivity to the trace is separate
   from the cascade's resolution function.
4. **Trace is bounded.** Like the IPC log, the trace has a rolling cap
   to prevent unbounded growth. Events older than the cap are
   discarded from the live trace; they may or may not be persisted
   elsewhere (a separate decision, not part of this algorithm).

## What this does NOT claim

- Does not claim the system IS like human cognition. Claims only that
  a specific structural property (signal produced by both sides,
  consumed as command by neither) is shared between predictive-
  processing accounts of cognition and the proposed delta-trace
  dynamics. Whether this structural match produces cognition-like
  behavior is an empirical question for the implementation to answer.
- Does not claim Turing completeness. The delta-trace sensitivity
  extends expressiveness but does not itself establish universality.
  A separate analysis of trajectory-as-tape (see Part 3 of the
  foundational claim) would be required for that.
- Does not claim that any particular selection function over the
  trace is correct. The architecture supports many; which ones
  produce interesting coupled dynamics is for experiment.
- Does not propose to replace delta-as-observation. The snapshot role
  remains; the trace role is added alongside it.

## Wide-claim scope

In predictive-processing accounts of cognition (Clark, Friston,
Hohwy), prediction errors are neither commands from the world to the
brain nor outputs the brain sends. They are byproducts of the
prediction operation meeting the sensory operation. Neither side
intends the error; the error is what falls out of their meeting. The
system's next state is nevertheless shaped by the error without
either side being commanded by it.

This algorithm gives delta the same structural role in a VSF system.
Cascade resolves. Trajectory moves. Delta falls out. Neither side
produces delta for the other. The system's coupled behavior over
time becomes a function of the delta trace without any mutation
channel existing.

The wider claim that this makes the system cognition-like is
suggestive but unearned. The structural property is shared; whether
the resulting dynamics have anything interesting in common with
cognition is a question for an implementation to answer, not for the
framing to assert.

The wider claim worth reaching for: there is a class of computation
not expressible in CPU-drives-GPU architectures, characterized by
co-constitutive execution-rendering with coupling through a
byproduct signal. Human cognition is one example. This algorithm
proposes that VSF with the three required extensions is another.

## Related algorithms in this catalog

- `02-delta-computation.md` - the snapshot role this extends
- `03-delta-ipc-channel-fidelity.md` - the existing example of a
  signal that lives at the channel, owned by neither side
- `12-synchronous-logged-ipc.md` - the existing channel where the
  trace would live
- `19-observer-as-channel-triadic.md` - theoretical framing the
  neither-driven coupling pattern instantiates
