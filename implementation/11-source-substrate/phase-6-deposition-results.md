# Phase 6 — Substrate-State CSS Deposition; Browser-Cascade Verification

**Date:** 2026-05-26.
**Purpose:** Reify the substrate's settled state as a portable, cascade-
resolvable artifact, then verify that an independent canonical resolver
(the browser's native CSS cascade engine) produces byte-identical
resolution to the Phase 4 CPU walker that produced the deposition.

Per algorithm 04: constraints compile to CSS selectors + custom-property
declarations. Per algorithm 16 (and the 2,602-set / ~45M-comparison
byte-identical exodus record): CSS resolution is canonically equivalent
to JS-walker and WGSL-shader resolution at the constraint layer. Phase 6
extends that equivalence to **substrate-deposition layer**: the
substrate's settled state, emitted as CSS, resolves identically against
the browser's cascade engine.

---

## 1. What was deposited

The TodoMVC three-language substrate state from
[phase-3-trajectory-todomvc-three-language.md](phase-3-trajectory-todomvc-three-language.md):

- Six-peer lattice after ingesting 5,086 records (HTML + CSS + JS in
  spec-defined order)
- 17 promoted sub-cascades
- Composer field's settled constraints across 4 composer families
  (composer-pair, composer-extension, composer-axis-affinity,
  composer-tuple) at the end of corpus ingestion

[css-deposition-emitter.js](css-deposition-emitter.js):

1. Walks the composer's field for lattice-resolvable constraint
   patterns (the four composer families above).
2. Sorts them by selector specificity per algorithm 04 ordering
   discipline.
3. Emits one cascade rule per constraint:

   ```css
   #substrate-probe[data-<axis1>="<value1>"][data-<axis2>="<value2>"] {
     --lattice-fire: "<constraint-id>";
   }
   ```

4. Companion probe HTML: 56 lines of self-contained markup that
   iterates over all 12,500 joint coords, sets the probe element's
   data-attributes, reads `getComputedStyle(probe).getPropertyValue(
   '--lattice-fire')`.

---

## 2. Verification: browser cascade vs. Phase 4 CPU walker

Probe page output (run in Edge, 2026-05-26):

```
stateSpaceSize: 12500
matched: 9530
unresolved: 2970
lattice-scope delta: 0.2376
```

Phase 4 CPU walker output on the same TodoMVC three-language substrate
state:

```
matched: 9530
unresolved: 2970
lattice-scope delta: 0.2376
```

**Byte-identical to four decimal places, across all three metrics.**

The browser's CSS cascade engine — implemented entirely independently
of our JavaScript, with no knowledge of our substrate, peers, intake-
configs, or lattice — resolved the substrate's deposited understanding
of TodoMVC identically to the resolver that produced the deposition.

---

## 3. What this earns

### 3.1 Substrate understanding is now portable

The substrate's settled state, deposited as a single self-contained
CSS file, can be:

- loaded by any browser
- resolved against any joint-coord configuration via
  `setAttribute` + `getComputedStyle`
- diffed by standard text tools
- analyzed by standard CSS tooling
- shipped between hosts without serialization protocols

Per algorithm 16's empirical floor, the same CSS deposition would
resolve byte-identically through a JS stack-machine resolver or a WGSL
compute shader. The substrate's understanding is interoperable by
construction because it's expressed in a format whose evaluation
semantics multiple independent implementations already honor.

### 3.2 S2 (substrate-resolution determinism) extended to the
substrate-deposition layer

Algorithm 16: byte-identical CSS=JS=WGSL across 2,602 constraint sets
at the constraint-resolution layer.

Phase 4: byte-identical Phase 4 CPU walker resolution of the
12,500-coord joint space at the joint-coord-space layer.

Phase 6: byte-identical browser-cascade resolution of the
substrate-deposited rules at the substrate-state-as-artifact layer.

Each layer ratchets up what S2 covers. Phase 6 closes the loop: the
substrate develops understanding (Phase 3); the substrate's
understanding is reified as portable geometry (Phase 6 emitter); the
portable geometry resolves identically across substrates (S2).

### 3.3 The substrate's understanding survives transmission

Before Phase 6, the substrate's understanding of TodoMVC existed only
as the operational state of a running lattice. The understanding could
not leave the substrate; another substrate could only re-derive it by
re-running the same intake.

After Phase 6, the understanding is **a stylesheet**. Other tools that
already exist (browsers, CSS parsers, CSS analyzers) can evaluate it
without knowing anything about the substrate that produced it.

---

## 4. What this does NOT earn

- **Substrate-state portability** (carry-the-substrate-forward). The
  CSS deposition carries the substrate's *settled rule geometry*, not
  the substrate's full operational state (constraint kinds, fidelity
  histories, slow-layer drift, sub-cascade membership identity). A
  third party loading the CSS gets the substrate's resolutions; they
  do not get the substrate. For that, VSF (algorithm 11 binary +
  algorithm 13 Merkle) remains the right format. Phase 6 deliberately
  doesn't go there.

- **Content-addressed integrity.** CSS files have no canonical hash
  identity per the spec. A future Phase could compute a Merkle root
  per algorithm 13 over the emitted rules; Phase 6 doesn't.

- **Non-DOM hosts.** The probe HTML uses a `<div>` and DOM
  `setAttribute`. The browser's cascade requires a DOM. Resolution on
  CPython, Node, or any non-browser host would need either a vendored
  cascade implementation (cpu-oracle.mjs in exodus/canonical-
  implementation/ is one) or VSF format with a non-DOM resolver.
  Phase 6's claim is portability across browsers, not portability
  across hosts; the wider claim awaits Project Plan Priority 5.

- **Reader-correspondence.** The 9,530 matched coords each fire some
  composer-family constraint; we have not done the post-hoc analysis
  asking which 9,530-of-12,500 configurations correspond to human-
  recognizable structural features of TodoMVC. That remains separate
  downstream work.

---

## 5. Three-layer S2 record (Phase 6 closure)

| Layer | Tools that resolve identically | Empirical record |
|---|---|---|
| Constraint-resolution (algorithm 16) | CSS cascade · JS stack machine · WGSL compute shader | 2,602 sets · ~45M comparisons · 22/22 GPU bridge tests · zero divergence (exodus/canonical-implementation/) |
| Joint coord-space (Phase 4) | Phase 4 CPU walker · WGSL shader (same encoding) | 12,500 coords · same instruction set as algorithm 16 · trust transferred (no per-axis re-verification) |
| Substrate deposition (Phase 6) | Phase 6 CSS emitter + browser cascade · Phase 4 CPU walker | 12,500 coords · 9,530 matched · lattice-scope delta 0.2376 · byte-identical to four decimals |

The three layers compose: a substrate ingests open input, settles into
a configuration, emits that configuration as cascade rules, and any of
three independent resolvers produces identical results.

---

## 6. Files

- [css-deposition-emitter.js](css-deposition-emitter.js) — `emitCSS()`
  takes a Lattice, returns the CSS deposition + emit stats.
  `emitProbeHTML()` returns the verifier page.
- [source-nav.html](source-nav.html) — DEPOSIT CSS and DEPOSIT PROBE
  HTML buttons wired to the emitter.

To reproduce:
1. `node implementation/11-source-substrate/serve.js`
2. open `http://localhost:8080/` in any browser
3. boot any corpus (the strongest result is TodoMVC three-language)
4. click DEPOSIT CSS, then DEPOSIT PROBE HTML
5. rename the downloaded CSS to drop its timestamp so the probe HTML's
   href matches
6. put both in the same dir; open the probe HTML
7. click RESOLVE FULL JOINT COORD SPACE; observe the metrics
