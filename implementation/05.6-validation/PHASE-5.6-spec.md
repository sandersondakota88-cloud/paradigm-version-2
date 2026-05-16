# Phase 5.6 - Trajectory Novelty Verification

This file contains the Phase 5.6 section in the format used by
IMPLEMENTATION_PATH section 6.5 (Phase 5.5, kindMult cleanup, per
AMENDMENT_2_4). Insert between section 6.5 and section 7 (Phase 6).
Renumber existing sections as needed; update section 8 (Order of
work) to list 5.6 between 5.5 and 6.

ASCII-only. Source-cited to F5 and SE-09 (the canon entries
articulating the property this phase verifies).

-----

## 6.6. Phase 5.6: trajectory novelty verification

### Purpose

F5 (observation produces irrecoverable structural change) and SE-09
(operational irreversibility) were elevated to canon following the
SE-08 design exchange. Both are OBSERVATIONAL in the sense that
they articulate properties the formalism already supports across
M5 + SE-03 + SE-04 + F1 + F4 + algorithm 22 stacked. Before any
work that builds atop those properties (SE-08 implementation,
sensor adapters, render-substrate intake, Path A multi-modal
input, self-feed regimes) lands in code, Phase 5.6 verifies that
the running implementation actually exhibits the property the
canon claims is structural.

The discipline matches Phase 5: verification-only, no production
source modified, the test suite is the artifact. If the
implementation does not produce trajectory novelty, the F5/SE-09
canon is making a claim the running code does not honor, and that
gap must be closed before Phase 6 lands. If the implementation
does produce trajectory novelty, the canon is empirically
confirmed for the regimes tested and SE-08 implementation work
is unblocked.

### What it verifies

Trajectory novelty in the precise structural sense F5 commits to:
no two field-state samples have identical structural digest,
across runs of bounded length, under several input regimes. The
“structural digest” excludes the step counter (which is monotonic
by construction and would trivialize the test) and includes the
substrate state, constraint population state, ratification
counters, named-cascade counts, trace length, and per-constraint
usage records that F5 names as the deposits irreversibility
accumulates in.

Five test categories:

**5.6.1 Repeating constant input.** Same input string fed N times.
Per F5, each iteration’s field state must differ from every
prior iteration’s, even though the input is identical. This is
the direct empirical test of trajectory novelty under the
simplest possible repeated-observation regime.

**5.6.2 Slow-layer monotonic drift.** Per SE-03, slow-layer
contributions are permanent; under a positive-contribution
input stream the slow layer must not regress between consecutive
samples. Verifies the SE-03 mechanism F5 cites.

**5.6.3 Trace append-only.** Per M5, the trace is append-only
at the channel; trace length must be monotonic non-decreasing
across the run. Verifies the M5 mechanism F5 cites.

**5.6.4 Step counter strict monotonicity.** Per F4, operation
is indefinite; the step counter must advance strictly. Verifies
the F4 commitment in this specific regime; subsidiary to F5 but
load-bearing for the meaning of “trajectory” itself.

**5.6.5 Identical-input divergence.** The minimum case for
F5/SE-09 demonstration: same input fed twice in succession, the
resulting field-state digest must differ. This is the smallest
positive demonstration of trajectory novelty and the first thing
that should fail if F5 is structurally unsupported by the
implementation.

### What it does NOT do

Phase 5.6 does not implement SE-08, does not add sensor adapters,
does not refactor `_opInput`, does not modify any production
module. It is verification-only. The test file is the deliverable;
no edits to `field.js`, `ct-engine.js`, `er-engine.js`,
`reflexive-surface.js`, or any other production source.

Phase 5.6 also does not test self-feed regimes (Architecture A
from the channels conversation) or compounding-debt scenarios
under recursive coupling. Those tests need SE-08 implementation
to exist before they can run; they belong in Phase 6 prelude or
Phase 6 itself, after the input-feature buffer and adapter base
are built.

Phase 5.6 does not verify trajectory novelty under all
operational regimes - only under a representative set chosen for
load-bearing coverage. A future verification pass under sustained
high-rate sensor input is appropriate after SE-08 is live; that
is not in scope here.

### Deliverables

One new file: `test-phase5-6.js`. Same shape as `test-phase5a.js`
through `test-phase5f.js` - test array, `run()` function, exits
0 on all-pass, 1 on any-fail. Uses `phase5-harness.js` for setup
and `node:crypto` for SHA-256 digest. No other dependencies.

The structural-hash helper is internal to the test file. It
captures the field state F5 names as the irreversibility surface,
excluding step (which is monotonic by F4 and would trivialize the
test). Floats are stringified at full precision; constraint
arrays are serialized in their natural order (Field maintains
deterministic constraint order by construction).

### Success criteria

1. `test-phase5-6.js` exits 0 with all five tests passing under
   Node, no WebGPU required.
1. No production source is modified by Phase 5.6.
1. The test runs in reasonable time (under 10 seconds on a
   typical development machine; the per-iteration cost is
   dominated by the SHA-256 digest, which is bounded by the
   constraint count, which is bounded by `FIELD_LIVE_CAP`).
1. ASCII-only (I1).
1. The structural-hash function does not include the step counter.

### Failure handling

If any of the five tests fails, the failure is information about
the implementation, not a bug in the test:

- 5.6.1 fail: F5 is structurally unsupported under repeating
  input. The implementation has a regime where observation does
  not produce irrecoverable change. Investigate whether the
  failing iteration is a no-op step, a bug in the modulation
  update, or a genuine F5 violation. Open an issue, fix before
  Phase 6.
- 5.6.2 fail: SE-03 slow-layer permanence violated. Likely a bug
  in the modulation update path; this is severe.
- 5.6.3 fail: M5 append-only violated. Trace was edited or
  truncated mid-run. Severe; the trace cap aging is supposed to
  be an excretion process, not a mid-run rewrite.
- 5.6.4 fail: F4 broken in this regime; step counter regressed
  or stalled. Severe.
- 5.6.5 fail: F5/SE-09 directly violated at the minimum-case
  level. Severe; if this fails, the canon entries for F5 and
  SE-09 are making a claim the architecture as implemented does
  not support. Either the canon is wrong (re-examine F5 and
  SE-09 against M5/SE-03/SE-04 mechanisms), or the
  implementation has a regime that violates F5 (fix it).

### Dependencies

`field.js`, `ct-engine.js`, `er-engine.js`,
`reflexive-surface.js`, `storage-adapter.js`,
`constraint-compiler.js`, `phase5-harness.js`, `cpu-oracle.js` -
all already in tree. No new dependencies.

### Estimated session length

Half session. The test file is roughly 220 lines. Most of the
work is the structural-hash function and ensuring all five tests
exercise distinct mechanisms. The harness provides setup,
teardown, snapshot, and driveInputs already.

### Order of work within the phase

1. Define `hashFieldState()` helper (deterministic SHA-256 over
   a canonical state digest, step counter excluded).
1. Implement 5.6.4 first (step monotonicity) - quickest, validates
   the harness is wired correctly.
1. Implement 5.6.3 (trace append-only) - simple property,
   confirms basic invariant compliance.
1. Implement 5.6.2 (slow-layer monotonic drift) - tests SE-03
   directly.
1. Implement 5.6.5 (identical-input divergence) - direct F5
   demonstration at minimum case.
1. Implement 5.6.1 (full N-iteration trajectory novelty) - the
   load-bearing test.
1. Run the full suite headless under Node; expect all five green.

### What this phase establishes for downstream work

Phase 5.6 passing means F5/SE-09 hold against the running
implementation. Downstream work (SE-08 input-feature buffer,
adapter base, sensor adapter scaffolding, self-feed regimes)
can build atop F5/SE-09 with confidence that the property
implementations honor matches the property the canon names.
This is the precondition for Phase 6 in the SE-08 path; without
it, every SE-08-dependent test would have an open question
about whether F5 is structurally supported.

Phase 5.6 failing means the canon and the implementation
disagree, and the disagreement must be resolved before any
downstream work proceeds. Either the canon entries were
articulated past what the implementation supports (re-examine
F5/SE-09), or the implementation has a defect (fix it). The
phase result is decision-relevant in either direction.