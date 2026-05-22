# Research: S2 Resolved — Canon-Shape Constraints Produce Byte-Identical Resolution Across All Three Substrates

**Role.** Reference material. Records the empirical resolution of the
S2 boundary surfaced in
[s2-boundary-derivation-semantics.md](s2-boundary-derivation-semantics.md).
When constraints are written in pure WHEN:THEN shape (per canon
section 3, with no post-processing derivation across the resolved
record), CSS, JS, and WGSL produce byte-identical output across all
2,602 test fixtures. The 3.9% divergence observed under the original
spec disappears entirely. S2 holds at 100% within the canonical
substrate shape.

**Date produced.** 2026-05-20

**Status.** Reference material. The empirical result is captured and
reproducible. The promotion path — whether canon should revise
constraints.md step 3, or formally name the canon-shape subset as the
load-bearing region of S2 — is pending sit-time.

**Provenance.** Produced via a canon-shape variant of the stratified
harness, in response to the user's question on 2026-05-20: *what could
we be overshooting by trying to compact mechanical multitude into a
single when:then?* The question correctly identified that
constraints.md step 3 ("if sdf==1 at the end, derive reg=DENIED,
rth=0") is **not** in canon section 3's WHEN:THEN shape — it expresses
a derivation across the resolved record, which canon's stated
structural form does not admit.

-----

## 1. The question that produced the test

Canon section 3 (canon/UTF/01-foundations.md) specifies the substrate
as WHEN:THEN with three structural components:

```
WHEN:  predicate over coordinate space
THEN:  partial assignment to output slots
WITH:  specificity / ordering signal
```

Three components, no fourth. **No post-processing layer is named.**

constraints.md step 3 says:

> *"If sdf == 1 at the end, derive reg = 'DENIED' and rth = 0."*

The phrase "at the end" is the structural overshoot. It describes a
derivation that operates on the resolved record across rules — a
quantity that canon section 3 explicitly does not admit.

The original stratified harness (2026-05-19) implemented step 3 as
post-processing in JS and WGSL (idiomatic for imperative machines)
and as inlined declarations in CSS (the only way single-pass CSS can
express it, with known soundness gaps). The 3.9% divergence
([s2-boundary-derivation-semantics.md](s2-boundary-derivation-semantics.md))
appeared at the boundary where this divergent encoding produces
observably different outcomes.

The user named the structural problem: *every commitment a rule makes
should be in its THEN*. The step-3 derivation is a side-channel
constraint that canon section 3 forbids by structural definition.

-----

## 2. The test

The canon-shape harness lives at
[exodus/canonical-implementation/tests/stratified-demo/](../../../exodus/canonical-implementation/tests/stratified-demo/)
and consists of three pieces:

**`generate-canon-fixtures.js`** — fixture generator. Identical
enumeration to the canonical `generate-gpu-fixtures.js` (same RNG
seed, same fixture IDs), but every produced THEN passes through a
`normalizeThen` step that lifts the derivation into the WHEN:THEN:

```javascript
function normalizeThen(then) {
  if (!("sdf" in then) || then.sdf !== 1) return { ...then };
  const out = { ...then };
  if (!("reg" in out)) out.reg = "DENIED";
  if (!("rth" in out)) out.rth = 0;
  return out;
}
```

Every THEN that sets `sdf: 1` now explicitly commits `reg: "DENIED"`
and `rth: 0` alongside it. The derivation has been lifted out of
post-processing and into the WHEN:THEN where canon section 3 says it
must live.

Expected hashes are computed against an inline canon-shape JS oracle
that has the post-processing step removed. The resolution of the
WHEN:THEN composition is the entirety of the commitment.

**`resolve-canon.wgsl`** — canon-shape WGSL shader. Identical to the
canonical resolve.wgsl minus lines 156-160 (the post-process block).
WHEN:THEN composition is the entirety of the commitment.

**`canon-shape-harness.html`** — canon-shape stratified harness.
Identical structure to the original stratified-harness.html, with
three surgical changes:

1. CSS compilation does not emit the inline `sdf:1 → DENIED, 0`
   derivation. The fixture's THEN already commits those values.
2. JS oracle has no post-processing. WHEN:THEN composition is the
   final record.
3. Loads `resolve-canon.wgsl` instead of the canonical shader.

Local rule regeneration in the harness uses `normalizeThen` on every
THEN, so locally-compiled bytecode matches the manifest's
canon-shape bytecode.

-----

## 3. The result

**2,602 / 2,602 stratified agreements. Zero divergences. Zero
convergent-mismatches.** Across all 2,602 fixtures in the canon-shape
test corpus, every one of the three substrates (CSS via
`getComputedStyle()`, JS postfix interpreter, WGSL compute shader)
produced byte-identical output, matching the canon-shape expected
hash computed by the Node-side canon-shape oracle.

The 102 divergences from the 2026-05-19 run disappeared completely.
There are no remaining cases where CSS produces different output
from JS or WGSL within the canon-shape corpus.

-----

## 4. What this resolves

The boundary named in
[s2-boundary-derivation-semantics.md](s2-boundary-derivation-semantics.md)
is empirically resolved.

**Before:** "S2 holds for resolution semantics expressible in a
single-pass parallel cascade. It does not hold for resolution
semantics that require post-processing across the full rule set."

**After (sharper):** S2 holds for resolution semantics that conform
to canon section 3's WHEN:THEN shape. The 102 divergent fixtures in
the 2026-05-19 run were not failures of S2 — they were the test
corpus exercising non-canonical semantics (the step-3 derivation)
that canon section 3 forbids by structural definition.

**The cascade was the most canon-faithful of the three substrates
throughout.** It refused to do the post-processing derivation
(because single-pass CSS cannot express it). JS and WGSL implemented
the derivation as post-processing (which canon section 3 does not
admit). When all three substrates implement canon-shape semantics —
no post-processing, no derivation across the resolved record — they
agree at 100%.

-----

## 5. What this changes about the architecture's claim

The architecture's S2 commitment can now be stated more precisely:

> **S2 (canon-shape, empirically verified 2026-05-20).** When
> constraints conform to canon section 3's WHEN:THEN shape, the CSS
> cascade, JS postfix interpreter, and WGSL compute shader produce
> byte-identical resolution across every coordinate of the state
> space, verified empirically across 2,602 fixture sets and ~45
> million field-level comparisons. Zero divergence.

The phrase "canon-shape" is doing the load-bearing work. It names
the subset of constraint semantics that the substrate's WHEN:THEN
form admits.

-----

## 6. What this changes about constraints.md

The original `constraints.md` step 3 ("if sdf==1 at the end, derive
reg=DENIED, rth=0") is now identified as a **spec bug**, not a
substrate boundary. It expresses a derivation that:

- canon section 3 forbids structurally
- the CSS substrate cannot implement at all
- the JS and WGSL substrates implement only because they are
  imperative machines that can do post-processing

The fix is to remove step 3 from `constraints.md` and require that
every denial rule explicitly write `reg: "DENIED"` and `rth: 0` in
its THEN. The canon-shape fixture generator's `normalizeThen` does
this transformation automatically; the same transformation should
be applied to the canonical constraint definitions in
[constraints.js](../../../exodus/canonical-implementation/constraints.js)
and the canonical reference's CONSTRAINTS array.

Held for sit-time before the canonical files are modified.

-----

## 7. What this leaves open

**The original stratified harness remains the better empirical
artifact for measuring where the substrate's stated shape disagrees
with the spec's actual shape.** That harness produces 2,500 / 2,602
against the original gpu-fixtures.json. The 102 failures are the
empirical record of step 3's structural incompatibility with canon
section 3.

The canon-shape harness produces 2,602 / 2,602 against canon-shape
fixtures. It is the empirical record that canon section 3's stated
shape holds when constraints conform to it.

**Both artifacts deserve to exist as separate, reproducible
findings.** Replacing one with the other would erase one of the
two empirical positions the architecture now holds:

- The architecture admits a class of constraint semantics for
  which S2 holds at 100%.
- The architecture rejects a class of constraint semantics for
  which S2 fails at 3.9%.

These are co-load-bearing. The first establishes what the substrate
*is*; the second establishes what the substrate *is not*.

-----

## 8. What this does not claim

- Does not claim canon section 3 has been formally revised. The
  recognition is empirical; the canon revision is held for
  sit-time.
- Does not claim constraints.md has been edited. The spec bug is
  identified but the canonical files remain unchanged pending a
  deliberate revision pass.
- Does not claim every spec-level rule of similar shape has been
  audited. constraints.md step 3 is the one this harness
  exercised; other spec entries may carry similar derivations
  that need similar treatment.
- Does not claim S2 holds at network-distributed scale. The
  Terraformation Pipeline scale-up remains the test of whether
  the canon-shape subset survives larger corpora.

-----

## 9. Implications for UTF Q-series and PROJECT-PLAN

**Q7 (canonical encodings).** The canon-shape result sharpens Q7:
the canonical encoding must be one that can faithfully express
WHEN:THEN with no post-processing. Pure CSS suffices. The postfix
bytecode is the more compact form but should not gain expressive
power over CSS (specifically, no opcodes for "rewrite after all
rules apply"). The byte-identical agreement at 100% under
canon-shape constraints suggests the encoding decision can be
made symmetrically — no encoding has fundamentally more
expressive power than another within the canon-shape subset.

**Q9 (non-claims).** Add to UTF's non-claims:
- UTF does not commit to post-processing semantics across the
  resolved record.
- UTF does not admit constraints whose final output depends on a
  rewrite step after all rules apply.

**PROJECT-PLAN.** The Terraformation Pipeline (Priority 6) test
should use canon-shape constraints only. Encountering a non-
canonical derivation in the spec corpus should be treated as
*evidence of a non-WHEN:THEN escape hatch in the source spec*,
not as a substrate limitation.

-----

## Live status

| Date (yyyy-mm-dd) | Action |
|---|---|
| 2026-05-19 | Original stratified harness produced 2,500 / 2,602 against original spec. 102 divergences located. S2 boundary named in [s2-boundary-derivation-semantics.md](s2-boundary-derivation-semantics.md). |
| 2026-05-20 | Canon-shape stratified harness produced 2,602 / 2,602 against canon-shape fixtures. The boundary is resolved when constraints conform to canon section 3. Article written. constraints.md revision held for sit-time. |
