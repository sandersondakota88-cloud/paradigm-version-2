# 11 - VSF Binary Bit-Packing, Delta-Frames, Confidence Culling

**Status:** PROPOSED. None of these three compression layers are
implemented. Specification is detailed enough to build directly from.
**Primary origin:** `VSF_Format` sections "Binary Encoding",
"Compression for Network Traversal", "Noise and Compression"
**Secondary origin:** `vsf-spec.md` "Binary Encoding (reference)"
**Implemented in:** nothing yet

---

## Narrow-claim scope

Three independent compression strategies for VSF rows, each exploiting
a specific structural property. Layer 1 (bit-packing) is
arithmetic-only. Layer 2 (delta-frames) treats streaming as keyframes
+ diff transitions. Layer 3 (confidence culling) uses the delta value
as a level-of-detail knob.

All three produce a binary encoding separate from the canonical text
form; the text form remains the reference.

## Layer 1: Bit-packing

### Specification

Each dimension value uses `ceil(log2(max - min + 1))` bits. For the
loan domain:

| Dimension | Cardinality | Bits |
|---|---|---|
| credit | 3 | 2 |
| product | 4 | 2 |
| applicant | 4 | 2 |
| residency | 3 | 2 |
| income | 4 | 2 |
| employment | 5 | 3 |
| **Total per coord** | | **13 bits** |

A full 2,880-coord space at 13 bits/coord is 5,760 bytes before
output fields. Same data in the text form: ~35 KB. Ratio: ~6:1.

### Encoding procedure

```
function packCoord(coord, dims):
 bits = 0
 offset = 0
 for each (value_index, dim) in zip(coord, dims):
 width = ceil(log2(|dim.values|))
 bits |= (value_index << offset)
 offset += width
 return bits
```

For the loan domain, `offset` ends at 13, fitting in a `u16` or
comfortably in a `u32`.

### Output fields

Each row also carries `sdf, delta, rt, doc, deny, reg`. Bit-packing
these requires string tables (agreed canonical indices for each
value; see `constraints.md` section 5 in the repo root). With tables,
each output field is `ceil(log2(|table|))` bits.

## Layer 2: Entropy encoding

### Specification

After bit-packing, apply a general entropy coder (Huffman, range, or
arithmetic) to the resulting byte stream. The SDF column is highly
biased (most coords are valid; denials are a minority), and rate
tiers typically follow a Zipf-ish distribution. Entropy coding halves
the space again for typical data.

Not specified in detail in source documents; standard techniques apply.

## Layer 3: Spatial coherence (run-length)

### Specification

Along any axis, adjacent coords tend to share SDF values (valid
regions are contiguous, denial regions are contiguous). Encode runs
of identical SDF values along a chosen traversal order.

The canonical enumeration order (last dim varies fastest) gives good
locality for typical constraint patterns because constraints that
force denial tend to gate on leading dims. A row-major traversal with
run-length encoding on SDF alone yields another 2-3x compression on
typical data.

## Delta-frames (streaming variant)

### Specification

For state transitions, encode only the dimension that changed:

```
delta_frame ::= dim_index (1 byte) value_index (1 byte)
```

Total: 2 bytes per state change. The receiver applies the delta and
resolves everything else locally.

### Use case

Client navigates from coord A to a neighbor A' by clicking one button.
Only one dim value changes. A full VSF row (~300 text bytes, ~2 binary
bytes) is overkill; a 2-byte delta frame is enough.

### Limitation

Receiver must have the geometry header and the cascade already. Delta
frames assume both sides agree on what the constraints are.

## Confidence culling (delta-keyed LoD)

### Specification

Every row carries a delta value (column 4 in the canonical row format).
A consumer can request only rows where `delta < threshold`:

```
function cullByConfidence(rows, threshold):
 return [row for row in rows if parseDelta(row) < threshold]
```

### Use cases

- Client wants only sealed state: request `delta < 0.01`.
- Client wants the full picture including in-progress observations:
 request all rows.
- Server at rest stores all rows but transmits only the filtered view.

This is level-of-detail via observation-depth. A novel use of the
delta field, and the reason it is a first-class column rather than
metadata.

## Combined expectation (from VSF_Format)

The source document estimates: **"the full 2,880-state loan eligibility
space, including all resolved properties, should compress to under 2KB
for network transmission."**

Breakdown:
- Layer 1: 5.6 KB
- Layer 2: halves it -> ~2.8 KB
- Layer 3: halves it again on typical data -> ~1.4 KB

Under the rounded "under 2 KB" claim.

## What's required to implement

### Minimum viable binary codec

1. A canonical string table file (per domain or per-file) mapping each
 output-field string to a small integer. `constraints.md` section 5
 already defines this for the loan domain.
2. A header-parser that reads dim cardinalities and computes bit
 widths.
3. A pack/unpack pair for a single row.
4. A test: round-trip every row in a test VSF through pack/unpack,
 assert byte-equality of the parsed form.

### Minimum viable delta-frame codec

1. Same header parser.
2. A two-byte pack/unpack.
3. A state-synced sender/receiver pair that agrees on "current coord."

### Minimum viable confidence culler

1. One-line server-side filter in the export path.

None of these are hard. They are PROPOSED rather than IMPLEMENTED
because the text form is sufficient for every current use case, and
compression becomes interesting only when network transport matters
(algorithm 17, Distributed Collapse Network). Implementing binary
early would add test surface without unlocking anything.

## Invariants the implementation must satisfy

1. **Round-trip byte equality.** Text -> binary -> text must reproduce
 the original row.
2. **Header-bound decodability.** Given only the header, a parser must
 be able to decode every row.
3. **No loss at delta = 0.** Sealed rows must round-trip without
 information loss. (Lossy compression of in-progress rows is
 permissible; lossless of sealed rows is not.)
4. **Table version checked.** The string-table version must match
 between writer and reader; a mismatch aborts decoding. (Analogous
 to the `constraints.md` version pin between the CSS path and the
 GPU path.)

## Wide-claim scope

The origin document frames this as "codec analogy": header = codec,
full state point = keyframe, delta frame = p-frame, confidence culling
= level-of-detail. That framing is tight and useful. Video codecs
really do work this way, and the structural correspondence is real.

The wider claim - that VSF is a "codec for computation itself" - is
metaphoric. This codec compresses state, not computation.
Decompressing the state does not replay execution; it just reconstructs
a coordinate record.

## Related algorithms in this catalog

- `02-delta-computation.md` - the value that confidence culling keys on
- `09-vsf-header-triads.md` - the source of bit widths
- `10-vsf-body-rows.md` - the text form this compresses
- `17-distributed-collapse-network.md` - where binary encoding
 becomes operationally necessary
