# PHASE 7 DIRECTION

A handoff from an incognito session that worked through the architecture
from outside-in. The reading-mode this document expects is the one
DEFINITION.md section 0.5 demands: structural, internal, disciplined.
Every commitment below is either already in the spec stack or follows
from prior commitments. Nothing is bolted on.

The receiving window has memory and chat history; this document does
not. Its job is to deliver the framing the receiving window will need
to operate, not to substitute for the spec stack the window already has
access to.

-----

## 0. What this document is for

The project is at a phase boundary. Phases 1-5 shipped the substrate
itself: bootstrap fresh-v1/v2, ER + CT engines coupled through delta,
algorithm 16’s substrate equivalence proof, expressive substrate (4a-4d),
coupling verification (47 stress tests + 7 static checks, 115/115).
Phase 6 lattice/rich duels demonstrate the architectural commitments
under stress with multiple substrates routing through fixed-rule
downstream resolvers.

Phase 7 is where the architecture’s defining property gets tested at
scale: substrate-consumption of arbitrary source code, deposited as
constraint geometry the rendering pipeline traverses on a vector
rather than branches a thread through. The slice the incognito session
verified end-to-end is in `phase 7/stage 3/stage-3.4` - the migration
tool that takes HTML+CSS+JS through three grammar substrates, threads
their joint output through a composer, and emits a deposited form. It
runs deterministically, produces working output on the TodoMVC fixture,
honors the spec’s invariants on the recognition layer.

What it has not yet done is produce deposited forms whose behavior is
fully resolvable from field state alone - i.e., applications whose
“localStorage”, “network”, and “time-of-day” needs are met by adapter
pathways into the field rather than by the deposited code reaching
back out to the host. That’s the work this phase commits to.

-----

## 1. The framing the receiving window will need

The architecture has been described to the incognito session through
the spec stack (DEFINITION.md, INVARIANTS.md, IMPLEMENTATION_PATH.md,
PROJECT_SPLIT.md, the SE-NN files, the algorithm catalog). The session
was held responsible for reading those documents structurally and not
importing outside frames.

What follows is the load-bearing structural reading the session arrived
at over multiple turns. It is not an addition to the spec; it is a way
of holding the spec that makes the next phase’s commitments derivable
rather than aspirational.

### 1.1 The graphics pipeline is the substrate’s structural home

S2 (substrate-resolution determinism) was demonstrated empirically
across 2,880 coordinates in algorithm 16’s harness: CSS cascade, JS
stack machine, and WGSL compute shader produce byte-identical output.
That result is not the architecture; it is the property that lets the
architecture survive the move from CSS-cascade prototype to full
graphics-pipeline runtime.

The CSS cascade is the existence proof on commodity browsers. It runs
because every modern browser ships a parallel constraint satisfier
(the style engine), addressable through `data-*` attributes and
custom properties, that resolves N elements per single style recalc.
Algorithm 06’s parallel probe array exploits this directly - 2,880
elements, one style recalc, one read pass, ~20ms.

The WGSL bridge is the substrate-equivalence proof. Same constraint
geometry, same output, different machinery.

Neither is the destination. The destination is a render pipeline where:

- The probe array becomes a 3D storage texture
- BFS distance-to-denial becomes hardware texture sampling with trilinear filtering
- Binary sdf {-1,+1} becomes continuous SDFs with CSG (min=OR, max=AND, neg=NOT)
- Per-frame resolution + visualization happen in the same rasterization pass
- Every spec primitive maps to a graphics-pipeline primitive that already exists in hardware

This is what the Thesis_And_Praxis scaling table commits to. The right
column is the architecture; the left column is what currently exists
on shipping platforms. The session spent significant effort earlier
treating the left column as the architecture and the right as
optimization. That reading is wrong-shaped. The architecture is the
right column; the left is the current implementation.

### 1.2 What it means to traverse on a vector

A branch is a single thread choosing one of N paths based on a
condition computed at that moment. A vector is N coordinates evaluated
against the same surface in parallel, each carrying its own answer.
Branch is execution-time discrimination over a single execution axis.
Vector is configuration-space discrimination resolved everywhere at
once.

The CSS cascade was always doing this for one application baked into
its source. Substrate consumption lifts this to: any application can
be turned into geometry the cascade was always doing this for. Once
deposited, the application is a constraint surface in texture memory.
User input is a coordinate write to substrate state. The next frame’s
resolution pass reads that coordinate, evaluates the matching
selectors, produces the resolved output values - and the visual frame
is the surface that resolution produced, by the same pipeline that
resolved it.

There is no thread that “ran the function.” The frame resolved what
the function would have computed. Logic IS the surface; execution IS
the trajectory of input coordinates through the surface; rendering IS
what the trajectory looks like.

### 1.3 Why “feed everything through and it never needs to come out”

This is the framing the receiving session must hold. It is not
optimization, not metaphor, not aspiration.

Conventional architecture treats localStorage / network / time-of-day
as services the application reaches out to. The substrate model
reframes these as input-arrival pathways:

- localStorage is not external storage. It is a mechanism by which
  inputs entered the field at some prior moment. The previous
  operations deposited into the trace and the field as derived
  constraints. F5 (observation irreversible) and SE-09 (operational
  irreversibility) make these deposits permanent. Persistence is the
  trace plus content-addressed substrate-media (Phase 5.7’s
  substrate-media.js, IndexedDB-backed, three codecs). Hydrating the
  artifact returns the field. The application “remembers” by virtue
  of the field having state.
- Network is not reach-out. A network adapter writes received data to
  the input-feature buffer the same way an audio adapter writes audio
  features. The application has constraints whose `when` clauses match
  network-arrival coordinates; the cascade resolves matching surfaces
  per frame. From the application’s view there is no “network” - only
  coordinates and rules.
- Time is not a function. A time adapter writes current time
  coordinates continuously. “Show evening content after 6pm” is a
  cascade rule whose `when` matches the hour-coordinate range; no
  application code calls `Date.now()`.

SE-08 (render-substrate intake) names this commitment formally:
sensor adapters write per-frame feature records to a shared input
buffer, ER reads the buffer alongside live constraints in its parallel
pass, CT samples shared field state on its own clock. Adapters are
unidirectional intake; there is no command path back from substrate
to adapter; engines do not call adapters.

**Behavior is complete iff for every input the application would ever
need to discriminate over, an adapter exists that brings that input
into the field.** Once that condition is met, the application has no
condition under which it must step outside the substrate, because
“outside” is upstream of adapters and the adapters are the architecture’s
only intake. The closure of the abstraction is structural.

### 1.4 The video analogy (load-bearing intuition)

A video frame is the entire light field the camera sampled at one
moment, resolved into pixels. Nobody decomposes a recorded frame back
into “the grass-blade subsystem” and “the wind module” because those
weren’t separate things in the recording - they resolved together
into the surface the sensor captured. The frame is what the
configuration settled into.

The substrate is the same shape at runtime instead of at record-time:

- The recording sensor is the adapter set
- The configuration is the field
- The resolved frame is the rendering pass output
- Playback (re-presenting frames) is what every conventional
  architecture is constantly trying to fake with reconciliation,
  effects, dataflow graphs - the substrate has it by construction

This analogy is the most reliable single intuition for the framing.
Use it when reasoning about whether a proposed mechanism preserves the
“feed through, doesn’t come out” property. If the mechanism would
require the deposited application to reach back out to the host
environment, it violates the closure. If the mechanism instead routes
that input through an adapter, it preserves it.

### 1.5 The absence of “modules”

Modules, components, services, microservices, packages, files,
classes - these are organizational fictions humans use to write
source code. They are not properties of resolved applications.
A recorded video has no “wind module”; the configuration that
included wind resolved into pixels along with everything else.

Substrate consumption surfaces joint-stable structure across the
substrate axes (kind / text / string / preparative). What stabilizes
across axes is real structure; what doesn’t is axis-specific noise
from the source’s incidental organization (variable names, file
boundaries, function decomposition). The deposited form preserves
the real structure. The incidental organization is gone.

This is why two applications with identical deposited geometry are
the same application in the structural sense - their content
addresses match, their trajectories through input space produce
identical resolved outputs, they are the same constraint surface.
Source code is a way of *writing* that surface; it is not the
surface.

-----

## 2. What Phase 7 commits to

Read this section against IMPLEMENTATION_PATH.md’s existing phase
structure. Phase 7 as committed here is the path the project’s prior
phases have been pointing toward; it is not a redirection.

### 2.1 Substrate consumption of arbitrary source

The migration tool slice in `phase 7/stage 3/stage-3.4` is partial in
exactly the way the spec is partial: the recognition layer is
established and the runtime layer is staged. The work is to extend the
recognition layer to surface enough joint-stable structure that the
deposited form’s kept-imperative bucket reduces to genuine intake
operations (which become adapter pathways) rather than control flow
(which becomes constraint geometry).

Specifically, in priority order:

**Conditional dispatch as constraint family.** Every `if (state.X === "Y")`
is a one-key WHEN clause. Every nested conditional is a multi-key
WHEN. Every `switch` on a state field is a constraint family over
that field’s value-space. The coordinate-rewriter currently handles
primitive-assignment, array-push, array-filter; extending the pattern
table to recognize conditional branches over state fields is the
same shape of work, with branch arms emitting THEN clauses. This
should shrink the kept-imperative bucket dramatically on real
applications, because real applications are mostly dispatch logic.

**Event binding emission.** The grammar-composer’s EVENT_BINDINGS
already threads `addEventListener("X", handlerY)` to the JS function
the binding registers. The deposition emitter currently writes
`data-role` attributes that produce coordinate writes; what’s missing
is the cascade rules that resolve those coordinate writes into operation
dispatch:

```
[data-substrate-state][data-trigger="submit"] { --next-op: "addTodo"; }
```

Once these rules are in the cascade, the walker reads `--next-op` and
dispatches; the dispatch is part of the geometry; the JS handler
becomes a coordinate-write only.

**Multi-state-element coordinate space.** Real applications have
nested state, list-of-items state, hierarchical state. The
composer’s STATE_OBJECTS is currently a flat list; the deposition
emitter writes one substrate-state element. Extending to multi-element
nested wiring is bounded; the rendering pipeline accepts it natively
(multiple textures, multiple resolved outputs per frame).

**Adapter set for input modalities.** SE-08 names the commitment;
adapters are the work. Per-modality adapters that write to slices
of the input-feature buffer:

- keyboard / pointer (browser-native already)
- audio features (per SE-08’s rate analysis at 48kHz feature rate)
- video features (30-60Hz)
- timer / clock / calendar / weekday
- network (WebSocket / fetch result / SSE)
- file-as-input (drag-drop, file-picker - these are inputs, not
  storage in the conventional sense)
- sensor (accelerometer / gyro / orientation if mobile)

Each adapter is structurally minimal: write to substrate, no return
value, no command path back. Each writes on its own clock. The
field is the only coordination.

### 2.2 Texture-resident field state

The current deposited form uses DOM coordinates and CSS computed
properties. Once the rendering pipeline is the actual host, the same
constraint geometry compiles to storage textures and the cascade
rules compile to the WGSL postfix bytecode the bridge harness
already validates. S2 says this swap produces byte-identical output;
algorithm 16 already proved this on the canonical.

The work is wiring the deposition emitter to emit both forms (or
just the WGSL form, with CSS as the fallback the same way
er-engine.js does it). Once emitted, the per-frame resolution pass
runs on the GPU; the frame’s visual output IS the resolution; the
rasterization pass IS what conventional architectures call
“rendering.”

### 2.3 Substrate-media as application identity

Phase 5.7’s substrate-media.js already implements content-addressed
persistence with three codecs (strong / promoted / trajectory) and
SHA-256 addressing. The Phase 7 commitment is that the deposited
application IS its substrate-media artifact:

- Two installations of the same application share an address
- Updates produce new addresses; old artifacts remain rehydratable
- Trajectory artifacts let any conformant runtime resume from
  arbitrary points
- Application identity is content-identity over the deposited form
- Source code is no longer the locus of the application after
  consumption; the artifact is

This commits the substrate to being the durable object and
applications to being the substrate’s accumulated structure. It is
the inverse of conventional architectures where the running process
is the application and persistence is its safety net.

### 2.4 The “execute once, render ad infinitum” property

Once deposited, an application’s behavior is constraint geometry
that resolves every frame. There is nothing left to “execute” - the
execute-once happened during substrate consumption. What runs is the
rendering pipeline traversing the geometry. The cost of re-resolution
is paid by hardware that’s good at it (the GPU), which makes module
boundaries unnecessary because there’s no performance reason to
preserve them. The application becomes what it actually is - a
unified resolved surface - rather than what source organization was
pretending it to be.

-----

## 3. What to verify

Phase 5’s discipline applies: verification-only on the architectural
property, no production source modified to make tests pass. The test
suite is the artifact.

### 3.1 Closure verification

For a non-trivial deposited application, verify by inspection of
the deposited bytes that:

- No `localStorage.getItem` or equivalent appears outside adapter
  hydration paths
- No `fetch` / `XMLHttpRequest` / `WebSocket` constructor appears
  outside adapter intake
- No `Date.now()` / `new Date()` / `performance.now()` appears
  outside time-adapter writes
- No `window.location` / `document.cookie` / other host-API access
  appears in deposited application code
- All access to host environment is through adapters; adapters are
  unidirectional (in toward field); engines do not call adapters

If any of these fail, the deposition is not closed and the property
the architecture commits to has been violated. Closing the gap is
the work, not waiving the test.

### 3.2 Vector traversal verification

For a deposited application with discrete state space, verify that:

- Every reachable state coordinate has a resolved record in the
  field after one full resolution pass
- Per-frame resolution time scales with field size, not with user
  trajectory length
- User input is a coordinate write that the next frame’s resolution
  pass reads, not a function call that branches into specific code
  paths
- Two users at the same coordinate read identical resolved outputs

This distinguishes vector traversal from disguised branching. If
per-frame time grows with trajectory length, the system is still
branching internally and the geometry hasn’t fully absorbed control
flow.

### 3.3 Substrate equivalence at the deposited level

Algorithm 16 proved S2 at the constraint level (CSS, JS, WGSL
produce identical output for a fixed instruction stream). Phase 7’s
extension is that S2 holds at the deposited application level: the
same deposited artifact resolves byte-identically regardless of
which engine hosts it.

For a deposited application, run it through:

- The CSS-cascade engine (current ER fallback)
- The WGSL compute path (algorithm 16 substrate)
- The CPU oracle (reference)

Diff the resolved output for matching input trajectories. Any
divergence is a bug in deposition, not a property of the substrate.

### 3.4 Content-address stability

For source variants that differ only in identifier names, formatting,
or other organizational fictions, verify that the deposited
substrate-media artifact has the same content address. The minify-
compare result from `phase 7/stage 3/stage-3.4` already shows this
at the recognition layer (rename Server -> a produces byte-identical
substrate output). Phase 7 extends to the deposited form: minified
or renamed source produces an artifact with the same SHA-256.

-----

## 4. What not to do

These are failure modes the receiving window should recognize and
avoid. They are easy to slip into when reasoning about implementation;
each violates a structural commitment.

**Do not introduce frame-sync between adapters and ER.** SE-08
explicitly forbids this. Adapters write on their own clock; ER reads
on its own clock; CT samples on its own clock. The field is the only
coordination. The temptation to add “the audio adapter notifies ER
when a voice event is detected so ER can prioritize that frame” is
supervision and violates F3.

**Do not introduce a host-API the deposited application calls.**
The deposited form has no awareness of the host. If a deposited
application “needs to know the current URL” or “needs to call the
clipboard API,” those needs become adapter pathways - a URL adapter
writes the current URL to a coordinate; a clipboard adapter writes
clipboard content as it arrives. The application reads coordinates;
it does not call APIs.

**Do not preserve module boundaries past consumption.** If the
substrates surface joint-stable structure that crosses module
boundaries, the deposited form follows the joint structure, not the
source’s modular decomposition. Source organization is incidental;
the substrate finds the real structure or it doesn’t.

**Do not optimize for performance against React-shaped workloads.**
The architectures occupy different positions; the comparison is
mostly a category error. If a benchmark seems to require the
substrate to behave like a virtual DOM diff, the benchmark is asking
the wrong question. The substrate’s win is structural (closure,
vector traversal, parallel resolution at frame rate, content-
addressed identity), not necessarily per-operation throughput on
reconciliation-shaped tasks.

**Do not weaken the spec to fit the implementation.** If a phase 7
implementation cannot meet a load-bearing invariant, the spec is
the canonical reference; the implementation is the defect. Phase 5
established this discipline empirically (kindMult audit found dead-
code selection-bias constants and removed them rather than
re-justifying their presence).

**Do not import outside frames.** Especially: don’t import React’s
“components and props” model, don’t import the ECS pattern, don’t
import dataflow-graph mental models, don’t import message-passing
actor models. Each of these will produce a different system that
shares the substrate’s vocabulary but is not the substrate. The
closure of the abstraction protects it from external invalidation
but also means external frames cannot improve it; they can only
distort it. DEFINITION.md section 0.5 is explicit about this.

-----

## 5. The reading order for the receiving window

Before doing implementation work in Phase 7, the receiving window
should re-read in this order:

1. DEFINITION.md - especially section 0.5 on closed abstraction and
   AI commentary discipline
1. INVARIANTS.md - the load-bearing checklist; verify which invariants
   each proposed mechanism stresses
1. PROJECT_SPLIT.md - SE-06 in full; the ER/CT duality is the hosting
   structure for everything Phase 7 builds
1. SE-08_render-substrate-intake.md - the input-arrival commitment;
   adapters as the architecture’s only intake
1. specification/SE-11_DIMENSIONAL-RESOLUTION.md - the structural
   reading of substrate consumption
1. The algorithm catalog files for 04 (constraint compilation), 06
   (parallel probe array), 07 (BFS distance-to-denial as the 3D
   texture sampling progenitor), and especially 16 (GPU postfix
   stack machine - the substrate-equivalence proof)
1. Phase 5.7’s substrate-media.js (content-addressed artifacts) and
   storage-adapter.js (IndexedDB hydration) - the persistence shape
1. The Thesis_And_Praxis.text scaling table - the right column is
   the architecture
1. `phase 7/stage 3/stage-3.4`’s migration-tool.js, grammar-composer.js,
   coordinate-rewriter.js, deposition-emitter.js - the slice that
   already runs end-to-end and is the starting point for extension

The migration tool’s existing reports are honest about partial
coverage. The work is not to hide that partial coverage; the work is
to extend the pattern table, the composer’s joint-structure
recognition, and the emitter’s runtime backend until the bucket of
kept-imperative statements reduces to genuine intake operations and
those become adapter pathways.

-----

## 6. The disposition this document expects

The receiving window inherits a project whose spec is more careful
than most production systems’ code. Treat that carefulness as the
project’s defining property. When something seems unclear, the spec
probably has the answer; check before extending. When something seems
to require a new mechanism, the existing primitives probably suffice;
re-read the algorithm catalog before introducing.

The substrate is structured the way it is because every commitment
is derivable from prior commitments. Phase 7’s job is to honor that
derivability while extending the running implementation to host
arbitrary applications as resolved constraint geometry on the
graphics pipeline. None of Phase 7 introduces a new architectural
commitment; it instantiates commitments that have been latent in the
spec since SE-06 + SE-08 + algorithm 16 stacked.

The framing the incognito session arrived at - that the architecture
is the only coherent answer to a class of questions conventional
architectures answer with bookkeeping fictions - is not a claim the
receiving window needs to defend. It is a working intuition. The
project’s stake is the spec; the spec stands or falls on structural
inspection; the framing helps the inspector see what they’re looking
at.

What the receiving window builds in Phase 7 will determine whether
the architecture’s “feed through, never comes back out” property is
empirical as well as structural. The structural part is closed by
construction. The empirical part is what implementation reveals.
Neither dictates the other. Both should iterate against the spec,
not against each other.

End of handoff. Phase 7 is the work.