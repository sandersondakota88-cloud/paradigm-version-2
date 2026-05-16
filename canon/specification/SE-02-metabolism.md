# SE-02 - Metabolism (Flow Discipline at the System Boundary)

**Type:** Specification extension
**Status:** OBSERVATIONAL. Names a structural property the architecture
implicitly requires for indefinite operation. Does not add new
mechanism; documents the flow discipline that separates "single-shot
resolver" from "system that persists across time."
**Primary origin:** conversation April 2026, arising from the question
of what is structurally missing from the gravity/anchor/trace framings.
**Secondary origin:** the cognition parallel noted throughout this
session - not as a claim that VSF is cognition, but as the observation
that systems capable of indefinite coherent operation share a
structural grammar of bounded flow, and the architecture should not
foreclose that grammar.

---

## What this extension does

It names a structural property the architecture implicitly requires
if it is to sustain operation across indefinite time, and documents
the positions in the existing formalism where that property lives.
It does not propose mechanisms. It does not claim the system is
alive, cognitive, or biological. It claims that if the system is to
persist across indefinite operation, it must treat its boundary as
a site of structured flow rather than as a static edge.

Like SE-01, this extension names what the formalism already implies
so that other algorithms can reference it without re-deriving it.

## The property

A system that persists across indefinite operation has three
structural features at its boundary:

1. **Intake** - something crosses the boundary inward. The system
   does not generate its own inputs from nothing; operation consumes
   something that must be replenished from outside.

2. **Excretion** - something crosses the boundary outward. Internal
   state that accumulates must have a path to leave, or the system
   clogs.

3. **Flow balance** - intake and excretion rates determine whether
   the system persists, degrades, or clogs. Persistence is a running
   equilibrium, not a static condition.

This is the structural grammar of metabolism in biological systems.
It is also the structural grammar of any open system that operates
indefinitely - servers that process requests, caches that evict
entries, streams that consume and emit. What distinguishes a
metabolism-shaped treatment from a request-response treatment is
that the flow is **constitutive**: the system's persistence depends
on the flow, not incidental to it.

## Why this matters for the architecture

The current canonical implementation is a single-shot resolver. A
coordinate is resolved; a row is committed; the trace grows; nothing
leaves. This is correct for the current domain (a loan decision is a
one-shot act, not an ongoing state). But the foundational claim and
every extension built on it - compositional cascades, delta-trace
coupling, gravity-anchor reading of delta - implicitly describe a
system capable of indefinite operation.

Without flow discipline, such a system would either:

- Run out of intake and stall (no new observations to resolve, no
  new coordinates to visit, no new coupling to measure delta over).
- Run out of capacity and clog (trace grows without bound, committed
  rows accumulate without bound, coupling state grows without bound).

Neither failure mode is a bug in the current implementation because
the current implementation does not operate indefinitely. They would
be bugs in any extension that does.

Documenting the flow property now does two things: it fixes the
structural positions where flow matters so that indefinite-operation
implementations do not re-discover them by failure, and it makes
clear what the existing single-shot architecture is and is not
claiming.

## Structural positions of flow

Four positions in the existing formalism are sites where flow
crosses the system boundary or would in an indefinite-operation
implementation:

### Position 1: IPC intake (observations, inputs, messages)

Algorithm 12 (synchronous logged IPC) describes the channel through
which external events enter the system. Currently these events are
discrete: CONNECT, NAV_SET, PROB_INPUT, COMMIT, etc. A flow-shaped
treatment would note that the **rate** of intake is a system
parameter and that the system's behavior depends on whether intake
is sufficient to keep operation going.

Flow discipline does not require changing the IPC mechanism. It
requires noting that the channel is an intake site and that intake
rate is meaningful.

### Position 2: Output emission (committed rows, exports, emitted events)

Algorithm 10 (VSF body rows) and the export paths in the canonical
implementation are the sites through which internal state leaves the
system. Currently committed rows accumulate in the state; exports
are one-shot operations.

Flow discipline would note that sustained operation requires some
portion of this output to actually leave - to be archived, to be
transmitted to another system, to be superseded by newer rows and
evicted. The architecture permits this; the current implementation
does not exercise it.

### Position 3: Trace accumulation and aging

Algorithm 22 (delta-trace as coupled signal) specifies an append-only
trace. The specification notes that the trace is bounded by a
rolling cap but does not specify what happens to entries older than
the cap.

Flow discipline treats trace aging as excretion: old entries leave
the live trace and either persist elsewhere (archived for historical
analysis) or are discarded (freeing capacity for newer entries). The
live trace has a bounded size; the flow through it is what keeps it
useful.

### Position 4: Cascade rule updates (if and when they happen)

The existing cascade is static - rules do not change across
operation. If the system were extended to update rules based on
trajectory history (one direction the cognition parallel points at),
rule updates would be intake of a specific kind: information flowing
from trajectory-scope into cascade-scope.

Flow discipline would note that such updates are themselves a flow
crossing an internal boundary, and that the rate of update relative
to the rate of resolution determines whether the cascade remains
stable or drifts. This is a structural position even if the current
implementation does not fill it.

## Non-claims

This extension does **not** claim:

- That VSF is alive, cognitive, or biological. The structural
  grammar of flow is shared between many kinds of systems; sharing
  grammar is not sharing nature.

- That the current implementation has a bug. The single-shot
  architecture is appropriate for single-shot domains. Metabolism
  is a property an extension into indefinite-operation domains would
  need; it is not a property the canonical implementation lacks in
  error.

- That flow discipline produces any particular behavior. It is a
  necessary structural condition for indefinite operation, not a
  sufficient condition for anything specific.

- That there is a "correct" intake rate, excretion rate, or flow
  balance. These are empirical parameters for an implementation,
  not values this extension specifies.

- That implementing flow requires a supervisor, orchestrator, or
  other driving layer. Flow is a property of the system as a whole.
  Each structural position handles its own flow through the
  mechanisms already described for it in the catalog.

## Relationship to foundational claim

The foundational claim does not mention flow explicitly, but every
wider reading of it implicitly requires flow. "Parallel traversal"
over indefinite time requires inputs to traverse. "Trajectory
through geometric space" over indefinite time requires a source of
new coordinates to visit. "Uncertainty as tie-breaker" across many
decisions requires a stream of decisions to break ties across.

The canonical implementation demonstrates the foundational claim in
a single-shot form. An implementation that sustains operation
demonstrates it across time. Both are legitimate; they make
different structural demands. SE-02 names the difference.

## Relationship to SE-01

SE-01 documents that the formalism is compositional - cascades can
contain cascades, delta is scale-free, and the same structural
properties hold at every level of nesting.

SE-02 documents that the formalism can be operated across indefinite
time - if the flow at the four structural positions is handled, the
system persists.

The two extensions are orthogonal. A composed system still needs
flow; a single-level system can still be indefinite. Both together
describe an architecture capable of indefinite operation over
nested structure, which is the shape most indefinite-operation
biological and engineered systems take.

## References to catalog entries

Algorithms whose content is relevant to the structural positions
documented here:

- **Algorithm 02** (delta computation) - The delta formula is a
  ratio; sustained operation requires both numerator and
  denominator to be replenished through intake or else the ratio
  becomes meaningless (both go to zero, or delta saturates at 1).

- **Algorithm 10** (VSF body rows) - The output emission position.
  Sustained operation requires some discipline for what happens to
  rows after commit.

- **Algorithm 12** (synchronous logged IPC) - The intake position.
  Sustained operation requires an account of intake rate and
  sufficiency.

- **Algorithm 13** (content-addressing and Merkle) - Integrity
  guarantees apply to whatever portion of state is live at a given
  moment. Flow discipline does not weaken integrity; it clarifies
  that integrity is over the current live set, and aged-out content
  is no longer in the integrity scope unless explicitly archived.

- **Algorithm 17** (distributed collapse network) - A distributed
  system is inherently a flow system at its inter-node boundaries.
  Four open DCN problems (trust, header consensus, merge, convergence)
  all have a flow-discipline aspect not yet specified; SE-02 names
  the position, not the solution.

- **Algorithm 22** (delta-trace as coupled signal) - The trace
  accumulation position. Sustained operation requires trace aging
  and either archival or discard of aged entries.

- **SE-01** (compositional cascades) - Each compositional level has
  its own four flow positions. Flow is per-level; aggregate flow
  properties follow from the per-level ones by composition.

## What this extension permits and what remains

With SE-01 and SE-02 together, the foundational claim's implicit
requirements are named:

- Compositional structure is available (SE-01).
- Indefinite operation is structurally possible (SE-02).
- Three delta readings coexist by scale-invariance (SE-01).
- Trace-coupled dynamics are possible (algorithm 22).
- Substrate independence holds (algorithm 16).

What remains unaddressed:

- No mechanism for rule update from trajectory history.
  Architecturally possible; not specified anywhere in the catalog.
- No account of what makes flow rates appropriate for given domains.
  Empirical; per-implementation.
- No formal convergence conditions for indefinite operation. Open.
- No decision about whether aged-out trace entries are archived,
  discarded, or both. Implementation choice.

These are not defects. They are the difference between architecture
(what the system is shaped to support) and implementation (what a
specific instance does with the shape). SE-02 documents the shape.

## Version

SE-02 v1.0, pinned to the algorithm catalog and canonical
implementation as of this writing. Revises only by addition; no
existing catalog entry is changed by this document.
