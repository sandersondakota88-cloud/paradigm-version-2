# UTF Decision Questions

A numbered series of questions whose answers, taken together, determine
the shape of the universal type format specification. Designed for
capacitive decision-making — each question is small, isolatable, and
sequenced so that early answers don't pre-commit you to later ones.

**How to use this document.**

- Read one question at a time. Answer it in your own voice, in plain
  text, below the question.
- After answering, the spec scaffolding can update to reflect that
  decision. Subsequent questions may sharpen or narrow based on what
  was decided.
- If a question doesn't yet feel answerable, mark it `DEFERRED` with
  a note about what would let you answer it later.
- If a question is malformed or asks the wrong thing, mark it
  `REJECTED` with a reformulation.

**Discipline note.** Each question has a structural ground in either
existing canon or the empirical record from Phases A/B, NOT-1/2, 4a/4b,
5.7.5, 5.7.7, and 6. The questions don't introduce new mechanisms.
They ask you to commit to one of several structurally consistent
readings of what's already there.

-----

## Foundational questions (must answer before any UTF section can be specified)

### Q1. Vocabulary closure: closed at spec time, open through emergence, or both?

**Three answer shapes:**

- **A. Closed only.** UTF enumerates every kind the substrate will ever
  carry. The vocabulary is finite, defined in `02-kind-vocabulary.md`,
  and never grows. This is what the 2026-05-15 foundations document
  implies.

- **B. Open only.** UTF specifies the structural shape (typed-attribute-
  bearing nodes with predicate-assignment-specificity-identity-texture)
  but does not enumerate kinds. The substrate develops its kind
  vocabulary through operation. Spec defines the *form*; the substrate
  fills the *content*.

- **C. Two layers.** UTF enumerates a small closed set of *primitive*
  kinds (what the kernel routes) and a discipline by which *emergent*
  kinds form through composition and invention. The Phase 6 melting-pot
  evidence supports this shape (16 seed abilities + open invention).

**Your answer:**

```
(to be written)
```

-----

### Q2. If primitive kinds are closed (Q1 = A or C), how many are there?

**Skip if Q1 = B.**

The Phase 6 lattice substrates use exactly five `kind` values across
all duel variants: `seed`, `derived`, `predictive`, `ratified`, `meta`.
Phase 4b adds `compound`. The 2026-05-15 foundations document
enumerated eight (rule, region, intern-table entry, sub-cascade, trace
event, modulation reading, delta reading, hash record), but several of
those look more like *sub-roles of `meta`* than independent primitives.

**Three answer shapes:**

- **A. Five (seed, derived, predictive, ratified, meta).** Matches Phase
  6 directly. Compounds are an optimization Phase 4b carries but the
  lattice approach handles via separate substrates.

- **B. Six (the five plus compound).** Honors Phase 4b's compound
  primitive as load-bearing.

- **C. Smaller (four or fewer).** Some of the five collapse — e.g.,
  ratified is just derived with a transition history; predictive is
  just derived with a reaching shape. The primitive set could be
  smaller if these are read as states of one underlying kind.

- **D. Defer this question.** Pick the answer after specifying what a
  primitive *is* in UTF terms (Q3).

**Your answer:**

```
(to be written)
```

-----

### Q3. What is a "primitive kind" *for*?

This question shapes Q2's answer. Three readings of what role primitives
play:

- **A. Routing discrimination.** A primitive kind is a value the kernel
  dispatches on. If two would-be-primitives never get dispatched
  differently, they're not separate primitives. Under this reading,
  predictive and derived might collapse (both get routed the same way
  by the kernel; what differs is their internal state).

- **B. Structural identity.** A primitive kind names a *kind of
  structural commitment* the substrate makes. Predictive and derived
  are distinct because they commit to different things (reaching
  forward vs. recording what's here).

- **C. Lifecycle position.** A primitive kind names a position in the
  constraint's life: seed (born permanent), derived (born from input),
  predictive (born from gap), ratified (transitioned from predictive
  by confirmation), meta (born from family).

These produce different vocabulary sizes. Reading A produces the
smallest set; reading C produces the largest; reading B is in the
middle.

**Your answer:**

```
(to be written)
```

-----

### Q4. Where does the substrate's vocabulary growth live?

Phase 6 melting-pot demonstrates two growth mechanisms operating
concurrently:

- **Intake-side growth:** new *tokens* enter the substrate's input
  stream over time (cross-channel tokens, prior-output tokens,
  invented abilities tagged with their context).
- **Action-side growth:** new *action vectors* are invented at
  ratification/promotion events, sampled from primitive centroids.

**Question:** does UTF need to commit to either of these as part of
the spec, or are both purely substrate-internal (UTF specifies the
node shape; what the substrate does with intake and action is its
business)?

- **A. UTF is silent.** Neither growth mechanism is in UTF. The
  substrate handles them as implementation choices.

- **B. UTF commits to invention discipline.** A specific commitment
  that emergent kinds at the ratification/promotion event are
  first-class UTF nodes the same way seeds are. This makes Phase
  6's invention pattern load-bearing for any implementation.

- **C. UTF commits to both intake and action growth.** Strongest
  commitment; corresponds to the layered vocabulary in the Phase 6
  research article §3.

**Your answer:**

```
(to be written)
```

-----

## Composition questions (answer after foundational)

### Q5. Lattice composition: how committed?

The Phase 6 evidence is that "more kinds" is structurally answered by
"more substrates in a lattice." This is a substantial structural
commitment if UTF makes it.

- **A. Lattice composition is canonical.** UTF commits that the
  architecture's preferred composition pattern is multiple uniform
  substrates with per-substrate intake configuration. Single-
  substrate-rich-vocabulary implementations are valid but secondary.
  SE-12 (compounds) is reframed as a single-substrate optimization.

- **B. Lattice composition is one valid pattern among others.** UTF
  doesn't privilege it. Both single-substrate-rich and multi-substrate-
  lattice are first-class. The author of any specific implementation
  chooses.

- **C. Defer.** This is a deeper structural commitment than UTF needs
  to make. Note the pattern, don't commit to one shape over the other.

**Your answer:**

```
(to be written)
```

-----

### Q6. Cross-substrate channels: are they a UTF concept?

Phase 6 implements cross-substrate channels as stateless origin-tagged
tokens (`'opp-' + lastOutput`) appearing in another substrate's input
stream. The substrate doesn't "have" channels; channels emerge from
intake wiring.

- **A. Channels are not UTF.** UTF is silent on inter-substrate
  communication. Channels are an implementation pattern at the lattice
  level. UTF nodes are within-substrate.

- **B. Channels get a UTF primitive.** A `channel-token` kind, or
  something similar, makes the cross-substrate communication pattern
  first-class in UTF. Adapters that wire channels produce these tokens.

- **C. Channels are emergent, not specified.** UTF acknowledges
  channels as a structural pattern the substrate can develop but does
  not specify them. Treats them as the lattice-design equivalent of
  the sub-cascades that emerge within a single substrate.

**Your answer:**

```
(to be written)
```

-----

## Encoding questions (answer after foundational and composition)

### Q7. Canonical encodings: how many, in what priority order?

The 2026-05-15 foundations named three encodings as syntactically
equivalent: stylesheet form, JSON form, XML form. NEW_SPA proves the
stylesheet form is operationally primary in browser contexts. VSF
binary (algorithms 09-11) is the project's canonical binary encoding.

**Question:** which encoding(s) does UTF commit to as canonical?

- **A. Stylesheet is primary; others are conversions.** Reflects the
  browser-as-host empirical reality. Stylesheet form is what gets
  resolved; JSON/XML/VSF are transport forms that compile to it.

- **B. All four equivalent.** UTF specifies the structural shape;
  the encoding is a packaging choice. Each implementation picks.

- **C. VSF binary is primary; others are surfaces.** Reflects the
  algorithms 09-11 commitment to binary as the spec form. Other
  encodings are presentation layers over VSF.

- **D. Defer.** Encoding commitments are not foundational; specify
  the shape first and address encoding in `05-canonical-encodings.md`
  separately.

**Your answer:**

```
(to be written)
```

-----

### Q8. Identity: content-addressed by what?

The 2026-05-15 foundations specified content-addressed identity via
algorithm 13 (Merkle hashing). The Phase 6 RESEARCH_NOTES surfaced
that *settling is non-replicable* — identical content + identical
history would not produce identical settling because settling happens
in time.

**Question:** does UTF identity commit only to content (algorithm 13
as specified), or does it also need to commit to a *position-in-
substrate-history* dimension?

- **A. Content-only.** Algorithm 13 as already specified. Two nodes
  with identical content are the same node, regardless of which
  substrate or which moment.

- **B. Content + position.** UTF identity carries both the content
  hash AND a position-in-time signature (step, scope, substrate
  identity at moment of materialization). Two nodes with the same
  content but different positions are *related but not identical*.

- **C. Defer to RESEARCH_NOTES Phase 6 follow-up.** This is the
  substrate-instantiation question. Specify content identity now;
  position-identity when (and if) substrate-instantiation work is
  picked up.

**Your answer:**

```
(to be written)
```

-----

## Discipline questions (answer last)

### Q9. What does UTF *not* commit to?

Every prior question commits UTF to something. This question commits
UTF to *not* committing to certain things. The non-claims section is
how the spec protects against inflation.

Candidates for "UTF does not commit to":

- Whether substrates are continuous-time or discrete-step (yesterday's
  Reading A vs. Reading B question, deliberately deferred)
- The specific back-pressure mechanism for scale gating (P6 addendum
  deferred this)
- Cognitive parallel (DEFINITION §6 makes this analogical only)
- Specific intake configurations for any implementation
- Specific centroids for invention
- Specific selection functions for recall
- Specific algorithm for content-hashing (algorithm 13's mechanism is
  implementation choice within the structural commitment)

**Question:** which of these does UTF explicitly *not* commit to, in
its non-claims section?

- **A. All of the above.** UTF is structural shape only; everything
  operational is implementation choice within the shape.

- **B. Some of the above.** Pick which non-claims belong in UTF's
  non-claims section; others belong in different spec entries.

- **C. Defer this question.** Specify the claims first; the non-claims
  will be obvious after.

**Your answer:**

```
(to be written)
```

-----

### Q10. UTF versioning: how does UTF evolve?

UTF's vocabulary may need to grow (new primitive added, deprecated
primitive removed, encoding format updated). How is this handled?

- **A. Semantic versioning (1.0, 1.1, 2.0).** Compatible additions
  bump minor; breaking changes bump major. Implementations declare
  what UTF version they support.

- **B. Living standard, monotonic only.** UTF can add but never
  remove. Implementations conforming to UTF-at-time-T conform to all
  later UTFs. This honors F5 (irreversibility) at the spec level.

- **C. Content-addressed UTF.** Each UTF specification has its own
  content hash; implementations declare which UTF-hash they implement.
  Backward compatibility is per-implementation, not spec-mandated.

- **D. Defer.** Versioning is `06-versioning.md`'s job. Specify the
  shape first.

**Your answer:**

```
(to be written)
```

-----

## How the scaffolding will work

Each question's answer determines a section of the UTF specification.
After you answer Q1, I scaffold `02-kind-vocabulary.md` accordingly.
After Q2, I narrow `02-kind-vocabulary.md` to the specific primitive
set. Continuing through Q10 produces a complete UTF specification
deliberately, in pieces small enough to consider on their own.

The order isn't strictly enforced. If you want to answer Q5 before Q2,
the scaffolding adapts. Q1 is the only one that has to come first
because everything downstream depends on the closure-vs-emergence
choice.

**Pacing note.** Don't feel obligated to answer all ten in one
sitting. The questions wait. The empirical record (Phases A/B, NOT,
4a/4b, 5.7, 6) doesn't change while you decide.

-----

## Live status

| Date (yyyy-mm-dd) | Action |
|---|---|
| 2026-05-17 | Questions written. Companion to `canon/UTF/research/phase-6-substrate-duels-analysis.md`. Each question is structurally grounded; answer at your own pace; UTF foundations revision proceeds as answers arrive. |

Updates appended as questions get answered or reformulated.
