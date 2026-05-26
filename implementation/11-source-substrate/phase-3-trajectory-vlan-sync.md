# Phase 3 Trajectory — Reconciliation Run on `exodus-vlan-sync.html`

**Date:** 2026-05-26.
**Purpose:** PLAN.md §9.3 reconciliation. The original Phase 0 corpus
decision (`exodus-vlan-sync.html`) was silently replaced by
`implementation/kernel/field.js` for Phase 2/3 smoke tests. This run
re-executes the Phase 3.4 trajectory on the originally-scoped
corpus to test the SE-11 §2.5 falsification claim ("substrate
surfaces patterns a reader would recognize in an **unfamiliar SPA**")
without the reflexive trap.

**Method.** Same six-peer lattice (kind, vocab, cooccur, position,
frequency, composer) instantiated via `lattice.js`'s `makeLattice`.
JS extracted from vlan-sync's single `<script>` block (20023 bytes,
538 lines, 2831 tokens after Acorn tokenization). Window size 100
tokens (smaller corpus than field.js, so finer windows).

Raw trajectory: [`phase-3-trajectory-vlan-sync.tsv`](phase-3-trajectory-vlan-sync.tsv).
Promotion log: [`phase-3-trajectory-vlan-sync-promotions.tsv`](phase-3-trajectory-vlan-sync-promotions.tsv).

---

## 1. Side-by-side comparison

| | field.js (9243 tokens) | vlan-sync (2831 tokens) |
|---|---|---|
| Corpus character | substrate's own kernel | unfamiliar networking SPA |
| Distinct kinds | 5 | 6 |
| Distinct texts | (not reported) | 344 |
| Parse errors | 1 | 0 |
| Total promotions | 18 | 15 |
| Total inventions | ~4781 | ~1247 |

**Per-peer comparison (final state):**

| peer | field.js | vlan-sync |
|---|---|---|
| kind | 139d / 112r / 4p / 5alpha-cov=4 | 95d / 0r / 2p / 5alpha-cov=4 |
| vocab | 13945d / 1001r / 5p / 5alpha-cov=5 | 4192d / 353r / 5p / 5alpha-cov=5 |
| cooccur | 14258d / 98r / 0p / 5alpha-cov=3 | 4419d / 42r / 0p / 5alpha-cov=3 |
| position | 2516d / 2203r / 4p / 5alpha-cov=4 | 936d / 688r / 3p / 5alpha-cov=4 |
| frequency | 106d / 0r / 1p / 5alpha-cov=5 | 93d / 0r / 1p / 5alpha-cov=5 |
| composer | 14594d / 217r / 4p / 4alpha-cov=1 | 2270d / 164r / 4p / 4alpha-cov=1 |

**Productivity shape (late_d / early_d ratio):**

| peer | field.js | vlan-sync |
|---|---|---|
| kind | 0.34 O2-slowing | 0.04 O2/O3 heavy saturation |
| vocab | 0.98 O1-sustained | 1.00 O1-sustained |
| cooccur | 0.99 O1-sustained | 1.01 O1-sustained |
| position | 0.85 O1-sustained | 0.86 O1-sustained |
| frequency | 0.05 O2/O3-saturation | 0.03 O2/O3-saturation |
| composer | 1.04 O1-sustained | 1.08 O1-sustained |

---

## 2. Headline finding — the architecture's behavior is corpus-invariant in shape

**The trajectory shapes match across both corpora.** Four peers
exhibit O1 (sustained productivity) on both corpora: vocab, cooccur,
position, composer. Frequency exhibits the same O2/O3 saturation on
both. The kind peer slows more sharply on vlan-sync (0.04 ratio vs.
0.34 on field.js) — discussed in §3 below.

**Number of promotions is comparable per token:**

- field.js: 18 promotions / 9243 tokens = 1 per 513 tokens
- vlan-sync: 15 promotions / 2831 tokens = 1 per 189 tokens

Vlan-sync actually produces *denser* promotion: 2.7× the promotion
rate per token despite the corpus being 31% the size. This is
consistent with vlan-sync having higher text-vocabulary diversity
(344 distinct texts in 2831 tokens = 12.1% diversity rate vs.
field.js's lower diversity per token in its kernel-code style).

**The lattice's structural-growth behavior is a property of the
architecture's mechanics, not of the specific corpus.** This is the
SE-11 §4 claim operating empirically: structure surfacing is
invariant *within the substrate's axis commitment* across different
input corpora.

---

## 3. Per-peer differences worth naming

**kind peer slows sharply on vlan-sync (0.04 ratio).** field.js had
5 distinct token kinds; vlan-sync has 6. But vlan-sync's kind
distribution is more skewed — networking-SPA code has many more
unique identifiers (344 distinct texts) packed into 2831 tokens,
which means the substrate sees more `ident` tokens at lower
recurrence. The kind axis's coarse 5-token alphabet saturates
faster on this denser identifier soup. **Importantly: kind peer
still promoted 2 sub-cascades on vlan-sync** (kind-cooccurs,
kind-with-cross-context). The saturation is in derivation growth,
not in promotion capability.

**kind peer had 0 ratifications on vlan-sync (vs. 112 on field.js).**
The kind-axis primitives that ratified on field.js
(kind-transition with neighbor kind-context patterns) didn't find
matching shapes on vlan-sync. Honest finding: this is the
predictive `when`-shape mismatch the falsification matrix names.
Not a lock, not a kernel failure; just that the predictive
constraint shapes the kind axis generated didn't match what
vlan-sync's kind-sequences actually produce.

**Composer's 4 sub-cascades, same families on both corpora:**
composer-pair, composer-extension, composer-axis-affinity,
composer-tuple. The composer's intersection structure is identical
in *families* across corpora; only the member counts differ
(field.js: 18+27+29+9=83 members total; vlan-sync: 27+41+39+13=120
members total — vlan-sync's composer found MORE intersections per
token, again consistent with higher per-token vocabulary diversity).

**Frequency's first-ever promotion happens on both corpora** at
roughly the same token-fraction. On field.js it happened by token
250 (window 1 of 37, ~2.7% in). On vlan-sync it happened by
token 100 (window 1 of 29, ~3.5% in). The cross-channel mechanism
that broke Phase 2's terminal saturation works the same way on
both corpora.

---

## 4. The reflexive-trap question, answered

**Does the lattice's behavior on field.js reflect substrate
self-reference (the corpus IS the substrate's source) or actual
architectural mechanics?**

Compared head-to-head:

- The promotion families are the same across both corpora (cross-
  context families on all axes that promote, composer's four
  intersection families).
- The productivity shapes are the same (4 peers O1, kind slowing,
  frequency saturating, all on both corpora).
- The promotion rate per token is actually HIGHER on vlan-sync
  (the unfamiliar corpus) than on field.js (the self-reference
  corpus).

**The reflexive trap did not produce a load-bearing effect.** If
the field.js results had been a substrate-recognizing-itself
artifact, vlan-sync would have shown qualitatively different
behavior — different promotion families, different productivity
shapes, different cross-channel effects. It did not. The Phase 3
findings stand independently of corpus choice.

This is the answer PLAN §9.3 was asking for: **the architecture's
behavior is corpus-shape-dependent (vlan-sync has more text
diversity → more composer intersections per token; field.js has
more kind-sequence regularity → more kind-axis ratifications) but
its mechanism is corpus-invariant.**

---

## 5. What this run does NOT show

Per discipline §2.5, naming what's still unanswered:

- **It still does not show that the substrate's surfaced structure
  corresponds to human-reader categories in vlan-sync code.** The
  vlan-sync application has identifiable structural patterns
  (IPC bus, VLAN classifier, sync polling loop). Whether any of
  the 15 promoted sub-cascades on vlan-sync correspond to these
  reader-recognizable patterns is a post-hoc analysis question
  the trajectory data alone doesn't answer.
- **It does not compare two unfamiliar corpora to each other.**
  The reflexive-trap check is binary (familiar vs unfamiliar); a
  stronger test would run on two unrelated unfamiliar corpora
  (e.g., vlan-sync + a different exodus SPA + an external corpus)
  and compare trajectories.
- **It does not test corpora with different host languages** (HTML,
  CSS). Per adapter-spec.md §1, those adapters are Phase 7
  candidates.

---

## 6. PLAN.md §9.3 closure

The corpus-shift finding documented in PLAN.md §9.3 is now
substantively closed:

- The mechanics findings of Phase 2 + Phase 3 are confirmed
  independent of corpus.
- The SE-11 §2.5 falsification target ("substrate surfaces
  patterns a reader would recognize in an unfamiliar SPA") is
  partially tested: the trajectory mechanics are confirmed on an
  unfamiliar SPA; the reader-correspondence question remains
  separate downstream work.
- Phase 4 (GPU resolution layer) can proceed without an
  outstanding foundation question.

---

## 7. References

- field.js trajectory: [phase-3-trajectory.tsv](phase-3-trajectory.tsv) + [phase-3-trajectory.md](phase-3-trajectory.md)
- vlan-sync trajectory: [phase-3-trajectory-vlan-sync.tsv](phase-3-trajectory-vlan-sync.tsv)
- vlan-sync promotion log: [phase-3-trajectory-vlan-sync-promotions.tsv](phase-3-trajectory-vlan-sync-promotions.tsv)
- vlan-sync run harness: [phase-3-trajectory-vlan-sync.js](phase-3-trajectory-vlan-sync.js)
- Original Phase 0 corpus decision: [PLAN.md §8](PLAN.md)
- Corpus-shift reconciliation: [PLAN.md §9.3](PLAN.md)
- SE-11 §2.5 falsification target: [canon/specification/SE-11-dimensional-resolution.md](../../canon/specification/SE-11-dimensional-resolution.md)
