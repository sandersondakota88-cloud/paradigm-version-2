# SE-12 - Cross-Substrate Compounds (Compound Constraints as a Constraint Kind)

**Type:** Specification extension
**Status:** OBSERVATIONAL. Names a structural property the formalism
already supports across SE-06 (substrate duality), SE-05 (vector-
delta with predictive reaching), and the M1/M2 invariant cluster,
but did not articulate as a constraint kind. Does not add new
mechanism; documents the mechanism Phase 4b shipped in code, and
names the structural commitments it makes that earlier spec did not
state.
**Primary origin:** Phase 4b implementation, in
`implementation/04-expressive/4b-compound-constraints/field.js`.
The mechanism was built; its structural commitments were not
written down. This document closes the D2 gap by naming what the
code commits to.
**Implemented in:** Phase 4b through 4d. Field state carries
`compoundFidelity` map and `compoundGenerationHistory` buffer.
Tests at `4b-compound-constraints/test-phase4b.js` verify
construction, predicate evaluation, and fidelity tracking.

**DRAFT.** This document is an AI-produced draft written from
existing code and IMPLEMENTATION_PATH prose. It must be hand-
rewritten per `meta/HAND_REWRITE_LIST.md` Tier 4 before being
considered authoritative. Structural content is anchored to the
implementation; voice is to be replaced.

-----

## The simple version

The substrate has two kinds of native predicate. Render-scope
predicates match against features of the resolved field: tokens,
lengths, character classes, co-occurrence. Execution-scope
predicates match against features of the operation queue: depth,
recent operation type, exec-side delta-gap state. Neither kind
alone names what happens when both substrates are notable at the
same moment.

A **compound** is a constraint whose predicate is a tuple of one
render-scope predicate and one execution-scope predicate, both of
which must hold for the compound to match. The compound carries
its own fidelity and competes for ratification on the same terms as
other constraints. When a compound's predicate-pair holds
repeatedly and the compound contributes to delta closure on those
firings, fidelity accumulates and the compound becomes a candidate
for promotion. Promoted compounds become reusable templates
available to the reflexive surface.

The compound is not a coordination mechanism. It does not transmit
state between substrates. It is a constraint whose match condition
*observes* both substrates simultaneously. The two substrates
continue to operate independently (per SE-06's no-command-path
commitment); the compound is one more thing the field can match
on, with a wider predicate vocabulary than either substrate alone
provides.

## Why this is a new constraint kind

A render-scope-only predicate cannot ask about execution-scope
state. An execution-scope-only predicate cannot ask about render-
scope state. The two predicate languages are disjoint by
construction (SE-06's substrate-duality), and neither one names
what conjunctions across them would mean.

Compound constraints introduce a third predicate language: tuple
predicates over the substrate boundary. This is not an extension
of either existing predicate language; it is a new kind. The
distinction matters because compounds participate in resolution
differently than render-only or exec-only constraints:

- A render-only constraint fires when the render-scope predicate
  holds, regardless of exec-scope state.
- An exec-only constraint fires when the exec-scope predicate
  holds, regardless of render-scope state.
- A compound fires only when both halves of its tuple predicate
  hold simultaneously.

This is the smallest predicate vocabulary that lets the field
observe inter-substrate coincidence as a first-class event. Without
it, simultaneous notability across substrates either goes
unrecorded or is approximated by trace-correlation work outside the
constraint system. Compounds bring the coincidence inside the
substrate's primary representation.

## Generation triggers

Compounds are not declared by an author. They arise when the
field detects simultaneous notability across both substrates. The
generation triggers, established in Phase 4b code:

**Co-occurring ratification with exec prediction.** A render-scope
constraint ratifies (its predictive form is confirmed by input)
while an exec-scope predictive constraint is unresolved. The
field forms a compound binding the just-ratified render predicate
to the unresolved exec predicate. If the compound's pair fires
later, the field has captured a structural co-incidence the
substrates produced jointly.

**Sub-cascade naming with queue saturation.** A render-scope
sub-cascade promotion event (per SE-01) co-occurs with exec-scope
queue depth at or near the saturation threshold. The compound
records the joint occurrence as a candidate structural pattern.

**Persistent render-gap across exec-scope ticks.** A render-scope
delta-gap persists above threshold across multiple exec-scope
operations without resolution. The compound records the durative
mismatch as a pattern.

The triggers are not exhaustive. They are the three the field
currently observes; additional triggers may be added by future
revisions without changing the compound's structural role.

## Fidelity and promotion

A compound's fidelity is computed by the same mechanism families
use (per SE-01's compositional cascade discipline): an accumulator
over a window of evaluations, recording how often the compound
contributed to delta closure when its predicate pair held. The
implementation carries this as `compoundFidelity[id]` with window
`COMPOUND_FIDELITY_WINDOW` (8 evaluations), promotion threshold
`COMPOUND_FIDELITY_PROMOTE` (0.04 above baseline), and minimum
firing count `COMPOUND_FIDELITY_MIN_FIRES` (3).

A compound that meets all three conditions promotes. Promotion
makes the compound's predicate-pair available as a *template*: a
reusable pattern the reflexive surface can instantiate against
current field state. The promotion mechanism is structurally
parallel to family-into-sub-cascade promotion (SE-01); the
difference is the predicate vocabulary (single-substrate vs.
cross-substrate) and the template form (sub-cascade vs. surface
template).

Compound bounded by `FIELD_LIVE_CAP`. The live compound population
is capped on the same discipline as other constraint kinds; cap
enforcement uses ordinary flow excretion (SE-02 metabolism) on
non-promoted, non-ratified compounds first.

## The "let delta decide" commitment

A revision made during Phase 4b/4c integration is load-bearing for
this spec and must be named.

The first design imposed a `kindMult` precedence constant on
compounds (initially 1.25) so they would compete differently than
other constraint kinds in selection. This was wrong. The revision
removed the imposed precedence and let compounds compete on their
accumulated weight, the same as any other constraint kind. Delta
is the tiebreaker; precedence is not imposed.

**The structural commitment this revision makes:** resolution
conflicts between overlapping commitments are decided by delta's
continuous reading of accumulated weight, not by discrete priority
constants imposed at design time. The constraint kind does not
carry intrinsic precedence; precedence is whatever delta computes
from the constraint's history of contribution.

This commitment generalizes beyond compounds. It is the
substrate's posture toward overlapping commitments wherever they
occur: delta resolves; precedence is observed, not imposed. SE-13
(storage as substrate, recall) makes the same commitment. Future
SE-N entries that introduce new constraint kinds inherit it by
default.

## Relationship to the binary-SDF boundary

The boundary research in algorithm 16's predicate-closure section
located several incompleteness modes (compound NOT, reductions,
cross-coordinate dependence, aggregate dependence) where the
postfix machine's discrete binary-SDF resolution ran out of
expressive room. The "let delta decide" commitment is structurally
the same idea as continuous-SDF resolution: where binary SDF
forces a discrete choice between -1 and +1, delta-as-tiebreaker
reads a continuous weight and resolves to whatever balance the
weights produce.

This is a candidate connection, not a demonstration. The
hypothesis: under delta-tiebreaker semantics with continuous
weight (rather than imposed precedence or binary SDF), several of
the boundary findings change:

- **Reductions over the field** become a delta-reading at the
  appropriate scope, not a discrete count the grammar cannot pose.
- **Cyclic mutual dependence** has a unique stable answer at the
  weight equilibrium, rather than two attractors plus oscillation.
- **Aggregate dependence with phase transition** has a smooth
  sigmoid response, rather than discrete state flips driven by
  initial conditions.

The connection requires empirical confirmation. A continuous-SDF
variant of the postfix machine, with delta-tiebreaker semantics
implemented, would test whether the boundary findings actually
reduce as predicted. See algorithm 16's SDF CSG correspondence
section for the math; that section already names the operations
(`min` / `max` / negation) and notes the variant is research-
extension territory. SE-12's "let delta decide" commitment makes
the connection structurally legible; the empirical work to confirm
it is open.

## Consequences for existing canon

**SE-06 (substrate duality) gains an instance.** SE-06 names
rendering and execution as two substrate connections coupled
through delta. Compounds are how that coupling surfaces as
*constraint structure*. The two substrates do not address each
other directly; the compound observes both and competes in
resolution like any constraint. SE-06's commitments are
unchanged; SE-12 names a constraint kind SE-06 made structurally
possible.

**SE-05 (vector-delta with predictive reaching) gains a parallel
structure.** SE-05 specifies predictive reaching as the field's
response to vector-delta divergence. Compounds are a different
response to the same divergence: where predictive reaching
generates constraints that *reach* toward unseen input, compound
generation *records* simultaneous notability across substrates.
Both are mechanisms the vector-delta gap drives. SE-05 is
untouched; SE-12 names a sibling response.

**SE-01 (compositional cascades) gains a non-sub-cascade
promotion target.** SE-01 specifies sub-cascade promotion as the
mechanism by which compositional structure emerges. Compound
promotion produces *surface templates*, not sub-cascades. The
promotion mechanism is structurally parallel (fidelity threshold,
minimum firings, accumulated weight) but the output is different
in kind. SE-01 is untouched; SE-12 names a sibling promotion path.

**Algorithm 16's substrate-equivalence claim is unaffected.**
Compounds compile to the same instruction set as other
constraints (their predicate halves are render-scope and exec-
scope predicates the existing instruction set already supports);
the byte-identical equivalence across CSS / JS / WGSL holds for
compounds the same as for any other constraint. The "let delta
decide" commitment changes how *competing* compounds resolve
against each other; it does not change how *one* compound
resolves at one coord.

## Invariants this introduces

For incorporation into INVARIANTS.md v1.4 (per HAND_REWRITE_LIST.md
line 139):

**M6. Compound predicates are tuple-shaped across substrates.**
A compound constraint's predicate is a tuple `(renderPredicate,
execPredicate)`. Both halves must hold for the compound to match.
Implementations may not flatten the tuple into a single predicate
language; the distinction between the two halves is structural,
not syntactic.

**M7. Compound competition is delta-resolved, not precedence-
imposed.** Compounds compete with other constraint kinds on
accumulated weight only. No constraint kind carries an intrinsic
multiplier or precedence constant that overrides weight-based
competition. Delta is the tiebreaker.

**M8. Compound promotion produces surface templates, not sub-
cascades.** Promoted compounds become reusable templates the
reflexive surface instantiates against current field state. The
template form differs from sub-cascade form (SE-01); promotion
mechanism is parallel but the output is distinct.

## What this document does not commit to

- The specific triggers listed above are not exhaustive. Future
  work may add triggers; the structural commitment is that
  compounds form on simultaneous notability across substrates,
  not on a fixed enumeration of conditions.
- The specific fidelity constants (`COMPOUND_FIDELITY_WINDOW`,
  `COMPOUND_FIDELITY_PROMOTE`, `COMPOUND_FIDELITY_MIN_FIRES`) are
  implementation choices, not structural commitments. Future
  revisions may tune them without violating SE-12.
- The continuous-SDF / delta-tiebreaker generalization to the
  boundary findings is a candidate connection. SE-12 records the
  commitment ("let delta decide") and notes the connection; it
  does not commit to the empirical claim that continuous SDF
  resolves the binary-SDF boundary cases. That requires testing.

## Open work

- Re-run the binary-SDF boundary tests (4a reduction, 4b stratified
  / mutual / aggregate) with a continuous-SDF variant under
  delta-tiebreaker semantics. Verify whether the predicted
  reductions hold.
- Specify the surface-template form precisely (SE-12 names that
  promoted compounds become templates; the template's structure
  is not yet specified). This is Phase 4d work.
- Update INVARIANTS.md v1.3 to v1.4 incorporating M6/M7/M8.

-----

## Live status

| Date (yyyy-mm-dd) | Action |
|---|---|
| 2026-05-16 | Draft created. Closes part of the D2 gap that HAND_REWRITE_LIST.md identifies. Companion to SE-13. Must be hand-rewritten per HAND_REWRITE_LIST.md Tier 4 before being authoritative. |
