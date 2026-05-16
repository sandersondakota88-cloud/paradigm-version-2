# IMPLEMENTATION_PATH

The engineering path forward given the project split established in
SE-06 and PROJECT_SPLIT.md. Read DEFINITION.md section 0.5 first;
this document inherits that reading-mode.

This document supersedes the original ROADMAP.md from the bootstrap
v1/v2/v3 track. The roadmap was correct as a sequential single-
substrate plan. The split changes what each step actually means and
what artifact each step produces. This document re-plans the work
under the new architecture.

---

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

---

## 1. Phase structure

The path has five phases. Each phase has a deliverable, an
estimated scope, dependencies on prior phases, and explicit success
criteria. Phases 1-3 are immediate and well-specified. Phases 4-5
are further out and will need re-planning when 1-3 complete.

**Phase 1: complete the single-substrate track to step 2.**
Bootstrap fresh-v2.html. Adds the six constraint-level operations
on top of fresh-v1's vector-delta foundation. Single-substrate. The
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

**Phase 4: coupling verification.**
Build tests and diagnostic tooling that verify the two engines
remain coherent under stress. Cross-engine ratification, divergence
induction, persistence-across-restart, and rapid-input-stream
tests.

**Phase 5: distribution (optional, far-out).**
Multiple Experiential Reality engines on different GPUs, multiple
Critical Thought engines on different nodes. Opens algorithm 17's
four problems (trust, header consensus, merge strategies,
convergence). Out of scope for initial implementation; named here
only for completeness.

---

## 2. Phase 1: bootstrap fresh-v2

### Purpose

Verify the full grammar is coherent under single-substrate hosting
before splitting. The original track's bootstrap-v2 added the six
constraint-level operations on top of bootstrap-v1's reduced
foundation. The fresh track's v2 adds the same operations on top of
the full vector-delta + predictive-reaching foundation, which means
the operations must respect mechanisms the original track didn't
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
partially present in fresh-v1's `selectFromMatches`; Phase 1
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
for splitting; if they don't co-exist cleanly in single substrate,
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
2. New invariants for the Phase 1 operations pass:
   - meta-constraints created and never as duplicates
   - correlation structure bounded
   - sub-cascades emerge when fidelity threshold is met
   - reasoning produces structured findings, not just text
3. Headless test producing meta-constraints and ratifications in
   sequence works correctly
4. ASCII-clean, defense stack inherited
5. Under 2,000 lines total (cap as discipline)

### What Phase 1 does not include

Sub-cascades exist as a mechanism (because fidelity-based
promotion is part of the operations) but the full naming bias and
slow-layer naming preference accumulation are deferred to a later
single-substrate iteration if needed. Phase 1's purpose is to
verify the operations co-exist with reaching, not to add named
addressing on top of that.

GPU integration is not in Phase 1. The implementation remains
single-substrate, browser-hosted, JS-only.

### Dependencies

fresh-v1 (already complete).

### Estimated session length

One focused session.

---

## 3. Phase 2: Experiential Reality engine

### Purpose

Move resolution from JS to a parallel rendering substrate. This is
the first step toward SE-06's substrate duality. The Critical
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
2. Read substrate state (buffer)
3. Read input buffer (if input arrived this frame)
4. Compute shader evaluates all constraints in parallel
5. Compute shader writes updated substrate state
6. Compute shader computes render-scope vector-delta
7. Compute shader writes which constraints matched
8. If render-scope gap exceeds threshold, generate predictive
   constraints (CPU-side, since prediction is shape-derivative
   and harder to do in shader; this is acceptable)
9. Updated buffers commit; next frame reads them

### What host JS does (reduced)

- Receive inputs (keyboard, network, file)
- Compile constraints to shader-executable form using algorithm
  16's instruction set
- Update constraint buffer with newly compiled constraints
- Read render-scope outputs (matched constraints, vector-delta)
- Commit trace entries to persistent storage
- Render UI for diagnostics (the visible field state, not the
  substrate's diagnostic display)
- Manage frame loop coordination

The host JS does **not** run the constraint cascade. It prepares
inputs for the ER engine and consumes outputs. The cascade itself
runs in the GPU.

### Estimated scope

Approximately 2,500 lines combined:

- Compute shader (WGSL): ~400 lines
- Shader instruction emitter (host-side): ~300 lines, derived from
  GPU bridge harness's existing emitter
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
   oracle for Phase 2's ER engine)
2. Render-scope vector-delta computed each frame, accessible to
   diagnostics
3. Predictive constraints generated when gap threshold exceeded
4. ER engine maintains 60Hz with at least 100 active constraints
   on commodity hardware
5. Algorithm 16's CSS/JS/WGSL byte-equivalence still holds for the
   instruction set used by the runtime emitter

### What Phase 2 does not include

The Critical Thought engine is not yet a separate engine. Host JS
is still doing execution-substrate work, but it has not been
formalized as such. Phase 3 does that formalization.

Distribution across multiple GPUs is not in scope (Phase 5).

### Dependencies

Phase 1 complete (fresh-v2). Algorithm 16's harness (already
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

---

## 4. Phase 3: Critical Thought engine

### Purpose

Formalize the execution-substrate work as a separate named engine
with its own per-operation cycle and execution-scope vector-delta.
At the end of Phase 3, the runtime has two engines coordinating
through the field via delta as SE-06 specifies.

### What changes from Phase 2

Phase 2's host JS was doing input intake, trace committal,
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

Approximately 1,500 lines as a refactor of Phase 2's host code,
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
2. Both compute their own vector-delta at their own scopes
3. Both generate their own predictive constraints when their gaps
   exceed threshold
4. Field state remains coherent under both engines' concurrent
   access (consistency model is implementation choice; test
   verifies whatever choice is made)
5. Cross-engine ratification works: a prediction generated at one
   scope is ratified by input arriving at the other
6. SE-06 invariants S1, S2, S3 all hold (see INVARIANTS.md)
7. Persistence across restart works: save state, restart, verify
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
choose snapshot-based for the first iteration, since it's the
simplest and the architecture's frame-paced rendering naturally
provides snapshot boundaries.

---

## 5. Phase 4: coupling verification

### Purpose

Build tests and diagnostic tooling that verify the two engines
remain coherent under stress. Until Phase 4, the system has been
shown to work in nominal conditions; Phase 4 tests the edges.

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
values; verify the seed's `uses` counter persists; verify
predictive constraints in flight are restored or correctly aged
out.

**Concurrent stress.** Run both engines at maximum throughput.
Verify field consistency holds. Identify any race conditions.

### Estimated scope

Approximately 800 lines:

- Test harness: ~200 lines
- Per-category test suites: ~400 lines (5 categories x ~80 lines)
- Diagnostic instrumentation in CT and ER engines: ~150 lines
  (instrumentation is part of the engines but added in Phase 4)
- Result reporting: ~50 lines

### Success criteria

1. All test categories pass on commodity hardware
2. Field consistency invariant (S1) holds under all stress
   scenarios
3. SE-06's "no command path" invariant (no detected message-
   passing or scheduler-sharing between engines) verified by
   instrumentation
4. Cross-engine ratification confirmed at least once per
   diagnostic run

### Dependencies

Phase 3 complete.

### Estimated session length

Two focused sessions.

---

## 6. Phase 5: distribution

### Purpose

Extend the architecture across multiple nodes. Multiple ER engines
running on different GPUs, multiple CT engines running on different
machines, with the field shared across them through some mechanism
that respects SE-06's no-command-path commitment.

### Why this is far-out

Phase 5 opens algorithm 17's four open problems:

1. **Trust:** in a distributed system, how do nodes verify they are
   working on the same field rather than on diverged forks?
2. **Header consensus:** what minimal metadata must all nodes agree
   on for the field to be considered shared?
3. **Merge strategies:** when divergent updates from different
   nodes meet, how are they reconciled in a way that preserves
   reflexive scope and avoids reintroducing command paths?
4. **Convergence:** under what conditions can the distributed
   system be guaranteed to converge to a shared state, and what
   happens when those conditions don't hold?

These are research problems, not engineering problems. Each
requires structural work before implementation. The spec stack
does not currently address them.

### What Phase 5 is not

Phase 5 is not a deployment plan. It is an architectural extension
that would require new spec extensions (likely SE-07 through
SE-10, one per problem) before any code is written. Naming it here
is for completeness; the work is genuinely beyond the current
spec.

### Dependencies

Phase 4 complete. New spec extensions for the four problems. New
research that the current spec stack does not provide.

---

## 7. Order of work

The phases must happen in order. Each depends on the prior. Within
each phase, sub-tasks have orderings noted in the phase
descriptions. Two principles guide this ordering:

**Single-substrate before split.** Phase 1 verifies the grammar
holds in one substrate. Without this verification, splitting in
Phase 2 multiplies any single-substrate defect across two
substrates and makes the defect harder to diagnose.

**Verify before extend.** Phase 4 (coupling verification) precedes
Phase 5 (distribution) because distribution multiplies coupling
across nodes. Distribution before verification would compound
coupling defects across nodes.

This ordering produces a sequence where each phase's deliverable is
itself a stable artifact:

- Phase 1 deliverable: bootstrap-fresh-v2.html, runs in browser,
  exercises full single-substrate grammar
- Phase 2 deliverable: ER-engine-v1, runs in browser with WebGPU,
  resolves cascade in shaders
- Phase 3 deliverable: full SE-06 implementation, two engines
  coordinating through field via delta
- Phase 4 deliverable: verified two-engine system with passing
  stress tests
- Phase 5 deliverable: distributed system (research-pending)

A reader at any phase boundary has a stable artifact that
demonstrates the architecture at that phase's scope. The
architecture does not require all phases to be useful; each phase
produces something that runs and exhibits the spec's properties at
its scope.

---

## 8. What this path commits to and what it does not

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
- That intermediate phases fully reveal the architecture's
  potential (Phase 1 will be slower than Phase 2 because its
  substrate is wrong for parallel resolution; this is expected)
- That distribution (Phase 5) will be solved by this work; it is
  named for completeness, not as a commitment

---

## 9. What was the original ROADMAP and what changed

The original ROADMAP.md (from the bootstrap v1/v2/v3 track) had
eight steps, all single-substrate, with GPU integration as step 5
and parallel resolution as step 6. That sequence assumed
incremental enhancement of a single artifact.

The split changes this. After SE-06, the path is no longer
incremental enhancement; it is architectural restructuring at
Phase 2 (introducing the rendering substrate), Phase 3 (extracting
the execution substrate), and Phase 5 (distributing across nodes).
What was step 5 in the original (GPU integration) is now Phase 2,
and it is no longer additive but transformative: the runtime's
shape changes when the rendering substrate becomes native rather
than ornamental.

What was step 7 in the original ("co-constitutive execution-
rendering") is now Phase 3, and SE-06 makes its mechanism explicit
(coupling through delta, not through protocol).

What was step 8 in the original ("the full bootstrap") is now the
end of Phase 4, with Phase 5 as an optional further extension.

Steps 4 (trajectory-informed selection) is folded into Phase 1 (the
constraint-level operations that consume the trace). Steps that
made sense in the original incremental path no longer have
distinct identity in the split path because the split changes what
they would have been steps of.

The original ROADMAP.md is preserved as a historical document. It
is not the current path. This document supersedes it.

---

## 10. Reading this document

A reader returning to the project after the spec stack was
completed should be able to:

1. Read DEFINITION.md (with section 0.5)
2. Skim INVARIANTS.md to load the structural commitments
3. Read this document to understand where the work is and what
   comes next
4. Pick up at the current phase and proceed

The phases are bounded enough that one person can hold a phase in
mind at a time without needing to track the full architectural
context every step. The architectural context is in DEFINITION.md
and SE-06; the structural commitments are in INVARIANTS.md; the
operational form is in KERNEL.md. This document is the engineering
plan that runs alongside those.

When a phase reveals something the spec did not anticipate, the
correct response is:

1. Note the discovery in the implementation
2. Determine whether the discovery violates an invariant (refer to
   INVARIANTS.md)
3. If it violates an invariant, the implementation is wrong and
   should be revised toward the spec
4. If it does not violate an invariant but reveals a structural
   property the spec does not yet name, propose a new SE-N spec
   extension for that property
5. If the discovery is purely an implementation detail (a more
   efficient algorithm, a more elegant data structure), document
   it in the implementation but do not change the spec

This protects the spec stack's coherence while allowing
implementations to learn from each other.

## Version

IMPLEMENTATION_PATH.md v1.0. Pinned to DEFINITION.md v1.1 (with
section 0.5), KERNEL.md v1.0, INVARIANTS.md v1.0, PROJECT_SPLIT.md
v1.0, and SE-01 through SE-06. Supersedes the original ROADMAP.md.
Revisable when phases complete and reveal more.
