# 10 - VSF Body Rows + State Slicing

**Status:** IMPLEMENTED.
**Primary origin:** `VSF_Format` section "Body" and "State Slicing"
**Secondary origin:** `vsf-spec.md`
**Implemented in:** `exodus-canonical.html` Server.buildRow +
VSFCodec.parseVSF
**Tests:** `buildRow sanitizes injection chars`, `parseVSF handles
meta + header + rows`

---

## Narrow-claim scope

Each committed state is one line in the body section of a VSF file.
Lines use pipe-delimited fields, where compound coordinate fields
(det and prob) use internal commas. The format is line-oriented so
slicing and grep-style filtering work directly.

## Specification

### Row grammar (normalized, v1.0)

```
row ::= det_coords "|" prob_coords "|" sdf "|" delta "|" rt "|" doc "|" deny "|" reg "|" display_str
det_coords ::= index ("," index)* # det dims, comma-separated
prob_coords ::= (index ("," index)*)? # prob dims, may be empty
sdf ::= "-1" | "1"
delta ::= decimal in [0, 1], 4 places
rt, doc, deny, reg, display_str ::= sanitized string
```

### Field sanitization (Server.sanitizeField)

For every free-form field, strip characters that would violate the
row grammar:

```
function sanitizeField(raw):
 if raw is null or undefined: return ""
 s = string(raw)
 s = s.replace(/[,\r\n|]/g, " ") # strip field separators
 s = s.trim()
 if |s| > 256: s = s[0..256]
 return s
```

This is narrower than strictly necessary - many characters are
syntactically allowed in the grammar - but the wider policy is to
forbid anything that could surprise a downstream parser or leak
through to a display surface.

### Example rows (from VSF_Format + canonical implementation)

```
0,1,0,0,1,0|0,1,2,3,4,5,6,7|-1|0.0000|A-PREFERRED|BASIC||VALID|john smith
2,0,2,1,0,4|0,7,1,0,4|1|0.0000|DENIED|MAXIMUM|Foreign SubPrime Mortgage|DENIED|
```

### Normalization from the old format

The original `VSF_Format` document uses comma as the field separator,
which conflicts with the coord-internal commas. The canonical
implementation uses pipe as the field separator and reserves comma for
inside the coord fields only. See algorithm 09 for why the delimiter
was normalized.

## Why this specific field order

The order `det | prob | sdf | delta | ...` is chosen so that:

1. **Parser can identify column boundaries without schema lookup.**
 The det count is known from the header (= number of det triads).
 After that, you know exactly where prob starts.
2. **SDF and delta come immediately after coords.** These are the two
 "observation" fields (where is it? how certain?) and keep them
 close to the location data.
3. **Named outputs trail.** Rate tier, doc level, deny reason, region
 are in a fixed order matching the constraint model.
4. **Display string is last.** It is the only human-readable free-form
 field and is the most likely to contain unusual characters
 (post-sanitization).

## State slicing

A slice filters rows where a specified dim takes a specified value:

```
function slice(rows, dim_index, value_index):
 return [row for row in rows
 if parse(row).det_coords[dim_index] == value_index]
```

Slices are composable: slicing a slice on another dim gives a sub-
sub-space. Slices are themselves valid VSF bodies against a reduced
header (the fixed dim's triad is dropped from the header).

The canonical implementation does not expose `slice` as a server
message yet. It is trivial to add; the row format is designed for it.

## Invariants

1. **Line-safe.** No row contains `\r` or `\n`. Any row that would
 have contained one is rejected at INJECT time; generated rows have
 newlines sanitized out.
2. **Pipe-safe.** No field except the two coord fields contains `|`.
 This is enforced by sanitizeField.
3. **Round-trippable.** Given the header, every row can be parsed
 back into a structured record without ambiguity.
4. **Delta column monotone at seal.** Rows with `delta = 0` are
 sealed rows. Rows with `delta > 0` would be pre-commit snapshots
 (not currently persisted, but the format supports it).

## Length bounds

Each row is capped at 4096 chars during INJECT. This bounds memory for
operations that load many rows into strings and prevents single-row
storage bombs. The cap is far above what a well-formed row should
need (a 6-dim coord + 30 prob positions + all outputs fits in ~300
chars).

## Binary re-encoding

With the header's axis bounds, each row compresses significantly. See
algorithm 11 (proposed, not implemented). The text form is the
canonical on-disk form; binary is an optimization, not a replacement.

## Wide-claim scope

The origin document describes body rows as "state points" that are
"self-locating" because they carry their column indices and a
header-derived coordinate interpretation. That framing is accurate.
Each row is a complete location in the space plus everything that
coordinate resolved to.

The wider claim - that rows are "proof of execution" because they
carry a delta value certifying resolution depth - depends on whether
you trust the producer. Content-addressing (algorithm 13) partially
closes this gap by making the row's identity hash-bound. It does not
verify that the resolved outputs are correct for the given coord
under the given constraints; that verification requires replaying the
cascade, which is not part of the row format.

## Related algorithms in this catalog

- `09-vsf-header-triads.md` - what the parser needs in order to read
 these rows
- `13-content-addressing-and-merkle.md` - how rows become verifiable
 beyond their textual content
- `11-vsf-binary-encoding.md` - proposed binary compression of rows
