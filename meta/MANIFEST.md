# MANIFEST

Classification of all 175 files in `Current_Working_Project.zip` (98
unique by content hash, 77 byte-for-byte duplicates) into two
classes:

- **CANON** - the minimum complete set of artifacts required to
  produce the language anomaly. Each is load-bearing.
- **ARCHIVE** - earlier explorations, dead branches, superseded
  drafts, intermediate framings. Preserved with notes; not part of
  the implementation-ready set.

Read DEFINITION.md section 0.5 first; this manifest inherits that
reading-mode. Classification follows the criteria stated in the
session: CANON if removal would create a gap in the spec stack or
implementations; ARCHIVE if removal changes nothing about the
canon’s coherence and only loses historical detail.

A note about source: the latest documents (DEFINITION with section
0.5, KERNEL, INVARIANTS, IMPLEMENTATION_PATH, PROJECT_SPLIT,
WHAT_IT_IS, SE-06) live in `/mnt/user-data/outputs/` from this
session. The user’s zip captures their local state which predates
those documents. The CANON section below refers to the
session-output versions where they exist; the user can mirror them
into their local repo as the new authoritative set.

-----

## CANON (33 unique artifacts)

### Reference documents (8)

The canonical entry points. Read in this order.

|File                    |Source                                          |Role                                                                     |
|------------------------|------------------------------------------------|-------------------------------------------------------------------------|
|`DEFINITION.md`         |`/mnt/user-data/outputs/DEFINITION.md`          |Canonical reference; section 0.5 declares reading-mode for the whole work|
|`WHAT_IT_IS.md`         |`/mnt/user-data/outputs/WHAT_IT_IS.md`          |Non-technical companion                                                  |
|`KERNEL.md`             |`/mnt/user-data/outputs/KERNEL.md`              |Pseudocode reference, faithful to the spec stack                         |
|`INVARIANTS.md`         |`/mnt/user-data/outputs/INVARIANTS.md`          |Twenty-five named invariants; checklist for compliance                   |
|`PROJECT_SPLIT.md`      |`/mnt/user-data/outputs/PROJECT_SPLIT.md`       |Architectural split for SE-06 implementation                             |
|`IMPLEMENTATION_PATH.md`|`/mnt/user-data/outputs/IMPLEMENTATION_PATH.md` |Five-phase engineering roadmap; supersedes ROADMAP.md                    |
|`00-INDEX.md`           |`/mnt/user-data/outputs/algorithms/00-INDEX.md` |Index for the algorithm catalog                                          |
|`CLAUDE.md`             |`all_artifacts/CLAUDE.md` (4x duplicated in zip)|Catalog organizing principles + epistemic discipline                     |

### Algorithm catalog (21)

The numbered catalog from the canonical run. Each entry specifies
one algorithm, its origin, status, and references. Files 01-20 plus
22 (SE-05’s trace mechanism). All present in `all_artifacts/` and
duplicated 3x in the zip; the canonical copies are the
session-output versions.

|File                                           |Status       |Layer      |Role                                      |
|-----------------------------------------------|-------------|-----------|------------------------------------------|
|`01-manifold-reflex-primitives.md`             |PARTIAL      |formal     |Primitives S, M, C, E, H, delta, MR       |
|`02-delta-computation.md`                      |IMPLEMENTED  |observation|The delta formula                         |
|`03-delta-ipc-channel-fidelity.md`             |IMPLEMENTED  |observation|IPC delta as channel fidelity             |
|`04-constraint-compilation.md`                 |IMPLEMENTED  |runtime    |WHEN/THEN -> CSS selectors                |
|`05-single-probe.md`                           |IMPLEMENTED  |runtime    |setAttribute + getComputedStyle           |
|`06-parallel-probe-array.md`                   |IMPLEMENTED  |runtime    |N coords, one style recalc                |
|`07-vessel-dom-bfs.md`                         |IMPLEMENTED  |runtime    |Vessel DOM + BFS distance-to-denial       |
|`08-media-gated-observer-cascade.md`           |IMPLEMENTED  |runtime    |@media-gated observer cascade             |
|`09-vsf-header-triads.md`                      |IMPLEMENTED  |transport  |Self-describing header dimensions         |
|`10-vsf-body-rows.md`                          |IMPLEMENTED  |transport  |Body rows + state slicing                 |
|`11-vsf-binary-encoding.md`                    |PROPOSED     |transport  |Binary bit-packing, delta-frames          |
|`12-synchronous-logged-ipc.md`                 |IMPLEMENTED  |relation   |Synchronous logged IPC                    |
|`13-content-addressing-and-merkle.md`          |IMPLEMENTED  |integrity  |Content-addressing, Merkle, hash queue    |
|`14-security-defense-stack.md`                 |IMPLEMENTED  |integrity  |Seven threat classes                      |
|`15-code-to-vsf-extraction.md`                 |IMPLEMENTED  |tooling    |Code-to-VSF extractor                     |
|`16-gpu-postfix-stack-machine.md`              |IMPLEMENTED  |scaling    |GPU postfix stack machine + SDF CSG       |
|`17-distributed-collapse-network.md`           |PROPOSED     |scaling    |Distributed Collapse Network              |
|`18-send-receive-potential-reference-tetrad.md`|THEORETICAL  |theoretical|Send/Receive/Potential/Reference tetrad   |
|`19-observer-as-channel-triadic.md`            |PARTIAL      |theoretical|Observer-as-channel triad                 |
|`20-four-constraint-minimum-processor.md`      |THEORETICAL  |theoretical|Four-constraint minimum viable processor  |
|`22-delta-trace-coupled-signal.md`             |OBSERVATIONAL|catalog    |Trace as coupled signal between substrates|

### Spec extensions (6)

The structural extensions that build on the catalog. Each is
OBSERVATIONAL; each names a property the formalism already supports.

|File                                       |Names                                                              |
|-------------------------------------------|-------------------------------------------------------------------|
|`SE-01-compositional-cascades.md`          |Reflexive scope; scale-free delta across compositional positions   |
|`SE-02-metabolism.md`                      |Flow discipline at four structural positions                       |
|`SE-03-field-modulation.md`                |Substrate as fast/slow layers; reward as byproduct                 |
|`SE-04-seed-constraint.md`                 |Permanent t=0 constraint; unresolvable central measurement         |
|`SE-05-vector-delta-predictive-reaching.md`|Vector delta across temporal scopes; predictive constraints        |
|`SE-06-substrate-duality.md`               |Rendering and execution as substrate connections; delta as coupling|

### Implementations (8)

The running code that exercises the spec.

|File                                |Source                                                                           |Role                                                                                                                                                                                                                                                                                                                                                                  |
|------------------------------------|---------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|`bootstrap-fresh-v1.html`           |`all_artifacts/` (also `Theory/Research/AwarenessModel/The Build/Bootstrap.html`)|Full-spec single-substrate proof of concept; vector-delta + predictive reaching from t=0; 13/13 invariants                                                                                                                                                                                                                                                            |
|`exodus-canonical.html`             |`all_artifacts/` (4x duplicated)                                                 |Canonical cascade demonstration; 66 passing tests                                                                                                                                                                                                                                                                                                                     |
|`dynamics_statistical_iterator.html`|`all_artifacts/` (3x duplicated)                                                 |Delta-dynamics observation engine; standalone demonstration                                                                                                                                                                                                                                                                                                           |
|GPU bridge directory                |`Software Concepts/WebGPUBridge/`                                                |22/22 passing tests; byte-identical CSS / JS / WGSL resolution across 2,880 coordinates. Specifically: `resolve.wgsl`, `harness.mjs`, `oracle.mjs`, `css-oracle.mjs`, `compile-constraints.mjs`, `constraints.mjs`, `gpu-path.js`, `test-oracle.js`, `index.html`, `README.md`. The `.js` versions are CommonJS variants of the `.mjs` files; either set is sufficient|

The GPU bridge directory is one logical artifact (one harness)
spread across roughly 12 files; all are required for the harness to
build and run.

-----

## ARCHIVE (with one-line notes)

Items grouped by source directory. Each entry indicates what the
item was, why it’s archived, and what supersedes it (if anything).

### `The Exodus Project (RETIRED)/`

Explicitly retired by the user (directory name). Earlier-era
formalization preserved for historical continuity. None is part of
the current canon.

|File                                                                                         |Why archived                                 |Superseded by                                    |
|---------------------------------------------------------------------------------------------|---------------------------------------------|-------------------------------------------------|
|`EXODUS spec.pdf` (3 byte-identical copies in `.index/Exodus/`, root, `backup.index/Exodus/`)|Earlier PDF specification of EXODUS pattern  |DEFINITION.md, SE-01 through SE-06               |
|`Exodus.html` (2 copies: `.index/`, `backup.index/`)                                         |Earlier interactive specification page       |DEFINITION.md, KERNEL.md                         |
|`The Exodus Spec.html` (2 copies: `.index/`, `backup.index/`)                                |Earlier specification HTML                   |DEFINITION.md                                    |
|`The Vessel/VesselPOC.html`, `Copy of VesselPOC.jsx`, `Vessel_Proof_of_Concept.jsx`          |Earlier proof-of-concept implementations     |bootstrap-fresh-v1.html                          |
|`The Vessel/PoC_Query_Engine.html`                                                           |Earlier query engine prototype               |bootstrap-fresh-v1.html                          |
|`The Vessel/The_Vessel.text`                                                                 |Early thesis document                        |DEFINITION.md, WHAT_IT_IS.md                     |
|`The Vessel/covo2`                                                                           |Early scratch file                           |(nothing; pre-spec exploration)                  |
|`Quantum Implications/Geometric_State_Field_Colapse`                                         |Theoretical exploration                      |algorithms/18, 20 (theoretical entries)          |
|`Research/Exodus Criteque Research.` (also in `backup.index/`)                               |External critique / research notes           |Captured insights folded into SE-01 through SE-06|
|`Research/GSFC Research`                                                                     |Geometric State Field Collapse research notes|(theoretical exploration; not in canon)          |
|`README.md`                                                                                  |Retired-project readme                       |This MANIFEST                                    |
|`#Textastic.zip`, `The Exodus Project.zip`                                                   |Bundled archives of the same retired material|(nested duplication)                             |
|`backup.index/` mirror                                                                       |Backup of `.index/` contents                 |(delete the duplicate)                           |

### `Demonstration/`

Earlier demonstration artifacts. Some have been folded into the
canonical set; the rest are duplicated copies of catalog entries.

|File                                         |Why archived                                                                                                                             |Superseded by                                                                                                                           |
|---------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------|
|`Canonocial/CLAUDE.md`                       |Duplicate of `all_artifacts/CLAUDE.md`                                                                                                   |Keep one canonical copy                                                                                                                 |
|`Canonocial/exodus-canonical.html`           |Duplicate of `all_artifacts/exodus-canonical.html`                                                                                       |Keep one canonical copy                                                                                                                 |
|`Canonocial/constraints.md`                  |Duplicate of `all_artifacts/constraints.md`                                                                                              |Keep one canonical copy                                                                                                                 |
|`Canonocial/canonical1.1/` (entire directory)|Duplicate of `all_artifacts/` for catalog 01-20 plus CLAUDE.md, constraints.md, dynamics_statistical_iterator.html, exodus-canonical.html|Keep `all_artifacts/` (or session-output) versions                                                                                      |
|`State Projector/exodus-extractor.html`      |Code-to-VSF transcompiler demonstration; algorithm 15 reference implementation                                                           |Algorithm 15 entry in catalog (specification); the HTML is a working demonstrator that can be retained as a reference artifact if useful|
|`State Projector/exodus-minimal.html`        |Minimal cascade demonstration; pre-spec exploration                                                                                      |exodus-canonical.html                                                                                                                   |
|`State Projector/exodus-vlan-sync.html`      |VLAN IPC tagging demonstration; algorithm 08 reference                                                                                   |Algorithm 08 entry in catalog                                                                                                           |
|`State Projector/vsf-exodus-spa.skill`       |Earlier skill definition for VSF/EXODUS SPA creation                                                                                     |(skill format; keep as reference if needed for future tooling)                                                                          |

### `Software Concepts/`

Earlier exploration of various subsystems. The WebGPUBridge entries
are duplicates of the catalog already in CANON.

|File                                                                                                                                    |Why archived                                                                    |Superseded by                                                                                                                             |
|----------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------|
|`Delta Dynamics Engine/dynamics_statistical_itterator.html`                                                                             |Earlier draft of dynamics_statistical_iterator (note misspelling)               |dynamics_statistical_iterator.html (in CANON)                                                                                             |
|`Generator Application/VSFGenerator_v1.0.html`                                                                                          |Earlier generator app                                                           |VSFGenerator_v1.3.html (latest of the series)                                                                                             |
|`Generator Application/VSFGenerator_v1.1.html`                                                                                          |Earlier generator app                                                           |VSFGenerator_v1.3.html                                                                                                                    |
|`Generator Application/VSFGenerator_v1.2.html`                                                                                          |Earlier generator app                                                           |VSFGenerator_v1.3.html                                                                                                                    |
|`Generator Application/VSFGenerator_v1.3.html`                                                                                          |Latest generator app; known to have CSS pollution from smart-quote contamination|bootstrap-fresh-v1.html (different role; generator was a separate exploration)                                                            |
|`MVP/MVP_Version-1.html`                                                                                                                |Earlier minimum viable product attempt                                          |bootstrap-fresh-v1.html                                                                                                                   |
|`Single Page Application/vsf_spa-v1.0.html`                                                                                             |Earlier SPA prototype                                                           |VSF_SPA_v2.0.html                                                                                                                         |
|`Single Page Application/VSF_SPA_v2.0.html`                                                                                             |Production SPA reference with BFS distanceToDenial                              |bootstrap-fresh-v1.html (different role; SPA was a separate exploration with its own BFS implementation)                                  |
|`WebGPUBridge/` (all catalog 01-20 plus CLAUDE.md, constraints.md, dynamics_statistical_iterator.html, exodus-canonical.html, README.md)|Duplicates of catalog already classified in CANON                               |Keep canonical copies (session-output versions for catalog; one of the duplicate copies for HTML)                                         |
|`WebGPUBridge/.js` files (compile-constraints.js, constraints.js, css-oracle.js, oracle.js)                                             |CommonJS variants of `.mjs` files                                               |The `.mjs` versions are the canonical module form; the `.js` versions can be kept or removed depending on whether the toolchain needs them|

### `Roadmap/`

|File                    |Why archived                    |Superseded by                        |
|------------------------|--------------------------------|-------------------------------------|
|`Thesis_And_Praxis.text`|Early thesis-and-praxis document|DEFINITION.md, IMPLEMENTATION_PATH.md|

### `The Spec/`

Earlier-era specification documents. These were the proto-spec
before the algorithm catalog and SE extensions were articulated.

|File                      |Why archived                                                                    |Superseded by                                                                                                                                |
|--------------------------|--------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
|`Algorithm_Canonocial.md` |Earlier algorithm catalog index with epistemic-discipline preface               |algorithms/00-INDEX.md (and DEFINITION.md captures the discipline)                                                                           |
|`VSF Spec.md`             |Vessel State File format specification, version 0.2.0-draft                     |algorithms/09 (header triads), 10 (body rows), 11 (binary encoding); DEFINITION.md primitives section                                        |
|`collapsible execution.md`|VGRS (Vessel Geometry Runtime Spec) draft v1.0; ChatGPT-influenced reformulation|Rejected explicitly during this session as a replacement for the constraint substrate; preserved for historical continuity. Not load-bearing.|

### `Theory/Research/`

Research notes and exploration. Some informed the spec; the spec
captures the load-bearing content.

|File                                                       |Why archived                                                                                                                         |Superseded by                                                                                                                                                 |
|-----------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|
|`AwarenessModel/The Build/Bootstrap.html`                  |An earlier copy of bootstrap-fresh-v1 (variant in The Build directory; differs slightly from `all_artifacts/bootstrap-fresh-v1.html`)|bootstrap-fresh-v1.html in CANON; if these are truly different, the The-Build version may be either an earlier or later variant; verify diff before discarding|
|`AwarenessModel/The Build/DEFINITION.md` (534 lines)       |Earlier copy of DEFINITION.md (predates section 0.5)                                                                                 |`/mnt/user-data/outputs/DEFINITION.md` (613 lines, includes section 0.5)                                                                                      |
|`AwarenessModel/The Build/simple_definition.md` (354 lines)|Renamed copy of WHAT_IT_IS.md                                                                                                        |`/mnt/user-data/outputs/WHAT_IT_IS.md`                                                                                                                        |
|`AwarenessModel/retired_prototypes/Bootstrap.HTML`         |Original-track bootstrap v1 (9/9 invariants); explicitly retired                                                                     |bootstrap-fresh-v1.html                                                                                                                                       |
|`AwarenessModel/retired_prototypes/bootstrapv2.html`       |Original-track bootstrap v2 (8/8 invariants); explicitly retired                                                                     |bootstrap-fresh-v1.html (the fresh track collapsed v1+v2 capabilities)                                                                                        |
|`AwarenessModel/retired_prototypes/bootstrapv3.html`       |Original-track bootstrap v3 (compositional sub-cascades); explicitly retired                                                         |bootstrap-fresh-v1.html foundation; sub-cascade work is Phase 2 of new track                                                                                  |
|`AwarenessModel/retired_prototypes/v2_proper.html`         |Step-2 fresh track attempt (`bootstrap-v2.html` from `all_artifacts/`)                                                               |bootstrap-fresh-v1.html (step 2 not yet rebuilt for fresh track)                                                                                              |
|`AwarenessModel/retired_prototypes/roadmap.md`             |Original ROADMAP.md from the v1/v2/v3 track                                                                                          |IMPLEMENTATION_PATH.md                                                                                                                                        |
|`Consciousness Resesrch.md`                                |External research on consciousness models (note misspelling)                                                                         |Informs SE-04, SE-05 cognition-parallel framing; not load-bearing                                                                                             |
|`Heterogeneous_Architecture.md`                            |Research on heterogeneous compute architectures                                                                                      |Informs SE-06; not load-bearing                                                                                                                               |
|`Noise.txt`                                                |Research notes on delta-as-noise                                                                                                     |Informs algorithms/02; not load-bearing                                                                                                                       |
|`Post Theory Closing Research.md`                          |Research notes after a theoretical-closure milestone                                                                                 |Informs SE-04; not load-bearing                                                                                                                               |
|`Quantum_Computing.md`                                     |Quantum computing reference material                                                                                                 |Informs algorithms/18, 20; not load-bearing                                                                                                                   |
|`The Manifold Reflex.text`                                 |Manifold Reflex thesis document                                                                                                      |algorithms/01 captures the formal primitives                                                                                                                  |
|`WebGPUComputeReaearch.md`                                 |WebGPU compute shader research (note misspelling)                                                                                    |Informs algorithms/16; not load-bearing                                                                                                                       |
|`text.txt`                                                 |Single-line history token (`history_69d9b3c4-...`)                                                                                   |(delete; non-content)                                                                                                                                         |

### `all_artifacts/`

This directory in the zip is the user’s flattened collection of the
in-canon material as it stood when the zip was created. It is
authoritative for catalog 01-20, 22, SE-01 through SE-05, ROADMAP,
and the implementations. It does not contain the most-recent
documents from this session (SE-06, KERNEL, INVARIANTS,
IMPLEMENTATION_PATH, PROJECT_SPLIT, WHAT_IT_IS, DEFINITION with
section 0.5).

|File                                                                                                                                        |Class                                         |Note                                                                                                    |
|--------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------|--------------------------------------------------------------------------------------------------------|
|Catalog files (01-20, 22)                                                                                                                   |CANON (duplicate of session-output)           |Identical to `/mnt/user-data/outputs/algorithms/`; either copy is canonical                             |
|SE-01 through SE-05                                                                                                                         |CANON (duplicate of session-output)           |SE-06 missing here (post-zip)                                                                           |
|`DEFINITION.md`                                                                                                                             |ARCHIVE                                       |Predates section 0.5; superseded by session-output version                                              |
|`ROADMAP.md`                                                                                                                                |ARCHIVE                                       |Original eight-step single-substrate roadmap; superseded by IMPLEMENTATION_PATH.md                      |
|`bootstrap.html` (33980 bytes)                                                                                                              |ARCHIVE                                       |Original-track bootstrap v1; superseded by bootstrap-fresh-v1.html                                      |
|`bootstrap-v2.html` (40079 bytes)                                                                                                           |ARCHIVE                                       |Original-track bootstrap v2; superseded by bootstrap-fresh-v1.html (the fresh track was a clean restart)|
|`bootstrap-fresh-v1.html`                                                                                                                   |CANON                                         |Identified as the canonical implementation reference                                                    |
|`dynamics_statistical_iterator.html`                                                                                                        |CANON                                         |Standalone delta-dynamics observation engine                                                            |
|`exodus-canonical.html`                                                                                                                     |CANON                                         |The 66-test canonical cascade                                                                           |
|`index.html`                                                                                                                                |CANON                                         |GPU bridge harness entry point                                                                          |
|`resolve.wgsl`, `harness.mjs`, `oracle.mjs`, `css-oracle.mjs`, `compile-constraints.mjs`, `constraints.mjs`, `gpu-path.js`, `test-oracle.js`|CANON                                         |GPU bridge harness components                                                                           |
|`oracle.js`, `css-oracle.js`, `compile-constraints.js`, `constraints.js`                                                                    |ARCHIVE (or CANON if toolchain needs CommonJS)|CommonJS duplicates of the `.mjs` modules                                                               |
|`constraints.md`, `README.md`, `CLAUDE.md`                                                                                                  |CANON                                         |Reference docs; CLAUDE.md is duplicated 4x in zip                                                       |

-----

## Duplicates: byte-for-byte (clean these)

46 unique content hashes have multiple copies. Total byte-identical
duplicate files: 77. Recommended action: keep one copy of each (the
canonical-location copy noted below) and delete the rest.

The canonical location for each group below is the first listed
path. Any other paths in the group are exact duplicates and can be
deleted without information loss.

### Catalog file duplicates (3x each)

For files 01 through 20, plus 00-INDEX, plus selected support files,
three byte-identical copies exist:

```
Demonstration/Canonocial/canonical1.1/{file}
Software Concepts/WebGPUBridge/{file}
all_artifacts/{file}
```

Files affected (canonical copy: `all_artifacts/`, or
`/mnt/user-data/outputs/algorithms/` if mirroring the
session-output set):

- `00-INDEX.md`
- `01-manifold-reflex-primitives.md`
- `02-delta-computation.md`
- `03-delta-ipc-channel-fidelity.md`
- `04-constraint-compilation.md`
- `05-single-probe.md`
- `06-parallel-probe-array.md`
- `07-vessel-dom-bfs.md`
- `08-media-gated-observer-cascade.md`
- `09-vsf-header-triads.md`
- `10-vsf-body-rows.md`
- `11-vsf-binary-encoding.md`
- `12-synchronous-logged-ipc.md`
- `13-content-addressing-and-merkle.md`
- `14-security-defense-stack.md`
- `15-code-to-vsf-extraction.md`
- `16-gpu-postfix-stack-machine.md`
- `17-distributed-collapse-network.md`
- `18-send-receive-potential-reference-tetrad.md`
- `19-observer-as-channel-triadic.md`
- `20-four-constraint-minimum-processor.md`
- `dynamics_statistical_iterator.html`

That’s 22 files duplicated 3x each = 66 byte-identical duplicates,
of which 22 should be kept and 44 deleted.

### CLAUDE.md (4 copies)

Canonical: `all_artifacts/CLAUDE.md`. Delete the three duplicates:

- `Demonstration/Canonocial/CLAUDE.md`
- `Demonstration/Canonocial/canonical1.1/CLAUDE.md`
- `Software Concepts/WebGPUBridge/CLAUDE.md`

### exodus-canonical.html (4 copies)

Canonical: `all_artifacts/exodus-canonical.html`. Delete the three duplicates:

- `Demonstration/Canonocial/canonical1.1/exodus-canonical.html`
- `Demonstration/Canonocial/exodus-canonical.html`
- `Software Concepts/WebGPUBridge/exodus-canonical.html`

### constraints.md (4 copies)

Canonical: `all_artifacts/constraints.md`. Delete the three duplicates:

- `Demonstration/Canonocial/constraints.md`
- `Demonstration/Canonocial/canonical1.1/constraints.md`
- `Software Concepts/WebGPUBridge/constraints.md`

### EXODUS spec.pdf (3 copies in retired)

Canonical: any one path; the simplest is
`The Exodus Project (RETIRED)/EXODUS spec.pdf`. Delete the two
duplicates in `.index/Exodus/` and `backup.index/Exodus/`.

### GPU bridge supporting files (2 copies each)

- `compile-constraints.js`: `WebGPUBridge/`, `all_artifacts/`
- `compile-constraints.mjs`: `WebGPUBridge/`, `all_artifacts/`
- `constraints.js`: `WebGPUBridge/`, `all_artifacts/`
- `constraints.mjs`: `WebGPUBridge/`, `all_artifacts/`
- `css-oracle.js`: `WebGPUBridge/`, `all_artifacts/`
- `css-oracle.mjs`: `WebGPUBridge/`, `all_artifacts/`
- `oracle.js`: `WebGPUBridge/`, `all_artifacts/`
- `oracle.mjs`: `WebGPUBridge/`, `all_artifacts/`
- `gpu-path.js`: `WebGPUBridge/`, `all_artifacts/`
- `harness.mjs`: `WebGPUBridge/`, `all_artifacts/`
- `index.html`: `WebGPUBridge/`, `all_artifacts/`
- `resolve.wgsl`: `WebGPUBridge/`, `all_artifacts/`
- `test-oracle.js`: `WebGPUBridge/`, `all_artifacts/`
- `README.md`: `WebGPUBridge/`, `all_artifacts/`

For each: pick one canonical location (recommend keeping
`Software Concepts/WebGPUBridge/` since the bridge is its own
self-contained directory with the .mjs source-of-truth), delete the
duplicate from the other.

### Other duplicates

- `VesselPOC.html` and `Vessel_Proof_of_Concept.jsx` are byte-identical (same hash); one is misnamed. Keep one.
- `Exodus.html`: 2 copies in `.index/` and `backup.index/`
- `The Exodus Spec.html`: 2 copies similarly
- `Copy of VesselPOC.jsx` and `VesselPOC.jsx`: check; if identical, delete the “Copy of” version
- `Exodus Criteque Research.`: 2 copies (`.index/Research/` and `backup.index/`)

### Total dedup

- Files in zip: 175
- Files after dedup: 98 (minus a few non-canonical empties: ~96)
- Reclaimed: ~77 files

-----

## Suggested target directory structure (after dedup)

```
project/
  DEFINITION.md
  WHAT_IT_IS.md
  KERNEL.md
  INVARIANTS.md
  PROJECT_SPLIT.md
  IMPLEMENTATION_PATH.md
  MANIFEST.md                  (this file)
  CLAUDE.md
  README.md
  algorithms/
    00-INDEX.md
    01-manifold-reflex-primitives.md
    ... (02 through 20)
    22-delta-trace-coupled-signal.md
    SE-01-compositional-cascades.md
    SE-02-metabolism.md
    SE-03-field-modulation.md
    SE-04-seed-constraint.md
    SE-05-vector-delta-predictive-reaching.md
    SE-06-substrate-duality.md
  implementations/
    bootstrap-fresh-v1.html
    exodus-canonical.html
    dynamics_statistical_iterator.html
    constraints.md
    gpu-bridge/
      index.html
      README.md
      resolve.wgsl
      harness.mjs
      oracle.mjs
      css-oracle.mjs
      compile-constraints.mjs
      constraints.mjs
      gpu-path.js
      test-oracle.js
  archive/
    retired-bootstraps/        (Bootstrap v1, v2, v3, v2_proper)
    retired-roadmaps/          (ROADMAP.md, Thesis_And_Praxis.text)
    earlier-spec/              (The Spec/ contents, including collapsible execution.md)
    earlier-implementations/   (VSFGenerator v1.0-1.3, MVP, vsf_spa v1/v2, exodus-extractor, exodus-minimal, exodus-vlan-sync)
    research-notes/            (Theory/Research/* except the canonical files)
    exodus-retired/            (The Exodus Project (RETIRED)/ contents, deduplicated)
```

-----

## What this manifest does not do

- Does not delete or move any files. It classifies them. Execution
  is left to the user (manually, via shell script, or in a future
  session if requested).
- Does not produce a navigable web app. The user accepted that
  trade-off in the previous turn to conserve usage budget.
- Does not address content drift. Files classified as ARCHIVE may
  contain insights that haven’t been folded into the canon. If any
  such drift is identified later, the appropriate response is to
  formalize the missing structural commitment as a new SE-N
  extension, not to re-promote the archived file.
- Does not verify byte-equivalence beyond what `md5sum` reports.
  All 46 duplicate groups were confirmed by md5; if a hash collision
  occurred (vanishingly unlikely at this volume), one of the
  “duplicates” might actually differ.

-----

## Reading order for someone arriving fresh

1. `DEFINITION.md` (with section 0.5)
1. `WHAT_IT_IS.md` if non-technical context is helpful
1. `INVARIANTS.md` to load the structural commitments
1. `KERNEL.md` for the operational form
1. `algorithms/00-INDEX.md` and the catalog as needed
1. `SE-01` through `SE-06` for the structural extensions
1. `IMPLEMENTATION_PATH.md` for the engineering plan
1. `PROJECT_SPLIT.md` for the architectural split
1. Implementations in `implementations/` to see the spec running
1. `archive/` only when historical context is needed

This order produces a reader who arrives at the implementation
phases of `IMPLEMENTATION_PATH.md` with the structural foundation
necessary to begin the work.

-----

## Version

MANIFEST.md v1.0. Pinned to the current canon as it stands at the
end of this session. Revisable when implementations reveal more or
when archive items are formally promoted via SE-N extensions.