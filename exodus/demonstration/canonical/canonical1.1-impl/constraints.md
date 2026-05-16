# EXODUS Canonical Constraints - Shared Specification

**Version:** 1.0 **Domain:** loan eligibility (reference)
**Status:** source of truth for both the CSS cascade path and the WebGPU compute-shader path.

This file exists because two implementations are about to share a constraint
geometry. If the constraint arrays drift apart, the verification harness
becomes meaningless - it would diff two systems that disagree *by construction*
rather than two systems that should agree and where disagreement indicates a
bug. Every implementation must read its constraints from this document (or a
machine-generated file derived from it).

---

## 1. Dimensions

Six deterministic dimensions. Cartesian product = **2,880** coordinates.

| # | Name | Values | Card |
|---|---|---|---|
| 0 | `credit` | `prime`, `near-prime`, `sub-prime` | 3 |
| 1 | `product` | `mortgage`, `personal`, `auto`, `business-line` | 4 |
| 2 | `applicant` | `individual`, `joint`, `business`, `trust` | 4 |
| 3 | `residency` | `domestic`, `foreign`, `diplomatic` | 3 |
| 4 | `income` | `under50`, `50to100`, `100to250`, `over250` | 4 |
| 5 | `employment` | `employed`, `self-employed`, `retired`, `student`, `unemployed` | 5 |

Value index within a dimension is its array position (0-indexed). Dimension
index is its row number in the table above.

**Encoding for the GPU path:** pack a coordinate into a single `u32` as
`d0 | (d1<<3) | (d2<<6) | (d3<<9) | (d4<<12) | (d5<<15)`. 3 bits per
dimension covers every cardinality. 18 bits used; 14 bits reserved for
output flags.

---

## 2. Output properties

Every coordinate resolves to these six outputs. Defaults listed first; any
matching constraint's `then` overrides them in the order given.

| Property | Type | Default | Semantics |
|---|---|---|---|
| `sdf` | `-1 \| 1` | `-1` | Signed distance field: `-1` inside valid region, `1` denied |
| `reg` | string ident | `VALID` | Region name |
| `deny` | string | `""` | Denial reason; empty = not denied |
| `rt` | string ident | `UNCLASSIFIED` | Resolved tier |
| `rth` | integer | `0` | Numeric tier for ordering |
| `doc` | string ident | `BASIC` | Documentation requirement |

When a constraint sets `sdf: 1`, the compiler **must** also derive `reg: DENIED`
and `rth: 0`. This is a hard rule - both paths implement it the same way.

---

## 3. Constraints

Every constraint is a `{ when, then }` pair. `when` is a map from dim name to
value; all must match for the rule to apply. `then` is a partial map of the
output properties above.

Constraints are evaluated in listed order. Later rules with equal or greater
specificity (more `when` keys) override earlier ones. For ties, insertion
order wins. Denial rules are listed last by convention but the compiler does
not rely on order for correctness - specificity alone is sufficient.

### Credit-tier defaults (1-key specificity)
```
{ when: { credit: "prime" }, then: { rt: "A-PREFERRED", rth: 160, doc: "BASIC" } }
{ when: { credit: "near-prime" }, then: { rt: "B-STANDARD", rth: 130, doc: "ENHANCED" } }
{ when: { credit: "sub-prime" }, then: { rt: "C-ELEVATED", rth: 95, doc: "ENHANCED" } }
```

### Residency uplifts (1-key specificity)
```
{ when: { residency: "foreign" }, then: { doc: "ENHANCED" } }
{ when: { residency: "diplomatic" }, then: { doc: "MAXIMUM" } }
```

### Denials (2- and 3-key specificity)
```
{ when: { credit: "sub-prime", product: "business-line" },
 then: { sdf: 1, deny: "SubPrime cannot hold BusinessLine" } }

{ when: { residency: "foreign", product: "mortgage", credit: "sub-prime" },
 then: { sdf: 1, deny: "Foreign SubPrime Mortgage not underwriteable" } }

{ when: { employment: "unemployed", product: "mortgage" },
 then: { sdf: 1, deny: "Mortgage requires income source" } }

{ when: { employment: "student", product: "business-line" },
 then: { sdf: 1, deny: "Student cannot hold BusinessLine" } }

{ when: { applicant: "trust", product: "personal" },
 then: { sdf: 1, deny: "Trust cannot hold Personal" } }

{ when: { income: "under50", product: "mortgage" },
 then: { sdf: 1, deny: "Mortgage requires minimum qualifying income" } }
```

**Total: 11 constraints.** Any implementation with a different count is
divergent and must be reconciled before running the verification harness.

---

## 4. Canonical resolution procedure

Given a coordinate `c = [c0, c1, c2, c3, c4, c5]`:

1. Initialize outputs to the defaults from section 2.
2. For each constraint in order:
 - If every key in `when` matches the coord's value for that dim, apply the
 entries in `then` to the current output record (overwriting previous).
3. If `sdf == 1` at the end, derive `reg = "DENIED"` and `rth = 0`.

This is what CSS does via cascade specificity. This is what the WGSL path
must do via explicit iteration. Both paths **must** produce byte-identical
output for every one of the 2,880 coordinates.

---

## 5. Output serialization for the verification harness

Per-coordinate output encoded as a fixed-width record:

```
struct Output {
 sdf : i32, // -1 or 1
 rth : u32, // 0..255 fits trivially; u32 for alignment
 rt : u32, // index into a canonical rt-name table (below)
 doc : u32, // index into a canonical doc-name table
 reg : u32, // index into a canonical reg-name table
 deny: u32, // index into a canonical deny-string table
}
// 24 bytes per coordinate. 2,880 coords * 24 = 69,120 bytes total.
```

### Canonical string tables

String interning is required so GPU output is comparable. Index 0 is always
the empty/default value.

```
rt_table[] = ["UNCLASSIFIED", "A-PREFERRED", "B-STANDARD", "C-ELEVATED"]
doc_table[] = ["BASIC", "ENHANCED", "MAXIMUM"]
reg_table[] = ["VALID", "DENIED"]
deny_table[] = ["" /* 0: no denial */,
 "SubPrime cannot hold BusinessLine" /* 1 */,
 "Foreign SubPrime Mortgage not underwriteable" /* 2 */,
 "Mortgage requires income source" /* 3 */,
 "Student cannot hold BusinessLine" /* 4 */,
 "Trust cannot hold Personal" /* 5 */,
 "Mortgage requires minimum qualifying income" /* 6 */]
```

The CSS path reads strings from `getComputedStyle`; the GPU path writes
indices. The harness compares by mapping CSS string outputs back through
these tables. Any string not in its table is a spec violation.

---

## 6. Verification contract

The harness loads the constraints from this spec, runs both paths, and
asserts:

1. Both paths produce **exactly 2,880** output records.
2. For every coord `c`, `css_output[c] == gpu_output[c]` field-by-field.
3. No string in CSS output is absent from the canonical tables above.
4. Runtime: CSS path (canonical file's ProbeArray) under 20 ms for full
 space on a reference machine; GPU path under 5 ms once the pipeline is
 warm. Both numbers are soft targets, not correctness conditions.

**Divergence is always a bug. It is never a "close enough."** The whole
point of this exercise is byte-equality across two radically different
execution substrates running the same geometry.

---

## 7. Changes to this spec

Do not edit constraints, dim values, output tables, or the canonical tables
without bumping the version at the top of this file. Both implementations
pin to a version. A version mismatch aborts the harness before running
anything, to prevent the "I thought we were testing the same thing" failure
mode.
