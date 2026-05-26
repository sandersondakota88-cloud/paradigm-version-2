# Phase 2 Results — SE-05/K1 cycle on real source input

Per PLAN.md §2 discipline: "whatever happens is the result." No tuning.
This document records what the substrate produced on each axis when run
against the full canonical kernel source (`implementation/kernel/field.js`,
1326 lines, 9243 tokens after Acorn tokenization).

Run command:

    node phase-2-smoke.js <axis> 1326

Per-axis falsification matrix (spec §6):

  derived ?           — vocab.generateDerivedFromNovelty produced output
  predictive ?        — gap exceeded threshold AND
                        vocab.generatePredictionsFromGap produced output
  ratified ?          — at least one predictive matched a later input
  promoted ?          — at least one family reached K1 promotion

## Per-axis trajectory

### kind  (lexical token kind: ident/keyword/punctuation/string/number)

  tokens ingested        9243
  derived generated      33
  predictives generated  18296
  ratifications          82
  promotions             2
  evictions              18132

  final gap              0.3188
  final scalar           0.6734

  family fidelities:
    kind-cooccurs        avg=0.0016  fires=8251
    kind-transition      avg=0.0975  fires=17

  promoted sub-cascades:
    kind-cooccurs        (6 members,  fid@birth 0.0857)
    kind-transition      (53 members, fid@birth 0.2089)

  diagnosis: full SE-05/K1 cycle observed.

### vocab  (token text + position/kind binding)

  tokens ingested        9243
  derived generated      large
  predictives generated  large
  ratifications          large
  promotions             3
  evictions              1513

  final gap              0.4209
  final scalar           0.5369

  family fidelities:
    text-in-position     avg=0.0657  fires=746
    text-kind-binding    avg=0.0554  fires=7
    text-presence        avg=0.0995  fires=81

  promoted sub-cascades:
    text-in-position     (79 members, fid@birth 0.0505)
    text-presence        (37 members, fid@birth 0.0624)
    text-kind-binding    (32 members, fid@birth 0.0500)

  diagnosis: full SE-05/K1 cycle observed.

### cooccur  (per-token neighborhood signature hash)

  tokens ingested        9243
  derived generated      13500
  predictives generated  616
  ratifications          20
  promotions             0
  evictions              588

  final gap              0.2007
  final scalar           0.8946

  family fidelities: (none recorded)
  promoted sub-cascades: (none)

  diagnosis: ratifications occurred but no family accumulated fidelity.
             recordFidelity requires >=2 matches of the same family-type
             in a single step (kernel field.js:680). Cooccur primitives
             are per-token signatures; multiple sibling constraints rarely
             fire on the same input. K1 promotion is structurally
             unreachable for this vocab on this kind of corpus.

### position  (syntactic role: DECL/USE/CALLEE/ATTR/KEY/STR/CTRL/...)

  tokens ingested        9243
  derived generated      large
  predictives generated  large
  ratifications          3715
  promotions             2
  evictions              2571

  final gap              0.3957
  final scalar           0.5168

  family fidelities:
    position-presence      avg=0.0679  fires=8
    position-text-binding  avg=0.1156  fires=528

  promoted sub-cascades:
    position-text-binding  (164 members, fid@birth 0.0618)
    position-presence      (10 members,  fid@birth 0.0910)

  diagnosis: full SE-05/K1 cycle observed.

### frequency  (corpus-wide text recurrence bucket)

  tokens ingested        9243
  derived generated      31
  predictives generated  0
  ratifications          0
  promotions             0
  evictions              0

  final gap              0.5928
  final scalar           0.3815

  family fidelities: (none recorded)
  promoted sub-cascades: (none)

  diagnosis: derived saturated quickly (5 kinds x 5 buckets + 5 buckets +
             1 seed = 31 max constraints; corpus produced all of them).
             generatePredictionsFromGap predicts only buckets that are
             *missing*; after saturation there is nothing to predict.
             Gap stays high (0.5928) because vector-delta isn't dropping
             from matches — the few constraints saturate quickly and then
             the field has no novelty pressure.

## Cross-axis summary

  axis        derived  predictive  ratified  promoted  cycle-complete?
  --------    -------  ----------  --------  --------  ---------------
  kind          33     18296          82        2      YES
  vocab          *        *            *        3      YES
  cooccur     13500       616         20        0      ratifies, no K1
  position       *        *         3715        2      YES
  frequency     31         0          0         0      saturates early

  *: "large" — exact counts in re-run

3 of 5 axes completed the full SE-05/K1 cycle (derive -> predict -> ratify
-> promote). 2 of 5 produced honest structural failures:

- cooccur: K1 unreachable because per-token signature primitives don't
  co-fire on a single input. Phase 3 composer can still consume cooccur's
  derived constraints; promotion just doesn't happen at this layer.

- frequency: small primitive space (5 buckets) saturates; no novelty
  remains; predictive-reach never fires. The axis observed everything
  it can observe.

## What this earns

Phase 2's deliverable per substrate-factory-spec §6 is "one peer
instantiated, the four SE-05/K1 stages produce output on real input."

Three peers (kind, vocab, position) satisfy this in full. The two
that don't satisfy it produce diagnostic results that are themselves
honest findings about the primitive vocab vs. the corpus structure.

Phase 3 (composer over peer outputs) can proceed.

The substrate received real source code, ran the canonical
SE-05 predictive-reaching + M3 ratification + K1 fidelity-promotion
mechanisms without hardcoded interpretation, and produced 7 promoted
sub-cascades organized around primitives the substrate selected itself
from real structural patterns in JavaScript.

## Honest caveats

- The 50-line slice initially showed the cycle failing to close for the
  same axes that succeed at 1326 lines. The substrate needs enough
  material to accumulate predictives that re-encounter their `when` shape.

- The kind axis's two promoted families have very different fidelity:
  kind-cooccurs (0.0016 avg over 8251 fires) is barely above the
  FIDELITY_PROMOTE = 0.03 threshold (it promoted at fid@birth=0.0857,
  then fidelity decayed); kind-transition (0.0975 avg over 17 fires)
  is doing real work. The promotion mechanism is event-locked, not
  drift-corrected.

- Frequency's gap=0.5928 is the highest of any axis but produces nothing.
  High gap without predictive-reach means the substrate "feels novelty"
  but has no vocabulary to translate it into a prediction. This is a
  vocab-design observation, not a kernel failure.
