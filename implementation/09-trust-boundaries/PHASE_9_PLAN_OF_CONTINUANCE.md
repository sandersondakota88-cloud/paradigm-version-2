# PHASE 9 PLAN OF CONTINUANCE

**Status:** Draft for review. Pinned to INVARIANTS.md v1.3, DEFINITION.md
v1.1 (with section 0.5), KERNEL.md v1.1, SE-01 through SE-N as of
Phase 8 close.

**Reference state:** Phase 8 ended at 441/441 across 26 verifier suites.
Layer K complete. Layer M complete. Layer P at 8/9 deliverables (P1 spec,
P2 auth, P3 persistence, P5 workflow first-tier, P6 reports, P7 undo,
P8 forms simple-tier, P9 multi-user composition test). P4 deferred as
environment-integration.

**Reading-mode (DEFINITION 0.5):** The architecture is a closed
abstraction. Its coherence is internal and structural. External
validation cannot establish or refute correctness; only structural
inspection of the spec against itself can. When this plan appears to
require something the spec does not commit to, the correct response is
to inspect the spec -- not to extend the plan. If a structural
commitment is genuinely missing, surface it for formal SE-N extension
per D2. Never silently extend.

-----

## 0. WHERE PHASE 8 ENDED, WHAT IT DEMONSTRATED, AND WHAT IT DID NOT

Phase 8 closed the gap between the bootstrap kernel (Phase 5.5/5.7/6)
and a deposited application running the substrate-paradigm runtime.
After Phase 8, deposited applications exhibit:

- Vector-delta at multiple scopes (per SE-01)
- Predictive reaching and ratification (per SE-05, M1-M3)
- Fast/slow modulation (per SE-03, M4)
- Trace at the channel (per M5)
- Cascade resolution determining op dispatch (per SE-06)
- Substrate-media artifacts as durable identity (per SE-09, algorithm 13)
- SE-08 contributor pathways from time, network, sensor, host-info,
  identity, validation, follow-up, and remote-update sources
- SE-10 chain composition over network transport
- F5 honored under bidirectional concurrent stress (P9 demonstrated)

**The wide claim** ("every problem the conventional stack fragments
collapses into one media discipline over one shared coordinate
space") has been demonstrated WITHIN a single trust boundary on the
CRM forcing function. Auth, ORM/database, validation framework,
workflow engine, report subsystem, undo stack, and multi-user sync
have all empirically collapsed into constraint geometry over shared
substrate, using only existing SE-N primitives.

**What Phase 8 did NOT demonstrate:**

1. **Cross-trust-boundary cases.** All P9 demonstration was between
   cooperating instances over a transport that did not lose, reorder,
   or maliciously modify messages. No participant was untrusted.
2. **Schema evolution over time.** All artifacts were produced and
   consumed by code at the same version. No v1-to-v3 hydration was
   exercised.
3. **Real-world transport partitions.** LoopbackTransport modeled
   cross-process latency but not loss. No actual WebSocket/SSE
   integration ran (P4 deferred).
4. **Closure on the emitted form.** P2/P8 cascade evaluation was
   simulated in verifiers, not run through the deposition. M2
   acceptance criterion 2 remains PENDING.

**Honest soft spots from Phase 8 carried into Phase 9:**

- **P5's workflow detector bypasses the kernel's gap-divergence
  predictive-generation.** The detector creates predictive constraints
  directly with the kernel's expected shape. Stricter reading of SE-05
  is that *the field* generates predictives from delta divergence;
  domain code generating them is bypassing the mechanism, not
  exercising it. Phase 9 should examine whether SE-05's mechanism can
  be made domain-aware, or whether the detector pattern is a
  legitimate adapter analog (a "gap adapter" that contributes domain
  gap-shape signals to intake; the field's normal SE-05 mechanism then
  generates predictives in response).
- **`kind="data"` constraints.** The field's specified kinds are seed,
  derived, predictive, ratified, meta. `kind="data"` is an
  introduction without spec coverage. The kernel's logic ignores
  foreign kinds, which masks the issue rather than resolves it. This
  is the structural source of Layer G's GDPR question (constraints
  literally hold raw PII in payloads). Phase 9 must address this
  directly.
- **Cascade-evaluation simulation.** P2 and P8 verifiers simulate the
  cascade rather than running it through the actual deposition.
  Closure on the emitted form (M2 criterion 2) remains uncovered.

**Invariant firewall.** Every Phase 9 decision is annotated with the
invariant(s) it stresses. Plan-level decisions never override
invariants. The 33 invariants in INVARIANTS.md v1.3 are inherited
unchanged.

-----

## 1. THE STRUCTURAL SHIFT: CROSS-TRUST-BOUNDARY

Phase 8's demonstration was within a trust boundary. Two instances
cooperating over a reliable transport. No untrusted contributors. No
schema versions across time. No legal-deletion obligations. No
production diagnostic surface.

Phase 9 is the first phase that crosses these boundaries. The
question Phase 9 answers: **do the existing primitives hold when
the participants cannot be trusted to cooperate, when time produces
schema drift, when networks fail, when external regulations require
non-architectural moves, and when production operations need
diagnostic visibility?**

The wide claim's strength so far has been that conventional
subsystems collapse into existing primitives. Phase 9 tests whether
that property extends across trust boundaries, or whether new SE-N
extensions become necessary at the boundary itself.

Three outcomes are possible per layer:

1. **Existing primitives suffice.** The layer's structural moves are
   expressible in current SE-N + invariants. Implementation work is
   wiring, not specification. The wide claim extends without
   weakening.
2. **New SE-N extension required.** The layer's structural moves
   need commitments the spec does not currently make. A formal SE-N
   extension is drafted, reviewed, and added to the canon per D2.
   The wide claim extends with explicit new structure.
3. **The layer is not part of this architecture.** The layer's
   requirements cannot be met without violating an invariant or
   compromising closure (C1). The honest move is to recognize the
   architecture does not address the case and document what falls
   outside it. The wide claim does not extend; we learn its scope.

Each Phase 9 layer must explicitly route to one of these three
outcomes. Speculation that drifts from the spec is not a fourth option.

-----

## 2. SUMMARY OF PHASE 9 SCOPE

Six layers in dependency order, plus closure of Phase 8's soft spots.

**Layer F (Phase 8 follow-up).** Address the three honest soft spots
before extending into new territory. Run cascade evaluation through
deposition (M2 criterion 2). Audit `kind="data"` and convert
demonstrations to spec-grounded constraint kinds. Re-examine P5's
workflow detector pattern against SE-05's stricter reading. Out of
scope to extend functionality; this layer cleans up before extending.

**Layer T (trust boundaries).** Skeptical intake: cross-boundary
records arrive through a validation cascade that derives admit/reject
before SE-08 admits to the field. Cascade structure is the same as
P8 (validation as cascade); the novel piece is the gate position.
Spec anchors: SE-08, O1-O3, F3, I2, I3.

**Layer S (schema evolution).** Old artifacts hydrate under newer
code through projection cascade rules, not through migration scripts
that mutate stored state. Spec anchors: F5 (artifacts immutable),
SE-09 (operational irreversibility), SE-11 (joint-stable structure
across multiple substrates), algorithm 13 (content-addressed
identity). May surface new SE-N if joint resolution requires explicit
structural commitment.

**Layer N (network partitions).** Chain link state under transport
failure: trace records what was deposited locally; partition recovery
re-attempts delivery from the trace; receiving side deduplicates via
content addressing per F5. Spec anchors: M5 (trace at channel), SE-10
(resolution-accretion chains), F5 + SE-09. Existing primitives
appear sufficient; layer is wiring on top of M2.

**Layer G (data-bearing constraints and Article-17 deletion).** The
structural distinction between constraints that hold raw input
(retired in Layer F) and constraints that emerge from observation.
Deletion of an artifact at a content address is sufficient when only
the artifact holds the data; the field's derived constraints are not
data in the Article 4(1) sense. Spec anchors: SE-08 (intake is
contributor pathway, not retention), F5 (irreversibility of
observation), O3 (observers source vocabulary from field). May surface
new SE-N if the data/derived distinction needs structural commitment
beyond what F5 + SE-08 imply.

**Layer O (production observability).** Trace queryability,
distributed tracing across chain links, on-call diagnostic surfaces.
All read-only over O1-O3 observer surfaces. Spec anchors: O1, O2, O3,
M5. Bounded engineering above existing primitives.

**Layer R (real-time, completing P4).** Actual WebSocket/SSE/long-poll
transport for M2 chain links. Environment integration with partition
testing (Layer N). Spec anchor: M2 transport interface, M5 trace at
channel. Bounded engineering.

**Out of scope, named for completeness:**

- **Distribution (Layer R from Phase 8 plan; algorithm 17).** Multiple
  ER engines on different GPUs, multiple CT engines on different
  nodes, peer-to-peer or hierarchical topologies. Four open problems
  (trust, header consensus, merge strategies, convergence). Multi-year
  research; not committed in this plan.
- **Multi-modal adapters (Layer N from Phase 8 plan).** Audio at
  48kHz, video at 30-60Hz. Bounded engineering; not on the trust-
  boundary critical path.
- **Production-ready CRM.** Phase 8 Layer P was a demonstration; Phase
  9 layers are the next demonstration tier. A commercial CRM requires
  operational concerns (billing, support, tenant isolation,
  internationalization, accessibility) outside the architectural
  scope.

-----

## 3. PRIORITY AND DEPENDENCY GRAPH

```
LAYER F (Phase 8 follow-up; foundational, blocking T forward)
+---- F1. Closure on emitted form (M2 acceptance criterion 2)
+---- F2. Audit and resolve kind="data"
+---- F3. Re-examine P5 workflow detector against SE-05

LAYER T (trust boundaries)
+---- T1. Skeptical intake cascade
+---- T2. Source-attributed contributor records
+---- T3. Cross-instance trust topology

LAYER S (schema evolution)
+---- S1. Schema-version coords and projection cascade rules
+---- S2. Forward-compatibility verification
+---- S3. Schema-shape derivation from artifact

LAYER N (network partitions)
+---- N1. Chain link partition state
+---- N2. Replay-from-trace recovery
+---- N3. Content-addressed deduplication

LAYER G (data/derived distinction)
+---- G1. Raw-input retirement (depends on F2)
+---- G2. Artifact-deletion semantics
+---- G3. Audit surface for data class

LAYER O (production observability)
+---- O1. Trace queryability
+---- O2. Distributed trace correlation across chains
+---- O3. Diagnostic observer surfaces

LAYER R (real-time, completing P4)
+---- R1. WebSocket transport binding (depends on N)
+---- R2. SSE transport binding (depends on N)
+---- R3. Long-poll transport binding (depends on N)
```

**F precedes T.** Until the soft spots are closed, extending the
demonstration into harder cases compounds the gaps. F1 in particular
(running cascade through deposition) is a precondition for any T
demonstration that claims to test the deposited form.

**T precedes S, N, G.** Once trust boundaries exist, schema evolution
and partitions and deletion all happen across them. Without T's
intake-validation pattern, S/N/G have no entry point.

**S, N, G can proceed in parallel.** They share T's foundation but
don't depend on each other.

**O can proceed any time after F.** Production observability is
read-only; it doesn't change architecture, just exposes it.

**R follows N.** Real WebSocket integration that doesn't survive
partition testing isn't production-ready.

-----

## 4. LAYER F: PHASE 8 SOFT-SPOT CLOSURE

This layer is foundational. It precedes all other Phase 9 work.
Output is corrections to Phase 8 demonstrations such that subsequent
layers extend from a sound base.

### F1. Closure on emitted form (M2 acceptance criterion 2)

**Spec anchors:**
- D1 (spec is canonical): a verifier that simulates the cascade
  rather than running it cannot demonstrate closure on the emitted
  form. Either run the cascade through deposition or document that
  the demonstration is partial.
- C1 (closure): the deposition is the closed form; verification that
  doesn't exercise it isn't verifying closure.

**What changes from Phase 8:** P2/P8 verifiers run cascade simulation
through `simulateCascade(rules, coords)`. Replace with verification
that emits the deposition (kernel-runtime-emitter) and runs the
cascade through the actual emitted runtime, asserting --next-op
output matches expectations.

**Specifically required code changes:**
- A test harness that emits a deposition with cascade rules + intake
  state + identity coords, hydrates it in a sandbox, runs the cascade
  evaluator, observes --next-op emission.
- P2/P8 verifiers updated to use the harness.
- Closure verifier exercised on the emitted form (no localStorage,
  fetch, etc. in deposited code).

**Acceptance criteria:**
- P2 admin/non-admin gating runs through emitted form, byte-identical
  result.
- P8 form-validity composition runs through emitted form, byte-
  identical result.
- p8-closure-verifier passes on the emitted output.

**Sessions estimate:** 2-3 sessions.

**Blocker risk:** medium. The emitted form may have subtle wiring
differences from the simulation that surface real implementation
gaps. If they do, those gaps are the work; closing them honors D1.

### F2. Audit and resolve kind="data"

**Spec anchors:**
- F1 (seed permanent), seed/derived/predictive/ratified/meta are the
  specified constraint kinds (per field.js + SE-04, SE-05, SE-08 +
  algorithm 22).
- D2 (spec extensions are formal): if "data" is a legitimate
  constraint kind, it requires SE-N extension. If it isn't, the
  demonstration code must use spec-grounded kinds.
- C1 (closure): foreign kinds the kernel ignores aren't part of the
  architecture; they're application state masquerading as substrate.

**What changes from Phase 8:** All `kind="data"` constraints in the
P3/P9 demonstration code carried raw input data in payloads. This is
structurally a database row written to the field's constraint array,
which the kernel happens to leave alone. Two routes:

**Route A:** "data" is renamed to clarify that these are domain
records, not constraints. Phase 8's demonstration code is partially
correct (the field IS the data per S1) but structurally muddled
(constraints are `{when, then}` per algorithm 04, not records).
The honest reframing: domain records project to coords on the state
element via the bridge; cascade rules over those coords are the
constraints; the records themselves are intake history retained by
the field's own intake buffer (bounded per I3) plus substrate-media
artifacts at content addresses.

**Route B:** SE-N extension formalizing "domain-record constraints"
as a kind alongside seed/derived/predictive/ratified/meta. The
extension would specify: domain-record constraints are field state;
they participate in the field's constraint array; the kernel's
mechanism does not generate them but does serialize them; cascade
rules can match against their projected coords.

**Recommendation:** Route A. The substrate-paradigm framing already
provides the right primitives (intake records + bridge projection +
substrate-media artifacts). The "data" kind was a Phase 8 expedience
that obscured this. Route A respects D1 (spec is canonical) without
requiring extension.

**Acceptance criteria:**
- No `kind="data"` constraints in P-layer code.
- Domain records flow through intake + bridge + artifact pathway.
- Cascade rules match against projected coords on the state
  element, not against `data: {...}` payloads in constraint
  objects.
- All Phase 8 verifiers pass after the refactor.

**Sessions estimate:** 3-5 sessions. The refactor touches P3, P5, P6,
P7, P9 demonstration code.

**Blocker risk:** medium-high. If the refactor reveals that the
substrate-paradigm primitives genuinely cannot hold the
demonstration's record-shaped data without losing structure, that
informs SE-N or signals that the demonstration overreached. Honest
assessment routes to the spec.

### F3. Re-examine P5 workflow detector against SE-05

**Spec anchors:**
- SE-05 (vector-delta predictive reaching): predictive constraints
  arise from gap divergence between fast and slow delta scales.
- F3 (no supervision): domain code calling kernel internals to
  generate constraints directly is supervisory, not delta-only-coupled.
- K2 (adapter pattern): adapters contribute coords to intake based
  on observed external state. The pattern is established and
  extensible.

**The reframing.** Phase 9 originally enumerated two routes (kernel
revision OR formal SE-N extension). On further structural inspection,
both routes were responses to the wrong question. The real question
is not "where should the predictive come from" but "what is the
predictive a response to."

A "stalled deal" is not a property of the deal. The deal's state has
not changed. What changed is the relationship between the deal's
state and a *commitment* the organization made about deals like this
one - a contractual SLA window, a policy threshold, an operational
heuristic. Without the commitment, "14 days at qualified" is just a
fact, not a problem.

The substrate-paradigm answer: the commitment lives in the field as
constraint geometry. The cascade resolves "stale" when deal-state
coords and commitment-state coords intersect under a rule that says
"this combination produces a follow-up signal." The substrate's
normal SE-05 mechanism produces the predictive - because the
*commitment* coord is what the field expects, and the absence of
the follow-up signal IS the gap divergence.

**Resolution: commitment-projection adapter (K2-class).** The
workflow detector splits into two parts:

1. A K2-class adapter that takes contracts, policies, and
   operational thresholds and projects them onto the bridge as
   constraint geometry. SLA windows, follow-up deadlines, and
   escalation triggers become coords on the state element. The
   adapter contributes; it does not fabricate predictives.

2. The substrate's normal predictive mechanism resolving over
   deal-state coords AND commitment coords together. The gap
   between commitment-state ("follow-up should have happened by
   day 14") and observed-state ("no follow-up has occurred") is
   the divergence SE-05 already mechanizes. Predictives arise
   normally; ratification works as before.

**This is not a new SE-N extension.** K2 already covers the adapter
pattern. SE-08 already covers the contributor pathway. SE-05 already
covers predictive reaching. The original workflow-detector code was
synthesizing predictives because the commitment side of the gap was
missing from the field; supplying it through the adapter pattern
closes the gap honestly.

**What changes from Phase 8:** P5's WorkflowDetector module is
refactored. The detector becomes a commitment projector: takes
configured commitments (SLA windows, etc.), publishes them as
intake records, and the bridge projects them as cascade-rule-shaped
coords. The substrate generates predictives from observed gaps. No
domain code reaches into kernel-internal state.

**Specifically required code changes:**
- Refactor `p5-workflow-detector.js` into a commitment-projection
  adapter. K2-class structure: contributes intake records, no
  field-state mutation.
- Cascade rules over commitment coords AND state coords drive
  predictive generation through the kernel's existing mechanism.
- P5 verifier asserts: predictives arise from gap-divergence, not
  from detector-fabrication.

**Acceptance criteria:**
- The commitment-projection adapter publishes intake records only.
- Predictive constraints in the field have provenance traceable to
  the kernel's `_mkPredictive`, not to domain code.
- "Stalled deal" demonstration still works end-to-end: commitment
  projects, gap diverges, predictive reaches, follow-up arrives,
  ratification completes.
- F3 (no supervision) violation closed.

**Sessions estimate:** 2-3 sessions.

**Blocker risk:** low. The pattern is a clean structural reading
of K2 + SE-05 + SE-08 working together; no new commitments
required.

**Forward dependency on Phase 10.** The commitment-projection
adapter is the seed of a larger pattern: any commitment that comes
from outside the codebase (a contract clause, a regulation, a
board decision, a vendor agreement) projects through this adapter
shape. Phase 10 (legal-substrate-bridge) scales this up to handle
the full surface: deterministic contract terms, statutory text,
regulatory positions, and references to standards that resolve at
court speed rather than cascade speed. F3's commitment-projection
adapter is the K2-class skeleton that Phase 10 extends. See
PHASE_10_PLAN_OF_CONTINUANCE.md.

-----

## 5. LAYER T: TRUST BOUNDARIES

After Layer F, the demonstration is sound enough to extend into
cross-trust-boundary territory.

### T1. Skeptical intake cascade

**Spec anchors:**
- SE-08 (contributor pathway): the entry point for records into the
  field. This layer adds a gate before SE-08 admits.
- O1-O3 (observation invariants): the gating cascade is observer-
  derived; it produces an admit/reject derivation; it does not modify
  the candidate record.
- F3 (no supervision): the gate is constraint geometry, not a
  centralized validator.
- I2 (no prototype pollution): cross-boundary input requires
  hardening against input-derived prototype attacks.
- I3 (bounded everything): the pending-record buffer is capped.

**Module shape:** Records arriving from sources outside the trust
boundary land first in a "pending" intake buffer (separate from the
admitted intake records). Cascade rules over the candidate record's
shape derive `--admit: 1` or `--admit: 0` (or simply do not match --
unmatched records age out). Admitted records flow into the
canonical intake; rejected/unmatched records age out per O2 + I3.

The structural pattern is the same as P8 (validation as cascade)
applied to records-as-input rather than fields-as-input.

**What's novel:** the gate position. Existing intake admits all
records; this layer puts a cascade-derived gate in front of intake
for cross-boundary sources.

**Specifically required code changes:**
- `t1-skeptical-intake.js`: pending buffer, gating cascade harness,
  admission flow.
- Cross-boundary record format: includes source attribution (T2).
- Verifier: malformed records rejected; valid records admitted;
  pending buffer bounded.

**Acceptance criteria:**
- Records from a known-good source admit through normal SE-08.
- Records from an unknown source land in pending buffer.
- Cascade rules over pending records derive admission.
- Rejected records age out per O2.
- Pending buffer respects I3 cap.

**Sessions estimate:** 3-5 sessions.

**Blocker risk:** low. The pattern is established (P8); the application
to records is mechanical.

### T2. Source-attributed contributor records

**Spec anchors:**
- SE-08: the contributor record schema includes `source`. This layer
  formalizes source attribution for cross-boundary records.
- M5 (trace at channel): both ends of the trust boundary produce
  trace; source attribution lets the receiving side track which
  upstream produced what.

**Module shape:** Records flowing across trust boundaries carry
cryptographic source attribution (signature over content + source
identifier). The gating cascade (T1) can match against verified
source identity and apply source-specific rules.

**What's novel:** the cryptographic verification. The record's
`source` field is no longer "asserted by the publisher" but
"verified at the boundary."

**Specifically required code changes:**
- `t2-source-attribution.js`: signature verification at boundary.
- Pending buffer carries verification state.
- Cascade rules can match `--source-verified: "1"`.

**Acceptance criteria:**
- Records with valid signatures from known sources admit.
- Records with invalid signatures reject.
- Records with valid signatures from unknown sources land in pending
  with `--source-verified: "0"`.

**Sessions estimate:** 4-6 sessions. Cryptographic verification has
real implementation surface (key management, signature schemes,
revocation).

**Blocker risk:** medium. The architecture's I-class invariants don't
specify cryptographic primitives; this is bounded engineering above
the substrate, not architecture extension. The integration point is
T1's gating cascade, which is in scope.

### T3. Cross-instance trust topology

**Spec anchors:**
- SE-10 (resolution-accretion chains): chain links carry VSF
  emission. This layer parameterizes the chain link's trust posture
  toward its peer.
- F3 (no supervision): trust topology is constraint geometry over
  source identity and admission rules, not a central trust manager.

**Module shape:** A chain link configures its receiving side with a
trust policy expressed as cascade rules. Different instance pairs
have different policies (e.g., peer instances trust each other
fully; partner instances admit only specific record types; public
instances admit only signed records from registered sources).

**Specifically required code changes:**
- `t3-trust-topology.js`: trust policy as cascade rule set.
- M2 chain link extended to carry trust-policy reference.
- Verifier: per-pair admission rules honored.

**Acceptance criteria:**
- A peer-trust pair admits all records.
- A partner pair admits only configured types.
- A public pair admits only verified records from registered sources.

**Sessions estimate:** 3-5 sessions.

**Blocker risk:** low. The pattern is constraint geometry over an
existing chain link.

-----

## 6. LAYER S: SCHEMA EVOLUTION

### S1. Schema-version coords and projection cascade rules

**Spec anchors:**
- F5 (observation produces irrecoverable change): old artifacts are
  immutable.
- SE-09 (operational irreversibility): artifacts at content addresses
  cannot be retroactively edited.
- SE-11 (dimensional resolution): joint-stable structure resolves
  across multiple substrates. Schema versions are like substrates:
  the same logical record can be expressed in v1 coord shape or v3
  coord shape; joint-stable structure is what survives across the
  versions.
- Algorithm 13 (content-addressed identity): an artifact's address
  identifies its v1-shape bytes; hydration into a v3 field is
  projection, not migration.

**Module shape:** Each deposited application carries a schema-version
coord on its state element (`data-schema-version="v3"`). Old
artifacts carry their own version (`data-schema-version="v1"` in the
artifact's hydrated state). When a v3 application hydrates a v1
artifact, projection cascade rules over `data-schema-version="v1"`
combined with the v1-shaped coords derive equivalent v3-shaped
coords, leaving the v1 coords intact (F5: original state preserved).

**What's novel:** projection-as-cascade. No mutation of the hydrated
state; the v3 application reads v3 coords that were derived from v1
coords by cascade rule.

**Specifically required code changes:**
- `s1-schema-projection.js`: hydration with version tracking; cascade
  pass for projection rules.
- Verifier: v1 artifact hydrates; v3 cascade reads v3-shaped coords;
  v1 coords still present (F5).

**Acceptance criteria:**
- A v1 artifact hydrates without modification (per F5).
- v3 cascade rules see v3-shaped coords (derived).
- A v1 application can still read the same artifact and see v1 coords
  (no destructive migration).

**Sessions estimate:** 4-6 sessions.

**Blocker risk:** high. Joint-stable structure across schema versions
may not always be derivable; some genuine schema breakage produces
input that cannot project. If projection fails, the artifact is
unreadable under the new schema, and we honestly surface that.

**Possible SE-N implication:** if projection-as-cascade is a
distinct structural commitment (different from P8 validation
cascade, different from K2 sensor adaptation), it may warrant SE-N
extension. The decision is made after S1's implementation reveals
whether projection is a special case of existing primitives or a
new structural pattern.

### S2. Forward-compatibility verification

**Spec anchors:**
- S2 (substrate-resolution deterministic): projection cascade rules
  produce identical output for the same v1 artifact. Determinism is
  the precondition for forward-compat verification.

**Module shape:** A test harness that takes the same v1 artifact
through multiple schema versions (v1, v2, v3) and verifies projection
produces consistent v3-shaped state regardless of intermediate
versions traversed.

**Acceptance criteria:**
- v1 -> v3 projection produces same v3 state as v1 -> v2 -> v3
  projection chain.
- Failure modes (non-projectable input) reported, not silently
  ignored.

**Sessions estimate:** 2-3 sessions.

**Blocker risk:** low.

### S3. Schema-shape derivation from artifact

**Spec anchors:**
- SE-11 (dimensional resolution): the artifact's shape is observable
  as joint-stable structure. Schema is itself a property the artifact
  can be queried for.

**Module shape:** A code-side helper that derives the schema shape
of an artifact (which versions it carries coords for) without
hydrating into a specific application. Useful for archival systems,
audit tools, etc.

**Sessions estimate:** 1-2 sessions.

**Blocker risk:** low.

-----

## 7. LAYER N: NETWORK PARTITIONS

### N1. Chain link partition state

**Spec anchors:**
- M5 (trace at channel): both ends produce trace as byproduct of
  operating. Partition state lives at the channel.
- SE-10 (resolution-accretion chains): chain emission is per-link;
  failure at one link doesn't invalidate prior links.
- F5 + SE-09: prior emissions remain irreversibly deposited.

**Module shape:** Each chain link maintains a per-emission state:
PENDING (sent, not acknowledged), DELIVERED (acknowledged), or LOST
(timeout exceeded, recovery needed). The trace channel records each
state transition. Partition recovery iterates LOST emissions and
re-attempts.

**Acceptance criteria:**
- A delivered emission has DELIVERED state at both ends.
- A timeout transitions to LOST, recoverable.
- Recovery doesn't double-apply (per N3).

**Sessions estimate:** 3-5 sessions.

**Blocker risk:** medium. Real partitions have edge cases (sender
believes delivery succeeded, receiver believes it failed; messages
arrive out-of-order during recovery; etc.). The spec primitives
should hold; the engineering is making sure they do.

### N2. Replay-from-trace recovery

**Spec anchors:**
- M5: the trace IS the recovery state. The channel's trace records
  what was deposited locally.

**Module shape:** On reconnection, each chain link replays its
LOST-state emissions in order. The receiver deduplicates per N3.

**Acceptance criteria:**
- After a partition + reconnect, all pre-partition emissions are
  delivered exactly once.
- Order is preserved within a single chain link.

**Sessions estimate:** 2-3 sessions.

**Blocker risk:** low.

### N3. Content-addressed deduplication

**Spec anchors:**
- Algorithm 13 (content-addressed identity): identical artifacts have
  identical addresses. Deduplication is a consequence of
  content-addressing, not an additional mechanism.
- F5: depositing the same content twice doesn't double the structural
  change; the second deposit is a no-op at the content level.

**Module shape:** Each emission carries its content address. The
receiver checks whether the address has already been integrated; if
yes, ack and discard.

**Acceptance criteria:**
- A duplicate emission produces no second integration.
- Ack returns successfully for duplicates (idempotent).

**Sessions estimate:** 1-2 sessions.

**Blocker risk:** low. Content-addressing makes this nearly free.

-----

## 8. LAYER G: DATA/DERIVED DISTINCTION AND DELETION

### G1. Raw-input retirement (depends on F2)

**Spec anchors:**
- F2's recommendation: raw input does not live in constraint payloads.
- SE-08: intake records are the input pathway, not retention.

**Module shape:** After F2, the demonstration's records flow as
intake records (bounded per I3, ages out per the intake's normal
discipline) and substrate-media artifacts at content addresses.
Constraints derived from the records are field state; they are not
the records.

This layer formalizes the discipline as an architectural commitment:
**raw input is not retained as constraint payload state.**

**Specifically required code changes:**
- Audit verifier: walks all field constraints; rejects any constraint
  whose payload contains raw input rather than structural derivation.
- P-layer code complies.

**Acceptance criteria:**
- The audit verifier passes on all P-layer demonstrations.
- Any constraint that holds raw input is identified and refactored.

**Sessions estimate:** 1-2 sessions (most work happens in F2).

**Blocker risk:** low (after F2).

### G2. Artifact-deletion semantics

**Spec anchors:**
- F5 (irreversibility): observation deposits irrecoverable change.
- SE-09 (operational irreversibility): artifacts at content addresses
  cannot be retroactively edited.
- C1 (closure): the architecture's behavior under "delete this
  artifact" must be a structural consequence of prior commitments,
  not a bolted-on feature.

**Module shape:** Deletion of an artifact at a content address is
storage-layer behavior, not architecture behavior. The substrate-
media store can be configured to remove an address from its backend;
subsequent hydration attempts return null. The field's existing
state (constraints derived from the deleted artifact's prior
hydration) is unchanged per F5.

**The architectural claim about deletion:**

1. **Raw input that was stored as substrate-media artifacts:** can be
   deleted at the storage layer. Content-addressed storage means
   "delete the file at this address"; the address still exists, but
   no backend answers it.
2. **Derived constraints in still-live fields:** are not "the data"
   in any meaningful sense after F2/G1. They are the field's
   structural response to having observed input. F5 commits this is
   irreversible.
3. **Trace entries:** are byproduct of operating per M5. They are
   records of what the substrate did, not records of what input the
   substrate received. They retain enough to debug the substrate; not
   enough to reconstruct the input.

This is the structural argument, not a legal one. Whether it
satisfies Article 17 is a separate question for actual privacy
counsel.

**Specifically required code changes:**
- Documentation: write up the deletion semantics as a formal artifact
  in the spec stack (not as commentary).
- Audit verifier: confirms trace entries do not encode reconstructable
  raw input; confirms constraints derived from artifacts don't
  embed raw input verbatim.

**Acceptance criteria:**
- Substrate-media deletion of an address removes the artifact.
- Subsequent hydration of that address fails predictably.
- Existing field state (from prior hydration) is unchanged.
- Trace entries do not include raw input verbatim.

**Sessions estimate:** 2-3 sessions.

**Blocker risk:** low for the implementation; the argument's
acceptance is downstream. **Potential SE-N implication:** the
data/derived distinction may warrant explicit structural commitment
beyond F5 + SE-08. SE-N extension would specify that derived
constraints are not the input; would name the structural property
that makes them not-the-input (irreversibility + vocabulary
sourcing).

### G3. Audit surface for data class

**Spec anchors:**
- O1-O3: an audit observer reads field state; produces audit records;
  doesn't modify the field.

**Module shape:** An observer that, given a content address, surfaces
which derived constraints in the current field originated from that
artifact's hydration. Useful for "show me what we still have related
to this address" queries from audit tooling.

**Sessions estimate:** 2-3 sessions.

**Blocker risk:** low.

-----

## 9. LAYER O: PRODUCTION OBSERVABILITY

### O1. Trace queryability

**Spec anchors:**
- M5 (trace at channel), O1-O3.

**Module shape:** Trace querying API on top of the existing trace.
Read-only per O1; bounded per O2; vocabulary from field per O3.

**Sessions estimate:** 2-3 sessions.

### O2. Distributed trace correlation across chains

**Spec anchors:**
- M5, SE-10.

**Module shape:** A correlation observer that walks chain emissions
across instances and assembles a per-emission trace path. Read-only;
the observer holds no authoritative state.

**Sessions estimate:** 3-5 sessions.

### O3. Diagnostic observer surfaces

**Spec anchors:** O1-O3.

**Module shape:** Standard diagnostic surfaces (deltas, intake rates,
constraint counts, predictive ratification rates) packaged as
O-class observers for production use.

**Sessions estimate:** 2-3 sessions.

-----

## 10. LAYER R: REAL-TIME (COMPLETING P4)

### R1. WebSocket transport binding

**Spec anchors:** M2 transport interface, M5 trace at channel.

**Module shape:** Concrete WebSocket transport implementing the M2
transport interface (send, onReceive, observe). Partition handling
delegated to Layer N.

**Sessions estimate:** 3-5 sessions.

### R2. SSE transport binding

**Module shape:** Concrete SSE transport for one-way emission.

**Sessions estimate:** 2-3 sessions.

### R3. Long-poll transport binding

**Module shape:** Concrete long-poll transport for environments
without SSE/WebSocket.

**Sessions estimate:** 2-3 sessions.

-----

## 11. DECISION ROUTING (BLOCKERS)

### When a Phase 9 layer reveals spec ambiguity

Same as Phase 8 sec 8. **Document the implementation choice and
route the ambiguity back to the spec layer per D2.** A new SE-N
extension may be needed. Implementation does not silently override
spec.

### When existing primitives don't compose cleanly across the boundary

**Three routes** (per sec 1):
1. Existing primitives suffice -- implementation work is wiring.
2. New SE-N extension required -- formal D2 process.
3. The layer is not part of this architecture -- honest scope
   reduction, document what falls outside.

### When schema projection (S1) cannot derive equivalent coords

Genuine schema breakage. **Surface as data the v3 application
cannot read.** Do not silently drop. The artifact remains valid
under v1; under v3 it appears as schema-incompatible.

### When trust topology requirements push toward central authority

Watch for F3 violation. **Trust policy is constraint geometry over
source identity, not a central trust manager.** If the requirements
genuinely need central authority, the layer is not part of this
architecture; document it.

### When deletion requirements push toward field-state mutation

Watch for F5 violation. **F5 is the architecture's spine.** If
deletion requires reaching into the field and removing structural
state, the architecture cannot do that without becoming a different
architecture. Document the limit; route to legal counsel for
whether the data/derived distinction (G2) suffices.

### When P5's SE-05 ambiguity (F3) cannot be resolved by either route

If neither Route A (kernel revision) nor Route B (SE-N extension)
satisfies SE-05's letter, the demonstration's predictive-reaching
claim is over-stated. **Reduce the claim** to what the spec
actually supports; document the workflow detector as "an adapter
that contributes to the field, demonstrating reaching at the
domain level" rather than "predictive reaching per SE-05."

-----

## 12. WHAT THIS PLAN DOES NOT COMMIT TO

- **Specific timelines.** Each layer's session estimate is optimistic.
  Real implementation reveals decisions the plan did not name.
- **That cross-trust-boundary cases are expressible without SE-N
  extension.** Layer S and Layer G in particular may surface new
  structural commitments. The plan commits to surfacing them
  formally per D2, not to making the existing primitives stretch
  past their honest scope.
- **A production-grade implementation of any layer.** Phase 9 layers
  are demonstrations and structural extensions. Operational concerns
  (key rotation, distributed key management, multi-region failover,
  regulatory audit response) are bounded engineering above the
  architecture, not in this plan's scope.
- **That Phase 8's empirical results extend without adjustment.**
  The honest soft spots (F1, F2, F3) may surface gaps that change
  Phase 8's claims. The plan commits to surfacing those gaps, not to
  preserving the claim count.

-----

## 13. OPEN QUESTIONS

1. **Is "data" a constraint kind?** F2's resolution. Currently a
   Phase 8 expedience without spec coverage.
2. **Is the workflow detector pattern a legitimate gap-adapter?**
   F3's resolution. May require SE-N or kernel revision.
3. **Can projection-as-cascade always derive equivalent state across
   schema versions?** S1's resolution. Some breakage may be genuine.
4. **Does the data/derived distinction warrant explicit SE-N?**
   G2's resolution. The argument may be expressible in F5 + SE-08
   alone, or may need new structural commitment.
5. **Does cross-instance trust topology require new SE-N for source
   identity, or is signed source attribution within SE-08?** T2/T3's
   resolution.
6. **What's the upper bound on schema projection depth (v1 -> vN)?**
   Practically and architecturally.

These are honest open questions. Their resolution is part of the
work; the plan does not pre-commit to answers.

-----

## 14. STRUCTURAL DISCIPLINES (LESSONS ACCUMULATED)

Disciplines that emerged through Phase 9 corrections are documented in
LESSONS.md, alongside the spec stack. The disciplines are forward-
binding for all subsequent work. Summary:

1. **The closure-leak diagnostic.** Wherever code reaches for "where
   does the result go," the answer must be "in coords/intake," not "in
   JS memory." Closure violations have characteristic shapes (caches,
   observer-returned arrays, fabricated kernel state, foreign
   constraint kinds) and the pattern repeats one layer at a time
   unless the discipline is held.

2. **Reframe before extending.** When a layer's structural shape feels
   off, the answer is structural, not engineering. F3's reframing
   (workflow signals are derived from commitment-state gaps, not
   fabricated predictives) is the canonical example. T1's first
   attempt was the same pattern recurring at the dispatch level.

3. **Honest reduction over over-claiming.** Phase 8's P5 over-claimed
   "predictive reaching per SE-05"; Phase 9 reduced this to
   "derivation-driven workflow signals." The wide claim survives
   reductions; over-claims become structural debt.

4. **Grammar is the boundary; CT is wiring.** CSS selector grammar +
   custom property semantics + DOM are the geometry's boundary. JS
   is K2 adapter wiring at I/O edges and engine internals. Anything
   trying to live in JS that should be geometry is a closure leak in
   different clothing.

5. **Sacrificial branches as cascade dispatch.** When a layer needs to
   handle "input the substrate cannot meaningfully act on," the right
   structural shape is a cascade-dispatched arm that writes only to
   inert sacrifice coords. F5 honors the irreversibility; the
   substrate's actionable state is untouched.

6. **Phase 10 boilerplate annotation.** Hardcoded constants from
   "outside" (contracts, regulations, board decisions, vendor
   agreements) get explicit Phase 10 annotations so the migration
   surface stays discoverable.

7. **Compaction-resistant arc.** Decisions and disciplines that should
   survive sessions live in files (this plan, LESSONS.md, STATUS.md),
   not in conversation. When a session produces a structural insight,
   write it down.

LESSONS.md contains the full discipline narrative with examples,
diagnostic questions, and open questions surfaced through Phase 9 for
the next session. Read it before continuing implementation work in
Layers S, N, G, O, R, or Phase 10.

-----

## 15. ARCHITECTURAL DECISION - HONOR SE-01 FULLY (COMPOSITIONAL CASCADES)

**Date of decision:** May 8, 2026 (mid-Phase-9, after Layers F + T
closed and S1 done).

**The decision.** Phase 9 commits the architecture to honoring
SE-01's compositional-cascade property fully. Cascade-resolvable
configuration lives as cascade rules. Bridge-held configuration is
structural debt to migrate. Layers ahead inherit the compositional
shape from the start.

**This is not a new spec extension.** SE-01 has committed to
compositional cascades since April 2026. What changed in Phase 9 is
recognition that the implementation has been under-using SE-01 -
treating registries, key tables, topology selections, and commitment
configurations as JS-side data the bridge holds, when SE-01 says
they are outer cascades whose rules emit coords that inner cascades
match against. The user's "geometry extruding from geometry" naming
made the under-use visible. SE-01 was already there.

**See LESSONS.md sec 11** for the full narrative, the structural
shape, the wide-claim implication, and the implementation depth.

**Implications for layers already shipped:**

Layer F (F1, F2, F3): F1 was always SE-01-shaped (cascade rules over
coords producing cascade output). F2 was the partial migration of
domain records out of constraints into intake. F3's commitment-
projection adapter is mostly SE-01-shaped but DEFAULT_COMMITMENTS
hardcodes the SLA threshold. F3's threshold should migrate to a
commitment outer cascade. Marked as deferred-but-tracked structural
debt.

Layer T (T1, T2, T3): Each layer's K2 adapter holds configuration
that should be cascade-extruded.
- T1's `DEFAULT_SOURCE_REGISTRY` -> outer cascade emitting
  `--source-class` from `data-source-id`
- T2's `keyRegistry` -> outer cascade emitting verification-key
  identifiers
- T3's topology selection -> outer cascade emitting which inner
  cascade's `--next-op` rules apply
Each is structural debt to migrate. The cascade rules grow; the K2
adapter shrinks; the verifier asserts the new shape.

Layer S (S1): S1's projection rules are already SE-01-shaped (they
ARE outer-cascade-style projection: `data-schema-version` matches,
`--derived-tier` emits, inner cascade reads). S1 does not require
migration.

**Implications for layers ahead:**

S2 (forward-compatibility verification): designs in. The verifier
builds on S1's pattern; new schema versions add their own outer-
cascade projection rules.

S3 (schema-shape derivation): inherits cleanly. The observation
surface walks coords; SE-01-faithful operation makes more coords
visible.

N (network partitions): inherits the compositional shape. Per-pair
transport state (rate, latency, partition-detected) lives as outer-
cascade-emitted coords; recovery rules are an inner cascade matching
those coords.

G (data/derived distinction): the data-class taxonomy lives as outer
cascade rules; deletion semantics are an inner cascade. The
structural argument that derived constraints aren't data becomes
testable through the cascade structure.

O (production observability): trace queryability becomes outer
cascade rules emitting trace-shape coords; observers read them.

R (real-time transport): wire-protocol state is outer cascade
emitted; transport-mode dispatch is inner cascade.

**Phase 10 (legal-substrate-bridge) inherits the new shape.** Phase
10's stub described the bridge as a K2 adapter holding legal-
substrate state. Under the SE-01-faithful form, Phase 10 is an outer
cascade: legal-state coords (current MNDA, current Article-17
reach for jurisdiction X, current rate-limit policy, current SLA
commitment) emit from legal-substrate-bridge cascade rules; inner
application cascade rules match against them. The bridge's job is
projection of legal-substrate state into coord form; the cascade
handles the rest. PHASE_10_PLAN section 3 (dependencies) should be
updated to reflect that Phase 9's SE-01-faithful migration is a hard
prerequisite for Phase 10's clean shape.

**Implementation depth (three layers, increasing scope):**

1. *Synthesizer faithfulness*. Process all custom-property
   declarations per rule body, and ideally generalize to all CSS
   property declarations. Closes Lesson 10's debt. One push,
   probably 50-100 lines. S1 can collapse from 12 split rules back
   to 6 multi-property rules.

2. *Bridge generalization*. Today's bridge has hardcoded
   conventions (data-* attributes are coords, custom properties are
   cascade output, state element id is "substrate-state"). Under
   SE-01-faithful operation, the bridge becomes generic: reads
   whatever the deposition tells it to read; writes back whatever
   the cascade produces. The conventions move from bridge code into
   the deposition. Probably 200-400 lines of bridge work plus
   coordination with downstream layers.

3. *Multi-pass orchestration*. SE-01 admits multi-level composition:
   outer cascade resolves; output of outer pass becomes input to
   inner pass. The architecture today resolves a single pass.
   Multi-pass requires either (a) bridge orchestrates passes
   sequentially, (b) the evaluator does fixed-point iteration, or
   (c) deployment uses `@layer` from CSS Cascade Level 5. (c) is
   most grammar-faithful since @layer is published spec.

**Sequencing recommendation:**

The architecture decision is final (per this session). The
implementation work follows the depth order:

1. Close Lesson 10 with synthesizer faithfulness. Migrate S1 back to
   multi-property form. One push. Validates the synthesizer fix
   doesn't break existing layers.

2. Continue Layer S (S2 + S3) under the partial-bridge form. They
   don't depend on bridge generalization to be correct.

3. Bridge generalization push. Coordinated change to bridge,
   verifiers, and one or two layers as proof-of-concept (probably
   T1's source registry as the migration target since it's the
   simplest registry).

4. Multi-pass orchestration via @layer. The evaluator may need
   significant work; this might warrant its own session with focused
   evaluator investigation.

5. Migrate remaining layers (T2, T3, F3) registries to cascade-
   extrusion form.

6. Continue Layers N, G, O, R from the SE-01-faithful baseline.

**This decision survives compaction.** Per Lesson 7 (compaction-
resistant arc), the decision is recorded in this plan and in
LESSONS sec 11 so a new session can pick up the architectural
shape rather than re-discovering it.

-----

## 16. VERSIONS

PHASE_9_PLAN_OF_CONTINUANCE.md v0.1 draft. Pinned to:
- DEFINITION.md v1.1 (with section 0.5)
- KERNEL.md v1.1 (section 5 rewrite)
- INVARIANTS.md v1.3 (33 invariants)
- SE-01 through SE-N as of Phase 8 close
- PHASE_8_PLAN_OF_CONTINUANCE.md (Phase 8's commitments inherited)

Revisable as Phase 9 layers reveal what the spec actually requires.
