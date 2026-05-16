# Research: Key:Value Formats — Exhaustive Survey

**Role.** Reference material. This survey was produced as preparatory
research for the universal type format specification. Its purpose is
to demonstrate, by exhaustive enumeration, that **no existing
key:value format encodes the WHEN:THEN structure the substrate
requires**. The survey establishes what UTF is *not*, which narrows
what UTF must be.

**Date produced.** 2026-05-15

**Method.** Wide-not-deep enumeration of every key:value format
family across the history of computing, with single-paragraph
descriptions covering syntactic shape, what each format encodes
beyond key=value, and where semantics live.

**See also.** [canon/UTF/01-foundations.md](../01-foundations.md)
synthesizes the structural argument this survey supports.

-----

## 1. Configuration formats

### INI / .properties / .env
Example: `key=value` or `key: value`. INI adds `[section]` headers for
one level of grouping; Java `.properties` is flat with `key=value` or
`key:value`, supporting line continuations and `#`/`!` comments;
`.env` is `KEY=VALUE` with shell-like quoting. None natively encode
types (all strings), nesting beyond one section level, references, or
duplicates (last-wins typically). Semantics entirely consumer-imposed.
Designed for application configuration.

### TOML
Example: `name = "value"`. Natively encodes typed scalars (string,
int, float, bool, datetime), arrays, inline tables `{a=1,b=2}`,
nested tables via `[a.b.c]` headers, comments with `#`. Order is
preserved within a table but tables themselves are unordered;
duplicate keys are an error. Semantics carried by the type system;
structure imposed by consumer. Designed for human-edited config
(Cargo, pyproject.toml).

### YAML
Example: `key: value`. Encodes nesting via indentation, typed scalars
(with implicit type inference), sequences, anchors `&` and aliases
`*` for references, tags `!!str` for explicit typing, comments with
`#`, and document streams `---`. Preserves order in mappings (per
spec 1.2). Duplicate keys forbidden. Carries types and references
natively; deeper semantics consumer-imposed. Designed for config and
limited data serialization.

### HCL (Terraform)
Example: `key = "value"` inside `block "label" { ... }`. Encodes
typed scalars, lists, maps/objects, blocks with labels (functions as
compound keys), interpolation `${...}`, expressions, comments. Order
matters for some blocks (provisioners). Carries strong semantics: it
is a declarative language with evaluation, not just data. Designed
for infrastructure declaration.

### NestedText
Example: `key: value`. Strictly string-typed; only strings, lists,
dicts. No type coercion, no quoting rules, no escapes — values are
exactly what is written. Comments with `#`. Nesting via indentation.
No references. Order preserved. Semantics entirely consumer-imposed
(intentionally minimal). Designed for unambiguous human-edited config.

### StrictYAML
Example: `key: value`. Subset of YAML removing implicit typing,
anchors/aliases, flow style, and the Norway problem. All values are
strings unless a schema coerces them. Requires an external schema for
typing. Semantics deliberately external. Designed for human-edited
config without YAML surprises.

## 2. Data-interchange formats

### JSON / JSON5 / JSONC / JSON-LD
Base JSON: `"key": "value"`. Encodes strings, numbers, booleans, null,
arrays, objects (unordered, RFC says duplicate keys SHOULD be unique
but behavior is undefined). No comments, no references, no schema, no
dates. JSON5 adds comments, trailing commas, unquoted keys, single
quotes, hex numbers. JSONC adds only comments (used by VS Code).
JSON-LD adds `@context`, `@id`, `@type` to map JSON onto RDF triples,
giving JSON globally-scoped semantics. Base JSON is semantics-free;
JSON-LD is the exception. Designed for transport.

### BSON
Example: typed binary length-prefixed document, conceptually
`{key: value}`. Adds native types JSON lacks: ObjectId, Date, Binary,
Decimal128, Int32/Int64. Order preserved. Length-prefixed for
traversal. Semantics consumer-imposed; types carried. Designed as
MongoDB's storage and wire format.

### MessagePack
Example: binary tag bytes prefix each value, e.g. `0x82` (fixmap-2)
then key/value pairs. Encodes the JSON type set plus binary and
extension types (timestamps via ext). Compact, type-tagged, no schema.
Semantics consumer-imposed. Designed for efficient transport with
JSON compatibility.

### CBOR (RFC 8949)
Example: similar tag-byte structure, major types 0-7. Adds tagged
values (e.g. tag 0 = date string, tag 1 = epoch, tag 32 = URI)
allowing semantic tagging without a schema, plus indefinite-length
items, bignums, and decimal fractions. Order optionally preserved
(deterministic encoding). Designed for constrained devices and
structured data transport (used in COSE, WebAuthn).

### Smile
Binary JSON-equivalent from the Jackson project. Token-based with
optional back-references for repeated property names and string
values, reducing size. Same type model as JSON plus binary. Semantics
consumer-imposed. Designed for efficient JSON-compatible transport.

## 3. Markup-derived

### XML elements vs attributes
Element form: `<key>value</key>`. Attribute form:
`<elem key="value"/>`. Both express key:value but differ structurally:
attributes are unordered, unique-per-element, string-only, cannot
nest. Elements are ordered, may repeat, may nest, may have mixed
content. XML adds namespaces, processing instructions, comments,
CDATA, DTD/XSD schemas, entity references. Order significant in
elements. Semantics consumer- or schema-imposed. Designed for
documents and data interchange.

### HTML attributes
Example: `<a href="value">`. Subset of XML attribute syntax with
permissive parsing, fixed vocabulary, plus `data-*` for arbitrary
extensions. Semantics defined by the HTML standard per attribute.
Designed for hypertext markup.

### SGML
Ancestor of XML and HTML. Same element/attribute shape but with
omitted tags, SHORTREF, and configurable syntax via SGML declaration.
Schemas via DTD. Designed for document markup.

## 4. Declarative / styling

### CSS rules and declarations
Example: `selector { property: value; }`. Declaration is
`property: value;`. **Properties are a fixed vocabulary with
per-property value grammars (typed by spec). Order matters for
cascade/specificity tiebreaks. Duplicate properties allowed (last
valid wins). Comments `/* */`. Semantics carried by CSS spec.
Designed for presentation declaration.**

CSS is the only format in this entire survey where the key side is
genuinely a *predicate* (selectors over the DOM are predicates over
coordinates) and the value side is genuinely an *assignment*
(declarations write to typed slots). CSS's specificity rules, source
order, and inheritance are the *resolver* for the predicate-assignment
language.

### CSS custom properties
Example: `--my-var: 12px;`. User-defined properties scoped to their
element, inherited, accessed via `var(--my-var)`. Values are token
streams, type-checked only at use site (or via `@property`). Designed
as user-extensible variables within CSS.

### Sass/SCSS variables and maps; LESS variables
SCSS: `$var: value;`. Sass maps: `(key: value, key2: value2)`. LESS:
`@var: value;`. Adds compile-time scoping, nesting, mixins,
arithmetic, control flow. Maps are ordered, allow any data type as
value, looked up via `map-get`. Semantics carried by the
preprocessor. Designed as a stylesheet programming layer.

## 5. Semantic-web / RDF family

### RDF triples / Turtle / N3 / N-Quads / JSON-LD
RDF model: `<subject> <predicate> <object>` — the "key" is the
predicate, but it's an IRI tied to a global vocabulary. Turtle
example: `:alice foaf:name "Alice" .`. N3 extends Turtle with rules
and quoted graphs. N-Quads adds a graph IRI: `<s> <p> <o> <g> .`.
JSON-LD expresses the same triples in JSON. All carry globally-scoped
semantics via IRIs and ontologies (RDFS, OWL). No native order;
duplicates collapse (set semantics). Designed for distributed
knowledge representation.

## 6. Database / storage

### BerkeleyDB / LevelDB / RocksDB
Pure byte-string key to byte-string value. LevelDB/RocksDB sort keys
lexicographically enabling range scans; BerkeleyDB offers btree, hash,
queue, recno access methods. No types, no nesting, no schema.
Semantics entirely application-imposed. Designed as embedded storage
engines.

### Redis
Keys are strings; values are typed: string, list, hash (field:value
sub-map), set, sorted set, stream, etc. Hash example:
`HSET user:1 name alice`. Carries data-structure semantics natively.
No schema across keys. Designed as in-memory data structure server.

### DynamoDB / Cassandra / BigTable
DynamoDB items: attribute:value map per item, with typed attributes
(S, N, B, BOOL, L, M, SS, NS, BS) and partition/sort key schema.
Cassandra: rows in column families, each column is
name:value:timestamp; CQL overlays a typed schema. BigTable: row key
+ column family:qualifier + timestamp -> value (wide-column sparse
map). All three carry a timestamp dimension natively (BigTable and
Cassandra explicitly). Designed for distributed storage at scale.

### IndexedDB
Object stores hold typed structured-clone values keyed by a key path
or out-of-line key. Indexes provide secondary key:value lookup.
Carries types via structured clone. Designed for browser-side storage.

## 7. Programming-language data literals

### Lisp alists/plists; Python dicts; Ruby hashes; JS object literals; Smalltalk dictionaries; Erlang proplists/maps; Clojure maps/records; Lua tables
Alist: `((key . value) ...)` — ordered pairs, duplicates allowed,
linear lookup. Plist: `(key1 value1 key2 value2 ...)` — flat property
list. Python `{"k": v}` — insertion-ordered since 3.7, hashable keys,
no duplicates. Ruby `{k => v}` or `{k: v}` — insertion-ordered, any
object as key. JS `{k: v}` — string/Symbol keys, insertion-ordered
with integer-key quirk; `Map` allows arbitrary keys. Smalltalk
Dictionary — message-based, any objects. Erlang proplist: list of
`{Key, Value}` tuples; Erlang maps `#{k => v}` are unordered with
proper map semantics. Clojure `{:k v}` — immutable, ordered for small
maps (array-map), unordered for larger; records are typed maps. Lua
tables `{k=v, [expr]=v}` — single aggregate type covering arrays and
maps. All carry the language's type system natively; deeper semantics
consumer-imposed.

## 8. Tagged / typed structured forms

### Protocol Buffers / Thrift / Avro / Cap'n Proto / FlatBuffers / ASN.1
All schema-required. Proto3: fields encoded as varint-tagged
`(field_number, wire_type)` pairs; the "key" is a number, mapped to a
name by the .proto schema. Thrift: similar tagged binary plus an IDL
covering services. Avro: schema-driven, schema is sent or referenced;
data has no in-band field tags (very compact); supports schema
evolution rules. Cap'n Proto and FlatBuffers: zero-copy, fixed
offsets from schema, no parse step; FlatBuffers uses vtables for
optional fields. ASN.1: abstract schema with encodings BER/DER/PER/CER
— BER/DER are tag-length-value with universal/application/context/
private tag classes. All carry strong types via external schema;
semantics partly in schema, partly in consumer. Designed for
high-performance typed interchange.

### Recfiles (GNU Recutils)
Example: `Name: Alice\nAge: 30\n\n` (blank line separates records).
Plain-text records of `field: value` lines, supports multi-line
values with `+`, optional type descriptors, foreign keys, queryable
with `recsel`. Order preserved; duplicate fields allowed. Semantics
partly carried (types, FKs) when descriptors present. Designed as a
plain-text database.

### EDN (Clojure)
Example: `{:key "value"}`. Superset of Clojure literal syntax:
symbols, keywords, strings, numbers, booleans, nil, lists, vectors,
maps, sets, plus user-extensible tags like `#inst "2020-01-01"` and
`#uuid "..."`. Tags carry semantics; consumers register readers.
Designed for extensible data notation between programs.

## 9. Markup-as-config

### Plist
XML form: `<key>Name</key><string>Alice</string>` — note key and
value are sibling elements, not nested. Binary form is a tagged
offset-table format. Types: string, integer, real, bool, date, data,
array, dict. Order preserved in dicts (Apple impl). Designed for
Apple platform configuration.

### Org-mode property drawers
Example: `:PROPERTIES:\n:KEY: value\n:END:` under a heading.
Inherited down the outline. String-typed; consumer interprets.
Designed for outline metadata.

### Markdown frontmatter
Example: `---\nkey: value\n---` (YAML), or `+++ ... +++` (TOML), or
`{ ... }` (JSON). The frontmatter inherits its inner format's
semantics entirely. Designed for document metadata.

## 10. Historical / influential

### KRL, KIF, DAML+OIL, OWL
KRL (1970s, Bobrow & Winograd): frame-based knowledge representation
with slots (key:value), defaults, attached procedures, perspectives.
KIF: Knowledge Interchange Format, s-expression-based logic for
first-order assertions, intended as interlingua. DAML+OIL: DARPA
Agent Markup Language merged with OIL; an RDF-based ontology
language, direct precursor of OWL. OWL: Web Ontology Language,
layered on RDF, adds class axioms, property restrictions, cardinality
with description-logic semantics. All carry strong, formal semantics.
Designed for knowledge representation and reasoning.

## 11. Trees and self-describing structures

### ASN.1 tagged encoding and TLV generally
TLV: every value is `(tag, length, value)`; nested constructed values
contain more TLVs. ASN.1 BER/DER is the canonical TLV with tag
classes and a schema. Used in X.509, LDAP, SNMP, Kerberos.
Self-describing to the extent the tag is interpretable; full
semantics require the schema.

### IFF / RIFF / PNG chunks
Each chunk is `(FourCC tag, length, payload[, CRC])`. Containers
(FORM/LIST/RIFF) nest. PNG chunks have case-bit flags (critical/
ancillary, public/private, reserved, safe-to-copy). Key is the
4-byte tag, value is the payload; semantics by chunk-type spec.
Designed for extensible binary container formats.

## 12. Specialized

### Mustache / Handlebars context
A nested object (typically JSON-shaped) supplied at render time.
Templates reference `{{key}}` or `{{a.b.c}}`. Context carries no
schema; semantics imposed by template.

### HAR
JSON document with a fixed schema for HTTP request/response logs
(entries, request, response, timings). Designed for HTTP traffic
capture.

### OpenAPI / GraphQL schemas
OpenAPI: YAML/JSON document describing HTTP API operations,
parameters, schemas (JSON Schema subset). GraphQL SDL: typed schema
with fields `name: Type` and directives `@dir(arg: value)`. Both are
schemas-as-data: the document itself is key:value but its purpose is
to define semantics for other key:value payloads.

### Bencode (BitTorrent)
Example: `d3:key5:valuee` — dictionaries `d...e`, lists `l...e`,
integers `i...e`, byte strings `length:bytes`. Dictionary keys must
be byte strings, must be sorted. No types beyond int/bytes/list/dict.
Designed for BitTorrent metainfo.

### S-expressions
Example: `(key value)` or `((key . value) ...)`. Universal nested-list
syntax; key:value is just one convention. Carries no semantics
intrinsically; entirely consumer-defined. Designed originally for
Lisp source and data, since reused widely (Canonical S-expressions in
SPKI).

## 13. Logging and event

### logfmt
Example: `key=value key2="value with space"`. Flat, ordered key=value
sequence per line, string-typed, quoting for spaces. No nesting, no
schema, duplicates allowed. Designed for greppable structured logs.

### Common Event Format (CEF)
Example:
`CEF:0|Vendor|Product|Version|SignatureID|Name|Severity|key1=value1 key2=value2`.
Header is positional, extension is key=value. Designed for security
event interchange (ArcSight).

### Structured logging libraries
Most (Serilog, Zap, structlog, slog, Bunyan) emit JSON-per-line with
conventional fields (timestamp, level, message, plus arbitrary
attributes). Carry types via JSON. Some support nested context.
Semantics imposed by consumer/SIEM.

---

## Summary observations

**Patterns that recur across all formats**

- The shape `(key, value)` is almost never the real unit. The real
  unit is `(key, value, ???)` where the third slot — implicit or
  explicit — carries type, tag, schema reference, namespace,
  timestamp, or order. Formats differ mainly in where they put that
  third slot: inline (CBOR tags, EDN tags), out-of-band (Avro,
  Protobuf, JSON Schema), conventional (logfmt, INI), or globally
  interned (RDF IRIs).
- "Nesting" is overwhelmingly achieved by making the value side
  itself be another key:value structure. Only RDF-family and
  TLV-derived formats avoid this by externalizing structure (graph
  edges, length-prefixed siblings).
- Order, duplicates, and types are the three axes formats most often
  disagree on, and disagreement here is the source of most
  interoperability bugs (e.g. YAML duplicate-key behavior, JSON
  number precision, INI section semantics).

**Distinct mechanism families**

1. **Text vs binary.** Text: INI, TOML, YAML, JSON-family, XML, CSS,
   Turtle, EDN, logfmt, recfiles. Binary: BSON, MessagePack, CBOR,
   Smile, Protobuf, Thrift, Avro, Cap'n Proto, FlatBuffers, ASN.1
   BER/DER, Bencode (byte-oriented but ASCII-ish), plist-binary, IFF.
2. **Tagged vs untagged.** Tagged carries type/identity inline
   (CBOR, EDN, ASN.1, TLV, IFF, BSON, MessagePack, Smile). Untagged
   relies on position or external schema (Avro, Cap'n Proto,
   FlatBuffers, JSON to a large extent).
3. **Schema-required vs schema-optional vs schemaless.** Required:
   Protobuf, Thrift, Avro, Cap'n Proto, FlatBuffers, ASN.1, OWL.
   Optional/overlay: JSON+JSON Schema, XML+XSD, YAML+StrictYAML,
   OpenAPI overlaying JSON. Schemaless: INI, logfmt, MessagePack-raw,
   EDN-raw, plain JSON.
4. **Ordered vs unordered.** Ordered: TOML (within table), YAML 1.2,
   XML elements, CSS declarations, recfiles, plist, IFF chunks, most
   modern language maps. Unordered: JSON (technically), RDF, hash-
   based KV stores, ASN.1 SET, bencode (sorted = canonical, not
   semantic).
5. **Nested vs flat.** Flat: INI, .properties, logfmt, .env, KV
   stores. Nested by value: JSON, YAML, TOML, XML, CBOR. Nested by
   reference: RDF (graph), JSON-LD, OWL.
6. **Semantics carried vs imposed.** Carried by the format itself:
   HCL (it is a language), CSS (vocabulary is the spec), RDF/OWL
   (IRIs are global), KRL/KIF (logical), Redis (data structures).
   Carried by attached schema: Protobuf/Thrift/Avro/ASN.1, OpenAPI,
   GraphQL. Imposed by consumer: most config and most interchange
   formats including JSON, YAML, MessagePack, CBOR, INI, KV stores.
7. **Identity model.** Local-scoped keys (almost all formats — keys
   are strings within a document). Globally-scoped keys (RDF/OWL/
   JSON-LD IRIs, XML namespaces partially, OIDs in ASN.1).
   Numeric-tagged keys (Protobuf, Thrift, ASN.1 context tags, IFF/
   RIFF FourCCs).

**Formats that do something genuinely different from key:value=key:value**

- **RDF and the semantic-web family** are not key:value at all; they
  are edge-labeled directed graphs. What looks like a key (the
  predicate) is itself a first-class entity with global identity. A
  "value" can be the subject of further triples. This is a
  structurally different model that key:value formats only
  approximate.
- **TLV and IFF** are sibling-sequence formats, not maps: keys (tags)
  may repeat freely in a defined order, and structure comes from
  length-prefixed concatenation rather than nesting-by-value.
- **HCL, CSS, Sass, and OWL** are languages, not data formats: they
  have evaluation semantics (interpolation, cascade, inheritance,
  inference) that change what the data means after parsing.
- **Cap'n Proto and FlatBuffers** abandon parsing entirely — the
  "format" is a memory layout. Keys exist only in the schema; the
  wire form has offsets.
- **Avro** removes inline keys entirely from the payload; the schema
  must travel with or be known to the consumer. This is the cleanest
  example of fully externalized semantics.
- **Wide-column stores (BigTable, Cassandra)** add a third native
  dimension — time — making the conceptual unit `(row, column,
  timestamp) -> value` rather than `key -> value`.
- **Lisp s-expressions and EDN** are not key:value formats at all but
  homoiconic data trees on which key:value is one convention among
  many.

The deepest split in this survey is not text vs binary or even tagged
vs untagged. It is **where semantics live**: inside the bytes (CBOR
tags, RDF IRIs, HCL evaluation), beside the bytes (Avro/Protobuf
schema, OpenAPI, JSON Schema), or only inside the consumer's head
(INI, JSON, MessagePack, KV stores). Most format wars are really
arguments about which of these three locations should hold which
kinds of meaning.
