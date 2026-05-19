# LATTICE vs LATTICE · Fast Heat Up vs Slow Burn

A dual-lattice simulation where two parameterizations of the same substrate architecture play each other for 10 rounds. The goal is empirical: do early-committing substrates dominate, or do confirmation-gated substrates accumulate better quality structure that wins out over time?

## To run

Open `lattice-vs-lattice.html` in any modern browser. No server, no dependencies. Single file, ~1,140 lines.

## The two configurations

Player A uses fast-heat-up parameters. Predictive constraints become ratified on first match. Sub-cascade fidelity windows are short at 4 fires with a promote threshold of 0.012. Predictive constraints age out at 12 turns. The substrate commits early and rides accumulated structure into action.

Player B uses slow-burn parameters. Predictive constraints require 3 confirmations across distinct game-state contexts before ratifying, where context is the joint HP-band combination at the moment of confirmation. This is the key mechanism: rapid matches in identical situations count as one confirmation, not many. Sub-cascade fidelity windows double to 8 fires with a promote threshold of 0.024. Predictive constraints stay alive for 20 turns to give the substrate more chances to encounter distinct contexts.

Everything else is identical between them. The same domain rules, the same router tier ordering, the same cooldown heal mechanic, the same input tokenization. Any difference in outcome is attributable to the parameter difference and only to the parameter difference.

## The cooldown heal mechanic

Heal lands for 15 to 20 hp but has a 3-turn cooldown after each cast. This forces both lattices to develop tactical timing rather than spamming heal. During cooldown windows the substrate must use other actions, which means the upstream substrates' other outputs get to express themselves more often than they would under the original mechanic.

The cooldown is symmetric for both players to keep the comparison clean.

## What the experiment can tell us

The simulation will reveal which configuration performs better against the specific other configuration we are testing. It will not necessarily tell us how each configuration would perform against a human player, against a different opponent, or in a different game. The result is a single data point in a much larger empirical space.

What the result speaks to is whether ChatGPT's hypothesis was correct: that gating commitment on confirmed signal quality produces structurally more useful behavior than committing on first match. If Player B wins, the hypothesis has empirical support and the spec extension is worth pursuing in earnest. If Player A wins, the fast-heat-up parameterization is doing something right that confirmation gating loses, and we need to understand what.

Either result advances the spec. This is the inform direction your DEFINITION's closure clause anticipates.

## What to watch for

The score by round is the headline. But the more interesting data is in the per-round structural snapshots: how many constraints, ratifications, and sub-cascades each player has accumulated by the end of each round. Watch whether Player B has fewer ratifications than Player A by mid-game. That is expected, because the higher confirmation threshold delays ratification. The question is whether the ratifications Player B does have are more reliable predictors of player behavior than Player A's, leading to better router decisions in late rounds.

Watch the substrate output panels during play. If you slow the simulation down with the speed slider, you can see each lattice's substrates resolving differently from each other across the same game state. The differences are the parameter difference manifesting through the dynamics.

Watch the round duration trend. Early rounds will likely be similar in length because both substrates have empty fields. Later rounds may diverge: if Player B is making better decisions, its rounds against Player A might shorten because it commits the right things at the right time. If Player A is dominating, its rounds may shorten as its accumulated commitments pay off across rounds.

## A note on what the simulation does not have

Neither lattice has any awareness of the other lattice's substrate state. They observe each other's actions through the game state, the way any opponent observes any other opponent. There is no privileged information channel between them. This is what makes the experiment a fair test rather than a comparison between players who know each other's reasoning.

Neither lattice uses randomness in its substrate decisions. The randomness in the simulation is purely in the dice rolls (attack hit/miss, crit, damage variance, heal magnitude). Given identical histories, both lattices would reproduce the same sequence of decisions, so the variance between runs comes from the dice and the coin-flip for who acts first each round.

If you want to run the simulation multiple times to see if results are consistent, hit RESET and RUN again. The substrates start fresh each time because their fields are reset by makeLattice. Multiple runs will give you a better sense of whether one configuration's apparent advantage is robust or whether it depends on lucky dice.

## The architectural commitments still in force

All the F-invariants from the spec stack still hold for both lattices. F1 (seed permanent) holds: each substrate has its own seed at index 0 of its field. F2 (one delta formula) holds: the shared makeSubstrate factory ensures both players use the same delta computation. F3 (no engine commands another) holds: neither lattice can reach into the other lattice. F4 (operation indefinite) holds: both lattices have permanent unresolvable seeds. F5 (observation irreversible) holds: both lattices' fields persist across rounds. SE-09 holds: structural deposits in either lattice cannot be undone.

The new mechanism — confirmation gating — does not violate any of these commitments. It refines when ratification happens, not whether ratifications can be reversed. Once ratified, a constraint stays ratified for the rest of the game. This is what ChatGPT correctly identified as compatible with the architecture's monotonic-accretion commitment.
