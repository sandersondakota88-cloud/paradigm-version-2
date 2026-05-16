# LESSONS ACCUMULATED

This document records the disciplines that surfaced through corrections during
Phase 9. It exists for the practical purpose of letting a new session pick up
the work without re-learning the corrections that have already been made.

The artifacts in this archive (the regression at 553/553, the per-layer
verifiers, the plan documents) demonstrate the *state*. This document records
the *discipline* that produced the state - the kinds of mistakes that recur in
this paradigm, the shape they take, and the corrections that produced the
right structural reading. Without this, a new session faces the same lessons
fresh, and the corrections are not free.

The lessons below are listed in approximate order of importance for
continuing the work.

-----

## 1. The closure-leak discipline

The single most common mistake in this paradigm: domain code introducing
JS-resident state where geometry should hold the state. The mistake takes
several shapes; they all share the same structural failure.

**Shape A: caching results in JS-resident memory.**
The Phase 7 ABC work named this `reserved-catch-class`. The cascade
correctly resolved which arm fires (geometry); the arm's RESULT lived in
`window.__substrateResults[fnName]` (JS memory). That broke closure:
execution should be `(coords) -> coords`, with input from field, output
back to field. The streaming forms (zero-step / one-step / n-step)
replaced reserved-catch-class because they close the loop.

**Shape B: observer classes returning JS-resident lists.**
T1's first attempt had `TrustObserver.admittedRecords({acceptClass}) ->
JS array`. Same closure leak. The cascade correctly resolved
`--accept-class` (geometry); whatever called the observer then acted on
the array in JS-resident logic. The fix: cascade dispatches `--next-op`
naming an arm; arm runs as CT op; arm's result lands as intake records.
No observer class.

**Shape C: domain code fabricating kernel-internal state.**
Phase 8's P5 detector pushed `kind="predictive"` constraints into
`field.constraints` directly with the kernel's expected shape. The
cascade decision was correct (which deal is stale); the predictive
constraint was fabricated by domain code rather than emerging from the
kernel's mechanism. F3 unwound this by reframing: workflow signals are
*derived* from cascade resolution over commitment + observation coords;
the kernel's predictive mechanism remains untouched.

**Shape D: foreign constraint kinds carrying domain payloads.**
Phase 8's `kind="data"` constraints stored domain records (contacts,
deals) in the field's constraint array. The kernel ignored the foreign
kind, so the violation was silent. F2 retired this by routing domain
records through SE-08 intake; what survives in `field.constraints` is
the substrate's structural response to having observed input, not the
input itself.

**The diagnostic question:** wherever code reaches for "where does the
result go," check whether the answer is "in coords" (correct) or "in JS
memory" (closure leak). The substrate-paradigm answer is always: the
cascade dispatches arms; arms write results back through coords; nothing
actionable lives in JS-resident memory.

**The pattern repeats one layer at a time.** F2 fixed kind="data" at
the constraint-storage level. F3 fixed predictive fabrication at the
kernel-state level. T1's first attempt repeated the mistake at the
dispatch-routing level. Expect to find it again at the next layer up
unless the discipline is held.

-----

## 2. Reframe before extending

When a layer's structural shape feels off, the answer is usually structural,
not engineering. Don't add mechanism to fix bad mechanism; reframe what's
being asked of the architecture.

**F3 was the canonical case.** The original framing was "P5 demonstrates
SE-05 predictive reaching." On structural inspection, the demonstration
didn't actually exercise SE-05's mechanism - the kernel's `_mkPredictive`
runs on character-class divergence over input shape, not on cascade-output
gaps. The question wasn't "how do we route predictives differently?" The
question was "what is the predictive a response to?" Once asked that way,
the answer becomes "a commitment the organization made about deals like
this one." Then the workflow detector becomes a commitment-projection
adapter; the substrate's normal cascade derivation produces the workflow
signal; SE-05's mechanism stays untouched and works for what it was
designed for.

**T1's first attempt was the same pattern.** The question I had been
asking was "where does the trust observer's result list live?" That
question presupposes there should be a result list. The right question
was "what does the cascade dispatch FOR each record class?" Once asked
that way, the answer becomes "each class dispatches its own arm via
`--next-op`; sacrifice arms write only to inert sacrifice coords; no
observer needed."

**The discipline:** when you find yourself adding mechanism, stop and ask
what question the mechanism is answering. If the question presupposes
something un-substrate-paradigm-shaped (a JS-resident list, a fabricated
constraint, a foreign kind), the question is wrong. Reframe.

**The structural test:** the right reframing usually composes existing
primitives (K2, SE-08, cascade resolution, intake) without introducing
new ones. If you're inventing new mechanism to express the answer, the
question may still be wrong, OR you may have hit a real boundary where
formal SE-N extension is warranted. The discipline is to surface this
honestly via D2 rather than silently extend.

-----

## 3. Honest reduction over over-claiming

Phase 8's P5 claimed more than it demonstrated. The corrected reading
("derivation-driven workflow signals" instead of "predictive reaching per
SE-05") is structurally weaker but actually true. The wide claim survives
this kind of reduction; over-claims do not.

**The discipline:** when a layer's claim turns out to be over-stated,
reduce the claim. Do not bend the architecture to support the claim.

**Why this matters for continuing work:** Layer S, Layer G, and Phase 10
will each face moments where the architecture appears to claim something
slightly stronger than it actually demonstrates. The honest move is the
reduction, not the bend. The wide claim's strength is in what it
TRULY demonstrates, not in what it ASSERTS. A reduced honest claim is
information; an over-claim is debt.

-----

## 4. The grammar is the boundary; CT is wiring

The preface names this directly. The implementation enforces it.

CSS's selector grammar defines what predicates are expressible. Cascade
rules use selectors valid per the published spec. Anything outside the
selector grammar cannot be the geometry. CSS custom property semantics
define how typed channels flow. DOM provides the coordinate space.

JavaScript stays at:
- K2 adapter boundaries (input/output: time, network, identity, sensors,
  validators, source-stampers, verifying-stampers)
- Engine internals (cascade evaluator implementing CSS specificity and
  resolution; bridge projecting coords to/from DOM)
- CT arms dispatched by cascade (`--next-op` -> registered function)

JavaScript should not hold:
- Application state (state lives as constraints + intake)
- Decision logic (decisions live as cascade rules)
- Result caches (results land as coords/intake records)
- Trust policies (policies live as cascade rule sets)

**The diagnostic question:** for any piece of work, "is this geometry or
CT?" Geometry goes in cascade rules over coords. CT is what the cascade
dispatches arms to do. If something is supposed to be geometry but the
work is happening in JS, that's the closure-leak shape from lesson 1. If
something is supposed to be CT but it's accumulating state across calls,
the state belongs in coords.

**For Layer S specifically:** schema projection is geometry (cascade
rules match v1-shape coords and derive v2-shape coords) where the
selector grammar can express the projection, AND CT (a K2-class schema-
migration adapter) where the projection requires logic beyond what
selectors can match (string splits, arithmetic, conditional logic).
Layer S's job is to make the boundary between cascade-projectable and
adapter-required visible.

-----

## 5. Sacrificial branches as cascade dispatch

T1's resolved structural shape: cascade rules dispatch `--next-op` for
EVERY record class, including disposal cases. Sacrifice arms run as CT
ops; they write only to inert counter-shape coords; F5 honors
irreversibility (observation deposits change in the sacrifice counter)
but the substrate's actionable coords remain untouched.

**The structural property:** "off into null space" means cascade rule
SELECTORS never reference arm-result or sacrifice coords. The sacrifice
records exist (audit observers can read them); they participate in F5;
but no cascade rule activates from them, so they drive nothing
actionable.

**For continuing work:** anywhere a layer needs to handle "input the
substrate cannot meaningfully act on" - schema mismatches, partition
recovery duplicates, GDPR-reaching regulatory orders, expired
commitments - the right structural shape is a sacrificial arm. Cascade
dispatches the arm; arm writes to inert coord; substrate's actionable
state untouched.

**Verification check:** for any layer's reference cascade rules, the
test "selectors never reference arm-result or sacrifice coords" should
hold. If it doesn't, the cascade is reading its own disposal output -
that's a feedback loop, not geometry.

-----

## 6. Phase 10 boilerplate annotation

Anywhere code references a date, threshold, key, classification, or
policy that came from outside the codebase (a contract, a regulation,
a board decision, a vendor agreement), that's a Phase 10 bridge site.
Today: hardcoded. Tomorrow: bridge-projected from the legal-substrate.

**The discipline:** when introducing such a constant, annotate it
explicitly with a comment referencing PHASE_10_PLAN_OF_CONTINUANCE.md
section 5. This makes the migration surface discoverable without
requiring archaeology.

**Current sites (per STATUS):**
- F3 commitment projector (SLA windows in DEFAULT_COMMITMENTS)
- T1 source registry (DEFAULT_SOURCE_REGISTRY)
- T2 key registry (per-source HMAC keys)
- T3 topology selection (which cascade-rule set per counterparty)

**Coming sites in upcoming layers:**
- Layer S sunset dates (schema-version retirement commitments)
- Layer G data-class taxonomy (Article-17 reach under current law)
- Layer R wire endpoints (which transports for which counterparties)

The cascade-rule pattern that consumes these values is stable across
the migration; only what produces the values changes.

-----

## 7. The compaction-resistant arc

Sessions are compacted; conversation history is fragile. Decisions made
in one session are accessible to the next only if they live in a file.

**What lives in files:**
- Spec stack (PREFACE, DEFINITION, KERNEL, INVARIANTS, SE-01..SE-N)
- Phase plans (PHASE_8_PLAN, PHASE_9_PLAN, PHASE_10_PLAN)
- STATUS.md (current state)
- Verifiers (executable evidence of structural commitments)
- This document (accumulated discipline)

**What lives in conversation only (and therefore must be promoted to
files when relevant):**
- Specific decisions about how to interpret a spec ambiguity
- Lessons from corrections
- Open questions surfaced but not yet resolved
- The user's structural intuitions that pointed at architectural moves

**The discipline:** if a session produces a structural insight that
the architecture should hold across compactions, write it down. This
document is one place; the relevant phase plan is another; STATUS.md
is a third. When in doubt, write it down.

-----

## 8. The user's role in correction

Several Phase 9 corrections came from user prompts pointing at
structural moves I had missed:

- "Could we just use the field's own geometry to protect it?"
  -> T1's geometry-as-trust framing
- "Could the probe act as a sacrificial branch... reserved-catch-class
  to execute an arm adapter off into null space?"
  -> T1's cascade-dispatched arm refactor (the closure-leak fix)
- "Are we still on track for grammars and standards being the boundary
  and core of the geometry?"
  -> Made the grammar/CT distinction explicit and structural
- "Could a technical analysis produce an interesting legal claim
  around what constraints actually are in regards to data?"
  -> Phase 10 (legal-substrate-bridge)
- "What humanistically drives a stale deal or follow-up?"
  -> The commitment-projection framing for F3

**The pattern:** the user often sees the structural move before I do,
because they hold the wide claim and the substrate-paradigm intuition
more cleanly than my reflexive engineering reach. When the user
points at a structural concept (geometry, sacrifice, grammar,
commitment), the right response is to take the concept literally and
work out what it means structurally - not to translate it back into
engineering shapes.

**For continuing work:** when the user uses substrate-paradigm
language (geometry, cascade, projection, deposition, arm, sacrifice),
they are usually pointing at a structural commitment that should be
honored exactly. Don't paraphrase into engineering vocabulary; honor
the term.

-----

## 9. Open questions surfaced through Phase 9 (for the next session)

These questions were surfaced but not yet resolved. They are not
blockers for the layers ahead, but they're structural choices that
will need to be made.

**Q1: Should the process arms be type-polymorphic over external types?**
Currently `processTrustedRecord` looks for `external::record` exactly.
T3's verifier had to use that exact type for the allowed-type test.
A polymorphic arm (find latest `external::*`) would generalize this.
The structural question is whether the arm should care about the
specific type or treat type-classification as the cascade's
responsibility entirely.

**Q2: Are T3's four reference topologies exhaustive or representative?**
peer-trust, partner-trust, public-firewall, open-public are four
specific cascade-rule sets. There may be other meaningful topologies
(e.g., "regulatory-compliance" with jurisdiction-specific gates,
"audit-only" where everything sacrifices but trace is preserved).
The framework supports adding any topology by adding rule sets and
arms; the question is whether the four shipped are sufficient
demonstration.

**Q3: How should Layer S handle un-projectable schema evolutions?**
Cascade selectors can match attribute presence/equality/prefix/
suffix/substring; they cannot do string splits, arithmetic, or
conditional-logic transformations. v1->v2 evolutions that require
such transformations need K2-class schema-migration adapters. The
structural shape is clear; the question is whether the boundary
between cascade-projectable and adapter-required should be made
explicit in the spec (perhaps as a new SE-N) or remain a deployment
concern.

**Q4: When does a sacrificial arm cross from "demonstration" to
"production-ready"?** The sacrifice arms in T1/T2/T3 increment
counter-shape coords and emit trace. In production, would they need
to do more (rate-tracking per source class, per-time-bucket
aggregates, structured audit trail to external observability)? If
yes, those features are still cascade-dispatched arms, just with
richer arm bodies. The structural shape doesn't change.

-----

## 10. Grammar-coverage gaps in the implementation

The preface's claim is that the grammar IS the boundary - what CSS
selectors and custom property semantics admit, the architecture can
express; what they don't admit, it can't. The implementation must
faithfully cover the grammar for that claim to hold.

The architecture's `cascade-rule-synthesizer.js` had at least one
known grammar-coverage gap: it processed only the first custom
property declaration in a rule body. CSS admits multiple property
declarations per rule. The synthesizer silently dropped the second
and subsequent declarations.

Layer S1 surfaced this. A natural projection rule like
`{ --derived-tier: "platinum"; --derived-is-premium: "1"; }`
produced only the first cascade output; the second was silently
lost. The initial S1 ship used a workaround: split each multi-
property rule into N one-property rules. Functional but
structurally wasteful: 6 logical projections became 12 cascade
rules; specificity calculus and rule ordering had to be reasoned
about for the split form.

**Status: closed for two known gaps.**

Gap 1: Phase 9's architectural decision (PHASE_9_PLAN sec 15)
committed to honoring SE-01 (compositional cascades) fully; that
commitment requires the synthesizer to be faithful to the grammar.
The synthesizer was updated so `synthesizeOne` returns an array of
constraints (one per declaration) sharing the same selector. Callers
(`synthesizeFromCss`, `synthesizeFromParsedRules`) flatten. S1's
REFERENCE_PROJECTION_RULES migrated from 12 split rules back to 6
grammar-faithful multi-property rules; the synthesizer expands them
to 12 constraints internally.

Gap 2: surfaced during cascade-extrusion proof-of-concept work. The
subset validator rejected presence-only attribute selectors (e.g.
`[data-x]` without `=value`), allowing only the `[data-substrate-
state]` special case. Catch-all rules using presence-only selectors
(typical for outer-cascade defaults) couldn't be expressed. Per
the same grammar-faithfulness commitment, the validator now admits
presence-only selectors uniformly. The synthesizer already supported
them in `synthesizeOne` (sets selectorMap[name] = "*"); the
validator gate was the bottleneck.

**The recurring discipline.** Per the preface, the implementation
that doesn't fully cover the grammar undermines the threshold-
crossing claim by limiting what the architecture can express.
Future grammar-coverage gaps should be surfaced when discovered and
closed rather than worked around.

**Other potential gaps to inspect** (open questions for inspection
work, not yet known to be problems):
- Do all CSS selector forms (descendant, child, sibling combinators;
  pseudo-classes; @-rules) parse and synthesize correctly?
- Does the synthesizer handle non-custom-property declarations? Per
  Path C / SE-01-faithful operation, deployments may bind to inert
  standard properties; the synthesizer should treat property names
  uniformly rather than special-casing custom properties.
- Are there edge cases in value parsing (whitespace, escape
  sequences, multi-token values) where the synthesizer diverges
  from the published CSS value-parsing grammar?

These are questions for synthesizer-faithfulness inspection work,
not workarounds to apply preemptively. The discipline is: when a
layer needs a cascade-rule pattern that should work per the grammar
but doesn't work in the synthesizer, surface the gap and close it
rather than working around it.

-----

## 11. Compositional cascades (the geometry-extruding-geometry framing)

The architecture's most under-used spec primitive is SE-01, and Phase
9 surfaced this through a sequence of corrections that pointed at the
same structural property without naming it. This entry names the
property and connects it to what SE-01 already commits to.

**The naming.** "Geometry extruding from geometry" is the user's
phrase for what happens when one cascade pass produces coords that a
later cascade pass matches against. The producing rules and the
matching rules are both in the cascade; the output of the first pass
becomes the input shape of the second; the substrate's geometry
produces, from itself, the structure that holds it. This is
extrusion in the dimensional sense - lower-rank structure gives
rise to higher-rank structure.

**This is SE-01.** Re-reading SE-01 with this framing makes clear
that compositional cascades have been a committed property of the
formalism since April 2026:

> "A cascade may be arranged such that its coordinates reference
> other cascades. The outer cascade resolves first - its rules
> determine which sub-cascade is active for a given outer
> coordinate. The sub-cascade then resolves against its own rules."

And:

> "Compilation is a reading, not an operation. When an outer cascade
> resolves a coordinate to an output that selects or determines a
> sub-cascade's applicability, this is classical compilation in a
> precise sense: the outer cascade takes input (an outer coordinate)
> and produces output (a resolved sub-geometry ready to be resolved
> in turn). This is what compilers do."

What we have been calling "configuration the bridge holds" is, per
SE-01, an outer cascade we have been failing to express as cascade
rules. T1's `DEFAULT_SOURCE_REGISTRY` (sourceId -> sourceClass) is
an outer cascade. T2's `keyRegistry` (sourceId -> verification key
identifier) is an outer cascade. T3's topology selection (deployment
-> rule set) is an outer cascade. F3's `DEFAULT_COMMITMENTS` (SLA
threshold, active stages) is an outer cascade. The Phase 10
boilerplate inventory (six bridge sites in STATUS) is six outer
cascades the architecture has been treating as JS-side configuration.

**The architectural decision.** The work going forward honors SE-01
fully: cascade-resolvable configuration lives as cascade rules.
Bridge-held configuration is structural debt to migrate. Layers
ahead inherit the compositional shape from the start.

This is not a new spec extension. It is recognition that we have
been under-using a primitive that has been available since SE-01
and has been load-bearing in the architecture's claim from the
start.

**The wide claim, full form.** The preface says "the grammar carries
the machine." The strongest reading is that the grammar carries the
machine *entirely* - application logic, configuration, policy,
deployment binding, schema, trust topology, commitments. SE-01's
compositional cascades are the mechanism by which the grammar can
do this. Until we honor SE-01 fully, the grammar carries the
application but not the configuration; configuration lives in JS as
parameters to the bridge; the artifact is not fully substrate-
portable because a different resolver could not pick it up without
also being given the configuration through a separate channel.

After honoring SE-01 fully, the deposition includes its full
operational vocabulary as cascade rules. The bridge becomes a
generic state-projector (read inputs as coords, write outputs from
coords) without knowing what specific coords mean. The artifact
carries its own interpretation. Substrate-portability becomes the
strong form: any CSS engine plus DOM is sufficient resolver, full
stop.

**The pattern of corrections that surfaced this.** Each Phase 9
correction has been a partial recognition of compositional cascades:

- F2 retired `kind="data"` and routed domain records through intake.
  This was honoring SE-08 fully. The corrected reading: domain
  records are an outer cascade's input; the substrate's structural
  response to having observed them is an inner cascade's resolution
  over derived coords.

- F3 reframed P5's workflow detector as a commitment-projection
  adapter. The corrected reading: commitments are an outer cascade
  emitting commitment-state coords; deal observation is another
  outer cascade emitting deal-state coords; the workflow signal is
  an inner cascade resolving over the gap between the two.

- T1's first attempt had TrustObserver returning JS-resident lists
  of admitted records. The corrected reading: source classification
  is an outer cascade emitting class coords; admission is an inner
  cascade dispatching arms based on those coords.

- S1's projection rules express schema-version-tagged outer cascades
  emitting canonical coords for an inner v3 application cascade to
  match. This was already in the SE-01-compatible form, partially.

Each layer has been edging toward compositional cascades. The user
named the pattern explicitly; SE-01 was already there waiting.

**Implementation depth.** Honoring SE-01 fully has three layers of
work, in increasing scope:

1. *Synthesizer faithfulness* (closes Lesson 10's debt). The
   synthesizer must process the full grammar - all custom-property
   declarations per rule body, and ideally all CSS property
   declarations per rule body without special-casing custom
   properties. CSS admits multiple declarations per rule; the
   synthesizer should match the grammar.

2. *Bridge generalization*. The bridge today knows specific
   conventions: data-* attributes are coords, --* custom properties
   are cascade output, the state element has id "substrate-state".
   Under SE-01-faithful operation, the bridge becomes generic: it
   reads whatever coords the deposition tells it to read, projects
   them via the cascade, writes back whatever coords the cascade
   produces. The conventions move from bridge code into the
   deposition.

3. *Multi-pass orchestration*. SE-01 explicitly admits multi-level
   composition: outer cascade resolves; output of outer pass becomes
   input to inner pass. The architecture today resolves a single
   pass. Multi-pass requires either (a) the bridge orchestrates
   passes by writing cascade output back as coord inputs and re-
   running, (b) the cascade evaluator does fixed-point iteration
   internally, or (c) the deployment uses CSS Cascade Level 5's
   `@layer` mechanism to declare layer ordering, which the
   evaluator honors.

(c) is the most grammar-faithful since `@layer` is published spec.
(a) is the simplest to implement and is what S1's verifier already
does (projection pass + application pass in sequence). (b) is
between them in complexity.

**Migration of layers already shipped.** T1/T2/T3 registries, F3
commitments, and any other JS-side configuration in completed
layers are structural debt against the SE-01-faithful form. The
debt is tracked but not blocking; the layers as shipped work
correctly under the partial form. Migration ports each registry to
cascade rules; the K2 adapter shrinks; the cascade gains the outer-
cascade rules; the verifier asserts the new structural shape.

**Layers ahead** (S2, S3, N, G, O, R, Phase 10) inherit the
compositional shape from the start. Their cascade rules express the
deployment's full operational vocabulary; their K2 adapters do
generic state projection; their configuration is geometry.

**Recursive consequence.** SE-01 already notes that compositional
cascades make compilation a reading rather than an operation. The
deeper recursive consequence: the architecture's *spec* can live as
compositional cascades. The invariants, SE extensions, and
DEFINITION's structural commitments are a vocabulary; each could be
expressed as cascade rules over architectural-coord coords; an
invariant violation becomes a cascade output coord that observers
can read; the spec checks itself. This is not work for the immediate
phase; the path is open.

**Why this entry is in LESSONS rather than as a new SE-N.** SE-01
already covers the structural property. What was missing was full
implementation that honors it. This entry records the recognition,
the architectural decision to honor SE-01 fully, and the
implementation depth that follows. Future sessions will continue
that work; the lesson is that SE-01 is more powerful than the
implementation has been treating it.

-----

## How to use this document if you are a new session

1. Read PREFACE.md first. The structural observation is upstream of
   everything else.

2. Read DEFINITION.md section 0.5 (the reading-mode discipline). The
   architecture is closed; misreadings don't change it.

3. Skim INVARIANTS.md (33 invariants). You don't need to memorize them
   but recognize their categories: F (foundational), C (closure), M
   (mechanism), K (composition), S (substrate), I (implementation),
   D (documentation), O (observation), X (configuration).

4. Read STATUS.md for current state.

5. Read PHASE_9_PLAN_OF_CONTINUANCE.md, then this document. The plan
   describes layers; this document describes the disciplines that have
   surfaced through implementation.

6. When picking up implementation work, run the regression first
   (`node run-all.js`). If it's not green, something is wrong.

7. The path forward per the plan is Layer S (schema evolution), then N
   (network partitions), then G (GDPR/derived distinction), then O
   (observability), then R (real-time transport). Phase 10 (legal-
   substrate-bridge) waits for legal counsel collaboration.

8. When in doubt about a structural move, the diagnostic questions
   from this document apply: where does the result go (coords or JS)?
   what is the cascade FOR in this problem? is this geometry or CT?
   what spec primitive composes here, or is this a new SE-N?
