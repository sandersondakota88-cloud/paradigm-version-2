# 13 - Content Addressing, Merkle Root, Serialized Hash Queue

**Status:** IMPLEMENTED and tested (including the race-exposure
regression tests from the appraisal review).
**Primary origin:** `Development_Roadmap` defense item 2
("content-addressable state") and open question "How to certify 1:1
NAT bijection when server state is mutable"
**Secondary origin:** appraisal review round (the race was caught
there)
**Implemented in:** `exodus-canonical.html` IPC module (hashQueue,
hashAndCommit, recomputeMerkle)
**Tests:** `two concurrent commits: final merkle deterministic`,
`ten concurrent commits: no hash-array gap, final merkle matches`,
`INJECT_ROWS followed by COMMIT: final merkle deterministic`

---

## Narrow-claim scope

Every committed row is identified by its SHA-256 hash. A Merkle root
over the sorted list of row hashes provides a single-hash commitment
to the full committed state. Hashing is serialized through a promise
queue so the Merkle root is a deterministic function of commit order,
never of async-task scheduling.

## Specification

### Per-row hash

```
hash_i = SHA-256(row_i) # hex string, 64 chars
```

Stored in a parallel array to `committedRows`, populated
asynchronously as `crypto.subtle.digest` promises resolve. Until a
hash completes, the corresponding entry in `committedHashes` is the
empty string.

### Merkle root

Standard binary Merkle construction:

```
function recomputeMerkle():
 hashes = committedHashes.filter(h => h != "")
 if |hashes| == 0: return ""
 level = hashes
 while |level| > 1:
 next = []
 for i in range(0, |level|, 2):
 a = level[i]
 b = level[i+1] if i+1 < |level| else level[i] # duplicate on odd
 next.append(SHA-256(a + b))
 level = next
 return level[0]
```

Odd node counts duplicate the last hash at each level. Concatenation
is hex-string-concat; the inputs are already hex-encoded so the hash
input is 128 ASCII chars for each internal node.

### Serialized hash queue

```
hashQueue = Promise.resolve()

function hashAndCommit(index, row):
 hashQueue = hashQueue.then(() =>
 sha256Hex(row).then(hash =>
 # Post SET_HASH through the channel so the Observer sees it
 Server.handleMessage({type:"SET_HASH", index, hash})
 Observer.onResponse(SET_HASH_request, SET_HASH_response)
 return recomputeMerkle()
 ).then(root =>
 if root != "":
 Server.handleMessage({type:"SET_MERKLE", root})
 Observer.onResponse(SET_MERKLE_request, SET_MERKLE_response)
 fire post-commit listeners
 )
 ).catch(e => log error, return undefined) # keep queue alive
```

## Why serialization matters (the race the appraiser caught)

**Without serialization:** hash operations run concurrently. If commit
B hashes faster than commit A (easy when hash latencies vary), the
hash array temporarily looks like `[empty, hash_B, empty, ...]`. If
`recomputeMerkle` is triggered during that window, it filters out the
empties and computes a Merkle root over `[hash_B]` alone -- a root
that excludes an earlier row. Any consumer who exports during that
window gets a root that will not match a later recompute over the
same rows.

**With serialization:** at any moment when `recomputeMerkle` runs,
the hash prefix is `[hash_0, hash_1, ..., hash_k]` for some contiguous
k, and the root is a deterministic function of that prefix. Export at
any time gives a root a future recompute will agree with.

This was verified by the test `ten concurrent commits: no hash-array
gap, final merkle matches` which uses a hostile crypto stub with
variable latency in `[0, 15]ms` to stress the ordering.

## Invariants

1. **No hash-array gaps in the committed prefix.** After the queue
 drains, every index `0..|rows|-1` has a filled hash.
2. **Merkle root matches an oracle.** Running the same binary-Merkle
 construction over the row list produces the same root bit-for-bit.
3. **Intermediate roots are deterministic.** At any snapshot, the
 Merkle root is the function of the committed prefix length and
 the committed rows, nothing else.
4. **Hex-format enforced.** SET_HASH validates
 `^[0-9a-f]{64}$`. SET_MERKLE validates the same. Malformed values
 return ERROR.

## What this does NOT close

- Does not prove that a committed row is "correct" for its coordinate
 under the stated constraints. The hash binds the row's bytes, not
 the cascade that produced it.
- Does not timestamp. There is no append-only log, no
 "what-happened-when" record. Two writers with the same row list get
 the same Merkle root regardless of when they committed.
- Does not authenticate. Anyone with the row text can compute the
 hash. Signing would require an additional layer (proposed for the
 DCN path, algorithm 17).
- Does not version. The Merkle scheme itself has no version tag. If
 the construction ever changes (different padding, different tree
 layout), downstream consumers break silently unless an explicit
 scheme-version is added.

## Defenses

1. **Reserved-key rejection** on SET_HASH payload (T3 in algorithm
 14).
2. **Hex format validation** on incoming SET_HASH and SET_MERKLE.
3. **Error-swallowing catch** in the queue prevents one failure from
 stalling the entire chain.
4. **Bounded queue depth** is implicit: the queue serializes through
 commit processing, which is itself bounded by INJECT caps and
 normal UI flow.

## Wide-claim scope

The `Development_Roadmap` frames content-addressing as the candidate
solution to "certify 1:1 NAT bijection when server state is mutable."
That is narrow and accurate: the Merkle root lets an observer
verify they are seeing the same state another observer saw, without
replaying the state itself.

The wider framing - that this turns the VSF file into a "proof of
execution" in some formal sense - overstates the guarantee. Content-
addressing proves row-set identity. It does not prove that the rows
were produced by valid cascade evaluations. For the narrow product
story, row-set identity is enough; for the thesis that "the file is a
machine," it is not.

## Related algorithms in this catalog

- `10-vsf-body-rows.md` - what gets hashed
- `03-delta-ipc-channel-fidelity.md` - the merkle-window dynamic
 that makes this visible in the UI
- `12-synchronous-logged-ipc.md` - where the async work runs
- `17-distributed-collapse-network.md` - proposed extension with
 signed commits and ZK proofs
