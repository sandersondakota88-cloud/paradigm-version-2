# Plan: Substrate-Intrinsic Open-Input Test

**Role.** Reference material. A plan of attack for the missing
experiment named in
[substrate-intrinsic-vs-router-mediated.md §8.3](substrate-intrinsic-vs-router-mediated.md) —
the test that would actually answer whether the substrate locks
under genuinely open input or only under bounded router-mediated
couplings.

**Date produced.** 2026-05-17

**Goal.** Produce empirical data about substrate-intrinsic
dynamics. Specifically, answer: when the substrate's input
channel is fed material that is large, diverse, and not shaped
by a router-plus-game-state coupling, does ratification stop,
does sub-cascade promotion stop, does the delta gradient
collapse — or do these stay productive?

**Relation to the project plan.** This is *not* the Terraformation
Pipeline ([PROJECT-PLAN.md §6](../../../PROJECT-PLAN.md), the
80-100 MB platform-spec corpus). It is a smaller experiment that
sits between the lattice-runs (bounded, router-mediated) and the
Terraformation Pipeline (unbounded, web-platform-scale). Its
output informs whether the full Terraformation Pipeline is the
right next test or whether intermediate work is needed first.

**Discipline note.** Per DEFINITION §0.5, no imported frames.
"Open input" means *input that does not pass through a router
that maps substrate output back into the input channel via a
fixed action table*. It does not mean "unlimited," "random,"
"unstructured," or "natural." It is a specific structural
contrast with the lattice-runs coupling.

-----

## 1. What the experiment must produce

Three artifacts, in priority order:

1. **A substrate-internal trajectory log.** Per-tick or per-batch
   readings of: constraint count, ratification count, sub-cascade
   count, delta gradient magnitude, kernel dispatch-event rate.
   Same columns as the lattice-runs `_summary.tsv` extended with
   delta and dispatch metrics.

2. **A determination of which of three outcomes the substrate
   exhibits:**

   - **(O1) Sustained productivity.** Ratifications and sub-
     cascades continue forming throughout the run. No lock.
     This would refute the wide claim "the substrate locks."

   - **(O2) Input-driven saturation then freeze.** Vocabulary
     grows until the input's discriminative demand saturates,
     then freezes — same pattern as melting-pot but at a much
     higher saturation point. This would confirm the reframe:
     lock is an input-saturation property, scaled by input
     diversity.

   - **(O3) Substrate-intrinsic lock.** Vocabulary growth stops
     well before input diversity is exhausted, with substantial
     un-discriminated input remaining in the channel. This would
     reveal a substrate-intrinsic property the duels surfaced
     accidentally and that UTF must address.

3. **A characterization of the productive-region boundary** if
   the substrate exhibits O2 or O3. What did the substrate
   ratify? What did it ignore? This tells us *what kind of
   discriminative demand* the substrate is responsive to and
   what kind it isn't.

-----

## 2. What the experiment must not do

- **Must not introduce a router.** The whole point is to remove
  the router-plus-game-state-loop coupling. No fixed action
  table, no per-tick mapping from substrate output back into
  input channel.

- **Must not invent new kernel primitives.** The Q2-locked four
  (seed, trace-entry, dispatch-event, field-state) are what the
  test uses. If the test seems to need a fifth, that's an
  important finding but it stops the test, not extends it.

- **Must not pre-judge the outcome.** The plan does not assume
  the substrate stays productive (O1), does not assume it
  saturates (O2), does not assume it locks (O3). All three are
  legitimate empirical possibilities. Discipline-cost of the
  plan is taking all three seriously.

- **Must not scale to platform-spec corpus on first pass.** The
  Terraformation Pipeline ([PROJECT-PLAN §6](../../../PROJECT-PLAN.md))
  is large enough that running it before having intermediate
  data would be expensive and slow to iterate on. This plan
  designs an intermediate experiment first.

-----

## 3. Plan of attack

Five phases, each producing a falsifiable artifact. Phases 1-3
build the test; phases 4-5 run it and interpret results. Each
phase should be small enough to abandon if its falsification
condition trips.

### Phase 0 — Audit existing substrate suitability (one session)

Before building anything, verify the substrate implementation
the test would run against can produce the metrics the test
needs.

**Where to look:** the lattice substrates in
[Phase 6/](Phase 6/) (this directory) are the most recently
exercised. The single-substrate baseline (`substrate_duel.html`)
is the simplest. The SE-06 stress test
(`NEW_SPA-specification-stress-test.html`) already runs against
real CSS as input.

**Falsification condition:** if no existing substrate can be
straightforwardly stripped of its router and run autonomously
on a non-game input stream, the plan stops here and a new
prerequisite phase is added: build a router-free runnable
substrate.

**Output:** a one-page note in this directory naming which
existing artifact to base the test on, what minimal
modifications it needs (likely: replace the router with a
no-op, replace the game-state loop with an input-streamer),
and what its built-in metrics already expose.

### Phase 1 — Design the input corpus (one session)

The input corpus is the most important design decision. It
must be:

- **Diverse enough** that saturation, if it occurs, occurs
  because of substrate behavior rather than corpus poverty.
- **Structured enough** that the substrate's input adapter has
  something well-formed to register kinds against. Random bytes
  produce no discriminative signal because there's nothing to
  discriminate; that would tell us nothing.
- **Small enough** to iterate on quickly. Order of 1-10 MB,
  not 100 MB.
- **Not platform-spec.** The Terraformation Pipeline corpus
  is the full platform spec; this test should use *something
  else* so the two experiments measure different things.

**Candidate corpora to evaluate:**

| Candidate | Size | Diversity | Risks |
|---|---|---|---|
| RFC text (a curated subset, e.g. RFC 8259 + 9110 + 6749) | ~2 MB | medium-high | structured text; substrate has to register over English-with-grammar |
| Wikipedia article dump (specific topic, e.g. all "computer science" stubs) | tunable to ~5 MB | very high | risk of being too diverse to find any signal |
| The codebase of a single open-source project (a small one) | 1-10 MB | medium | code is highly structured; substrate's adapter capability for code matters |
| Phase 6 RESEARCH_NOTES.md + the project's own canon/ tree | ~1 MB | medium | self-reference risk — substrate sees the document that defines it |

**Falsification condition:** if no candidate is both buildable
in a session and not redundant with the lattice-runs (e.g., if
the only buildable candidate is another bounded game-state
corpus), the plan stops and Phase 1 is rethought.

**Output:** one corpus picked, with a short justification of
why the others were rejected. Corpus stored at
`canon/UTF/research/open-input-test/corpus.txt` (or similar
named directory under research/).

### Phase 2 — Design the input adapter (one to two sessions)

The substrate cannot consume raw text. It needs an adapter that
emits UTF nodes in spec-defined sequence, per the
Q2-sub-recognition-4 commitment: *adapters wrap host parsers;
they do not reimplement parsing.*

For text-with-grammar corpora, "the host's parser" is the
runtime's tokenizer/lexer. For code corpora, it's the language's
parser (e.g. esprima for JS, the Python stdlib `ast` module for
Python). For RFC text, the simplest authoritative parser is
paragraph/sentence segmentation — basic, but spec-conformant in
the sense that it follows a stated discipline.

**Design constraints inherited from canon:**

- Adapter must register its primitives at load time.
- Adapter must emit UTF nodes (typed-attribute-bearing,
  predicate-assignment-specificity-identity-texture).
- Adapter must not call back into the substrate for routing
  decisions; nodes flow forward only.

**Falsification condition:** if the adapter cannot wrap a
host parser (because no suitable parser exists or the corpus
is fundamentally unparseable in any structured way), the plan
returns to Phase 1 and a different corpus is chosen.

**Output:** a single-file adapter, ASCII-only, no dependencies
beyond the host's stdlib equivalent. Sits at
`canon/UTF/research/open-input-test/adapter.[ext]`.

### Phase 3 — Wire input into substrate, instrument the metrics (one session)

Take the artifact identified in Phase 0, strip its router,
replace its game-state loop with a function that:

1. Pulls the next N bytes/tokens from the corpus.
2. Hands them to the adapter from Phase 2.
3. Lets the adapter emit UTF nodes into the substrate's input
   channel.
4. Lets the substrate run its cascade-resolution cycle.
5. Records the substrate-internal metrics (constraint count,
   ratification count, sub-cascade count, delta magnitude,
   dispatch rate) per cycle.
6. Repeats until the corpus is consumed.

**Falsification condition:** if instrumenting the substrate
requires modifying canonical files (those in
`exodus/canonical-implementation/`), the plan stops and the
instrumentation is moved to a non-canonical copy under
`exodus/canonical-implementation/tests/extensions/`. Per
[CLAUDE.md §1](../../../exodus/canonical-implementation/CLAUDE.md):
canonical files are not modified without reason that survives
the inspector check.

**Output:** a runnable test harness (probably one HTML file +
the adapter file + the corpus file) producing a TSV log of
per-cycle substrate-internal metrics. Lives under
`canon/UTF/research/open-input-test/`. No external dependencies
unless absolutely necessary; if a runner is needed, prefer a
two-line PowerShell script to a node project.

### Phase 4 — Run the test, capture data (one session)

Run the test multiple times — three replicates is enough to
distinguish run-to-run variance from substrate-intrinsic
behavior. Different RNG seeds if the substrate uses one;
different corpus orderings (forward, reverse, shuffled) as a
cheap robustness check.

**Falsification condition:** if the test crashes or runs for
more than a few minutes per replicate, the plan stops and
either the corpus is shrunk or the substrate's tick-rate
configuration is examined. Crashes-during-run revealed Chromium
resource exhaustion in the lattice-runs work; a similar mode
here would mean the substrate is producing more events than
its host runtime can absorb, which is itself an O2 or O3
finding worth recording.

**Output:** per-replicate trajectory TSVs under
`canon/UTF/research/open-input-test/runs/`. A summary table
across replicates. Raw data is the deliverable; interpretation
is Phase 5.

### Phase 5 — Interpret against O1/O2/O3 (one session)

The §1 framework — sustained / input-saturation / substrate-
intrinsic-lock — is the interpretive grid. Apply it carefully.
Distinguishing O2 (input-saturation) from O3 (substrate-
intrinsic-lock) is the hardest call and requires the corpus
diversity to be confirmed independently of the substrate's
behavior on it.

**Anti-pattern to watch for:** declaring O1 prematurely. If the
substrate is still ratifying at the moment the corpus runs out,
that doesn't mean it would have continued ratifying past
saturation; it means we didn't reach saturation. Honest reporting
distinguishes "the substrate did not lock in this run" from "the
substrate cannot lock."

**Anti-pattern to watch for:** declaring O3 prematurely. If
ratification stops, check first whether the corpus's *remaining*
input is novel relative to the *already-formed* substrate
structure. The substrate is supposed to stop forming structure
when input no longer demands new discrimination — that's O2,
not O3. O3 only holds if the remaining input is genuinely novel
to the substrate and the substrate still doesn't engage.

**Output:** an article at
`canon/UTF/research/open-input-test-results.md` reporting which
outcome the test produced and what it means for UTF and for the
Terraformation Pipeline.

-----

## 4. What each outcome implies

### If O1 (sustained productivity)

The lattice-runs lock pattern is confirmed as a coupling
property. The substrate-intrinsic-vs-router-mediated reframe
holds in its strongest form. UTF needs no revision; the
existing Q1=C and Q2 commitments capture what the substrate
does.

The Terraformation Pipeline can proceed as a scale test
(*can the substrate handle the platform-spec corpus operationally*)
rather than as a behavior question (*does the substrate stay
productive*). Different engineering emphasis.

### If O2 (input-driven saturation)

The reframe holds in a softer form. The lock pattern is an
input-saturation pattern; its saturation point scales with
input diversity. The substrate's "open emergent layer" is open
in capacity, bounded by input demand.

UTF should preserve this distinction in the §1 foundations:
the *capacity* for openness is closed-only-by-input, not
closed-by-mechanism. The "let delta decide" commitment maps
to this: the substrate's growth is bounded by the delta
gradient, which is set by input.

The Terraformation Pipeline becomes a question of whether
platform-spec corpus diversity is high enough to keep the
substrate productive at engineering-useful timescales.

### If O3 (substrate-intrinsic lock)

The reframe is wrong (or insufficient). The substrate has a
property that locks vocabulary growth even when input would
still demand more. UTF must address this — either by adding a
mechanism that interrupts the lock (a discipline of forgetting,
a re-seeding event, an attention-shift primitive) or by
documenting the lock as a feature rather than a bug.

This would be the most consequential outcome. It also requires
the most caution: O3 must be confirmed across multiple corpora
and multiple replicates before being load-bearing for spec
revision.

-----

## 5. Order of operations summary

```
Phase 0 (audit existing substrate)         1 session
Phase 1 (design corpus)                    1 session
Phase 2 (build adapter)                    1-2 sessions
Phase 3 (wire + instrument)                1 session
Phase 4 (run)                              1 session
Phase 5 (interpret)                        1 session
                                          ----------
Total                                      6-7 sessions
```

Total estimated work: a week of focused sessions. Each phase
has a falsification condition so abandonment is cheap if a
phase reveals a structural problem upstream.

The plan's output is data, not engineering. The artifacts
(adapter, corpus, instrumented substrate) are scaffolding for
the data; they should be small enough to discard or rebuild
once the data is captured, following the same discipline as
the Puppeteer harness in the lattice-runs work.

-----

## 6. What this plan does and does not commit to

### Does commit

- An intermediate experiment at smaller scale than the
  Terraformation Pipeline.
- Removal of the router-plus-game-state coupling.
- Capture of substrate-internal metrics, not coupled-system
  outcomes.
- Honest reporting against the O1/O2/O3 framework.
- Disposability of the test scaffolding once data is captured.

### Does not commit

- That the test will produce a clean determination. It may
  produce O1.5 (a hybrid that resists the framework), which
  is itself useful data.
- That this experiment substitutes for the Terraformation
  Pipeline. It informs the Pipeline's design and risk
  assessment; it does not replace it.
- A specific timeline. Each phase is estimated at one
  session, but real session lengths vary.
- A specific corpus. Phase 1 picks the corpus deliberately,
  with multiple candidates considered.

-----

## Live status

| Date (yyyy-mm-dd) | Action |
|---|---|
| 2026-05-17 | Plan produced. Phase 0 (substrate audit) is the next session if pursued. |
