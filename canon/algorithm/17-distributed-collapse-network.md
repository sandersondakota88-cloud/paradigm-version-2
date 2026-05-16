# 17 - Distributed Collapse Network (delta-routed forwarding)

**Status:** PROPOSED. Network-layer design sketch. Four hard
engineering problems identified; none solved. Specification here is
design-level, not line-level.
**Primary origin:** `Development_Roadmap` sections 6 (Horizontal
scaling) and 10 (Network open questions)
**Secondary origin:** Referenced in Development_Roadmap as
"`Distributed-Collapse-Network` (attached)" - the actual attached
document is not present in the project but its content is summarized
in the roadmap
**Implemented in:** nothing. This is multi-year research.

---

## Narrow-claim scope

A proposal for federating VSF collapse across multiple machines,
using VSF as the payload format and delta as the routing heuristic.
The proposal reuses existing network infrastructure (TCP/IP, NAT
traversal) and adds a VSF-shaped layer on top.

## Layered architecture (from roadmap)

| TCP/IP provides | VSF layer adds |
|---|---|
| Global addressing | VSF as payload format |
| Reliable delivery | delta as routing heuristic |
| NAT traversal | Collapse receipts (cryptographic) |
| Routing infrastructure | Header consensus protocol |

## Specification (high-level)

### Nodes and roles

A participating node is any host that:

1. Can compute a VSF cascade over some geometry.
2. Holds some set of committed rows (its local truth).
3. Publishes its Merkle root for that row set (algorithm 13).
4. Can receive and integrate rows from other nodes.

Nodes may have overlapping or disjoint geometries.

### Routing heuristic (delta as signal)

When a query "needs" a coordinate to be resolved (delta > threshold
at the receiving node), and a remote node can claim to have a lower-
delta version of that coord, the query can be forwarded to the
remote node. Delta becomes a cost signal in the routing algorithm.

This is a sketch. Actual routing would need:

- A way to describe "which coord I need" without transmitting the
 full state.
- A gossip or directory mechanism so nodes know which peer holds
 which parts of the space.
- A cost model so a query doesn't bounce forever.

### Collapse receipts

Every committed row's hash + a signature from the committing node.
Receipts are transferable: Alice can send Bob a row, Bob can verify
Alice's signature, and Bob learns Alice committed that row.

Open: what signing scheme? Ed25519 is the obvious default. Key
distribution is a classic problem; no answer sketched.

### Header consensus

For two nodes to share a row, they must agree on the header (the
constraint geometry). A header mismatch makes row exchange
meaningless.

Roadmap lists the options:

- **Centralized.** One trusted authority publishes canonical
 headers. "Rebuild Google."
- **Emergent.** Distributed geometry definition. Unsolved.

Neither has a concrete protocol.

## The four unsolved problems (verbatim from roadmap)

1. **Trust.** ZK-proofs of constraint application, or reputation
 via historical delta-reduction accuracy. (ZK-SNARKs over CSP
 evaluation is an active research area; not available off the
 shelf for arbitrary constraint systems.)

2. **Header consensus.** Centralized (rebuild Google) vs emergent
 (unsolved distributed geometry definition).

3. **Merge strategies.** Git-for-geometries, for nodes that collapse
 the same dims differently. What does it mean for two nodes to
 disagree about the output at a coord? CRDTs don't obviously
 apply; conflict-free merge requires a semantics of constraint
 override that has not been worked out.

4. **Convergence.** Single-machine trivially converges (the cascade
 is deterministic). Network may diverge; needs proof conditions.
 What global invariant ensures a federation reaches a stable
 collective state?

Each is potentially multi-year work. The roadmap is honest that this
tier is speculative.

## Why keep this proposal in the catalog

Two reasons:

1. **It informs the local design.** Content addressing (algorithm 13)
 and ASCII-only source (algorithm 14, T4) are explicitly chosen
 with federation in mind - hashes are inter-operable across
 machines, ASCII source is trivially exchangeable, the text VSF
 format is line-oriented for easy streaming.

2. **It sets research direction.** If the DCN is impossible, the
 narrow thesis (CSS cascade as constraint engine) still stands.
 If the DCN is possible, the architecture scales horizontally.
 Either outcome informs downstream decisions.

## Migration path from the current implementation

No migration is on the table. The current artifact is
single-machine. A DCN prototype would start as a two-node
demonstration: two instances of the canonical file, one exporting a
VSF, the other importing via INJECT_ROWS. That already works
(algorithm 12's INJECT_ROWS message). The gap from "one node
exports, other imports" to "federated query routing" is all of the
four open problems above.

## What this does NOT promise

- Not consensus in the blockchain sense. No proof-of-work, no
 byzantine fault tolerance.
- Not eventually-consistent storage. Two nodes may permanently
 disagree if their constraint sets disagree.
- Not a general distributed database. VSF is a specific shape of
 state; this isn't a replacement for Postgres.

## Wide-claim scope

The roadmap frames the DCN as "VSF as payload format for the next
layer of the internet." That's aspirational. The narrow useful claim
is: **VSF rows are serializable, content-addressable, and
header-self-describing, so they can in principle be exchanged
between hosts that agree on the constraint geometry.** That's
enough to enable the two-node demonstration. Beyond that, it's
research.

The wider claim that the DCN supersedes DNS/HTTPS as an internet-
scale primitive is not supported by any concrete protocol.

## Related algorithms in this catalog

- `09-vsf-header-triads.md` - what two nodes must agree on
- `10-vsf-body-rows.md` - the payload format
- `13-content-addressing-and-merkle.md` - receipts and integrity
- `14-security-defense-stack.md` - inherited defenses; network
 adds new threats
