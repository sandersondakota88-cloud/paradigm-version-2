# PROJECT PLAN

How this project is organized, what each part is for, and what the
current state of the work is. **Live document — updated as work
progresses.**

This is the entry-point for anyone (or any future-you) arriving at
the project. If you read three documents at the root, read them in
this order:

1. [PREFACE.md](PREFACE.md) — the structural claim the work is
   evidence for.
2. [ARCHITECTURE.md](ARCHITECTURE.md) — what the work fundamentally
   *is*, structurally, named with the words that fit it.
3. [RESEARCH-AGAINST-PREFACE.md](RESEARCH-AGAINST-PREFACE.md) —
   four specific objections to the preface and what the demonstrations
   have established against each.

This document (PROJECT-PLAN.md) is the fourth: it tells you where
everything else lives and what it is for.

-----

## 0. The layers (read this first)

The project has five conceptual layers. Each is owned by specific
documents and directories.

| Layer | What it is | Where it lives |
|---|---|---|
| **Claim** | The structural observation the work demonstrates | [PREFACE.md](PREFACE.md) |
| **Architecture** | What the substrate fundamentally is (kernel + adapters + universal type format + hardware) | [ARCHITECTURE.md](ARCHITECTURE.md) — sits at the root because it reorganizes how every other layer fits |
| **Specification** | The canonical structural commitments (invariants, definitions, kernel pseudocode, algorithm catalog, spec extensions) | [canon/](canon/) |
| **Implementation** | Running code that exercises the specification | [implementation/](implementation/), [exodus/canonical-implementation/](exodus/canonical-implementation/) |
| **Research/audit** | What demonstrations have established, and against what claims | [RESEARCH-AGAINST-PREFACE.md](RESEARCH-AGAINST-PREFACE.md), test files within each implementation |

The layers are not parallel. Each upper layer depends on the layers
below it. The claim depends on the architecture being structurally
real; the architecture depends on the specification being honored;
the specification depends on implementations to demonstrate it; the
research depends on implementations to test against.

-----

## 1. The top-level files at project root

| File | What it is | When to read it |
|---|---|---|
| [PREFACE.md](PREFACE.md) | The structural claim, stated cleanly | First, always |
| [ARCHITECTURE.md](ARCHITECTURE.md) | What the substrate is, structurally — kernel/adapter naming | Second, after the preface |
| [RESEARCH-AGAINST-PREFACE.md](RESEARCH-AGAINST-PREFACE.md) | Live catalogue of evidence against four specific preface objections | When evaluating whether the claim is supported |
| [PROJECT-PLAN.md](PROJECT-PLAN.md) | This document — project organization, current state, next work | When orienting to the project as a whole |

Anything at project root is load-bearing for project-wide
orientation. Specifics live in subdirectories.

-----

## 2. canon/ — the specification

The specification stack. What the architecture is *required* to be
in any faithful implementation.

| Document | Role |
|---|---|
| [canon/DEFINITION.md](canon/DEFINITION.md) | Canonical reference; §0.5 sets reading-mode for the whole project |
| [canon/KERNEL.md](canon/KERNEL.md) | Pseudocode reference for the substrate's operational core |
| [canon/INVARIANTS.md](canon/INVARIANTS.md) | Twenty-five named structural commitments; checklist for any implementation |
| [canon/algorithm/](canon/algorithm/) | The numbered algorithm catalog (00-INDEX through 22). Each entry specifies one mechanism. |
| [canon/specification/](canon/specification/) | Spec extensions SE-01 through SE-11. Each names a structural property the formalism supports |

**Reading order within canon (per [meta/MANIFEST.md](meta/MANIFEST.md) §"Reading order"):**
DEFINITION (with §0.5) → INVARIANTS → KERNEL → algorithm/00-INDEX
→ SE-01 through SE-11 → individual algorithm entries as needed.

**What canon does not contain:** running code, demonstrations, or
empirical results. Those live in `implementation/` and
`exodus/canonical-implementation/` and are *evidence* against canon;
canon is what the evidence is evidence *for*.

-----

## 3. implementation/ — the running code (current track)

The phased implementation that exercises canon. Each phase produces
artifacts and tests.

| Phase | What it builds | Status |
|---|---|---|
| [implementation/02-er-engine/](implementation/02-er-engine/) | Experiential Reality engine (the rendering substrate of [SE-06](canon/specification/SE-06-substrate-duality.md), now reframed as the "parallel-class adapter" per [ARCHITECTURE.md](ARCHITECTURE.md)) | Shipped |
| [implementation/03-ct-engine/](implementation/03-ct-engine/) | Critical Thought engine (the execution substrate of SE-06; now reframed as the "sequential-class adapter") | Shipped (SE-06 implementation, 8/8) |
| [implementation/04-expressive/](implementation/04-expressive/) | Reflexive surface, compound constraints, storage substrate, promoted templates | Shipped, 53/53 |
| [implementation/05-coupling/](implementation/05-coupling/) | Coupling verification | Shipped, 115/115 with regression |
| [implementation/05.6-validation/](implementation/05.6-validation/) | Pressure tests beyond Phase 5 | Shipped |
| [implementation/05.7-variants/](implementation/05.7-variants/) | Substrate stack on WASM input. **Key finding: byte-native intake verified at Spearman ≥ 0.85 on real WASM modules.** Demos in zip form. | Shipped, archived |
| [implementation/07-consumption/](implementation/07-consumption/) | Phase 7 stages | In progress |
| [implementation/08-runtime-kernel/](implementation/08-runtime-kernel/) | Runtime kernel work. **Closely related to ARCHITECTURE.md's kernel layer — these should be cross-referenced.** | In progress |
| [implementation/09-trust-boundaries/](implementation/09-trust-boundaries/) | Trust boundaries | In progress |
| [implementation/05.5-cleanup-trajectory/](implementation/05.5-cleanup-trajectory/) | Phase 6 research notes | Reference |

**Cross-reference note.** The `08-runtime-kernel/` directory work
predates the ARCHITECTURE.md naming. The two may need reconciliation
— specifically, whether the kernel artifact described in
ARCHITECTURE.md §5 + §6.3 is a continuation of `08-runtime-kernel/`'s
work or a new track. **This is an open organizational question.**

-----

## 4. exodus/canonical-implementation/ — the GPU bridge demonstration

The earlier-era canonical implementation that produced the
substrate-independence demonstrations central to objection 4. **Still
live and load-bearing.**

| Component | What it does |
|---|---|
| [exodus/canonical-implementation/constraints.mjs](exodus/canonical-implementation/constraints.mjs) | Shared constraint specification (the deposited geometry) |
| [exodus/canonical-implementation/css-oracle.mjs](exodus/canonical-implementation/css-oracle.mjs) | Cascade-engine adapter (reference resolver) |
| [exodus/canonical-implementation/oracle.mjs](exodus/canonical-implementation/oracle.mjs) | JS-stack-machine adapter (bytecode resolver) |
| [exodus/canonical-implementation/resolve.wgsl](exodus/canonical-implementation/resolve.wgsl) | WebGPU-shader adapter |
| [exodus/canonical-implementation/compile-constraints.mjs](exodus/canonical-implementation/compile-constraints.mjs) | Compiler from rule set to postfix bytecode |
| [exodus/canonical-implementation/harness.mjs](exodus/canonical-implementation/harness.mjs) | Browser-side three-substrate verification harness |
| [exodus/canonical-implementation/tests/](exodus/canonical-implementation/tests/) | Phase A, Phase B, and the four extension/boundary tests (NOT-1, NOT-2, 4a, 4b stratified/mutual/aggregate) |
| [exodus/canonical-implementation/CLAUDE.md](exodus/canonical-implementation/CLAUDE.md) | Working-notes discipline file for AI agents touching this directory |

This directory is the empirical floor for everything in
[RESEARCH-AGAINST-PREFACE.md](RESEARCH-AGAINST-PREFACE.md) objections
1 and 4. The byte-identical equivalence claim (CSS = JS = WGSL across
2,602 constraint sets, ~45 million field-level comparisons) lives
here.

**Sub-directory: [exodus/canonical-implementation/tests/extensions/](exodus/canonical-implementation/tests/extensions/)**
Where the boundary research lives. Each sub-directory under
`extensions/` is one experiment along one closure-property axis:
- `not-1/` — single-dim NOT extension (byte-identical preserved)
- `not-1/not2-boundary.test.js` — compound NOT boundary (syntactic limit, DNF bridge)
- `reduction-4a/` — cross-coord reductions (structural limit, no in-grammar workaround)
- `dependence-4b/` — cross-coord dependence: stratified, mutual, aggregate (machine-shape limits and beyond)

-----

## 5. exodus/ — historical and adjacent material

The `exodus/` directory holds work that produced the architecture or
is preserved alongside it but is not part of the active implementation
track.

| Subdirectory | Role | Live or archive? |
|---|---|---|
| [exodus/canonical-implementation/](exodus/canonical-implementation/) | The GPU bridge demonstration — see §4 above | **Live** |
| [exodus/the-spec/](exodus/the-spec/) | Proto-spec documents preceding the current canonical specification | Archive |
| [exodus/software-concepts/](exodus/software-concepts/) | Earlier exploration documents on WebGPU bridge concepts; mostly superseded by canon | Archive |
| [exodus/theory/research/](exodus/theory/research/) | Research notes that informed the spec | Archive (informative) |
| [exodus/retired/](exodus/retired/) | Explicitly retired earlier material | Archive |
| [exodus/demonstration/](exodus/demonstration/) | Earlier demonstration artifacts | Archive |
| [exodus/roadmap/](exodus/roadmap/) | Earlier roadmap material | Archive |

**Important.** Per the user's instruction recorded in the project's
working agreement: **`exodus/canonical-implementation/` is live and
must not be casually modified.** It carries the 66/66 + 22/22 test
record and the Phase A/B + boundary research. Touch it only through
its tests and only with explicit reason.

-----

## 6. meta/ — project organization documents

| Document | Role |
|---|---|
| [meta/MANIFEST.md](meta/MANIFEST.md) | File-by-file classification (CANON vs ARCHIVE), reading order, target structure |
| [meta/IMPLEMENTATION_PATH.md](meta/IMPLEMENTATION_PATH.md) | Phased engineering plan (Phases 1-5 and beyond); live status of each phase |
| [meta/PROJECT_SPLIT.md](meta/PROJECT_SPLIT.md) | The ER/CT two-engine split (now re-readable as the parallel-class vs sequential-class adapter split per [ARCHITECTURE.md](ARCHITECTURE.md)) |
| [meta/CONTRIBUTING.md](meta/CONTRIBUTING.md) | Working conventions and threat model |
| [meta/DOCS-orientation.md](meta/DOCS-orientation.md) | A GPU-bridge-harness readme (misleadingly named; consider renaming to `meta/gpu-bridge-readme.md`) |
| [meta/DEDUP-ACTIONS.md](meta/DEDUP-ACTIONS.md) | Action list for file deduplication |
| [meta/AMENDMENT_2.4.md](meta/AMENDMENT_2.4.md), [meta/amendments/](meta/amendments/) | Spec amendments |
| [meta/producing-the-stylesheet.md](meta/producing-the-stylesheet.md) | A through-line narrative of the work; useful for orientation but not load-bearing for the architecture itself |
| [meta/retired-docs/](meta/retired-docs/) | Earlier versions of canonical documents, preserved with timestamps |

**Note.** `DOCS-orientation.md` is misnamed (it is not a docs-
orientation; it is a GPU-bridge readme). Renaming is a low-priority
cleanup; it's flagged here so future readers don't waste time on the
mismatch.

-----

## 7. The current pivot

As of 2026-05-15, the work has reached a structural recognition that
reorganizes everything that came before. **The substrate is a
kernel-and-adapter architecture, in the precise operating-systems
sense.** This is documented in [ARCHITECTURE.md](ARCHITECTURE.md).

### What this changes

- **Every existing algorithm has a position in the layering.** Some
  are adapter protocols (algorithm 12, 16); some are kernel
  primitives (algorithm 02 delta computation, algorithm 13 content
  addressing); some are universal-type-format pieces (algorithms 09,
  10, 11); some are cascade-layer constructs built on the kernel
  (algorithm 04, SE-01).
- **Every spec extension is a property of one specific layer.**
  SE-06 (substrate duality) is the property "two adapter classes
  coexist on one kernel." SE-10 (resolution accretion chains) is
  the property "kernels can be sequenced." SE-11 (dimensional
  resolution) is the property "the same constraint geometry resolves
  across substrates with different dimensional characters."
- **The preface gains a structural argument.** What language inherits
  is kernel-shape specifically, not generic machine-shape. The
  hardware-implication paragraph becomes a consequence, not a
  speculation. See [ARCHITECTURE.md §7](ARCHITECTURE.md).

### What this does not change

- Canon is still authoritative. The kernel/adapter naming reorganizes
  *how canon is read*; it does not modify the underlying commitments.
- Existing demonstrations (Phase A/B, NOT-1, NOT-2, 4a, 4b, Phase
  5.7) still hold. They have been re-read in the new vocabulary but
  not invalidated.
- The empirical record in [RESEARCH-AGAINST-PREFACE.md](RESEARCH-AGAINST-PREFACE.md)
  is still valid. The kernel/adapter recognition strengthens it,
  particularly for objection 2.

-----

## 8. Open work (in priority order)

Three pieces of specification work and one piece of implementation
work are now load-bearing. Listed in the order their dependencies
require:

### Priority 1 — Specify the universal type format
**Document to write:** `canon/universal-type-format.md` (or
equivalent location)
**Closes:** [ARCHITECTURE.md proof gap §6.1](ARCHITECTURE.md)
**Why first:** Every other layer depends on this. Adapters speak it,
the kernel routes it, applications are made of it. Without a written
schema, the architecture exists as recognition but not as
specification.
**Sources to cite:** algorithms 09, 10, 11, 13 (binary form pieces);
the implicit shape in `constraints.mjs`; the Phase 5.7.7 persistence
format.

### Priority 2 — Specify the adapter protocol
**Document to write:** `canon/adapter-protocol.md`
**Closes:** [ARCHITECTURE.md proof gap §6.2](ARCHITECTURE.md)
**Why second:** Once UTF is specified, the adapter protocol is
"what an adapter must do with UTF nodes on the kernel side." This
formalizes the contract every existing adapter implicitly honors.
**Sources to cite:** algorithm 12 (IPC), algorithm 16 (GPU bridge),
SE-06 (substrate duality), the IndexedDB adapter from Phase 5.7.7.

### Priority 3 — Implement the kernel as a discrete artifact
**Code to write:** ~100-300 lines of host-language code implementing
the discretion router + state object + adapter notification, with
an example adapter set
**Closes:** [ARCHITECTURE.md proof gap §6.3](ARCHITECTURE.md)
**Why third:** With UTF and the adapter protocol specified, the
kernel becomes a buildable artifact. Verify against the canonical
loan program for byte-identical output through (kernel+CSS-adapter),
(kernel+JS-adapter), (kernel+WGSL-adapter).
**Cross-reference:** [implementation/08-runtime-kernel/](implementation/08-runtime-kernel/)
may already be partially this work — reconcile before starting fresh.

### Priority 4 — Demonstrate substrate relocation across hosts
**Experiment to run:** serialize a live substrate state from one
host (CPython, Node, or any non-browser host), deserialize into a
browser, verify state identity
**Closes:** [ARCHITECTURE.md proof gap §6.4](ARCHITECTURE.md);
[RESEARCH-AGAINST-PREFACE.md](RESEARCH-AGAINST-PREFACE.md) objection 2
**Why fourth:** Depends on priority 1 (the format being serializable)
and priority 3 (the kernel being implementable in multiple hosts).
This is the strongest version of the substrate-portability claim.

-----

## 9. The four objections and their current status

Summarized from [RESEARCH-AGAINST-PREFACE.md](RESEARCH-AGAINST-PREFACE.md);
read that document for the full evidence.

| # | Objection | Status after architecture recognition |
|---|---|---|
| 1 | Threshold metaphor doing more work than it earns | **Addressed in the web-platform case, and sharpened structurally.** [ARCHITECTURE.md §7](ARCHITECTURE.md) reframes the threshold-crossing as "becoming kernel-shape." Generalization to other languages remains untested. |
| 2 | Hardware implication is overreach | **Structurally answered by the architecture; empirically open.** Kernel-and-adapter is *by definition* the layer that makes hardware diversity invisible. Closing the gap empirically requires Priority 3 + Priority 4 work above. |
| 3 | Closed-abstraction posture is epistemically convenient | **Tension named.** DEFINITION §3.8 now cites empirical validation; §0.5 still disclaims it. Not closed; a content decision for the author. |
| 4 | Engineering core vs thesis wrapping | **Addressed in canon.** Algorithm 16 is IMPLEMENTED with the empirical record. ARCHITECTURE.md names what the engineering core demonstrates. The preface remains the author's framing. |

-----

## 10. Working conventions

These conventions hold throughout the project. Implementers (human or
agent) should follow them.

- **Canon is authoritative.** Modifications to anything in `canon/`
  require explicit reason and audit of citations elsewhere in the
  project.
- **`exodus/canonical-implementation/` is live and protected.** The
  66/66 + 22/22 + Phase A/B + boundary record lives here. Don't touch
  the canonical files without reason; new work goes in
  `tests/extensions/` or similar.
- **Spec extensions (SE-N) are expressive, not load-bearing.** Per the
  user's recorded preference, SE-N files describe properties the
  formalism supports; they do not become structural commitments
  themselves. Load-bearing commitments live in INVARIANTS, algorithm
  entries, and DEFINITION.
- **Proof gaps are named, not hidden.** When the work has not
  demonstrated something the architecture claims, the gap is
  recorded explicitly. See [ARCHITECTURE.md §6](ARCHITECTURE.md) for
  the current set.
- **The catalogue ([RESEARCH-AGAINST-PREFACE.md](RESEARCH-AGAINST-PREFACE.md))
  is live.** As new findings arrive, append to it with date stamps.

-----

## 11. Live status log

| Date (yyyy-mm-dd) | Event |
|---|---|
| 2026-05-15 | PROJECT-PLAN.md created. ARCHITECTURE.md created naming the kernel/adapter structure. RESEARCH-AGAINST-PREFACE.md previously established. The four preface objections, the empirical record (Phase A/B + NOT-1 + NOT-2 + 4a + 4b), and the architecture's structural naming are now coherent at the project-root level. |

Updates appended as canonical specification work proceeds, the
kernel is built, substrate relocation is demonstrated, or other
structural recognitions emerge.
