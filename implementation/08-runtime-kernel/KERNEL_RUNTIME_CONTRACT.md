# KERNEL_RUNTIME_CONTRACT

**Status:** Implementation contract, not spec extension. Subordinate
to DEFINITION.md, INVARIANTS.md, SE-01 through SE-11, the algorithm
catalog. This document names the unspecified contracts at the
boundary between Phase 5.5's substrate kernel and Phase 7's
deposition tool. Where this contract requires a structural
commitment the spec stack does not make, the gap is routed to D2
(formal SE-N extension); the contract itself does not introduce
structural commitment.

**Reading-mode:** DEFINITION.md sec 0.5. The contracts below name
mechanical surfaces, not architectural mechanisms. If a contract
appears to commit to a mechanism the spec does not, the contract is
wrong and must be reduced.

**Scope:** Phase 8 Layer K1 (kernel-as-runtime emitter). Subsequent
layers reuse the contract terms; revisions per implementation
findings update this document, not the spec.

-----

## 0. WHY THIS DOCUMENT EXISTS

The Phase 5.5 substrate kernel and the Phase 7 deposition tool were
developed against the same spec stack but for different operational
positions. The kernel (field.js + ct-engine.js + er-engine.js +
substrate-instance.js) was built around text-input, NLP-shaped
operation. The Phase 7 deposition emits cascade rules over DOM
coordinate state, which is a different evaluation surface.

Both are spec-faithful. Neither was specified to integrate with the
other. The contracts below name what each side exposes that the
other consumes, and what each side requires from the other to honor
its commitments. Implementations diverging from these contracts
either need a new SE-N to ground the divergence (per D2) or are
diverging from the architecture (per C1 closure).

The contracts are ordered by direction of data flow. Each contract
section names: what flows, in which direction, the shape of what
flows, the invariants the flow must honor, and the failure modes if
the contract is violated.

-----

## 1. DEPOSITION LOAD: cascade rules -> field constraints

**Direction.** Deposition (static, emitted) -> kernel field
(dynamic, runtime).

**What flows.** The Phase 7 emitter produces CSS rules of the form

```
[data-substrate-state][data-trigger="toggle"] { --next-op: "toggleTodo"; }
```

At deposition load time, each such rule must enter the kernel's
field as a constraint. The constraint joins the field's permanent
constraint set; ER (whichever ER substrate is matching) evaluates it
on every resolution pass.

**Shape of the constraint.**

```
{
  id:        "deposit::<index>",       // synthesized at load
  kind:      "derived",                 // not seed, not predictive
  pattern: {
    type:    "cascade-match",
    selector: {
      "data-substrate-state": "*",      // presence-only
      "data-trigger":          "toggle" // value match
    }
  },
  emit: {
    property: "--next-op",
    value:    "toggleTodo"
  },
  birth:     0,                         // load-time
  lastUsed:  0,
  uses:      0,
  weight:    1.0,
  permanent: false                      // can be evicted (caps)
}
```

**Invariants honored.**

- F1 (seed permanent): the seed at Field.constraints[0] is preserved;
  cascade rules append after it.
- F5 (observation irreversible): once loaded, a rule's deposition
  into the field is permanent in the trace's record; the field's
  `_enforceCaps` may evict the constraint object but the deposition
  event remains recorded.
- I3 (bounded): cascade rules contribute to the field's constraint
  count; FIELD_LIVE_CAP applies. Depositions exceeding the cap fail
  load with a clear error rather than silently truncating.
- D1 (spec canonical): "cascade-match" as a pattern type is a new
  vocabulary entry the kernel must recognize. If the kernel's
  current matchers do not handle this type, the kernel needs
  extension. The extension is structural enough that it should
  produce an SE-N entry per D2 before the kernel changes.

**Failure modes.**

- Loading cascade rules into Field.constraints without honoring F1
  (overwriting the seed). The seed must be at index 0; loader
  appends at index >= 1.
- Loading rules with kind="seed". Only the canonical seed has
  kind="seed"; deposited rules are derived.
- Loading rules in a way that the kernel's matcher does not
  recognize. The matcher must produce a match-result for every
  constraint per resolution pass, even if the result is "no match".
  An unrecognized pattern type returns "no match" silently; this
  is a violation - the rule never fires.

**Implementation notes.**

The current kernel's `_mkPredictive` produces constraints whose
pattern.type values are in `{"char-class", ...}`. Adding
"cascade-match" requires extending the matcher's dispatch. Because
this changes the kernel's evaluation surface, the change is
structural per D2; an SE-N entry should specify the cascade-match
matcher before implementation.

The Phase 7 cascade rule extractor (deposited-css-extractor.js,
already shipped) produces parsed rule objects suitable for
synthesizing field constraints. The synthesis step is the new code;
the parse step is reused.

-----

## 2. INPUT INTAKE: contributor records into the field

**Direction.** Adapter (A1-A4 plus DOM bridge) -> kernel field's
input-feature buffer.

**What flows.** SE-08 contributor records describing input arrivals.
A click event, a clock tick, a network response, a sensor sample -
each becomes a contributor record published into the field's
input-feature buffer.

**Shape of the contributor record.**

Per SE-08:

```
{
  type:      "<modality>::<feature>",   // e.g. "dom::click", "time::tick"
  value:     <feature-value>,           // typed per modality
  timestamp: <integer>,                 // monotonic source clock
  source:    "<adapter-id>"             // e.g. "a3-sensor"
}
```

**The input-feature buffer (new addition to field.js).**

SE-08 commits that the buffer "lives in field.js as shared state".
The current field.js does not have an explicit buffer; it has
`recentOps` (used for fast-delta computation) and `ctPendingOps`
(CT's queue), neither of which is the SE-08 buffer.

The buffer must be added. Shape:

```
Field.intake = {
  records: [],                          // contributor records, capped
  cap:     CFG.INTAKE_BUFFER_CAP,       // I3 bounded
  totalReceived: 0                      // running counter
}
```

`Field.intake.records` is appended to by adapters (write-only from
adapter side); read by ER per resolution pass; trimmed to cap on
each append.

**Invariants honored.**

- S1 (substrate shared): the buffer is field state. Adapters do not
  hold authoritative copies. Multiple adapters writing concurrently
  produce interleaved entries in the same buffer; this is correct
  per S1.
- F3 (no supervision): adapters call `Field.intake.publish(record)`
  with no return value indicating "ER processed it" or "CT
  acknowledged". The publish returns void; the adapter's next write
  proceeds on its own clock.
- I3 (bounded): cap enforced on every publish; oldest entries
  evicted when cap is exceeded. SE-08 requires backpressure to be
  substrate-readable; adapters can read `Field.intake.records.length`
  to self-throttle if their source produces faster than the field
  can metabolize.
- M5 (trace at the channel): publish does NOT append to the trace.
  The trace fires when ER's resolution pass observes a state change
  that the buffer's contents produced (a match flag flip, a new
  predictive ratification, etc.).

**Failure modes.**

- Adapter receives a return value indicating success/failure.
  Violates F3. publish() returns void; adapter does not know
  whether ER consumed.
- Adapter writes to its own buffer and "syncs" to field state. The
  field's buffer is the only buffer; adapters write directly.
- Buffer grows unbounded. Violates I3 + F4 (since unbounded
  consumption defeats indefinite operation). Cap enforced on every
  publish.
- Adapter writes to the trace as a side effect of publishing.
  Violates M5. The trace is downstream of ER's observation, not
  upstream of adapter writes.

**Implementation notes.**

A1-A4 currently publish to DOM coords (data-* attributes on the
deposition's substrate-state element). Under K2, they publish to
`Field.intake.publish(record)`. The DOM bridge layer (see Section
4) reads field state and projects it onto data-* attributes for
the cascade resolution; the cascade reads the DOM, not the field
buffer directly. This double-buffering is intentional: the cascade
substrate (browser CSS engine) cannot read the field buffer; it
reads DOM. The bridge mediates.

If a future SE-N specifies that the cascade substrate reads the
field buffer directly (e.g., shader bindings per SE-08's
"shader bindings" section), the DOM bridge becomes optional. For
K1, the bridge is required.

-----

## 3. CASCADE RESOLUTION OUTPUT: --next-op into CT engine

**Direction.** Cascade resolution output (DOM/CSS) -> kernel CT
engine's operation queue.

**What flows.** The cascade resolves constraints over current coord
state per frame. The output of resolution is `--next-op` (the
operation the cascade has determined should fire). The CT engine's
job is to execute that operation.

This is the most architecturally subtle contract. SE-06 commits
that ER and CT couple through delta only - no command path. The
cascade telling CT "run this op" looks like a command path. It
is not, because of how the contract is structured:

- The cascade's `--next-op` is field state (it is the resolution
  output of the field's current constraint set against the field's
  current coord state). It lives in shared substrate (the DOM /
  computed style), readable by either substrate.
- CT samples shared field state on its own clock (per SE-08). When
  CT samples and observes that `--next-op` has a non-noop value,
  CT enqueues an operation. CT is not commanded; CT chose to act
  on observed state.
- Multiple CT samples of the same `--next-op` value produce one
  enqueued operation, not many. CT tracks "last next-op observed"
  to deduplicate. This is CT's internal bookkeeping, not protocol.

**Shape of the CT enqueue from cascade output.**

Under SE-08, CT's existing `enqueueInput` is for text input. Under
K1, the equivalent for cascade-driven dispatch is a new entry point
on CT:

```
CT.enqueueFromCascade(nextOp, coords)
  - nextOp: string, the resolved value of --next-op
  - coords: snapshot of substrate-state coordinates at sample time
  - Returns: void (per F3)
```

`enqueueFromCascade` is a CT-side method; calling it is the DOM
bridge's responsibility (the bridge runs `getComputedStyle` on the
state element each tick of CT's loop).

**Invariants honored.**

- S3 (rendering and execution couple through delta only): the
  cascade does not call into CT. The DOM bridge, running as part of
  CT's tick loop, reads cascade output and enqueues. The flow is:
  cascade resolves -> DOM has --next-op -> CT samples DOM -> CT
  enqueues. CT initiates the read; the cascade does not push.
- F3 (no supervision): the cascade does not know about CT. CT's
  dedup of repeated --next-op observations is internal to CT.
- M5 (trace at the channel): when CT enqueues from a cascade
  observation, the trace records the enqueue at the channel between
  CT and ER (CT observed ER's output and reacted). This is M5-
  compliant.
- F5 (observation irreversible): once enqueued, the operation is in
  the trace; even if CT later decides not to execute (queue cap), the
  observation event is permanent.

**Failure modes.**

- Cascade calls into CT directly via JS event handler. Violates S3.
  The bridge is structural; the cascade reads no JS API.
- CT's dedup based on a flag the cascade sets. Violates F3. CT's
  dedup is its own state; cascade is unaware.
- Bridge enqueues every sample regardless of whether `--next-op`
  changed. CT processes redundant ops. Violates I3 (bounded
  metabolism) under load. Bridge dedups against last observed.

**Implementation notes.**

The current substrate-walker.js does the read+dispatch loop directly
without going through CT. Under K1, the bridge layer's read still
runs, but the dispatch is enqueued into CT, which runs through CT's
process op machinery. This means:

- All Phase 5.5 CT instrumentation (exec-scope vector-delta,
  predictive constraint generation triggered by gap, op-level
  trace) covers cascade-driven dispatch automatically.
- Latency increases by one tick (cascade resolves -> CT samples on
  its tick -> CT executes); for human-paced UI this is invisible.
- Per F4, CT tick loop runs continuously; even idle, ticks advance.

-----

## 4. DOM BRIDGE: field state -> DOM, DOM events -> field intake

**Direction.** Bidirectional, via two distinct flows.

**What flows.**

Flow 4a: field state -> DOM (for cascade evaluation):

The cascade engine (browser CSS) evaluates rules against DOM
attributes. The kernel's field state lives in JS objects, not DOM.
The bridge projects relevant field state onto the DOM:

- For each substrate-state coordinate (the data-* attributes
  Phase 7's emitter declared), the bridge writes the current value
  from the field's intake buffer onto the DOM element.
- For example: the time adapter publishes
  `{type: "time::hour", value: 14, ...}` to the buffer; the bridge
  projects the hour onto `<state-element data-time-hour="14">`;
  the cascade's selectors can match.

Flow 4b: DOM events -> field intake:

User input arrives as DOM events (click, input, keydown). The
bridge wraps these into contributor records and publishes via the
input-feature buffer (Section 2):

- A click on `<button data-trigger="toggle">` produces:
  `{type: "dom::click", value: {role: "trigger", trigger: "toggle"}, ...}`
- The published record then participates in the next cascade
  resolution pass (the bridge updates the substrate-state element's
  data-trigger to "toggle"; the cascade resolves, --next-op
  becomes "toggleTodo").

**Shape of the bridge module.**

```
DOMbridge = {
  init(field, stateElement),              // wire to field, find state element
  projectFieldToDOM(),                    // 4a, called per CT tick
  enqueueDOMEvent(eventType, target),     // 4b, called by DOM event listener
  sampleNextOp(),                         // helper for CT enqueueFromCascade
  teardown()                              // cleanup listeners
}
```

The bridge runs in browser context only. The kernel itself runs
unchanged in browser or Node; the bridge is the browser-specific
shim.

**Invariants honored.**

- S1: the DOM bridge does not own state. Field state is the
  authority; DOM is a projection.
- F3: bridge does not command kernel; bridge calls publish/enqueue
  on its own clock (CT's tick loop).
- M5: bridge does not write to the trace; ER's observation of the
  DOM-projected coords produces trace entries.
- I1 (ASCII-only): bridge source is ASCII.
- I4 (no eval): bridge does not synthesize JS at runtime.

**Failure modes.**

- Bridge holds an authoritative copy of field state. Violates S1.
  The DOM projection is generated each tick from current field
  state; no caching with sync.
- Bridge translates a CT operation request directly to DOM
  mutation, bypassing the field. Violates F3 (CT operations are
  field-mediated). Operations write coords into the field; the
  next projection cycle reflects them in DOM.
- Bridge dispatches DOM events to JS handlers that contain logic.
  Violates the deposited closure; logic must be in cascade rules,
  not in JS. Bridge handlers wrap-and-publish; they have no logic.

**Implementation notes.**

The current substrate-walker.js does both flows but without going
through the kernel. The bridge separates the I/O role (substrate-
walker.js's job under K1) from the dispatch role (which moves to
CT). The bridge ends up smaller than the current walker because
the walker's dispatch loop logic moves to CT.

-----

## 5. PERSISTENCE: field state -> substrate-media artifact

**Direction.** Field (current state) -> substrate-media store (at a
content address).

**What flows.** Field state at metabolism boundaries (per SE-02) is
encoded as a substrate-media artifact and stored at its content
address. Subsequent loads can hydrate from the address.

**Shape of the persistence flow.**

Encode:

```
Field.serialize() returns JSON
SubstrateMedia.codecs.strong.encode(substrate) returns artifact
SubstrateMedia.MediaStore.put(artifact) returns address (SHA-256)
```

Decode:

```
SubstrateMedia.MediaStore.get(address) returns artifact
SubstrateMedia.codecs.strong.decode(artifact) returns substrate
Field.deserialize(json) restores state
```

Phase 5.7's substrate-media.js implements the codecs and store; no
changes to that module. This contract specifies when and how the
deposition runtime invokes the persistence flow.

**When persistence fires.**

Per SE-02 metabolism, persistence is one of the four boundary flow
positions. The deposition runtime fires persistence at:

- App load: hydrate from the address provided by the host (e.g., URL
  parameter, IndexedDB lookup of last-known address).
- Persist threshold: after N operations or T elapsed time (CFG-
  driven), encode and store. The new address becomes the app's
  current address.
- Explicit save: the application's UI may invoke save (e.g., a save
  button); the bridge calls the persist flow.

App load hydration produces a fresh field with the constraints,
trace, and substrate state from the artifact. The kernel's normal
operation continues from the hydrated state.

**Invariants honored.**

- F5 (observation irreversible): hydration is not rollback. It
  installs a recorded state. Operations after hydration deposit
  further irreversible change. The original trajectory remains in
  the artifact; the post-hydration trajectory branches from it.
- SE-09 (operational irreversibility): substrate-media artifacts
  are immutable. New persistence produces a new address; old
  addresses remain reachable.
- F4 (indefinite operation): persistence does not halt the kernel.
  Encoding happens between ticks; decoding produces a fresh field;
  ticks resume.

**Failure modes.**

- Hydration overwrites field state mid-tick. Violates F4 (kernel
  state inconsistent during overwrite). Hydration must run between
  ticks, not concurrent with them.
- Persistence saves the field WHILE the kernel is mutating it.
  Race condition. Persistence runs at a quiescent point in the tick
  loop (between op completions).
- Address generation is non-deterministic. Two encodings of the
  same field state produce different addresses. Violates content
  addressing; the substrate-media implementation guarantees
  determinism through stable serialization order; this contract
  requires the runtime to invoke persistence in a way that respects
  that order.

**Implementation notes.**

substrate-media.js exists and is tested (Phase 5.7). The contract
is mostly about WHEN to call the existing API. The persistence
threshold (operations or time) is a CFG knob the deposition emitter
can set per-app.

-----

## 6. TRACE: at the channel between substrates

**Direction.** Both substrates (ER, CT) -> shared trace.

**What flows.** Per algorithm 22 and M5, both substrates produce
trace entries as byproduct of operating. The trace is at the
channel; neither substrate owns it; neither consumes it as command.

**Shape of trace entries.**

Existing Phase 5.5 Trace shape:

```
{
  source:    "ct" | "er",                // which substrate
  kind:      "op-begin" | "op-end" | "match" | "ratify" | ...
  vd:        { fast, slow, gap },        // vector-delta at entry time
  payload:   string,                     // detail message
  step:      Field.step                  // tick counter at entry time
}
```

This shape is preserved under K1. New trace entries from cascade-
driven dispatch use existing kinds where possible (op-begin,
op-end) and introduce new kinds where structurally distinct:

- `kind: "cascade-observe"` when CT samples cascade output and
  enqueues from it. Source = "ct" (CT made the observation).
- `kind: "intake-publish"` is INTENTIONALLY ABSENT. Adapter publishes
  do not produce trace entries directly per M5; ER's resolution pass
  produces trace entries for the consequences (matches, ratifications).

**Invariants honored.**

- M5: trace entries are byproducts of substrate operation; neither
  substrate produces entries on behalf of the other; neither
  consumes entries as command.
- F5: trace is append-only. No retroactive editing.
- I3: trace has cap; old entries age out per existing field.js
  Trace.cap.

**Failure modes.**

- Adapters write trace entries directly. Violates M5 (trace is at
  the channel, not at the source).
- Trace is consumed as command (e.g., a process scans the trace
  and takes action based on what it sees). Violates F3.

**Implementation notes.**

Phase 5.5's Trace module is reused unchanged. The bridge does not
write trace; ER and CT do, in their existing instrumentation.

-----

## 7. CLOSURE: section 3.1 verification under kernel runtime

**Direction.** Static verification of the deposited form.

**What flows.** The sec 3.1 closure verifier reads the deposited
HTML and verifies that no host APIs are referenced directly in
deposited application code. Under K1, the verifier is unchanged;
the deposited form's source is verified to contain no
`Date.now()`, `localStorage.*`, `fetch(...)`, etc.

**The kernel runtime is exempt from sec 3.1 closure.**

The kernel runtime IS the substrate; it is not "deposited
application code". The kernel uses host APIs (performance.now for
ER timing, IndexedDB for substrate-media persistence, etc.) because
the kernel is the substrate's implementation. The closure verifier
distinguishes:

- Application source (everything between specific markers, deposited
  by the migration tool): subject to closure verification.
- Kernel runtime (field.js, ct-engine.js, er-engine.js, substrate-
  instance.js, the DOM bridge, substrate-media.js): exempt; it is
  the runtime, not the application.

**Implementation notes.**

The closure verifier (Phase 7 stage 3.7) currently scans the entire
deposited HTML. Under K1, it must distinguish the kernel runtime
section (between marker comments like `/* === KERNEL RUNTIME === */`)
from the application source section. The verifier only checks the
application section.

The migration tool's emitter must produce these markers explicitly.

-----

## 8. SUBSTRATE EQUIVALENCE: S2 under kernel runtime

**Direction.** Static verification across substrates.

**What flows.** S2 commits that constraint resolution produces
identical output across substrates. Under K1, the substrates that
must agree on TodoMVC's deposited cascade rules are:

- Browser CSS cascade (the live ER for the deposited app)
- Phase 7 C1's postfix bytecode interpreter (CPU oracle)
- Phase 7 C2's JS oracle (bitset-precompute)
- Phase 5.5's cpu-oracle.js (the kernel's CPU oracle)
- (later) Phase 7 C1's WGSL shader on actual GPU

**The shape of the verification.**

For each cascade rule on each input coord, all substrates must
produce identical output. Phase 7 C2 verified this across CSS +
postfix + oracle. K3 extends to include the kernel's CPU oracle
(Phase 5.5's cpu-oracle.js).

**Invariants honored.**

- S2: byte-identical output across substrates.
- S3: substrates do not couple except through delta; the
  verification confirms they agree on outputs without coordinating.

**Failure modes.**

- Kernel's CPU oracle uses a different matching rule than Phase 7's
  postfix interpreter. Outputs diverge. Violates S2; the kernel or
  the postfix needs revision (whichever diverges from the spec).
- Kernel's matcher does not handle "cascade-match" pattern type
  (per Section 1). Outputs diverge by absence (kernel produces no
  match, others produce match). Violates S2.

**Implementation notes.**

K3 verification is mechanical: extend the C2 triple-equivalence
harness to include the kernel's cpu-oracle. The harness already
runs synthetic CSS through three substrates; adding a fourth is a
~50-line change.

If kernel + postfix + oracle agree but kernel matcher doesn't yet
handle cascade-match: the kernel matcher needs the extension named
in Section 1.

-----

## 9. WHAT THIS CONTRACT DOES NOT SPECIFY

- **The shader binding for cascade rules under SE-08 Path B.** SE-08
  names two paths for shader integration: token-projected (Path A,
  works with current opcodes) and native feature matching (Path B,
  needs new opcodes and a separate SE-N). This contract assumes
  Path A; Path B is future work.

- **Multi-modal contributor record schemas.** Audio, video, sensor
  details are out of scope (Layer N). The contributor record shape
  in Section 2 is generic; per-modality schemas are added when
  their adapters are built.

- **Network transport for chain composition.** Layer M2 work; this
  contract addresses single-instance only.

- **Multi-instance coordination.** Layer M1 work; this contract
  addresses single-instance only.

- **The K-class invariant completions (Q-series).** The contract
  assumes K2 part (a) and K3 are unrealized as INVARIANTS.md v1.2
  states; the runtime works without them. Q-series work happens
  inside the kernel and does not change the contract surface.

- **Trajectory codec invocation cadence.** The contract names that
  persistence uses substrate-media; it does not name when trajectory
  snapshots are recorded vs strong-codec full-state encodes. That
  is a per-app deposition emitter setting.

-----

## 10. STRUCTURAL COMMITMENTS THIS CONTRACT IDENTIFIES AS NEEDING SE-N

Per D2, structural commitments enter the architecture only as
formal SE-N entries. When this contract was drafted v1.0, three
items were flagged as candidates for SE-N entries before
implementation. After review against algorithm 16, SE-08, and SE-11,
**all three candidates were found to be implementation contracts
grounded in existing spec, not new structural commitments.** The
contract is therefore reduced; no new SE-N entries are needed
before K1 implementation continues.

The grounding for each candidate:

**SE-12 candidate (cascade-match constraint pattern): REDUCED.**
Algorithm 16 specifies the cascade-match instruction set explicitly:
`OP_MATCH_DIM` matches `coord[a] == b`; `OP_AND` combines matches;
`OP_BEGIN_THEN` / `OP_END_RULE` mark conditional branches; `OP_SET_*`
emit declarations. Algorithm 16's S2 commitment requires every
substrate to produce byte-identical output for this instruction set.
SE-11 (dimensional resolution) grounds the multidimensional coordinate
space these instructions operate over. Phase 7 C1's postfix compiler
implements this instruction set directly. The kernel's existing CPU
oracle (cpu-oracle.js) implements a different instruction set
(MATCH_HAS_TOKEN, MATCH_LENGTH_RANGE, MATCH_CHAR_CLASS, etc.) used
for text-token patterns from the bootstrap line. **The kernel
runtime supports both instruction sets simultaneously by pattern-
type-keyed dispatch.** This is implementation work within the spec's
existing commitments, not new structural commitment.

**SE-13 candidate (input-feature buffer): REDUCED.** SE-08
explicitly commits: "New module: input-feature buffer. Lives in
field.js as shared state. Has bounded capacity per I3." The
contributor record shape `{type, value, timestamp, source}` is also
named in SE-08. The data structure shape and cap policy are
implementation choices within SE-08's commitment. Per S1 (substrate
shared) the buffer is field state; per F3 (no supervision) adapters
write without command path; per I3 (bounded everything) the cap is
enforced. **No new structural commitment.**

**SE-14 candidate (cascade-driven CT enqueue): REDUCED.** SE-08
commits: "CT samples shared field state on its own clock. Its
observation of input arrives implicitly as state changes in the
field: match flags flip, ratification counts increment, novelty
patterns appear. CT does not 'process input ops'; it processes
field-state observations." S3 commits ER and CT couple through
delta only. The specific entry-point shape on CT
(`enqueueFromCascade(nextOp, coords)` or any other shape) is
implementation; SE-08 + S3 grounds it. **No new structural
commitment.**

The discipline this section establishes:

1. The contract drafting process tested whether the spec stack
   covered each candidate.
2. For each candidate, the test was: trace the candidate's claim
   to specific spec language. If found, the candidate is reduced
   to that language. If not found, draft an SE-N.
3. All three were reducible; the contract is correspondingly
   reduced.
4. Future K1 work treats SE-12/13/14 as implementation contracts
   grounded in algorithm 16 + SE-08 + SE-11 + S2 + S3 + F3 + I3.
   No SE-N drafting is required before continuing.

If during implementation a structural commitment surfaces that the
spec does NOT cover, the discipline reasserts: pause implementation,
draft SE-N per D2, resume.

-----

## 11. VERIFICATION CHECKLIST FOR K1 ACCEPTANCE

A K1 emitter implementation is acceptable when:

1. **Skeleton boots.** A deposition with no cascade rules and no
   contributor records boots; the kernel initializes; the seed is
   present at Field.constraints[0]; F4 verified (kernel ticks
   continuously); X2 verified (no terminal state).

2. **Cascade rules load.** A deposition with TodoMVC's 4 cascade
   rules loads; Field.constraints[0] is the seed; Field.constraints
   [1..4] are the cascade rules with kind="derived" and pattern.type
   ="cascade-match"; F1 verified.

3. **Adapter contributors flow.** A1 (time) publishes `{type:
   "time::tick", ...}` records to Field.intake; the bridge projects
   onto DOM; cascade resolves; --next-op available for sampling.

4. **Cascade output reaches CT.** A click on a substrate-state
   element with `data-trigger="toggle"` produces an intake
   record; bridge updates DOM; cascade resolves --next-op to
   "toggleTodo"; CT samples and enqueues; CT processes the op.

5. **Closure verifier passes.** Sec 3.1 closure verifier reports
   PASS on all 11 boundaries in the application section of the
   deposition (kernel runtime exempt per Section 7).

6. **S2 verification passes.** Triple-equivalence harness extended
   to kernel oracle; all four substrates byte-equivalent on
   TodoMVC's cascade rules.

7. **F4 long-run.** 10,000+ ticks under the kernel runtime; per-
   tick time bounded; no monotonic growth; no drift. (Per Phase 7
   C3 pattern.)

8. **X2 verified.** Kernel does not reach a terminal state; every
   tick does substantive work (delta refresh, modulation drift,
   trace append).

If any of (1)-(8) fail, the implementation is incomplete; the
contract or the implementation is wrong. Identify which and revise.

-----

## VERSION

KERNEL_RUNTIME_CONTRACT v1.0. Pinned to:

- DEFINITION.md v1.1 (with section 0.5)
- INVARIANTS.md v1.3
- SE-01 through SE-11 (the spec extensions in canonical form)
- algorithm catalog (00-INDEX through 22)
- Phase 5.5 ship: field.js + ct-engine.js + er-engine.js +
  cpu-oracle.js (115/115 stress tests)
- Phase 5.7 ship: substrate-media.js + substrate-instance.js
- Phase 7 stage 3.4 ship: migration tool + deposition emitter
- Phase 7 A+B+C ship: 605/605 tests; deposited TodoMVC verified
  across three substrates

Revisable when implementation reveals contracts the spec stack
implies but has not stated, or when SE-12/13/14 candidates above
are formalized.

End of contract.
