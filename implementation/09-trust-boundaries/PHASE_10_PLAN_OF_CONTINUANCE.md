# PHASE 10 PLAN OF CONTINUANCE

**Status:** STUB. Detailed scoping deferred to Phase 9 close, with
explicit collaboration from legal counsel before any implementation
work. Pinned to the same spec stack inherited by Phase 9.

**Provenance:** This phase emerged from F3's structural reframing in
Phase 9. The commitment-projection adapter (K2-class) that resolves
F3 is the seed of a larger pattern: any external commitment - contract
clause, regulation, board decision, vendor agreement - projects
through an adapter shape onto the field's coord space. The substrate
resolves what it can; the rest projects as references to other
substrates that resolve at their own cadence.

**Reading-mode (DEFINITION 0.5):** The architecture is a closed
abstraction. This phase tests whether the wide claim ("every problem
the conventional stack fragments collapses into one media discipline
over one shared coordinate space") extends to a domain - law - that
the architecture has not previously contemplated. If it extends, the
wide claim strengthens. If it does not, we learn the wide claim's
scope.

-----

## 0. THE CORE QUESTION

Phase 9 demonstrated commitments-as-cascade for the deterministic
case: SLA windows, follow-up deadlines, escalation thresholds.
These resolve at machine speed because their constraint geometry
is fully expressible in cascade rules.

Phase 10 asks whether the same architectural pattern extends to
**legal commitments**: contractual terms (some deterministic, some
standards-based), statutory obligations, regulatory positions, and
case law-derived doctrines. The deterministic portions look the
same as F3's commitments; the standards-based portions resolve on
a different substrate (the legal system itself), at court speed,
through human judgment.

The architectural claim under test: **the legal system is a
substrate.** Its substrate-equivalence is bounded but not zero.
Different judges in different jurisdictions resolve "reasonable"
with variance, but the variance has structure - appellate review
tightens it, stare decisis stabilizes it, doctrines develop joint-
stable shapes through case law. SE-11 (dimensional resolution
across multiple substrates) covers this; courts are one of the
substrates.

If this is correct, the cascade-resolved portions and the court-
resolved portions are both constraint geometry over the same coord
space. The architecture's representation includes both, with
structural attribution showing which substrate is the resolver.

If this is wrong - if legal standards are formless rather than
joint-stably structured - the wide claim does not extend to the
legal domain, and the architecture's framing has a definite outer
boundary at law.

-----

## 1. LAYERS (HIGH-LEVEL)

**Layer L1: Commitment-projection adapter (foundation).**
The K2-class adapter from F3, scaled to handle the full vocabulary
of deterministic legal terms. Payment due dates, notice periods,
liability caps, expiration timestamps, defined terms with explicit
values, condition-action rules. Boolean output through normal
cascade resolution.

**Layer L2: Standards-as-references.**
Constraint geometry that holds judgment-dependent terms ("reasonable
efforts," "material breach," "good faith") as references to the
legal substrate's settlement, not as resolvable cascade rules.
Downstream cascades treat these as opaque constraints that the
local substrate cannot resolve; resolution happens elsewhere.

**Layer L3: Legal-substrate state projection.**
The bridge maintains a snapshot of relevant legal-substrate state:
statutory text, regulatory positions, key case law shapes. Updates
to that state project as constraint changes into the field.
Downstream cascades respond when legal state shifts.

**Layer L4: Joint resolution model.**
Cascade resolves what it can resolve. Legal-substrate references
remain unresolved within the cascade but produce structured output
indicating "this constraint requires legal-substrate resolution
under jurisdiction X with doctrine Y." Downstream consumers (legal
counsel, audit tools, compliance dashboards) receive structured
input rather than handwaved disclaimers.

**Layer L5: Audit and evidence surface.**
The architecture's structural facts - which commitments were in
force at which time, which were checked, what state coords held
when - become evidentiary inputs of unusual quality. Layer L5
produces those surfaces in formats useful for legal proceedings,
regulatory reporting, and contractual dispute resolution.

-----

## 2. EXPLICIT QUALIFICATIONS

**Phase 10 is not a legal-opinion engine.** The bridge does not
predict how courts will rule on novel cases, does not interpret
ambiguous contractual language, and does not provide legal advice.
It projects what the legal substrate has already settled and
surfaces the boundary between what code can determine and what
requires human judgment.

**Legal counsel collaboration is essential.** Every layer's input
data - which case law shapes, which statutory interpretations,
which regulatory positions - requires legal expertise to source
correctly. The bridge is a structural projection of legal-substrate
state; legal-substrate state itself is determined by lawyers, judges,
regulators, and legislators.

**Jurisdiction parameters are first-class.** "Reasonable" in
California differs from Delaware, differs from EU, differs from
UK. The bridge projects per-jurisdiction state; downstream cascades
match against jurisdiction coords.

**The wide claim's outer boundary is honest.** Phase 10's success
condition is not "the architecture resolves law." It is "the
architecture surfaces legal-substrate state structurally, makes the
boundary between cascade-resolvable and court-resolvable visible,
and produces evidentiary outputs useful to legal counsel." That is
a meaningful technical contribution; it is not a replacement for
legal practice.

**Smart-contract negative example.** Blockchain smart contracts
attempted to encode law and either reduced to trivial cases or
invented "oracles" smuggling human judgment back as data feeds.
Phase 10 explicitly does not pretend. The cascade-resolvable
portions resolve in the cascade. The judgment-dependent portions
remain as references; the bridge does not interpret them.

-----

## 3. DEPENDENCIES

**Hard prerequisites:**
- Phase 9 F3 closed. The commitment-projection adapter pattern
  must be working at the K2-class structural level for SLA-grade
  commitments before scaling to legal-grade commitments.
- **Phase 9's SE-01-faithful migration (per PHASE_9_PLAN section
  15).** Phase 10's clean shape depends on configuration living as
  outer cascades, not as bridge-held JS data. Without that
  migration, Phase 10 reproduces the partial form: the bridge holds
  legal-substrate state as configuration. Under the SE-01-faithful
  form, Phase 10 is itself an outer cascade emitting legal-state
  coords; the inner application cascade matches against them. Same
  observation, structurally cleaner expression.
- Phase 9 Layer T closed (or far enough along). Trust topology
  intersects with legal commitments (MNDAs gate cross-boundary
  data sharing; contract terms gate partner integration). L1's
  adapter pattern must compose with T's source-attribution and
  trust policy.
- Phase 9 Layer G's structural argument documented. The data/
  derived distinction L5 audit relies on emerges from G's work.

**Soft prerequisites:**
- Phase 9 Layer S closed. Schema versions are commitments; the
  bridge's projection mechanism overlaps with schema-version
  projection. Doing S first informs L1's design.

**External prerequisites:**
- Legal-counsel collaborator(s). Cannot be solo work.
- Source-of-truth determination for legal-substrate state. (Which
  case law databases? Which jurisdictions' regulatory feeds? Which
  contractual templates as starting points?)

-----

## 4. SCOPE NOT-COMMITTED-TO IN THIS STUB

The detailed structural shape of L1-L5, acceptance criteria,
session estimates, and route enumeration await Phase 9 close and
legal-counsel input. This stub establishes that Phase 10 exists,
its core question, its layer structure at the conceptual level,
and its dependencies.

Detailed plan to be elaborated as PHASE_10_PLAN_OF_CONTINUANCE
v0.x when Phase 9 reaches the point where Phase 10 work can begin.

-----

## 5. WHAT TO BOILERPLATE TODAY

Pending Phase 10's full elaboration, three patterns in Phase 9
layers are clearly bridge-shaped and should be implemented as
hardcoded constants in the near term, with explicit comments
identifying them as Phase 10 replacement sites:

**Layer T (trust boundaries):** Trust policies expressed as
hardcoded cascade rules over source-attribution coords. Boilerplate
shape: `[data-source-class="partner"] { --admit-types: "..." }`.
Phase 10 replaces hardcoded class names with bridge-projected
contractual MNDA states.

**Layer S (schema evolution):** Sunset commitments expressed as
hardcoded date constants in cascade rules. Boilerplate shape:
`[data-schema-version="v1"] { --sunset-iso: "2027-01-01" }`. Phase
10 replaces hardcoded dates with bridge-projected vendor agreement
or policy commitments.

**Layer G (GDPR/deletion):** Article-17 reach expressed as a
hardcoded structural argument plus cascade rules over data-class
coords. Boilerplate shape: data-class taxonomy hardcoded; deletion
semantics hardcoded; Phase 10 replaces with bridge-projected
current legal-substrate state for the relevant jurisdictions.

**F3's commitment-projection adapter:** SLA windows, follow-up
deadlines, and escalation thresholds expressed as hardcoded
constants in the adapter's commitment input. Boilerplate shape:
adapter takes a static configuration object; Phase 10 replaces
the static config with bridge-projected contractual SLA terms.

Each boilerplate site is annotated in code with a TODO referencing
this phase, so the migration surface is discoverable when Phase 10
implementation begins.

-----

## 6. VERSION

PHASE_10_PLAN_OF_CONTINUANCE.md v0.0 stub. Detailed elaboration
deferred to Phase 9 close + legal-counsel input. Inherits the same
spec stack as Phase 9.
