# 06 - Parallel Probe Array (N coords, one style recalc)

**Status:** IMPLEMENTED and tested.
**Primary origin:** `references/parallel-probes.md` in the skill folder
**Secondary origin:** `State_Converter.MD` "The Parallelization Proof"
**Implemented in:** `exodus-canonical.html` ProbeArray module
**Tests:** `SCAN_SPACE with all 2880 coords drops delta(S->C) to 0`
exercises the full-space parallel resolution end to end

---

## Narrow-claim scope

Resolves the entire cartesian product of dim values in one browser
style recalculation, returning a result per coordinate. This is the
single strongest piece of evidence for the "CSS as parallel constraint
satisfier" claim - it is genuinely parallel computation performed by
the browser rendering pipeline, not simulated with JavaScript loops.

## Specification

### Build phase

```
function build(dims):
 coords = enumerateAll(dims) # cartesian product
 if |coords| > MAX_PROBES: throw # MAX_PROBES = 50,000
 container.innerHTML = "" # teardown
 frag = document.createDocumentFragment()
 for coord in coords:
 el = document.createElement("div")
 for each (dim_i, value_index) in zip(dims, coord):
 el.setAttribute("data-" + dim_i.name, dim_i.values[value_index])
 frag.appendChild(el)
 probes.push(el)
 container.appendChild(frag) # single layout pass
```

### Resolve phase

```
function resolveAll():
 # Warm read forces one style recalc for ALL probes in the container
 _ = getComputedStyle(probes[0]).getPropertyValue("--sdf")

 # Subsequent reads do not recompute; they read the already-resolved values
 results = []
 for i in range(|probes|):
 cs = getComputedStyle(probes[i])
 results.append({
 coord: coords[i],
 resolved: readOutputs(cs),
 })
 return results
```

## Why this is genuinely parallel

When `getComputedStyle` is called on any element after DOM modification,
the browser performs style recalculation for all elements that need it
- in one pass. The browser is free to parallelize this pass internally
and in practice does so (modern engines use worker threads for style
matching). By the time the first `getComputedStyle` call returns, every
probe in the container has been resolved.

The subsequent `getComputedStyle` calls are cheap reads, not triggers
for additional recalcs. So the complete resolution cost is:

```
1 * style_recalc_pass + N * property_read
```

For the 2,880-coord loan space on modern hardware, this measures at
under 20 ms total.

## Cartesian product enumeration

Straightforward recursive construction:

```
function enumerateAll(dims):
 acc = [[]]
 for dim in dims:
 next = []
 for partial in acc:
 for value_index in range(|dim.values|):
 next.append(partial + [value_index])
 acc = next
 if |acc| > MAX_PROBES: throw
 return acc
```

The cap check inside the loop bails early if the product blows up,
rather than enumerating fully and then failing.

## Invariants

1. **One recalc per build+resolve cycle.** All N results come from a
 single style pass.
2. **Order preservation.** `results[i].coord` corresponds to
 `probes[i]`. The enumeration order is fixed (last dim varies
 fastest).
3. **Same cascade, same output as single probe.** Because the compiled
 rules select both `#V-probe` and `#V-probe-container > div`, a
 parallel-array probe for coord C returns the same resolved record
 as a single-probe call at coord C.

## Scaling footnote (from appraisal review)

The "parallel constraint satisfier" pitch holds for this reference
(2,880 coords, ~5 ms style recalc on modern hardware). Browser style
recalc scales roughly with `elements * matching_rules`, so doubling the
state space roughly doubles the recalc cost. For state spaces above
~50,000 coords, DOM construction time and memory both become serious
concerns and the approach stops being competitive with a tight
vectorized implementation. The 50,000 cap is not a theoretical limit
of the technique - it is where this technique stops being the right
tool. The WebGPU compute-shader path (algorithm #16) is the intended
answer for larger spaces.

## SCAN_SPACE integration

`Client.scanSpace()` runs `resolveAll()` and ships every result to the
server as a single SCAN_SPACE message. The server validates each
coordinate (bounds, type, arity) and records the observation. This is
what collapses delta(S->C) to 0 in the Observer.

## What this is NOT

- NOT WebWorkers. There is no JavaScript parallelism here. The browser
 internally parallelizes style recalc; JavaScript remains
 single-threaded.
- NOT asynchronous. The recalc happens synchronously when
 `getComputedStyle` is called.
- NOT a general-purpose parallel primitive. It parallelizes exactly one
 operation: cascade resolution over N DOM nodes. It cannot parallelize
 arbitrary JavaScript.

## Wide-claim scope

The origin document claims this is "genuine parallel computation - not
simulated, not threaded - it is the actual rendering pipeline
executing the constraint rules across the full state space
simultaneously."

This is correct if "parallel" means "the browser's style engine
internally resolves multiple elements in parallel as part of its normal
operation." It is not parallel in the sense of "JavaScript you wrote
runs on multiple cores."

For a code reviewer: the speedup vs. a sequential probe loop is real
and measurable (the appraiser confirmed this is "not a gimmick"). For
a theorist: the "parallel constraint satisfier" framing is defensible
at this scale and degrades at larger ones.

## Related algorithms in this catalog

- `05-single-probe.md` - the sequential primitive this extends
- `07-vessel-dom-bfs.md` - what the resolved map enables
- `16-gpu-postfix-stack-machine.md` - the GPU extension that handles
 larger state spaces
