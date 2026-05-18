# Research: Substrate-Intrinsic Dynamics vs Router-Mediated Behavior

**Role.** Reference material. This article synthesizes the empirical
Phase 6 headless-duel runs into a structural distinction that UTF
needs in order to answer questions about substrate behavior:
*what the substrate does on its own* versus *what the substrate
appears to do once a router interprets its output and feeds back
into game state*.

**Date produced.** 2026-05-17

**Method.** Empirical data from
[exodus/canonical-implementation/tests/extensions/lattice-runs/](../../../exodus/canonical-implementation/tests/extensions/lattice-runs/)
(Puppeteer-driven headless runs of all seven Phase 6 autonomous
duel variants) read against the structural recognitions already
captured in
[phase-6-substrate-duels-analysis.md](phase-6-substrate-duels-analysis.md)
and the kernel-primitive lock in
[utf-decision-questions.md](../utf-decision-questions.md).

**See also.**

- [exodus/canonical-implementation/tests/extensions/lattice-runs/FINDINGS.md](../../../exodus/canonical-implementation/tests/extensions/lattice-runs/FINDINGS.md) — the raw empirical findings
- [phase-6-substrate-duels-analysis.md](phase-6-substrate-duels-analysis.md) — six structural recognitions read out of the duel source code
- [substrate-stratification-observation.md](substrate-stratification-observation.md) — the layered-vocabulary recognition

**Discipline note.** Per DEFINITION §0.5, this article does not
import frames from outside the spec. Where the analysis uses
words like *attractor*, *symmetry*, or *equilibrium*, they refer
to states observed in the run logs, not to imported physics
content. Where the analysis names a *router*, it refers to a
specific function in the duel source (the per-turn action
selector), not to network-routing or attention-routing metaphors.

-----

## 1. The question the duels appeared to answer

The Phase 6 duels were initially read as a test of the substrate's
behavior: *does the substrate produce productive vocabulary growth
across rounds, or does it lock into a defensive pattern?*

The headless runs answered that question empirically:

| Variant | Substrate-internal pattern observed |
|---|---|
| `rich-duel-melting-pot` | Progressive ratification growth through round 4 (17 → 59 ratifications), then frozen |
| `lattice-vs-lattice` v1 | Immediate large ratification at round 0 (88), frozen for 9 more rounds |
| `lattice-vs-lattice` v2 | Even more extreme immediate ratification (97), frozen from round 0 |
| `rich-duel _crossed` | **Zero ratifications, zero sub-cascades across 5 rounds**, then full deadlock |
| `rich-duel` (original) | Round-1 step-deadlock with no resolution |

Read at this level, the finding was: *5 of 5 successful runs locked.
The substrate does not sustain productive vocabulary growth.* That
finding was load-bearing for FINDINGS.md §4 and motivated the
"substrate-stability-vs-emergence tradeoff" entry in §5.

That finding is real, but it is not the question the runs actually
answer. The user's reframe — *why would it lock? that ends up
becoming a problem space dilemma right? lets actually look at
the input space and objectivity of the substrate* — surfaces a
distinction that the raw finding obscures.

-----

## 2. What the duels actually measure

Each duel HTML wraps the substrate in three layers:

1. **The substrate proper.** Constraints, ratifications, sub-cascades,
   delta computation. This is the architecture under study.
2. **A router.** A per-turn function that reads the substrate's
   resolved output and converts it into a *game action* (attack,
   heal, block, etc.) by mapping resolved keys to a fixed action
   table.
3. **A game-state loop.** HP totals, action history, debuff status,
   round-win counters. The router writes into this state; the
   substrate reads from it on the next turn.

The substrate does not see the game directly. It sees *the trace
the router and game-state loop produce in its input channel*. The
substrate's input is bounded, structured, and shaped by an
interpretation layer the substrate does not control.

This means: **the runs measure the substrate's output-under-router-
interpretation in a bounded-input symmetric-objective game. They
do not measure the substrate's intrinsic dynamics.**

The distinction matters because lock-as-observed is a property of
the *coupled system* (substrate + router + game-state loop), not
a property of the substrate alone. Pulling on the variants
demonstrates this directly.

-----

## 3. The `rich-duel _crossed` case is the proof

The cleanest evidence that the lock is router-mediated, not
substrate-intrinsic, is the `rich-duel _crossed` run. The
substrate-internal trajectory:

| Round | A cons / rat / sub | B cons / rat / sub | Round outcome | Turns |
|---|---|---|---|---|
| 0 | 7 / 0 / 0 | 7 / 0 / 0 | A wins | 1 |
| 1 | 11 / 0 / 0 | 11 / 0 / 0 | A wins | 1 |
| 2 | 15 / 0 / 0 | 15 / 0 / 0 | A wins | 1 |
| 3 | 17 / 0 / 0 | 17 / 0 / 0 | A wins | 1 |
| 4 | 19 / 0 / 0 | 19 / 0 / 0 | A wins | 1 |
| 5 | 19 / 0 / 0 | 19 / 0 / 0 | **deadlock (timeout)** | 4370+ |

A won five rounds in a row, in one turn each. The substrate's
ratification count was **zero throughout**. The substrate's
sub-cascade count was **zero throughout**. The constraint count
grew slightly (7 → 19) but no ratification occurred and no
emergent kind was produced.

The substrate is *doing almost nothing* and A is *winning five
rounds straight*. Then the substrate is *still doing almost
nothing* and the game *deadlocks for four thousand turns*.

Both outcomes — the five wins and the deadlock — are router
behavior. The router's action selector was reading whatever the
substrate's bare constraint base happened to resolve to and
mapping it to game actions. The substrate was a coin flip
weighted by initial-state asymmetry. When the asymmetry tilted
toward A, A won in one turn. When the game state evolved past
the asymmetry's reach, the router could no longer extract a
winning action and the game stuck.

The lock observed in this variant is the *router's failure to
extract a discriminating signal from a substrate that did not
produce one*. It is not the substrate locking.

-----

## 4. The `lattice-vs-lattice` cases are a different kind of evidence

The two `lattice-vs-lattice` variants show the opposite extreme:
**enormous immediate substrate-internal activity, then complete
stasis.** A's constraint counts in v1 reached 88 ratifications in
round 0 and stayed at 88 for the remaining nine rounds.

This is the empirical answer to the fast-heat-up vs slow-burn
comparison the variants were designed to test. Fast-heat-up (A)
ratified aggressively on the first signal that crossed its
threshold. Slow-burn (B) required confirmation across distinct
contexts, and in the autonomous-play input shape it received,
those distinct contexts never arrived. B ratified one constraint
in v1 and zero in v2.

But the same router-mediated reading applies. The substrate's
"lock" at round 0 is *the substrate having found enough structure
to feed the router's action-extraction needs in this game*.
Producing more structure would not change the router's output
because the router's table only has so many actions. Once the
substrate has saturated the router's discriminative capacity,
producing additional ratifications is wasted work and the
substrate's gradient on producing them collapses to zero.

The substrate stopped producing new vocabulary because *its
input channel stopped presenting it with material that would
demand new vocabulary*. The game state was already adequately
mapped by the existing ratifications. This is exactly the
behavior the architecture is supposed to exhibit: the substrate
forms structure proportional to the discriminative demand of
its input. When discriminative demand saturates, structure-
formation saturates too.

-----

## 5. The `rich-duel-melting-pot` case is the control

Melting-pot is the only variant in the run set that allows
substrates to **invent new ability vocabulary** at ratification
time. Its trajectory shows what substrate-internal dynamics
look like when the input channel is genuinely open:

| Round | A cons / rat / sub |
|---|---|
| 0 | 112 / 17 / 1 |
| 1 | 154 / 38 / 6 |
| 2 | 161 / 49 / 12 |
| 3 | 155 / 56 / 16 |
| 4 | 151 / 59 / 17 |
| 5 | 155 / 59 / 18 |
| 6 | 157 / 59 / 18 |
| 7 | **158 / 59 / 18** ← lock |

Ratifications grow through round 4 then freeze. Sub-cascades
grow through round 5 then freeze. The substrate produces five
rounds of genuine vocabulary growth before locking.

What's different about melting-pot is **not the substrate** —
it's the same substrate the other variants use. What's different
is the input space. Invented abilities introduce new tokens that
the substrate has not previously seen, which forces the
ratification gradient back open. Once the invention engine has
explored most of what the round structure allows, new tokens
stop appearing and the substrate locks just like the others.

This is the third confirmation that the lock pattern is a
**property of input saturation**, not a property of the
substrate's machinery. Same substrate, three different input
shapes, three different lock trajectories:

- Zero discriminative input (`_crossed` post-asymmetry) → zero substrate growth, game deadlock
- Saturated input (lattice-vs-lattice) → maximal immediate growth then immediate freeze
- Slowly-saturating input (melting-pot) → progressive growth then gradual freeze

-----

## 6. The structural distinction this surfaces

The lock-as-observed in the duels resolves into two distinct
phenomena that the duels cannot separate but UTF must:

**Substrate-intrinsic dynamics.** What the substrate does given
its input channel. Constraint accumulation, ratification, sub-
cascade promotion, delta-driven gradient on emergence. These
mechanisms operate identically across all variants. The headless
runs confirm they continue operating throughout — even in the
deadlocked variants, the substrate is still resolving cascades,
still computing delta, still gating ratification. The substrate
does not stop.

**Router-mediated game outcomes.** What the coupled system does
given a router that converts substrate output into game actions
and a game-state loop that feeds back into the substrate's input.
Lock, deadlock, sweep, and round-resolution are properties of
this coupling, not of the substrate.

The duels measure the second phenomenon. They report on what
happens when a substrate is placed inside a particular kind of
coupling: a bounded-input, symmetric-objective, sparse-reward
game with a finite action table. Inside that coupling, the
substrate appears to lock. The empirical claim that holds is
narrow: *under this specific coupling, the substrate-plus-
coupling produces convergence to a defensive attractor within
the first 0-5 rounds*. The empirical claim that does **not**
hold is wide: *the substrate locks*.

-----

## 7. Why the bounded coupling forces convergence

The user's reframe — *that ends up becoming a problem space
dilemma right?* — names the mechanism. Inside the duel coupling:

- The input space is *small* (HP bands, action history depth,
  debuff status — a few dozen discriminable game states).
- The objective is *local survival* (avoid HP→0).
- The two players are *symmetric* (mirror substrates with
  mirror initial conditions, or close to it).
- The reward signal is *sparse* (one bit per round: did I
  reach 0 HP first?).

Any system — substrate, ML model, hand-coded heuristic,
human player — placed inside that coupling converges to a
defensive equilibrium because:

1. Small input means few distinguishable situations to learn
   from.
2. Local survival means defensive structure dominates offensive
   structure (you only need to not-die; you don't need to win).
3. Symmetry means both players' defensive structures cancel
   each other's offensive structures.
4. Sparse reward means the substrate has very little gradient
   information to push it past the defensive attractor.

This is a property of the *problem*, not the substrate. The
duels are correctly demonstrating that the architecture handles
this problem the way any reasonable architecture would: by
forming whatever defensive structure the bounded input affords,
then stopping.

-----

## 8. What this implies for UTF

Three implications, in order of how load-bearing they are for
the specification:

### 8.1 The lock pattern is not a substrate property to address in spec

UTF does not need a primitive, mechanism, or commitment to
"prevent locking." The lock observed in Phase 6 is a property
of the coupling, not the substrate. The substrate's behavior
under the coupling is exactly what the architecture's
commitments require: form structure proportional to
discriminative input, stop forming structure when input
saturates discriminative demand.

This refines an earlier FINDINGS.md §5 entry that proposed a
"substrate-stability-vs-emergence tradeoff" as architectural.
There is a real tradeoff, but it is between *input shapes the
substrate is exposed to* and *the substrate's growth
trajectory*. It is not between two architectural properties.
The user's "let delta decide" commitment already names how the
architecture handles this: the substrate's growth follows the
delta gradient, and that gradient is set by the input channel.

### 8.2 The "open emergent layer" remains open in capacity, not guarantee

Q1=C locked the substrate as two layers: closed kernel primitives
and open emergent layer. The empirical refinement holds:
*openness* in the emergent layer is a capacity, not a guarantee.
Whether the layer stays productive depends on the input channel
continuing to present material that demands new vocabulary.

This was already captured in FINDINGS.md §4 Finding 4 and
remains correct. The substrate-intrinsic-vs-router-mediated
distinction sharpens it: the input channel's productivity is a
property of *what is upstream of the substrate*, which in the
duels is the router-plus-game-state, and in the Terraformation
Pipeline (Priority 6 of the project plan) would be the web-
platform specification corpus. These two input shapes are
categorically different.

### 8.3 The Terraformation Pipeline is the missing substrate-intrinsic test

Every test in the Phase 6 duel set places the substrate inside
a router-mediated coupling. None of them measure substrate-
intrinsic dynamics under genuinely open input. The Terraformation
Pipeline does — it pipes the platform-spec corpus directly into
the substrate's input channel with no router and no symmetric
opponent. Its results will be empirical evidence about
substrate-intrinsic dynamics in a way the duels are not.

UTF should not pre-commit to either outcome:

- If the Terraformation Pipeline shows productive vocabulary
  growth, the duels' lock-pattern is confirmed as a coupling
  property and UTF's commitments hold without revision.
- If the Terraformation Pipeline also locks, the substrate has
  an intrinsic property the duels happened to surface
  accidentally and UTF will need to address it.

Either outcome is informative. The wide claim "the substrate
locks" can only be sustained or refuted by the open-input test,
not by the duels.

-----

## 9. What this article does and does not claim

### Does claim

- The Phase 6 duels measure a coupled system, not the substrate
  alone.
- The lock observed across variants is dominantly explained by
  properties of the coupling: bounded input, symmetric players,
  local-survival objective, sparse reward.
- The `rich-duel _crossed` zero-ratification five-win-then-
  deadlock run is empirical evidence that game outcomes can be
  fully router-driven with the substrate playing essentially no
  role.
- UTF does not need to add a primitive or commitment to address
  the lock pattern; the architecture's existing commitments
  produce exactly the behavior observed.

### Does not claim

- That the substrate cannot lock. The Terraformation Pipeline
  test will determine this.
- That the duels are uninformative. They are highly informative
  about the substrate's behavior under bounded-input symmetric-
  game couplings, which is itself a useful regime to characterize.
- That the router is poorly designed. The router is doing what
  it was specified to do: extract game actions from substrate
  output via a fixed table.
- That fast-heat-up is "better" than slow-burn or vice versa.
  Each is appropriate to a different input shape; the duels
  happened to expose slow-burn to an input shape it cannot
  handle.

-----

## 10. What needs to happen next

In order of priority:

1. **Update FINDINGS.md** to clarify that the headline finding
   ("substrate lock is dominant") is a coupling-level finding
   under the duel's specific game configuration, not a
   substrate-level finding. Preserve the empirical data.
2. **Plan a substrate-intrinsic open-input test.** The
   Terraformation Pipeline is the natural fit but may be larger
   than needed for a first pass. A smaller alternative: pipe a
   diverse text corpus (specification text, code, documentation)
   into the substrate's input channel with no router and observe
   substrate-internal dynamics — does ratification stop, does
   sub-cascade promotion stop, does delta gradient collapse?
3. **Hold UTF commitments stable** until the open-input test
   produces data. Q1=C and Q2=4 kernel primitives both survive
   this analysis intact. No revision is warranted on the
   strength of the Phase 6 runs alone.

-----

## Live status

| Date (yyyy-mm-dd) | Action |
|---|---|
| 2026-05-17 | Article produced from headless-run data extraction and reframe of [FINDINGS.md](../../../exodus/canonical-implementation/tests/extensions/lattice-runs/FINDINGS.md). FINDINGS.md update pending. |
