# 02 - delta Computation (observation / seal)

**Status:** IMPLEMENTED and tested.
**Primary origin:** `VSF_Format` section "Noise (delta) - Confidence as a
Core Parameter"
**Secondary origin:** `server-patterns.md` observe() function
**Implemented in:** `exodus-canonical.html` Server module, `observe()`
and COMMIT handling
**Tests:** "PROB tracks delta monotonically down", "COMMIT seals delta=0
and clears probChars"

---

## Narrow-claim scope

A monotone, bounded, computable measure of how much of a system's state
remains unresolved. Bounded to `[0, 1]` by construction.

## Specification

### Inputs
- `detDims : int >= 0` - number of deterministic dimensions
- `probDims : int >= 0` - number of probabilistic dimensions (total capacity)
- `resolvedProb : int` with `0 <= resolvedProb <= probDims`
- `sealed : bool` - whether this observation is at commit time

### Computation

```
if sealed:
 effective_prob_dims = resolvedProb # field collapses to actual length
else:
 effective_prob_dims = probDims # field is max capacity while live

total_dims = detDims + effective_prob_dims
unresolved = effective_prob_dims - resolvedProb
delta = 0 if total_dims == 0 else unresolved / total_dims
confidence = 1 - delta
```

### Return record (frozen, immutable)

```
{
 detDims: int,
 probDims: int, // effective, post-seal collapse if applicable
 totalDims: int,
 resolvedProb: int,
 unresolvedProb: int,
 delta: float in [0, 1], 4 decimal places
 confidence: float in [0, 1], 4 decimal places
 sealed: bool
}
```

## Invariants (verifiable)

1. **Bounded.** delta is always in `[0, 1]` by construction.
2. **Monotone under input.** Adding a resolved probabilistic position
 strictly decreases delta (tested: `PROB tracks delta monotonically
 down`).
3. **Seal collapse.** When sealed with `resolvedProb = n` in a capacity
 of `m >= n`, delta drops to 0. This is because the probDims term in
 the denominator collapses from `m` to `n`, so unresolved becomes
 `n - n = 0`. (Tested: `COMMIT seals delta=0 and clears probChars`.)
4. **Deterministic contribution is zero.** Deterministic dimensions
 always resolve via the cascade, so they contribute 0 to the numerator
 and `detDims` to the denominator. This asymmetry is load-bearing for
 the seal-collapse property.

## delta interpretation bands (from VSF_Format table)

```
0.00 HARD ANCHOR fully resolved, deterministic, committed
0.01-0.30 FIRM ANCHOR high confidence, minor probabilistic input
0.31-0.60 SOFT ANCHOR moderate confidence, significant prob input
0.61-0.99 UNANCHORED low confidence, speculative
1.00 GHOST no resolution has occurred
```

These bands are labels for UI display, not enforcement thresholds. The
only threshold with mechanical meaning is `0.0`, which marks sealed rows
(rows with `delta = 0` are the ones that committed).

## Why this definition and not a different one

There are many plausible "uncertainty measures" one could pick. This
specific formula was chosen because:

1. It is **monotone** in both directions (more input -> less delta; more
 capacity at equal input -> more delta).
2. It has a **computable seal semantics** (unused capacity is physically
 eliminated, not just ignored).
3. It has a **trivial lower bound** (0) that is actually reachable, so
 "fully resolved" is a distinguishable state.
4. It **avoids log arithmetic**, which would make the seal semantics
 awkward (`log(0)` etc.) and would not be tunable to the "unused
 dimensions eliminated" property.

The VSF_Format document also sketches a distance-with-confidence
extension:
```
distance(P_a, P_b) = spatial_distance(coords_a, coords_b)
confidence(P_a, P_b) = 1 - max(delta_a, delta_b)
```
This is not implemented but is well-defined and could be added as a
helper over committed rows.

## What this does NOT compute

- Not Shannon entropy. Shannon entropy would be a sum over probabilities
 weighted by their logs; this is a ratio of counts.
- Not Bayesian posterior width. No priors are consulted.
- Not a physical observable. The "observation" name is metaphoric;
 nothing stops an adversary from lying about `resolvedProb`.

## Wide-claim scope

The origin document positions delta as a "dimensional anchor"
alternative to time as the reference frame of computation, and suggests
it could propagate across layers the way uncertainty propagates in
physics. It cites the correspondence between this ratio and Shannon
"remaining information."

These are framings, not theorems. The narrow fact is: the arithmetic
above is correct, monotone, and bounded, and the seal semantics do what
the documents say they do. Whether delta is "time-equivalent" or
"physics-equivalent" is not decided by the implementation.

## Related algorithms in this catalog

- `03-delta-ipc-channel-fidelity.md` - composite observation across
 the IPC boundary
- `10-vsf-body-rows.md` - how delta is stored per-row in the VSF
 format
- `11-vsf-binary-encoding.md` - "confidence culling" as a proposed
 compression layer keyed on delta
