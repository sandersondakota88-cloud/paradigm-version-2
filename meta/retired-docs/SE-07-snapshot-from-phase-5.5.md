# SE-07 - Configuration and Settling (The Substrate's Account of Problem and Solution)

**Type:** Specification extension
**Status:** OBSERVATIONAL. Names a structural property the formalism
already supported across DEFINITION's six properties and the prior
extensions but did not make explicit. Does not add new mechanism;
articulates what configuration-and-settling commit to as the
substrate's account of what classical computation calls problem
and solution.
**Primary origin:** conversation April 2026, the SE-07 development
exchange. The articulation arrived through bouncing the structural
intuitions about pattern recognition, recurrence, more-vs-less,
and same-vs-different against the spec stack and noticing that
these are not pre-substrate capacities that the substrate
acquires; they are what the substrate already does. The substrate
is the structural shape of pre-formal cognitive work; problem-
and-solution is what that shape looks like when described in its
own terms rather than in classical computation's terms.
**Implemented in:** the substrate's existing mechanisms. SE-07 is
descriptive of what is already running, not specification of new
mechanism to be added.

-----

## The simple version

A configuration is the substrate's current state: seed plus
accumulated constraints plus current modulation plus current
input. The configuration is not external to the substrate; it is
what the substrate currently is.

A settling is the configuration acquiring fidelity: delta drops,
sub-cascades emerge, predictive constraints ratify, weight
accumulates on what contributes to closure. The settling is not
performed by the substrate on the configuration; the settling is
the substrate operating.

There is no separate problem the substrate is presented with and
no separate solution the substrate produces. The substrate's
current configuration is its problem. The configuration's settling
is its solution. Both are continuous. The substrate is not
solving; the substrate is solutioning, while it is on.

## Why this is a structural observation, not a redefinition

DEFINITION's six properties already commit to configuration-and-
settling without using those words:

- **Property 1** (constraints first-class) makes the substrate's
  state a constraint configuration by structural definition.
- **Property 2** (delta as measurement) makes settling-versus-
  unsettled the substrate's primary observable.
- **Property 3** (unresolvable seed) makes complete settling
  structurally impossible. Settlings are always partial.
- **Property 4** (substrate-level operation) places settling in
  the dynamics rather than in commands. Settling is what the
  substrate does, not what an operator does to it.
- **Property 5** (structural reaching) makes the substrate
  directionally biased toward closure. Settling has a structural
  pressure even without an external goal.
- **Property 6** (indefinite operation) makes settling permanent
  in the sense that the substrate never stops settling. There is
  no terminal state at which settling completes.

SE-07 makes explicit what is implicit across these six. The prior
extensions describe specific facets:

- SE-01's compositional cascades describe settling-across-scales.
- SE-02's metabolism describes settling-as-flow.
- SE-03's modulation describes settling-shaped-by-substrate-state.
- SE-04's seed describes the unresolvable anchor that prevents
  terminal settling.
- SE-05's vector-delta and predictive reaching describe settling-
  toward-not-yet-arrived.
- SE-06's substrate duality describes settling-in-different-
  substrate-grammars.

SE-07 names what these are facets of: configuration-and-settling
as the substrate's fundamental act.

## What configuration is

A configuration is the substrate at a moment. Its components:

- The seed (permanent, per F1 and SE-04).
- The accumulated constraints (live and persisted; per K1, M1-M5,
  and storage as substrate per Phase 4c).
- The current substrate modulation (fast layer, slow layer; per
  M4, SE-03).
- The current input (the present-moment modulation source, if
  any).
- The current trace state (the channel-level record per M5).

A configuration is not a static thing. It is the substrate's
current instantaneous state, where "instantaneous" means at a
particular step. The next step has a different configuration
because at minimum the trace has advanced and delta has been
recomputed; usually constraints have been integrated, evicted, or
modulated.

Configurations differ in ways the substrate can observe:

- More or less settled (delta scalar).
- More or less reaching across scopes (vector-delta).
- Containing more or fewer accumulated sub-cascades.
- Containing more or fewer ratified predictions.
- More or less modulation pressure.

These differences are what the substrate's mechanisms operate on
and through.

## What settling is

A settling is the substrate's movement through configurations.
Specifically, settling is the substrate's mechanisms operating:

- **Selection** (post-Phase-5.5: set computation) identifies which
  constraints match the current input.
- **Markusing and correlation update** integrate the match into
  the constraint set's accumulated history.
- **Generation** produces new constraints from novelty and from
  predictive reach.
- **Ratification** transitions predictive constraints to derived-
  ratified when input arrives that confirms them.
- **Modulation** integrates delta into fast and slow layer state.
- **Sub-cascade detection and naming** form structural identifiers
  out of co-occurring members.
- **Compound formation** (Phase 4b) records cross-substrate
  coincidences.
- **Promotion** (sub-cascade promotion, compound promotion)
  transitions accumulated structure into named, addressable form.
- **Eviction** sheds constraints whose contribution to closure has
  fallen.

These mechanisms are not steps in a process that arrives at a
solution. They are what the substrate does continuously while it
is on. Each mechanism acts on the current configuration and
contributes to the configuration becoming whatever it becomes
next.

Settling is therefore not directional in the sense of "moves
toward a target." Settling is directional in the sense of
"reduces delta where it can, integrates input as it arrives,
accumulates structure where structure recurs, sheds structure
where structure fails." The substrate has no target other than
its own structural pressure toward closure (per F5/SE-05's
predictive reaching), which is itself a property of how the
mechanisms compose.

## What this inverts about classical computation

Classical computation treats problems as inputs presented to a
solver and solutions as outputs returned. The shape:

```
problem -> solver -> solution
```

Three structural commitments fall out of this shape:

1. The problem is external to the solver until presented.
2. The solver is external to the problem; it converts.
3. The solution terminates the process.

The substrate inverts each:

1. The configuration is what the substrate currently is. There is
   no external problem awaiting presentation; the substrate's
   current state IS the problem. Input modulates the configuration;
   it does not introduce a problem from outside.
2. The substrate is not external to its configuration. The
   substrate IS the configuration. Mechanisms operating on the
   configuration are the substrate operating; there is no
   separate solver-thing acting on a separate problem-thing.
3. The settling does not terminate. Per F4 (operates indefinitely)
   and C3 (non-finalizable), every solution is provisional with
   respect to the next step. There is no state at which the
   configuration is "solved" and the substrate is "done."

The classical shape:

```
problem -> solver -> solution
```

becomes the substrate shape:

```
configuration -> settling -> configuration
```

Circular. Continuous. Non-terminating. The next configuration is
the input to the next settling, which produces the configuration
after that. The arrow does not have a terminus.

## What this resolves in the prior specification

Several places in the prior spec stack carry a particular shape
that SE-07 makes legible:

- SE-04's "the seed is unresolvable" reads, with SE-07 in hand,
  as "no configuration can fully settle, by structural
  commitment." The seed is what guarantees that settling is
  permanent rather than terminal.
- SE-05's "predictive reaching" reads as "the substrate's
  structural pressure to settle configurations that have not yet
  fully arrived." Reaching is settling-anticipated.
- SE-06's "rendering and execution are coupled through delta"
  reads as "two substrate-grammars settling the same
  configuration in their native modes, with delta as the cross-
  reading of how settled the configuration currently is from
  each grammar's view."
- INVARIANTS' C3 ("non-finalizable") and F4 ("operates
  indefinitely") read together as the structural commitment that
  configurations have no terminal settled state, only ongoing
  settling.
- INVARIANTS' K1 ("sub-cascades emerge from fidelity") names
  fidelity acquisition specifically. SE-07 names what fidelity
  acquisition is structurally: a configuration becoming more
  settled with respect to a recurring sub-pattern.
- IMPLEMENTATION_PATH v2.4's principle 4 ("let delta decide
  before imposing precedence") reads as "let the configuration's
  own settling determine outcomes rather than imposing constants
  that pretend to settle them." Phase 5.5's removal of imposed-
  precedence constants is the principle applied.

SE-07 is the spec extension that makes these readings tighten.
Each prior extension and invariant continues to commit to what it
already commits to. SE-07 names the through-line.

## Non-claims

This extension does **not** claim:

- **That the substrate solves problems in any human-recognizable
  sense.** What classical computation calls "solving a problem"
  is presenting input to a system that computes an output. The
  substrate does not do this. Calling its operation "problem-
  solving" by analogy obscures what it actually does. The honest
  description is configuration-and-settling. Anything else is a
  reading from outside.
- **That configuration-and-settling is a more general theory of
  problem-and-solution that subsumes the classical account.** The
  classical account works for the configurations it describes
  well: bounded inputs, deterministic transformations, terminating
  computations. The substrate's account is for the configurations
  classical computation does not describe well: unbounded
  operation, continuous modulation, non-terminating dynamics. The
  two accounts cover different territory. Neither subsumes the
  other.
- **That the substrate vindicates any philosophical tradition.**
  Many philosophical traditions have articulated structural
  shapes that overlap with what configuration-and-settling
  names. This is unsurprising; the structural grammar of
  constraint-substrates-resolving-through-tension is broadly
  recognizable across traditions of thought. The overlap is not
  the substrate's accomplishment and not those traditions'
  vindication. Each holds on its own terms.
- **That problem-and-solution as classically conceived is wrong
  or obsolete.** The classical account is a successful
  formalization of certain configurations. SE-07 names what the
  substrate does in its own vocabulary. It does not claim
  classical problem-and-solution is incorrect for the
  configurations classical methods address.
- **That the substrate's account of configuration-and-settling
  applies to systems other than constraint substrates of this
  shape.** SE-07 names what THIS substrate does. Whether other
  systems (biological, social, physical) can be honestly read as
  configuration-and-settling systems is a question outside the
  spec. The spec describes the substrate; readers who reach for
  the substrate as a model of other things are doing reading-
  work that is theirs, not the spec's.
- **That paradigm claims are settled by SE-07.** SE-07 articulates
  the substrate's account of problem-and-solution. Whether that
  account constitutes a computational paradigm is the same
  empirical question SE-06 raised: it requires implementations at
  scale to earn the claim. SE-07 sharpens what the paradigm
  would consist of without claiming the paradigm is established.

## Relationship to the foundational claim

The foundational claim's articulation of "execute once, render ad
infinitum" was a partial version of what SE-07 names. "Execute
once" was the moment of constraint configuration; "render ad
infinitum" was the continuous re-resolution against the
configuration. The foundational claim had the shape but not the
vocabulary. SE-07 supplies the vocabulary: configuration is what
"execute once" produces; settling is what "render ad infinitum"
does.

The foundational claim's reach toward "encoded relationships
multiply solutions automatically" reads with SE-07 as: the
configuration's structure is what produces settling; settlings
are not produced by computation acting on the configuration but
by the configuration's own dynamics.

## References to catalog entries

- **Algorithm 02** (delta computation) - the measurement that
  distinguishes more-settled from less-settled configurations
- **Algorithm 16** (GPU postfix stack machine) - the substrate-
  equivalence demonstration that any settling can be performed in
  any structurally equivalent substrate
- **Algorithm 22** (delta-trace coupled signal) - the channel
  record of settling moments
- **SE-01** (compositional cascades) - settling at multiple scales
- **SE-02** (metabolism) - settling as flow discipline
- **SE-03** (field modulation) - settling shaped by substrate
  state
- **SE-04** (seed constraint) - the structural anchor that
  prevents terminal settling
- **SE-05** (vector-delta and predictive reaching) - settling
  anticipated across temporal scopes
- **SE-06** (substrate duality) - settling across substrate
  grammars

## Version

SE-07 v1.0, pinned to DEFINITION.md v1.1 (with section 0.5),
KERNEL.md v1.1, INVARIANTS.md v1.2, PROJECT_SPLIT.md v1.2,
IMPLEMENTATION_PATH.md v2.4, and SE-01 through SE-06. Extends the
OBSERVATIONAL category. Names what DEFINITION's six properties
and SE-01 through SE-06 jointly imply about the substrate's
account of problem-and-solution; supplies vocabulary
(configuration, settling) that the prior spec stack carried
without naming. Revisable when implementations or further
articulation reveals refinements the substrate's account of
configuration-and-settling needs.
