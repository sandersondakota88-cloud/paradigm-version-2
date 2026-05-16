# PHASE 9 STATUS REPORT - LAYERS F + T CLOSED

**Date:** May 8, 2026
**Status:** 694/694 across 40 suites
**Layers complete:** Phase 8 K + M + P preserved; Phase 9 Layer F closed (F1 + F2 + F3); Layer T closed (T1 + T2 + T3); Layer S closed (S1 + S2 + S3); architectural decision implemented at all three depths; deposition emit-side supports custom bindings; full spec audit performed (SPEC_AUDIT.md) with audit P1, P2, P3, P4 closed in this session.
**Wide-claim status:** **demonstrated end-to-end in its strong form
  with first migration shipped.** T1's source registry migrated to
  cascade-extrusion form (`t1-cascade-extruded.js`): K2 adapter
  shrunk to bare wiring (no sourceRegistry field); registry IS
  cascade-rule text; adding a partner is text concat; different
  deployments use different rule sets; SE-01 compositional cascade
  structure visible (source-class IS the outer coord). Same
  dispatch outcomes as original T1 (17 tests confirm structural
  equivalence). T2/T3/F3 migrations use the same template.

**Reading anchor:** PREFACE.md, placed alongside the spec stack, records the
upstream structural observation: "Language has become expressive enough to
inherit the structure of the physical machinery it represents." All
implementation work is evidence for that observation, not the observation
itself. The mechanics protect the integrity of the demonstration; the
demonstration shows the observation is real, executable, and producible
on tooling every reader already owns. The grammars (CSS selector grammar,
custom property semantics, cascade resolution algorithm, HTML5 + DOM)
are the boundary and core of the geometry; CT is wiring at the edges
and engine internals.

-----

## REGRESSION SUMMARY

Total: 694 passed, 0 failed across 40 suites.

```
Phase 8 K-layer:           243 (K1 143 + K2 100)
Phase 8 M-layer:            66 (M1 17 + M2 30 + M3 19)
Phase 8 P-layer:           149 (P2 27 + P3 18 + P5 22 + P6 23 + P7 17 + P8 28 + P9 14)
                              + P1 specification document
Phase 9 F-layer:            25 (F1 harness 14 + F1 emission closure 11)
Phase 9 T-layer:            86 (T1 28 + T2 32 + T3 26)
Phase 9 S-layer:            64 (S1 24 + S2 18 + S3 22)
Bridge generalization:      16 (bridge-binding incl. M5 static check)
Cascade extrusion PoC:      15 (multi-pass-cascade-extrusion)
Cascade orchestrator:       17 (runPasses + runUntilFixpoint primitives)
Emit-side binding:          12 (deposition ships custom bindings inline)
T1 migrated form (P4):      17 (cascade-extrusion in production-shape)
Total:                      694
```

-----

## PHASE 9 LAYER F - CLOSED (F1 + F2 + F3)

### F1 - Closure on emitted form

P-layer cascade emissions verified through full deposition pipeline.
F1Harness loads kernel-cascade-evaluator.js directly; emission boot
loads it through emitter HTML output; both converge on identical
results for identical inputs. M2 acceptance criterion 2 covered for
P2, P8, and combined emissions. The threshold-crossing made empirical:
the same geometry resolves identically regardless of which engine
hosts it.

### F2 - Retire kind="data" (closure leak fix #1)

Phase 8's `kind="data"` constraints were silent D2 violations - the
kernel ignored the foreign kind, masking the architectural debt. The
substrate-paradigm reading is that domain records flow through SE-08
intake (input event stream), and what survives in field.constraints is
the substrate's structural response to having observed them. P3, P5,
P6, P7, P9, M1 all swept clean. Field-intake-extension wraps
serialize/deserialize so intake survives persistence.

F5 honored at three levels: artifacts at content addresses are
immutable; field constraint state is not mutated in place; intake
records appended (P3 test 3 closed an in-place mutation that was a
real F5 violation in the demonstration code).

### F3 - P5 against SE-05 (claim reduction)

Phase 8's P5 over-claimed. SE-05's predictive mechanism is character-
class divergence over input shape; the workflow detector was
fabricating predictives directly into field.constraints, bypassing
the kernel mechanism it claimed to demonstrate.

The honest reframing: workflow signals are derived from the gap
between commitment-state and observed-state. The cascade resolves
this naturally given commitment coords and observation coords. Domain
code's job is to project commitments onto the bridge as cascade-
matchable coords; the substrate does the rest.

The corrected P5 is a K2-class commitment-projection adapter
(`WorkflowCommitmentProjector`). No predictives fabricated. No
field.ratify called. No constraint mutation. SE-05's character-class
predictive mechanism remains untouched and works for what it was
designed for; the workflow demonstration uses cascade derivation
instead.

The claim reduces from "workflow as predictive constraint reaching
per SE-05" to "workflow as derivation-driven cascade resolution over
commitment + observation coords." More honest, structurally clean.

-----

## PHASE 9 LAYER T - CLOSED (T1 + T2 + T3)

### T1 - Skeptical intake as cascade-dispatched arms

**Initial closure leak.** First attempt introduced TrustObserver
returning a JS-resident array - same closure leak the retired
reserved-catch-class pattern had (Phase 7 ABC findings). Pointed at
by user prompt to look for "reserved-catch-class"; refactored to
cascade-dispatched arms.

**Final shape.** Cascade rules dispatch `--next-op` per record class
(trusted, public-ok, throttled, malformed). Four arm functions
registered in a frozen registry. `dispatchArm` reads cascade output,
runs the registered arm; arm writes result back to intake as
arm-result coord. No TrustObserver class. Closure honored end-to-end.

**Sacrificial-branch pattern.** Two of the four arms are sacrifice
arms that consume un-classifiable input by writing only to inert
counter-shape coords. F5 honors irreversibility (observation deposits
change in the sacrifice counter); critical actionable substrate
state is never touched. Verified directly: cascade rule SELECTORS
never reference arm-result or sacrifice coords. The sacrifice records
exist in intake (audit observers can read them) but no cascade rule
activates from them.

### T2 - Cryptographic verification at K2 boundary

Crypto stays at the K2 boundary. The substrate's geometry never sees
keys, signatures, or verification logic. What enters the cascade is
a coord (`data-incoming-source-verified` set to "1" or "0"); cascade
rules over that coord drive arm dispatch.

The K2 adapter (`VerifyingSourceStamper`) imports Node's crypto for
HMAC-SHA256 (production: SubtleCrypto / EdDSA over asymmetric keys).
The verify function is abstracted so production wiring is mechanical.
Verification status nests in record.value per SE-08 contract.

A new sacrificial arm: `sacrifice-unverified-record`. Trusted-class
CLAIMS with bad signatures dispatch here. Tampered or forged records
flow to the sacrificial branch the same way throttled and malformed
records do. F5 honored: the malicious payload reaches intake;
sacrifice arm runs; counter increments; no actionable arm fires.

### T3 - Trust topology as cascade geometry

Trust topology IS cascade geometry. Different deployments use
different cascade-rule sets; the rule set is the topology. Same
underlying primitives (VerifyingSourceStamper, dispatchArm) work
across all topologies.

Four reference topologies:
- peer-trust: T2 reference (verified trusted + rate-limited public)
- partner-trust: verified + type-class allowlist (no public)
- public-firewall: verified trusted only (public sacrificed)
- open-public: T2 reference (most permissive)

Same record + different topology = different outcome. This is the
structural test that topology IS geometry, not runtime config.

Two new sacrificial arms: `sacrifice-disallowed-type`,
`sacrifice-public-blocked`. Composed via the same cascade-dispatch
pattern.

-----

## ARCHITECTURAL DECISION (this session): HONOR SE-01 FULLY

The user named "geometry extruding from geometry" mid-session. On
re-reading SE-01 (compositional cascades), the property is already
committed there:

> "A cascade may be arranged such that its coordinates reference
> other cascades. The outer cascade resolves first - its rules
> determine which sub-cascade is active for a given outer
> coordinate."

> "Compilation is a reading, not an operation."

What we have been calling "configuration the bridge holds" is, per
SE-01, an outer cascade we have been failing to express as cascade
rules. T1's source registry, T2's key registry, T3's topology
selection, F3's `DEFAULT_COMMITMENTS`, every Phase 10 boilerplate
site - all are outer cascades. The architecture has been under-using
SE-01.

**The decision** (recorded in PHASE_9_PLAN section 15 and LESSONS
section 11): honor SE-01 fully. Configuration becomes cascade rules.
The bridge becomes a generic state-projector. Multi-pass cascade
resolution via `@layer` ordering or fixed-point iteration becomes
part of the architecture. The wide claim's strong form - grammar
carries the machine entirely - becomes testable.

**Implementation depth** (three layers, increasing scope):
1. Synthesizer faithfulness (closes Lesson 10)
2. Bridge generalization (conventions move from bridge to deposition)
3. Multi-pass orchestration (`@layer` from CSS Cascade Level 5 is
   most grammar-faithful)

**Migration debt** (deferred but tracked):
- T1 DEFAULT_SOURCE_REGISTRY -> outer cascade
- T2 keyRegistry -> outer cascade
- T3 topology selection -> outer cascade
- F3 DEFAULT_COMMITMENTS -> commitment outer cascade

**Layers ahead** (S2, S3, N, G, O, R, Phase 10) inherit the
SE-01-faithful shape from the start.

**Phase 10** stops being "K2 adapter holds legal config" and becomes
"outer cascade emits legal-state coords for inner application
cascade to match." PHASE_10_PLAN section 3 updated to reflect
SE-01-faithful migration as a hard prerequisite.

**Recursive consequence noted but deferred:** the architecture's
spec itself can live as cascade rules. Invariants and SE extensions
become a vocabulary expressible in cascade form. The spec checks
itself. Path is open; not work for the immediate phase.

-----

## STRUCTURAL DEBT SURFACED (S1) - CLOSED THIS SESSION

S1 surfaced one grammar-coverage gap in the architecture's
implementation: `cascade-rule-synthesizer.js` processed only the
first custom-property declaration in a rule body. CSS admits
multiple property declarations per rule; the synthesizer dropped
subsequent ones silently.

**Status: closed.** As the first concrete implementation step under
the SE-01-faithful architectural decision, the synthesizer was
updated so `synthesizeOne` returns an array of constraints (one per
declaration) sharing the selector. S1's projection rules migrated
back from 12 split one-property rules to 6 grammar-faithful multi-
property rules; the synthesizer expands them to 12 constraints
internally. Regression remains green (577/577) post-fix.

LESSONS sec 10 updated to reflect the closure. The recurring
discipline (surface and close grammar-coverage gaps rather than
working around them) stands.

-----

## STRUCTURAL COMMITMENTS HONORED THROUGH 577 TESTS

- D1 (spec canonical): F1 verifies deposed runtime resolves cascade
  identically to spec-defined evaluator
- D2 (extensions formal): F2 retired kind="data"; zero unauthorized
  kinds remain
- F1 (seed permanent): preserved through M1 instance independence,
  M3 hydration, T1/T2/T3 arm dispatch
- F3 (no supervision): zero JS-resident dispatch logic; cascade
  decides everywhere; arms execute what the cascade dispatched
- F5 (irreversibility): honored at artifact / constraint / intake
  levels; sacrificial branches deposit observation in inert coords
- I1 (ASCII): all new files ASCII-clean
- I3 (bounded): intake bounded; per-project caps honored
- K2 (adapter pattern): canonical for every K2-class component
  (identity, validator, time, follow-up, sensor, network, source-
  stamper, verifying-stamper, topology-aware-stamper)
- O1-O3 (observation): observers read-only with bounded vocabulary
- SE-08 (intake): canonical pathway for all input including signed
  records; verification status nests in value
- SE-06 (substrate duality): cascade decides + arms execute; both
  halves close back through coord writes
- Streaming forms (Phase 7 ABC): cascade decides which arm fires;
  arm result lands in coords; no JS-resident result cache

-----

## PHASE 10 BOILERPLATE SITES INVENTORY

Sites that hardcode commitments today; legal-substrate-bridge
replaces them later:

1. **F3 commitment projector**: SLA windows, follow-up deadlines,
   escalation thresholds in `DEFAULT_COMMITMENTS`
2. **T1 source registry**: trusted/public classification in
   `DEFAULT_SOURCE_REGISTRY`
3. **T2 key registry**: per-source HMAC keys in `keyRegistry`
4. **T3 topology selection**: which cascade-rule set applies to which
   counterparty (currently a deployment-time string)
5. **Layer S sunset dates** (when shipped): schema version sunset
   commitments
6. **Layer G data-class taxonomy** (when shipped): Article 17 reach
   under current legal-substrate state

The pattern across all sites: anywhere the code references a date,
threshold, key, classification, or policy that came from outside
(contract, regulation, board decision, vendor agreement), Phase 10
projects the value from the legal-substrate-bridge. Today: hardcoded.
Tomorrow: bridge-projected. The cascade-rule pattern that consumes
the value is stable across the migration.

-----

## WHAT REMAINS

**Layer F:** Closed. F1 + F2 + F3 done.

**Layer T:** Closed. T1 + T2 + T3 done.

**Layer S:** Closed. S1 (cascade-projectable schema evolution),
S2 (forward-compatibility through compositional cascade composition),
S3 (schema-shape observation surface as O-class). The boundary at
adapter-required schema evolutions (string splits, arithmetic) is
documented in S1 as architectural concern; not a blocker for Layer S
closure since cascade-projectable evolutions cover the substrate-
paradigm shape and adapter-required cases compose with K2 adapters
when needed.

**Layer N:** Network partitions. Chain link state under transport
failure; replay-from-trace recovery; content-addressed dedup.

**Layer G:** Data/derived distinction and Article-17 deletion.
Builds on F2 closure (raw input is not constraint payload); G2
formalizes the structural argument.

**Layer O:** Production observability. Trace queryability,
distributed trace correlation, diagnostic surfaces.

**Layer R:** Real-time transport (deferred from Phase 8 P4). Actual
WebSocket/SSE/long-poll for M2 chain links.

**Phase 10:** Stub written; detailed elaboration deferred to Phase 9
close + legal counsel collaboration.

-----

## VERSION

PHASE_8_PLAN_OF_CONTINUANCE.md (Phase 8 commitments inherited)
PHASE_9_PLAN_OF_CONTINUANCE.md v0.1 (Phase 9 framing; F3 corrected
in-place to commitment-projection adapter pattern)
PHASE_10_PLAN_OF_CONTINUANCE.md v0.0 stub (legal-substrate-bridge)
PREFACE.md (upstream structural observation)
INVARIANTS.md v1.3 (33 invariants, unchanged)
DEFINITION.md v1.1 with section 0.5 (reading-mode discipline)
KERNEL.md v1.1 (section 5 rewrite)
SE-01 through SE-N as of Phase 8 close (zero new SE-N from F1, F2,
F3, T1, T2, or T3)
