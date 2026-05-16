# 05 - Single Probe (setAttribute + getComputedStyle)

**Status:** IMPLEMENTED and tested.
**Primary origin:** `exodus-minimal.html` (the canonical teaching
artifact)
**Secondary origin:** `cascade-engine.md` "The Fundamental Pattern"
**Implemented in:** `exodus-canonical.html` Client.probe
**Tests:** exercised every time a navigation click resolves to a result

---

## Narrow-claim scope

The minimal primitive that turns the CSS cascade into a callable
function from coordinates to resolved outputs. Two lines of JavaScript
do the entire computation contract.

## Specification

```
function probe(coord):
 # WRITE: seed the coordinate as data attributes on the probe element
 for each (dim_i, value_index) in zip(dims, coord):
 probeEl.setAttribute("data-" + dim_i.name, dim_i.values[value_index])

 # READ: the browser has resolved the cascade synchronously; read outputs
 cs = getComputedStyle(probeEl)
 return {
 sdf: cs.getPropertyValue("--sdf").trim(),
 rt: stripQuotes(cs.getPropertyValue("--rt").trim()),
 rth: cs.getPropertyValue("--rth").trim(),
 doc: stripQuotes(cs.getPropertyValue("--doc").trim()),
 deny: stripQuotes(cs.getPropertyValue("--deny").trim()),
 reg: stripQuotes(cs.getPropertyValue("--reg").trim()),
 }
```

## Why this works

`getComputedStyle` forces a style recalculation if the DOM has been
modified since the last one. The recalculation is synchronous: by the
time `getComputedStyle` returns, every matching rule has been applied
and the custom properties carry their final values. No `await`, no
`requestAnimationFrame`, no event loop yield.

The probe element itself never renders visibly. It is positioned off-
screen (`position:absolute; left:-9999px`) with `width:0; height:0`.
Importantly it is NOT `display:none`, because custom properties may not
resolve correctly on `display:none` elements in all browsers. It has to
be in layout.

## HTML setup

```html
<div id="V-probe"
 style="position:absolute; left:-9999px; top:-9999px;
 width:0; height:0; overflow:hidden; pointer-events:none">
</div>
```

## Post-processing: stripQuotes

CSS string-valued custom properties return quoted in `getComputedStyle`
output (e.g., `"ENHANCED"` rather than `ENHANCED`). The `stripQuotes`
helper removes balanced leading/trailing quotes if both are present.
This is safe because the compiler only produces quoted strings via
`cssEscapeString`, which always emits double quotes; any unexpected
single-quoted output is still handled correctly for either quote type.

## Invariants

1. **Synchronous.** No promise, no async. The return value is ready on
 the same stack frame as the call.
2. **Side-effect-free (on state).** Writing data attributes mutates the
 probe DOM node but not the domain state. Repeated probes at the
 same coord return identical results.
3. **No JavaScript branching on outputs.** The probe function reads
 values; it does not compare them. Any comparison happens either in
 CSS (the cascade already decided) or in the server (which requested
 the probe).

## Performance

Single probe cost: one setAttribute loop (O(|dims|)) + one style recalc
(bounded by the compiled cascade size and the probe DOM subtree).
Measured in the loan domain at under 1 ms per probe on modern browsers.

## Failure modes and their fixes

| Failure | Cause | Fix |
|---|---|---|
| `getPropertyValue` returns "" | Property not defined in the base rule | Always declare every output property with a default in the base `#V-probe` rule |
| Returned string has extra quotes | CSS string-valued property | Use `stripQuotes` |
| Returned string has extra whitespace | CSS token-valued property near newlines | Always `.trim()` before use |
| Values don't update after constraint change | Old `<style id="cascade-rules">` still in DOM | Teardown-before-inject in `rebuildCascade` |
| Property missing on `display:none` probe | Browser does not resolve custom properties on hidden elements | Use off-screen positioning, not display:none |

## Wide-claim scope

The origin document positions the probe as "the moment CSS becomes the
runtime." That framing is correct at a narrow level: once the cascade
is live, the probe function IS the evaluator. It is not metaphor - the
browser really is doing the work.

The wider framing - that this is "observational collapse" in the
quantum sense - is decorative. The browser doing its job deterministically
is not formally the same as wavefunction collapse, even though both
produce a definite outcome from a declarative description.

## Related algorithms in this catalog

- `04-constraint-compilation.md` - produces the cascade the probe
 reads from
- `06-parallel-probe-array.md` - scales probe to N coords in one
 style recalc
- `07-vessel-dom-bfs.md` - builds on the parallel version for
 distance queries
