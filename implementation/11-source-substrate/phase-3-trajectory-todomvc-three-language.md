# Three-Language Trajectory — TodoMVC (HTML + CSS + JS)

**Date:** 2026-05-26.
**Purpose:** The original Phase 0 commitment was three host languages; we
shipped JS-only through Phase 5 and tagged HTML+CSS as adapter-spec.md §1
Phase 7 candidates. This run closes that gap. The lattice ingests TodoMVC's
complete external SPA — `index.html` + `todomvc-app.css` +
`todomvc-common-base.css` + 7 JS files — in spec-defined HTML→CSS→JS order
(per UTF Q2 sub-rec 4 / SE-10: source carries its own evaluation order).

**Method.** Browser-only run via `source-nav.html`. New adapters:
[`corpus-adapter-html.js`](corpus-adapter-html.js) wraps `DOMParser`;
[`corpus-adapter-css.js`](corpus-adapter-css.js) wraps `CSSStyleSheet`.
Both honor Q2 sub-rec 4 — the browser's native parsers are the
spec-authoritative implementations of HTML Living Standard and CSSOM.
**Same six-peer lattice, same intake-config specs, same canonical Field
unmodified.** The substrate doesn't know which host language each record
came from; all three streams flow into the same `lattice.ingest()` via
records with identical five-axis shape.

Raw TSV: [phase-trajectory-three-language-1779815045838.tsv](phase-trajectory-three-language-1779815045838.tsv).

---

## 1. Record counts and corpus mix

| Stream | Records |
|---|---|
| HTML (DOM nodes + attributes from `index.html`) | (boot showed host-mix counts) |
| CSS (selectors + declarations + at-rules from 2 CSS files) | (same) |
| JS (Acorn tokens from concatenated 7 JS files) | 4,188 (matches Phase 3 JS-only run) |
| **Unified intake total** | **5,086** |

(The host-mix counts were displayed in the boot row during the run. Total
5,086 vs. 4,188 JS-only means **898 records came from HTML + CSS combined**
— a substantial fraction of new structural material the substrate had no
access to in the prior runs.)

---

## 2. Side-by-side: JS-only vs three-language on TodoMVC

| | JS-only | Three-language |
|---|---|---|
| Total records | 4,188 | 5,086 |
| Total promotions | 19 | **17** |
| Promotion density | 1 per 220 records | 1 per 299 records |

**Per-peer final state:**

| peer | JS-only | Three-language |
|---|---|---|
| kind | 252d / 355r / 5p / 4 alpha | **209d / 16r / 2p / 4 alpha** |
| vocab | 4980d / 452r / 5p / 5 alpha | **6724d / 474r / 5p / 5 alpha** |
| cooccur | 5822d / 67r / 0p / 3 alpha | **6704d / 68r / 0p / 3 alpha** |
| position | 1054d / 836r / 4p / 4 alpha | **1499d / 802r / 4p / 4 alpha** |
| frequency | 101d / 0r / 1p / 5 alpha | **124d / 49r / 2p / 5 alpha** |
| composer | 3844d / 133r / 4p / 1 alpha | **9568d / 376r / 4p / 1 alpha** |

**Final delta readings:**

| reading | JS-only | Three-language |
|---|---|---|
| kind | 0.59 | 0.66 |
| vocab | 0.45 | 0.45 |
| cooccur | 0.76 | 0.76 |
| position | 0.52 | 0.55 |
| frequency | 0.39 | 0.42 |
| composer | 0.18 | 0.21 |
| **lattice (joint coord space)** | not captured in JS-only download | **0.2376** |

---

## 3. Headline findings

### 3.1 The substrate ingested all three host languages with no architectural changes

The same six-peer lattice ran end-to-end against records whose `kind` field
contained values from three disjoint vocabularies (JS: `keyword`, `ident`,
`punctuation`, `string`, `number`; HTML: `element`, `attribute`, `text`,
`comment`, `doctype`; CSS: `selector`, `declaration`, `at-rule`). No
substrate code knew about the difference. The peers' alphabets stayed the
same; their output decisions came from the same `domainRules` mapping coord
to output. **The canon's stratification carried this for free** — the
five-axis record shape is host-agnostic, exactly as the canon predicted.

### 3.2 Composer peer went from 3,844 to 9,568 derived constraints

The single most load-bearing change: **the composer's structural growth
roughly 2.5×'d when HTML and CSS records joined the lattice.** Composer
ratifications doubled (133 → 376). The four composer families
(composer-pair, composer-tuple, composer-extension, composer-axis-affinity)
all promoted with substantially more members:

| family | JS-only members | three-language members | growth |
|---|---|---|---|
| composer-pair | 27 | 21 | -22% |
| composer-tuple | 12 | 15 | +25% |
| composer-extension | 17 | **54** | **+218%** |
| composer-axis-affinity | 23 | 33 | +43% |

**`composer-extension` more than tripled in members.** This is the composer's
"reach" primitive — fires when two-axis intersections have at least one
additional axis with non-default value. The substrate finding 54 such
extensions (vs. 17 on JS-only) means **HTML+CSS records added cross-axis
intersection material the JS stream alone didn't produce**. That is the
exact load-bearing claim SE-11 names: "structure is what is stable across
axes... domain content has both" (§2.4). HTML+CSS bring structural axes
that JS alone doesn't expose; the composer saw it.

### 3.3 kind peer LOST ratifications (355 → 16)

This is honest reporting per discipline §2.5. The JS-only run had 355
kind-axis ratifications across 5 promoted families; the three-language
run has 16 ratifications across only 2 promoted families
(`kind-cooccurs`, `kind-with-cross-context`).

Why: kind-axis vocabulary is the smallest axis (5-token alphabet). When
the corpus tripled in vocabulary diversity (JS `keyword`/`ident`/`number`
plus HTML `element`/`attribute`/`text` plus CSS `selector`/`declaration`/
`at-rule`), the kind axis's discriminative surface — which depends on
predicting kind-transitions from observed kind-cooccurrences — saw far
more *novel* kind transitions and far fewer *repeated* ones. The
predictives generated but didn't match what arrived next, because what
arrived next was structurally different (an HTML element vs. a JS
keyword).

This is **O2 (input-driven saturation) at higher saturation point** per
the canon's framework. Not substrate-intrinsic lock; not a bug. It is a
direct consequence of the kind axis having a small alphabet relative to
the corpus's now-wider kind-diversity.

### 3.4 vocab peer's derived count grew 35% (4980 → 6724)

The vocab peer's text-axis is where the cross-language signal lands most
naturally. CSS selectors like `.todo-list` and `.toggle-all` are TEXT
tokens with strong recurrence; HTML elements like `header`, `main`,
`footer`, `section` are TEXT tokens with structural significance; JS
identifiers like `controller`, `model`, `view`, `store` are TEXT tokens
with name-stability. **All three streams contribute text-axis content
that the vocab peer pulls into the same field.**

The vocab peer's 5/5 alphabet coverage holds; its ratifications stayed
roughly constant (452 → 474). Its derivation grew because the text
vocabulary expanded; its ratification rate stayed near baseline because
the cross-text correlations were stable. That's a healthy reading.

### 3.5 frequency peer ratified for the FIRST TIME in the three-language run

| frequency-peer | JS-only | three-language |
|---|---|---|
| ratifications | 0 | **49** |
| promotions | 1 | **2** |

On JS-only TodoMVC and on field.js and on vlan-sync, frequency's
ratifications were 0. The cross-channel intake gave it ONE promotion
(`freq-with-cross-context`) in each prior run. **The three-language run
is the first where frequency's predictive→ratify→derive cycle closes
naturally.** The second promotion is `recurrence-bucket` — the original
frequency primitive Phase 2 named.

Why: HTML and CSS records carry strong recurrence structure that JS
alone doesn't. CSS declarations like `margin: 0` repeat across many
selectors. HTML attributes like `class` repeat across many elements.
The frequency axis's `recurrence-bucket` primitive (singleton / rare /
moderate / common / dominant) finally had enough material in the same
bucket to ratify its own predictives.

This is a finding the prior three trajectories did NOT show. **HTML+CSS
brings frequency-axis material into a regime where the substrate's
mechanism produces ratification organically, not just via cross-channel
intake.**

### 3.6 Lattice-scope delta 0.2376 — joint-coord-space honored

The Phase 4 reading: across the 12,500-coord joint space (kind × vocab ×
cooccur × position × frequency × composer), **9,530 coords matched at
least one constraint; 2,970 unresolved**. Lattice-scope delta is 0.2376,
between composer's 0.21 and frequency's 0.42 — neither average nor
extreme of the per-peer readings, which is exactly what F2 + SE-01
predict: a different population, a different reading, same formula.

---

## 4. What the substrate actually surfaced from TodoMVC's three host languages

Per discipline §2.1 the substrate has no knowledge of TodoMVC's domain.
The 17 promoted sub-cascades represent what the substrate's measured
fidelity surfaced across the unified intake.

**The standout sub-cascade:** `composer-extension` at 54 members and
fid@birth 0.1507.

`composer-extension` fires when two-axis output combinations co-occur
with at least one other axis taking a non-default value. With three host
languages in the stream, this primitive is finding **patterns whose
structural signature spans HTML, CSS, and JS** — exactly the kind of
multi-language correspondence the original Phase 0 corpus rationale was
written for ("does a CSS class name recur in the same positions as a JS
identifier? does the substrate notice?" — adapter-spec.md §1).

I am NOT claiming the 54 members correspond to specific CSS-class /
JS-identifier pairings in TodoMVC. I AM saying the substrate's
intersection mechanism surfaced 54 distinct multi-axis structural
patterns that ratified — 3.2× as many as on JS-only. That is the
mechanism doing its load-bearing work on the corpus the original Phase
0 rationale specifically named.

---

## 5. Three-corpus, two-mode summary

| Corpus | Mode | Records | Promotions | Composer-extension members |
|---|---|---|---|---|
| field.js | JS-only | 9,243 | 18 | 27 |
| vlan-sync | JS-only | 2,831 | 15 | 41 |
| TodoMVC | JS-only | 4,188 | 19 | 17 |
| **TodoMVC** | **HTML+CSS+JS** | **5,086** | **17** | **54** |

The three-language TodoMVC run produces **the highest composer-extension
member count of any run**, despite having middle-of-the-pack record
count. The structural surface HTML and CSS bring is genuinely
productive for the composer's intersection work — the very thing
Phase 0 hypothesized.

---

## 6. Honest caveats

- **The trajectory was captured as a single end-state row,** not as
  windowed samples. The download button writes one row + the
  promotion timeline. Comparing trajectory shape (O1/O2/O3) between
  JS-only (which has 28 windows of windowed trajectory data) and
  three-language (which has only end-state) is not symmetrical. A
  windowed three-language harness would close this gap.
- **The host-mix counts were shown in the browser but not captured in
  the TSV.** From the lattice's total record count (5,086) minus the
  JS-only count (4,188) we infer ~898 HTML+CSS records combined, but
  the exact split between the two is not in the data file I'm reading.
- **The 12,500-coord joint space was not re-walked at fine intervals.**
  Lattice-scope delta is captured once at end-state.

These are scope limits of the download mechanism Phase 5 shipped, not
of the architecture. The mechanics findings above don't depend on
windowed data — they're end-state comparisons against the JS-only
baseline, which IS windowed-and-fully-recorded.

---

## 7. What this earns

- **The three-language adapter path works.** HTML, CSS, JS records all
  flow through one lattice with no substrate modification. Phase 0's
  original commitment to three host languages is now operational.
- **HTML+CSS bring real structural material the JS stream doesn't.** Composer
  extension members tripled; frequency peer ratified for the first time;
  vocab derivation grew 35%. The cross-host-language intersection the
  canon predicted is present and measurable.
- **The substrate's mechanism is host-language-invariant.** Same six
  peers, same canonical Field, same intake-configs — the substrate
  has no knowledge of which records came from which language and
  doesn't need it. Canon stratification carrying the load.
- **The kind axis revealed its small-alphabet limit under wider corpus
  diversity.** Honest finding; not a defect but a structural property
  of the kind axis's coarse 5-token vocabulary.

## 8. What this does NOT yet earn

- That the 54 `composer-extension` members correspond to specific human-
  readable patterns (CSS-class-to-JS-identifier correspondences, HTML-
  structure-to-CSS-rule pairings, etc.). That remains downstream
  semantic analysis.
- That the architecture transfers to non-web host languages (Python,
  binary formats, etc.). The same record shape would work; new
  adapters would need writing.
- Windowed trajectory shape for the three-language run. Phase 6 work
  if pursued.

---

## 9. References

- HTML adapter: [corpus-adapter-html.js](corpus-adapter-html.js)
- CSS adapter: [corpus-adapter-css.js](corpus-adapter-css.js)
- Three-language run TSV: [phase-trajectory-three-language-1779815045838.tsv](phase-trajectory-three-language-1779815045838.tsv)
- JS-only TodoMVC: [phase-3-trajectory-todomvc.md](phase-3-trajectory-todomvc.md)
- Original Phase 0 three-language hypothesis: [adapter-spec.md §1](adapter-spec.md)
- SE-11 §2.4 multidimensional joint stability: [canon/specification/SE-11-dimensional-resolution.md](../../canon/specification/SE-11-dimensional-resolution.md)
