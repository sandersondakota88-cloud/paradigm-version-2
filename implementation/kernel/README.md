# Kernel

The kernel is the running code that materializes the substrate. It is
the implementation form of what canon/DEFINITION.md and canon/INVARIANTS.md
commit the substrate to be. The kernel is downstream of the spec; it is
upstream of the deposited geometry that depends on it.

## What the kernel is

- The constraint field - initialization, maintenance, eviction (field.js)
- The two engines that couple through the field via delta only -
  execution and rendering (ct-engine.js, er-engine.js)
- The constraint compiler that translates WHEN/THEN rules into
  selector-and-property form (constraint-compiler.js)
- The substrate-equivalence reference that allows byte-verification
  across resolvers (cpu-oracle.js, resolve-fresh.wgsl)
- The instance factory that lets multiple substrates coexist without
  leakage, per S1 (substrate-instance.js)
- The content-addressed persistence that lets configurations be named
  without becoming first-class data (substrate-media.js)
- The observer surfaces that read the field for derived output without
  writing to it, per O1-O3 (reflexive-surface.js, trajectory-recorder.js)

## What the kernel is not

- Not the spec. The spec is canonical (D1). The kernel is one
  instantiation.
- Not the application. Applications are deposited geometry. The kernel
  resolves applications; it is not what applications are.
- Not a controller. F3 forbids supervision. Engines read shared field
  state; they do not command each other.
- Not goal-directed. SE-04 specifies the seed as unresolvable.
- Not final. F4 and X2 forbid termination.
- Not authoritative for what the substrate is. When the kernel and the
  spec disagree, the spec wins.

## Origin

The canonical kernel is the Phase 5.5 form of the core files, extended
in Phase 8 with substrate-instance.js and substrate-media.js. Earlier
evolutionary versions of these files live inside the phase directories
that produced them. Those are evidence of the kernel's trajectory, not
duplicates of this canonical form.

## Fidelity to the canon

An audit against canon/INVARIANTS.md v1.3 reports 25 of 33 invariants
honored cleanly. Three honest gaps remain:

- K2 part (a) - selection-bias toward sub-cascade members on naming is
  structurally specified but currently unrealized. Acknowledged in
  INVARIANTS v1.2 note.
- K3 - the namingPref accumulator violates K3's letter ("not stored as
  an explicit value addressed by any component"). Acknowledged in
  INVARIANTS v1.2 note.
- D2 - compounds (Phase 4b) and recall (Phase 4c) are structural
  commitments living in field.js without corresponding SE-N entries.
  Pending: SE-12 (compounds) and SE-13 (recall) to close this gap.

See canon/VERSION.md for the spec-stack pin this kernel was audited
against.
