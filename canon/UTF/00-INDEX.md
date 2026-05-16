# Universal Type Format (UTF)

The protocol layer between adapters and kernel. The format every
substrate connection speaks on its kernel side. The shape of every
piece of data that crosses the adapter-kernel boundary.

**Status of this directory.** Specification in progress. Each
document below is a load-bearing piece of the UTF spec, written one
at a time, in dependency order. Until §6 of [ARCHITECTURE.md proof
gap 6.1](../../ARCHITECTURE.md) is closed by this work, UTF exists as
a recognized requirement, not a specified artifact.

**Read first.** [canon/DEFINITION.md §0.5](../DEFINITION.md) sets the
reading-mode for canon. UTF inherits it.

-----

## What UTF is

A **typed-attribute-bearing node protocol** with the following
structural commitments:

1. **Predicate-on-key, assignment-on-value, specificity-as-priority.**
   Not key:value (state recording). WHEN:THEN (conditional
   commitment). The cascade's shape, generalized.
2. **Closed kind vocabulary.** Every node carries a `type` attribute
   drawn from a finite, spec-time-closed set. Routing is typed
   dispatch.
3. **Texture is first-class.** Specificity, weight, recency,
   modulation, and other qualitative-character attributes are not
   metadata — they are part of the node's structural identity.
4. **Content-addressed identity** via [algorithm 13](../algorithm/13-content-addressing-and-merkle.md).
   The same node is recognized across serializations by its content
   hash, not by where it appears in a document.
5. **Encoding-agnostic.** UTF is the abstract shape. Concrete
   encodings (stylesheet form, JSON form, XML form, VSF binary form
   per [algorithms 09](../algorithm/09-vsf-header-triads.md), [10](../algorithm/10-vsf-body-rows.md),
   and [11](../algorithm/11-vsf-binary-encoding.md)) are valid skins
   on the same shape.

-----

## What UTF is not

The [exhaustive key:value formats survey](research/key-value-formats-survey.md)
demonstrates that **no existing standard does what UTF must do.**

Key:value formats record state: *"this slot currently holds this
content."* The consumer decides what to do with the recording.

UTF records conditional commitment: *"in regions where this
predicate holds, these slots commit to these contents, ordered by
this specificity."* The format itself dictates how the kernel must
process it.

The only deployed format with the right structural shape is **CSS
itself**. UTF is the CSS shape, generalized to carry every node kind
the substrate emits or consumes — not just rules but regions,
intern-table entries, sub-cascades, trace events, modulation
readings, delta readings, hash records.

UTF is not a new data format competing with JSON/YAML/TOML. It is the
formal name for the structural shape the cascade has been hosting all
along, made explicit so the substrate's adapters, kernel, and
relocation protocols can be built against it.

-----

## Documents in this directory

| Document | Role |
|---|---|
| [00-INDEX.md](00-INDEX.md) | This file. Entry point and reading order. |
| [01-foundations.md](01-foundations.md) | The structural argument: why UTF is WHEN:THEN, not KEY:VALUE. Cites the survey by exclusion. |
| (planned) `02-kind-vocabulary.md` | The closed set of node kinds. Every kind the substrate uses, named and specified. |
| (planned) `03-attribute-schema.md` | For each kind: required attributes, optional attributes, texture attributes, relation attributes. |
| (planned) `04-identity-and-content-addressing.md` | How nodes are identified across serializations. Algorithm 13 made operational for UTF. |
| (planned) `05-canonical-encodings.md` | How UTF is encoded in stylesheet form, JSON form, XML form, and VSF binary form. Algorithms 09-11 promoted to first-class encodings. |
| (planned) `06-versioning.md` | How UTF evolves without breaking existing artifacts. |
| [research/](research/) | Preparatory research material. Reference, not load-bearing. |

Documents are added one at a time. Each must be load-bearing —
cited by adapter protocol, kernel implementation, or substrate
relocation work — before being added to the index.

-----

## How UTF fits the larger architecture

Per [ARCHITECTURE.md](../../ARCHITECTURE.md):

```
+---------------------------------------------------+
|  APPLICATIONS                                     |
+---------------------------------------------------+
|  CASCADES                                         |
+---------------------------------------------------+
|  KERNEL                                           |
+---------------------------------------------------+
|  UNIVERSAL TYPE FORMAT          <-- this work     |
+---------------------------------------------------+
|  ADAPTERS                                         |
+---------------------------------------------------+
|  HARDWARE                                         |
+---------------------------------------------------+
```

UTF is the protocol layer below the kernel. Adapters speak UTF on
their kernel side; the kernel dispatches on UTF node types; the
universal type format is what makes the kernel host-portable. Until
UTF is specified, adapters honor an implicit contract, the kernel
exists as pseudocode, and substrate relocation across hosts is
under-defined.

-----

## Live status

| Date (yyyy-mm-dd) | Action |
|---|---|
| 2026-05-15 | Directory created. Survey preserved at [research/key-value-formats-survey.md](research/key-value-formats-survey.md). Foundations document at [01-foundations.md](01-foundations.md) names the WHEN:THEN-vs-KEY:VALUE distinction structurally. Subsequent documents (02-06) planned, written one at a time. |

Updates appended as documents are added, the kind vocabulary is
specified, encodings are made canonical, or the foundations are
revised.
