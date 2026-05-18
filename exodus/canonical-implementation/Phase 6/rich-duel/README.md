# RICH SUBSTRATE DUEL · 16 Abilities + Meta-Substrate Coupling

A two-lattice duel where each player has access to 16 distinct abilities and a meta-substrate observes ratification events from both lattices, producing a token that both lattices read as cross-lattice context.

## To run

Open `rich-duel.html` in any modern browser. Single file, ~1,400 lines, no dependencies.

## The 16 abilities

Three damage tools (Attack, Heavy Strike, Execute), three healing tools (Heal, HoT, Drain), two crit buffs (Crit Chance, Crit Damage), two damage mitigation (Evasion, Shield), three stances (Counter, Sustain, Cleanse), and three control tools (Damage-over-Time, Debuff, Blind). Each has its own cooldown profile and effect duration.

## The meta-substrate

A third substrate that does not belong to either player. Its input is the buffer of recent ratification and sub-cascade promotion events from both lattices. Its output is a token that both lattices include in their input streams. The result is that each lattice has a structural sense of what the other has been learning — not by inspecting the other's internals, but by reading a third party's tokenization of those internals.

This creates a feedback loop. A's behavior shapes A's ratifications, which feed the meta-substrate, whose output shapes both A's and B's perception, which shapes future behavior. The architecture's response to this coupling is empirical — convergence behavior is what the simulation reveals.

## What to observe

The meta-substrate's `lastOutput` should evolve from `meta-quiet` toward `meta-mutual-arms-race` or `meta-a-leads` / `meta-b-leads` as ratification activity develops in either lattice. The substrate panel for the meta will show its constraint count, ratification count, and sub-cascade count grow alongside the player lattices.

Watch whether either lattice's behavior visibly changes when meta-substrate output shifts. If the meta token genuinely informs strategy, you should see tier markers in the combat log shift in response to meta output changes. If the meta is more decorative than load-bearing, behavior will be similar regardless of meta state.

## Architectural commitments preserved

- F1 (seed permanent): every substrate including meta has a permanent seed.
- F4 (operation indefinite): no halting structurally possible.
- F5 / SE-09 (operational irreversibility): all substrate fields persist across rounds.
- S1 (substrate shared, owned by neither): meta-substrate is genuinely third-party; neither A nor B "owns" it.
- S3 (no command path): meta only reads ratification events; lattices only read meta's resolved token. No method calls between them.
- I3 (bounded everything): all caps in place.
