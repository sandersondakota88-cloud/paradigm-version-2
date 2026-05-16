# paradigm-version-2

A research-and-implementation project investigating whether the web
platform's grammar — HTML coordinate space, the CSS cascade, custom
properties as typed channels — has crossed a structural threshold,
becoming a constraint substrate with the architectural properties of
an operating-system kernel.

The work is evidence for a single structural observation:
**language has become expressive enough to inherit the structure of
the physical machinery it represents.** The web platform is the venue
where this threshold-crossing is most legibly demonstrable. The
substrate is structurally a kernel-and-adapter architecture; the
cascade is the discretion router; existing browser substrates (CSS
engine, V8, WebGPU, IndexedDB) are adapters; the universal
serializable form (XML, JSON, stylesheet — three syntactic skins on
one structure) is the firmware-equivalent protocol layer.

This claim is supported empirically by ~45 million field-level
comparisons across three substrates with zero divergence, byte-native
WASM intake verified at Spearman ≥ 0.85, persistence demonstrated
across page reload, and a precise boundary map showing where the
substrate's expressive closure begins and ends. Proof gaps are named
in plain text where the demonstrations do not yet reach the claims.

-----

## Reading order

Four documents at the project root, read in order:

1. **[PREFACE.md](PREFACE.md)** — the structural claim the work is
   evidence for. Stand-alone; does not depend on the implementation.
2. **[ARCHITECTURE.md](ARCHITECTURE.md)** — what the substrate
   fundamentally *is*, structurally, named with the words that fit
   it. Kernel, adapters, universal type format, hardware. Cites
   canon at every load-bearing claim; names every proof gap in
   plain text.
3. **[RESEARCH-AGAINST-PREFACE.md](RESEARCH-AGAINST-PREFACE.md)** —
   live catalogue of evidence against four specific objections to
   the preface's framing.
4. **[PROJECT-PLAN.md](PROJECT-PLAN.md)** — how the project is
   organized, where everything lives, what the current state is.

After those four, read [canon/](canon/) per its own
[MANIFEST](meta/MANIFEST.md) reading order:
[DEFINITION](canon/DEFINITION.md) (with §0.5) →
[INVARIANTS](canon/INVARIANTS.md) →
[KERNEL](canon/KERNEL.md) →
[algorithm catalog](canon/algorithm/00-INDEX.md) →
[specification extensions](canon/specification/) →
implementations.

-----

## What runs

The strongest empirical demonstrations live in
[exodus/canonical-implementation/](exodus/canonical-implementation/):

- **Phase A** (Node):
  [tests/equivalence.test.js](exodus/canonical-implementation/tests/equivalence.test.js)
  verifies CSS oracle ≡ JS oracle byte-identical across 2,601
  generated constraint sets.
- **Phase B** (browser):
  [tests/gpu-equivalence.html](exodus/canonical-implementation/tests/gpu-equivalence.html)
  extends to the WGSL compute shader. CSS ≡ JS ≡ GPU byte-identical
  across 2,602 sets, ~45 million field-level comparisons, zero
  divergence.
- **Boundary research**:
  [tests/extensions/](exodus/canonical-implementation/tests/extensions/)
  contains NOT-1 (single-dim NOT), NOT-2 (compound NOT boundary), 4a
  (cross-coord reductions), 4b stratified / mutual / aggregate.
  Each test locates one structural boundary of the postfix machine
  precisely.

To run Phase A locally (requires Node):

```
cd exodus/canonical-implementation
node tests/equivalence.test.js
```

To run Phase B (requires a browser with WebGPU enabled and hardware
acceleration on):

```
cd exodus/canonical-implementation
node tests/serve.js
# then open http://localhost:8080/tests/gpu-equivalence.html
```

For the canonical 11-rule program through the GPU bridge harness:

```
cd exodus/canonical-implementation
node tests/serve.js
# then open http://localhost:8080/
```

-----

## Working name

The substrate currently has the working name **constraint substrate**
([canon/DEFINITION.md](canon/DEFINITION.md)). A more distinctive name
will be chosen after implementations have revealed what the thing
actually does at scale.

-----

## Authorship and collaboration

The structural claims, project direction, and final decisions are by
Dakota Sanderson. AI (Claude, Anthropic) was used as a collaborator
throughout — for drafting, structural analysis, test implementation,
and the architecture recognition recorded in
[ARCHITECTURE.md](ARCHITECTURE.md). Major recognitions and pivots are
attributable to specific points in conversation; the project's
git history is the timestamped record of that work.

-----

## License

[MIT](LICENSE). Permissive — you may use, modify, redistribute, and
incorporate commercially, provided the copyright notice is retained.

-----

## Status

**Live work-in-progress.** The architecture recognition (kernel +
adapters + universal type format + hardware) was made in May 2026.
Four priority work items are named in
[PROJECT-PLAN.md §8](PROJECT-PLAN.md):

1. Specify the universal type format as a canonical schema
2. Specify the adapter protocol
3. Implement the kernel as a discrete host-portable artifact
4. Demonstrate substrate relocation across hosts

Until those are complete, the architecture is a recognized structure
with strong empirical support, not a specified artifact. The
recognition matters; the specification matters more.
