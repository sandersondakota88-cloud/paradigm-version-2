# paradigm-version-2

A research-and-implementation project investigating whether the web
platform's grammar — HTML coordinate space, the CSS cascade, custom
properties as typed channels — has crossed a structural threshold,
becoming a constraint substrate with the architectural properties of
an operating-system kernel.

Three big questions remain:

- **Can we emit application behavior out of a richly represented state object?** &nbsp;&nbsp;→ [PREFACE.md](PREFACE.md)
- **Can we now host application layer logic in the hardware it sits on?** &nbsp;&nbsp;→ [ARCHITECTURE.md](ARCHITECTURE.md)
- **Can we trust the math to do the verification work for us, if declared up front?** &nbsp;&nbsp;→ [RESEARCH-AGAINST-PREFACE.md](RESEARCH-AGAINST-PREFACE.md)

The claim the work is evidence for:
**language has become expressive enough to inherit the structure of
the physical machinery it represents.**

The web platform is the most legibly demonstrable ecosystem:

- The substrate is a kernel-and-adapter wiring abstraction. It uses
  mathematical constraint representation to stratify one compute
  cycle across imperative, declarative, and stateful runtimes. VRAM
  does the heavy lifting of organizing semantics into a geometric
  state space. JavaScript becomes *set-and-forget* plumbing for
  input. CSS becomes the semantic resolution surface that provokes
  the substrate into configuration across views.
- This is an application-specific observation. Any observational
  surface outside this project's targeted domain needs its own proof
  and procedure to claim the threshold has been crossed there.

What's been demonstrated empirically:

- ~45 million field-level comparisons across three substrates (CSS,
  JS, GPU). Zero divergence.
- Byte-native WASM intake verified at Spearman ≥ 0.85.
- Persistence across page reload.
- A precise boundary map of where the substrate's expressive closure
  begins and ends.

Where the demonstrations don't yet reach the claims, the gaps are
named directly in the documents that make the claims.

-----

## Reading order

Four documents at the project root, read in order:

1. **[PREFACE.md](PREFACE.md)** — the structural claim the work is
   evidence for. Stand-alone; does not depend on the implementation.
2. **[ARCHITECTURE.md](ARCHITECTURE.md)** — what the substrate *is*.
   Kernel, adapters, universal type format, hardware. Every claim
   cites canon. Every gap is called out.
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

The substrate's working name is **constraint substrate**
([canon/DEFINITION.md](canon/DEFINITION.md)). A better one will get
picked once the thing's been run at scale and shown what it actually
is.

-----

## Authorship and collaboration

Dakota Sanderson — claims, direction, final decisions. Claude
(Anthropic) collaborated throughout: drafting, structural analysis,
test implementation, and the architecture recognition in
[ARCHITECTURE.md](ARCHITECTURE.md). The git history timestamps the
recognitions and pivots in the order they happened.

-----

## License

[MIT](LICENSE). Permissive — you may use, modify, redistribute, and
incorporate commercially, provided the copyright notice is retained.

-----

## Status

**Live work-in-progress.** The kernel + adapters + universal type
format + hardware recognition was made in May 2026. Four priority
items remain ([PROJECT-PLAN.md §8](PROJECT-PLAN.md)):

1. Specify the universal type format as a canonical schema
2. Specify the adapter protocol
3. Implement the kernel as a discrete host-portable artifact
4. Demonstrate substrate relocation across hosts

Until those four ship, the architecture is a recognized structure
with strong empirical support — not yet a specified artifact.
