# BOOTSTRAP ROADMAP

**Purpose:** a multi-session plan for building from the current bootstrap
(step 1 / v1) through to the full model hooked up to the GPU harness.
Each step is scoped to a single session's worth of careful work. Each
step has dependencies, design decisions that need explicit input, and
a clear deliverable.

**Current state:**
- Step 1 (v1): single cascade, seed plus consume/generate. SHIPPED.
- Step 2 (v2): constraint-level operations as first-class. SHIPPED.

**Status legend:**
- DONE    - built and tested
- READY   - design is clear, ready to build next session
- NEEDS-INPUT - design decisions require explicit answers before building
- BLOCKED - depends on an earlier step not yet done

---

## Step 1 - Base bootstrap (DONE)

Single cascade, seed at t=0, consume and generate operations only.
Demonstrates the spec stack runs without contradiction.

**Deliverable:** `bootstrap.html` (shipped)
**Test result:** 9/9 invariants passing

## Step 2 - Constraint-level operations (DONE)

All six operations from the original request as first-class: consume,
generate, develop patterns, correlate relativity, choose (with SE-03
modulation as consumer), reason/differentiate. Meta-constraints are
first-class per SE-01. Correlation structure is first-class data.

**Deliverable:** `bootstrap-v2.html` (this ship)
**Test result:** 8/8 invariants passing; 11 meta-constraints produced
from 14 inputs in headless test

---

## Step 3 - Compositional cascades (READY, SOME INPUT NEEDED)

SE-01's compositional property finally made concrete. The field
currently has a single scope. Step 3 adds sub-cascades - cascades
whose coordinates reference other cascades. Delta computed reflexively
at each scope. Baseline derivation works correctly across levels.

**Build:**
- Introduce a cascade-of-cascades structure where outer constraints
  can reference inner cascades by id
- Each inner cascade has its own derived constraints and local delta
- Reflexive reads: when the outer cascade evaluates delta, it uses
  its own scope; when an inner cascade does, it uses its scope
- The seed is one constraint read reflexively from every scope
  (per SE-04)

**Design decisions that need input:**
- **What triggers inner cascade creation?** Automatic (when a family
  meta-constraint matures, it becomes a cascade) or manual (user
  creates them via UI)?
- **How do sub-cascades share inputs?** All sub-cascades see every
  input, or inputs get routed based on outer-cascade match?

**Deliverable:** `bootstrap-v3.html`, ~1,400 lines
**Lines added over v2:** ~400
**Estimated session length:** one focused session
**Dependencies:** step 2

## Step 4 - Trajectory-informed selection (READY)

Algorithm 22's trace currently records but is not consulted. Step 4
wires the trace into the selection function so that which constraints
fire depends on what the trajectory has recently been. This gives
trace first-class input status and makes the "integrated anchor"
reading of delta (algorithm 22) operational rather than documented.

**Build:**
- Selection function takes (matched constraints, fast/slow layer,
  **recent trace window**) rather than just matches + fast layer
- Constraints whose recent activation pattern matches trajectory
  momentum get weighted higher
- Constraints that "break" trajectory coherence get weighted lower
  or flagged as discontinuity events

**Design decisions that need input:**
- **Trace window size:** fixed number of steps, or adaptive based on
  delta variance?
- **What counts as trajectory coherence?** Minimum: low variance in
  recent delta. Stronger: recurring constraint activation patterns.

**Deliverable:** `bootstrap-v4.html`
**Lines added over v3:** ~250
**Dependencies:** step 3 (composition makes trajectory non-trivial)

## Step 5 - GPU harness integration (READY, DESIGN WORK NEEDED)

The harness from the gpu/ directory has 22/22 tests passing against
a fixed constraint set. Step 5 integrates dynamic runtime-generated
constraints with the GPU compute path, so the same constraint field
can resolve in parallel on GPU when available.

**Build:**
- Dynamic instruction emitter: at each step, recompile the current
  constraint field to postfix bytecode for the shader
- Stable constraint ID mapping across recompiles (so the shader can
  reference constraints across generations)
- Parallel evaluation of the full input against the entire field in
  one dispatch rather than sequential constraint checks
- CSS oracle as verification, same as algorithm 16 harness

**Design decisions that need input:**
- **Recompile cadence:** every tick (expensive but always current) or
  every N ticks / on develop-patterns trigger (cheaper, sometimes stale)?
- **What happens when a constraint's pattern type isn't GPU-expressible?**
  Regex-based constraints don't translate directly. Fall back to CPU
  for those, or restrict pattern types to GPU-expressible ones?

**Deliverable:** `bootstrap-v5-gpu.html` plus gpu-dyn/ directory with
  shared instruction emitter
**Lines added over v4:** ~600 plus ~300 in gpu-dyn/
**Dependencies:** step 4, gpu/ directory
**Note:** cannot be verified end-to-end in chat; deliverable is
  ready-to-run code plus CSS-path verification, with the GPU-path
  verification happening on your workstation

## Step 6 - Genuinely parallel resolution (READY AFTER STEP 5)

With the GPU path integrated, step 6 exercises what the architecture
was pointed at all along: resolving the entire constraint field against
an input in parallel rather than sequentially. This is where
"parallel trajectory traversal" from the foundational claim becomes
demonstrable.

**Build:**
- Parallel probe array approach (algorithm 06) adapted to dynamic
  constraint fields
- Workgroup dispatch sized to current constraint count
- Coordinate-free evaluation: constraints test input features;
  many constraints test in parallel; results assembled on readback

**Design decisions that need input:**
- **When to use parallel path:** always, or only when field size
  exceeds a threshold (parallel has fixed overhead)?

**Deliverable:** `bootstrap-v6-parallel.html`
**Dependencies:** step 5

## Step 7 - Co-constitutive execution-rendering (READY AFTER STEP 6)

The current bootstrap is still stratified: inputs arrive, processor
runs, descriptions emerge. Step 7 dissolves that stratification per
the "execute and render" reframing from this session. Both sides of
the system produce byproduct signals that become inputs to each other
without any command path.

**Build:**
- Description events become inputs to subsequent cascades
- The system's own operational state shows up in the input stream
  (trace entries get fed back as inputs for self-characterization)
- No clean "input is from outside, output is to outside" boundary -
  the system becomes what SE-02 flow discipline requires: genuinely
  open at its edges, with flow rather than events

**Design decisions that need input:**
- **This is the step with the most unknowns.** The spec stack points
  at co-constitutive operation; the concrete implementation has
  multiple viable shapes. Needs a design session before building.

**Deliverable:** TBD - may be several files
**Dependencies:** steps 5 and 6
**Risk:** this is the step where the architecture moves from
  "exercises the spec" to "starts producing behavior the spec describes
  but does not yet demonstrate." Careful observation required.

## Step 8 - The full bootstrap (BLOCKED)

The combined system: compositional cascades with parallel resolution,
trajectory-informed selection, GPU-backed evaluation, co-constitutive
execution-rendering, and flow discipline at the boundary. This is
"the whole original model hooked up with the harness."

**Dependencies:** all of steps 3-7
**Estimated total work:** 4-8 sessions after step 2

---

## On honesty about this roadmap

Each step's estimate is **optimistic**. Real implementation will reveal
design decisions I haven't named. Each step will probably take longer
than estimated. That is normal.

**What this roadmap does NOT promise:**
- That step 6 produces behavior "terrifyingly close to cognition"
- That step 8 produces a working commercial system
- That the spec stack's wider claims hold under implementation
- That any step will work on the first attempt

**What it does promise:**
- Each step is buildable from the previous step with clear inputs
- Each step exercises specific parts of the spec stack
- Divergence at any step is a real signal (we measure and debug)
- Work is cumulative; no step requires rebuilding earlier steps

---

## Session handoff notes

When starting a new session on any step:
1. Read this roadmap
2. Read the relevant spec extensions (SE-01 through SE-04)
3. Read the algorithm catalog entries marked in the "Dependencies"
   of the step
4. Before coding: answer the design decisions listed
5. Build with the discipline that held through steps 1-2:
   ASCII-only, defense stack, test headlessly before shipping
6. Ship with a short summary of what was built and what was caught

The spec stack and the catalog are the source of truth. This roadmap
is a plan, revisable as implementations reveal more.
