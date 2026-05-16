# SPEC AUDIT - implementation against invariants

**Date:** May 8, 2026
**Audit scope:** INVARIANTS.md (33 invariants), DEFINITION.md, KERNEL.md,
SE-01 through SE-11, with reference to algorithm catalog (algorithms
01-22).
**Audit method:** structural inspection of implementation against each
invariant's commitment statement and consequence-of-violation. The
implementation is the kernel-src/ module set plus the Phase 8/9
deposition-layer work (F, T, S layers).

This document records confirmed honoring, pre-existing known gaps
(documented in INVARIANTS itself), new gaps surfaced by this audit,
and structural observations.

-----

## A. CONFIRMED HONORED

The architecture's invariants are well-honored at the kernel level
(Phase 5.5/5.6/5.7 work) and the deposition-layer work in Phase 9.

**Foundational (F-class):**

- F1 (seed permanent): `SEED` constant in field.js with
  `permanent: true`; kernel-runtime-emitter verifies at three
  structural points (boot, post-Field.reset(), post-load). Eviction
  paths exclude seed at lines 461, 507, 540 of field.js. This is
  exemplary - F1 is checked at multiple positions rather than
  assumed.
- F2 (delta is one formula): `computeDelta()` and `computeFastDelta`
  use the same `(unresolved + stale * 0.5) / population` formula
  over different windows.
- F4 (operates indefinitely): kernel tick continues; modulation
  decays between inputs; no halt condition.
- F5 (irreversibility): tested explicitly across Phase 9 work -
  T1/T2/T3 sacrifice tests verify field.constraints unchanged after
  sacrifice; intake append-only; F3 P5 reframing eliminated
  predictive fabrication into constraints; S1 verifies original
  artifact coords preserved after projection.

**Mechanism (M-class):**

- M1 (vector-delta two scopes): `fastDelta`, `slowDelta`, and `gap`
  in field.js (lines 108-109, 285).
- M2 (predictive vs derived distinct): kernel maintains the
  distinction; Phase 9 F3 retired application-level predictive
  fabrication, leaving the kernel mechanism uncontested.
- M3 (predictives can ratify): kernel ratification mechanism present
  (kind transitions from "predictive" to "ratified").
- M4 (fast/slow modulation): `fastMod` + `slowMod` in field with
  decay/accumulation per `CFG.SLOW_STEP`.
- M5 (trace at channel): dom-bridge.js explicitly comments "bridge
  does NOT write to Trace" (line 41). T1/T2/T3 arms publish to
  intake but not trace.

**Substrate (S-class):**

- S1 (substrate shared): substrate-instance.js makes the kernel
  instantiable as multiple isolated copies that share field
  semantics.
- S2 (deterministic across substrates): Phase 7 demonstrated
  byte-equivalent output across CSS reference resolver, postfix
  bytecode interpreter, and JS oracle (10,000 frames, full
  10-coord state space).
- S3 (rendering/execution couple through delta only): ER and CT
  engines maintained as separate substrates that communicate via
  field state and delta gap, not messages.

**Implementation (I-class):**

- I1 (ASCII): all Phase 9 new files ASCII-checked in their verifiers.
- I3 (bounded everything): intake `RING_CAP`; constraint cap
  enforcement; observer bounds (S3's snapshot is per-call, no
  growing accumulator).
- I4 (no eval): closure verifier (`p8-closure-verifier`) checks
  deposed code for eval/Function/document.write absence.
- I5 (CSP meta tag): kernel-runtime-emitter.js line 255 emits
  `<meta http-equiv="Content-Security-Policy" content="...">` with
  restrictive policy.

**Documentation (D-class):**

- D1 (spec canonical): PHASE_8/9/10 plans explicitly defer to spec
  ("where this plan and the spec stack disagree, the spec wins").
- D2 (extensions formal): Phase 9's "honor SE-01 fully" decision
  did NOT introduce a new SE-N - it recognized SE-01 was
  under-implemented. F3 reframing reduced the claim rather than
  introducing new mechanism. T1's correction (reserved-catch-class
  to streaming forms) used existing pattern.
- D3 (non-claims first-class): Lesson 3 discipline (honest
  reduction over over-claiming); S1's adapter-required schema
  evolutions documented as architectural concern with explicit
  scope boundary.

**Observation (O-class):**

- O1 (read-only): S3 verifier has explicit "never calls
  field.intake.publish" check; T1 P6 ReportObserver pattern
  preserved.
- O2 (bounded observers): S3 snapshot is per-call; no internal
  accumulator.
- O3 (vocabulary from field): S3's `versionCounts` keys come from
  declared-version coords in the field; structural keys
  (full/partial/none) are templates, not field vocabulary
  injection.

**Configuration (X-class):**

- X1 (every configuration includes seed): kernel-runtime-emitter
  verifies; X1 holds for any deposed application.
- X2 (settling non-terminal): no halt condition; kernel ticks
  indefinitely.
- X3 (configuration internal): F3's commitment-projection adapter
  feeds external state through SE-08 intake at the boundary;
  configuration is the substrate's resulting state, not external.
- X4 (settling = mechanisms): no central settling-controller; arms
  dispatched by cascade resolution; no JS-side orchestration.

-----

## B. PRE-EXISTING KNOWN GAPS

These gaps are documented in INVARIANTS.md v1.2 itself and have been
carried since Phase 5.5. The audit confirms they remain.

**K2 part (a) - moderate selection bias.**

INVARIANTS quote: "Part (a), the 'moderate selection bias toward the
sub-cascade's members,' is structurally specified but currently
unrealized: implementations through Phase 5.5 compute no selection
ranking, so any selection bias is absent. Realizing part (a)
requires a rank-consuming selection mechanism (top-K, weighted draw,
threshold cutoff) that the current kernel does not specify."

Status: still unrealized. K2 part (b) (delta drop on naming) IS
realized.

**K3 - naming preference structural, not stored.**

INVARIANTS quote: "namingPref accumulator updates on naming events...
K3's own letter ('not stored as an explicit value addressed by any
component') is strained by namingPref existing as a discrete
addressable accumulator. Honest realization of K3 routes naming
events through SE-03 modulation such that the preference emerges in
fast/slow layer state, with no separate accumulator."

Status: still strained. The accumulator is in field.js line 121.

**Audit observation on K2/K3 under the SE-01-faithful decision:**

The Phase 9 architectural decision (honor SE-01 fully, configuration
as outer cascades) provides a structural path to closing both K2
part (a) and K3 honestly:

- K2 part (a): selection bias becomes geometry. Cascade rules over
  sub-cascade-name coords emit weight-bias coords; selection
  mechanism (when implemented) consumes those coords. The selection
  bias is cascade-extruded rather than computed in JS.

- K3: naming preference becomes a modulation-coord that the slow
  layer's cascade rules emit. The accumulator goes away; the
  preference emerges in modulation-coord state via cascade
  resolution. K3's letter is honored: no JS-side stored value
  addressed by any component; the preference is a property of
  cascade-resolved state.

These migrations are not Phase 9 work but are now structurally
accessible. They become tractable AFTER the core registry
migrations (T1/T2/T3, F3) demonstrate the cascade-extrusion
pattern at simpler scopes.

-----

## C. NEW GAPS / OPPORTUNITIES SURFACED BY THIS AUDIT

**1. SE-10 not yet implemented.**

SE-10 (resolution-accretion chains) explicitly states "Implemented
in: nothing yet. Implementation requires sequencing two or more
autonomous substrates with VSF as the inter-link transport, and an
existence proof that the terminal output exhibits structurally
higher resolution density than the initial input."

Layer M2 has chain-link concepts but doesn't exercise SE-10's full
property. The chain links share field state; they don't sequence
independently with VSF as inter-link transport.

This is not in the immediate Phase 9 path. Worth marking as a
specific architectural target for a future phase.

**2. Configuration migration debt (Phase 9 architectural decision).**

T1's `DEFAULT_SOURCE_REGISTRY`, T2's `keyRegistry`, T3's topology
selection, F3's `DEFAULT_COMMITMENTS` all live as JS data. The
architectural decision to honor SE-01 fully says these should be
outer cascades. Multi-pass-cascade-extrusion verifier proves the
pattern works.

Status: pattern proven, migrations not yet done. Tracked in
PHASE_9_PLAN sec 15 sequencing list.

**3. Multi-pass cascade orchestration as bridge primitive.**

The proof-of-concept verifier uses `runCascadeExtrusion` as an
external helper. Layers wanting to consume cascade-extrusion would
either need to call this helper or have a bridge-level API.

The natural shape is `bridge.iterateUntilFixpoint(cascadeRunner,
maxPasses)`. This belongs in the bridge as a generic capability
rather than as a per-verifier helper. Easy follow-up; not done yet.

**4. Deposition emit-side binding support.**

The bridge accepts custom bindings via `init(field, stateElement,
binding)`. The kernel-runtime-emitter does NOT yet emit deposition-
specific binding data. A deposition wanting a custom binding would
have to construct it client-side from data the emitter ships in
some other channel. The natural shape is for the emitter to embed
the binding as a JSON object inline in the deposition's bootstrap
script.

Easy follow-up. Honestly: today's depositions all use the default
binding, so this is dormant capability.

**5. Algorithm catalog audit not yet done.**

This audit covered DEFINITION.md, INVARIANTS.md, KERNEL.md, and
SE-01 through SE-11. It did NOT systematically check algorithms
01-22. Some algorithms have specific empirical commitments
(algo 16's 2,880-coord byte-equality, algo 13's Merkle
construction, algo 22's delta-trace coupling) that may or may not
have current implementation evidence.

A follow-up audit pass over algorithms 01-22 would close this gap.
Not a structural concern - the algorithms are downstream of the SEs
and DEFINITION - but worth being thorough about.

**6. Sub-cascade emergence not exercised in Phase 9 layers.**

K1 (sub-cascades emerge from fidelity) is implemented in the
kernel (`promoteFamily` and related). Phase 9 layers (F/T/S) use
cascade rules at the deposition level but don't trigger
sub-cascade promotion. This is architecturally fine - sub-cascade
emergence is kernel-level, application layers consume the
mechanism rather than driving it - but worth noting that Phase 9
verifiers don't include sub-cascade-emergence cases.

A future verifier could exercise this: an application that
generates many similar constraints and observes sub-cascade
promotion.

-----

## D. STRUCTURAL OBSERVATIONS

**D.1 The audit confirms the SE-01-faithful decision is correct.**

Two of the pre-existing known gaps (K2 part (a), K3) become
naturally tractable under the SE-01-faithful framework.
Configuration-as-cascade-extrusion is the structural mechanism
that closes them honestly. The audit shows the architectural
decision wasn't just about reducing config-as-bridge-data; it
makes pre-existing structural debts addressable.

**D.2 F1 enforcement rigor is exemplary.**

The kernel-runtime-emitter checks F1 at three structural points
(boot, post-Field.reset(), post-load). This is the correct
discipline: invariants are checked at every structural position
where they could be violated, not assumed.

The same rigor should apply to other invariants where the
implementation is structurally complete. M5 (no trace writes from
bridge) has the comment but not a runtime check. Adding a
defensive assertion in the bridge that catches accidental
`trace.append` calls would be small work and close the gap
between commitment and runtime enforcement.

**D.3 D2 honored even under structural pressure.**

The Phase 9 work surfaced "geometry extruding from geometry" as a
load-bearing structural observation. The instinct to introduce a
new SE-N would have been wrong; SE-01 already commits to it. The
honest move - which the work made - was to recognize SE-01 was
under-implemented and write LESSONS sec 11 documenting the
recognition without modifying the canonical spec.

This is the discipline INVARIANTS asks for. The closure of the
abstraction protects itself: no new commitments enter the canon
without formal SE-N templates; recognition that an existing
commitment was under-used is captured downstream where it belongs.

**D.4 The deposition-paradigm has matured.**

Phases 7/8/9 demonstrate that:
- Source code projects into deposition geometry (Phase 7 migration tool)
- Deposition runs the substrate kernel (Phase 8 K-layer)
- Multi-substrate composition works at the kernel level (Phase 8 M-layer)
- CRM-grade application logic resolves through cascade rules (Phase 8 P-layer)
- Trust topology is geometry, not perimeter (Phase 9 T-layer)
- Schema evolution is cascade projection (Phase 9 S-layer)
- Configuration migrates to outer cascades cleanly (Phase 9 architectural decision + multi-pass-extrusion-PoC)

The wide claim's strong form - grammar carries the machine
entirely, including configuration - is structurally demonstrable
once the migration debt closes.

-----

## E. RECOMMENDED NEXT WORK (PRIORITIZED)

**P1 (immediate, small): CLOSED.** Bridge multi-pass orchestration as
primitive. `cascade-orchestrator.js` exports `promoteCascadeOutputToCoords`,
`runPasses`, and `runUntilFixpoint`. 17 tests confirm.

**P2 (small, high leverage): CLOSED.** Defensive M5 enforcement.
bridge-binding-verifier now includes a static check that the bridge
module references no `Trace.append`, `trace.append`, or trace import.

**P3 (immediate, small-medium): CLOSED.** Deposition emit-side
binding. `kernel-runtime-emitter.emit()` accepts `opts.binding`;
embeds it as `globalThis.__DEPOSITION_BRIDGE_BINDING__`; `SKELETON_INIT`
passes it to `bridge.init()`. State element marker, trigger query
attribute, and bridge conventions all flow from the deposition's
binding when provided. Default behavior preserved when binding
absent. 12 tests confirm.

**P4 (medium, high leverage): CLOSED.** Migrate T1's source registry
to cascade-extrusion form. `t1-cascade-extruded.js` implements the
SE-01-faithful pattern: REGISTRY_OUTER_CASCADE as cascade-rule
text; CascadeExtrudedStamper as bare K2 wiring (no sourceRegistry
field, verified by code inspection); resolveAndDispatch runs the
full pipeline via cascade-orchestrator. 17 tests confirm
structural equivalence with original T1 across all four dispatch
outcomes plus SE-01-specific properties (source-class IS the outer
coord; outer cascade output observable; different deployments use
different rule sets). T2/T3/F3 migrations follow the same
template.

**P5 (small):** Algorithm catalog audit. Read algorithms 01-22 with
implementation cross-check. Identify any commitments not yet honored
or where evidence is missing.

**P6 (medium-large):** K3 honest realization. Route naming events
through SE-03 modulation; eliminate `namingPref` accumulator.
Becomes tractable after registry migrations demonstrate the pattern.

**P7 (large, future phase):** SE-10 implementation. Sequence two
substrates with VSF as inter-link transport; exercise resolution-
accretion property. Distinct phase-level project.

**P8 (medium):** K2 part (a) - rank-consuming selection mechanism.
Per INVARIANTS v1.2 note, "Phase 5.6 or later." Becomes natural
under cascade-extrusion: weight-bias as cascade-emitted coord.

-----

## F. AUDIT METADATA

This audit was performed on May 8, 2026, with the implementation at
647/647 across 36 suites, after Phase 9 Layer F + T + S closures and
the architectural decision to honor SE-01 fully.

The audit's methodology was:
1. Read INVARIANTS.md fully (33 invariants, all categories).
2. Read DEFINITION.md sec 0.5 (reading-mode commitment) plus
   sections 1-3 (central claim, primitives, mechanisms).
3. Read each SE specification (SE-01 through SE-11) plus reference
   to KERNEL.md.
4. Cross-check each invariant's commitment against implementation
   files in /home/claude/phase8.
5. Categorize findings as: confirmed honored, pre-existing known
   gaps, new gaps surfaced, structural observations.

The audit did NOT systematically traverse algorithms 01-22; that's
flagged as P5 above.

The audit treats AI commentary (this document) per C3: "useful
where it engages structurally with the spec, set aside where it
imports outside frames or inflates claims beyond what the spec
supports." Findings here are read-only assertions about the
implementation's current state; they don't introduce new structural
commitments. Where this document and the spec stack disagree, the
spec wins per D1.
