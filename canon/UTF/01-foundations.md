# UTF Foundations: Why WHEN:THEN, Not KEY:VALUE

The structural argument that establishes what the universal type
format must be. This document defines the shape; subsequent documents
specify its vocabulary, attributes, identity discipline, and
encodings.

Read [00-INDEX.md](00-INDEX.md) for the directory's role. Read
[research/key-value-formats-survey.md](research/key-value-formats-survey.md)
for the comparative basis. This document synthesizes both.

-----

## 1. The question

The substrate is structurally a kernel-and-adapter architecture
([ARCHITECTURE.md](../../ARCHITECTURE.md)). The kernel routes typed
nodes; adapters translate between hardware protocols and the
kernel's internal protocol. The internal protocol — the format every
adapter speaks on its kernel side — is what we call UTF.

The first question to settle: **does UTF use any existing data
format, or does it require a new structural shape?**

The answer, established below: every existing data format records
*state*. The substrate's resolution model requires recording
*conditional commitment*. The two are structurally different
operations. UTF requires a shape that no widely-deployed format
provides — except CSS, which is the format the cascade has been using
all along.

-----

## 2. The structural shape of KEY:VALUE

The [survey](research/key-value-formats-survey.md) enumerates every
significant key:value format across the history of computing. The
patterns it surfaces are consistent across the entire field:

**The conceptual unit is `(key, value, ???)`.** Every format puts
something in that third slot — type tag, schema reference, namespace,
ordering, timestamp, identity scope. They differ on where that third
slot lives:

- **Inline** (CBOR tags, EDN tags, BSON types, ASN.1 BER): the
  encoding carries the type alongside the value.
- **Beside the bytes** (Protobuf, Avro, OpenAPI): a separate schema
  document defines what types the fields have.
- **In the consumer's head** (JSON, YAML, INI, MessagePack-raw): no
  type information anywhere; the reading program decides.

But across every variation in the third slot, the operation the
format describes is the same: **a recording**. The key names a slot;
the value is what was placed there; the consumer reads it back.

```
key   ->   value         # "this slot currently holds this content"
```

This is the universal shape. JSON, YAML, TOML, Protobuf, MessagePack,
RDF triples, plist, INI, recfiles, even CBOR with all its semantic
tagging — every one of them is a record of state at the time of
writing. The consumer is free to do whatever it wants with the
recording. The format imposes no operation.

-----

## 3. The structural shape of WHEN:THEN

The substrate's resolution model is different in a specific way. A
rule in the substrate is not a recording. It is a **conditional
commitment**:

```
predicate(coord)  ->  partial_assignment(slots)
```

Translated: "*in the region of coordinate space where this predicate
holds, these slots commit to these contents, with this specificity*."

This is the cascade's native shape. A CSS rule:

```
[credit="prime"][product="mortgage"]  {  rt: A-PREFERRED;  rth: 160;  }
```

is not recording that some slot holds A-PREFERRED. It is committing
that *any coordinate satisfying the predicate* will project the
declaration `rt: A-PREFERRED, rth: 160` onto its output record,
subject to specificity ordering against other rules.

The shape:

```
WHEN: predicate over coordinate space
THEN: partial assignment to output slots
WITH: specificity / ordering signal
```

The three components are not optional. Without the predicate, there
is no region to commit to. Without the assignment, there is no
commitment to make. Without specificity, the order in which
overlapping commitments resolve is undefined.

-----

## 4. The differences, named precisely

Five structural differences between KEY:VALUE and WHEN:THEN. Each is
a property the substrate requires and no key:value format provides.

### 4.1. The left side is a predicate, not a name

In every key:value format surveyed, the key is an atomic identifier:
a string (JSON, INI, YAML, KV stores), a number (Protobuf field tags,
ASN.1 OIDs), an IRI (RDF), a byte sequence (CBOR keys, ASN.1 BER
tags). The key *names* something. It does not *describe* something.

WHEN:THEN keys are structured predicates over a coordinate space.
A single predicate may involve multiple dimensions joined by
conjunction, possibly with negation, possibly compound. The closest
analogue in the survey is RDF, where the predicate is an IRI — but
the IRI is still atomic, and the *structure* of an RDF graph
expresses relations, not predicates.

CSS selectors are the only deployed example of structured predicates
as the left side of a key:value-shaped pair. UTF inherits this.

### 4.2. The right side is partial assignment, not whole-value substitution

In every key:value format surveyed, writing to a key replaces the
entire value at that key. There is no native composition operator.
If you want to merge two values, the consumer has to know how —
because the format does not.

WHEN:THEN compositions are **additive on output records**. Rule A
sets `rt = A-PREFERRED`. Rule B at higher specificity sets
`doc = MAXIMUM`. Both apply to coordinates matching both predicates.
The output record at those coordinates carries both: `rt = A-PREFERRED
AND doc = MAXIMUM`. The format itself dictates the composition
operator: per-slot last-write-wins, where "last" is defined by
specificity, and unmentioned slots are unchanged from prior rule
applications or defaults.

No key:value format the survey covers has this composition operator
natively. CSS has it; UTF inherits it.

### 4.3. Order is priority, not sequence

Most formats are either ordered-as-sequence (XML elements, recfiles,
logfmt, plist arrays) or unordered (JSON objects, RDF graphs, hash
tables). In ordered formats, position carries no meaning beyond
"appears at this index." In unordered formats, position carries no
meaning at all.

WHEN:THEN rules are **ordered by specificity**, which is a partial
order, not a total sequence. Two rules at different specificities
have a defined ordering: the more specific applies later, overriding
the less specific where they conflict. Two rules at the *same*
specificity have an arbitrary ordering, broken by source order as a
tiebreak.

This is not document order. It is a priority lattice. The format must
make specificity a first-class attribute of every rule, not bury it
in syntactic position.

### 4.4. Semantics must be in-band, in operational form

The survey's closing observation: the deepest split between formats
is *where semantics live*. Inside the bytes (CBOR, RDF, HCL). Beside
the bytes (Protobuf, Avro, OpenAPI). In the consumer's head (JSON,
INI, MessagePack-raw).

KEY:VALUE formats can put semantics in any of these locations because
the consumer is the one running the operation. WHEN:THEN cannot. The
kernel dispatches on UTF nodes in-band, with no consumer-side
reinterpretation — because the operation (route, apply, commit, emit
delta) is the kernel's job, not the application's.

UTF must carry full operational semantics inside the bytes. The kind
attribute (`type`) names the operation. The predicate and assignment
attributes carry the operation's arguments. The specificity attribute
carries the operation's priority. No schema lookup. No consumer
choice. The format dictates what the kernel does.

This is the same property CBOR has for *referential* semantics
("this is a URI," "this is a date") and HCL has for *evaluation*
semantics ("interpolate this," "iterate that"). UTF needs it for
*resolution* semantics — the substrate's specific operation of
applying conditional commitments to coordinate space.

### 4.5. Identity must be content-addressed

Most formats identify entries by their key string. JSON: the key
"name" identifies one slot. RDF: an IRI identifies a node. KV stores:
the byte-string key.

UTF nodes must be identified by their *content*. The reason: the
same rule may appear in two different programs and need to be
recognized as identical. A rule that has been transformed (DNF
expansion, specificity sort, format conversion) needs to be
recognized as the same rule across transformations. Name-addressing
breaks under transformation; content-addressing survives it.

[Algorithm 13](../algorithm/13-content-addressing-and-merkle.md)
specifies content-addressing via Merkle hashing. UTF identity is the
Merkle hash of the node's canonicalized content. Two nodes have the
same identity iff their content is the same after canonicalization —
regardless of which encoding they were transported in, which adapter
they came from, or which kernel they're being dispatched into.

-----

## 5. The exclusion: what UTF is not

Applying the five structural requirements above to the formats the
survey covers eliminates each in turn:

| Format family | Why it cannot be UTF |
|---|---|
| INI, .properties, .env, logfmt | No nesting; keys are atomic names; no predicate, no specificity. |
| TOML, YAML, JSON, JSON5, JSONC, NestedText | Keys are atomic names; values are passive content; no composition operator. |
| BSON, MessagePack, CBOR, Smile, Bencode | Same shape as JSON in a different encoding. CBOR tags get closest to in-band semantics but tag values, not predicates. |
| XML, HTML attributes, SGML | Atomic keys; native nesting is by value, not by predicate. XML elements with attributes get close to a record shape but predicates are not expressible. |
| Sass, SCSS, LESS | Stylesheet syntax with imperative additions; the imperative layer breaks the WHEN:THEN shape. |
| RDF, Turtle, N3, N-Quads, JSON-LD | Predicate is an IRI (atomic, not structured); semantics are referential, not operational; no native specificity. Closest non-CSS analogue but still structurally different. |
| Berkeley/LevelDB/RocksDB/Redis/Dynamo/Cassandra/BigTable/IndexedDB | Storage layer. Keys are byte strings. No predicates, no commitment. |
| Plist, Org property drawers, Markdown frontmatter | JSON-shape with different syntax. |
| Protobuf, Thrift, Avro, Cap'n Proto, FlatBuffers, ASN.1 | Schema-driven typed records. Field numbers/names are atomic; semantics in schema. No predicate-key. |
| Recfiles, EDN, S-expressions, Lisp alists, Python dicts | Same KEY:VALUE shape, different syntax. |
| HCL | Language with evaluation, but evaluation is procedural (interpolation, expressions), not constraint-resolution. |
| OWL, KIF, KRL | Logical / inferential systems. Closer to WHEN:THEN in spirit but consumer-imposed reasoning, not kernel-native constraint resolution. The closest non-CSS analogue in expressive power. |
| Mustache/Handlebars, HAR, OpenAPI, GraphQL | Schemas or templates, not data-resolution formats. |
| CSS rules and declarations | **The match.** CSS is WHEN:THEN by construction. Specificity, source order, composition, predicate selectors, partial declarations — every property UTF requires, CSS provides natively. |

**CSS is the only format in the entire survey that is structurally
WHEN:THEN rather than KEY:VALUE.** Every other format is a recording;
CSS is a conditional commitment. The structural distinctness of CSS
in the format landscape is what made it the kernel-shape the
substrate inherited.

-----

## 6. What this tells us UTF actually is

UTF is **the CSS structural shape, generalized**. Not CSS the
language (with its specific property vocabulary, value grammars, and
HTML coupling) — CSS the *shape*: predicate-on-the-left, conditional-
commitment-on-the-right, specificity-as-ordering, partial assignment
to typed slots, content-addressed identity.

UTF generalizes this shape along one axis: **node kind**. CSS rules
are one kind of node (predicate over DOM elements → CSS property
assignment). UTF must support every kind of node the substrate emits
or consumes:

- **Rule** (the canonical case): predicate over coordinate space →
  partial assignment to output slots
- **Region**: a named subset of coordinate space, addressable by
  predicate
- **Intern-table entry**: a content-addressed value bound to a
  short identifier
- **Sub-cascade**: a composed cluster of rules with internal naming
- **Trace event**: an append-only record of state change
- **Modulation reading**: a snapshot of the substrate's modulation
  state at a step
- **Delta reading**: a snapshot of vector-delta at a scope
- **Hash record**: a Merkle commitment to a content's identity
- (additional kinds as the substrate's vocabulary requires)

Each kind has its own attribute schema. All kinds share the same
outer structural shape: typed-attribute-bearing nodes with predicate-
assignment-specificity-identity-texture.

The next document in this directory specifies the full kind
vocabulary. The one after specifies the attribute schema per kind.
After that, encodings (how UTF appears as a stylesheet, as JSON, as
XML, as VSF binary). Each document is load-bearing for the
implementations that follow — the kernel, the adapter protocol, the
relocation experiment.

-----

## 7. Consequences for the architecture

Naming UTF as the CSS shape generalized has several immediate
consequences for the existing canon:

**Algorithm 16's substrate-independence demonstration becomes
crisper.** Phase A/B verified that CSS, JS, and WGSL produce
byte-identical output for the same compiled rule set. Restated in
UTF terms: three different adapters consumed the same UTF node
sequence and produced the same kernel state. The byte-identical
result is what you get when adapters honor the same UTF protocol.

**SE-06's substrate duality is rephrased.** Rendering and execution
are not "two substrate connections" in some general sense. They are
**two adapter classes that consume UTF nodes from the same kernel
field**. Their distinct structural properties (parallel-class vs
sequential-class) are properties of their hardware sides, not their
kernel sides. The kernel side is the same: UTF.

**Algorithm 12's IPC protocol is one specific adapter protocol.** The
synchronous logged IPC channel translates between host-language
function calls and UTF message nodes. The general adapter protocol
(to be specified in `canon/adapter-protocol.md`) is the same shape
applied across all adapter classes.

**Phase 5.7.7's IndexedDB persistence is UTF serialization across
time.** The substrate's state at time T, serialized to IndexedDB and
restored across reload, is UTF nodes written to and read from a
specific adapter (IndexedDB). Substrate relocation across hosts is
the same operation across space rather than time.

**The preface's "language inheriting machinery" claim sharpens
again.** What language inherited is not generic kernel-shape (as
ARCHITECTURE.md framed it) — it is specifically **WHEN:THEN-shape
plus typed dispatch**. The cascade became a kernel because it had the
right shape for the work. CSS is the example. UTF is the
formalization. The web platform crossed the threshold because the
cascade has been doing WHEN:THEN at scale for thirty years; that work
accumulated into the shape that now constitutes the substrate's
kernel.

-----

## 8. What this document does not do

- Does not specify the kind vocabulary. That is the next document.
- Does not specify attribute schemas per kind. That is the document
  after.
- Does not specify canonical encodings. That is the document after
  that.
- Does not modify any existing canon. The structural argument here
  *re-reads* existing canon under UTF terms; it does not change what
  any existing algorithm, invariant, or spec extension commits to.
- Does not propose an implementation. UTF specification precedes
  implementation by structural necessity (the kernel cannot be built
  without it; adapters cannot conform to a protocol without it).

-----

## 9. Live status

| Date (yyyy-mm-dd) | Action |
|---|---|
| 2026-05-15 | Foundations document created. Structural argument: UTF is WHEN:THEN, not KEY:VALUE; CSS is the only deployed format with the right shape; UTF generalizes CSS along the node-kind axis. Five structural commitments named. Exclusion of all key:value formats demonstrated against the survey. |

Subsequent documents (02-kind-vocabulary, 03-attribute-schema,
04-identity, 05-encodings, 06-versioning) build on this foundation.
The structural commitments listed in §4 must hold across all of them.
