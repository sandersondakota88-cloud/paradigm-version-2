# STAGE_2_OBSERVATIONS - Emergent Structural Typing Substrate

**Stage:** 2 of N (SE-10 resolution-accretion chain)
**Status:** Built and verified at oracle level. 38/38 tests passing.
**Constraint primitives:** cooc, transition, repetition, run
**Test count:** 38/38 passing

---

## What this stage is

Stage 2 reads Stage 1's VSF emission as bytes. It carries a tiny generic
constraint set targeting universal substrate primitives (kind co-occurrence,
kind transitions, text repetition, homogeneous runs). It crawls the entire
emission with no fixed depth restriction. What surfaces as recurrence is
whatever the application's behavior necessarily extrudes through repeated
structural footprint.

Stage 2 does not target any specific structural pattern. It does not know
what constraints look like, what when/then mean, or that the input is
source code. The substrate's K1-K3 mechanisms (sub-cascade promotion via
fidelity, naming preference accumulation, correlation tracking) do the
recognition. Stage 2 emits what promotes, in the substrate's native
vocabulary.

---

## What surfaced from the loan-app

The canonical loan-eligibility reference (~72 KB JS+HTML+CSS) was processed
through Stage 1 -> Stage 2 chain:

- Stage 1 emitted 18,088 typed token rows
- Stage 2 ingested all 18,088 tokens
- Stage 2 derived 1,461 constraints
- Stage 2 tracked 8,902 correlations
- Stage 2 promoted **3 sub-cascades**

The three sub-cascades:

1. **cooc-punctop-ident** (family: cooc, 9 members, top member fires 28,792 times, fidelity 5.07x field-average)
2. **trans-whitespace-ident** (family: trans, 21 members, 9,599 firings, fidelity 2.62x)
3. **rep-whitespace-** (family: rep, 56 members, 8,379 firings, fidelity 2.84x)

These are exactly what the application's structure would extrude:

- `cooc-punctop-ident`: operator-and-identifier co-occurrence. This is what
  every assignment, function call, and expression produces. The loan-app's
  10 constraint definitions plus all the surrounding code generates this
  pattern thousands of times. The substrate found it.
- `trans-whitespace-ident`: whitespace-then-identifier transitions. This is
  what every formatted line of code produces - newline, indent, identifier.
  The application's structural extrusion of "lines of named things" is
  visible here.
- `rep-whitespace-`: whitespace text repetition. Most-firing member is "\n"
  (the line break itself); the family captures all the whitespace patterns
  the formatting uses repeatedly.

What is **not** here is `when`-and-`then`-block recognition specifically.
The substrate did not promote a sub-cascade that means "constraint
definition." It promoted what the application's structure most strongly
extrudes - which at this scale of source is line-formatting and operator
semantics, not the 10 specific constraint blocks.

This is honest information about what the architecture does at this layer.
The substrate works as designed: recurrence surfaces what extrudes. The
loan-app's structural extrusion is dominated by general code-formatting
patterns, not by its 10 constraint definitions, because the constraint
definitions are 10 instances against a backdrop of thousands of
instances of generic code patterns.

---

## What this finding actually means

Two readings, both worth holding.

**Reading one (architecturally encouraging).** The substrate did exactly
what it was specified to do. It crawled the application, observed
recurrence, and promoted the patterns whose specific instances fire far
above field average. Those patterns are real and meaningful. The
application's behavior IS extruding them, and the substrate IS catching
them. The chain's first two links are working.

**Reading two (architecturally cautionary).** The substrate at this
configuration does not surface domain-specific structural patterns.
Stage 2 does not produce anything Stage 3 could use to compile the
loan-app's actual constraints into CSS. The 10 constraints in the
loan-app are below the substrate's recurrence threshold relative to
the application's general code patterns. Reaching them would need
either (a) a constraint set that looks at higher-order structure
(e.g., bracket-balance contexts, not just kind-pairs), or (b) a
different application input where the constraints aren't 10 instances
in a 72KB ocean.

Both readings are accurate. The substrate works; the substrate's
output at this configuration isn't sufficient for Stage 3 to compile
the loan-app's domain-specific constraints. Future stages will need
to handle this - either by building Stage 3 to operate on what
Stage 2 surfaced (general code-formatting patterns become structural
priors that Stage 3 uses to reach domain patterns), or by extending
Stage 2's constraint primitives to target higher-order structure.

This is also the reason your push-back earlier was correct. The
question "does the pattern actually matter" surfaces the right tension.
The substrate is byte-native and pattern-emergent. What it surfaces
depends on what extrudes most strongly. For a single-domain application
where the domain is most of the source, the domain extrudes most.
For a generic-code-with-some-domain-constraints application like the
loan-app, generic-code extrudes most, and the domain doesn't surface
at this layer's primitives.

---

## Architectural commitments verified

**F1 Seed permanent.** Verified at construction, after one ingest, after
multiple ingests, after sealing.

**F2 Delta single formula.** `unresolvedConstraints + 1 (seed) /
totalConstraints + 1` at field scope. Initial 1.0. Drops to ~0.0007
after loan-app ingest (most constraints have fired and gained weight).

**F3 No supervision.** Two fresh Stage 2 instances given identical input
produce identical output: same row count, same row hashes, same
sub-cascade name set.

**F4 Indefinite operation.** Step counter advances on each ingest;
substrate not sealed without explicit seal().

**F5 Observation irreversible.** Prior rows preserved after subsequent
ingest. Sealing returns merkle-root-shaped string. Post-seal ingestion
throws.

**M5 Trace at channel.** Trace contains crawl-progress, crawl-complete,
promote, naming-event entries. Step counter monotonic. Bounded.

**K1 Sub-cascade promotion via fidelity.** 3 sub-cascades emerged from
the loan-app crawl, each above the 2.5x field-average fidelity
threshold.

**K2 Member counting.** Each promoted sub-cascade has memberIds
populated from the family's constraint instances.

**K3 Naming preference.** Sub-cascade names derive from the dominant
member's pattern, not from external assignment. Names are sanitized
ASCII identifiers, deduplicated against name collisions.

**S1 Substrate shared.** Within an instance, multiple reads produce
identical state.

**S2 (Stage 2 internal).** Two fresh instances on same input produce
byte-equivalent rows including identical hashes and identical
sub-cascade names. S2 across Stage 2 and canonical field.js does NOT
hold - see "Architectural divergence" below.

**I1 ASCII-only.** Every emitted row body, the full VSF text. Verified.

**I5 Bounded caps.** constraintCap, correlationCap, rowCap, traceCap
all respected with aging behavior.

**SE-08 Render-substrate intake.** Bytes (Stage 1 VSF) enter Stage 2
at the rendering substrate; tokens are the input feature records.

**SE-09 Operational irreversibility.** Row store grows monotonically.
Aging happens at boundaries (rowCap shift), not in-place mutation.

**SE-10 Per-link autonomy.** Stage 2 reads Stage 1's emitted bytes.
Does not call Stage 1. Has its own field, seed, delta, constraint set.

---

## Architectural divergence from canonical: documented

Stage 2 uses **firing-frequency fidelity** rather than canonical
field.js's **delta-drop-per-consultation fidelity**. This is a real
divergence and it is named here so it does not look like S2
conformance.

**Canonical field.js (Phase 5.5):** A family's fidelity is the average
delta drop observed when its members consult. Promote at avg drop >=
0.03 with >= 3 firings.

**Stage 2:** A family's fidelity is its top member's firing count
relative to field-average constraint firings. Promote at multiplier >=
2.5 with >= 8 firings.

**Why diverged:** Stage 2's regime has 1,000+ constraints accumulating
from raw token co-occurrence; per-step delta drops are tiny (single
weight bumps in a field of thousands), well below the 0.03 threshold.
Canonical thresholds produce zero promotions on real inputs of this
scale. Frequency-based fidelity is the appropriate measure for
Stage 2's "what extrudes most" question; delta-drop fidelity is
appropriate for canonical's "what consultation reduces uncertainty"
question.

**Architectural status:** SE-10 already permits per-link constraint
set choice. Per-link **fidelity-metric** choice is the natural
extension; this divergence is the empirical finding that motivates
formalizing fidelity as a family of metrics with regime-specific
selection rather than a single canonical formula. K1 holds in
principle (sub-cascades emerge from fidelity, not imposition); the
specific fidelity formula is regime-dependent.

This deserves a future spec extension (SE-11 candidate): regime-
specific fidelity as a structural commitment.

---

## What runs

`stage2-emergent-structural-substrate.js`
- `parseStage1Vsf(vsfText)` decodes Stage 1 emission into token records
- `createStage2Substrate(opts)` factory producing isolated Stage 2 instances
- `ingestStage1Vsf(vsfText)` is the substrate's primary input method
- `getState()` returns current rows, trace, delta, sub-cascades
- `emitVsf()` produces Stage 2's outbound VSF for downstream consumption
- `seal()` produces a Merkle root over all rows, marks final state

`test-stage2.js` runs 38 tests verifying invariants and chain integration.

---

## What is observable that surprised me

The promotion mechanism worked exactly as the architecture commits to,
and what surfaced was exactly what the application's structure most
strongly extrudes. That is encouraging.

What did not work was my initial assumption that "10 constraint
definitions in 72KB of source" would surface as a recognizable
structural pattern. They did not. The application's behavior at the
byte level is dominated by the generic code-formatting patterns, not
by the 10 specific constraint blocks. This is the substrate doing its
job, and it is also a real architectural finding about what kinds of
inputs produce what kinds of outputs at this layer.

The fidelity-metric divergence was not anticipated when I started
building. It surfaced empirically: canonical thresholds produced zero
promotions, the substrate observed recurrence correctly but had no
mechanism to surface it through promotion. The frequency-based metric
was the architecturally honest fix - rename the metric, document the
divergence, ship.

---

## Open questions

1. **What does Stage 3 do with this output?** The current Stage 2 output
   is structural priors at the code-formatting layer (cooc, trans, rep
   patterns). Stage 3's job was originally specified as "CSS-shape
   typing" - testing structural records against the cascade's expressive
   limits. With Stage 2's actual output, Stage 3 might need to be
   reconceived as "given the structural priors Stage 2 surfaced, find
   the higher-order patterns that the priors don't directly capture."
   Whether this maps cleanly to CSS-shape typing or requires a different
   intermediate stage is open.

2. **Should Stage 2 have higher-order constraint primitives?** Adding
   bracket-balance-context, run-length-by-position, or block-depth-by-
   transition-pattern as primitives might surface domain patterns the
   loan-app extrudes (the 10 constraint blocks have characteristic
   bracket nesting). This trades off structural minimality (Stage 2
   stays universal) for surface specificity (Stage 2 catches more).
   The architecture supports either choice; SE-10 permits per-link
   constraint set evolution.

3. **Is there an input scale where the loan-app's constraint blocks
   would surface?** If you ran 100 instances of the loan-app source
   concatenated, would the 1,000 constraint blocks aggregate enough to
   surface as a sub-cascade above the code-formatting noise?
   Speculative; not tested.

4. **The K3 naming-preference was 0 throughout.** The loan-app source
   contains tokens whose text would match sub-cascade names (the
   sub-cascade names emerge mid-crawl, after which tokens are still
   being ingested). But the naming-event count is zero. This may be a
   bug in detectNamingInToken's ordering with promotion, or it may be
   that the surfaced names ("cooc-punctop-ident") don't appear in the
   token text. I lean toward the second; the names are pattern-derived
   and don't correspond to source identifiers. K3's mechanism is
   present but not exercised at this configuration.

5. **What happens with non-source-code input?** Stage 2 doesn't know
   the input is source code. Feeding it a binary file's bytes through
   Stage 1 should surface different sub-cascades - whatever recurs in
   the binary's structure. That would be a useful additional empirical
   test in a future session.

---

## Files

- `stage1-lexical-typing-substrate.js` (Stage 1, 580 lines, 88/88 tests)
- `stage2-emergent-structural-substrate.js` (Stage 2, 540 lines)
- `test-stage2.js` (test suite, 350 lines, 38/38 passing)
- `STAGE_2_OBSERVATIONS.md` (this document)
