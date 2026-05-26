# Phase 3 — Intake-Configuration for the Five-Axis Source Substrate

**Status:** Specification. No code written.
**Date:** 2026-05-26 (revised).
**Predecessor:** [Phase 2 results](phase-2-results.md) — canonical SE-05/K1
cycle confirmed runnable on real source input. Three of five axes
completed the full cycle; two produced honest structural diagnostics.

**This phase continues Phase 11 source-substrate work** (PLAN.md), not
duel work. The duel research at [canon/UTF/research/Phase 6/](../../canon/UTF/research/Phase%206/)
is *reference for what intake-configuration looks like* — done work,
not the target. Phase 3 imports one specific finding from that
research: **intake-configuration is the substrate's identity
location**, and applies it to the gaps Phase 2 surfaced in the
five-axis source-substrate.

**Canon ground (the substrate IS the rules in non-contradictual
relation):** F1/SE-04 (seed permanent), F2 (one delta formula),
F3 (no supervision), F4 (indefinite), F5/SE-09 (irreversibility),
M1–M5 (vector-delta, derived vs. predictive, ratification,
modulation, trace at channel), K1 (sub-cascades from fidelity),
S1–S3 (shared substrate, S2 determinism, delta-only coupling),
X1–X4 (configuration includes seed, settling non-terminal,
configuration is internal, settling is mechanisms operating),
SE-01 (reflexive scope), SE-05 (vector-delta + predictive reaching),
SE-07 (configuration-and-settling: the corpus + the substrate's
reading position into it + the accumulated cross-peer decisions are
the configuration, not a problem presented to the substrate),
SE-10 (cross-channels as byproduct-at-channel),
SE-11 (dimensional resolution: five peers are five orthogonal axes;
composer intersects),
SE-12 (cross-substrate compounds: predicates over inter-substrate
boundary).

---

## 1. The four gaps Phase 2 surfaced

Phase 2's smoke test ran the canonical SE-05/K1 cycle on
`kernel/field.js` (1326 lines, 9243 tokens). What ran:

- 3 of 5 axes completed the full derive → predict → ratify → promote
  cycle (kind, vocab, position).
- 7 sub-cascades promoted.
- 82–3715 ratifications observed per axis.

What did not run, and the gap each names:

### Gap A — Peers produce no output decisions

Each peer generates constraints but emits **no resolved output per
token**. The peer has internal structural state but nothing it
**says** about the current token. Without an emitted decision, the
peer has no broadcast surface and no peer can be downstream of any
other. The "composer" Phase 11 originally planned has nothing to
intersect because no peer is producing a per-token resolved decision.

### Gap B — Intake is uniform across peers

All five peers consume the same `{kind, text, position_class,
neighbors_pre, neighbors_post, recurrence_*}` token record and look
at different fields of it. That's one intake-projected-five-ways, not
five intake-configurations. The duel research surfaced the
distinction: a substrate's *intake configuration* — what it reads
from the world plus what it reads from other substrates — is the
substrate's identity. Phase 2's peers have no identity except their
constructor name; their settling differs only by which JSON field
they happen to look at.

### Gap C — Pattern vocabulary is closed at spec-time

`primitive-vocabs.js` defines a fixed set of constraint pattern types
per peer (kind-presence, kind-cooccurs, kind-transition, etc.). When
derivations saturate (frequency-peer hit 31 derived and stopped),
there is no mechanism for the substrate to grow its pattern vocabulary.
The duel research showed invention at ratification as the operational
form of emergence — new pattern types sampled at ratification, entering
the substrate's vocabulary, competing on equal footing with seed-time
patterns. Phase 2 has no such mechanism. Saturation is terminal.

### Gap D — No cross-peer observation

The five peers run blind to each other. No peer's settling is shaped
by any other peer's settling within the same token's evaluation; cross-
peer intersection happens only post-hoc through the planned composer.
The duel research showed the productive pattern: substrates emit
byproduct that other substrates read at intake; the lattice becomes a
closed graph of byproduct-flowing-into-intake; per-substrate settling
shapes per-substrate settling continuously. Phase 2's peers are five
unconnected substrates running over one corpus.

---

## 2. What Phase 3 adds — and what it doesn't

Phase 3 closes the four gaps above by giving each peer an
**intake-configuration spec** in the canonical kernel's shape. The
shape is one specific finding from the duel research; Phase 3 applies
it to the source-substrate work. Phase 3 does **not** import duel
mechanics (HP, abilities, combat resolution, game state). The corpus
remains the source material; the axes remain kind / vocab / cooccur /
position / frequency; the kernel remains canonical Field via
`makePeer`.

### 2.1 The intake-configuration spec (per peer)

Each peer's spec carries six fields beyond what Phase 2's `makePeer`
took:

| Field | Role | Closes gap |
|---|---|---|
| `dimsFn(token, ctx)` | Projects current token + accumulated substrate-relative context into peer's coord shape | B |
| `tokensFn(token, ctx)` | Projects current token + accumulated substrate-relative context + neighbor peers' lastOutputs (origin-tagged) into peer's intake-token vocabulary | B, D |
| `outputVar` + `defaultOutput` + alphabet | Peer emits a resolved decision per token from this alphabet | A |
| `domainRules()` | Fixed startup rules mapping coord → output; placeholder dynamicity (canonical shape, simpler-than-canonical content) so the substrate has meaningful defaults before learning | A |
| `centroids` | Per-axis sampling centroids for invention at ratification | C |
| `onRatify(c, F)` | Hook — samples a new constraint pattern from `centroids` keyed by current `lastOutput`, integrates into the peer's pattern vocabulary | C |

`ctx` (passed to `dimsFn` and `tokensFn`) carries: the peer's own
recent emitted outputs, lastOutputs from the other four peers
(origin-tagged), and any accumulated substrate-relative state (e.g.
running per-peer count of how many tokens of each kind have been
emitted as that peer's output-token X). This is the substrate's
internal configuration per SE-07/X3, projected for the current
token's intake step.

### 2.2 Output token alphabets — placeholder dynamicity

Per discipline §2.3, output alphabets per peer are authored as
**placeholder dynamicities**: canonical shape (each peer emits one
token per step from a finite alphabet) with simpler content (alphabet
names structural-shape roles, not domain-content roles). K1 promotion
shapes which output-tokens become structurally load-bearing through
fidelity.

Starting alphabets:

| Peer | Output alphabet (placeholder) |
|---|---|
| kind | `kind-run-start`, `kind-run-mid`, `kind-run-end`, `kind-transition`, `kind-isolated` |
| vocab | `vocab-fresh`, `vocab-recurring`, `vocab-binding-decl`, `vocab-binding-use`, `vocab-positional` |
| cooccur | `cooccur-sig-novel`, `cooccur-sig-recurring`, `cooccur-symmetric`, `cooccur-anchored`, `cooccur-isolated` |
| position | `position-decl`, `position-use`, `position-attr`, `position-other`, `position-transition` |
| frequency | `freq-singleton`, `freq-rare`, `freq-moderate`, `freq-common`, `freq-dominant` |

These name **substrate-relative structural reads of the current
token**, not domain semantics. None of them say "this is a function
declaration" or "this is a variable use" — those would be hardcoded
interpretations per discipline §2.1. They say things like "this token
continues a run of same-kind tokens" or "this token's vocabulary
recurs across the corpus" — substrate-internal observations.

`domainRules()` per peer is a small starting set mapping coords to
these output tokens, so each peer has meaningful defaults before
learning. The substrate's ratifications shape the rules going forward
through SE-05 / K1; the placeholders are not the load-bearing rules,
the canonical mechanism is.

### 2.3 Cross-channels — origin-tagged tokens at intake

Each peer's `tokensFn` includes the other four peers' `lastOutput`
values as origin-tagged tokens: `from-kind:<token>`,
`from-vocab:<token>`, `from-cooccur:<token>`,
`from-position:<token>`, `from-frequency:<token>` (excluding the
peer's own axis).

The graph topology is **all-to-all by default**. The duel research
showed cross-concern predator-prey pairing (pres↔exploit, threat↔abecon)
breaks Nash-mirror lock; in the source-substrate context, with five
orthogonal axes per SE-11, there's no a-priori "predator" pairing.
All-to-all is the natural starting topology. If the substrate locks,
that's a finding worth a falsification-grade report; if it doesn't,
we leave the topology alone.

Per SE-10/M5: cross-channels are byproduct-at-channel, not commands.
The receiving peer reads other peers' outputs as intake tokens
indistinguishable in shape from corpus-derived tokens; the receiving
peer doesn't know its input came from another peer.

### 2.4 Invention at ratification — growing pattern vocabulary

When a predictive constraint ratifies, the peer's `onRatify` hook
samples a new constraint pattern from the peer's `centroids` space,
keyed by the peer's current `lastOutput`. The sampled pattern enters
the peer's pattern vocabulary and competes with seed-time patterns on
equal footing through M3 ratification + K1 fidelity.

For the source-substrate, `centroids` is per-axis. Each centroid is a
template constraint pattern with sampled parameters. For example,
kind-peer's centroid for `kind-transition` output might be:

```
{
  type: "kind-transition-with-context",
  from: <sampled-kind>,
  to: <sampled-kind>,
  context_kind: <sampled-kind>,    // a third kind in the neighbor window
  context_position: <0|1|2>         // pre, post, both
}
```

When ratification fires on the kind-peer with `lastOutput =
kind-transition`, the centroid samples one such pattern. The sampled
pattern enters the field as a derived constraint. The substrate now
has a new pattern type it can match on subsequent tokens; the pattern
type was not in the spec-time vocabulary.

Per F5/SE-09: invention is irreversible — the action space's
accumulation is the receipt of the substrate's operation.

Per discipline §2.1 / O3: centroid templates use **substrate vocabulary
only** (kinds, positions, neighbor-window slots, etc. — things the
substrate already has). No external semantic vocabulary enters the
pattern space through invention.

### 2.5 The composer — sixth peer, not a post-processor

Phase 11's original PLAN §3 Phase 3 had a "composer substrate" that
intersected peers' outputs post-hoc. Phase 3 (revised) reframes this:
the composer is a sixth peer using `makePeer` with the same intake-
configuration shape as the five axis peers. Its `tokensFn` reads all
five peers' `lastOutput` values; its `outputVar` is `--composer`; its
output alphabet is `composer-multi-axis-agreement`,
`composer-single-axis-only`, `composer-no-agreement`,
`composer-novel-intersection`. The composer participates in
cross-channels by emitting `from-composer:<token>` into the other
peers' intake.

Per SE-11 §2.3: the composer's primitive vocabulary operates on the
outputs of the peer substrates. SE-11's three example composer
primitives (JOINT_RECUR, JOINT_NAMING, KIND_TEXT_BIND) generalize to
five axes; that generalization is the composer's per-axis
`centroids` for invention.

### 2.6 Self-sustainment closure for an open-input substrate

SE-07/X3: configuration is internal. For the source-substrate, the
configuration is:

1. The constraint set (per peer) — accumulated derived, predictive,
   ratified, meta constraints
2. The substrate's reading position into the corpus — which token
   is current
3. The accumulated cross-peer decision context — recent `lastOutput`
   values from each peer
4. The substrate modulation state (SE-03 fast/slow layers)
5. The substrate's accumulated pattern vocabulary (from invention)

The settling loop closes through:

- The current token modulates intake into each peer's `tokensFn`
- Each peer's settling produces a `lastOutput`
- That `lastOutput` enters every other peer's `tokensFn` at the next
  step
- Each peer's `onRatify` may sample new patterns into the pattern
  vocabulary
- The next token of the corpus enters intake against the modulated
  substrate

The corpus is read once, sequentially. The corpus position is a
configuration component, not external input being processed.

**What this does not commit to:** that the substrate's reading
position into the corpus is *modulated by the substrate's settling*
(e.g. skipping ahead, going back, reading at variable rate). The
substrate reads sequentially. Whether reading-position modulation is
useful is a future-phase question, not Phase 3's commitment. Phase 3
closes the loop only through per-step intake projection + ratification
+ invention, not through reading-rate control.

---

## 3. Non-negotiables (load-bearing for the claim)

### 3.1 Canonical Field, no kernel modifications

Phase 3 extends `substrate-factory.js`'s `makePeer` to accept the
six new spec fields, but does not modify `implementation/kernel/
field.js`. The canonical Field's M2/M3/K1 mechanisms run as-is. If
the intake-configuration shape cannot be supported by `makePeer`
without canonical Field changes, that's a kernel finding worth its
own spec — not a Phase 3 expedient.

### 3.2 Corpus and axes preserved

Phase 3 uses the corpus Phase 2 used (`implementation/kernel/field.js`
for the smoke test; full 1326 lines). The five axes are unchanged:
kind, vocab, cooccur, position, frequency. The corpus-adapter and
five primitive vocabs from Phase 2 are the raw material; Phase 3
extends rather than replaces them.

### 3.3 Placeholder dynamicities honor canonical shape

Output alphabets, domain rules, and centroid templates are
placeholders per discipline §2.3. The canonical shape they honor:

- Per peer: finite output alphabet (canonical), substrate emits one
  token per step (canonical), domain rules map coord to output
  (canonical), invention samples patterns at ratification
  (canonical per the duel research and consistent with SE-11 §3),
  K1 promotion shapes which patterns become load-bearing
  (canonical).
- Per peer: which specific output tokens are in the alphabet, which
  specific domain rules apply, which specific centroid templates
  parameterize — these are simpler-than-canonical content the
  substrate accumulates fidelity around.

### 3.4 No hardcoded interpretation

Discipline §2.1. Output alphabets name structural-shape roles, not
domain-content roles. Centroid templates use substrate-internal
vocabulary only. K1 promotion shapes which patterns become
structurally load-bearing through measured fidelity, not through
authorial choice.

### 3.5 Honest reporting over engineered outcomes

Discipline §2.5. If Phase 3's substrate produces no rich learning, no
sub-cascade growth, no cross-peer coherence — that's the result we
report. We do not retune the placeholder alphabets, centroid
templates, or thresholds to engineer outcomes.

---

## 4. Phased build plan

Four sub-phases. Each has goal, scope, falsification condition,
deliverable.

### Phase 3.1 — Extend makePeer to accept intake-configuration spec

**Goal:** Without modifying canonical Field, extend
`substrate-factory.js`'s `makePeer` to accept `dimsFn`, `tokensFn`,
`outputVar`, `defaultOutput`, `domainRules`, `centroids`, `onRatify`,
`onPromote` spec fields. Verify a peer constructed with intake-
configuration runs the canonical SE-05/K1 cycle.

**Scope:**
- Extend the `makePeer` spec validation and per-tick cycle
- Add `lastOutput` slot to peer-field; populate from `dimsFn` +
  `domainRules` resolution post-ingest
- Add `onRatify` and `onPromote` invocation points in the cycle
- Smoke test: a single intake-configured peer running Phase 2's
  corpus produces output tokens and runs the canonical cycle

**Falsification condition:** if `makePeer` cannot host the intake-
configuration spec without canonical Field changes, Phase 3.1 halts
and we record the kernel gap.

**Deliverable:** updated `substrate-factory.js`. Single-peer smoke
test verifying intake-configured peer runs the cycle.

### Phase 3.2 — Author five-axis intake configs

**Goal:** Write per-peer intake-configuration specs for kind, vocab,
cooccur, position, frequency.

**Scope:**
- Per peer: `dimsFn`, `tokensFn`, `domainRules`, output alphabet,
  centroid templates
- Output alphabets per §2.2 above
- Centroid templates use substrate-internal vocabulary only (kinds,
  positions, neighbor-window slots) per O3 + discipline §2.1
- `tokensFn` does NOT yet read other peers' lastOutputs (deferred to
  Phase 3.3) — Phase 3.2 verifies each peer in isolation first

**Falsification condition:** if an output alphabet cannot be
written using substrate-internal vocabulary only (forcing
domain-content tokens), Phase 3.2 halts and we re-examine the
axis's discriminative surface.

**Deliverable:** `peer-specs.js` containing five intake-
configuration specs. Smoke test per peer in isolation. Each peer
emits `lastOutput` per token from its alphabet.

### Phase 3.3 — Wire cross-channels + composer

**Goal:** Connect the five peers via origin-tagged cross-channel
tokens; instantiate the composer as a sixth peer.

**Scope:**
- Each peer's `tokensFn` now reads other peers' `lastOutput` values
  as `from-<axis>:<token>` tokens at intake
- Composer peer with `tokensFn` reading all five peers' lastOutputs
- All six peers run per-tick over corpus tokens
- Cross-channel order-of-evaluation discipline: at tick T, peers
  read other peers' lastOutputs from tick T-1 (no within-tick
  ordering dependencies); this honors F3 by removing any implicit
  ordering as supervision

**Falsification condition:** if peers lock (no novel constraints
generated for >500 tokens) or diverge (constraint counts blow past
caps every tick), Phase 3.3 halts. Either is a structural finding
about the topology.

**Deliverable:** `phase-3-lattice.js` wiring all six peers. Smoke
test running the full lattice over Phase 2's corpus. Per-peer
trajectory log.

### Phase 3.4 — Trajectory analysis + commit

**Goal:** Honest report of what the lattice does over the corpus.

**Scope:**
- Per-peer trajectory: constraint counts, ratification rates,
  promotion events, invention counts, output token frequency,
  cross-peer agreement frequency
- Map findings to the O1/O2/O3 framework from
  [canon/UTF/research/open-input-test-plan.md](../../canon/UTF/research/open-input-test-plan.md):
  - O1: sustained productivity across full corpus
  - O2: input-driven saturation
  - O3: substrate-intrinsic lock
- Compare to Phase 2's results — which gaps did the intake-
  configuration close empirically; which gaps remain

**Deliverable:** `phase-3-trajectory.md`. PLAN.md updated.

---

## 5. What Phase 3 commits to (and does not)

### Commits

- The four Phase 2 gaps (A: no output decisions, B: uniform intake,
  C: closed pattern vocabulary, D: no cross-peer observation) are
  closed by canonical-shape mechanisms: intake-configuration,
  output token alphabets, invention at ratification,
  origin-tagged cross-channels at intake.
- Canonical Field unchanged. `makePeer` extended; canonical kernel
  files not touched.
- Corpus and axes from Phase 2 preserved. Phase 3 extends, does not
  replace.
- Placeholder dynamicities honor canonical shape per discipline
  §2.3; no hardcoded interpretation per §2.1.
- Honest reporting per §2.5; no tuning for outcome.

### Does not commit

- That the lattice will produce rich learning over `kernel/field.js`
  (or any other corpus). The result is what the substrate does.
- That the placeholder output alphabets are the "right" alphabets
  for this corpus. They are starting points the substrate
  accumulates fidelity around.
- That reading-position-into-corpus is itself modulated by the
  substrate's settling (deferred — see §2.6).
- WebGPU resolution. Phase 3 is CPU-side per `makePeer` per
  Phase 2's discipline. SE-06 substrate-duality at this layer is
  a later phase.

---

## 6. Live status

| Date | Action |
|---|---|
| 2026-05-26 | Spec drafted (duel-shaped). Committed eaede15. |
| 2026-05-26 | Spec **rewritten** after operator correction: duel research is reference for intake-configuration shape, not a target to rebuild. Phase 3 continues Phase 11 source-substrate work, closing the four gaps Phase 2 surfaced through intake-configuration. |

Updates appended as sub-phases complete or halt.

---

## 7. Reference cross-links

- Phase 2 results: [phase-2-results.md](phase-2-results.md)
- Phase 11 master plan: [PLAN.md](PLAN.md)
- Duel research (reference, not target): [canon/UTF/research/Phase 6/](../../canon/UTF/research/Phase%206/), [phase-6-substrate-duels-analysis.md](../../canon/UTF/research/phase-6-substrate-duels-analysis.md)
- Open-input test plan: [canon/UTF/research/open-input-test-plan.md](../../canon/UTF/research/open-input-test-plan.md)
- Project-wide claim hierarchy: [PROJECT-PLAN.md](../../PROJECT-PLAN.md)
- SE-11 dimensional resolution: [canon/specification/SE-11-dimensional-resolution.md](../../canon/specification/SE-11-dimensional-resolution.md)
- Canonical kernel: [implementation/kernel/field.js](../kernel/field.js)
- Phase 2 substrate factory: [substrate-factory.js](substrate-factory.js)
- Phase 2 primitive vocabs: [primitive-vocabs.js](primitive-vocabs.js)
