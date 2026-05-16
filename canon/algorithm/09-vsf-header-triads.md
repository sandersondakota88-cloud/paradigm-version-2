# 09 - VSF Header Triads (self-describing dimensions)

**Status:** IMPLEMENTED.
**Primary origin:** `VSF_Format` section "Header"
**Secondary origin:** `vsf-spec.md` in the skill folder (normalized
delimiter)
**Implemented in:** `exodus-canonical.html` Server.buildHeaderTriads
and VSFCodec.exportVSF
**Tests:** `exportVSF includes Greek delta symbol in header`,
`exportVSF header uses " | " delimiter (normalized)`

---

## Narrow-claim scope

A self-describing header format where each triad declares one dimension
of the state space: its name, the label-to-index mapping for its
values, and its axis bounds. The header carries everything a parser
needs to decode the body - no external schema required.

## Specification

### Triad grammar

```
triad ::= name ":" mapping ("," mapping)* "|" min "|" max
mapping ::= label "=" index
```

Example:
```
credit:prime=0,near-prime=1,sub-prime=2|0|2
```

### Header grammar

```
header ::= triad (" | " triad)*
```

Triads are separated by ` | ` (space-pipe-space). This delimiter was
**normalized** during the v1.0 rewrite: the original `VSF_Format`
document used comma-separated triads, which is ambiguous because
commas also appear inside triads. The skill's `vsf-spec.md` specifies
space-pipe-space and the canonical file emits that form.

### Continuous dimension (for delta)

A special triad for the delta channel appears at the end of the
header:

```
delta:noise=continuous|0.0|1.0
```

(In the canonical file this is emitted with the Greek letter delta,
U+03B4, as the single non-ASCII byte in the output file. Source code
stays ASCII-only; the output file may contain this one rune.)

### Full example

```
credit:prime=0,near-prime=1,sub-prime=2|0|2 | product:mortgage=0,personal=1,auto=2,business-line=3|0|3 | applicant:individual=0,joint=1,business=2,trust=3|0|3 | residency:domestic=0,foreign=1,diplomatic=2|0|2 | income:under50=0,50to100=1,100to250=2,over250=3|0|3 | employment:employed=0,self-employed=1,retired=2,student=3,unemployed=4|0|4 | delta:noise=continuous|0.0|1.0
```

## Construction (exported verbatim from Server.buildHeaderTriads)

```
function buildHeaderTriads():
 result = []
 for each dim in dims:
 maps = []
 for each (value, index) in enumerate(dim.values):
 maps.append(value + "=" + index)
 triad = dim.name + ":" + maps.join(",") + "|0|" + (|dim.values| - 1)
 result.append(triad)
 return result
```

## Probabilistic header triads

Probabilistic dimensions (per-position character slots) generate one
triad each:

```
pos0:a=0,b=1,...,z=25|0|25
pos1:a=0,b=1,...,z=25|0|25
pos2:a=0,b=1,...,z=25,_=26|0|26 # space allowed at pos >= spaceMin
```

The `_=26` mapping appears only on positions within the `[spaceMin,
spaceMax]` range. This encodes domain rules (e.g., names can't start
with a space).

## Invariants

1. **Round-trippable.** A parser reading only the header can compute:
 total dimensionality, cardinality of each dimension, the label->
 index map (and its inverse), and axis bounds for every dim.
2. **Name uniqueness.** Dimension names are CSS identifiers (validated
 by `requireCssIdent`), so they are safe for use as attribute
 suffixes and as column keys.
3. **Index range is zero-based and contiguous.** Values are indexed
 `0..N-1`, min is always `0`, max is always `|values|-1`.
4. **Delta triad is present when exporting rows.** The exporter
 always appends the continuous delta triad as the last header entry.

## Why the space-pipe-space delimiter

The original comma delimiter was ambiguous:

```
credit:prime=0,near-prime=1,sub-prime=2|0|2,product:mortgage=0,...
 ^ triad boundary?
 ^ or just the next mapping?
```

A greedy parser can split correctly if it tracks `|` counts, but the
format is hostile. Space-pipe-space is unambiguous at both the
character level and the visual level, and it's a single
search-and-replace to upgrade old files.

## What this is NOT

- Not binary. The text form is the canonical form; binary bit-packing
 is a separate layer (algorithm 11, proposed not implemented).
- Not versioned in-band. The canonical file prepends a metadata
 comment line `# exodus-canonical v1.0 merkle=... rows=N` but the
 header grammar itself has no version field.
- Not extensible with new triad types. The grammar is fixed: each
 triad is `name:mappings|min|max`. Continuous dimensions use the
 literal `continuous` keyword as a mapping; other types would need
 a grammar extension.

## Wide-claim scope

The origin document frames the header as "the codec": it is the
schema, the type definitions, and the coordinate system in one
package. That framing is accurate. The whole file is interpretable
with no external reference.

The wider claim - that this is an instruction-set encoding in the
sense that SPIR-V or x86 are instruction-set encodings - is overstated.
The header declares a coordinate system; it does not encode
executable instructions. Execution happens in the cascade (narrow
claim) or in the compute shader (algorithm 16), using the
header as one input among several.

## Related algorithms in this catalog

- `10-vsf-body-rows.md` - the body rows that the header describes
- `11-vsf-binary-encoding.md` - the proposed binary form
- `14-security-defense-stack.md` - validators that harden header
 construction against injection
