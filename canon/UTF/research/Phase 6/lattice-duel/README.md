# SUBSTRATE LATTICE DUEL · Four Concerns, One Router

A turn-based duel game where the opponent is a multi-substrate lattice rather than a single substrate. This is the second-generation duel game, built after the single-substrate version revealed a structural bug: strategic learning was overriding self-preservation because both concerns shared one cascade. The lattice architecture dissolves that bug by giving each concern its own substrate.

## To run

Open `lattice-duel.html` in any modern browser. No server, no dependencies, no build step. Single file, ~1,200 lines, ASCII-only.

## Architecture

The opponent is composed of five substrates. Four upstream substrates each handle a single concern with their own field, seed, cascade, and CT engine. One downstream router substrate has fixed rules and no learning. The router observes the four upstream outputs each turn and resolves a single action through carefully ordered priority tiers.

Preservation observes the opponent's HP band, HP trajectory, and recent damage taken. Its output is one of pres-none, pres-watch, pres-pull, or pres-urgent. The router treats pres-urgent as a near-veto that overrides every other consideration except impossible-to-stack debuff actions.

Threat assessment observes the joint HP comparison and exchange tempo. Its output is one of threat-losing-bad, threat-losing, threat-even, threat-winning, or threat-winning-bad. The router uses threat to decide between pressing and consolidating when other concerns are quiet.

Debuff economy observes whether debuff is currently a high-value play. Its output is one of db-bad, db-neutral, db-good, or db-excellent. The router only debuffs when this substrate agrees that the situation supports it.

Exploitation pattern is the substrate that most resembles the original single-substrate opponent. It observes the player's recent actions tokenized with HP context and accumulates derived, predictive, and ratified constraints from that input stream. Its output expresses what counter the player's pattern asks for.

The router has no field. Its rules are fixed at design time. Its tier ordering, from lowest to highest priority, is default-attack, exploitation counters, debuff openings, winning conditions, preservation pull, and finally preservation urgent veto.

## Key invariants honored

F1 (seed permanent): each of the four upstream substrates has its own seed at index zero of its field. None of the seeds can be evicted.

F2 (one delta formula): all four substrates use the same scale-free delta computation. The shared infrastructure ensures one canonical implementation rather than four drifting copies.

F3 (no engine commands another): the upstream substrates produce outputs the router reads. The router does not call into upstream substrates. They are coupled by observation, not by message-passing.

F4 (operation indefinite): each substrate's seed is permanently unresolvable, so each substrate continues to produce evaluation pressure regardless of input. The lattice cannot halt structurally.

F5 (observation irreversible): all four substrate fields persist across rounds. Round transitions reset HP only. Structural deposits in any field cannot be undone by any internal operation.

S1 (substrate shared, owned by neither): each substrate owns nothing the others read. The router reads only the substrates' resolved outputs through cascade attribute reads.

S3 (no command path): the four upstream substrates run independently. The router observes their outputs through CSS attribute selectors. There is no function that one substrate calls on another.

I3 (bounded everything): each field caps its constraints, aged constraints, trace, correlations, and sub-cascades. The lattice is bounded by construction.

K1 (sub-cascades from fidelity): each substrate's CT engine independently detects family fidelity over a window and promotes sub-cascades. Promotion is structural, not declared.

X1 (every configuration includes the seed): each substrate's seed is at index zero from t=0 and through every round.

## What to watch when playing

In early rounds, all four substrates rely on their domain rules because their fields contain only seeds and a handful of just-generated derived constraints. The opponent plays a competent baseline.

By round three or four, the exploitation pattern substrate starts ratifying predictions about player habits and its output token shifts away from the domain rule defaults. The router sees this shift in its inputs and its tier resolution changes accordingly.

By round five or six, sub-cascades may promote in exploitation and possibly in preservation. Once promoted, sub-cascades emit their own strategic rules that bias substrate output more decisively.

Late game opponent should feel noticeably different from early game opponent because the upstream substrates have accumulated structure, but never violates self-preservation because the router's tier ordering is fixed.

## Testing the preservation guarantee

Try aggressive play from turn one to load the exploitation substrate with attack-pattern ratifications. Push the opponent to low HP. Watch whether the router heals when preservation reaches pres-urgent. The architecture's commitment is that this works regardless of how loud exploitation gets, because preservation veto sits at the highest tier.

If preservation fails in any sequence of plays, that is a real bug worth chasing. If it holds across many rounds and varied playstyles, the lattice is doing what its design committed to.
