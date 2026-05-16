# Documents to hand-rewrite

These documents will be read first by skeptical evaluators. If they
carry AI-signature, the work is dismissed before the substance is
read. The structural and mechanical reorganization is done; the
voice work is what only you can do.

## What AI-signature looks like (the patterns to watch for)

- Em-dash heavy prose; "not X, but Y" construction; parallel triads
- Long enumerations with hedged absolutes ("often", "tends to", "may")
- "It is worth noting that...", "Importantly...", "Crucially..." preambles
- Multi-level bulleted lists where prose would do
- Section headers every 3-4 paragraphs
- Bolding on key phrases throughout
- "Closure clause", "structurally honest", "this is not a metaphor"
  type phrases repeated across documents
- Source-history notes that read as documentation rather than authorship

Patterns specifically present in the 2026-05-15 session writing
(ARCHITECTURE.md, PROJECT-PLAN.md, RESEARCH-AGAINST-PREFACE.md,
canon/UTF/00-INDEX.md, canon/UTF/01-foundations.md, the algorithm 16
rewrite, and related):

- "Three-axis" or "two-half" framings that segment everything into
  enumerated structural categories
- "Proof gap" / "named in plain text" / "load-bearing" phrasing
  repeated across documents as connective tissue
- Sentences that begin with the structural conclusion before the
  observation (e.g. "The architecture has the same shape an OS has")
- Disclaimers about what the document "does not do" appended as
  closing sections
- Tables that match document tiers or layers to one-line summaries
- "Live status" log tables at the end of every document with the
  same date format
- "This document does not foreclose discovery" / "the recognition
  matters; the specification matters more" style closers

Your own PREFACE shares some of these features. They are not wrong
inherently; they are wrong when they are reflexive instead of chosen.
Rewriting by hand forces choice.

---

## TIER 1 - Claim documents (highest priority; first impression)

These are the documents a skeptical evaluator reads first.
Rewriting these is the difference between "this looks AI-generated"
and "this looks like a human wrote it carefully."

1. **PREFACE.md** (root) - the structural claim. 109 lines. The single
   most important document in the project. Voice: should sound like
   the person who built the work, not the AI that helped write it.

2. **canon/DEFINITION.md** - 613 lines. The foundational definition
   the entire spec stack depends on. Currently v1.1. Voice will be
   load-bearing for any standards-mode reading.

3. **canon/INVARIANTS.md** - 700 lines, 33 invariants. The checklist
   form. Each invariant has a commitment-consequence-source structure
   that needs to read as careful engineering, not auto-generated.

4. **canon/KERNEL.md** - 250-line pseudocode + prose. The kernel as
   the spec describes it. Should match your own register, not AI's.

5. **ARCHITECTURE.md** (root) - NEW, written 2026-05-15 in AI voice.
   ~470 lines. Names the kernel/adapter/UTF/hardware layering. Root-
   level claim document. Heavy em-dash usage, "three-axis" framings,
   "proof gap" connective tissue, disclaimer-section closer. Tier 1
   because a skeptical reader hits this in the first three documents.
   This is the most consequential of the new docs because it
   reframes how every other piece of canon fits together.

6. **PROJECT-PLAN.md** (root) - NEW, written 2026-05-15 in AI voice.
   ~210 lines. Project organization document. Tier table at top,
   directory listings, live status log. Cadence is recognizably AI;
   content is mostly factual organization. Lighter rewrite than
   ARCHITECTURE.md but same first-impression position.

7. **RESEARCH-AGAINST-PREFACE.md** (root) - NEW, written 2026-05-15
   in AI voice. The catalogue of evidence against four preface
   objections. §0 contains explicit "I (Claude)" provenance that
   needs first-person-your-voice replacement. Tier 1 because the
   document's whole purpose is to be honest about what was
   demonstrated; honesty about authorship is part of that.

8. **README.md** (root) - NEW, written 2026-05-15 in AI voice. The
   GitHub landing page. ~120 lines. Was previously listed as a
   "potentially write from scratch" item (A); now exists and needs
   rewriting in your voice. First thing any visitor to the repo sees.

---

## TIER 2 - Specification extensions (each one)

These should be reviewed in numbered order. Each is short (10-30KB)
and individually rewritable in one sitting.

5. canon/specification/SE-01-compositional-cascades.md
6. canon/specification/SE-02-metabolism.md
7. canon/specification/SE-03-field-modulation.md
8. canon/specification/SE-04-seed-constraint.md
9. canon/specification/SE-05-vector-delta-predictive-reaching.md
10. canon/specification/SE-06-substrate-duality.md
11. canon/specification/SE-07-configuration-and-settling.md
12. canon/specification/SE-08-render-substrate-intake.md
13. canon/specification/SE-09-operational-irreversibility.md
14. canon/specification/SE-10-resolution-accretion-chains.md
15. canon/specification/SE-11-dimensional-resolution.md

---

## TIER 3 - Algorithm catalog INDEX

16. **canon/algorithm/00-INDEX.md** - The catalog overview. Currently
    lists algorithms 01-20 but the directory also has 22; INDEX needs
    update to acknowledge algorithm 22 and the absent 21. Re-author in
    your voice.

---

## TIER 4 - Specification extensions to WRITE (D2 gap closure)

The kernel fidelity audit identified that compounds (Phase 4b) and
recall (Phase 4c) are structural commitments in the code with no
corresponding SE-N entry. This is the only D2 violation in the audit.

17. **canon/specification/SE-12-cross-substrate-compounds.md** -
    DRAFT EXISTS as of 2026-05-16, AI-produced from code and
    IMPLEMENTATION_PATH prose. Structural content anchored to Phase
    4b implementation; voice to be replaced. Document compounds as
    a constraint kind with tuple-predicate pattern, fidelity
    tracking, promotion-as-templates. Reference field.js:154-170 for
    the mechanism. Introduces invariants M6, M7, M8.

18. **canon/specification/SE-13-storage-as-substrate-recall.md** -
    DRAFT EXISTS as of 2026-05-16, AI-produced from code and
    IMPLEMENTATION_PATH prose. Structural content anchored to Phase
    4c implementation; voice to be replaced. Document recall as
    gap-triggered reaching backward into persisted constraints,
    parallel to predictive reaching forward. Reference field.js:172-196
    and storage-adapter.js. Introduces invariants M9, M10, M11, M12.

After hand-rewriting 17 and 18, update INVARIANTS.md v1.3 to v1.4
with M6-M12.

**Contradiction note.** The SE-12 and SE-13 slot numbers were
tentatively claimed by `implementation/08-runtime-kernel/KERNEL_RUNTIME_CONTRACT.md`
section 10 for different mechanisms (cascade-match constraint
pattern, input-feature buffer). Those Phase 8 candidates were
correctly reduced to existing spec (algorithm 16, SE-08, SE-11) and
do not occupy the SE-12/13 slots. The slots are correctly used by
compounds and recall as identified in this list. The KERNEL_RUNTIME_CONTRACT
section 10 should be either deleted or reframed to acknowledge the
slot reassignment when canon work resumes.

---

## TIER 4.5 - UTF specification (begun 2026-05-15, in AI voice)

The universal type format specification work begun in the
2026-05-15 session. These are load-bearing because the entire
adapter protocol, the kernel-as-discrete-artifact, and the substrate
relocation experiment depend on UTF being specified correctly.

18a. **canon/algorithm/16-gpu-postfix-stack-machine.md** - Heavily
     rewritten 2026-05-15. PROPOSED -> IMPLEMENTED, with structural
     argument, closure boundaries, empirical record, and re-readings
     of cited SE-Ns added. The new sections are in AI voice. This is
     canon and load-bearing for everything downstream; tier-1-
     adjacent priority. Already on the list at item 16 implicitly
     via "00-INDEX update" but the file itself needs explicit voice
     review.

18b. **canon/UTF/00-INDEX.md** - NEW, written 2026-05-15. UTF
     directory entry point. ~120 lines. Names UTF's five structural
     commitments and document layout. Heavy AI cadence in the
     "what UTF is / what UTF is not" framing.

18c. **canon/UTF/01-foundations.md** - NEW, written 2026-05-15.
     The structural argument that UTF is WHEN:THEN, not KEY:VALUE.
     ~350 lines. The single most load-bearing document in the UTF
     directory; everything downstream cites the five differences
     named here. Tier-1-equivalent for UTF work specifically.

18d. **canon/UTF/research/key-value-formats-survey.md** -
     Reference material produced by a survey agent 2026-05-15.
     ~1500 words. **Decision needed: rewrite vs label.** This
     document has the heaviest AI signature in the entire repo
     (it was produced by an exploration agent). One option: rewrite
     in your voice. Other option (cleaner): add a header note that
     says "this is reference material produced by a survey agent,
     preserved verbatim for transparency." The second option is
     more honest and saves time. Recommendation: label, don't
     rewrite.

18e. **canon/UTF/research/substrate-stratification-observation.md** -
     NEW, written 2026-05-15 to capture an observation made during
     UTF work. ~140 lines. Observation-level document, not canon
     proper. Could be rewritten or kept with provenance noted.
     Lower priority than 18a-18c.

---

## TIER 5 - Documents I authored during migration (must be replaced)

I wrote these during the V1->V2 reorganization. They carry my voice,
not yours. Highest priority for replacement.

19. **implementation/kernel/README.md** - The kernel scope definition
    ("what the kernel is / is not"). This is load-bearing because it
    formally distinguishes kernel from spec from application. Must be
    in your voice; the distinction matters too much to ride on mine.

20. **canon/VERSION.md** - Pin file for the canon stack. Data, mostly,
    but the prose framing is mine. Re-do in your voice.

21. **implementation/05.5-cleanup-trajectory/KERNEL-POINTER.md** -
    Pointer to the canonical kernel; explains why this phase doesn't
    re-host the kernel files.

22. **implementation/08-runtime-kernel/KERNEL-POINTER.md** - Same as 21,
    for Phase 8.

23. **implementation/09-trust-boundaries/README-trust-boundaries.md** -
    Phase 9 README. Includes layer F/T/S overview that I drafted from
    the agent reports. Replace with your authored version.

---

## TIER 6 - Phase plans and continuance docs (you wrote these, but they
have AI cadence)

These are documents you wrote with AI assistance during the work.
Voice may already be partially yours; review for AI patterns.

24. **implementation/09-trust-boundaries/PHASE_9_PLAN_OF_CONTINUANCE.md**
25. **implementation/09-trust-boundaries/PHASE_8_PLAN_OF_CONTINUANCE.md**
    (note: this version is in 09, not 08, because 09 carried it
    forward)
26. **implementation/09-trust-boundaries/PHASE_10_PLAN_OF_CONTINUANCE.md**
27. **implementation/09-trust-boundaries/LESSONS.md**
28. **implementation/09-trust-boundaries/SPEC_AUDIT.md**
29. **implementation/09-trust-boundaries/STATUS.md**
30. **implementation/08-runtime-kernel/PHASE_8_PLAN_OF_CONTINUANCE.md**
31. **implementation/08-runtime-kernel/STATUS.md**
32. **implementation/08-runtime-kernel/KERNEL_RUNTIME_CONTRACT.md**
33. **implementation/08-runtime-kernel/P1_CRM_DOMAIN_MODEL.md**
34. **implementation/07-consumption/phase-7-direction.md**
35. **implementation/07-consumption/phase-1-findings.md**
36. **implementation/07-consumption/stage-3.4/SPEC_DIMENSIONAL_RESOLUTION.md**
37. **implementation/07-consumption/stage-3.4/MINIFY_COMPARE_FINDINGS.md**
38. **implementation/07-consumption/stage-3.4/IDEA_PREPARATIVE_REPRESENTATION.md**
39. **implementation/07-consumption/stage-2-chained/STAGE_2_OBSERVATIONS.md**
40. **implementation/07-consumption/stage-2-parallel-findings.md**

---

## TIER 7 - Phase READMEs (lighter touch, but check)

41. **implementation/06-lattice/lattice-duel/README.md**
42. **implementation/06-lattice/lattice-vs-lattice/README.md**
43. **implementation/06-lattice/rich-duel/README.md**
44. **implementation/05.5-cleanup-trajectory/README.md** (yours)
45. **implementation/05.5-cleanup-trajectory/PHASE6_RESEARCH_NOTES.md**
46. **implementation/05.6-validation/PHASE-5.6-spec.md**
47. **implementation/05.6-validation/pressure-tests/PRESSURE_TESTS.md**
48. **implementation/05-coupling/README.md**
49. **implementation/05-coupling/IMPLEMENTATION_PATH-v2.md**

---

## TIER 8 - Exodus narrative documents

These are the vision/theory layer. Voice should be philosophy register,
not engineering. Different cadence from canon documents.

50. **exodus/roadmap/thesis-and-praxis.txt**
51. **exodus/canonical-implementation/CLAUDE.md** (review: CLAUDE.md
    files are typically AI-collaboration logs - decide whether to keep)
52. **exodus/canonical-implementation/README.md**
53. **exodus/canonical-implementation/IMPLEMENTATION_PATH.md**
54. **exodus/canonical-implementation/ROADMAP.md**
55. **exodus/canonical-implementation/constraints.md**
56. **exodus/the-spec/vsf-spec.md**
57. **exodus/the-spec/algorithm-canonical.md**
58. **exodus/the-spec/collapsible-execution.md**
59. **exodus/theory/research/Noise.txt**
60. **exodus/theory/research/Quantum_Computing.md**
61. **exodus/theory/research/Consciousness Resesrch.md** (note: typo in
    filename, "Resesrch" should be "Research")
62. **exodus/theory/research/Heterogeneous_Architecture.md**
63. **exodus/theory/research/Post Theory Closing Research.md**
64. **exodus/theory/research/WebGPUComputeReaearch.md** (filename typo)
65. **exodus/theory/research/The Manifold Reflex.text**
66. **exodus/theory/research/awareness-model/the-build/DEFINITION.md**
    (older version of canon DEFINITION; preserve as theory snapshot
    or retire)
67. **exodus/theory/research/awareness-model/the-build/simple_definition.md**

---

## TIER 9 - Meta documents that orient the reader

These are second-impression documents but still worth checking.

68. **meta/MANIFEST.md** - the original V1 manifest (now historical;
    consider whether to update or retire)
69. **meta/AMENDMENT_2.4.md** - amendment process record
70. **meta/CONTRIBUTING.md** - external-contributor orientation; if
    keeping, voice matters
71. **meta/IMPLEMENTATION_PATH.md** - project roadmap; outdated relative
    to current Phase 9 state
72. **meta/PROJECT_SPLIT.md** - architectural decomposition note
73. **meta/DOCS-orientation.md** - was DOCS/README.md; orientation
74. **meta/producing-the-stylesheet.md** - 158KB. Unknown content;
    review and decide whether to retain.
75. **meta/DEDUP-ACTIONS.md** - V1 dedup audit; mostly historical now
    that V2 is built

---

## DOCUMENTS TO POTENTIALLY WRITE FROM SCRATCH

These are documents the project should have but doesn't:

A. **Root README.md** - the entry point for someone arriving cold.
   Currently the project root has PREFACE.md + four directories. A
   reader has no map. README.md should be a one-page orientation:
   what this is, where to start, how to verify the claims.

B. **canon/README.md** - what's in canon/ and why. The four documents,
   the two subdirectories, the version pin. Tells a reader entering
   canon how to read it.

C. **implementation/README.md** - the trajectory: what each phase
   establishes, what comes next, where the current edge is.

D. **exodus/README.md** - the relationship to canon. What EXODUS is
   in relation to the implementation track.

E. **meta/README.md** - what meta/ holds and why.

---

## SUGGESTED ORDER OF WORK

Updated 2026-05-15 to reflect the four new root-level documents and
the UTF specification work.

Highest leverage, in order:

1. **README.md** (root) - first thing any GitHub visitor sees.
   Was just written; needs to be your voice.
2. **PREFACE.md** (root) - the structural claim.
3. **ARCHITECTURE.md** (root) - the kernel/adapter naming. Reframes
   how everything else is read; voice here propagates.
4. **PROJECT-PLAN.md** (root) - project organization. Lower
   philosophical weight but high first-impression presence.
5. **RESEARCH-AGAINST-PREFACE.md** (root) - the catalogue. Replace
   the explicit AI provenance language; rest is lighter touch.
6. **canon/INVARIANTS.md** - the checklist of structural
   commitments.
7. **canon/DEFINITION.md** - foundational definition.
8. **canon/KERNEL.md** - kernel pseudocode.
9. **canon/algorithm/16-gpu-postfix-stack-machine.md** - the
   recently rewritten algorithm; load-bearing for the empirical
   floor.
10. **canon/UTF/01-foundations.md** - the WHEN:THEN argument.
    Everything downstream in UTF depends on this being in your
    voice.
11. **canon/UTF/00-INDEX.md** - UTF directory entry point.
12. **implementation/kernel/README.md** (replace migration-era voice).
13. SE-01 through SE-11.
14. SE-12 and SE-13 (new D2 closure).
15. Everything else can be batched.

Items 1-12 are what a skeptical reader hits first or what is
structurally load-bearing for the work downstream. They are the
difference between "give the work the time of day" and "looks AI."

## ESTIMATED TIME

Tier 1 (8 docs after 2026-05-15 additions): 4-8 hours of focused
rewriting per document, depending on depth. Total: 32-64 hours.
The new root-level documents (ARCHITECTURE.md, PROJECT-PLAN.md,
RESEARCH-AGAINST-PREFACE.md, README.md) are each lighter than the
original four canon documents but still meaningful.

Tier 2 (11 SE docs): 1-2 hours per. Total: 11-22 hours.

Tier 4 (2 new SE docs): 2-4 hours per. Total: 4-8 hours.

Tier 4.5 (UTF docs, 4-5 items): 2-4 hours each for 18a/b/c; the
research survey is recommended as label-only (15 minutes). Total:
6-12 hours.

Tier 5 (5 docs I wrote): 1-2 hours per. Total: 5-10 hours.

The rest can be done as time permits, lower priority each tier down.
