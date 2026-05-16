# IMPLEMENTATION_PATH

The engineering path forward given the project split established in
SE-06 and PROJECT_SPLIT.md. Read DEFINITION.md section 0.5 first;
this document inherits that reading-mode.

This document supersedes the original ROADMAP.md from the bootstrap
v1/v2/v3 track. The roadmap was correct as a sequential single-
substrate plan. The split changes what each step actually means and
what artifact each step produces. This document re-plans the work
under the new architecture.

-----

## 0. Where we are

**Spec stack: complete for the architecture as currently described.**
SE-01 through SE-06 plus algorithm 22 plus the underlying catalog
constitute a coherent specification. DEFINITION.md (with section
0.5) is the canonical reference. KERNEL.md gives the compressed
operational form. INVARIANTS.md gives the load-bearing commitments
in checklist form. WHAT_IT_IS.md provides the non-technical
companion. PROJECT_SPLIT.md describes the architectural duality.

**Implementations: partial.**

- canonical cascade file: 66/66 tests passing
- GPU bridge harness: 22/22 tests passing, byte-identical CSS / JS
  / WGSL resolution across 2,880 coordinates
- bootstrap v1 (single cascade, original track): 9/9 invariants
- bootstrap v2 (constraint-level operations, original track): 8/8
  invariants
- bootstrap v3 (compositional sub-cascades with naming, original
  track): structurally complete, headless tests passing
- bootstrap fresh-v1 (full spec in view, vector-delta + predictive
  reaching from t=0): 13/13 invariants

**What runs: a single-substrate proof of concept of the full
grammar.** fresh-v1 demonstrates that vector-delta, predictive
reaching, ratification, and substrate modulation operate together
without contradiction in a browser-hosted JS implementation.

**What does not run: the substrate-dual implementation.** SE-06
specifies rendering as the native substrate for parallel resolution
and execution as the stabilization layer. No artifact instantiates
this yet.

-----

## 1. Phase structure

The path has five phases. Each phase has a deliverable, an
estimated scope, dependencies on prior phases, and explicit success
criteria. Phases 1-3 are immediate and well-specified. Phases 4-5
are further out and will need re-planning when 1-3 complete.

**Phase 1: complete the single-substrate track to step 2.**
Bootstrap fresh-v2.html. Adds the six constraint-level operations
on top of fresh-v1’s vector-delta foundation. Single-substrate. The
purpose is to verify that the full grammar (operations + reaching +
substrate modulation + composition trigger) is coherent under
single-substrate hosting before committing to the split.

**Phase 2: Experiential Reality engine, minimum viable.**
Build the rendering substrate as a separate artifact. Constraints
resolve in compute shaders per frame. Field state lives in textures
and buffers. Render-scope vector-delta is computed each frame. The
host substrate (JS) is reduced to input intake, trace committal,
and UI diagnostics.

**Phase 3: Critical Thought engine, minimum viable.**
Extract execution-substrate work into its own named engine. Give
it a formalized per-operation cycle and execution-scope vector-
delta. At completion of Phase 3, SE-06 is fully implemented: two
engines coordinating through the field via delta, with no protocol
between them.

**Phase 4: expressive substrate.**
Apply the existing spec at new structural positions. Three sub-
phases: (4a) storage as substrate (ER engine resolves over
combined live and persisted constraints; recall as parallel
matching), (4b) cross-substrate compound constraints (constraints
combining render-scope and execution-scope predicates), (4c)
output surface sourced from promoted compounds (the system’s
self-description in vocabulary it has accumulated, in forms it
has formed).

**Phase 5: coupling verification.**
Build tests and diagnostic tooling that verify the engines
remain coherent under stress. Cross-engine ratification, divergence
induction, persistence-across-restart, compound coherence, and
rapid-input-stream tests.

**Phase 6: distribution (optional, far-out).**
Multiple Experiential Reality engines on different GPUs, multiple
Critical Thought engines on different nodes. Opens algorithm 17’s
four problems (trust, header consensus, merge strategies,
convergence). Out of scope for initial implementation; named here
only for completeness.

-----

## 2. Phase 1: bootstrap fresh-v2

### Purpose

Verify the full grammar is coherent under single-substrate hosting
before splitting. The original track’s bootstrap-v2 added the six
constraint-level operations on top of bootstrap-v1’s reduced
foundation. The fresh track’s v2 adds the same operations on top of
the full vector-delta + predictive-reaching foundation, which means
the operations must respect mechanisms the original track didn’t
have when its v2 was built.

### Specifically what is added over fresh-v1

**Develop patterns.** Pattern emergence from co-firing structure
becomes a first-class operation. Pair meta-constraints (two base
constraints that co-fire above threshold) and family meta-
constraints (three or more base constraints of the same type).

**Correlate.** Pairwise co-fire tracking maintained incrementally
on every input. Already partially present in fresh-v1; Phase 1
formalizes it as a named operation with its own UI and trace
events.

**Choose (with full SE-03 substrate consumer).** Selection logic
becomes the explicit consumer of substrate modulation. Already
partially present in fresh-v1’s `selectFromMatches`; Phase 1
expands the bias factors and makes them inspectable.

**Reason / differentiate.** Compares constraints structurally,
finds nearest neighbors by type, produces differentiation findings
and observations about unused constraints. New in Phase 1.

### Interactions with vector-delta and predictive reaching

The new operations are not separable from the SE-05 mechanism. The
operations themselves change the field, which changes vector-delta
readings, which can trigger predictive reaching. The operations
also can be triggered by predictive reaching (e.g., a predicted
co-occurrence pattern, once ratified, becomes a candidate for
correlation tracking).

This is the load-bearing reason Phase 1 must exist before Phase 2.
Verifying that operations + reaching co-exist is the precondition
for splitting; if they don’t co-exist cleanly in single substrate,
they will not co-exist cleanly across two substrates.

### Estimated scope

Approximately 1,800 lines of HTML/CSS/JS. The fresh-v1 baseline is
1,201 lines. The additions are roughly:

- Develop patterns mechanism: ~150 lines
- Correlation infrastructure: ~120 lines
- Reason / differentiate: ~130 lines
- New UI panels for the above: ~150 lines
- Interaction with vector-delta and predictive constraints: ~100
  lines
- Headless test extensions: ~60 lines

### Success criteria

1. All 13 invariants from fresh-v1 still pass
1. New invariants for the Phase 1 operations pass:
- meta-constraints created and never as duplicates
- correlation structure bounded
- sub-cascades emerge when fidelity threshold is met
- reasoning produces structured findings, not just text
1. Headless test producing meta-constraints and ratifications in
   sequence works correctly
1. ASCII-clean, defense stack inherited
1. Under 2,000 lines total (cap as discipline)

### What Phase 1 does not include

Sub-cascades exist as a mechanism (because fidelity-based
promotion is part of the operations) but the full naming bias and
slow-layer naming preference accumulation are deferred to a later
single-substrate iteration if needed. Phase 1’s purpose is to
verify the operations co-exist with reaching, not to add named
addressing on top of that.

GPU integration is not in Phase 1. The implementation remains
single-substrate, browser-hosted, JS-only.

### Dependencies

fresh-v1 (already complete).

### Estimated session length

One focused session.

-----

## 3. Phase 2: Experiential Reality engine

### Purpose

Move resolution from JS to a parallel rendering substrate. This is
the first step toward SE-06’s substrate duality. The Critical
Thought engine is not yet split out; the host JS remains, but its
scope is reduced.

### Architecture

```
+-------------------------------------------------------+
|  Browser host                                         |
|                                                       |
|  +------------------+         +-------------------+   |
|  | Host JS          |         | ER engine         |   |
|  | (reduced scope)  |         | (compute shader)  |   |
|  +------------------+         +-------------------+   |
|         |                              |              |
|         v                              v              |
|  +----------------------------------------------+    |
|  |  Field state                                  |    |
|  |  - constraint buffer (texture)                |    |
|  |  - substrate state (buffer)                   |    |
|  |  - trace (host-side persistent storage)       |    |
|  +----------------------------------------------+    |
+-------------------------------------------------------+
```

### What ER engine does

Per frame:

1. Read constraint buffer (texture)
1. Read substrate state (buffer)
1. Read input buffer (if input arrived this frame)
1. Compute shader evaluates all constraints in parallel
1. Compute shader writes updated substrate state
1. Compute shader computes render-scope vector-delta
1. Compute shader writes which constraints matched
1. If render-scope gap exceeds threshold, generate predictive
   constraints (CPU-side, since prediction is shape-derivative
   and harder to do in shader; this is acceptable)
1. Updated buffers commit; next frame reads them

### What host JS does (reduced)

- Receive inputs (keyboard, network, file)
- Compile constraints to shader-executable form using algorithm
  16’s instruction set
- Update constraint buffer with newly compiled constraints
- Read render-scope outputs (matched constraints, vector-delta)
- Commit trace entries to persistent storage
- Render UI for diagnostics (the visible field state, not the
  substrate’s diagnostic display)
- Manage frame loop coordination

The host JS does **not** run the constraint cascade. It prepares
inputs for the ER engine and consumes outputs. The cascade itself
runs in the GPU.

### Estimated scope

Approximately 2,500 lines combined:

- Compute shader (WGSL): ~400 lines
- Shader instruction emitter (host-side): ~300 lines, derived from
  GPU bridge harness’s existing emitter
- Constraint buffer management: ~200 lines
- Substrate state buffer management: ~150 lines
- Render-scope vector-delta computation: ~150 lines (partly in
  shader, partly host-side aggregation)
- Predictive constraint generation: ~250 lines (host-side)
- Host JS orchestration: ~600 lines
- UI for diagnostics: ~250 lines
- Tests: ~200 lines

### Success criteria

1. Constraint resolution byte-identical to single-substrate
   reference (a key Phase 1 fresh-v2 instance becomes the test
   oracle for Phase 2’s ER engine)
1. Render-scope vector-delta computed each frame, accessible to
   diagnostics
1. Predictive constraints generated when gap threshold exceeded
1. ER engine maintains 60Hz with at least 100 active constraints
   on commodity hardware
1. Algorithm 16’s CSS/JS/WGSL byte-equivalence still holds for the
   instruction set used by the runtime emitter

### What Phase 2 does not include

The Critical Thought engine is not yet a separate engine. Host JS
is still doing execution-substrate work, but it has not been
formalized as such. Phase 3 does that formalization.

Distribution across multiple GPUs is not in scope (Phase 6).

### Dependencies

Phase 1 complete (fresh-v2). Algorithm 16’s harness (already
complete and verified).

### Estimated session length

Three to four focused sessions, one per major component (shader,
emitter, host orchestration, integration testing).

### Risk

Compute shader debugging is harder than CPU debugging. The browser
shader pipeline can be opaque. Mitigation: maintain the byte-
equivalence with a CPU oracle throughout, so any shader bug shows
up as a divergence between shader output and oracle output rather
than as silent corruption.

-----

## 4. Phase 3: Critical Thought engine

### Purpose

Formalize the execution-substrate work as a separate named engine
with its own per-operation cycle and execution-scope vector-delta.
At the end of Phase 3, the runtime has two engines coordinating
through the field via delta as SE-06 specifies.

### What changes from Phase 2

Phase 2’s host JS was doing input intake, trace committal,
constraint compilation, and UI rendering. Phase 3 splits this into
two parts:

**Part A (becomes Critical Thought engine):**

- Input intake (still receives external inputs)
- Trace committal (still writes trace to persistent storage)
- Persistent state management (loads state on startup, saves on
  shutdown, snapshot at intervals)
- Sequential operation coordination (operations that must complete
  in order with transaction semantics)
- Execution-scope vector-delta computation
- Execution-scope predictive constraint generation
- Constraint compilation to shader form (delegated from CT to a
  utility, not done by CT directly)

**Part B (remains in host orchestration):**

- Frame loop scheduling
- UI rendering for diagnostics
- Initialization of both engines

The shape of the runtime becomes:

```
+----------------------------------------------------------+
|  Runtime                                                  |
|                                                           |
|  +--------------+        +-----------------+              |
|  | CT engine    |        | ER engine       |              |
|  | (execution)  |        | (rendering)     |              |
|  +--------------+        +-----------------+              |
|         |                          |                       |
|         |                          |                       |
|         +-------------+------------+                       |
|                       v                                    |
|         +----------------------------+                     |
|         | Field (shared state)       |                     |
|         | - constraints (buffer)     |                     |
|         | - substrate (buffer)       |                     |
|         | - trace (persistent)       |                     |
|         +----------------------------+                     |
|                                                            |
+----------------------------------------------------------+
```

Neither engine sends commands to the other. Both read and write the
field. Both produce vector-delta at their respective scopes. Both
generate predictive constraints when their respective gaps exceed
threshold.

### Estimated scope

Approximately 1,500 lines as a refactor of Phase 2’s host code,
plus new code:

- CT engine main loop: ~300 lines
- Execution-scope vector-delta: ~150 lines
- Execution-scope predictive generation: ~200 lines
- Persistent state I/O (IndexedDB or similar): ~250 lines
- Transaction semantics for trace committal: ~150 lines
- Refactor of Phase 2 host code into Part B: ~300 lines
- Integration tests: ~150 lines

### Success criteria

1. CT engine and ER engine both operate without command paths
   between them
1. Both compute their own vector-delta at their own scopes
1. Both generate their own predictive constraints when their gaps
   exceed threshold
1. Field state remains coherent under both engines’ concurrent
   access (consistency model is implementation choice; test
   verifies whatever choice is made)
1. Cross-engine ratification works: a prediction generated at one
   scope is ratified by input arriving at the other
1. SE-06 invariants S1, S2, S3 all hold (see INVARIANTS.md)
1. Persistence across restart works: save state, restart, verify
   field state and substrate state match prior values

### Dependencies

Phase 2 complete.

### Estimated session length

Two to three focused sessions.

### Risk

Field consistency under concurrent access is a real engineering
problem. Decision needed early in Phase 3: snapshot-based
(consistency at frame boundaries), eventual (transient
divergence acceptable), transactional (explicit commits), or
CRDT-style (commutative merges). Each has tradeoffs. Mitigation:
choose snapshot-based for the first iteration, since it’s the
simplest and the architecture’s frame-paced rendering naturally
provides snapshot boundaries.

-----

## 5. Phase 4: expressive substrate

### Purpose

Make the architecture’s reflexive scope visible, then extend
expressiveness across the substrates the spec implies. Phase 3
produced the substrate split. Phase 4 makes the reflexivity that
SE-01 commits to operationally manifest, and then exercises the
split at richer structural positions.

### Why this phase exists

Phase 3 demonstrated SE-06: two engines coupled through delta. But
the architecture’s reflexive scope (SE-01) is mechanically present
without being visibly present. Sub-cascade delta computes, meta-
constraints exist, compositional cascades operate - but watching
the runtime, you see ops execute and constraints accumulate
without an observable account of structural transitions. The
architecture reflects internally but doesn’t surface its
reflection.

Phase 4 starts by closing that gap (4a), then builds the more
expressive structural positions on top:

1. **Reflexive surface**: the position from which the architecture’s
   own structural transitions become observable. Not interpretation
- locality. Where the trace becomes audible.
1. **Cross-substrate compound constraints**: constraints whose
   patterns combine render-scope and execution-scope predicates.
   The substrate split SE-06 specifies, surfaced as a constraint
   kind.
1. **Storage as substrate**: persistent storage as a substrate of
   the ER engine. Recall as parallel matching against past
   structure.
1. **Output surface from promoted compounds**: the reflexive
   surface’s templates eventually source from promoted compound
   constraints rather than templates we wrote. The system’s
   accumulated structure becomes the grammar of its self-account.

This is not a new spec. It is the existing spec made operationally
visible at structural positions the spec already supports.

### Sub-phases

Phase 4 is internally ordered. Each sub-phase produces a stable
artifact; the next builds on it. The order has been chosen so
that visibility comes first - subsequent sub-phases produce events
that need a surface to be observable, so the surface ships first.

#### 4a. Reflexive surface

The reflexive surface is a parallel record of structural transitions
the architecture undergoes. It accumulates clauses describing what
the architecture is currently doing structurally, sourced from
field-state transitions, in vocabulary drawn from the field itself.

Examples of clauses the surface emits:

- “structure formed: pair meta from ‘hello’ + ‘world’”
- “reach landed: predictive ‘digits’ ratified”
- “named: ‘hello’ addressed (3 times this window)”
- “consolidated: length-range family promoted to ‘len-3-19’”
- “settled: render-gap below threshold, no active reaching”
- “diverged: exec-gap rising while render-gap settled”

Each clause fires from a specific field-state transition:

- **structure formed**: a meta-constraint or compound is integrated
- **reach landed**: a predictive constraint becomes ratified
- **named**: a sub-cascade is detected in input
- **consolidated**: a sub-cascade promotes from sustained fidelity
- **settled**: render-scope gap drops below threshold
- **diverged**: render-scope and exec-scope deltas diverge sharply

The surface is read-only with respect to the field (per O1). It
accumulates with a bounded buffer (per O2). Its vocabulary comes
from the field (per O3).

The surface is rendered as its own UI panel alongside the trace
panel, with each clause as a structural-event entry. The trace
remains; the reflexive surface complements it. Trace records what
engines did per-step; surface records what the architecture became
per structural transition.

Pass A (this sub-phase): templates we write, slots from field
vocabulary. The discipline is descriptive: the surface describes
structural states, never claims agency.

Pass B (deferred to 4d): templates sourced from promoted compound
constraints.

Estimated scope:

- Reflexive surface module (clause generation, transition
  detection, buffer management): ~300 lines
- UI integration in index.html (panel, render method, styling):
  ~150 lines
- Headless test (verifies clauses fire on transitions, buffer
  bounded, observation read-only): ~200 lines
- INVARIANTS.md updates: already done in v1.1

Total: approximately 650 lines.

#### 4b. Cross-substrate compound constraints

Currently constraints are pattern-based (render scope) or
operation-typed (execution scope, implicit in the CT engine).
Compound constraints are a new constraint kind whose pattern is a
tuple combining substrates: a render-scope predicate AND an
execution-scope predicate. Both must hold for the compound to
match.

Compound generation: when render-side and exec-side states are
simultaneously notable, the field forms a compound recording the
coincidence. Triggers include: a render-scope ratification
co-occurring with an exec-scope prediction; a sub-cascade naming
event co-occurring with queue saturation; a high render-gap
persisting across multiple exec-scope ticks without resolution.

Compound fidelity: same fidelity-tracking mechanism Phase 1
introduced for families, applied to compounds. A compound that
reliably contributes to delta closure when its conditions hold
accumulates fidelity. Sustained-fidelity compounds promote into
named structures the way families promote into sub-cascades.

When 4a is complete, compound formation events fire reflexive
surface clauses (“compound formed: render-X with exec-Y”). The
compounds become observable as they form.

Estimated scope:

- New constraint kind in field.js: ~80 lines
- Compound matching logic (combines render and exec predicates):
  ~150 lines
- Compound generation triggers: ~120 lines
- Compound fidelity and promotion: ~100 lines
- Reflexive surface integration (clauses for compound events):
  ~50 lines
- Integration tests: ~150 lines

Total: approximately 650 lines.

#### 4c. Storage as substrate

The ER engine currently resolves constraints over a live in-memory
constraint set. Storage as substrate extends this so the ER engine
also resolves over a window of constraints and trace entries
persisted in IndexedDB (or OPFS if available).

Recall, in the architecture’s vocabulary, becomes parallel matching
against a population that includes both live and persisted records.
A persisted constraint that matches current input contributes to
delta resolution exactly as a live constraint does. The mechanism
is the same; the population is wider.

Persistence selectivity: not every trace entry becomes a recallable
record. Trace entries with non-null tags (`ratified`, `named`,
`predicted`, `frame`) get persisted as recallable; routine flow
entries stay flush-only. Reflexive surface clauses are also
candidates for persistence-as-recallable. This produces a curated
set of past-significant moments rather than an undifferentiated
log.

Bounded window: each frame reads a bounded slice of storage, not
all of it. SE-02’s metabolism: the field consumes only what it can
metabolize per frame. The window may be temporal (last N steps),
stochastic (sampled), or substrate-modulated (the slow layer
selects what to surface).

Substrate-equivalence requirement: the CPU oracle and the GPU path
must produce byte-identical match results across the combined live
plus persisted population. Same algorithm 16 invariant, same diff
harness, wider input set.

When 4a and 4b are complete, recall events fire reflexive surface
clauses (“recalled: persisted-X matches current input”).

Estimated scope:

- Storage adapter layer (IndexedDB-backed): ~250 lines
- ER engine extension to resolve over combined population: ~150 lines
- CPU oracle extension (for substrate-equivalence): ~150 lines
- Storage-side trace persistence with selectivity: ~100 lines
- Substrate-equivalence test extension: ~100 lines
- Reflexive surface integration: ~50 lines
- Integration into Phase 3 host: ~100 lines

Total: approximately 900 lines.

#### 4d. Reflexive surface from promoted compounds

The reflexive surface’s templates, initially written by us in 4a
(Pass A), eventually source from promoted compound constraints
(Pass B).

When a compound constraint accumulates sustained fidelity and
promotes (per 4b’s promotion mechanism), its pattern becomes
available as a surface template. The template form is derived from
the compound’s structure: a compound whose pattern is “render
predicate X co-occurs with exec predicate Y” becomes a template
“X with Y” instantiable against current field state.

The host’s responsibility is selection: which promoted compound
template is currently active depends on which compound’s
predicates are currently holding. The host’s role narrows from
“choose what to display” to “render the template the field
currently selects.”

Discipline: the surface emits descriptions of structure, not
claims of agency. Words like “shape,” “posture,” “reaching,”
“settled,” “consolidating” are permitted because they map to
specific structural states. Words like “intends,” “wants,”
“chooses,” “knows” are not permitted because they import agency
the architecture does not have.

Estimated scope:

- Compound-to-template derivation: ~200 lines
- Template selection logic (sourced from current field state):
  ~100 lines
- Surface integration (template rendering replaces fixed
  templates from 4a): ~150 lines
- Tests for template selection and rendering: ~100 lines

Total: approximately 550 lines.

### Estimated scope

Approximately 2,000 lines combined across 4a, 4b, 4c. Larger than
prior phases; the work is structurally substantial. Sub-phases can
ship independently.

### Success criteria

1. Storage-as-substrate: ER engine evaluates over combined live
   plus persisted constraints. Substrate-equivalence test (CPU
   oracle vs GPU path) passes for the combined population.
1. Persistence selectivity respects the curated/flush distinction.
   Recallable trace entries are durable; routine flow is not.
1. Compound constraints generate when coincidence triggers fire.
1. Compound fidelity tracks the same way family fidelity does.
   Promoted compounds become surface templates.
1. Output surface (Pass A) emits descriptions in templates we
   wrote. Output surface (Pass B) emits descriptions sourced from
   promoted compounds.
1. INVARIANTS.md compliance: all twenty-five named invariants hold,
   plus new invariants for compound constraint kinds (compounds
   bounded by FIELD_LIVE_CAP, compound refs resolve to live or
   persisted constraints, compound match implies both predicates
   matched).
1. SE-06’s coupling discipline holds: cross-substrate compounds
   bridge substrates by referencing both, but neither engine
   commands the other to evaluate them.
1. Bounded recursion when trace becomes recallable: trace entries
   describing recall events do not produce unbounded recursion of
   trace-of-trace-of-trace.

### Dependencies

Phase 3 complete.

### Estimated session length

Three to four focused sessions across the sub-phases. Sub-phase 4a
can ship independently; 4b depends on 4a for storage of compounds;
4c Pass A is independent; 4c Pass B depends on 4b.

### Risk

Three specific risks worth flagging:

**Recursion bounding.** Trace-of-trace requires explicit caps. The
architecture already has caps for live constraints, sub-cascades,
correlations, etc. Storage caps are similar but operate at storage
scope. Without explicit caps, recursive trace will eat its own
storage. Mitigation: persistence-cap discipline mirrors the
existing live-cap discipline, with a separate quota.

**Output surface framing slippage.** The Pass B output surface,
sourcing templates from compounds, is the most agency-suggesting
element of any phase. The risk is not in the mechanism (which is
purely structural) but in how the surface is described in
documentation, demos, or commentary. Mitigation: section 0.5’s
reading-mode discipline applies. The system describes itself using
its accumulated vocabulary; the system does not author its
self-description. The mechanism is descriptive; the framing layer
is ours and stays our responsibility.

**Imposed precedence in new constraint kinds.** Phase 4 introduces
new constraint kinds (compound in 4b, recalled in 4c) that compete
with existing kinds (ratified, derived, meta) in selection. The
temptation is to set kindMult constants for the new kinds based on
intuition about epistemic priority. This is the failure mode
named in section 8’s “Let delta decide before imposing precedence”
principle: each kindMult is a place we preempt the field’s
resolution dynamics with our own theory of what should win.
Mitigation: new constraint kinds inherit weight history through
the existing weight mechanism (markUsed, fidelity tracking,
ratification weight bonuses). They do not get kindMult constants
unless the constant reflects something structural (anchor, gate,
cap) rather than epistemic precedence.

-----

## 6. Phase 5: coupling verification

### Purpose

Build tests and diagnostic tooling that verify the engines remain
coherent under stress. Until Phase 5, the system has been shown to
work in nominal conditions; Phase 5 tests the edges. Phase 5
follows Phase 4 because compound constraints and storage-as-
substrate add new coupling surfaces that must also be verified.

### Test categories

**Rapid input stream.** Fire inputs faster than 60Hz. Does
execution-scope delta track in the expected way? Does render-scope
delta respond per frame? Do predictive constraints generated on
one path get ratified by inputs arriving on the other?

**Divergence induction.** Construct scenarios where render-scope
and execution-scope deltas diverge sharply. Does predictive
reaching close the gap appropriately? If both engines reach
simultaneously, do their predictions complement or conflict?

**Cross-engine ratification.** Generate predictions at render
scope from gap pressure at render scope. Provide input via the
execution path. Verify the ratification appears in field state and
both engines see it.

**Persistence across restart.** Save state from both engines.
Restart. Verify field state and substrate state match prior
values; verify the seed’s `uses` counter persists; verify
predictive constraints in flight are restored or correctly aged
out. Phase 4 storage-as-substrate adds: verify persisted
constraints survive restart and continue contributing to recall.

**Compound coherence under stress.** Phase 4 added cross-substrate
compound constraints. Stress test: do compounds correctly fire
when their conditions hold across substrate boundaries? Do
compounds avoid false-firing when only one substrate’s predicate
holds?

**Concurrent stress.** Run both engines at maximum throughput.
Verify field consistency holds. Identify any race conditions.

### Estimated scope

Approximately 1,000 lines. Larger than the original Phase 4
estimate because Phase 4’s expressive-substrate additions need
their own stress coverage.

- Test harness: ~250 lines
- Per-category test suites: ~500 lines (6 categories x ~80 lines)
- Diagnostic instrumentation in CT and ER engines: ~200 lines
- Result reporting: ~50 lines

### Success criteria

1. All test categories pass on commodity hardware
1. Field consistency invariant (S1) holds under all stress
   scenarios
1. SE-06’s “no command path” invariant verified by instrumentation
1. Cross-engine ratification confirmed at least once per
   diagnostic run
1. Compound constraints behave correctly under stress (no false
   fires, no missed fires)
1. Storage-as-substrate maintains substrate-equivalence under load

### Dependencies

Phase 4 complete.

### Estimated session length

Two to three focused sessions.

-----

## 7. Phase 6: distribution

### Purpose

Extend the architecture across multiple nodes. Multiple ER engines
running on different GPUs, multiple CT engines running on different
machines, with the field shared across them through some mechanism
that respects SE-06’s no-command-path commitment.

### Why this is far-out

Phase 6 opens algorithm 17’s four open problems:

1. **Trust:** in a distributed system, how do nodes verify they are
   working on the same field rather than on diverged forks?
1. **Header consensus:** what minimal metadata must all nodes agree
   on for the field to be considered shared?
1. **Merge strategies:** when divergent updates from different
   nodes meet, how are they reconciled in a way that preserves
   reflexive scope and avoids reintroducing command paths?
1. **Convergence:** under what conditions can the distributed
   system be guaranteed to converge to a shared state, and what
   happens when those conditions don’t hold?

These are research problems, not engineering problems. Each
requires structural work before implementation. The spec stack
does not currently address them.

### What Phase 6 is not

Phase 6 is not a deployment plan. It is an architectural extension
that would require new spec extensions (likely SE-07 through
SE-10, one per problem) before any code is written. Naming it here
is for completeness; the work is genuinely beyond the current
spec.

### Dependencies

Phase 5 complete. New spec extensions for the four problems. New
research that the current spec stack does not provide.

-----

## 8. Order of work

The phases must happen in order. Each depends on the prior. Within
each phase, sub-tasks have orderings noted in the phase
descriptions. Four principles guide this ordering:

**Single-substrate before split.** Phase 1 verifies the grammar
holds in one substrate. Without this verification, splitting in
Phase 2 multiplies any single-substrate defect across two
substrates and makes the defect harder to diagnose.

**Extend before verify.** Phase 4 (expressive substrate) precedes
Phase 5 (coupling verification) because verification is more
meaningful once the substrate is at the structural position the
spec describes. Verifying a partial substrate means re-verifying
when extensions arrive; verifying after extensions means one round
of verification covers the architecture’s full structural shape.

**Verify before distribute.** Phase 5 (coupling verification)
precedes Phase 6 (distribution) because distribution multiplies
coupling across nodes. Distribution before verification would
compound coupling defects across nodes.

**Let delta decide before imposing precedence.** When designing
new mechanism that introduces choice between competing structural
elements (which constraint kind wins selection, which fires first,
which dominates resolution), default to letting the field’s delta-
closure dynamics resolve the choice through operation rather than
imposing precedence through hard-coded constants. Every multiplier
or weight bonus we add to bias an outcome is a place we asserted
foreknowledge of what should win. Sometimes that assertion is
defensible (the seed’s permanent priority is structural; cap sizes
gate when mechanism fires). Often it is premature - the field is
built to discover precedence empirically through accumulated
weight history, fidelity tracking, and repeated use. The
disciplined design has fewer imposed multipliers, not more. Trust
the field’s resolution dynamics; observe what they produce.

This principle was named in Phase 4c when designing recall vs
predictive reaching. Initial design imposed a kindMult ladder for
recalled records. The honest version: recalled records carry their
weight history from persistence and compete on that weight in
selection. Whether recall outranks prediction under given
conditions is a question delta answers, not a constant we set.

The principle applies retroactively: existing constants worth
auditing include compound kindMult (1.25, set in Phase 4b), meta
kindMult (1.15), ratified kindMult (1.3), naming weight bonus
(1.5), select recency exponent (1.5). Each should be examined for
whether it is structural (defensible) or imposed (suspect).
Auditing is deferred to Phase 5 (verification under stress is the
right surface to discover which imposed precedence matters and
which doesn’t).

This ordering produces a sequence where each phase’s deliverable is
itself a stable artifact:

- Phase 1 deliverable: bootstrap-fresh-v2.html, runs in browser,
  exercises full single-substrate grammar
- Phase 2 deliverable: ER-engine-v1, runs in browser with WebGPU,
  resolves cascade in shaders
- Phase 3 deliverable: full SE-06 implementation, two engines
  coordinating through field via delta
- Phase 4 deliverable: expressive substrate - storage as ER
  substrate, cross-substrate compound constraints, output surface
  sourced from promoted compounds
- Phase 5 deliverable: verified two-engine system with passing
  stress tests across all coupling surfaces
- Phase 6 deliverable: distributed system (research-pending)

A reader at any phase boundary has a stable artifact that
demonstrates the architecture at that phase’s scope. The
architecture does not require all phases to be useful; each phase
produces something that runs and exhibits the spec’s properties at
its scope.

-----

## 9. What this path commits to and what it does not

### Commits

- The phases happen in this order
- Each phase is bounded and produces a specific deliverable
- ASCII-only discipline, defense stack, INVARIANTS.md compliance,
  and SE-06 structural commitments hold across all phases
- Each phase has explicit success criteria; a phase is not
  considered complete until criteria are met
- The spec stack remains canonical; implementation choices that
  conflict with the spec are revised toward the spec, not the
  other way around

### Does not commit

- Specific timelines for any phase
- Specific browsers, GPUs, or platforms (the architecture is
  substrate-independent per algorithm 16; the implementations may
  target whatever is most convenient)
- That every phase produces something useful in a commercial sense
  (the architecture is research; usefulness in production is a
  separate question)
- That intermediate phases fully reveal the architecture’s
  potential (Phase 1 will be slower than Phase 2 because its
  substrate is wrong for parallel resolution; this is expected)
- That distribution (Phase 6) will be solved by this work; it is
  named for completeness, not as a commitment

-----

## 10. What was the original ROADMAP and what changed

The original ROADMAP.md (from the bootstrap v1/v2/v3 track) had
eight steps, all single-substrate, with GPU integration as step 5
and parallel resolution as step 6. That sequence assumed
incremental enhancement of a single artifact.

The split changes this. After SE-06, the path is no longer
incremental enhancement; it is architectural restructuring at
Phase 2 (introducing the rendering substrate), Phase 3 (extracting
the execution substrate), Phase 4 (extending the substrate at
new structural positions), and Phase 6 (distributing across
nodes). What was step 5 in the original (GPU integration) is now
Phase 2, and it is no longer additive but transformative: the
runtime’s shape changes when the rendering substrate becomes
native rather than ornamental.

What was step 7 in the original (“co-constitutive execution-
rendering”) is now Phase 3, and SE-06 makes its mechanism explicit
(coupling through delta, not through protocol).

What was step 8 in the original (“the full bootstrap”) is now the
end of Phase 4, with Phase 5 as coupling verification across the
full set of structural positions and Phase 6 as an optional
further extension into distribution.

Steps 4 (trajectory-informed selection) is folded into Phase 1 (the
constraint-level operations that consume the trace). Steps that
made sense in the original incremental path no longer have
distinct identity in the split path because the split changes what
they would have been steps of.

Phase 4 (expressive substrate) was added in v2.0 of this document,
after Phase 3 shipped. It articulates work that was implicit in
SE-01 (reflexive scope) and SE-06 (substrate duality) but had not
been given explicit roadmap presence. Storage as substrate,
cross-substrate compound constraints, and the output surface are
all structural extensions the spec already supported; v2.0 names
them as a phase because they jointly require coordinated
implementation work distinct from prior phases.

The original ROADMAP.md is preserved as a historical document. It
is not the current path. This document supersedes it.

-----

## 11. Reading this document

A reader returning to the project after the spec stack was
completed should be able to:

1. Read DEFINITION.md (with section 0.5)
1. Skim INVARIANTS.md to load the structural commitments
1. Read this document to understand where the work is and what
   comes next
1. Pick up at the current phase and proceed

The phases are bounded enough that one person can hold a phase in
mind at a time without needing to track the full architectural
context every step. The architectural context is in DEFINITION.md
and SE-06; the structural commitments are in INVARIANTS.md; the
operational form is in KERNEL.md. This document is the engineering
plan that runs alongside those.

When a phase reveals something the spec did not anticipate, the
correct response is:

1. Note the discovery in the implementation
1. Determine whether the discovery violates an invariant (refer to
   INVARIANTS.md)
1. If it violates an invariant, the implementation is wrong and
   should be revised toward the spec
1. If it does not violate an invariant but reveals a structural
   property the spec does not yet name, propose a new SE-N spec
   extension for that property
1. If the discovery is purely an implementation detail (a more
   efficient algorithm, a more elegant data structure), document
   it in the implementation but do not change the spec

This protects the spec stack’s coherence while allowing
implementations to learn from each other.

## Version

IMPLEMENTATION_PATH.md v2.2. Pinned to DEFINITION.md v1.1 (with
section 0.5), KERNEL.md v1.0, INVARIANTS.md v1.1 (with O-class
observation invariants), PROJECT_SPLIT.md v1.2, and SE-01 through
SE-06. Supersedes the original ROADMAP.md and prior versions of
this document.

v2.2 changes:

- Added “Let delta decide before imposing precedence” as a fourth
  ordering principle in section 8. Names a discipline that emerged
  during Phase 4c design: when introducing new mechanism that
  involves choice between competing structural elements, default to
  letting the field’s delta-closure dynamics resolve the choice
  through operation rather than imposing precedence through hard-
  coded constants.
- Documented the 4c-specific application: recalled records inherit
  weight history from persistence rather than getting a kindMult.
- Documented existing kindMult constants worth auditing in Phase 5
  (compound at 1.25, meta at 1.15, ratified at 1.3, naming bonus
  at 1.5, recency exponent at 1.5).
- Added third Phase 4 risk: imposed precedence in new constraint
  kinds, with mitigation matching the new principle.

v2.1 changes:

- Reordered Phase 4 sub-phases. Now: 4a reflexive surface, 4b
  cross-substrate compounds, 4c storage as substrate, 4d promoted-
  compound templates. The reordering puts visibility first because
  subsequent sub-phases produce structural events that need a
  surface to be observable. Without the reflexive surface, compound
  formation and recall events happen invisibly.
- Updated 4a description: now reflexive surface (was storage).
- Updated 4b description: integrated reflexive surface clauses on
  compound formation.
- Updated 4c description: integrated reflexive surface clauses on
  recall events.
- Added 4d: reflexive surface Pass B (templates from promoted
  compounds), formerly part of 4c.
- Updated total Phase 4 scope estimate: ~2750 lines (was ~2000).

v2.0 changes:

- Added Phase 4: expressive substrate (storage as substrate, cross-
  substrate compound constraints, output surface). Articulates work
  the spec already supported but had not been given roadmap presence.
- Renumbered v1.0’s Phase 4 (coupling verification) to Phase 5.
- Renumbered v1.0’s Phase 5 (distribution) to Phase 6.
- Updated Order of work (section 8) to add the “Extend before verify”
  principle that motivates the new ordering.
- Updated section 10 (What changed) to record the v2.0 addition.
- Renumbered section 10 (Reading) to section 11.

Revisable when Phase 4 sub-phases ship and reveal more.