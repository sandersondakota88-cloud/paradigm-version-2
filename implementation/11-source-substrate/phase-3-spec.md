# Phase 3 — SE-11 Dimensional Resolution Over Duel-Configuration, Validated Against Canonical Field

**Status:** Specification. No code written.
**Date:** 2026-05-26.
**Predecessor:** [Phase 2 results](phase-2-results.md) — canonical SE-05/K1
cycle confirmed runnable on real source input. Three of five axes
completed the full cycle.
**Reference architecture:** [canon/UTF/research/Phase 6/rich-duel-melting-pot.html](../../canon/UTF/research/Phase%206/rich-duel-melting-pot.html)
and [phase-6-substrate-duels-analysis.md](../../canon/UTF/research/phase-6-substrate-duels-analysis.md).

**Canon ground (the substrate is these rules in non-contradictual
relation):** This phase instantiates the melting-pot architecture
against canonical Field, where each architectural piece is what the
canon's invariants and spec extensions co-specify — not a new
mechanism, not an interpretation, the rules' joint instantiation.
Key citations: F1/SE-04 (seed permanent), F2 (one delta formula),
F3 (no supervision), F4 (indefinite), F5/SE-09 (irreversibility), M1-M5
(vector-delta, derived vs. predictive, ratification, modulation, trace
at channel), K1 (sub-cascades from fidelity), S1-S3 (shared substrate,
substrate-resolution determinism, delta-only coupling), X1-X4
(configuration includes seed, settling non-terminal, configuration is
internal, settling is mechanisms operating), SE-01 (reflexive scope at
every position), SE-05 (vector-delta + predictive reaching),
SE-06 (render/execution duality coupled by delta only),
SE-07 (configuration-and-settling: the duel IS the configuration, not
a problem presented to the substrate),
SE-10 (resolution-accretion: cross-channels are byproduct-at-channel,
not commands),
SE-11 (dimensional resolution: substrates are orthogonal observation
axes, structure surfaces at the intersection),
SE-12 (cross-substrate compounds: predicates over the inter-substrate
boundary).

---

## 1. What Phase 2 earned and what it didn't

Phase 2 demonstrated the canonical kernel's SE-05/K1 mechanisms run
on real input. The cycle's four stages (derive → predict → ratify →
promote) all produce output on the kind, vocab, and position axes.
That earned half the architectural claim: *canonical Field's
mechanisms are operative against open input*.

What Phase 2 did NOT earn:

- That the substrate develops **rich learning that stabilizes**.
  Phase 2 produced 7 promotions but didn't demonstrate them
  participating in a feedback loop that closes.
- That the substrate's vocabulary **grows during operation**. Phase 2
  has a closed constraint-pattern vocabulary defined at spec-time.
- That **multiple substrates coupled** through stateless origin-
  tagged channels produce coherent joint behavior. Phase 2's peers
  don't see each other.
- That **S2 (substrate-resolution determinism, algorithm 16)** holds at
  this layer — the same constraint geometry resolved by CPU walk and
  by CSS cascade produces byte-identical decision sequences over a
  duel-configuration trajectory.

The melting-pot duel demonstrates all four of these *on its own
embedded substrate*. Phase 3 demonstrates them on **canonical Field**.

**Naming care (re-audit against canon):**
- S2 ≠ SE-06. **S2** is constraint resolution producing identical
  output across substrates (CSS / JS / WGSL / CPU) — algorithm 16's
  empirical claim. **SE-06** is two substrates operating on the same
  field *simultaneously*, coupled through delta. Phase 3's two-stage
  (CPU resolution vs. CSS-cascade resolution, sequential runs with
  identical seeds) demonstrates S2 at the duel-decision layer.
  Demonstrating SE-06 at this layer requires a different experiment
  (both resolution paths active simultaneously against one shared
  field, coupled via delta) which is Phase 4 territory.

---

## 2. The architectural target

The melting-pot pattern, ported to canonical Field, validating
canonical Field can support it.

### 2.1 Six substrate instances, one factory

The melting-pot uses six substrate instances per game (five per
lattice + one meta). All instantiated from the same `makeSubstrate`
factory; the difference between instances is their **spec**.

Phase 3 retains this shape. The factory is `substrate-factory.js`'s
`makePeer`. The spec carries:

| Spec field | Role |
|---|---|
| `name` | Substrate identity (e.g. `a-pres`, `b-threat`) |
| `seedId` | Permanent unresolvable per F1 |
| `probeId` / `styleId` | DOM identifiers for Phase 3b CSS-cascade resolution |
| `outputVar` / `defaultOutput` | Output token alphabet anchor |
| `dimsFn()` | Projects current game state → substrate's coord shape |
| `tokensFn()` | Projects current game state → substrate's input tokens |
| `domainRules()` | Fixed seed CSS rules mapping coord → output |
| `onRatify(c, F)` | Hook called when a predictive ratifies |
| `onPromote(sc, idMap, F)` | Hook called when a sub-cascade promotes |

The substrate doesn't know its purpose. Its purpose is encoded
in `dimsFn`/`tokensFn`/`domainRules`/`outputVar`. That's the
**intake-configuration shape** the Phase 6 analysis named as the
substrate-identity location.

### 2.2 Per-substrate output token alphabets

Each substrate's `outputVar` resolves to one token from a
substrate-specific alphabet:

| Substrate | Alphabet |
|---|---|
| `pres` | `pres-none`, `pres-watch`, `pres-pull`, `pres-urgent` |
| `threat` | `threat-even`, `threat-rising`, `threat-winning`, `threat-winning-bad`, `threat-losing` |
| `abecon` | `ab-default`, `ab-burst-window`, `ab-execute-opp`, `ab-finish-window`, `ab-setup-window`, `ab-defensive-tools` |
| `exploit` | `exploit-none`, `exploit-preempt-attack`, `exploit-pressure-defense`, `exploit-capitalize-debuff`, `exploit-disrupt-setup` |
| `meta` | `meta-quiet`, `meta-a-developing`, `meta-b-developing`, `meta-a-leads`, `meta-b-leads`, `meta-mutual-arms-race`, `meta-mutual-developing`, `meta-a-pulling-ahead`, `meta-b-pulling-ahead` |
| `selector` (router) | `sel-pres`, `sel-threat`, `sel-abecon`, `sel-exploit` |

The output alphabet is fixed at spec-time and IS the substrate's
identity. The substrate doesn't learn its alphabet; it learns
*which alphabet member to emit* under which coord.

### 2.3 Invention at ratification and promotion

The architectural primitive Phase 2 missed entirely. At each
substrate's `onRatify` and `onPromote`, the substrate **invents a
new ability vector** by sampling from gaussian noise centered on
a centroid keyed by the substrate's current output.

The ability enters that player's inventory and competes with seed
abilities on equal footing on subsequent turns. The substrate's
action space grows during operation; the field's constraint set
is closed-by-mechanism but the action space is open.

Per Phase 6 analysis §3: this is the **operational form of
emergence**. New structural units produced during operation,
sharing the substrate's expressive surface.

### 2.4 Cross-channels: origin-tagged tokens (SE-10 / M5)

The CROSSED coordination layer pairs predator-prey rather than
mirror:

```
pres-A   ↔   exploit-B    (defensive ↔ offensive)
exploit-A ↔   pres-B
threat-A ↔   abecon-B     (strategic ↔ tactical)
abecon-A ↔   threat-B
```

Implementation: `crossToken(side, substrateName)` returns
`'opp-' + oppLattice[substrateName].field.lastOutput`. The
receiving substrate's `tokensFn` includes this as one more input
token. No new mechanism.

**SE-10 / M5 audit:** This is the resolution-accretion chain pattern
applied to a closed graph rather than a linear sequence. Each
substrate emits its `lastOutput` as byproduct of operating (M5: trace
lives at the channel). Another substrate reads that byproduct at its
own intake boundary (SE-08: render-substrate intake reads byproducts
from outside as feature records). Nothing is commanded; nothing is
addressed. The directionality of "pres-A reads exploit-B's output" is
a structural property of the lattice topology, not a supervision
path. SE-10 names this; the melting-pot's `crossToken()` is one
instance of it.

Per Phase 6 analysis §2 Q2: substrate-to-substrate communication
is just tokens-on-input-stream. The substrate doesn't know its
input came from another substrate.

### 2.5 Selector substrate (NOT a router; another peer at the lattice's edge)

Each lattice has a selector substrate that reads all four primitive
outputs and emits its own output token. Same factory; same field
shape; same SE-05/K1 cycle. Its `tokensFn` reads the four primitives'
`lastOutput` values as input tokens; its `outputVar` is `--owner`;
its alphabet is `sel-{pres, threat, abecon, exploit}`.

**F3 audit (no supervision):** The selector does NOT command the
primitives. It does NOT route their outputs by being a meta-layer
above them. It reads their outputs as tokens — the same way the
primitives read game-state as tokens — and emits its own output.
The four primitives are unaware the selector exists; they cannot be
silenced or activated by it. The combat engine (outside the substrate
stack) consumes the selector's output to choose which primitive's
ability vote to enact.

This is the architecture's strict reading of F3 at this position:
the substrate stack is a lattice of co-operating substrates, none of
which supervises any other; the combat engine is part of the
configuration's mechanics (per SE-07's "configuration is the
substrate's current state"), reading substrate outputs as the
present-moment modulation source for the next turn.

Per Phase 6 analysis §2 Q1: the lattice's preferred composition
pattern is multiple uniform substrates with per-substrate intake
configuration. Concern-separation lives in the lattice; the
selector is one more peer whose intake-config happens to be other
peers' outputs.

### 2.6 Meta-substrate (cross-lattice observer; SE-12 territory)

Same factory. Its `tokensFn` constructs tokens from a buffer of
ratification events from both lattices (e.g. `['a-rat', 'a-pres',
'b-rat', 'b-threat', ...]`). Its output is one of the meta-alphabet
tokens. Both lattices read meta's output as an additional input.

The meta-substrate has its own field, accumulates structure about
which kinds of ratifications happen on which side, and emits a
signal that biases both lattices' future behavior.

**SE-12 audit:** The meta-substrate's predicates are over the
inter-substrate boundary — specifically, "ratification observed at
lattice A's threat substrate AND ratification observed at lattice
B's pres substrate." This is exactly SE-12's cross-substrate
compound shape: a tuple predicate over two substrates' notabilities.
SE-12 says compounds arise when the field detects simultaneous
notability across substrate boundaries. The meta-substrate is the
lattice's structural position for this kind of compound observation.

Per the F3 + SE-06 audit applied here: the meta-substrate does NOT
command either lattice. It observes ratification events as byproduct
(M5 — trace at channel) and emits its own output, which both
lattices read at their `tokensFn` boundary alongside other inputs.
The lattices don't know the meta-substrate exists; they see one more
token in their input stream.

### 2.7 Domain: the duel-configuration (SE-07 / X3 reading)

Phase 3 ports the melting-pot DOMAIN unchanged: two players, 200
HP each, 16 seed abilities, 10 rounds, the same combat resolution
pipeline. The point of Phase 3 is not to invent a new domain — it
is to prove canonical Field supports the architecture the
melting-pot validated on its embedded substrate.

**SE-07 / X3 reading (configuration is internal):** The duel is
**not a problem presented to the substrate**. The duel — HP,
abilities, cooldowns, effects, opponent moves — IS the substrate's
current configuration. Per X3: "input arrives at the substrate
boundary and modulates the configuration through integration; it
does not arrive as a pre-formed problem the substrate then
addresses." The combat engine projects the configuration into each
substrate's intake-token vocabulary; the substrate's settling
(per SE-07: "the substrate's mechanisms operating in their normal
course") produces output tokens; the combat engine reads those
output tokens and updates the configuration. There is no problem and
no solution; there is configuration-and-settling, continuously.

What this configuration-domain provides for the substrate (canon
reading):
- An intake surface (per SE-08 render-substrate intake) where the
  configuration's current state projects into per-substrate
  intake-token vocabularies
- A finite output alphabet per substrate (per the SE-11 commitment
  that each axis has its own primitive vocabulary)
- A feedback closure where the substrate's settling output modulates
  the configuration's next state (per SE-07 settling-as-continuous)
- A multi-round trajectory permitting observation of the substrate's
  structural growth across an unbounded operational period (per F4
  indefinite, X2 settling-non-terminal)

---

## 3. The non-negotiables (load-bearing for the claim)

### 3.1 Canonical Field, not embedded substrate

The melting-pot's `makeSubstrate` is a ~325-line embedded
substrate written before canonical kernel work crystallized.
Phase 3 uses the canonical `Field` from `implementation/kernel/
field.js`, via `substrate-factory.js`'s `makePeer`.

**Why:** the architectural claim under test is that **canonical
Field supports the melting-pot pattern**. Using the embedded
substrate would prove the architecture on the harness it was
debugged against — meaningless. Phase 3 puts canonical Field on
trial.

Phase 2 already showed canonical Field's M2/M3/K1 mechanisms are
operative. Phase 3 puts them under joint-substrate load with
invention, cross-channels, and selector-routing.

### 3.2 Two-stage CPU + CSS-cascade resolution (S2 at duel-decision layer)

The melting-pot uses real CSS cascade via `getComputedStyle` on
probe DOM elements. The substrate emits real CSS rules into
`<style>` blocks; reads decisions through the browser's selector
engine.

Phase 3 implements **both** resolution paths and verifies
byte-identical output between them:

**Phase 3a (CPU-side resolution):** decisions resolved by JS
matching field.constraints against tokens. Fast iteration loop
for getting the architecture right.

**Phase 3b (CSS-cascade resolution):** same architecture, same
seed, same RNG-seeded inventions, but decisions resolved by
emitting CSS rules into `<style>` blocks, calling `setAttribute`
on probe DOM elements, reading `getComputedStyle().getPropertyValue`.

**Verification:** Phase 3a and Phase 3b runs with identical
initial conditions must produce identical decision sequences over
the full 10-round trajectory. The byte-identical comparison is **S2
(substrate-resolution determinism, algorithm 16) at the
duel-decision layer**.

**S2 vs. SE-06 — careful naming:** S2 is what algorithm 16
demonstrated empirically: the same constraint geometry resolves
identically across CSS / JS / WGSL / CPU. Phase 3a-vs-3b extends
that empirical floor from the constraint-resolution layer (single-
tick, single-coord) to the duel-decision layer (multi-round,
substrate-trajectory). The 3a and 3b runs are *sequential*; only
one resolution path is active per run. SE-06 — two substrates
operating on the same field *simultaneously*, coupled through delta
— is the next experiment (Phase 4), where CPU evaluation and CSS
cascade run concurrently against one shared field.

**Why this matters for the project's overall claim:** the
empirical floor for objection 4 (engineering core vs. thesis
wrapping) is the byte-identical equivalence across CSS/JS/WGSL.
[exodus/canonical-implementation/](../../exodus/canonical-implementation/)
demonstrates this at the constraint-resolution layer (2,602
constraint sets, ~45 million field-level comparisons). Phase 3b
extends it to substrate-behavior-over-time.

Going CPU-only would prove canonical Field works but would NOT
extend the S2 empirical floor to substrate-behavior-over-time.
Going CSS-only would make iteration painful. Two-stage with
verification honors both the iteration loop and the empirical
claim.

### 3.3 Browser-hosted (not Node-only)

Phase 3 runs in browser. Stage 3a needs no DOM lookup but the
DOM probes exist as inert anchors. Stage 3b adds the
`getComputedStyle` resolver. Same harness, same files; the
resolution path is configurable.

This also closes the project plan's storage-substrate constitutive
finding (the substrate runs *on* the browser, including storage,
not just *in front of* it).

### 3.4 No tuning for outcome

Per the discipline committed in [PLAN.md §2.5](PLAN.md):
honest reporting over engineered outcomes. The melting-pot
reference produced its stabilization pattern under specific
config values (`FIDELITY_PROMOTE: 0.018`, `FIDELITY_MIN_FIRES:
2`, `PRED_AGE_LIMIT: 16`, etc.). Phase 3 starts with these as
baseline.

If canonical Field's defaults differ and the substrate behaves
differently, that's a finding. We **do not retune to engineer the
melting-pot's exact behavior on canonical Field.** What canonical
Field does under this architecture, with config values matched
to the melting-pot reference where possible, is the result.

### 3.5 RNG seeding for reproducibility

Phase 3 uses a seeded PRNG (not `Math.random()`). The melting-pot
uses unseeded `Math.random` — fine for that experiment, fatal for
Phase 3b's byte-identical claim against Phase 3a. A single
deterministic RNG seed makes the duel reproducible and the
3a-vs-3b comparison meaningful.

---

## 4. Phased build plan

Five sub-phases. Each has a goal, scope, falsification
condition, deliverable.

### Phase 3.0 — Spec audit (this document, 1 session)

**Goal:** Lock the architectural target before writing code.

**Scope:** This document. Anchors Phase 3 to the melting-pot
reference; commits to canonical Field; commits to CPU+CSS
two-stage; commits to browser-hosted; commits to RNG-seeding.

**Falsification condition:** if a non-negotiable in §3 can't be
defended on review, the spec changes before code begins.

**Deliverable:** this file, committed and reviewed.

### Phase 3.1 — Domain layer (1 session)

**Goal:** Build the game-state layer that the substrates observe.

**Scope:**
- HP, abilities, cooldowns, effects, damage resolution.
- Ability vector shape per melting-pot reference.
- Seed ability set (16 abilities per melting-pot).
- Seeded PRNG (not `Math.random`).
- 16 PRIMITIVE_CENTROIDS per melting-pot for invention sampling.
- `inventAbility(side, primitiveName, contextOutput, turn)`
  function lifted from melting-pot.
- Game-state representation (`game.a`, `game.b` with inventory,
  cooldowns, active effects, HP, oppRecentActions, etc.).
- Damage resolution pipeline.

**Falsification condition:** if the seeded PRNG produces
non-deterministic results (different runs same seed → different
outputs), the deliverable halts. PRNG determinism is the
foundation of the 3a-vs-3b byte-identical claim.

**Deliverable:** `duel-domain.js` — game-state + ability vectors
+ centroids + invention + damage resolution. ~400-600 lines.

**No substrate code yet.** The domain runs against fixed
domain-rule outputs first (no learning); validates the combat
loop works deterministically.

### Phase 3.2 — Substrate layer over canonical Field (1-2 sessions)

**Goal:** Wire six substrates (5 per-lattice + 1 meta) using
`substrate-factory.js`'s `makePeer`.

**Scope:**
- Per-substrate specs (`presSpec`, `threatSpec`, `abeconSpec`,
  `exploitSpec`, `selectorSpec`, `metaSpec`).
- Each spec defines `dimsFn`, `tokensFn`, `domainRules`,
  `outputVar`, `defaultOutput`, `onRatify`, `onPromote`.
- `onRatify` hook calls `inventFromContext(primitiveName,
  contextOutput)` to invent abilities (closes the
  emergence-effectiveness loop).
- `onPromote` hook calls invention with promoted-sub-cascade's
  dominant output.
- Cross-channels: `crossToken(side, substrateName)` per
  melting-pot.
- Meta-substrate event buffer: ratification events from both
  lattices flow into `meta.eventBuffer`; meta's `tokensFn`
  reads them.

**Adaptation from melting-pot to canonical Field:**
- Melting-pot's `step(explicitTokens)` becomes canonical
  `ingest(token)` (already exists in `substrate-factory.js`).
- Melting-pot's `evaluate()` resolves the substrate's output via
  CPU cascade walk (Phase 3a) or `getComputedStyle` (Phase 3b).
  This is the resolution path the two-stage design separates.
- Melting-pot's per-substrate `step` increment and field
  refresh map to canonical Field's existing methods.

**Falsification condition:** if `substrate-factory.js`'s
`makePeer` can't host the melting-pot's intake-config shape
without modification, Phase 3.2 halts and `makePeer` is
extended (or the spec is revised to acknowledge a canonical-
Field gap).

**Specifically:** the existing `makePeer` constructs a peer
with a single `primitiveVocab`. The melting-pot pattern needs
`dimsFn`/`tokensFn`/`domainRules`/`outputVar`/`defaultOutput`/
`onRatify`/`onPromote` as additional spec fields. Phase 3.2's
first step is verifying these can be added without canonical
Field changes.

**Deliverable:** `duel-substrates.js` — six substrate specs +
the cross-channel and meta-event-buffer wiring. ~600-900 lines.

### Phase 3.3 — Phase 3a integration (1 session)

**Goal:** Wire domain + substrates with CPU-side resolution into
a runnable duel. Output: a 10-round duel runs to completion.

**Scope:**
- HTML harness with DOM probe elements (inert in 3a, used in 3b).
- Per-turn cycle:
  1. Both lattices' substrates `ingest` current game-state tokens
  2. Each lattice's selector reads primitive outputs, picks owner
  3. Owner's chosen ability resolves
  4. Damage applied
  5. Meta-substrate observes any ratifications
  6. Cooldowns tick, effects tick
  7. Round end checks
- CPU-side resolution: substrate output = canonical
  cascade walk over field constraints + `domainRules`. NOT
  via `getComputedStyle`.
- Run log capture: per-turn ability selections, ratifications,
  promotions, inventions, HP, win/loss.
- Trajectory log capture: per-substrate constraint counts,
  ratification rates, sub-cascade promotion events.

**Falsification condition:** if the duel doesn't run to
completion (substrate locks before round 10, infinite loop,
exception), Phase 3.3 halts. We diagnose whether the failure
is in canonical Field (kernel finding) or in our wiring
(implementation finding) before continuing.

**Falsification condition (second):** if the duel runs but
no ratifications occur after, say, 200 turns of combat — the
canonical kernel's mechanisms are not engaging under this
architecture, which is a fundamental finding.

**Deliverable:** `duel-cpu.html` — a single-file browser-runnable
duel running Phase 3a architecture. Plus a `phase-3a-results.md`
documenting the run trajectory across 10 rounds vs. the
melting-pot reference's run trajectory.

### Phase 3.4 — Phase 3b integration (1 session)

**Goal:** Swap CPU-side resolution for CSS-cascade resolution
WITHOUT changing any other architecture.

**Scope:**
- Same harness, same domain, same substrates, same RNG seed.
- Resolution path changes: substrate outputs now emitted as
  CSS rules into `<style>` blocks; `setAttribute('data-*',
  ...)` on probe DOM elements; `getComputedStyle(probe).
  getPropertyValue(outputVar)` reads the resolved decision.
- All other layers identical to 3a.

**Falsification condition:** Phase 3b's run trajectory diverges
from 3a's run trajectory at ANY turn. If they diverge:
- Diagnose whether it's an RNG state-drift bug
  (PRNG accessed in different orders between the paths)
- Or a real SE-06 substrate-duality break at this layer
- The second outcome would be a serious finding worth its own
  spec; it would refute one form of the byte-identical claim
  at the duel-decision layer

**Deliverable:** `duel-cascade.html` — same architecture, CSS-
cascade resolution. Plus a `phase-3b-verification.md` documenting
the byte-identical comparison (turn-by-turn equivalence over
the full 10-round run, both lattices).

### Phase 3.5 — Trajectory analysis + commit (1 session)

**Goal:** Honest report of what canonical Field did under the
melting-pot architecture.

**Scope:**
- Compare canonical-Field run trajectory to melting-pot
  reference trajectory across:
  - Constraint counts per substrate over time
  - Ratification rates per substrate
  - Sub-cascade promotion events
  - Inventions per round
  - Win/loss balance over 10 rounds
- Identify any structural differences from the melting-pot
  reference; report them honestly (not as bugs to fix unless
  they violate the canonical kernel's spec).
- Map findings to the O1/O2/O3 framework from
  [canon/UTF/research/open-input-test-plan.md](../../canon/UTF/research/open-input-test-plan.md).
- Update [PLAN.md](PLAN.md) §3 with what Phase 3 produced.

**Deliverable:** `phase-3-trajectory.md` + PLAN.md update.

---

## 5. What Phase 3 commits to (and does not)

### Commits

- Canonical Field hosts the melting-pot architecture or a
  spec-revisable gap is named.
- Two-stage CPU + CSS-cascade demonstration extends **S2**
  (substrate-resolution determinism, algorithm 16) to the
  duel-decision layer.
- Browser-hosted (not Node-only).
- RNG-seeded determinism (the Phase 3a-vs-3b verification
  requires this).
- Per-substrate intake configuration is the substrate's identity
  location (not "axis," not "primitive vocab").
- Invention at ratification/promotion closes the
  emergence-effectiveness loop (per SE-11 §3 — substrates invent at
  ratification time; new vectors share the substrate's expressive
  surface; F5/SE-09 irreversibility is honored — inventions deposit
  permanent additions to the action space).
- Honest reporting of trajectory — no tuning to engineer
  melting-pot-equivalent behavior on canonical Field.

### Does not commit

- That Phase 3 will reproduce the melting-pot's exact behavior.
  Canonical Field has its own M3/K1 implementation that may
  produce different fidelity averages, different ratification
  rates, different sub-cascade promotion timing. If so, that's
  a finding, not a bug.
- That Phase 3 demonstrates **SE-06** at the duel-decision layer.
  SE-06 — two substrates operating on one shared field
  simultaneously, coupled through delta — is the Phase 4
  experiment, where CPU and CSS-cascade resolution paths run
  concurrently against one field rather than sequentially.
- That Phase 3 generalizes to non-duel domains. Phase 5 (the
  source-substrate port) is the test of whether the architecture
  transfers; Phase 3 is the test of whether canonical Field
  supports the architecture at all.
- A specific timeline. The 5 sub-phases are scoped at one
  session each; reality varies.
- WebGPU resolution. The S2 empirical floor at
  exodus/canonical-implementation/ already includes WGSL. Adding
  WGSL to the duel layer is Phase 6.

---

## 6. Live status

| Date | Action |
|---|---|
| 2026-05-26 | Spec drafted. Pending review and commit. Phase 3.1 (domain layer) begins after commit. |

Updates appended as sub-phases complete or halt.

---

## 7. Reference cross-links

- Phase 2 deliverable and results: [phase-2-results.md](phase-2-results.md)
- Phase 11 master plan: [PLAN.md](PLAN.md) (still authoritative;
  Phase 3 spec amends Phase 3 specifically)
- Melting-pot reference: [canon/UTF/research/Phase 6/rich-duel-melting-pot.html](../../canon/UTF/research/Phase%206/rich-duel-melting-pot.html)
- Phase 6 analysis: [canon/UTF/research/phase-6-substrate-duels-analysis.md](../../canon/UTF/research/phase-6-substrate-duels-analysis.md)
- Open-input research plan: [canon/UTF/research/open-input-test-plan.md](../../canon/UTF/research/open-input-test-plan.md)
- Project-wide claim hierarchy: [PROJECT-PLAN.md](../../PROJECT-PLAN.md)
- SE-06 substrate-duality: [canon/specification/SE-06-substrate-duality.md](../../canon/specification/SE-06-substrate-duality.md)
- Canonical kernel: [implementation/kernel/field.js](../kernel/field.js)
- Phase 2 substrate factory: [substrate-factory.js](substrate-factory.js)
