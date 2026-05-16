# 05.5 cleanup + trajectory recorder

Phase 5.5 work: kindmult cleanup (inert ranking code removal per Phase 5
audit) and trajectory recording.

The canonical kernel files this phase produces (field.js, ct-engine.js,
er-engine.js, constraint-compiler.js, cpu-oracle.js, reflexive-surface.js,
resolve-fresh.wgsl, storage-adapter.js, trajectory-recorder.js) live in
implementation/kernel/. Phase 5.5 is the structural birthplace of that
canonical form; Phases 8 and 9 carried identical copies.

This phase folder contains the phase-specific code (kindmult-audit.js,
phase5-coupling-audit.js, phase5-harness.js, index.html, README.md, test
files) and Phase 5.5's own README under that name.

Older spec snapshots from this phase (INVARIANTS, KERNEL, SE-07 as they
stood at Phase 5.5) live in meta/retired-docs/.
