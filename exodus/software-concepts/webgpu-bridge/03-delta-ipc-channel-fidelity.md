# 03 - delta_IPC Channel Fidelity (S->C, C->S, composite)

**Status:** IMPLEMENTED and tested.
**Primary origin:** `Development_Roadmap` section 2 ("delta arithmetic
for relational systems")
**Secondary origin:** `State_Converter.MD` mid-document note on the
|A->C<-B| formulation
**Implemented in:** `exodus-canonical.html` Observer module
**Tests:** 16 tests in the observer test suite, including 6
appraisal-driven regression tests

---

## Appraiser-driven context

This algorithm was reframed after external review. The earlier framing
claimed "delta(A->B) != delta(B->A)" as a discovery; the reviewer
correctly pointed out that this is a definition, not a discovery, and
that the two sets over which ratios are computed are chosen, not
derived. The current implementation treats this as **a concrete,
useful instance of an observability pattern**, not a formal property of
channels in general. See the Observer module header comment in the
canonical file for the current framing.

## Narrow-claim scope

A per-direction observed/expected ratio across the IPC boundary, plus
two deterministic composition rules. The algorithm does not prove
anything formal about channels; it defines a dashboard metric and keeps
it live.

## Specification

### Per-direction state

Two directions, S->C (server-to-client) and C->S (client-to-server).
Each direction maintains:

```
expected : set of keys, chosen by the implementor
observed : subset of expected, updated as messages flow
delta : |expected - observed| / |expected| # 0 if |expected| == 0
```

### Default expected-set choices (current implementation)

**S->C** expected set:
 Every coordinate in the deterministic state space.
 Size: product of dim cardinalities (e.g., 2,880 for the loan domain).
 A coord key is "observed" when the server has received a cascadeResult
 for that coord via COMMIT or SCAN_SPACE.

**C->S** expected set:
 Exactly three keys: `rowcount`, `version`, `merkle`.
 `rowcount` and `version` are confirmed by any ACK that reports them.
 `merkle` is specifically invalidated by COMMIT_ACK and re-confirmed
 only by SET_MERKLE (reflecting the async-hash window).

### Composition rules

```
deltaIPC_geometric = sqrt(delta(S->C) * delta(C->S))
deltaIPC_weighted = alpha * delta(S->C) + (1 - alpha) * delta(C->S)
```

With `alpha = 0.8` in the current PoC (server-authoritative).

### Displayed metric

Only the **weighted** form is shown in the UI. The geometric form is
computed for diagnostic access but not displayed. See `Choice of
composition` below.

## Invariants (tested)

1. Fresh CONNECT: delta(S->C) = 1.0, delta(C->S) = 0.0 (after CONNECTED
 confirms all three client-side expectations)
2. One COMMIT at a fresh coord: delta(S->C) drops by exactly
 `1 / stateSpaceSize`
3. Duplicate COMMIT at same coord: delta(S->C) does NOT double-count
4. COMMIT_ACK without SET_MERKLE: delta(C->S) spikes to `1/3`
5. SET_MERKLE arrival: delta(C->S) returns to 0
6. Full SCAN_SPACE: delta(S->C) collapses to 0 in one message
7. Geometric composite: equals `sqrt(dSC * dCS)` to 1e-6
8. Weighted composite: equals `0.8 * dSC + 0.2 * dCS` to 1e-6

## Why the geometric form is kept but not displayed

The geometric mean has a pathology as a fidelity metric:

```
delta(S->C) = 0 and delta(C->S) = 1
=> sqrt(0 * 1) = 0
=> "channel fully certain"
```

This is wrong as a fidelity reading. One direction is fully uncertain,
so the channel is not fully certain. The weighted form with a
non-degenerate alpha avoids this: `0.8 * 0 + 0.2 * 1 = 0.2`, which
correctly reflects residual uncertainty.

The geometric form IS useful as a "both-sides" indicator: it's a gate
that opens only when both directions are fully observed. That is a
legitimate use case, so we keep the value computed. It is not a
fidelity metric and must not be displayed as one.

Tested explicitly: `geometric collapses to 0 when one direction is 0
(documented, not displayed)`.

## Wiring

The Observer is notified on every IPC response through a single hook
point: `IPC.send()` calls `Observer.onResponse(msg, response)` after
dispatching to the server. The async merkle path (via the hash queue)
also routes its internal SET_HASH and SET_MERKLE calls through the
Observer, so the `merkle`-observation gap is visible in real time.

Listeners can subscribe via `Observer.onChange(fn)` to get notified
after every state update.

## What this does NOT claim

- Does not prove that channels are "observers" in any formal sense.
 The |A->C<-B| framing in `State_Converter.MD` is vocabulary, not a
 theorem.
- Does not claim that the expected sets are "the right" expected sets.
 Different choices would give different numbers. Implementors adapting
 this pattern should pick expected sets that match the invariants they
 care about.
- Does not claim that alpha = 0.8 is special. It was chosen because the
 server is authoritative in this PoC. In a peer-to-peer system,
 alpha = 0.5 would be more honest.

## Scaling note

`registerStateSpace` enumerates the full cartesian product of dim
values. O(|state space|) in time and memory. For the 2,880-point loan
domain that's trivial (a 2,880-entry null-proto map). For state spaces
above ~10^6 coords this enumeration itself is a bottleneck and should
be replaced with a sparse representation (observed set only, with
expected count computed arithmetically).

## Wide-claim scope

The `State_Converter.MD` note ("the relationship is the observer. not
A->B not A<-B but |A->C<-B|") proposes that observer asymmetry is a
deep property of all relationships. This is a metaphysical claim that
the code does not test or depend on. The code tests a specific
observable/expected arithmetic over specific chosen sets.

If the metaphysical claim is true, the implementation is at most
evidence; if it is false, the implementation is still a useful
observability dashboard. The two are independent.

## Related algorithms in this catalog

- `02-delta-computation.md` - the single-direction delta this
 extends
- `12-synchronous-logged-ipc.md` - the channel this runs across
- `13-content-addressing-and-merkle.md` - the async hash window that
 produces the merkle invalidation dynamic
- `19-observer-as-channel-triadic.md` - theoretical framing
