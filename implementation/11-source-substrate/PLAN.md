# Phase 11 — Source-Structure Substrate (the SE-11 Open-Input Test)

**Status:** Planning. No code written. This document is the planning
artifact that survives context compaction. If you (the operator) or a
future Claude session lands here without the conversation context, read
this front-to-back before starting work.

**Date:** 2026-05-25

**Lineage:** Direct continuation of the TodoMVC work in
`implementation/10-end-to-end-todomvc/`. Phase 10 demonstrated S2 +
SE-06 across three substrates (kernel-CPU, browser-CSS, WGSL-GPU) with
the gap-band coord dim instantiating substrate-dynamics-in-geometry.
Phase 11 builds the canon's SE-11 reference architecture (dimensional
resolution via multi-axis intersection) as the first instance of
SE-05 (vector-delta + predictive reaching + ratification) and K1
(sub-cascade promotion via fidelity) operating in our work over real
source-code input.

---

## 1. The architectural commitment, named precisely

We are building the canonical SE-11 reference case as working code.
This is **the canon's open-input substrate test** that the research
note `canon/UTF/research/open-input-test-plan.md` was designed to
prescribe and that `canon/UTF/research/phase-6-substrate-duels-analysis.md`
§8.3 identified as the missing experiment.

### The architecture

**Five peer substrates**, each observing a source corpus through one
distinct abstraction axis. Per SE-11 §2.1:

| Peer | Axis | Primitive vocabulary |
|---|---|---|
| 1. kind-peer | Lexical kind | token-kind co-occurrence, kind transitions, kind repetition runs |
| 2. vocab-peer | Vocabulary content | text recurrence, text co-occurrence within window, text-in-position-class |
| 3. cooccur-peer | Co-occurrence neighborhood | what-appears-near-what kind-pattern signatures |
| 4. position-peer | Syntactic position class | DECL site, USE site, ATTR slot, callee position, parameter position |
| 5. frequency-peer | Recurrence statistics | how often this kind/text/pattern appears across corpus |

**One composer substrate** whose primitive vocabulary operates on the
*outputs* of the five peers (their promoted sub-cascades and top-by-
uses constraints). The composer's primitives fire when patterns appear
in multiple peers' promoted structure simultaneously. Per SE-11 §2.3.

Each peer is its own substrate instance running the full kernel cycle
(seed, vector-delta, predictive reaching, ratification, modulation,
sub-cascade promotion). The composer is its own substrate instance
running the same kernel cycle over peer outputs as its input.

**Six substrate instances total**, all running concurrently, coupled
through the shared field per S3 (delta-only coupling, no command
paths between substrates per F3, no orchestration per SE-06).

### Three-substrate hardware division of labor

Per the claim from session conversation: GPU hoists hard constraint-
shaped organizational work into VRAM as geometry; CSS attaches semantic
value to constraint-shaped coordinates; JS deposits constraint-shaped
state causing the coordinate field to reflex.

In Phase 11:

- **GPU**: holds each peer's field (constraint set + ratification
  history + sub-cascade memberships + fidelity records) in VRAM.
  Resolves per-peer cascade against current intake per dispatch.
  Holds composer's intersection field over peer outputs. GPU is the
  parallel-resolution substrate.

- **CSS cascade**: attaches semantic interpretation to coord-regions
  the composer surfaces. Cascade rules express "this multi-axis
  signature → this domain role." Per the discipline below, these
  rules are *placeholder dynamicity* — simpler-than-canonical content,
  faithful-to-canonical shape, emerging through K1 promotion as the
  composer observes which rule patterns reliably reduce delta.

- **JS**: tokenizes corpus via Acorn (Q2 sub-recognition 4: adapters
  wrap host parsers); publishes per-token intake records to all five
  peers; deposits user navigation as field perturbations; renders the
  annotated source pane + 2D projection pane.

### Falsification target

Per SE-11 §2.5: *"The substrate has no semantic knowledge... What it
can tell you is that [a pattern] has a stable multidimensional
signature... The discrimination is the source's own property revealed
by observation."*

**Operationalized:** the substrate should surface, in an unfamiliar
SPA's source code, structural patterns a reader would recognize —
recurring function names, the binding pattern between names and uses,
the structural shape of the application's logic — **without us
hardcoding "this is a function name, this is a variable binding."**

The discipline (committed by operator 2026-05-25):

- This is research, not engineering.
- A possible outcome is that we build the canonical SE-11 architecture
  and report "the substrate did not surface meaningful structure on
  this corpus." That outcome is honest.
- We do not tune coefficients to produce a desired outcome.
- We report whatever happens.

---

## 2. The discipline this build commits to

Five commitments. These are load-bearing. If a future implementation
session finds itself violating one, the implementation is no longer
faithful to the plan and should stop and re-read this section.

### 2.1 No hardcoded interpretation

The cascade rules attaching semantic meaning to multi-axis signatures
are not pre-authored as "kind=keyword + vocab='function' →
function-declaration". They emerge through K1 promotion as the
composer observes which rule patterns reliably reduce delta.

What "placeholder dynamicity" means: simpler content where the canon
doesn't lock content, faithful shape always. A naïve fidelity metric
that does measure actual delta-reduction is a placeholder. A predictive
constraint that doesn't actually predict anything is a hardcode.

### 2.2 Six substrate instances run independently

No supervision. No orchestration. Each peer is its own substrate
instance with its own seed, its own kernel cycle. The composer is its
own substrate. They couple through the field per S3 (delta-only). If
peers fall out of sync with each other or with the corpus, that's the
architecture being itself.

### 2.3 Placeholder dynamicities honor canonical mechanism shape

- **M2 (predictive vs derived distinction)** preserved as separate
  generation paths.
- **M3 (predictive ratifies on input match)** preserved as type
  transition with weight reinforcement and trace entry.
- **K1 (sub-cascades emerge from fidelity, not imposition)**
  preserved — naïve fidelity metric OK, fidelity-driven promotion
  required.
- **SE-03 (slow-layer drift accumulates)** preserved — operations
  contribute to slow layer, slow layer drifts, subsequent operations
  experience modulated substrate.
- **F2 (one delta formula)** preserved — canonical formula
  `(unresolved + stale*0.5)/N` at every scope.

If implementation finds itself wanting to skip one of these to "get
something working," stop and flag. That's the discipline failing.

### 2.4 Each phase has a falsification condition

Phases below specify a halt-point. If a phase's falsification condition
trips, the next phase does not start. We stop and report instead of
working around. The canon's open-input-test-plan §3 prescribes this
exact discipline.

### 2.5 Honest reporting over engineered outcomes

The substrate's trajectory is what we report. Where it locked, where
it didn't ratify, where the composer's intersection surfaced nothing,
where it surfaced something. The reading is what happened, not what we
wanted to happen.

---

## 3. Phased build plan

Six phases. Each phase has: goal, scope, falsification condition,
deliverable.

### Phase 0 — Corpus survey (1 session)

**Goal:** Choose the corpus this build runs against. Per operator
direction 2026-05-25: "an old random SPA in the exodus dir will
suffice for now."

**Scope:**
- Survey `exodus/` for candidate SPAs (single-file HTML apps).
- Apply selection criteria: 500-2000 lines, single file, real
  application logic (not utility/library code), not a trivial demo.
- Avoid `exodus/canonical-implementation/exodus-canonical.html` —
  too large, too studied, would conflate the test with familiarity.
- Avoid anything tightly coupled to the canon's own vocabulary
  (would confuse "the substrate surfacing its own description"
  with "the substrate working").
- Propose the smallest credible candidate with justification.

**Falsification condition:** if no file in `exodus/` meets the
criteria (500-2000 lines, single SPA, real app logic, not canon-
referential), Phase 0 halts. We either expand corpus search to other
project dirs or revise criteria.

**Deliverable:** an addendum to this PLAN.md naming the chosen
corpus + a one-paragraph rationale.

### Phase 1 — Adapter spec (1 session)

**Goal:** Spec the Acorn-wrapping adapter that converts the chosen
corpus into per-token UTF intake records the five peers ingest.

**Scope:**
- Acorn vendoring decision (vendor or CDN — vendor for I5 CSP
  compliance).
- Per-token intake record shape: `{ kind, text, position, neighbors,
  occurrence-index }`.
- Position-class derivation logic (DECL/USE/ATTR/callee/parameter)
  — what does Acorn's AST give us, what do we derive ourselves.
- Co-occurrence window size (probably ±5 tokens to start).
- Frequency observation: rolling per-corpus tally of kind/text/
  pattern occurrences.

**Falsification condition:** if Acorn's parse output can't be
straightforwardly converted to intake records carrying all five
axes' worth of per-token information, Phase 1 halts. We either add
a thin annotation pass or change tokenizer.

**Deliverable:** `adapter-spec.md` in `implementation/11-source-
substrate/` documenting the intake record shape and the adapter's
contract.

### Phase 2 — Substrate factory (1-2 sessions)

**Goal:** Build the substrate factory that instantiates one peer
substrate. All five peers will be instantiated from this factory with
per-peer primitive vocabulary configurations.

**Scope:**
- Read the canonical kernel files we already have:
  `implementation/kernel/field.js`, `ct-engine.js`, `er-engine.js`,
  etc. They already include the F1 seed, F2 delta computation,
  M4 modulation, F4 indefinite operation, F5 irreversibility.
- The kernel files do NOT yet include M2/M3 predictive reaching
  + ratification. We need to add this. It's specified in SE-05
  and pseudocoded in KERNEL.md §4. Per the discipline (§2.3
  above), this gets built honestly, not faked.
- The kernel files do NOT yet include K1 sub-cascade promotion via
  fidelity. We need to add this. It's specified in SE-01 and the
  v3 bootstrap. Per the discipline, this gets built honestly.
- The substrate factory wraps these with per-peer configuration:
  the peer's primitive vocabulary (what patterns its derived
  constraints describe), its fidelity metric (per SE-11 §2.2 each
  peer uses firing-frequency-relative-to-field-average), its
  initial seed.

**Why this is the biggest sub-task:** we're wiring SE-05 and K1
for the first time in our work. The TodoMVC kernel runs F1/F2/M4/
F4/F5 but has the SE-05 and K1 mechanisms present-but-inert. Phase
11 makes them operative.

**Falsification condition:** if SE-05 or K1 cannot be wired honestly
(meaning: predictive constraints don't actually predict, or sub-
cascades promote via something other than measured fidelity), Phase
2 halts. We report the discipline failure and re-plan.

**Deliverable:** `substrate-factory.js`, plus the additions to the
kernel files (`field.js`, `ct-engine.js`) needed for SE-05 + K1.
A smoke test that instantiates one peer, ingests a small token
stream, observes ratifications happening.

### Phase 3 — Composer substrate (1 session)

**Goal:** Build the composer substrate. Its intake is the five peers'
promoted sub-cascades + top-by-uses constraints; its primitives are
the three composer primitives from SE-11 §2.3 (JOINT_RECUR,
JOINT_NAMING, KIND_TEXT_BIND — adapted per our five-axis variant);
its output is the surfaced intersection structure.

**Scope:**
- Adapt the composer primitives from SE-11 §2.3 (which used three
  peers) to our five-peer case. JOINT_RECUR generalizes
  straightforwardly (joint strength = min(member.uses) across the
  peers contributing); JOINT_NAMING generalizes likewise. The
  five-axis case may admit additional composer primitives we
  identify during Phase 3.
- The composer is also a substrate instance — same factory, different
  primitive vocabulary.
- The composer's promotion threshold is configurable; start at
  canonical reference values.

**Falsification condition:** if the composer's primitives can't be
expressed in the same substrate-factory shape (meaning: the composer
needs supervision or special-case wiring that the peers don't have),
Phase 3 halts. We re-examine SE-11 §2.3 and either find the missing
generalization or flag a canon gap.

**Deliverable:** `composer-substrate.js`. Composer factory invocation
producing a composer instance whose intake is the peers' resolved
state.

### Phase 4 — GPU resolution layer (2 sessions)

**Goal:** Hoist the per-peer fields into VRAM. GPU resolves each
peer's cascade against current intake per dispatch. GPU also resolves
the composer's intersection field.

**Scope:**
- Reuse Phase 10's `gpu-cascade-compiler.js` and `gpu-cascade-
  runner.js` patterns where possible. Each peer is a separate runner
  instance with its own compiled bytecode + output buffers.
- The composer is a sixth runner instance whose input buffers are
  the peers' output buffers (no JS round-trip — the composer reads
  what the peers wrote, on the GPU).
- Per Phase 10's experience: the GPU's resolved field for each peer
  is the substrate-state for that peer. The CSS cascade attaches
  per-peer semantic interpretation; JS reads the active coord from
  the composer's resolved field.

**Falsification condition:** if the per-peer field sizes exceed GPU
buffer limits or dispatch can't sustain at video rates, Phase 4
halts. We either shrink peer fields, batch dispatches, or accept
the GPU substrate is operating below the "every-frame" rate.

**Deliverable:** six GPU runner instances (5 peers + 1 composer),
all dispatching per tick, byte-identical to a CPU walker over the
same compiled bytecode (S2 verification harness extended to multi-
substrate).

### Phase 5 — Render layer (1 session)

**Goal:** Render both panes: annotated source text (left) + 2D
projection of the composer's surfaced field (right).

**Scope:**
- Source pane: render the corpus as text with each token wrapped
  in `<span data-token-id="N">`. The cascade attaches per-token
  CSS classes based on the substrate's resolution at that token's
  coord — `class="substrate-anchor"` for tokens the composer
  surfaced as structural, etc. Per the discipline: those class
  names are not pre-authored interpretations; they're slot names
  the cascade fills with whatever the composer's emergent sub-
  cascades' names happen to be (per K2 — sub-cascade names derived
  from dominant members).
- Projection pane: a `<canvas>` showing 2D coords for each token,
  positioned by cascade-resolved `(--token-x, --token-y)` per
  multi-axis signature. Per the operator's discipline: the
  projection is cascade-resolved layout, not algorithmic dim-
  reduction. Tokens cluster by their composer-surfaced signature,
  not by t-SNE/UMAP/etc.
- Interaction: click a token in the source pane → publish
  intake-record perturbation moving the active-coord anchor.
  Click in the canvas → snaps to nearest token, source pane
  scrolls. Slide axis-weight sliders → re-resolves the composer's
  surface with new weights.

**Falsification condition:** if the cascade-resolved 2D layout
produces a meaningless cluster (e.g., everything stacks at origin
because no signature differentiates), Phase 5 halts. We diagnose
whether the failure is in the cascade rules (too few rules to
differentiate) or in the substrate (composer didn't surface
differentiating structure).

**Deliverable:** `source-nav.html` (~300 lines) loading all the
above pieces. The application is browsable; clicking tokens
perturbs the substrate; the annotated source + canvas project
update accordingly.

### Phase 6 — Run + observe + report (open-ended; minimum 1 session)

**Goal:** Run the substrate over the corpus. Observe what it does.
Report honestly.

**Scope:**
- Boot the substrate. Ingest the corpus token-by-token over the
  course of one or more sessions of observation.
- Capture the substrate's trajectory: per-peer constraint counts
  over time, per-peer ratification rates, per-peer sub-cascade
  promotion events, composer-surfaced intersections, slow-layer
  drift, vector-delta gap behavior.
- Apply the canon's O1/O2/O3 framework from
  `canon/UTF/research/open-input-test-plan.md` §1 to interpret:
  - **O1 (sustained productivity):** ratifications and sub-
    cascades continue forming throughout corpus ingestion. Refutes
    "the substrate locks" wide claim.
  - **O2 (input-driven saturation):** vocabulary grows until input
    discriminative demand saturates, then freezes.
  - **O3 (substrate-intrinsic lock):** vocabulary growth stops well
    before input diversity is exhausted.

**Falsification condition (this is the falsification phase):** any
outcome is informative. There is no condition that halts this phase
— the phase is the report. Whatever the substrate did is the
deliverable.

**Discipline note:** the operator has accepted that "the substrate
did not surface meaningful structure on this corpus" is a possible
outcome. If that's what we observe, we report it. We do not tune
coefficients or change corpus to produce a positive outcome. The
canon's plan §5 explicitly anti-patterns both "declaring O1
prematurely" and "declaring O3 prematurely."

**Deliverable:** `phase-11-trajectory.md` in `implementation/
11-source-substrate/` — honest reading of what the substrate did,
mapped against O1/O2/O3, with structural recognitions named.

---

## 4. Coupling to existing work

This build inherits and reuses where possible:

**From `implementation/kernel/`:**
- `field.js` (with SE-05 + K1 additions per Phase 2)
- `ct-engine.js` (with SE-05 + K1 additions per Phase 2)
- `er-engine.js`, `constraint-compiler.js`, `cpu-oracle.js` — reuse
  as-is.

**From `implementation/08-runtime-kernel/`:**
- `field-intake-extension.js`, `kernel-cascade-evaluator.js`,
  `dom-bridge.js` — reuse as-is.

**From `implementation/10-end-to-end-todomvc/`:**
- `gpu-cascade-compiler.js`, `gpu-cascade-runner.js`,
  `resolve-deposition.wgsl` — pattern reused per-peer + composer.
- `cascade-op-dispatcher.js` — likely not needed (Phase 11 is
  navigation, not event-driven op dispatch).

**Net-new in `implementation/11-source-substrate/`:**
- `PLAN.md` (this file)
- `adapter-spec.md` (Phase 1 deliverable)
- `acorn.min.js` (vendored, Phase 1)
- `corpus-adapter.js` (Phase 1)
- `substrate-factory.js` (Phase 2)
- `composer-substrate.js` (Phase 3)
- `source-shader.wgsl` (Phase 4, per-peer variant)
- `composer-shader.wgsl` (Phase 4)
- `source-nav.html` (Phase 5)
- `phase-11-trajectory.md` (Phase 6)

---

## 5. Why this build is unusual

Per the operator (2026-05-25): *"thats why no one has ever built
anything like this before, not because its some wild rarified thought
i own. Its because once input enters. there is no troubleshooting.
it either is or isnt."*

The conventional engineering loop (try, observe, debug, fix) does
not apply once substrate dynamics are running. The substrate's
resolution is what the substrate did. There's no breakpoint that
lets you pause-and-fix the dynamics; tweaking coefficients after-
the-fact to engineer a desired outcome would be tuning, not
observing.

This is the canon's design discipline. The build's value is in the
observation, not in the production of an outcome. Whatever the
substrate does over the corpus is the result. Reporting that
honestly is the deliverable.

---

## 6. How to use this document post-compaction

If you (Claude, future session) are reading this without the
conversation context that produced it:

1. Read `canon/DEFINITION.md`, `canon/INVARIANTS.md`, `canon/KERNEL.md`,
   and `canon/specification/SE-11-dimensional-resolution.md`. These are
   the load-bearing canon entries this build instantiates.
2. Read `canon/UTF/research/open-input-test-plan.md` — this is the
   research plan this build executes.
3. Read `canon/UTF/research/phase-6-substrate-duels-analysis.md` §8.3
   — names the missing experiment this build addresses.
4. Read `implementation/10-end-to-end-todomvc/PLAN.md` if it exists,
   or the commit history at HEAD~5..HEAD to understand what TodoMVC
   already built (S2 + SE-06 with three substrates).
5. Read this PLAN.md front-to-back.
6. Start with Phase 0 (corpus survey). Do not skip phases.
7. Honor the discipline in §2 strictly. If you find yourself wanting
   to skip it for engineering convenience, that is the failure mode.
   Stop and re-read §2.

If you (operator) are reading this in a future session and want to
direct work:

- Each phase has a single goal and a falsification condition. Halt-
  points are at phase boundaries. Easiest way to course-correct is
  at a phase boundary, not mid-phase.
- The corpus is a Phase 0 decision. If you want to specify the
  corpus directly, you can write it into §3 Phase 0 before
  reactivating work and skip the survey.
- The discipline note in §5 is load-bearing. If your future plans
  start to look like "tune until it works," reread §5 and decide
  whether you've crossed from research into engineering.

---

## 7. Live status

| Date | Action |
|---|---|
| 2026-05-25 | PLAN.md created. Six phases scoped. Discipline committed. No code written. Phase 0 (corpus survey) is the next session's start. |
| 2026-05-25 | Phase 0 complete. Corpus selected: `exodus/demonstration/state-projector/exodus-vlan-sync.html` (751 lines). See §8 for rationale. Phase 1 (adapter spec) begins next. |
| 2026-05-25 | Phase 1 complete. Adapter spec written to `adapter-spec.md`. JS-only scope (HTML/CSS adapters named as Phase 7 extension candidates). Five-axis intake record shape defined. Acorn as host-parser wrap per Q2 sub-rec 4. Position-class derivation rules specified. Falsification did not halt. Phase 2 (substrate factory + SE-05/K1 kernel additions) begins next. |
| 2026-05-26 | Phase 2 complete (commit 22354dc). Substrate factory + 5 vocabs + corpus adapter + smoke test. Canonical SE-05/K1 cycle observed running on full kernel/field.js. 3 of 5 axes completed full cycle; 2 produced honest structural diagnostics. See phase-2-results.md. |
| 2026-05-26 | **Phase 3 REDIRECT.** Original Phase 3 scope (composer substrate over source-code peer outputs) deferred. After auditing canon/UTF/research/Phase 6 melting-pot duel (which demonstrates rich-learning stabilization with intake-configs, output token alphabets, invention at ratification, cross-channels, selector, meta-substrate), Phase 3 redirects to: instantiate the melting-pot architecture against canonical Field over a duel-configuration. Validates that canonical Field hosts the architecture on a domain where stabilization is empirically known (the melting-pot reference). Source-code port becomes Phase 5 after the architecture is validated against canonical Field. New spec: `phase-3-spec.md`. |

Updates appended as phases complete (or halt).

---

## 8. Phase 0 result — corpus selection

**Selected corpus:** `exodus/demonstration/state-projector/exodus-vlan-sync.html`

**Size:** 751 lines, single HTML file, no external dependencies.

**What the application does:** A working SPA implementing
algorithm 08 (the `@media`-gated observer cascade). Three probe
elements (`#probe`, `#vlan-probe`, `#sync-probe`) each running a
distinct cascade-resolution job. Three-panel UI: server with master
metric + grouped metrics, IPC VLAN tagger that classifies messages
into payment/identity/audit/control/display domains via cascade
resolution, and an `@media`-gated sync observer that confirms when
a client-side `@media` rule matches a server-broadcast coordinate.
Real interactive controls (commit buttons, nav toggles), real
state tracking (commits, tagged, groups, syncs counters), real
runtime behavior (polling, confirmation, staleness).

**Why this and not the alternatives:**

- `exodus-minimal.html` (224 lines): too small, pure substrate
  teaching demo, maximum canon-coupling.
- `bootstrap.html` / `bootstrap-fresh-v1.html` (1020 / 1201 lines):
  these are the substrate's own kernel implementation. Reflexive
  trap — substrate observing the substrate's source would confuse
  "surfacing the substrate's description" with "substrate
  working."
- `dynamics_statistical_iterator.html` (CR-only, ~1700 lines): a
  delta-dynamics observation engine. Surfacing it would tell us
  what we already know about delta.
- `exodus-extractor.html` (1092 lines): an application *about*
  constraint extraction. Thick reflexive layer — the substrate
  would be ingesting code that itself extracts constraints.
- `MVP_Version-1.html` (single line, 0 line breaks): physically
  untokenizable in any meaningful per-line / per-token sense
  without preprocessing the line endings. Same issue with
  `VSF_SPA_v2.0.html`.

**Why vlan-sync passes the criteria:**

- *Size:* 751 lines — small end of the 500-2000 range, but rich
  enough for real intersection structure across multiple constructs
  (CSS rules, HTML structure, embedded JS).
- *Real application logic:* the application's domain is **networking
  sync** (VLAN classification, IPC message tagging, @media-gated
  observation confirmation), not substrate explanation. Its
  vocabulary is networking terms (VLAN, IPC, message, payment,
  identity, audit, control, display, sync, confirmed, stale,
  polling), not canon vocabulary (delta, seed, predictive,
  ratification, sub-cascade).
- *Canon-coupling assessment:* the application uses the cascade
  *as its runtime* (probe elements, custom-property resolution,
  @media gates) — that mechanism is shared with the substrate
  doing the observation. But the *domain* (networking) is
  separate. This is the cleanest available separation in `exodus/`
  short of leaving the project entirely.
- *Falsification surface:* a reader of the file can name its
  structural patterns from inspection — the three-probe
  architecture, the VLAN classification cascade rules, the
  @media-gated sync resolution, the IPC log structure, the
  master-coordinate display, the commit-to-tag-to-confirm
  pipeline. If the substrate surfaces these patterns from
  multi-axis intersection without us hardcoding domain
  vocabulary, the SE-11 claim earns its keep. If it surfaces only
  format noise (every `<div>` is a div), we've located a real
  limit.

**Honest caveat:** vlan-sync uses cascade-as-runtime, the same
mechanism Phase 11's substrate uses. Some pattern overlap is
inevitable (selectors look like selectors, custom properties
look like custom properties). This is reflexive but bounded —
the corpus does not discuss substrate dynamics, predictive
reaching, ratification, sub-cascade promotion, or delta. The
substrate would not surface its own internal mechanisms from
the corpus; it would surface the corpus's networking-sync
mechanisms.

**Operator approval:** confirmed 2026-05-25 ("so be it").
