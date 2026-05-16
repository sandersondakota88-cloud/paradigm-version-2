# SE-13 - Storage as Substrate (Recall as Backward-Parallel Reaching)

**Type:** Specification extension
**Status:** OBSERVATIONAL. Names a structural property the formalism
already supports across SE-05 (vector-delta predictive reaching),
SE-02 (metabolism flow discipline), and the M5/F4 invariant cluster,
but did not articulate as a substrate-class commitment. Does not add
new mechanism; documents the mechanism Phase 4c shipped in code, and
names the structural commitments it makes that earlier spec did not
state.
**Primary origin:** Phase 4c implementation, in
`implementation/04-expressive/4c-storage-substrate/field.js` and
`storage-adapter.js`. The mechanism was built; its structural
commitments were not written down. This document closes the D2 gap
by naming what the code commits to.
**Implemented in:** Phase 4c through 4d. StorageAdapter class with
IndexedDB and in-memory backends. Field state carries
`recallWindow` (transient) and `recallEventLog` (bounded). Phase
5.7.7 demonstrates persistence + reload survival in Chromium.

**DRAFT.** This document is an AI-produced draft written from
existing code and IMPLEMENTATION_PATH prose. It must be hand-
rewritten per `meta/HAND_REWRITE_LIST.md` Tier 4 before being
considered authoritative. Structural content is anchored to the
implementation; voice is to be replaced.

-----

## The simple version

The substrate's resolver does not operate only on the live
constraint set in field memory. It operates on a wider population
that includes constraints previously persisted to storage and made
available again when the field's state suggests they would close
delta.

**Storage is a substrate.** Persistent backing (IndexedDB, OPFS,
or any equivalent) is not a side concern of the architecture; it
is one more place where constraints live. The ER engine resolves
over the union of live constraints and selectively-recalled
persisted constraints. The same algorithm 16 substrate-equivalence
claim applies: byte-identical match results across CSS, JS, and
WGSL paths over the wider population.

**Recall is the mechanism by which persisted constraints rejoin
the live evaluation.** Recall is gap-triggered: when render-scope
delta-gap exceeds threshold (the field is in a state the live
constraints cannot resolve), the substrate reads a bounded window
of constraints from storage and merges them transiently into
evaluation for the current frame. Recalled constraints carry their
accumulated weight from persistence; they compete in selection on
that weight, not on a kind-precedence multiplier.

Recall is structurally parallel to predictive reaching (SE-05), in
the opposite temporal direction. Predictive reaching generates
constraints that *reach forward* toward unseen input. Recall
*reaches backward* into the field's persisted history for
structure that has held before and may hold again. Both responses
are driven by vector-delta divergence; both close gaps the live
constraint set cannot resolve alone.

## Why storage is a substrate, not a feature

"Persistence" treated as a feature implies that storage is a
service the substrate uses — call out, write a record, read it
back later, treat the storage round-trip as I/O. Under this
framing, the substrate is the thing in memory; storage is outside.

The architecture does not work that way. The substrate's
resolution discipline operates across a population of constraints;
*where* those constraints currently live (in field memory or in
persistent backing) is an implementation detail of *how the
substrate is hosted*, not of *what the substrate is*. Constraints
persisted to IndexedDB are not "saved" in a sense distinct from
"live"; they are constraints that currently happen to live in
storage rather than in memory, and they re-enter live evaluation
when delta says they would help.

The structural commitment: **the substrate's constraint population
spans whatever backing media the host provides, and the resolver
operates over the union.** Storage is a substrate connection in
the SE-06 sense — another path through which constraints enter
resolution — and its discipline follows the same rules: no
command-path coordination, delta-coupled selection, byte-identical
substrate equivalence.

This is what "storage as substrate" names. Not "we have
persistence." Not "we save state." The architectural posture: the
field extends into storage; the resolver crosses the boundary
when delta says to.

## Recall as backward-parallel reaching

SE-05 specifies predictive reaching: when fast-delta and slow-
delta diverge, the field generates constraints whose satisfaction
requires input not currently present. The constraints reach
forward in time, toward inputs the field has not yet received.

Recall is the structurally parallel mechanism reaching backward.
When the render-scope delta-gap exceeds threshold and the live
constraint set cannot close the gap, the field is in a state
where additional structure would help and the live structure is
not it. Storage holds constraints that *did* hold previously —
the field's persisted history of what has resolved before. Recall
brings a bounded window of these constraints into evaluation,
allowing past structure to participate in present resolution.

The parallel is structural, not metaphorical. Both mechanisms:

- Are triggered by vector-delta divergence
- Generate transient additions to the constraint set
- Compete in selection on accumulated weight
- Persist in the field only if they ratify (close delta)
- Excrete via SE-02 metabolism if they do not contribute

Predictive reaching produces *new* constraints that did not exist
before, hypothesized from the current gap. Recall produces
*recovered* constraints that existed in persistence, reanimated
against the current gap. The temporal direction differs; the
resolution discipline is the same.

This is what "recall as parallel reaching" names. The field
reaches in both temporal directions when it cannot close delta
from current contents.

## Persistence selectivity

Not every trace entry becomes a recallable record. The substrate
maintains a discipline about what is worth keeping for potential
recall.

The eligibility rules, established in Phase 4c code's
`PersistenceEligibility`:

- **Persisted as recallable:** ratified constraints, promoted
  compounds (per SE-12), families that have generated sub-
  cascades, the seed (per F1).
- **Not persisted:** derived constraints that have not ratified,
  predictive constraints that have not been confirmed by input,
  unpromoted compounds.

The structural commitment: **persistence selects for constraints
that have demonstrated contribution to delta closure.** A
constraint that has not closed delta in its live run has no
demonstrated value for recall; persisting it would pollute storage
with unconverged structure. A constraint that has ratified
(predicted, then confirmed) carries evidence its predicate
captures something real about the field's input. That evidence is
what makes it worth recalling.

This is not arbitrary. The selection criterion is the same one the
substrate uses for live ratification: did the constraint close
delta when it had the opportunity. Storage inherits the discipline.

## Recall trigger and bounded window

Recall is not a query the application can issue. It is a response
the substrate triggers on its own conditions.

**Trigger:** render-scope delta-gap exceeds `RECALL_GAP_THRESH`
(0.12 in current implementation). The threshold names "the live
constraint set is not resolving this state, and additional
structure would help."

**Window:** per recall event, the substrate reads up to
`RECALL_WINDOW_SIZE` (50 in current implementation) constraints
from storage. The window is bounded so that recall consumes only
what the field can metabolize per frame (per SE-02).

**Merge discipline:** recalled constraints merge into evaluation
*transiently*. They participate in resolution for the current
frame; if they ratify (contribute to delta closure), their weight
in storage updates by `RECALL_SUCCESS_BOOST` (0.05). They do not
modify `Field.constraints`; the live constraint set is unchanged
unless a recalled constraint promotes back into the live
population on its own merit.

**Event log:** the substrate maintains a bounded log of recall
events (`RECALL_EVENT_LOG_CAP`, 32) for observation. The log
records what triggered the recall, what window was read, what
contributed. The log is observation-only; it does not feed back
into resolution.

The selection of *which* persisted constraints enter the window is
not specified at the spec level. Implementations may select by
recency, by stored weight, by similarity to current field state,
or by combinations. The structural commitment is that the
selection happens within the bounded window discipline; the
specific selection function is implementation choice.

## The "let delta decide" commitment

A revision made during Phase 4c integration is load-bearing for
this spec and must be named — the same revision SE-12 names.

The first design imposed a `recallKindMult` precedence constant
on recalled constraints so they would compete differently than
live constraints in selection. This was wrong. The revision
removed the imposed precedence and let recalled constraints
compete on their accumulated weight from persistence, the same
as any other constraint.

**The structural commitment this revision makes:** recalled
constraints carry forward their persisted weight directly into
live competition. A constraint that accumulated significant
weight over many ratifications before being persisted enters
recall with that weight; a constraint that ratified once and
hasn't been seen since enters with weight close to threshold.
Delta is the tiebreaker. Storage-vs-live is not a precedence
distinction.

This commitment generalizes to the same posture SE-12 takes:
resolution conflicts are decided by delta's continuous reading
of accumulated weight, not by discrete priority constants imposed
at design time.

## Substrate-equivalence requirement

Algorithm 16's byte-identical claim across CSS / JS / WGSL holds
over the live constraint set. SE-13's structural commitment
extends the claim: **the same byte-identical equivalence must
hold over the union of live and recalled constraints.**

Operationally, this means the CSS oracle, the JS stack machine,
and the WGSL compute shader must produce identical resolution
results when the same recall event reads the same window of
persisted constraints into the same frame's evaluation. The
diff-harness regression that algorithm 16 specifies extends to
cover the wider population.

This is not new mechanism. The recalled constraints, once merged
into evaluation, are constraints like any other; algorithm 16's
substrate-equivalence applies as-is. The structural commitment is
that **the recall mechanism itself does not break substrate-
equivalence** — which would happen if, for example, the recall
window contained different constraints on different substrates,
or if recall reordering caused different rule firing orders
across substrates.

The Phase 4c test suite verifies this for the deployed
implementation. The verification extends to any future
implementation that claims to honor SE-13.

## Bounded recursion (recall events as trace entries)

A subtle point that must be specified or future implementations
will get it wrong.

Recall events themselves are observable. The reflexive surface
fires clauses on recall ("recalled: persisted-X matches current
input"). These clauses produce trace entries (per M5). Trace
entries with tags get persisted as recallable (per the
persistence selectivity above). Recallable persisted entries can
themselves be recalled.

**This is a closed feedback loop and must be bounded.**

The commitment: **recall events do not produce recallable
records.** A trace entry whose `op` field is `"recall"` is
flush-only; it is observed, it appears in the bounded
`recallEventLog`, but it is not eligible for recall in future
gap-triggered events. This prevents the substrate from recursively
reaching backward into its own backward-reaching events.

Without this commitment, recall-of-recall-events would constitute
an unbounded recursion that the substrate's metabolism (SE-02)
could not safely metabolize. The bounded `recallEventLog` cap
protects observation; the persistence eligibility rule protects
resolution.

## Consequences for existing canon

**SE-05 (predictive reaching) gains a temporal-parallel.** SE-05
specifies forward reaching; SE-13 names backward reaching as
structurally parallel. SE-05's commitments are unchanged; SE-13
adds the symmetric case. The vector-delta gap drives both; what
differs is which direction the resolving structure comes from.

**SE-02 (metabolism) gains a recall-bounded inflow.** SE-02
specifies flow discipline (intake, transformation, excretion).
Recall is an intake event with structural specifics: bounded
window, gap-triggered, delta-resolved. The SE-02 metabolism
framework applies as-is; SE-13 specifies one well-named instance
of substrate intake.

**SE-06 (substrate duality) gains a third substrate connection.**
SE-06 names rendering and execution as two substrate connections
coupled through delta. Storage is a third. The same no-command-
path discipline applies; the same delta-coupling holds. SE-06 is
untouched; SE-13 names a substrate connection SE-06 made
structurally possible without articulating.

**Algorithm 16's substrate-equivalence claim extends.** The
byte-identical equivalence across CSS / JS / WGSL extends to the
combined live-plus-recalled population. No new instruction set;
no new opcode. Recalled constraints compile through the same
algorithm 16 path as live ones.

**Phase 5.7.7's IndexedDB persistence demonstration is the
existing empirical anchor.** Phase 5.7.7 demonstrated state survival
across page reload in Chromium with IndexedDB persistence (22/22
in-browser verification checks). The demonstration confirms
storage-as-substrate works across the time axis; SE-13 names the
structural commitments that demonstration honored.

## Invariants this introduces

For incorporation into INVARIANTS.md v1.4 (per HAND_REWRITE_LIST.md
line 139):

**M9. Storage is a substrate connection.** Persistent backing
participates in resolution as one substrate connection among
others (rendering, execution, storage). It honors the same no-
command-path discipline (F3), the same delta-coupling (SE-06),
and the same metabolism discipline (SE-02). Implementations may
not treat storage as I/O distinct from substrate evaluation.

**M10. Recall is gap-triggered, bounded, delta-resolved.** Recall
events occur only when render-scope delta-gap exceeds threshold,
read at most a bounded window per event, and merge transiently
into evaluation. Recalled constraints compete in selection on
their persisted weight; no kind-precedence constant overrides
weight-based competition.

**M11. Recall events do not produce recallable records.** Trace
entries whose `op` is `recall` are flush-only. The recursion
that would otherwise arise from observing recall-of-recall is
bounded by this rule.

**M12. Persistence selects for ratified contribution.** Only
constraints that have demonstrated contribution to delta closure
(ratified, promoted compounds, families, seed) are persisted as
recallable. The selection criterion is structurally the same as
live ratification; storage inherits the discipline.

## What this document does not commit to

- The specific persistence backing (IndexedDB, OPFS, or other) is
  not a structural commitment. SE-13 commits that storage is a
  substrate; it does not commit to which storage technology.
- The specific selection function within the recall window
  (recency-weighted, weight-ranked, similarity-matched, etc.) is
  implementation choice. SE-13 specifies the bounded-window
  discipline; the function within is open.
- The specific thresholds (`RECALL_WINDOW_SIZE`,
  `RECALL_GAP_THRESH`, `RECALL_EVENT_LOG_CAP`,
  `RECALL_SUCCESS_BOOST`) are implementation choices, not
  structural commitments.
- The continuous-SDF / delta-tiebreaker generalization to the
  algorithm 16 boundary findings is a candidate connection (see
  SE-12). SE-13's "let delta decide" commitment makes the
  connection legible; the empirical confirmation is open work.

## Open work

- Specify the surface-template form of promoted compounds (SE-12
  cross-reference); recall may surface promoted compounds as well
  as primitive ratified constraints, in which case the surfacing
  mechanism is shared.
- Re-run the algorithm 16 boundary tests with continuous-SDF
  delta-tiebreaker semantics; verify whether the structural
  connection SE-12 and SE-13 both name actually changes the
  boundary profiles.
- Update INVARIANTS.md v1.3 to v1.4 incorporating M9/M10/M11/M12.
- Specify the selection function within the recall window with
  more rigor (currently implementation-defined).

-----

## Live status

| Date (yyyy-mm-dd) | Action |
|---|---|
| 2026-05-16 | Draft created. Closes part of the D2 gap that HAND_REWRITE_LIST.md identifies. Companion to SE-12. Must be hand-rewritten per HAND_REWRITE_LIST.md Tier 4 before being authoritative. |
