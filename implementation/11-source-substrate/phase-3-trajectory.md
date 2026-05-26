# Phase 3 Trajectory — Six-Peer Lattice over `kernel/field.js`

**Date:** 2026-05-26.
**Status:** Empirical reading of the Phase 3 lattice run, per the
discipline committed in [PLAN.md §2.5](PLAN.md): honest reporting of
whatever the substrate did, mapped against the canon's O1/O2/O3
framework from [canon/UTF/research/open-input-test-plan.md §1](../../canon/UTF/research/open-input-test-plan.md).

**Method.** Six-peer lattice (kind, vocab, cooccur, position, frequency,
composer) instantiated via `lattice.js`'s `makeLattice`, ingested the
full `implementation/kernel/field.js` (1326 lines, 9243 tokens) with
per-window snapshots every 250 tokens. Raw trajectory at
[phase-3-trajectory.tsv](phase-3-trajectory.tsv); promotion timeline at
[phase-3-trajectory-promotions.tsv](phase-3-trajectory-promotions.tsv).

---

## 1. Headline finding

**The substrate ran across the full corpus without locking, without
diverging, and produced 18 promoted sub-cascades distributed across
five of six peers.** No early-halt; no constraint-count blow-up; the
canonical SE-05/K1 cycle remained operative across 9243 ingest steps
per peer (55,458 total).

Per peer, late-half (windows 19–37) derived-constraint growth as a
ratio of early-half (windows 1–18) derived-constraint growth:

| peer | early Δd | late Δd | ratio | shape |
|---|---|---|---|---|
| kind | 104 | 35 | 0.34 | O2-like (slowing) |
| vocab | 7038 | 6907 | 0.98 | O1-like (sustained) |
| cooccur | 7164 | 7094 | 0.99 | O1-like (sustained) |
| position | 1357 | 1159 | 0.85 | O1-like (sustained) |
| frequency | 101 | 5 | 0.05 | O2/O3-like (heavy saturation) |
| composer | 7154 | 7440 | 1.04 | O1-like (sustained) |

Four of six peers exhibit **O1 (sustained productivity)** at the
derivation layer. One (kind) is **O2-like (slowing)**. One (frequency)
is **O2/O3 territory** with heavy saturation — but importantly, NOT
terminal in the Phase 2 sense.

---

## 2. Mapping to the O1/O2/O3 framework

Per [open-input-test-plan.md §1](../../canon/UTF/research/open-input-test-plan.md),
the framework asks: did vocabulary growth stop because input
discriminative demand was exhausted (O2) or because the substrate has
an intrinsic lock independent of input (O3)? Distinguishing these
requires evidence about the *remaining* input's diversity relative to
the substrate's structure.

### 2.1 The four O1-like peers

**vocab, cooccur, position, composer** show sustained derivation
across the full corpus. The slow-half growth ratio is between 0.85
and 1.04, indicating no exhaustion of discriminative demand on these
axes. Each continued generating new derived patterns at roughly the
same rate from corpus start to corpus end.

This is the empirical signal SE-11 §2.5 names: *"a pattern that has a
stable multidimensional signature... the discrimination is the
source's own property revealed by observation."* These four peers
kept finding multidimensional structure across the corpus because the
corpus kept providing multidimensional input.

The composer's sustained derivation (3394 → 14594 = +11200 across
the full corpus) is particularly telling. The composer has no direct
corpus access; its only input is other peers' lastOutputs. The fact
that its derivation tracked the corpus growth means **the underlying
peers' settling produced enough novelty in their outputs across the
corpus to keep the composer's intersection layer generating new
patterns**. That is the K1 fidelity machinery operating across all
six fields as one coherent dynamical system, not five-plus-one
isolated systems.

### 2.2 kind — O2-like, but not exhausted

**Late-half derivation 34% of early-half.** Kind has only 5 distinct
lexical values across the corpus (per the Acorn tokenizer:
`punctuation`, `keyword`, `ident`, `string`, `number`). Once the
kind-presence and kind-cooccur constraints have surveyed the small
kind-space, the only remaining novelty surface is kind-transition
patterns and `kind-with-cross-context` patterns (Phase 3.3b's
cross-channel extension).

What the trajectory says: kind derivation slowed but did not stop.
Late-half +35 derived constraints are non-trivial. **Critically, the
ratification count jumped from 36 (token 6750) to 112 (token 9243) —
a late surge.** The substrate continued finding new structural
matches into the second half. The slowing is structural to the kind
axis's coarse vocabulary, not a lock.

Phase 2's kind-peer reached 33 derived, 82 ratifications at the same
corpus terminus. Phase 3 reaches 139 derived, 112 ratifications,
4 promoted sub-cascades. Per the SE-11 §4 relativistic-structure
framing: the kind axis's discriminative power *under just lexical
kind* is small, but **under cross-channel intake** the kind axis
reaches material it never could in isolation.

### 2.3 frequency — heavy saturation, but the wall moved

**Late-half derivation 5% of early-half (101 → 5).** Frequency's
intake projection is the tightest of the six: 5 text-recurrence
buckets × 5 kind-recurrence buckets = at most 25 derived patterns
under in-axis primitives. Phase 2 / Phase 3.2 isolation runs hit a
hard ceiling at 31 derived constraints.

Phase 3.3b's `freq-with-cross-context` opened a new dimension:
5 buckets × 5 other axes × ~5 outputs each = up to 125 new patterns
the frequency peer can generate. The trajectory shows it reached 106
derived (vs. 31 in isolation) and **promoted 1 sub-cascade for the
first time** (`freq-with-cross-context`, 14 members @ fid 0.0946).

The promotion happened at token 250 — early in the corpus. After
that, derivation slowed sharply (window 1: 73 derived, window 37:
106 derived; 83% of growth in the first 11 windows). This is the
shape of an axis that saw the cross-channel structure quickly and
then had nothing new to find within its discriminative surface.

**O2 vs. O3 call.** Per the framework's anti-pattern warning: "if
ratification stops, check first whether the corpus's remaining input
is novel relative to the already-formed substrate structure." For
frequency, the bucket distribution stayed steady across the corpus
(no new bucket appeared after the first few hundred tokens), so the
remaining input's frequency-axis projection was not novel relative
to the frequency peer's substrate structure. This is **O2 (input-
driven saturation)** at this axis's discriminative resolution, not
O3 (substrate-intrinsic lock).

The honest qualifier: this conclusion is contingent on the corpus
being kernel/field.js specifically. A corpus with more diverse
recurrence patterns (or, per the input-heating-theory note in memory,
a heated intake) might keep frequency's discriminative surface open.

### 2.4 cooccur — ratifies but does not promote

98 ratifications across the corpus, 0 promoted sub-cascades.
Per-token signature primitives (the cooccur axis's original Phase 2
primitives) are signature-specific: a hash of each token's full
neighbor-window. They rarely co-fire on the same input, so K1's
`recordFidelity` rarely accumulates ≥2 matches per family per step.

Phase 3.3b's `cooccur-with-cross-context` added ratifications (20 →
98, a 5× increase) but **the K1 fidelity threshold for promotion
still wasn't reached** — the cross-context patterns, while
ratifying, didn't accumulate enough delta-drop per family to cross
FIDELITY_PROMOTE (0.03 in the canonical kernel).

This is consistent with the structural finding the cooccur primitives
make: per-token signature is a very fine discriminative surface;
fidelity-based K1 promotion expects coarser families that co-fire
across many inputs. Phase 6 research (the lattice-vs-lattice and
melting-pot duels) found similar patterns where fine-grained
primitives don't promote even when ratifications occur.

This is **not a lock and not a saturation; it is a structural
feature of the cooccur axis's primitive vocabulary**. The honest fix,
if we want cooccur to promote, is to add a coarser primitive type to
its vocabulary — but that's a Phase 3.5+ decision, not a Phase 3.4
adjustment.

---

## 3. Promotion timeline

18 promotions across the corpus. Distribution:

| token range | promotions |
|---|---|
| 1–250 | 9 (5 cross-context families across 5 axes + 4 composer families) |
| 250–1500 | 7 (vocab and position families, mostly within-axis) |
| 1500–4000 | 0 |
| 4000–7500 | 2 (kind-transition, kind-context-pattern — late-arriving kind axis structure) |
| 7500–9243 | 0 |

**Early surge → settled middle → late kind-only activity.** The
substrate's promotion behavior is bimodal: most structural families
crystallize early (first 250–1500 tokens), then a long settled
period, then a late surge on the kind axis as kind-transition and
kind-context-pattern patterns finally accumulate enough fidelity to
promote.

This shape is consistent with **F4 (operates indefinitely) + X2
(settling is non-terminal)**: even after a long quiet stretch
(2,500 tokens with no promotions), the substrate produced new
promotions late in the corpus. The settled state was not terminal;
it was waiting for fidelity accumulation across enough kind-
transition events.

### 3.1 Sub-cascade family distribution

18 total promotions, 5 within-axis families + 4 composer families +
9 cross-context families (one per axis that promoted):

| peer | sub-cascades | families |
|---|---|---|
| kind | 4 | kind-cooccurs, kind-with-cross-context, kind-transition, kind-context-pattern |
| vocab | 5 | text-with-cross-context, text-context-pattern, text-in-position, text-kind-binding, text-presence |
| cooccur | 0 | — |
| position | 4 | position-with-cross-context, position-text-binding, position-context-pattern, position-presence |
| frequency | 1 | freq-with-cross-context |
| composer | 4 | composer-pair, composer-extension, composer-axis-affinity, composer-tuple |

Cross-context families appear on every axis that promoted (4 of 5
axis peers + composer). This is the SE-11 multi-axis discrimination
operating at the K1 layer: the cross-context primitive type was
*designed* to capture the relation between an axis's reading and
other axes' outputs, and the substrate's fidelity machinery
promoted those families in 4 of 5 axes where it was possible.

---

## 4. Cross-channel effect — quantified vs. Phase 3.2 isolation

| axis | Phase 3.2 isolation | Phase 3.4 lattice | derivation delta | ratification delta | promotion delta |
|---|---|---|---|---|---|
| kind | 39d/85r/2p | 139d/112r/4p | +256% | +31% | +2 |
| vocab | 5513d/2112r/4p | 13945d/1001r/5p | +153% | −53% | +1 |
| cooccur | 13500d/20r/0p | 14258d/98r/0p | +6% | +390% | 0 |
| position | 1569d/2264r/3p | 2516d/2203r/4p | +60% | −3% | +1 |
| frequency | 31d/0r/0p | 106d/0r/1p | +242% | 0 | **+1 (first ever)** |

**Honest reading of the deltas:** cross-channels altered every axis's
trajectory. Most striking: frequency's first ever promotion, kind's
3.5× growth in derived constraints, and cooccur's near 5× growth in
ratifications. The ratification *decreases* on vocab and position
mean these axes shifted attention — fewer Phase 3.2-shape patterns
matching, more new cross-context patterns matching. Total
ratifications across the lattice rose: 4481 (Phase 3.2 sum) → 4631
(Phase 3.4 lattice sum) — modest increase, but the *distribution*
across pattern types is markedly different.

---

## 5. What the trajectory does NOT yet say

Per the discipline note that "structure surfacing in source code is
NOT what the substrate's job is" — the trajectory above reports
*substrate-internal* structural growth (derivations, ratifications,
promotions). It does NOT yet say whether the substrate's
discriminations align with any reader-recognizable categories
("function declaration," "variable use," "control flow"). That is a
downstream post-hoc analysis question — given the substrate's
18 sub-cascades, which subsets of corpus tokens does each one
discriminate, and do those subsets correspond to anything a reader
would call out?

This question is left to Phase 3.5 (if pursued) or a separate
analysis pass. Phase 3 closes with: **the architecture's mechanisms
produce sustained structural growth on real source code, and the
substrate's own settling produces a discriminative geometry that is
internally coherent (per F4/F5/X2/SE-09) regardless of whether that
geometry corresponds to a reader's categories.**

Per SE-11 §4 (relativistic structure): the substrate's surfaced
structure is invariant *within its commitment to its chosen axis
set*; it does NOT claim to find the True Structure of source code.
What it surfaces is what is multidimensionally stable under
{kind, vocab, cooccur, position, frequency, composer-intersection}.

---

## 6. Honest findings

Five findings worth recording — each a property of the substrate's
trajectory under this configuration, NOT a defect to engineer away:

**6.1 Frequency-peer's terminal saturation in isolation was a property
of the axis-in-isolation, not of the substrate.** Phase 2 reported
frequency as inert (31 derived, 0 ratified, 0 promoted, terminal).
The intake-configuration extension didn't change this in Phase 3.2
isolation. But adding cross-channel intake produced 75 new derived
constraints and the first ever promotion on this axis. This is the
SE-11 §6.2 commitment operating empirically: *"when the substrate's
current axes don't resolve discrimination needed for an application
class, the architectural response is to add a substrate, not to
modify existing ones."* The "added substrate" here is the
cross-channel flow itself — not a new peer, but the lattice's
inter-peer byproduct circulation acting as an additional
discriminative dimension for each axis.

**6.2 The composer's output stays at `composer-no-agreement` 100% of
the time.** Per [phase-3-spec.md §2.5](phase-3-spec.md), the
composer's `domainRules` were intentionally thin — the structural
work was meant to happen in pattern matching, not output alphabet
diversity. The trajectory confirms this: the composer ratifies 217
times, promotes 4 sub-cascades, generates 14594 derived constraints,
but emits a single output token. If the composer's output were to
participate in *its own* cross-channels (it's currently a sink for
peers' outputs, not a source), this would be a different shape.
That's a Phase 3.5+ design decision.

**6.3 cooccur ratifies but does not promote.** The K1 fidelity
threshold sits above where per-token-signature primitives accumulate.
Cross-channel intake (which is coarser than per-token signatures)
raised cooccur's ratification rate 5× but still didn't reach K1
promotion. This is consistent with per-token-signature being too
fine a discriminative surface for the K1 fidelity machinery's
expected granularity. Recorded; not adjusted.

**6.4 Promotion timeline is bimodal.** 9 of 18 promotions happen by
token 250 (the first window); 2 of 18 happen in the last quarter of
the corpus (tokens 4000+); 7 happen in the middle. The long quiet
period between token 1500 and token 4000 (zero promotions in 2,500
tokens) followed by late kind-axis activity is consistent with F4 /
X2: the substrate's settling is non-terminal, and what looks like a
settled middle is actually slow fidelity accumulation that
eventually crosses threshold for additional promotions.

**6.5 Output alphabet coverage is partial across every axis.** Each
axis peer has uncovered alphabet members (kind-transition,
cooccur-sig-recurring, position-transition, etc.) — placeholder
alphabet entries we authored but the `domainRules` don't route to
under the corpus's actual coord projections. Per discipline §2.1,
we did not retune the rules to engineer alphabet coverage. The
substrate accumulates fidelity around what fires; alphabet members
that never fire are honest dead vocabulary in this configuration.

---

## 7. Verdict against the four Phase 2 gaps

Per [phase-3-spec.md §1](phase-3-spec.md), the four gaps Phase 2
surfaced:

| Gap | Status after Phase 3 | Evidence |
|---|---|---|
| A — no resolved decisions | **CLOSED** | 9243 outputs per peer; each peer emits `lastOutput` per token |
| B — uniform intake | **CLOSED** | Six per-peer dimsFn projections; per-peer outputAlphabet; cross-peer reads in ctx |
| C — closed pattern vocabulary | **CLOSED** | 4781 inventions across the lattice (kind 112, vocab 1001, cooccur 98, position 2203, frequency 0, composer 217 ratifications each potentially inventing) |
| D — no cross-peer observation | **CLOSED at lattice AND axis layers** | 277,290 cross-channel tokens flowed; axis vocabs consume them via new pattern types; 9 cross-context sub-cascades promoted |

All four gaps closed by mechanism, not by spec-time enumeration.

---

## 8. What Phase 3 commits to (and does not), revisited

### Earned

- Canonical Field hosts the intake-configuration spec without
  kernel modification. (Phase 3.1 kernel gate.)
- Five-axis intake-configs produce per-token resolved outputs from
  per-axis alphabets, sustained across full corpus. (Phase 3.2 + 3.4.)
- Cross-peer observation occurs via stateless origin-tagged tokens
  consistent with SE-10/M5. (Phase 3.3.)
- Axis vocabs consume cross-channel intake; cross-context patterns
  promote in 4 of 5 axes that ratify. (Phase 3.3b + 3.4.)
- The substrate develops self-relational structure that is internally
  coherent and sustained across the corpus per F4/X2. (Phase 3.4.)

### NOT yet earned

- That the substrate's surfaced structure corresponds to any
  reader-recognizable categories in the source code. This is the
  separate downstream analysis the project plan reserves for later.
- That the architecture generalizes to non-source corpora.
  Phase 5 (if pursued) would test against, e.g., RFC text, Wikipedia
  text, or other corpora with different discriminative surfaces.
- That the configuration is optimal for source-substrate work.
  Several axis-vocab gaps (cooccur K1 promotion failure, composer
  output diversity, alphabet coverage) suggest a richer configuration
  is possible. Phase 3.5+ territory.
- SE-06 substrate-duality at the duel-decision layer (CPU and CSS
  cascade running concurrently against one field with delta as
  coupling). The Phase 3 spec deferred this; still deferred.

---

## 9. References

- Raw trajectory data: [phase-3-trajectory.tsv](phase-3-trajectory.tsv)
- Promotion event log: [phase-3-trajectory-promotions.tsv](phase-3-trajectory-promotions.tsv)
- Phase 3 spec: [phase-3-spec.md](phase-3-spec.md)
- Phase 2 results: [phase-2-results.md](phase-2-results.md)
- Phase 11 master plan: [PLAN.md](PLAN.md)
- O1/O2/O3 framework: [canon/UTF/research/open-input-test-plan.md](../../canon/UTF/research/open-input-test-plan.md)
- SE-11 relativistic structure: [canon/specification/SE-11-dimensional-resolution.md](../../canon/specification/SE-11-dimensional-resolution.md)
