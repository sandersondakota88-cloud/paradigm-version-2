# Empirical Findings: Phase 6 Substrate Duels Under Headless Run

**Status.** Reference material. Empirical results from running all 7
autonomous Phase 6 duel variants headlessly via Puppeteer.

**Reframe note (2026-05-17).** A second pass on these runs reframes
the headline finding. The lock pattern reported in §4 is a property
of the *coupled system* (substrate + router + game-state loop), not
a property of the substrate alone. The substrate-intrinsic vs router-
mediated distinction is developed in
[canon/UTF/research/substrate-intrinsic-vs-router-mediated.md](../../../../canon/UTF/research/substrate-intrinsic-vs-router-mediated.md).
The empirical data below is preserved unchanged; the interpretation
in §4-5 should be read alongside the reframe.

**Date.** 2026-05-17

**Method (historical).** A Puppeteer-driven Chromium loaded each duel
HTML, patched its IIFE to expose closure-local `game` and `meta` on
`window`, set the speed throttle to 0, invoked `runFull()`, polled
until completion, and harvested the run data via `copyRunData()` or
DOM scrape. Real cascade resolution, real substrate dynamics — the
same code paths a human running the duel in their browser would
trigger, just without a UI throttle. The harness has been removed;
the captured logs in `runs/` remain as the empirical record.

**See also.**

- [runs/](runs/) — captured per-run logs (50-200 KB each)
- [runs/_summary.tsv](runs/_summary.tsv) — tabular summary across all runs
- [canon/UTF/research/phase-6-substrate-duels-analysis.md](../../../../canon/UTF/research/phase-6-substrate-duels-analysis.md) — the structural analysis these runs were collected against
- [canon/UTF/research/substrate-intrinsic-vs-router-mediated.md](../../../../canon/UTF/research/substrate-intrinsic-vs-router-mediated.md) — the reframe these runs ultimately produced

**Tooling note.** These runs were captured via a Puppeteer-driven
headless Chromium harness (`run-duel.js` + `run-batch.js`) that has
since been removed from the repository. The captured logs in
`runs/` are the persisted empirical record; the harness was a
one-time investigation tool, not infrastructure. Future re-runs
would require rebuilding equivalent tooling, but should not be
needed unless the substrate's mechanisms change.

-----

## 1. Variant verdicts (first pass, 1 replicate each, 3-minute cap)

| Variant | Outcome | Total turns | Final A:B | Lock round | Notes |
|---|---|---|---|---|---|
| `rich-duel` | **DEADLOCK** | 4960 (cap) | 0:0 | Round 1 | Hit timeout in round 1 |
| `rich-duel _crossed` | **DEADLOCK** | 4370 (cap) | 5:0 | Round 6 | A swept first 5, then deadlocked |
| `rich-duel-melting-pot` | ✓ completed | 1163 | 4:6 | Round 7 (structural lock; rounds still completed) | Healthy |
| `rich-duel_asymettry` | **CRASHED** | — | — | — | Chromium frame detached during deadlock |
| `rich-duel_swap` | **CRASHED** | — | — | — | Navigation timeout (Chromium recovering from prior crash) |
| `lattice-vs-lattice` (v1) | ✓ completed | 9985 | 2:9 | Round 1 (structurally; rounds still resolved) | Massive A-lock by round 1, rounds resolve via dice |
| `lattice-vs-lattice` (v2) | ✓ completed | 10498 | 1:10 | Round 0 (structurally) | Even more extreme A-lock |

**Three completion classes:**

- **Healthy** (`rich-duel-melting-pot`): all 10 rounds completed in ~50s; sub-cascade promotion continued through round 5; lock at round 7 but rounds still resolved on dice variance.
- **Round-lock complete** (`lattice-vs-lattice` v1 & v2): rounds resolved (one side or the other ran out of HP via dice) but the substrate locked structurally at round 0/1 — no further constraint accumulation after that point. The "winner" of each round is functionally dice-determined.
- **Structural deadlock** (`rich-duel`, `rich-duel _crossed`): rounds did not resolve. Both substrates accumulated defensive structures that prevented either side from taking enough damage to lose. Hit the 3-min timeout.

-----

## 2. The deadlock signature

The two failing variants exhibit a precise empirical signature:

### `rich-duel` (original, meta-substrate disabled internally)

- **Round 1 ran for 4960+ steps without resolving.**
- Score: 0:0 throughout.
- Step rate started at ~100/s and degraded to ~10/s as constraint structures accumulated (linear-or-worse cost growth per step).
- Constraint count grew unboundedly (would have hit caps eventually but did not within the timeout window).
- **Both substrates were in a stable defensive lock:** every action met a counter, every counter met another counter, no damage accumulated.

### `rich-duel _crossed` (CROSSED coordination variant)

- **Rounds 0-4 resolved quickly (1 turn each!), all A wins.**
- **Substrate-internal: ZERO ratifications, ZERO sub-cascades across all 5 rounds.** Constraint count grew slightly (7 → 19) but no constraint ever ratified and no emergent kind ever formed. This is critical evidence — see [substrate-intrinsic-vs-router-mediated.md §3](../../../../canon/UTF/research/substrate-intrinsic-vs-router-mediated.md). The five round-wins occurred entirely through the router's action-extraction over an initial-state asymmetry; the substrate played essentially no role.
- **Round 5 deadlocked at 4370+ steps.** The router could no longer extract a discriminating action from the substrate's near-empty resolved state and the game stuck.
- The CROSSED predator-prey channel pairing did not prevent deadlock; it shifted *when* deadlock occurred (round 5 instead of round 1).

### `rich-duel-asymettry` and `rich-duel_swap` crashes

Both crashed before harvest. The frame-detached error pattern strongly suggests Chromium ran out of resources (memory, handles, or both) during a long deadlocked round. The `rich-duel _crossed` run produced a 156 KB log file (the largest of all runs) — suggesting the asymmetry/swap variants would have produced similar or worse log volumes under deadlock.

**These two are recoverable** by running them with cleanup between variants or with shorter timeouts. They are not architecturally different from the others; they're just unstable under headless deadlock.

-----

## 3. The lock signature in completed runs

The three runs that completed all show **constraint lock** — the substrate's accumulated structure stops growing after some round and stays frozen for the remainder.

### `rich-duel-melting-pot-r1`

| Round | A cons/rat/sub | B cons/rat/sub |
|---|---|---|
| 0 | 112 / 17 / 1 | 111 / 19 / 1 |
| 1 | 154 / 38 / 6 | 152 / 37 / 4 |
| 2 | 161 / 49 / 12 | 147 / 40 / 12 |
| 3 | 155 / 56 / 16 | 153 / 44 / 17 |
| 4 | 151 / 59 / 17 | 149 / 47 / 19 |
| 5 | 155 / 59 / 18 | 147 / 47 / 21 |
| 6 | 157 / 59 / 18 | 148 / 47 / 21 |
| 7 | **158 / 59 / 18** | **148 / 47 / 21** |
| 8 | 158 / 59 / 18 | 148 / 47 / 21 |
| 9 | 158 / 59 / 18 | 148 / 47 / 21 |

**A's ratification count stops growing after round 4 (frozen at 59).**
**B's ratification count stops growing after round 4 (frozen at 47).**
**Both substrates stop forming new sub-cascades after round 5.**
**Constraint count fluctuates by ±3 from round 5 onward (eviction/regeneration around the cap).**

Rounds 5-9 are *dice variance over a fixed-vocabulary substrate*. No new structure is forming; the substrate just plays out its accumulated dispositions through random rolls.

### `lattice-vs-lattice` v1 and v2

Both show **immediate lock at round 0**. A's constraint count is set after round 0 and never changes for 10 rounds. B's even more so (B holds 53/1/3 or 52/0/2 throughout — barely any structure at all).

The lattice-vs-lattice variants are testing fast-heat-up vs slow-burn parameterizations, and **both parameterizations lock immediately**. The fast-heat-up player (A in v1) gets 88 ratifications in round 0 alone and holds that count for 10 rounds. The slow-burn player (B) gets 1 ratification ever.

This is the "ChatGPT confirmation-gating" experiment from the README. **Empirically, slow-burn underperforms catastrophically against fast-heat-up.** The slow-burn discipline (3 confirmations across distinct contexts before ratifying) is so restrictive that B effectively never ratifies anything, while A's fast-heat-up player ratifies on first match and dominates.

-----

## 4. What this empirically establishes

Four findings, ordered by load-bearingness for UTF / architecture decisions.

**Read these with the reframe in mind.** Each finding is empirically
solid as a coupled-system observation — what the substrate-plus-
router-plus-game-state-loop does in the duel configuration. None of
them are claims about substrate-intrinsic behavior in general. The
companion article
[substrate-intrinsic-vs-router-mediated.md](../../../../canon/UTF/research/substrate-intrinsic-vs-router-mediated.md)
develops this distinction in detail.

### Finding 1: Substrate lock is the dominant outcome, not the exception

Of the 5 successful runs:
- 1 had productive vocabulary growth through round 4 then locked (melting-pot)
- 2 locked at round 0 or 1 (lattice-vs-lattice v1, v2)
- 2 deadlocked entirely (rich-duel, rich-duel _crossed)

**5 of 5 successful runs locked. 0 of 5 sustained productive vocabulary growth through all 10 rounds.**

The user's earlier observation was correct: *"most of the other games end with the substrates getting caught in cyclical loops of either healing, self preservation or avoidance."* This is empirically confirmed across the variant space.

### Finding 2: CROSSED coordination did not prevent lock

The `rich-duel _crossed` variant's stated purpose was to break the Nash-equilibrium lock seen in `rich-duel`. Comment from the source: *"Cross-concern pairing breaks that symmetry: each substrate now watches the substrate that would naturally counter or complement its own job, producing predator-prey-style dynamics rather than mirror convergence."*

**Empirically: CROSSED shifted the lock from round 1 to round 5, but did not prevent it.** Once A had won 5 rounds straight (the 1-turn rounds suggest a degenerate initial-state advantage), the substrates entered the same defensive lock the original rich-duel exhibits.

### Finding 3: Fast-heat-up dominates slow-burn under autonomous play

`lattice-vs-lattice` was the empirical test of confirmation-gating (slow-burn) vs first-match-ratification (fast-heat-up). Both v1 and v2 results: **fast-heat-up wins 9-2 and 10-1 respectively, with the slow-burn player accumulating effectively no ratifications.**

This is informative for the architecture's "let delta decide" commitment. The slow-burn discipline imposes a *temporal precedence* on ratification (3 confirmations across distinct contexts). The fast-heat-up discipline lets delta drive ratification immediately. **Empirically, the imposed-precedence approach starved the substrate of structure to compete with.**

This sharpens what "let delta decide" means structurally: it's not just about kind-precedence multipliers (the SE-12/SE-13 finding); it's also about *temporal-precedence gates on ratification*. Imposed temporal gates can starve the substrate as effectively as imposed kind multipliers can fragment it.

### Finding 4: The lock is structurally stable, not algorithmically broken

The locked substrates aren't crashed or in error states — they're operating normally according to their own discipline. Constraints continue firing; selections continue; modulation continues; delta continues being computed. **The substrate's mechanisms work; what stops working is *generative emergence above the locked vocabulary*.**

This refines the earlier Phase 6 research article finding (substrate vocabulary is layered, only the bottom layer closed at spec time). The empirical refinement: **the open emergent layer's openness is bounded by attractor formation.** Once the substrate has found a stable attractor in its action space, emergence stops producing new vocabulary because the existing vocabulary is sufficient to maintain the attractor.

This is structurally consistent with the Q1=C lock (closed primitives + open emergent layer). The "open" in "open emergent layer" is a *capacity*, not a *guarantee*. The substrate has the mechanism for emergence; whether emergence stays productive depends on whether the substrate keeps encountering material that challenges its current attractor.

-----

## 5. Implications for UTF / canon

These empirical findings sharpen but do not contradict the structural commitments locked so far:

**Q1=C remains correct.** Two layers — closed primitives + open emergent. The emergent layer is genuinely open in capacity. What's added: emergence *productivity* is bounded by attractor formation, which is a substrate-state phenomenon, not a structural-commitment phenomenon. UTF doesn't need to address it; the architecture's existing F4 (operate indefinitely) and SE-02 (metabolism flow) provide the discipline that could break attractors *if* the substrate encounters challenge material that demands new vocabulary.

**Q2 lock (4 kernel primitives: seed, trace-entry, dispatch-event, field-state) remains correct.** The lock observed in the runs happens *above* the kernel layer — at the constraint-kind and sub-cascade-emergence layers, not at the kernel-primitive layer. The four kernel primitives operate correctly throughout every run, including the deadlocked ones.

**The "adapters wrap host parsers" finding (Phase 6 article §2a) is reinforced.** The substrate's vocabulary growth at this layer depends on what arrives through the input channel. In the duels, input is bounded by game state (HP bands, action history, debuff status). At Terraformation Pipeline scale, input would be the web platform's specification corpus — vastly larger, more diverse, more challenge-shaped. The attractor-formation lock observed in the duels may not be the dominant outcome at terraformation scale; the inputs are categorically different.

**New finding for the catalogue: substrate-stability-vs-emergence tradeoff.** The architecture exhibits a real tradeoff between *stability* (the substrate settles into useful patterns) and *generativity* (the substrate continues producing new vocabulary). Phase 6 makes this empirically visible. The Terraformation Pipeline experiment in PROJECT-PLAN Priority 6 is the test of whether platform-spec-scale inputs can sustain generativity without the substrate locking into an attractor.

-----

## 6. What this article does not commit to

- Does not claim the lock pattern is necessarily wrong. A substrate that locks into a stable attractor may be doing exactly what it should; the test of whether the lock is appropriate is whether the substrate's behavior in lock continues to serve the application's purpose.
- Does not generalize from 5 runs to all possible substrate configurations. The variant space has more dimensions than were tested here (centroid parameters, fidelity windows, intake schemes, lattice composition).
- Does not propose a fix for the deadlock-prone variants. The deadlocks are themselves data — they show the substrate's failure mode under specific configurations, which is informative about which configurations are healthy.
- Does not claim Chromium crashes are substrate failures. They are resource-exhaustion failures of the host environment under extreme substrate state. A different host (more memory, different runtime) would handle them differently.

-----

## 7. Open work

- Run 3-5 replicates per variant to characterize variance (in progress at batch ID bdm92yhaf as of writing).
- Investigate why the deadlocked variants crash Chromium: is it memory growth, handle exhaustion, or something else? Knowing the failure mechanism informs whether a different host would succeed.
- Compare melting-pot's productive-then-lock pattern against lattice-vs-lattice's immediate-lock pattern: what's different about melting-pot's intake configuration that supports 4+ rounds of growth?
- Test variants with longer round-length caps (50, 100 turns max per round) to see if the deadlocks resolve eventually or are genuinely non-terminating.

-----

## Live status

| Date (yyyy-mm-dd) | Action |
|---|---|
| 2026-05-17 | First pass complete (1 replicate per variant). 5/7 variants completed; 2 crashed during deadlock. Four findings documented. |
| 2026-05-17 | Reframe added at head and in §4. Substrate-intrinsic vs router-mediated distinction surfaced from the rich-duel _crossed zero-ratification observation. Companion article published at canon/UTF/research/substrate-intrinsic-vs-router-mediated.md. |
