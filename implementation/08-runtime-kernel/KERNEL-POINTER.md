# 08 runtime kernel

Phase 8 wires the canonical kernel as the actual runtime of deposited
applications, replacing the thin substrate-walker.js dispatcher with the
full kernel (field.js, ct-engine.js, er-engine.js, etc.).

The kernel-src directory that lived inside Phase 8's tree has been
migrated to implementation/kernel/. Phase 8 contributes substrate-instance.js
and substrate-media.js to the canonical kernel; both live there now.

This phase folder contains the Phase 8 work: layer K (kernel-as-runtime),
layer M (multi-substrate composition), and layer P (CRM forcing function)
code, verifiers, and documents.
