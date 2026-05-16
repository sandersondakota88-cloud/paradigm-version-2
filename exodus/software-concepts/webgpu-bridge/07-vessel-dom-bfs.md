# 07 - Vessel DOM + BFS Distance-to-Denial

**Status:** IMPLEMENTED (core VesselDOM + BFS in `parallel-probes.md`
reference; canonical file implements the probe array piece)
**Primary origin:** `references/parallel-probes.md` in the skill folder
**Secondary origin:** `Development_Roadmap` scaling table ("BFS
distanceToDenial")
**Implemented in:** skill reference code; can be ported to
`exodus-canonical.html` without additional design work

---

## Narrow-claim scope

After the parallel probe array resolves every coord in the state
space, graph queries over the geometry become pure lookups. BFS from
any origin coordinate finds the nearest denied coord and counts the
safe volume within a radius - without performing a single additional
probe.

## Specification

### Vessel DOM data structure

```
nodes : Map<string, { el, resolved }>

function build(dims):
 container.innerHTML = ""
 nodes.clear()
 for coord in enumerateAll(dims):
 el = create_probe_element(coord)
 nodes.set(coord.join(","), { el, resolved: null })

function resolve():
 for each node in nodes:
 cs = getComputedStyle(node.el)
 node.resolved = readOutputs(cs) # one style recalc, N reads

function read(coord):
 return nodes.get(coord.join(","))?.resolved # O(1) Map lookup

function slice(filter, dims):
 # filter: partial map dim_name -> value_index
 # returns nodes matching the filter
 return [node for node in nodes if node.coord matches filter]
```

### BFS distance-to-denial

```
function distanceToDenial(origin, maxRadius, dims):
 visited = {}
 queue = [{ coords: origin, dist: 0 }]
 safeVolume = 0
 nearestDist = infinity
 nearestDeny = null

 while queue not empty:
 node = queue.shift()
 key = node.coords.join(",")
 if visited[key]: continue
 visited[key] = true

 resolved = VesselDOM.read(node.coords)
 if resolved is null: continue

 if resolved.sdf != "-1":
 # denied coord - update nearest and stop expanding this path
 if node.dist < nearestDist:
 nearestDist = node.dist
 nearestDeny = { coords: node.coords, deny: resolved.deny }
 continue

 # valid coord - count it, expand neighbors
 safeVolume += 1
 if node.dist >= maxRadius: continue

 for each dim_i in range(|dims|):
 for offset in [-1, +1]:
 neighbor = node.coords.copy()
 neighbor[i] += offset
 if 0 <= neighbor[i] < |dims[i].values|:
 if not visited[neighbor.join(",")]:
 queue.push({ coords: neighbor, dist: node.dist + 1 })

 return {
 dist: nearestDist,
 safeVolume: safeVolume,
 nearestDeny: nearestDeny,
 }
```

## Why this is fast

Without the pre-resolved map, each BFS step would require a
`probe(coord)` call: one `setAttribute` loop, one style recalc, one
read loop. With the map, each step is one `Map.get` call.

For the loan domain (2,880 coords), BFS to exhaustion is a few
milliseconds instead of potentially seconds.

## Neighbor definition

Neighbors are coords that differ by `+/-1` in exactly one dimension.
This is the discrete Chebyshev-adjacency structure of the state space.
It matches how a human navigating the UI would move (click one button
at a time).

Other neighbor definitions are possible:

- **L1 (taxicab) neighbors:** same as above (only `+/-1` in one dim).
- **L_infinity (Chebyshev) neighbors:** any coord differing by `+/-1`
 in any subset of dims. Much larger branching factor.
- **Specificity neighbors:** coords reachable by changing the value in
 a single dim to ANY other value (not just adjacent). This is how
 CSS specificity would traverse the space.

The implementation uses L1. If your domain wants a different
adjacency, replace the inner neighbor loop.

## Invariants

1. **BFS distance is the minimum L1 distance** from origin to a denied
 coord, within the provided maxRadius cap.
2. **`safeVolume` counts unique valid coords reachable within
 maxRadius.** If maxRadius exceeds the space diameter, this is the
 complete safe region from origin.
3. **Coordinates outside the state space are never visited.** The
 `0 <= neighbor[i] < |dims[i].values|` check bounds the walk.
4. **Readonly.** BFS does not call `probe`, does not setAttribute on
 anything, does not modify any node.

## Integration notes

The canonical file has `ProbeArray` (algorithm 06), not `VesselDOM`.
They differ only in data structure: ProbeArray keeps a parallel
`probes[]` + `coords[]` pair; VesselDOM uses a Map. Porting BFS is a
matter of adding the Map, adding the lookup-and-slice methods, and
copying the BFS routine from `parallel-probes.md`.

Trade-off: Map lookup is slightly slower than array indexing, but
VesselDOM's `slice(filter)` is a real win for dimension-slice queries
that don't need BFS. If you do both BFS and slicing, use VesselDOM. If
you only do bulk resolve + stats, ProbeArray is enough.

## Wide-claim scope

The origin document frames this as the "computation as geometry" thesis
in its purest form: once the cascade has resolved the space, domain
queries become pure spatial lookups. That framing is accurate for this
algorithm. The space IS laid out. Queries ARE geometric.

The wider claim - that this generalizes to "computation is always
geometric, we just usually don't notice" - is not supported by the BFS
implementation itself. The algorithm works; whether its applicability
to other problems is "deep" or "coincidental" is not decided here.

## Related algorithms in this catalog

- `06-parallel-probe-array.md` - what produces the pre-resolved data
- `16-gpu-postfix-stack-machine.md` - GPU scaling where 3D texture
 sampling replaces the Map lookup
