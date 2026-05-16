# Phase 5.5: imposed-precedence cleanup

Acts on the Phase 5 kindMult audit finding by removing six imposed-
precedence constants and the dead effectiveWeight ranking from
selectFromMatches. Selection becomes set-computation honestly under
the current spec.

Spec stack pinning: DEFINITION.md v1.1, KERNEL.md v1.1 (section 5
rewrite), INVARIANTS.md v1.2 (K2/K3 implementation notes), PROJECT_
SPLIT.md v1.2, IMPLEMENTATION_PATH.md v2.4, SE-01 through SE-06.

## What changed in code

field.js:
- Removed CFG.NAMING_WEIGHT_BONUS (1.5).
- Removed CFG.SELECT_RECENCY_EXP (1.5).
- Rewrote selectFromMatches as set computation. Removed the
  effectiveWeight composition (weight * pow(recencyFactor,
  recencyExp) * fastBias * kindMult * namedBias), the kindMult
  ladder (ratified=1.3, meta=1.15, compound=1.25), the namedBias
  (NAMING_WEIGHT_BONUS), and the descending sort. Returns matched
  set with {idx, kind, named} metadata only.
- Removed kindBonus = 15 for ratified from _enforceCaps. Eviction
  is now uniform across kinds, scored by uses + weight - recency.
- Updated two historical comments (lines around 184 and 1117) to
  reference the now-renumbered IMPLEMENTATION_PATH section 9 and
  the post-5.5 universal scope.

test-phase4c.js:
- Updated t10 (testNoKindMultForRecalled). The Phase 4c version
  used an asymmetric sanity check ("ratified should still have
  kindMult") that no longer holds post-5.5. Rewrote to assert
  the post-5.5 universal invariant: no kind has a kindMult.
  Structural intent of the test (no imposed precedence on recalled
  records) is preserved and now satisfied universally.

kindmult-audit.js:
- Header rewritten to reflect history: Phase 5 discovery, Phase
  5.5 cleanup, post-5.5 confirmation mode. The audit's monkey-
  patched variants still install Phase-5-era selectFromMatches
  locally; comparing variants now confirms the audit layer is
  inert relative to the production set-computation pipeline.
- Closing-recommendation block rewritten to confirm the cleanup
  rather than recommend it.
- Runtime unchanged.

phase5-coupling-audit.js:
- Added P1 check: "No imposed-precedence constants in selection
  (Phase 5.5)". Pattern-matches active code references to
  kindMult, kindBonus, NAMING_WEIGHT_BONUS, SELECT_RECENCY_EXP,
  effectiveWeight in field.js. Comment-only references are
  permitted (the historical comments are exempt). Verified to
  catch synthetic reintroduction.
- 7 prior C-class checks unchanged.

## Test results

Full regression (115/115):
  test-phase3.js                    8/8
  test-reflexive-surface.js         12/12
  test-phase4b.js                   14/14
  test-phase4c.js                   14/14   (t10 updated)
  test-phase4d.js                   13/13
  test-phase5a.js                   11/11
  test-phase5b.js                   6/6
  test-phase5c.js                   7/7
  test-phase5d.js                   7/7
  test-phase5e.js                   8/8
  test-phase5f.js                   8/8

Static checks (8/8):
  C1 CT binds to ER                                       PASS
  C2 ER does not bind to CT                               PASS
  C3 Reflexive surface does not bind to engines           PASS
  C4 Storage adapter does not reference engines           PASS
  C5 ER engine does not reference storage adapter         PASS
  C6 Field is read-only from surface module               PASS
  C7 CT engine does not import surface                    PASS
  P1 No imposed-precedence constants in selection         PASS

kindMult audit: runs in confirmation mode; reports trivially
identical metrics across variants, confirming the audit's
installed layer is inert relative to production.

ASCII-clean across all touched files.

## How to verify locally

  node test-phase3.js
  node test-reflexive-surface.js
  node test-phase4b.js
  node test-phase4c.js
  node test-phase4d.js
  node test-phase5.js                 # harness; runs 5a-5f
  node phase5-coupling-audit.js       # 8/8 static checks
  node kindmult-audit.js              # post-5.5 confirmation

## What is out of scope for Phase 5.5

Wire-a-consumer (Phase 5.6 or later). Adding a rank-consuming
selection mechanism that realizes K2 part (a) and K3 operationally
is structurally separate; the spec stack does not yet specify a
shape. INVARIANTS v1.2 carries implementation notes naming the
gap. IMPLEMENTATION_PATH v2.4 names Phase 5.6 inside section 7's
Phase 5.5 scope.

namingPref dissolution. K3 is currently realized as a discrete
addressable accumulator (field.namingPref), strained against K3's
own letter ("not stored as an explicit value addressed by any
component"). Honest realization routes naming events through SE-03
modulation directly. Known gap; named in INVARIANTS v1.2.
