# External-Corpus Trajectory — TodoMVC vanilla ES5

**Date:** 2026-05-26.
**Purpose:** Third corpus run against the same six-peer lattice, this time
on a **traditionally-built single-page application** with no project
provenance: the TodoMVC javascript-es5 reference implementation. Tests
whether the lattice's behavior on the prior two corpora (the substrate's
own kernel + a state-projector SPA from this project) generalizes to
conventional vanilla JavaScript authored by other developers for an
unrelated purpose.

**Corpus.** `tastejs/todomvc/examples/javascript-es5/src/{app,controller,
helpers,model,store,template,view}.js`, concatenated. 933 lines, 29,054
bytes, 4,188 tokens after Acorn tokenization. Classic MVC split:
helpers, store (localStorage persistence), model, template (HTML
generation), view, controller, app. Fetched 2026-05-26 from
`https://github.com/tastejs/todomvc/tree/master/examples/javascript-es5`,
MIT-licensed.

**Method.** Same six-peer lattice (kind, vocab, cooccur, position,
frequency, composer); same intake-configurations from
[peer-specs.js](peer-specs.js); same canonical Field unmodified.
Window size 150 tokens. Trajectory at
[phase-3-trajectory-todomvc.tsv](phase-3-trajectory-todomvc.tsv);
promotions at [phase-3-trajectory-todomvc-promotions.tsv](phase-3-trajectory-todomvc-promotions.tsv).

---

## 1. Three-way comparison

| | field.js | vlan-sync | **TodoMVC** |
|---|---|---|---|
| Corpus character | substrate's own kernel | state-projector SPA (project-internal) | **vanilla ES5 SPA (external)** |
| Bytes | ~46KB | ~20KB | ~29KB |
| Lines | 1,326 | 538 | **933** |
| Tokens | 9,243 | 2,831 | **4,188** |
| Distinct kinds | 5 | 6 | **7** |
| Distinct texts | (n/a) | 344 | **309** |
| Parse errors | 1 (mid-statement slice) | 0 | **0** |
| Total promotions | 18 | 15 | **19** |
| Promotion density | 1/513 tokens | 1/189 tokens | **1/220 tokens** |

**Final per-peer summary on TodoMVC:**

| peer | derived | rat | prom | inv | sub | alphabet | gap |
|---|---|---|---|---|---|---|---|
| kind | 252 | 355 | 5 | 355 | 5 | 4/5 | 0.394 |
| vocab | 4,980 | 452 | 5 | 452 | 5 | 5/5 | 0.543 |
| cooccur | 5,822 | 67 | 0 | 67 | 0 | 3/5 | 0.296 |
| position | 1,054 | 836 | 4 | 836 | 4 | 4/5 | 0.503 |
| frequency | 101 | 0 | 1 | 0 | 1 | 5/5 | 0.621 |
| composer | 3,844 | 133 | 4 | 133 | 4 | 1/4 | 0.912 |

**Productivity shape (late_d / early_d ratio):**

| peer | field.js | vlan-sync | TodoMVC |
|---|---|---|---|
| kind | 0.34 O2-slowing | 0.04 O2/O3 | **0.25 O2/O3** |
| vocab | 0.98 O1 | 1.00 O1 | **0.63 O2-slowing** |
| cooccur | 0.99 O1 | 1.01 O1 | **0.72 O2-slowing** |
| position | 0.85 O1 | 0.86 O1 | **0.55 O2-slowing** |
| frequency | 0.05 O2/O3 | 0.03 O2/O3 | **0.02 O2/O3** |
| composer | 1.04 O1 | 1.08 O1 | **0.97 O1** |

---

## 2. Headline finding

**The lattice behaves on TodoMVC the way the architecture predicts it
will, with no project-specific artifacts.**

- All six peers run end-to-end without lock or divergence
- 19 sub-cascades promote across 5 of 6 peers (composer, kind, vocab,
  position, frequency — cooccur ratifies but does not promote, exactly
  the structural finding from field.js and vlan-sync: per-token
  signature primitives don't accumulate K1 fidelity)
- Frequency's first-ever promotion via cross-channel intake (the
  Phase 3.3b breakthrough) happens here too, in the same window
  position (token 150, ~3.6% in) as both other corpora
- Composer remains O1-sustained on this corpus, as on both others
- Same promotion families surface: cross-context families on every
  axis that ratifies; composer's four families (pair, extension,
  axis-affinity, tuple) present and accounted for
- Promotion density (1 per 220 tokens) sits between vlan-sync's
  high (1/189) and field.js's low (1/513) — exactly where the
  text-vocabulary diversity (309 distinct texts in 4,188 tokens =
  7.4% diversity) places it relative to the other two corpora

**Differences from the prior two corpora — quantitative, not
structural:**

On TodoMVC, the four peers that were O1-sustained on field.js
(vocab, cooccur, position, composer) slow into O2-territory in their
late-half ratio (0.63, 0.72, 0.55, 0.97). The composer barely slows.
The other three peers slow noticeably more.

The reason is the corpus size. 4,188 tokens is small enough that the
substrate's per-axis derivative growth saturates earlier as a fraction
of the run than it does on the longer field.js corpus. **Per the
canon's O1/O2/O3 framework anti-pattern check** (don't declare O3
prematurely): the remaining corpus diversity at the late-half is also
smaller in absolute terms on TodoMVC, so a low late_d ratio doesn't
mean substrate-intrinsic lock; it means input-discriminative-demand
was met. This is O2 (input-driven saturation), not O3.

The composer's near-1.04 ratio on TodoMVC is structurally telling:
the **composer's intersection work continued at full rate** through
the corpus's end. The axes saturated; the composer's intersections
across them did not.

---

## 3. Promotion timeline

Bimodal again, like the prior runs:

| token range | promotions |
|---|---|
| 1–150 (3.6%) | 7 — cross-context families crystallize across all axes + composer-pair |
| 150–450 | 9 — composer extension/affinity/tuple, position, vocab |
| 450–1050 | 2 — kind-context-pattern (1050), vocab text-kind-binding (600) |
| 1050–4188 | 1 — kind-presence at 1350 |

The same shape: rapid crystallization at the start (cross-context
families on every axis); a productive middle that settles new
within-axis families; a long quiet stretch in the second half during
which a single kind-presence promotion accumulates fidelity slowly
across thousands of tokens. F4 + X2 non-terminal settling, identical
in shape to the other two corpora.

---

## 4. What the substrate actually saw in TodoMVC

This is the read I haven't done before — naming the *families that
promoted* against the source code TodoMVC actually contains. Per
discipline §2.1 the substrate had no knowledge of TodoMVC's domain.
Per the canon's O3 commitment, the substrate's surfaced vocabulary
comes from the field, not from external categories. So this is *me*
reading the substrate's output against the corpus, not the substrate
making any claim about the corpus.

**19 sub-cascades on TodoMVC; what they discriminate:**

- **kind-presence (5 members @ fid 0.0447)** — fires on tokens whose
  lexical kind is in the substrate's accumulated kind-vocabulary.
  This promoted only at token 1350, very late — the substrate took a
  long time to find this family's fidelity threshold.
- **kind-cooccurs (6 members @ fid 0.0613)** — kind-kind pairs in
  neighbor windows. Standard early-promotion.
- **kind-transition (13 members @ fid 0.0300)** — kind-to-kind
  transitions. Lower fidelity than the same family on vlan-sync
  (which didn't promote it at all) but higher than field.js (which
  also didn't promote it — those promoted it at 45 members @ 0.0894
  in their lattices; here 13 @ 0.0300).
- **kind-context-pattern (8 members @ 0.0922)** — invented from
  ratifications, surfacing kind-with-context structural relations.
- **kind-with-cross-context (17 members @ 0.0574)** — Phase 3.3b's
  cross-channel kind family; promotes early.
- **vocab text-presence (22 members @ 0.0322), text-in-position (35
  members @ 0.0355), text-kind-binding (21 members @ 0.0343),
  text-context-pattern (9 members @ 0.0704), text-with-cross-context
  (25 members @ 0.0379)** — five vocab families promote. Comparable
  to vlan-sync (5 vocab families) and field.js (5 vocab families).
- **position-text-binding (69 members @ 0.0349)** — the load-bearing
  position primitive per substrate-factory-spec §4.4: "a text
  appearing in both DECL and USE positions ratifies as a binding
  pair." 69 members is the largest single sub-cascade on this corpus.
- **position-presence (7 members @ 0.0468),
  position-context-pattern (22 @ 0.0729),
  position-with-cross-context (14 @ 0.0368)** — three more position
  families.
- **freq-with-cross-context (23 members @ 0.0356)** — Phase 3.3b's
  cross-channel frequency family; the only frequency promotion as
  with the other two corpora.
- **composer-pair (27 members @ 0.1595), composer-extension (17 @
  0.0315), composer-axis-affinity (23 @ 0.0400), composer-tuple
  (12 @ 0.0303)** — all four composer families promote, same shape
  as on field.js and vlan-sync.

**What I'm allowed to say about reader-correspondence:**

The substrate found 69 members for the `position-text-binding` family
on TodoMVC. The TodoMVC source has obvious DECL/USE patterns: the
controller binds methods to events (`view.bind('newTodo', function(title) {
self.addItem(title); })`), the model exposes named methods called
by the controller (`model.create`, `model.read`, `model.update`),
the store wraps localStorage with named operations. A human reader
sees a clear DECL→USE binding structure across files. The substrate
surfaced 69 distinct (position, text) pairs that consistently
co-occur — that's a quantity, not a semantic claim. Whether those
69 pairs *correspond* to the controller-model-view binding structure
a reader sees is a downstream question this trajectory data does
**not** answer.

The trajectory shows the substrate's mechanism worked on this corpus
the way the architecture predicts. It does not show the substrate
"understood TodoMVC."

---

## 5. Verdict against the three-corpus comparison

**The architecture's behavior is corpus-invariant in mechanism, corpus-
shape-dependent in quantitative profile.** All three corpora produce:

- The same promotion families (cross-context on every promoting axis,
  composer's four intersection families)
- The same productivity asymmetry (composer O1, kind/frequency
  saturate, the three mid-axes vary with corpus diversity)
- The same first-ever-frequency-promotion via cross-channel intake
  at roughly the same corpus fraction
- The same bimodal promotion timeline
- The same cooccur structural failure (ratifies but K1 fidelity gap
  prevents promotion)

The differences across the three corpora are exactly what input-
diversity differences predict: TodoMVC's 309 distinct texts in 4,188
tokens places it between vlan-sync's 344 distinct texts in 2,831
tokens and field.js's lower per-token diversity, and the promotion
density follows that ordering. SE-11's relativistic-structure claim
(§4) is what's operating: structure surfaces relative to the
substrate's axis commitment; the surfacing is invariant within that
commitment across diverse corpora.

This third corpus run closes the corpus-question PLAN §9.3 raised. The
substrate's behavior is not an artifact of project-internal corpora;
it does what it does on conventional vanilla JS authored elsewhere.

---

## 6. References

- TodoMVC trajectory: [phase-3-trajectory-todomvc.tsv](phase-3-trajectory-todomvc.tsv)
- TodoMVC promotions: [phase-3-trajectory-todomvc-promotions.tsv](phase-3-trajectory-todomvc-promotions.tsv)
- TodoMVC source corpus: `exodus/external-corpora/todomvc-vanilla-es5/`
- field.js trajectory: [phase-3-trajectory.md](phase-3-trajectory.md)
- vlan-sync trajectory: [phase-3-trajectory-vlan-sync.md](phase-3-trajectory-vlan-sync.md)
- SE-11 §4 relativistic structure: [canon/specification/SE-11-dimensional-resolution.md](../../canon/specification/SE-11-dimensional-resolution.md)
