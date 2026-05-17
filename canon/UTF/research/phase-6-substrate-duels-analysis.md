# Research: Phase 6 Substrate Duels — Deep Analysis

**Role.** Reference material. This article analyzes the Phase 6
substrate-duel artifacts at
[exodus/canonical-implementation/Phase 6/](../../../exodus/canonical-implementation/Phase 6/)
in service of the UTF specification work. The duels are running
experiments on questions UTF needs to answer about kind vocabulary,
substrate composition, and emergence discipline.

**Date produced.** 2026-05-17

**Method.** Six structural questions posed in advance, answered by
direct grep and read across the six duel variants
(`substrate_duel.html`, `lattice-duel.html`, `lattice-vs-lattice.html`
×2, `rich-duel.html` + four variants `_crossed`, `_swap`,
`_asymettry`, `_melting-pot`), the SE-06 stress test
(`NEW_SPA-specification-stress-test.html`), the research notes
(`RESEARCH_NOTES.md`), and a 365 KB run log (`log.txt`).

**See also.** [canon/UTF/01-foundations.md](../01-foundations.md)
established UTF as WHEN:THEN-shaped rather than KEY:VALUE-shaped,
enumerating eight candidate kinds. This article surfaces empirical
evidence that the kind vocabulary should be smaller and that
"more kinds" should be handled by lattice composition rather than
vocabulary growth. The article does not modify the foundations
document; it preserves the analysis for use in a deliberate
foundations revision.

**Discipline note.** The article cites code locations and quotes
comments. Where a structural recognition is named, it is derived
from the cited code, not imported. Every cognition-style or
psychology-style metaphor that appeared in the analyzing
conversation has been stripped here in favor of the underlying
mechanism.

-----

## 1. The variant landscape

Phase 6 contains seven artifacts at three escalating levels:

| Artifact | Level | What it tests |
|---|---|---|
| `substrate_duel.html` | Baseline (single substrate) | One field, all concerns share scoring |
| `lattice-duel/lattice-duel.html` | Lattice (multi-substrate) | Four concerns each get their own field; fixed-rule router resolves the conflict |
| `lattice-vs-lattice.html` (×2 variants) | Two lattices | Fast-heat-up vs. slow-burn parameterizations of the same architecture |
| `rich-duel/rich-duel.html` | Two lattices + meta-substrate | Third substrate observes ratification events from both lattices |
| `rich-duel_swap.html` | + asymmetric perturbation | Mid-round HP swap when B crosses 100 |
| `rich-duel_asymettry.html` | + asymmetric start | B starts wounded |
| `rich-duel _crossed.html` | + CROSSED coordination | Predator-prey channel pairing |
| `rich-duel-melting-pot.html` | All of the above + invention | Substrates invent new abilities at ratification |
| `NEW_SPA-specification-stress-test.html` | Different track | SE-06 substrate with real browser CSS cascade as rendering substrate |

Each variant is the previous one plus exactly one structural
perturbation. The variants compose into a structural argument by
construction.

-----

## 2. Six questions, six findings

### Q1: What changed between `substrate_duel` and `lattice-duel`?

The single-substrate baseline had to **hand-engineer HP guards into
strategic-rule emission** to prevent learned constraints from
overriding self-preservation.

[substrate_duel.html:381-459](../../../exodus/canonical-implementation/Phase 6/substrate_duel.html)
contains the relevant code. Comment at line 384:

> "Strategic rules are constrained by HP guards so they cannot
> override domain self-preservation. Non-heal counters only fire
> in non-emergency states (shp = full or ok). Heal counters are
> exempt because they ALIGN with preservation rather than override
> it."

The mechanism is the `emitStrategicRule` function which manually
appends `[data-shp="full"]` and `[data-shp="ok"]` selectors to
non-heal counters:

```javascript
function emitStrategicRule(extraSelector, action, score) {
  let sels;
  if (action === 'hl') {
    sels = ['#opp-probe' + extraSelector];
  } else {
    sels = [
      '#opp-probe' + extraSelector + '[data-shp="full"]',
      '#opp-probe' + extraSelector + '[data-shp="ok"]'
    ];
  }
  Field.ctRules.push({
    selector: sels.join(', '),
    decls: ['--action: ' + Guards.cssEscapeString(action), '--score: ' + score]
  });
}
```

The architecture had no structural firewall between concerns. The
engineer inserted one by hand.

The lattice doesn't do this. Each concern has its own field; nothing
one substrate learns can structurally override another substrate's
output. The fix wasn't adding new mechanism — it was **removing the
need for hand-engineered firewalls** by giving each concern its own
substrate.

**Structural finding.** The substrate architecture's preferred
composition pattern is *multiple uniform substrates with per-substrate
intake configuration*, not *one rich-vocabulary substrate handling
everything*. Kind-vocabulary complexity does not need to live in the
spec; concern-separation complexity lives in the lattice.

### Q2: How do crossed channels actually wire?

In `rich-duel-melting-pot.html:817-840`, the CROSSED architecture
pairs predator-prey rather than mirror:

```
pres-A   ↔  exploit-B   (defensive-commitment ↔ offensive-opportunity)
exploit-A ↔  pres-B
threat-A ↔  abecon-B    (strategic-balance ↔ tactical-readiness)
abecon-A ↔  threat-B
```

Comment at line 825:

> "The factored same-concern run produced lock because both sides
> watched mirror-image state and converged on mutual-survival Nash
> equilibria. Cross-concern pairing breaks that symmetry: each
> substrate now watches the substrate that would naturally counter
> or complement its own job, producing predator-prey-style dynamics
> rather than mirror convergence."

Channels are **stateless, origin-tagged ('opp-' prefix), external to
substrates.** Implementation at line 833:

```javascript
function crossToken(side, substrateName) {
  const opp = side === 'a' ? 'b' : 'a';
  const oppLat = opp === 'a' ? game.latticeA : game.latticeB;
  if (!oppLat || !oppLat[substrateName]) return null;
  const out = oppLat[substrateName].field.lastOutput;
  if (!out) return null;
  return 'opp-' + out;
}
```

The substrate's `tokensFn` includes the cross-token in its input
stream — it doesn't know it came from "another substrate," it just
sees an extra token.

**Structural finding.** Cross-substrate communication is *just tokens
in an input stream*. No new mechanism. The substrate does not have
a "channel" primitive; channels are *what happens when substrate A's
output becomes substrate B's input via a stateless origin-tagged
wiring*.

### Q3: What is the "invention" mechanism?

In `rich-duel-melting-pot.html:198-396`, substrates invent new
abilities at ratification time.

Comment at line 207:

> "Each ability is a point in a parameter space. Seed abilities are
> pre-placed vectors; substrates may invent new vectors at
> ratification time. Invented abilities enter the inventing
> primitive's per-side inventory and become candidates for
> selection on subsequent turns. The space is closed under noise
> perturbation so any sampled point is a valid ability."

The mechanism (`inventAbility` at line 352) samples a new ability
vector from gaussian noise centered on a centroid keyed by the
primitive's current output. Centroids are defined per output token:

```javascript
const PRIMITIVE_CENTROIDS = {
  'pres-none':   { target: 'self', damage: 5,  ... effect: 'heal',   ... },
  'pres-urgent': { target: 'self', damage: 30, ... effect: 'shield', ... },
  'threat-winning-bad': { target: 'opp', damage: 35, ... effect: 'none', ... },
  'exploit-preempt-attack': { target: 'opp', damage: 0, ... effect: 'debuff', ... },
  // 16 total
};
```

Sampling can flip target (10% probability) or mutate effect (20%
probability). Comment at line 229:

> "Damage is resolved through the same pipeline regardless of
> whether the vector was a seed or an invention. There is no
> special handling for invented abilities — they share the
> substrate's expressive surface."

The `log.txt` run shows this operating: 6,346 turns produced ~30-60
inventions per side per round, sampled from the centroid space.

**Structural finding.** This is the *operational form of emergence*.
New structural units are produced by the substrate during operation,
enter the substrate's vocabulary, and compete on equal footing with
seed-time vocabulary. The seed set is small (16 vectors); the
emergent set is open-ended (any sample from the parameter space);
both share the same processing pipeline.

This validates a primitives + emergence framing **operationally**, in
already-running code. The pattern: closed primitive set + open
emergent layer + uniform processing pipeline across both.

### Q4: How does the SWAP mechanism work?

In `rich-duel_swap.html:1325-1335`:

```javascript
// ASYMMETRIC SWAP MECHANIC
// When B's HP first reaches or exceeds 100 in this round, swap HP values
// between A and B (only the hp number moves; effects and cooldowns stay
// with their owner). Once per round.
if (!this.swappedThisRound && this.b.hp >= 100) {
  const oldA = this.a.hp;
  this.a.hp = this.b.hp;
  this.b.hp = oldA;
```

The substrate's observable state changes discontinuously mid-game.
HP swaps but effects/cooldowns don't. The substrate's intake
adapters continue reading game state the same way; the *values*
they read change abruptly.

**Structural finding.** Substrate identity is **not** identical to
substrate state. A substrate is its position in the lattice + its
accumulated structural history + its current intake configuration.
State can be perturbed without changing identity. The lattice
copes because identity persists through state perturbation.

### Q5: What does NEW_SPA stress-test do that the duels don't?

`NEW_SPA-specification-stress-test.html` is not a duel. It is the
SE-06 substrate running with the **actual browser CSS cascade as the
rendering substrate**.

Header comment:

> "A single-file demonstration of the constraint substrate where the
> rendering substrate (per SE-06) is the actual CSS cascade, not a
> CPU oracle. The constraint compiler emits real CSS rules;
> resolution happens via setAttribute + getComputedStyle on a probe
> DOM element. The execution substrate (CT engine) is JS. They share
> the field. Delta is the coupling."

Algorithms 02, 04, 05, 09, 10, 13, 14, 22 + SE-01, SE-02 are all live
in this single artifact. The cascade is operationally the kernel-
equivalent — not via three independent oracles agreeing, but via
the substrate *actually using* the browser's selector engine as
its resolver.

**Structural finding.** UTF's "stylesheet form" encoding is not
theoretical. NEW_SPA already shows it works — UTF-shaped nodes
compile to real CSS rules, the cascade resolves them, setAttribute
+ getComputedStyle reads them out. The stylesheet encoding is the
architecture's primary operational form when hosted on a browser.

### Q6: How does invention interact with promotion?

`inventFromContext` is called from each primitive's `onRatify` AND
`onPromote` in `rich-duel-melting-pot.html:922-931`:

```javascript
onRatify: (c, F) => {
  F.ctRules.push({ ... });
  pushMetaEvent(side, 'rat', 'pres', c);
  inventFromContext(side + '-pres', F.lastOutput);
},
onPromote: (sc, idMap, F) => {
  F.ctRules.push({ ... });
  pushMetaEvent(side, 'promote', 'pres', { ... });
  inventFromContext(side + '-pres', 'pres-urgent');
}
```

Both ratification (predictive → ratified transition) and sub-cascade
promotion (family → named structure) trigger invention.

**Structural finding.** The substrate's vocabulary grows at *two
timescales*: ratification grows it fast (per-turn evidence of a
confirmed pattern); promotion grows it slow (window-based fidelity
confirmed structure). Same mechanism (`inventAbility`), different
triggers. Every kind-transition event is also an opportunity for the
substrate to invent new vocabulary into its action space.

-----

## 3. The structural conclusion

Six findings converge on one structural recognition: **the substrate's
vocabulary is layered, and only the bottom layer is closed at spec
time.**

| Layer | Closure | What it contains | Source of growth |
|---|---|---|---|
| **Primitives** (UTF kind vocabulary) | Closed at spec time | seed, derived, predictive, ratified, meta, compound | Spec-defined |
| **Substrate concerns** (what a substrate is *for*) | Open at lattice-design time | preservation, threat, exploitation, debuff-economy, meta-observer, ... | Lattice author defines per substrate via intake config |
| **Vocabulary** (what tokens enter the substrate) | Open during operation | game state tokens, opp-cross tokens, prior-output tokens, ... | Intake adapter per substrate |
| **Action space** (what the substrate can produce) | Open during operation | seed abilities + invented abilities sampled from centroids | Invention triggered at ratification + promotion |

UTF only specifies the primitive layer. Everything above grows
through **the same uniform substrate factory** with **different
intake configurations**. The intake configuration is the substrate's
identity — what its tokens are, what its centroids are, what
cross-channels it reads from. The kernel-equivalent (`makeSubstrate`)
is universal; the per-substrate configuration is what makes one
substrate different from another.

Where the 2026-05-15 foundations document enumerated 8 kinds, Phase
6 evidence indicates:

- The right primitive count is closer to **5-6**, matching what
  every lattice substrate actually uses.
- "More kinds" is structurally answered by **more substrates in a
  lattice**, not **more kinds in one substrate**.
- Compounds (Phase 4b) are a single-substrate optimization that
  the lattice approach makes unnecessary in many cases.
- "Events" are tokens on input streams, not a new UTF primitive.
- Emergence happens through *invention at kind-transition events*,
  not through spec-time enumeration.

-----

## 4. What this article does not commit to

- Does not modify `canon/UTF/01-foundations.md`. Foundations
  revision is a deliberate decision that should follow this article,
  not be folded into it.
- Does not claim the substrate exhibits cognition or paradox or
  any phenomenological property. The duels are running mechanisms.
  The mechanisms have a structural shape worth recording. Whether
  that shape parallels cognition is a separate analogical
  observation labeled in `canon/DEFINITION.md §6`.
- Does not commit to the primitives + emergence vocabulary as
  UTF's final form. The empirical evidence supports it. The
  decision to commit is the author's.
- Does not foreclose discovery. Future Phase 6 work, or new
  artifacts in canonical-implementation/Phase 6/, may reveal
  structural recognitions that supersede or refine the findings
  recorded here.

-----

## 5. Files cited

| Path | Role |
|---|---|
| `exodus/canonical-implementation/Phase 6/substrate_duel.html` | Single-substrate baseline; the bug |
| `exodus/canonical-implementation/Phase 6/lattice-duel/lattice-duel.html` | Lattice; the fix |
| `exodus/canonical-implementation/Phase 6/lattice-vs-lattice.html` | Two lattices, parameter comparison |
| `exodus/canonical-implementation/Phase 6/rich-duel/rich-duel.html` | Lattices + meta-substrate |
| `exodus/canonical-implementation/Phase 6/rich-duel _crossed.html` | + CROSSED coordination |
| `exodus/canonical-implementation/Phase 6/rich-duel_swap.html` | + SWAP perturbation |
| `exodus/canonical-implementation/Phase 6/rich-duel_asymettry.html` | + asymmetric start |
| `exodus/canonical-implementation/Phase 6/rich-duel-melting-pot.html` | All variants + invention |
| `exodus/canonical-implementation/Phase 6/NEW_SPA-specification-stress-test.html` | SE-06 substrate with real CSS cascade |
| `exodus/canonical-implementation/Phase 6/RESEARCH_NOTES.md` | Substrate-instantiation research framing |
| `exodus/canonical-implementation/Phase 6/log.txt` | 6,346-turn run capture (CROSSED, SYMMETRIC) |

-----

## 6. Live status

| Date (yyyy-mm-dd) | Action |
|---|---|
| 2026-05-17 | Article created. Six structural findings from question-grep analysis of Phase 6 substrate duels. Findings support primitives + emergence framing for UTF, with lattice composition as the answer to "more kinds." Foundations revision deferred to deliberate decision-making via the question series at `canon/UTF/utf-decision-questions.md`. |

Updates appended when the foundations decision is made, or when
new Phase 6 artifacts reveal structural recognitions that supersede
or refine the findings here.
