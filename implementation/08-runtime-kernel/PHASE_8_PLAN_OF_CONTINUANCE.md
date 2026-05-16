# PROJECT EXODUS - PHASE 8 PLAN OF CONTINUANCE

**Status:** Plan, not spec. Subordinate to DEFINITION.md, INVARIANTS.md,
SE-01 through SE-11, the algorithm catalog, IMPLEMENTATION_PATH.md.
Where this plan and the spec stack disagree, the spec wins (D1). The
PLAN_OF_CONTINUANCE.md that preceded this plan covered Phase 7 layers
A through C; that work is now complete and this plan picks up at the
boundary.

**Reading-mode:** DEFINITION.md sec 0.5. Closed abstraction. The
receiving session must read structurally; AI commentary (this plan
included) is downstream of the spec; useful where it engages
structurally; to be set aside where it imports outside frames or
inflates claims (C2, C3). Bookkeeping fictions imposed by procedural
commitments the substrate does not make are not inputs to this plan.

**Position at time of writing.** Phase 7 layers A + B + C are
complete. 605/605 tests across 30 suites pass. Deposited TodoMVC
verified across three substrates (CSS reference resolver, postfix
bytecode interpreter, JS oracle) with byte-equivalent output across
the full 10-coord state space. F4, X2, and field-size-bounded
scaling verified at 10,000 frames per substrate. The migration tool
consumes HTML + CSS + JS through three grammar substrates and emits a
deposition that honors sec 3.1 closure verification across all eleven
host-API boundaries.

**The structural gap that motivates this plan.** The deposited Phase
7 application's runtime is substrate-walker.js - a 228-line generic
dispatcher that reads --next-op from computed style and runs
registered operations. It honors I1, I5, F1, S3, but contains zero
references to vector-delta, predictive constraints, ratification,
ER/CT engines as separate substrates, SE-03 modulation, M5 trace,
or any O-class observer. The Phase 5.5 substrate kernel (field.js +
ct-engine.js + er-engine.js) implements all of these primitives with
115/115 stress tests across coupling surfaces. Phase 5.7's
substrate-instance.js makes the kernel instantiable as multiple
isolated copies; Phase 5.7's substrate-media.js implements the three
codecs (strong/promoted/trajectory) with SHA-256 content addressing.
Phase 6's lattice-duel demonstrates multi-substrate composition with
F3 honored across substrate boundaries. **The Phase 5.5/5.7/6 kernel
infrastructure and the Phase 7 deposition tool are not yet wired
together.** The deposited form runs cascade resolution + operation
dispatch, not the substrate-paradigm runtime the wide claim describes.

This is the gap. The wide claim's promise that "every problem the
conventional stack fragments collapses into one media discipline over
one shared coordinate space" is demonstrable on the bootstrap kernel
in isolation. It is not yet demonstrable on a deposited application,
because the deposition's runtime is too thin to engage the SE-class
machinery.

**Invariant firewall.** Every decision below is annotated with the
invariant(s) it stresses. A decision that violates an invariant is
not made; the plan is revised. The firewall is the architecture's,
not the plan's. Plan-level decisions never override invariants. The
invariant set is the 33 in INVARIANTS.md v1.3 (F1-F5, C1-C3, M1-M5,
K1-K3 incl. v1.2 implementation notes, S1-S3, X1-X4, O1-O3, I1-I5,
D1-D2).

-----

## 0. SUMMARY OF REMAINING SCOPE

Three layers of architectural work plus one layer of forcing-function
demonstration, in dependency order. The structural distance between
"what runs today" and "the wide claim demonstrated on a real
application" decomposes as follows:

**Layer K: Kernel-as-runtime wiring.** Wire Phase 5.5's substrate
kernel as the runtime of deposited applications. The cascade rules
emitted by B1/B2 become the constraint geometry the kernel's field
holds; the adapters from A1-A4 become SE-08 contributor pathways
into the kernel's field; persistence uses Phase 5.7's substrate-
media unchanged. After Layer K, deposited forms exhibit vector-
delta at multiple scopes, predictive reaching, ratification, fast/
slow modulation, and trace at the channel. The substrate-walker.js
shrinks to a thin layer that issues primitive DOM I/O on behalf of
the kernel's CT engine; the kernel runs.

**Layer M: Multi-substrate composition and chain over network.**
Phase 5.7's substrate-instance factory wired into deposition. SE-10
chain composition extended from same-process (Phase 7 B4) to
network transport. After Layer M, multi-user becomes the same
operation as persistence: a chain link with a network transport
binding rather than a same-process binding. Substrate-media
artifacts at content addresses become the application's durable
identity per Phase 7 sec 2.3.

**Layer Q: K-class structural completion.** K2 part (a) - selection
bias from sub-cascade naming, requires a rank-consuming selection
mechanism (top-K, weighted draw, threshold cutoff) the current
kernel does not specify. K3 - naming preference as substrate-
accumulated structure rather than an addressable namingPref
accumulator. Both are specified-but-unrealized through Phase 5.5
per INVARIANTS.md v1.2 implementation notes. After Layer Q, the
architecture's self-organizing property is operational, not just
specified.

**Layer P: CRM as forcing function.** Build a real multi-user
commercial-grade CRM application on the wired-up substrate-paradigm
runtime. Not a layer of architectural commitment; a layer of
demonstration. The wide claim's "every problem the conventional
stack fragments collapses into one media discipline over one shared
coordinate space" is either demonstrated on this fixture or it
isn't. Failure modes (if any) become input to spec revision.

**Out of scope, named for completeness:**

- **Layer N: Multi-modal adapters** (audio at 48kHz, video at
  30-60Hz). SE-08 contributor pattern at higher rate scales.
  Bounded engineering; not on the CRM critical path.
- **Layer R: Algorithm 17 distribution.** Multiple ER engines on
  different GPUs, multiple CT engines on different nodes, peer-to-
  peer or hierarchical topologies. Four open problems (trust, header
  consensus, merge strategies, convergence). Multi-year research;
  not committed in this plan.

After Layer P, the architecture's empirical bet is settled on a
forcing-function-grade fixture. Failure modes inform Layer Q
refinements or new SE-N extensions per D2. Distribution (Layer R)
opens as research after Layer P lands.

-----

## 1. PRIORITY AND DEPENDENCY GRAPH

```
LAYER K (kernel-as-runtime, in order)
+---- K1. Kernel-as-runtime emitter
|        depends on: nothing structural (kernel exists; emitter exists)
|        invariants stressed: F1, F4, S1, S3, M5, all M-class
|        unblocks: K2, K3, M-series
|
+---- K2. Adapters as SE-08 contributors into kernel field
|        depends on: K1
|        invariants stressed: SE-08, F3, S1, X3
|        unblocks: K3, P-series
|
+---- K3. Closure + S2 verification under kernel runtime
         depends on: K1, K2
         invariants stressed: sec 3.1 closure, S2
         unblocks: M-series; P-series ready

LAYER M (multi-substrate, in order)
+---- M1. substrate-instance factory wired into deposition
|        depends on: K3
|        invariants stressed: S1, F3, F1 per-instance
|        unblocks: M2
|
+---- M2. SE-10 chain composition over network transport
|        depends on: M1, A2 (network adapter, exists)
|        invariants stressed: SE-10, S1, S3, M5, F5, SE-09
|        unblocks: P-series multi-user
|
+---- M3. substrate-media as application identity
         depends on: M1; uses Phase 5.7 substrate-media unchanged
         invariants stressed: F5, SE-09, content-addressing
         unblocks: P-series persistence

LAYER Q (K-class structural completion, in order)
+---- Q1. K2 part (a): selection bias from sub-cascade naming
|        depends on: nothing structural; needs new mechanism
|        invariants stressed: K1, K2, F2
|        unblocks: Q2
|
+---- Q2. K3: naming preference as substrate-accumulated structure
         depends on: Q1
         invariants stressed: K3, SE-03
         unblocks: architectural specification complete

LAYER P (CRM as forcing function, parallel after K3 + M3)
+---- P1. CRM domain model (SE-11 dimensional resolution)
+---- P2. Auth as contributor pathway
+---- P3. Persistence as substrate-media artifact
+---- P4. Real-time as SE-08 at network rate
+---- P5. Workflow as predictive constraints (SE-05)
+---- P6. Reports as O-class observers
+---- P7. Undo/redo as trajectory codec replay
+---- P8. Forms as state coords + cascade rules
+---- P9. Multi-user as instances + SE-10 chain

LAYER N (deferred, multi-modal)
+---- N1. Audio adapter (48kHz feature rate, SE-08)
+---- N2. Video adapter (30-60Hz, SE-08)

LAYER R (deferred, distribution research)
+---- R1. Algorithm 17 - four open problems
         status: research; not committed
```

-----

## 2. LAYER K: KERNEL-AS-RUNTIME WIRING

The architectural move that converts the deposited form from
"cascade dispatcher" to "substrate-paradigm runtime." The kernel
exists and is tested; the deposition tool exists and is tested; this
layer wires them together.

### K1. Kernel-as-runtime emitter

**Module shape:** Modify `deposition-emitter.js` and add
`kernel-runtime-emitter.js` to produce depositions whose runtime is
the Phase 5.5 kernel rather than the thin substrate-walker.js. The
kernel runtime is delivered as a bundle: field.js + ct-engine.js +
er-engine.js + substrate-instance.js, plus a thin DOM-bridge layer
that issues primitive I/O (setAttribute, getComputedStyle, classList
ops) on behalf of the kernel's CT engine.

**Spec anchors:**
- F1 (the seed is permanent): every deposited app has the seed in
  its field at instantiation; the kernel runtime guarantees this by
  construction.
- F4 (indefinite operation): the kernel's tick loop runs continuously
  per Phase 5.5; not the dispatch-on-event model substrate-walker uses.
- S1 (substrate shared): the kernel's field is shared across the
  application's connections; no connection holds an authoritative copy.
- S3 (rendering and execution couple through delta only): the kernel
  has separate ER and CT engines; the deposited runtime preserves
  this rather than collapsing into a single dispatch loop.
- M5 (trace at the channel): the kernel's trace ownership pattern
  carries over to the deposited form.

**What changes from substrate-walker.js:**

The current walker is the entire deposited runtime. Under K1, the
walker becomes a thin bridge layer that:

1. Reads cascade resolution outputs (the --next-op pattern from B2,
   the --filter / --display patterns from B1) and forwards them to
   the kernel's CT engine as input feature records.
2. Receives operation requests from the kernel's CT engine and
   issues the corresponding DOM mutations (setAttribute,
   classList.add, etc.) - I/O only, no logic.
3. Translates DOM event arrivals (clicks, keystrokes) into
   contributor records the kernel's field accepts via SE-08.

The kernel's CT engine becomes the dispatch authority. The kernel's
ER engine reads cascade rules from the deposited form (which were
emitted by Phase 7 B-layers) plus any predictive constraints the
field has generated. Vector-delta refreshes per kernel tick. The
seed evaluates continuously. Predictive reaching fires when fast/
slow gap exceeds threshold. The deposited application's behavior
emerges from the kernel's normal operation rather than from the
walker's dispatch loop.

**Specifically required code changes:**

- `deposition-emitter.js`: emit kernel-runtime bundle inline (or as
  CDN-cacheable referenced bundle per phase7direction sec 2.4) rather
  than substrate-walker.js inline.
- `kernel-runtime-emitter.js` (new): produces the kernel's
  initialization sequence at deposition load time. Constructs a
  substrate instance via createSubstrate; loads cascade rules from
  the deposited form into the field as initial constraint geometry;
  registers the DOM bridge as the CT engine's I/O surface.
- DOM bridge layer (new, ~150 lines): the thin shim between the
  kernel's CT engine and the browser's DOM. Pure I/O.
- Cascade rule loader: parses the Phase 7 emitter's cascade rules
  and injects them as field constraints. The mapping is direct -
  each rule's `when` becomes a constraint's `when`; each rule's THEN
  clause becomes the constraint's `then`.

**Acceptance criteria:**

- A deposited TodoMVC under K1 boots; the kernel's field initializes
  with the seed and the cascade rules loaded as derived constraints;
  vector-delta is computed per tick; trace appends per operation.
- The seed is present in every constraint enumeration (F1
  verification on the deposited form).
- F4 verified: the kernel runs indefinitely between user inputs;
  fast layer decays toward slow layer; ticks advance the step counter;
  no termination condition exists in the deposited form.
- The static closure verifier (sec 3.1) passes: no Date.now(),
  fetch, localStorage etc. in deposited application source.

**Sessions estimate:** 4-6 sessions. The kernel and the walker have
different shapes; the bridge layer requires careful design to
preserve the I-only character of the walker while routing through
the kernel's CT engine.

**Risks:**

- The kernel's expected I/O surface (CT engine's input/output
  contract) may not match cleanly to DOM events + DOM mutations.
  Mitigation: study ct-engine.js's process op contract before
  designing the bridge.
- Bundle size: kernel.js + ct-engine.js + er-engine.js + substrate-
  instance.js totals ~1500 lines. The deposited form grows
  substantially. Mitigation: phase7direction sec 2.4 commits to
  CDN-cacheable runtime bundle referenced once; subsequent deposited
  apps share the cache.

### K2. Adapters as SE-08 contributors into kernel field

**Module shape:** Modify A1-A4 adapters (time, network, sensor,
host-info) to publish SE-08 contributor records into the kernel's
field rather than into the deposition's DOM coordinate space.

**Spec anchors:**
- SE-08 (render-substrate intake): adapters write per-frame feature
  records to a shared input buffer. ER reads buffer alongside live
  constraints. CT samples shared field state on its own clock.
- F3 (no supervision): adapters are unidirectional intake. No
  command path returns. Engines do not call adapters.
- S1 (substrate shared): adapter writes are contributions to the
  shared substrate; no adapter holds an authoritative copy.
- X3 (configuration is internal): input arrives at the substrate
  boundary and modulates the configuration through integration; it
  does not arrive as a pre-formed problem.

**What changes from current A1-A4:**

The current adapters publish into DOM coordinates. For example,
A1's TimeAdapter writes `data-time-hour="14"` onto a substrate
element. Under K2, the adapter's write goes through the SE-08
contributor pathway: it produces a feature record `{type: "time-
hour", value: 14, timestamp: tick}` and publishes that to the
kernel's field.intake() (the SE-08 entry point per Phase 5.5
field.js). The kernel integrates the feature record per its normal
process: novelty assessment, derived constraint generation if
applicable, modulation, trace append.

The cascade rules emitted by B1/B2 still match against coordinate
state; the difference is that the coordinate state is now the
kernel's field (SE-08 contributor records become field state) rather
than the DOM. The DOM bridge from K1 reads field state and projects
it onto data-* attributes for the cascade to match.

**Specifically required code changes:**

- A1-A4 adapter modules: replace direct DOM writes with calls to a
  contributor-publisher abstraction.
- `contributor-publisher.js` (new): the unified pathway by which
  adapters emit feature records. Validates per-modality type tags
  per SE-08; appends to field intake buffer; never returns command.
- Per-adapter feature schema documents (one per A1-A4): names the
  feature record types the adapter emits. SE-08's "feature record"
  shape is `{type, value, timestamp, source}`.

**Acceptance criteria:**

- TodoMVC's deposited form runs under K1 + K2; user clicks produce
  contributor records that flow through SE-08 intake; the field
  integrates them; cascade rules match against integrated state;
  CT dispatches operations.
- F3 verification: no adapter receives a return value from the
  field; no engine calls into an adapter; the trace contains
  contributor records as appended events, not as messages.
- SE-08 ratio analysis (per phase7direction sec 1.3): each adapter
  publishes at its own rate; the field's intake buffer accumulates
  contributions across sources without coordination paths.

**Sessions estimate:** 2-3 sessions per adapter, ~10 sessions total
for A1-A4. Each adapter's feature schema is small; the pattern is
the same across adapters; the work is mostly mechanical translation
plus per-adapter testing.

### K3. Closure + S2 verification under kernel runtime

**Module shape:** Re-run sec 3.1 closure verification and S2 byte-
equivalence verification on the kernel-runtime deposited form.

**Spec anchors:**
- Sec 3.1 closure: deposited application source contains no direct
  references to host APIs (localStorage, Date.now, fetch, etc.) -
  all such references are routed through adapters per SE-08.
- S2 (substrate-resolution deterministic across substrates): the
  same constraint geometry resolves byte-identically across CSS,
  postfix, oracle, WGSL substrates.

**What changes from Phase 7 C2 verification:**

Phase 7 C2 verified S2 on TodoMVC's cascade rules running through
substrate-walker.js. Under K3, the same rules run through the kernel-
runtime; the kernel's ER engine resolves them. The S2 claim is
preserved if the kernel's ER produces byte-identical output to the
three substrate paths Phase 7 C1/C2 already verified. This is not
guaranteed by construction - the kernel's ER may have subtle
differences from the standalone CSS reference resolver - and must be
re-verified.

**Specifically required work:**

- Run the C2 triple-equivalence harness against the kernel runtime's
  ER output. Add a fourth substrate (kernel-ER) and verify byte-
  equivalence with the existing three.
- Run sec 3.1 closure verifier on the K1+K2 deposited form. All
  eleven host-API boundaries should still report PASS.
- F4 long-run (Phase 7 C3 pattern) under kernel runtime: 10,000+
  ticks; verify per-frame time bounded; no monotonic growth; no
  drift. The kernel runtime does substantially more work per tick
  (delta refresh, predictive reaching evaluation, modulation drift)
  than the thin walker; absolute numbers will be higher; the bound
  property must still hold.

**Acceptance criteria:**

- Triple-equivalence harness extended to four substrates; all four
  byte-equivalent on TodoMVC's deposited cascade rules.
- Sec 3.1 closure: 11/11 PASS.
- F4 + X2 verified at 10,000+ ticks under kernel runtime.

**Sessions estimate:** 2-3 sessions. Mostly verification work; the
hard part is in K1 + K2.

-----

## 3. LAYER M: MULTI-SUBSTRATE COMPOSITION AND CHAIN OVER NETWORK

After Layer K, deposited applications run on the substrate kernel.
Layer M extends this to multi-instance composition (which Phase 5.7
already provides for the bootstrap kernel) and to chain composition
over network transport (which Phase 7 B4 demonstrates only same-
process).

### M1. substrate-instance factory wired into deposition

**Module shape:** The deposition's runtime initialization (per K1)
calls `createSubstrate(...)` from substrate-instance.js to construct
the application's substrate instance. Multiple deposited applications
running in the same browser process get separate substrate instances
without leakage.

**Spec anchors:**
- S1 (substrate shared, owned by neither): each instance's substrate
  is shared within its instance; instances do not share substrate
  with each other.
- F3 (no supervision): instances coordinate only through observation
  of each other's outputs (per Phase 6 lattice-duel pattern), not
  through commands.
- F1 (seed is permanent, per-instance): each instance has its own
  seed at index 0 of its field.

**What changes from K1:**

K1 emits a single substrate instance per deposited application. M1
makes this explicit and supports multiple instances. Two depositions
running side-by-side in the same browser tab (e.g., a CRM dashboard
panel and a CRM detail panel) get separate instances; their fields
do not leak.

**Sessions estimate:** 1-2 sessions. substrate-instance.js exists
and is tested; the work is wiring it into the deposition emitter's
initialization sequence.

### M2. SE-10 chain composition over network transport

**Module shape:** Extend the chain composer (Phase 7 B4) to accept
network transport bindings. A chain link's emission can flow over
WebSocket, SSE, or fetch (POST + long-poll) instead of in-process
function call.

**Spec anchors:**
- SE-10 (resolution-accretion chains): autonomous substrates linked
  by VSF emission. The chain link applies its own constraints to
  bytes flowing through; resolution-density accretes at the chain's
  terminus.
- S1 (substrate shared per chain link): each link's substrate is
  shared within that link.
- S3 (rendering and execution couple through delta only): the chain
  link's coupling to its upstream is through VSF emission, not
  through command paths.
- M5 (trace at the channel): the network transport is a channel; both
  ends produce trace entries as byproduct of operating; neither side
  consumes the other's trace as command.
- F5 + SE-09 (operational irreversibility): emission across the
  network is not reversible; the receiving substrate's integration
  is permanent per F5.

**What changes from Phase 7 B4:**

B4 implemented chain composition where all links are in-process. The
chain composer takes a list of substrates and runs them in sequence,
each receiving the prior's emission. M2 adds: a link can be remote.
The chain composer serializes the upstream's emission as VSF
(algorithm 09), transports it over network, deserializes at the
remote link, and the remote link's substrate ingests it as SE-08
contributor records.

The "different transport" claim (wide claim: networking is the same
operation as storage with different transport) becomes operational.
A chain link binding is `{transport: "memory" | "websocket" | "sse" |
"fetch"}`; the chain composer produces the same end-to-end behavior
modulo latency.

**Specifically required code changes:**

- `chain-transport-binding.js` (new): per-transport modules
  (memory, websocket, sse, fetch) implementing send / receive
  contracts.
- `chain-composer.js` (existing): accept transport bindings; route
  emissions accordingly.
- `vsf-encoder.js` / `vsf-decoder.js` (use existing algorithm 09
  implementation if present, else add): the emission codec.
- Network protocol for chain composition: VSF artifacts with a
  small framing header (chain-id, link-index, codec). No business
  logic in the protocol; just emission transport.

**Acceptance criteria:**

- A 2-link chain spans the network: link 1 in browser tab A, link 2
  in browser tab B (over WebSocket or BroadcastChannel as a stand-in
  for real network); upstream emission arrives at downstream and
  integrates as SE-08 contributor.
- Sec 3.1 closure preserved: deposited code never references network
  primitives directly; all network goes through the transport binding.
- VSF artifact at the network boundary is byte-identical regardless
  of transport (memory vs websocket vs fetch); content address per
  algorithm 13 matches.

**Sessions estimate:** 5-7 sessions. The transport bindings are
mechanical; the protocol design and the VSF codec wiring are the
substantive work.

**Risks:**

- WebSocket reconnection semantics may force kernel state recovery
  pathways that don't yet exist. Mitigation: trajectory codec replay
  (Phase 5.7) provides this; the work is wiring the codec into the
  reconnection path.
- Cross-tab transport (BroadcastChannel) and cross-origin transport
  (WebSocket) have different framing concerns. Mitigation: keep the
  protocol transport-neutral; framing differences live in the
  transport binding.

### M3. substrate-media as application identity

**Module shape:** A deposited application's persistent state is its
substrate-media artifact. Hydrating the artifact returns the
application's field. The artifact's content address is its
identity.

**Spec anchors:**
- F5 (observation produces irrecoverable change): hydration is not
  a rollback; it is restoration of the field at the artifact's
  recording moment. Operations after hydration deposit further
  irreversible change.
- SE-09 (operational irreversibility): the artifact records
  irreversibly-deposited state; restoration starts from that state.
- Algorithm 13 (content-addressing and merkle): SHA-256 over the
  VSF representation produces stable identity across runs.

**What changes from Phase 5.7:**

Phase 5.7 implemented substrate-media as a persistence mechanism for
the bootstrap kernel. M3 commits that the deposited application's
durable identity IS its substrate-media artifact - phase7direction
sec 2.3 commits to this; M3 wires it.

Concretely:

- A deposited application's load sequence: fetch the artifact at
  content address C, hydrate via SM.codecs.strong.decode, install
  into the kernel runtime as the field's initial state, run from
  there.
- A deposited application's commit sequence: at SE-02 metabolism
  cadence (rule updates), encode the field as substrate-media
  artifact; store at content address; emit content address to the
  application's "save state" boundary (which may be local
  IndexedDB, may be a remote store via M2 chain link).
- Two installations of the same application share an address.
- Updates produce new addresses; old artifacts remain rehydratable.

**Specifically required code changes:**

- `app-identity-binding.js` (new): the deposition's load/commit
  sequence using substrate-media.
- Deposition emitter: emit the load/commit boilerplate.
- No changes to substrate-media.js itself; it is reused unchanged.

**Acceptance criteria:**

- A deposited application's first run records substrate-media
  artifact A1 at content address H1.
- Second run loads from H1, runs further, records A2 at H2 (where
  A2 is the field after both runs' operations).
- Restoring from H1 in a fresh tab produces a field byte-identical
  to the field at the moment of A1's recording.

**Sessions estimate:** 2-3 sessions. Mechanical wiring of existing
substrate-media against the kernel runtime.

-----

## 4. LAYER Q: K-CLASS STRUCTURAL COMPLETION

INVARIANTS.md v1.2 names two structural commitments that are
specified-but-unrealized through Phase 5.5: K2 part (a) and K3.
Layer Q realizes them. This is the only layer in the plan whose
invariants are not yet operationally honored; the work converts
specification into implementation.

### Q1. K2 part (a): selection bias from sub-cascade naming

**The invariant being completed.** K2 commits that addressing a sub-
cascade by name produces (a) a moderate selection bias toward the
sub-cascade's members and (b) a moderate delta drop. INVARIANTS.md
v1.2 implementation note: "Part (a), the 'moderate selection bias
toward the sub-cascade's members,' is structurally specified but
currently unrealized: implementations through Phase 5.5 compute no
selection ranking, so any selection bias is absent. Realizing part
(a) requires a rank-consuming selection mechanism (top-K, weighted
draw, threshold cutoff) that the current kernel does not specify."

**Module shape:** Add a rank-consuming selection step to the
kernel's selectFromMatches function. The current Phase 5.5
implementation produces a matched set with metadata (kind, named
flag) but no ranking; selection is set computation. Q1 introduces a
ranking that:

1. Within the matched set, members of the addressed sub-cascade
   receive weight bias (per K2 part a's "moderate" qualifier).
2. The bias modifies a selection-distribution-from-which-one-is-
   drawn, not a deterministic ordering.
3. Naming events that addressed a sub-cascade in the past contribute
   to the slow layer per Q2 (and so the bias amount is itself
   substrate-accumulated, not configured).

**Spec anchors:**
- K1 (sub-cascades emerge from fidelity): the bias respects fidelity
  - high-fidelity sub-cascades produce stronger bias when named.
- K2 part (a): the bias is "moderate" - not deterministic. The
  spec does not commit to a specific magnitude; the implementation
  picks one consistent with the slow-layer accumulation per K3.
- F2 (delta is one formula at every scope): the bias does not
  modify delta computation; delta is still over populations, not
  weighted.

**Specifically required code changes:**

- `field.js` `selectFromMatches`: extend to consume a ranking when
  one is available. The Phase 5.5 implementation removed
  effectiveWeight and namedBias because they were imposed-precedence
  that K2 part (a) had not yet been mechanized to support; Q1
  re-introduces a bias mechanism but as substrate-accumulated, not
  configured.
- `selection-mechanism.js` (new): the selection-distribution
  primitive. Top-K with weighted draw is the most defensible
  starting choice (cheap, monotonic in weight, configurable in K).
- Tests: that addressing a sub-cascade by name reduces the chance
  of selecting an unrelated constraint by a measurable amount;
  that the bias amount tracks slow-layer accumulation per Q2.

**Acceptance criteria:**

- A bootstrap regression in which a sub-cascade S is repeatedly
  named in input; over time, selection of S's members rises
  measurably above selection of comparable un-named matched
  members.
- The bias is "moderate" by the spec's qualifier: the bias does not
  saturate; un-named constraints continue to be selectable.
- F2 verification: delta computation is unchanged.

**Sessions estimate:** 3-5 sessions. The selection mechanism is small;
the regression suite to pressure-test "moderate" without saturation
is the substantive work.

**Risks:**

- "Moderate" is unspecified in the spec. The implementation picks a
  specific magnitude; downstream depends on it. Mitigation: parameter
  the mechanism, document the choice, treat as revisable per
  empirical observation.

### Q2. K3: naming preference as substrate-accumulated structure

**The invariant being completed.** K3 commits that naming preference
is structural, not stored. INVARIANTS.md v1.2 implementation note:
"namingPref existing as a discrete addressable accumulator strains
K3's letter ('not stored as an explicit value addressed by any
component'). Honest realization of K3 routes naming events through
SE-03 modulation such that the preference emerges in fast/slow layer
state, with no separate accumulator."

**Module shape:** Remove the namingPref accumulator from field.js.
Naming events become SE-03 modulation contributions. The slow layer
encodes the preference as accumulated substrate state. The
preference is read by selection (per Q1) by inspecting modulation
state, not by reading namingPref.

**Spec anchors:**
- K3 (naming preference structural, not stored).
- SE-03 (substrate modulation): operations produce modulation as
  byproduct; two layers; slow layer accumulates permanently.
- O1 (observation read-only): the reflexive surface displays the
  preference by inspecting modulation, not by addressing namingPref.

**Specifically required code changes:**

- `field.js`: remove namingPref accumulator. Replace with modulation-
  reading logic in the same code positions the accumulator
  previously fed.
- Reflexive surface: inspect modulation state for preference display
  rather than reading namingPref.
- Persistence: the preference is now part of substrate state; it
  serializes naturally through substrate-media; no separate
  serialization needed.

**Acceptance criteria:**

- All bootstrap regression tests pass with namingPref removed.
- The preference's behavior is observably similar to the prior
  accumulator but emerges from modulation; the implementation is
  smaller because no separate field is maintained.
- O1 verification: the reflexive surface produces the same
  observation it did before, without addressing a namingPref field
  on the field object.

**Sessions estimate:** 3-4 sessions. The accumulator is a small
piece of code; removing it without breaking the displayed-preference
behavior requires careful threading of modulation-reads.

**Risks:**

- Modulation-reads may produce noisier preference signals than the
  accumulator's smoothed form. Mitigation: tune modulation's slow-
  layer integration window; if necessary, document that the
  behavior is now noisier-but-structural and acceptable per K3.

-----

## 5. LAYER P: CRM AS FORCING FUNCTION

This layer is demonstration, not specification. The CRM is the
forcing function: every conventional-stack subsystem the wide claim
predicts collapses ought to collapse here, or the wide claim is
wrong on this fixture and we learn something specific. Each item in
this section names a CRM concept and how the substrate primitives
meet it.

### P1. CRM domain model

**Spec anchors:**
- SE-11 (dimensional resolution): the CRM's dimensions are the
  surface across which constraint geometry is defined. The migration
  tool's grammar substrates already implement SE-11 for source
  consumption; P1 applies it to a domain whose source has not been
  written yet.

**Approach.** Identify the CRM's deterministic dimensions (the
fields on which constraint geometry resolves: contact status, deal
stage, account tier, sales rep, etc.). Identify the probabilistic
dimensions (text-typed input, search queries, partial identifiers).
Define the joint coordinate space.

The model is the artifact P2-P9 build against. It is not the
finished application; it is the SE-11 dimensional definition that
the application's constraint geometry is defined over.

**Sessions estimate:** 2-3 sessions of design work. The output is a
specification document, not code.

### P2. Auth as contributor pathway

**The translation.** Authentication is a contributor pathway that
publishes identity coordinates into the kernel field. There is no
"auth subsystem" calling into business logic; cascade rules over
identity coords gate operations.

Concretely:
- SE-08 contributor: identity adapter publishes `{type: "identity",
  user_id: ..., role: ..., session_validity: ...}` records.
- Cascade rules: `[data-substrate-state][data-role="admin"]
  [data-target="user-edit"] { --next-op: "openUserEditor"; }`
- Non-admin users: the rule does not match; no operation is
  dispatched.
- Logout: identity adapter publishes a record clearing identity
  coords; subsequent cascade resolution does not match
  authenticated-only rules.

**No auth API in deposited code.** The application source contains
no `if (user.isAdmin)` branches; that conditional is constraint
geometry. The auth adapter is one of the K2 contributors.

**Sessions estimate:** 3-5 sessions. The auth flow is conventional;
the work is translating it into adapter + cascade rules.

### P3. Persistence as substrate-media artifact

**The translation.** All CRM data is in the field. The field's
substrate-media artifact (per M3) is the durable representation. No
separate database; the artifact at a content address IS the data.

Per phase7direction sec 2.3: "Source code is no longer the locus of
the application after consumption; the artifact is."

Operationally:
- Local-first: M3 stores artifacts in IndexedDB; the application
  loads from the local artifact.
- Sync to remote: a chain link (M2) emits artifacts over network to
  a remote store; remote store is itself a substrate that integrates
  the emission per SE-08.
- "Loading a contact" is hydrating the strong codec at that contact's
  content address.
- "Saving a contact" is recording the field's substrate-media after
  the edit; the field's structural change is the contact's update.

**No CRUD API.** The application source contains no `db.contacts.
update(...)`; the contact's update is a coordinate write that
modulates the field; the field's next substrate-media artifact has
the new state.

**Sessions estimate:** 3-5 sessions. Most of this is the M3
sequencing; CRM-specific work is small.

### P4. Real-time as SE-08 at network rate

**The translation.** Real-time updates are SE-08 contributor records
arriving at network rate. The contributor is a network adapter (M2
chain link binding); the rate matches the network's actual cadence.

Operationally:
- Tab A: user updates a deal stage. The update is a coordinate
  write in tab A's substrate.
- M2 chain link emits the substrate's metabolism artifact (SE-02
  output emission) over WebSocket.
- Tab B (different user, same account): network adapter receives
  the emission; integrates as SE-08 contributor; tab B's field
  updates; cascade resolution shows the new deal stage.

**No WebSocket protocol.** The deposited application has no
protocol; it has chain links. The WebSocket transport is an M2
binding, not application code.

**Sessions estimate:** 3-5 sessions. M2's chain-over-network is the
bulk of the work; CRM-specific is configuration.

### P5. Workflow as predictive constraints

**The translation.** A CRM workflow ("after deal stage X, prompt
for next action Y") is predictive constraint reaching per SE-05.
When the field's vector-delta diverges in a way characteristic of
"deal stage X with no recent action," the field generates a
predictive constraint whose `when` references the action input it
expects. UI: cascade rules over predictive-constraint state render
the prompt. When the user takes the action, the predictive
constraint matches, ratifies, becomes derived.

**No workflow engine.** The application source contains no
"WorkflowState.advance(...)"; the workflow is the field's normal
operation under SE-05.

**Sessions estimate:** 5-8 sessions. The translation requires
careful work on what counts as "the gap" the field is reaching to
close - this is where SE-05's structural specification meets a real
domain for the first time.

### P6. Reports as O-class observers

**The translation.** A CRM report is an O-class observer per
INVARIANTS.md O1-O3. The observer reads field state, produces
derived output, never writes back. Output vocabulary comes from
field state per O3. The report's bounded clause buffer per O2.

**No reporting subsystem.** Reports are a particular kind of
observer; they share the reflexive-surface code path. A "monthly
sales report" is an observer with a particular state-aggregation
template.

**Sessions estimate:** 3-5 sessions per major report type; bounded
to the number of CRM reports the demonstration requires (probably
3-5 distinct reports).

### P7. Undo/redo as trajectory codec replay

**The translation.** Phase 5.7's trajectory codec records substrate
state at intervals. Undo: hydrate the trajectory snapshot
immediately prior. Redo: hydrate the next forward snapshot.

**Honors F5.** F5 commits that observation deposits irrecoverable
change. Trajectory replay is not a rollback; it is restoration to
a recorded state, after which operation continues. The original
trajectory remains in the trace as a record of what happened; the
replay produces a new trajectory branching from the restored state.

**No undo stack.** The trajectory codec already records what's
needed; the work is exposing trajectory navigation in UI as an
observer surface.

**Sessions estimate:** 2-3 sessions.

### P8. Forms as state coords + cascade rules

**The translation.** A form is a set of state coordinates (the form
fields) plus cascade rules (the validation logic). User input writes
coords; cascade rules match input shapes against constraint geometry
(e.g., "valid email format" -> cascade rule with pattern matcher in
the WHEN clause); resolution produces validation outputs (`--field-
error: "invalid format"`); UI renders the error from cascade
output.

**No form library.** The form is structural - state element with
data-* attributes for fields, cascade rules for validation, UI
projection of cascade output.

**Sessions estimate:** 3-5 sessions per form complexity tier
(simple, multi-step, with-conditional-fields).

### P9. Multi-user as instances + SE-10 chain

**The translation.** Each user's session is a substrate instance
(M1). Cross-session coupling is SE-10 chain composition over
network (M2). Updates emit at the chain link's cadence; integrations
arrive at SE-08 contributor pathway; field state converges through
shared substrate-media artifacts at content addresses.

**Operations on shared records.** When two users edit the same
contact: each emits per their local rate; the network chain link
delivers cross-session emissions; both sessions integrate; both
fields converge. Conflict resolution is the field's normal operation
(F5 deposits all contributions; the field's state at any moment
reflects the integrated history).

**Sessions estimate:** Multi-user is the integration test of M1-M3
and P1-P8; estimating it separately is double-counting.

-----

## 6. LAYER N: MULTI-MODAL ADAPTERS (DEFERRED)

Named for completeness. SE-08 commits to adapters at any modality
the application discriminates over; phase7direction sec 2.1 names
audio (48kHz feature rate) and video (30-60Hz) explicitly.

### N1. Audio adapter

Per phase7direction sec 2.1's rate analysis at 48kHz feature rate.
The work is a contributor adapter that publishes audio feature
records (RMS, spectral, voice-activity) at audio rate. The kernel's
field accepts contributions per SE-08; cascade rules can match
audio coords.

**Sessions estimate:** 5-8 sessions for a full SE-08-grade audio
adapter, including feature extraction.

### N2. Video adapter

Per phase7direction sec 2.1's 30-60Hz commit. Per-frame feature
records (motion, color histogram, face presence). Same SE-08
contributor pattern.

**Sessions estimate:** 8-12 sessions for production-grade video
features.

-----

## 7. LAYER R: DISTRIBUTION (DEFERRED)

Named for completeness. Algorithm 17's four open problems:

1. **Trust.** ZK-proofs of constraint application, or reputation
   via historical delta-reduction accuracy. ZK-SNARKs over arbitrary
   CSP evaluation is an active research area; not off-the-shelf.

2. **Header consensus.** Multiple nodes agreeing on the constraint
   geometry. Centralized ("rebuild Google") vs emergent (unsolved).
   Neither has a concrete protocol.

3. **Merge strategies.** Git-for-geometries when two nodes collapse
   the same dims differently. CRDTs don't obviously apply; conflict-
   free merge requires a semantics of constraint override that
   hasn't been worked out.

4. **Convergence.** Single-machine trivially converges (cascade is
   deterministic). Network may diverge; needs proof conditions for
   convergence.

**Status:** research; not committed in this plan. Multi-year scope.

If a tractable wedge appears (e.g., header consensus is pure data
structure; a two-node Merkle-root-comparison prototype could be a
first-step wedge), it can be approached without committing to all
four problems.

-----

## 8. DECISION ROUTING (BLOCKERS)

### When K1 hits unexpected friction

If the kernel's I/O contract (CT engine's process-op shape) doesn't
match the DOM bridge cleanly: **read ct-engine.js's process-op
contract carefully before designing the bridge.** The kernel was
specified before the deposition tool existed; the friction may be
that the kernel's expected contract is implicit in the bootstrap's
shape and explicit specification work is needed.

If the deposition emitter's existing structure resists kernel
emission: **bias toward additive change.** Add `kernel-runtime-
emitter.js` rather than gutting `deposition-emitter.js`. The
existing emitter's path produces substrate-walker.js depositions;
the new emitter's path produces kernel-runtime depositions. Both
exist during the K1 transition.

### When K2 hits adapter shape mismatches

The adapters were written assuming DOM-coordinate publication. If
publishing to the kernel's field requires schema changes that don't
match: **publish a contributor record schema document per adapter
and route through the new contributor-publisher abstraction rather
than retrofitting each adapter individually.** The contributor
record shape per SE-08 is `{type, value, timestamp, source}`;
adapters that already produce something close need a thin adapter-
to-publisher wrapper, not a rewrite.

### When K3 verification fails

If S2 byte-equivalence breaks under kernel runtime: **the failure
is in the kernel's ER engine relative to the standalone CSS
reference.** The standalone reference is per spec; the kernel's ER
is meant to honor it; if they diverge, the kernel needs revision
(not the standalone). Verify against the postfix interpreter and
oracle; whichever the kernel agrees with is more likely correct.

If sec 3.1 closure fails: **verify which boundary leaked.** The
verifier reports per-boundary status; localize the leak; trace to
which adapter or which K2-emitted code path produced the leak.

### When M2 hits transport realities

WebSocket reconnection, SSE stalls, fetch retries are all real-world
network behaviors. If they break the chain link's clean emission/
ingest semantics: **route reconnection state recovery through the
trajectory codec.** Phase 5.7's trajectory codec exists for this
purpose; reconnection becomes "hydrate from the most recent shared
trajectory snapshot, replay forward to the current point." Already
solved structurally.

### When Q1 / Q2 verification reveals spec ambiguity

If "moderate" or "structural" cannot be operationally specified:
**document the implementation choice and route the ambiguity back
to the spec layer per D2.** A new SE-N extension may be needed to
make the implementation choice rigorous. Implementation does not
silently override spec; it surfaces the gap.

### When P-series hits domain modeling friction

Real CRMs have ambiguous constraints (e.g., "a deal can be in
multiple stages depending on perspective"). If the cascade grammar
cannot express a constraint: **re-read SE-11 dimensional resolution
discipline.** The constraint may be expressible across multiple
substrates (kind, text, string, preparative) where individual
substrates cannot express it; joint-stable structure resolves
through SE-11.

If the constraint genuinely cannot be expressed: **the model is
wrong, not the architecture.** Real CRM domains have honest
ambiguity that propagates from human social structures; surfacing
the ambiguity in the model is more honest than expressing it in
imperative code that pretends the ambiguity is resolved.

-----

## 9. WHAT THIS PLAN DOES NOT COMMIT TO

- **Specific timelines.** Each layer's session estimate is
  optimistic. Real implementation will reveal design decisions the
  plan didn't name. Each layer will probably take longer than
  estimated. The plan commits to the structural moves, not to a
  schedule.

- **A "production-ready" CRM.** Layer P is a demonstration of the
  wide claim, not a commercial product. Production deployment
  requires operational concerns (monitoring, alerting, scaling,
  support tooling, accessibility, internationalization, regulatory
  compliance) that are not architectural. Those concerns are
  bounded engineering on top of the substrate-paradigm runtime;
  they are not in this plan's scope.

- **That the wide claim is correct on the CRM fixture.** The plan
  builds Layer P to test the wide claim. If the claim fails on the
  CRM fixture, the failure is informative; the plan does not commit
  to making the claim succeed by force. Spec revision per D2 is
  always available.

- **Multi-modal adapters (Layer N) on the CRM critical path.** N is
  bounded engineering and will be done when motivated; CRMs are
  rarely audio/video-heavy and the demonstration does not need
  them.

- **Layer R (distribution).** Algorithm 17's four open problems
  remain unsolved; the plan does not commit to solving them. If a
  tractable wedge appears it can be approached separately.

- **That the K-class invariants Q1 and Q2 realize will produce the
  exact behavior the spec language anticipated.** "Moderate
  selection bias" and "naming preference as substrate-accumulated
  structure" are spec language with implementation latitude. The
  plan makes specific choices and documents them; the choices may
  need revision per empirical observation.

- **That this plan is exhaustive.** New SE-N extensions may arrive
  that change the work. The plan is revisable per D2 discipline.

-----

## 10. READING ORDER FOR THE RECEIVING SESSION

Before any work begins:

1. **DEFINITION.md sec 0.5** - reading-mode anchor.
2. **INVARIANTS.md** in full. Especially F2 (delta formula), F4 +
   X2 (indefinite operation, settling non-terminal), F5 (observation
   irreversible), S1-S3 (substrate, equivalence, coupling), M1-M5,
   K1-K3 with v1.2 implementation notes, X1-X4, O1-O3.
3. **DEFINITION.md sec 7** - implementation status. Note that the
   document is v1.0, written before Phase 5.5; the "specified but
   not yet implemented" list is partly outdated. Phase 5.5 implements
   vector-delta and predictive constraints; Phase 5.7 implements
   substrate-media; Phase 6 demonstrates multi-substrate routing;
   Phase 7 implements migration tool. The remaining gaps are: the
   K-class structural items per Layer Q, the GPU-resident form per
   K3 verification, and Layer R distribution.
4. **SE-08 (render-substrate intake)** - the contributor pattern
   K2, M2, N1, N2, P2, P4 all instantiate.
5. **SE-10 (resolution-accretion chains)** - the chain composition
   pattern M2 instantiates.
6. **SE-05 (vector-delta and predictive reaching)** - the predictive
   constraint pattern P5 instantiates.
7. **SE-11 (dimensional resolution)** - the joint-substrate
   resolution pattern P1 instantiates.
8. **Algorithm 02 (delta computation)** and **algorithm 22 (delta-
   trace coupled signal)** - the delta formula's structural ground.
9. **algorithm 16 (GPU postfix stack machine)** and **algorithm 17
   (distributed collapse network)** - the substrate-equivalence and
   distribution architecture.
10. **phase7direction.md** - the prior phase boundary handoff. The
    framing in section 1 (especially 1.3, 1.4) is load-bearing for
    Layer P.

Then, before K1:

11. **Phase 5.5/phase55/field.js** - the substrate kernel. Especially
    `_deltaOver` (lines ~256), `computeFastDelta` (~269),
    `refreshVectorDelta` (~282), `computeExecScalarDelta` (~296),
    `_mkPredictive` (~411), `ratify` (~425), `evictStalePredictions`
    (~435).
12. **Phase 5.5/phase55/ct-engine.js** and **er-engine.js** - the
    process-op contract K1's bridge layer interfaces with.
13. **Phase 5.7/phase57/substrate-instance.js** - the per-instance
    factory M1 wires.
14. **Phase 5.7/phase57/substrate-media.js** - the persistence
    primitives M3 wires.
15. **phase 7/stage 3/stage-3.4/deposition-emitter.js** and
    **substrate-walker.js** - the existing emission pipeline K1
    extends.
16. **phase7-abc-complete/** (the prior phase's bundle) - the
    A-series adapters, B-series rewriters, C-series verification
    that K1+K2+K3 build atop.

The receiving session is held to the same standard as any reader:
do not import outside frames; read structurally; treat AI commentary
as commentary; verify claims by inspecting the spec rather than by
asking for elaboration.

-----

## 11. THE DISPOSITION THIS PLAN EXPECTS

The receiving session inherits Phase 7's architectural discipline
unchanged. ASCII-only (I1). No prototype pollution (I2). Bounded
everything (I3). No eval / no Function / no document.write (I4).
CSP meta tag with restrictive policy (I5). Spec is canonical (D1).
Spec extensions are formal (D2).

The work in this plan is harder than Phase 7's because Phase 7's
layers were largely additive on the migration tool's existing
shape. Layer K is integrative: two substantial codebases (Phase
5.5 kernel + Phase 7 deposition) become one runtime. The friction
points are not in the spec - the spec has been carefully read - but
in the unspecified contracts at the kernel/deposition boundary.
Surfacing those contracts and specifying them is a real fraction of
Layer K's work.

The work is also more architecturally consequential than Phase 7's.
Phase 7 verified that source code can be migrated to a deposited
form; the wide claim was structural-but-not-operational. Phase 8
makes the wide claim operational on a real fixture: either the
collapse property the architecture commits to is empirically
demonstrated, or it isn't. Failure modes (if any) become the
substrate of subsequent work per D2. Success closes the
architecture's empirical bet and opens the research questions Layer
R names.

The plan is downstream of the spec. The spec is canonical. The
closure of the abstraction defends itself by being closed.

-----

## 12. WHAT TO BUILD FIRST IN THE RECEIVING SESSION

Concretely, the first session's deliverable:

**Read.** Items 1-10 of Section 10 (reading order). Skim items 11-16;
deeply read items 11 and 12 (field.js, ct-engine.js).

**Specify.** A short document (`KERNEL_RUNTIME_CONTRACT.md`) that
names the unspecified contracts at the kernel/deposition boundary:
- The shape of contributor records the kernel's field accepts via
  intake().
- The shape of operation requests the CT engine emits.
- The shape of cascade rule loads (mapping from B1/B2 emitted CSS
  rules to field constraints).
- The shape of trace events the kernel produces.
- The shape of trajectory snapshots the kernel emits for substrate-
  media recording.

The document is small (200-400 lines) and explicit. It is not a new
SE-N extension; it is an implementation contract that K1 honors. If
during specification it turns out a contract requires a structural
commitment the spec stack does not yet make, route to D2 (formal
SE-N extension) before continuing K1.

**Build (only after specifying).** A skeleton K1 emitter that
produces a deposition with: kernel runtime bundle inline, substrate
instance constructed at load, the seed verified present, ER engine
running on initial empty constraint set. Verify the deposition runs
F4 (kernel ticks indefinitely between inputs) and X2 (substrate does
not reach a terminal state). No application logic yet; just the
runtime hosting an empty field.

**Verify.** A single test - boot the skeleton deposition; tick 100
times; verify seed present, vector-delta refreshing, trace
appending, no termination. Closure verifier (sec 3.1) PASSES on the
skeleton because no host APIs are touched.

This deliverable is K1's foundation. Subsequent sessions add cascade
rule loading, the DOM bridge layer, K2 adapter contributor wiring,
K3 verification.

-----

## 13. VERSION

Phase 8 plan v1.0. Pinned to:

- DEFINITION.md v1.1 (with section 0.5)
- INVARIANTS.md v1.3 (33 invariants, F-S-M-K-X-O-I-D-C series, with
  v1.2 implementation notes for K2 part (a) and K3)
- IMPLEMENTATION_PATH.md (Phase 5 shipped; Phase 5.7 shipped; Phase
  6 lattice/rich duels shipped; Phase 7 stage 3.4 shipped; Phase 7
  Layers A + B + C shipped per `phase7-abc-complete.zip`)
- PROJECT_SPLIT.md (architectural duality)
- SE-01 through SE-11 (the spec extensions in canonical form)
- algorithm catalog (00-INDEX through 22)
- PLAN_OF_CONTINUANCE.md v1.0 (which this plan succeeds; that plan
  named Phase 7 Layers A through D; Layers A through C are now
  complete; Layer D is renamed Layer R in this plan and remains
  deferred)
- phase7direction.md (the Phase 7 boundary handoff document)

End of plan.
