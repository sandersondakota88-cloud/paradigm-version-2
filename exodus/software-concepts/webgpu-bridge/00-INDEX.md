# VSF / EXODUS Algorithm Catalog

This directory contains one file per algorithm proposed across the project
documentation. Each file records what the algorithm does, where it came
from, and whether working code currently implements it.

## Organization

Files are numbered by layer, not by development phase. Implementation
status is explicit in each file's header and summarized in the table below.

## Status legend

- **IMPLEMENTED** : running code exists in `exodus-canonical.html` (or an
 earlier artifact) and has test coverage
- **PARTIAL** : some aspect is implemented; the rest is proposal
- **PROPOSED** : described in research documentation; no code yet
- **THEORETICAL** : conceptual framing; may not be computational at all

## The catalog

| # | Algorithm | Layer | Status | Primary origin |
|---|---|---|---|---|
| 01 | Manifold Reflex primitives (S, M, C, E, H, delta, MR) | formal | PARTIAL | `The_Manifold_Reflex` |
| 02 | delta computation (unresolved / total) | observation | IMPLEMENTED | `VSF_Format`, `server-patterns.md` |
| 03 | delta_IPC channel fidelity (S->C, C->S, composite) | observation | IMPLEMENTED | `Development_Roadmap`, appraisal rewrite |
| 04 | Constraint compilation (WHEN/THEN -> CSS selectors) | runtime | IMPLEMENTED | `State_Converter.MD`, `cascade-engine.md` |
| 05 | Single probe (setAttribute + getComputedStyle) | runtime | IMPLEMENTED | `exodus-minimal.html`, `cascade-engine.md` |
| 06 | Parallel probe array (N coords, one style recalc) | runtime | IMPLEMENTED | `parallel-probes.md` |
| 07 | Vessel DOM + BFS distance-to-denial | runtime | IMPLEMENTED | `parallel-probes.md` |
| 08 | @media-gated observer cascade | runtime | IMPLEMENTED | `exodus-vlan-sync.html` |
| 09 | VSF header triads (self-describing dimensions) | transport | IMPLEMENTED | `VSF_Format` |
| 10 | VSF body rows + state slicing | transport | IMPLEMENTED | `VSF_Format` |
| 11 | VSF binary bit-packing, delta-frames, confidence culling | transport | PROPOSED | `VSF_Format` |
| 12 | Synchronous logged IPC | relation | IMPLEMENTED | `server-patterns.md` |
| 13 | Content-addressing, Merkle, serialized hash queue | integrity | IMPLEMENTED | appraisal rewrite |
| 14 | Security defense stack (7 threat classes) | integrity | IMPLEMENTED | canonical file threat model |
| 15 | Code-to-VSF extraction (chunk, detect, infer) | tooling | IMPLEMENTED | `exodus-extractor.html` |
| 16 | GPU postfix stack machine + SDF CSG | scaling | PROPOSED | `Encoding_Computation...md` |
| 17 | Distributed Collapse Network (delta-routed forwarding) | scaling | PROPOSED | `Development_Roadmap` |
| 18 | Send / Receive / Potential / Reference tetrad | theoretical | THEORETICAL | `Quantum_Computing.md` |
| 19 | Observer-as-channel \|A->C<-B\| | theoretical | PARTIAL | `State_Converter.MD` note |
| 20 | Four-constraint minimum viable processor | theoretical | THEORETICAL | `Quantum_Computing.md` |

## Epistemic discipline

Each file distinguishes two kinds of content:

- **Narrow-claim scope** : what the algorithm actually computes in working
 code (or could compute if implemented). This is the publishable,
 defensible, testable material.
- **Wide-claim scope** : metaphysical, philosophical, or cross-domain
 readings of the algorithm. Sometimes genuinely illuminating, sometimes
 decorative; always labeled.

When in doubt, read the narrow section and skip the wide section. The
narrow section is the one with skin in the game.

## How to use this catalog

- Starting a new implementation? Pull the files for the relevant layer,
 read Specification, ignore everything else.
- Doing a code review? The Specification is the contract.
- Writing external documentation? The Narrow section is the one you can
 defend in a technical venue.
- Working on theory or design? The Wide section records how prior
 documentation has framed things, which is historically interesting.

## Duplicates noted during cataloging

- `Post_Theory_Closure` is byte-identical to `Quantum_Computing.md`
 (confirmed via diff, not just substring match). Delete one.
- `the_holy_grail.md` is whitespace-equivalent to
 `Encoding_Computation_as_Geometry_for_GPU-Parallel_Resolution.md`.
 Delete one.
- `VSFGenerator_v1_3.html`, `VSF_SPA_v2_0.html`, `Quantum_Computing.md`,
 and `the_holy_grail.md` all use CR-only line endings (classic Mac
 pre-OS-X). This is why `wc -l` reported 0 on them. Normalize to LF
 before committing to a modern repo.

---

## Known cosmetic issue in this catalog

During the ASCII-enforcement sweep, a too-broad regex (`re.sub(r' +', ' ', text)`)
collapsed consecutive spaces everywhere, including inside fenced code blocks.
The affected content is still readable and correct, but pseudocode blocks
lost their indentation hierarchy.

Files most visibly affected: 02, 06, 07, 12, 13, 16 (all contain indented
pseudocode or WGSL).

Fix: a Claude Code pass over the repo can re-indent code blocks surgically
using the git history of the source material. The damage is skin-deep; the
specifications themselves are intact.
