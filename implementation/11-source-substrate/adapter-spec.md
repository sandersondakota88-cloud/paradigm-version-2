# Phase 1 — Adapter Specification

**Status:** Phase 1 deliverable per `PLAN.md` §3. Specification +
delivered implementation (`corpus-adapter.js`, `acorn.js` vendored).

**Date:** 2026-05-25 (created); 2026-05-26 (corpus-shift note added)

> **Corpus shift (2026-05-26):** §1 below names `exodus-vlan-sync.html`
> as the target corpus. Actual Phase 2 and Phase 3 smoke tests run
> against `implementation/kernel/field.js` instead. The adapter itself
> (`corpus-adapter.js`) is corpus-agnostic — it accepts any JS source
> string. See PLAN.md §8 CORPUS SHIFT note and §9.3 for the
> reconciliation. The §1 vlan-sync framing below is preserved as the
> original Phase 0 decision but does not describe what the adapter
> was actually fed.

**Discipline:** This document does not invent. Per UTF Q2
sub-recognition 4 (`canon/UTF/utf-decision-questions.md`): adapters
wrap host-environment parsers and do not reimplement parsing. The
HTML adapter wraps the browser's DOMParser. The CSS adapter wraps
the browser's CSSOM. The JS adapter wraps Acorn (a spec-faithful
implementation of ECMA-262 parsing). Each adapter is spec-bound,
not implementation-bound — the substrate trusts whichever
authoritative implementation of a spec the host provides.

---

## 1. The honest scope problem

The corpus `exodus-vlan-sync.html` contains three host languages:

- **CSS** (lines 6-96): 90 lines, ~30 selectors, ~50 declarations.
- **HTML body** (lines 97-211): 114 lines of markup with the SPA's
  visible structure.
- **JavaScript** (lines 212-749): 538 lines, the application's
  logic — the IPC bus, the VLAN tagger, the sync observer, the
  cascade compilation.

Three host languages means **three adapters**, each wrapping its
spec-authoritative parser. The substrate ingests all three streams.
Per SE-11 the dimensional resolution works across whatever axes the
substrate observes — if all three host languages emit per-token
records with the five-axis information, the composer can intersect
across host languages, which is exactly the structurally interesting
case (does a CSS class name recur in the same positions as a JS
identifier? does the substrate notice?).

But Phase 1's discipline is: smallest credible spec that earns the
SE-11 claim. Three adapters at once is bigger than what the PLAN
scoped. **Phase 1 spec commits to JavaScript only**, with the HTML
and CSS portions noted as Phase 11-extension candidates. Rationale:

- The JS block is 71% of the corpus by line count.
- The JS block contains the application's load-bearing logic (the
  IPC bus, the VLAN classifier, the sync polling loop). The CSS and
  HTML are presentation.
- Acorn is mature, single dependency, no build step.
- Extending to HTML + CSS adapters is additive — adding them later
  doesn't invalidate the JS adapter work.

If Phase 6 observation suggests cross-host-language intersection is
where the load-bearing structure lives (e.g., the VLAN classifier's
behavior only makes sense when you see the CSS rules it compiles to),
we revisit and add the other adapters as Phase 7.

---

## 2. The adapter contract

**Input:** the JS source string (extracted from the corpus's
`<script>...</script>` block via simple substring slice).

**Output:** a stream of per-token UTF intake records, one record
per token, emitted in source-order. Each record carries the five
axes' worth of per-token information.

**Adapter does NOT:**
- Interpret tokens (no "this is a function declaration").
- Aggregate across tokens (no "this identifier appears N times").
- Generate predictions, derive constraints, or otherwise act as
  the substrate. The adapter is *intake only* per SE-08.
- Run any cascade logic.

**Adapter DOES:**
- Tokenize via Acorn's `tokenizer()` API.
- For each token, derive the five-axis information from Acorn's
  output + a small position-class enrichment pass.
- Emit each token's record to the substrate's intake stream in
  source-order.

---

## 3. The intake record shape

```
TokenIntakeRecord {
  // Identity
  index:           Integer    // 0..N-1, source-order
  source_range:    [Int, Int] // [start, end] character offsets in source

  // Axis 1 — lexical kind (Acorn token type)
  kind:            String     // "keyword", "ident", "punctuation",
                              // "string", "number", "regexp",
                              // "template", "comment", "eof"
  kind_subtype:    String     // For punctuation: the literal char/seq
                              // For keyword: which keyword
                              // For ident: empty
                              // For string: empty (text axis carries)

  // Axis 2 — vocabulary content
  text:            String     // The token's actual source text
                              // For string literals: text without quotes
                              // For regexp: the pattern
                              // For comments: the comment text

  // Axis 3 — co-occurrence within window
  // (derived in the enrichment pass; the adapter computes the
  // neighborhood signature as a separate pass after primary
  // tokenization is complete)
  neighbors_pre:   [TokenRef] // Up to 5 preceding tokens
  neighbors_post:  [TokenRef] // Up to 5 following tokens

  // Axis 4 — position class
  // Derived from a light AST walk via Acorn's parser (separate from
  // tokenizer). Possible values reflect SE-11 §2.1's position-class
  // examples plus what's available from ESTree AST node types.
  position_class:  String     // "DECL"      — token is at a binding declaration site
                              //               (var/let/const id, function name, param)
                              // "USE"       — token references a previously-declared name
                              // "CALLEE"    — token is the function being called
                              // "ATTR"      — token is a property access target
                              // "STR"       — token is inside a string literal
                              // "KEY"       — token is a property key in an object literal
                              // "TYPE"      — token is a type keyword (typeof, instanceof)
                              // "CTRL"      — token is control flow (if/for/while/return/etc.)
                              // "OP"        — token is an operator
                              // "DELIM"     — token is structural delimiter ({}/[]/(),;)
                              // "OTHER"     — anything not classified

  // Axis 5 — recurrence (corpus-wide tally)
  // Computed in a final pass after all tokens are tokenized.
  // The adapter maintains a running tally per (kind, text) pair
  // across the corpus and writes back per-token recurrence
  // counts in the final pass.
  recurrence_kind:        Integer  // Count of tokens with same kind in corpus
  recurrence_text:        Integer  // Count of tokens with same text in corpus
  recurrence_kind_text:   Integer  // Count of (kind, text) pair in corpus
}

TokenRef {
  index:           Integer    // Reference back into the token stream
  kind:            String     // Cached for fast composer lookup
  text:            String     // Cached for fast composer lookup
}
```

**Field rationale:**

- `index` + `source_range`: identity tied to source position, so
  the substrate's surfaced regions can be mapped back to source
  for rendering (Phase 5).
- `kind` + `kind_subtype`: Acorn's token types are well-specified
  (its `TokenType` table). We pass through Acorn's classification
  directly — the adapter does not reinterpret.
- `text`: the actual source text. The vocabulary axis's
  observations operate over this.
- `neighbors_pre`/`neighbors_post`: ±5 token window for the
  co-occurrence axis. Window size is a tunable; 5 picked because
  it's small enough to be substrate-tractable and large enough to
  capture local patterns (e.g., `if ( foo ) {` is 5 tokens).
- `position_class`: this is the only axis requiring AST walking.
  Acorn provides both `tokenizer()` (token stream) and `parse()`
  (full AST); position_class is derived by walking the AST once
  and tagging tokens by the node they appear in. See §4 for the
  derivation rules.
- `recurrence_*`: simple per-corpus tally. Computed after primary
  tokenization completes; the adapter does a final pass writing
  back the counts to each token's record.

**What the adapter is NOT doing:**

- Not building sub-cascades. The peers do that per K1.
- Not generating predictive constraints. The peers do that per
  M2/SE-05.
- Not measuring fidelity. The peers do that per K1.
- Not computing semantic interpretation. The cascade does that
  via emergent rules.

---

## 4. Position-class derivation rules

This is the only axis requiring more than direct Acorn passthrough.
The adapter runs Acorn's parser (not just tokenizer) to get the
ESTree AST, then walks the AST tagging each token's index with the
appropriate position_class based on the node it sits inside.

**Tagging algorithm (per ESTree node type):**

```
walk(node):
  for each token_index in node.range_token_indices:
    if class_for(node, token_index) is set and tokens[token_index].position_class == "OTHER":
      tokens[token_index].position_class = class_for(node, token_index)
  for each child of node: walk(child)

class_for(node, token_index):
  // Declaration sites
  if node.type in {"VariableDeclarator", "FunctionDeclaration",
                   "FunctionExpression", "ArrowFunctionExpression",
                   "ClassDeclaration", "ClassExpression"}
     and token is at node.id (or node.params[i]): return "DECL"

  // Use sites
  if node.type == "Identifier"
     and the parent node uses this as a reference (not a declaration,
     not a property key, not a property): return "USE"

  // Callee
  if node.type == "CallExpression" and token is at node.callee: return "CALLEE"

  // Property access target
  if node.type == "MemberExpression" and token is at node.property: return "ATTR"

  // String contents
  if node.type == "Literal" and typeof node.value == "string": return "STR"

  // Property key in object literal
  if node.type == "Property" and token is at node.key: return "KEY"

  // Type-querying keywords
  if token.text in {"typeof", "instanceof"}: return "TYPE"

  // Control flow
  if token.text in {"if", "else", "for", "while", "do", "switch",
                    "case", "default", "break", "continue", "return",
                    "throw", "try", "catch", "finally"}: return "CTRL"

  // Operators
  if token.kind == "punctuation" and token.text in OPERATOR_SET: return "OP"

  // Structural delimiters
  if token.text in {"{", "}", "[", "]", "(", ")", ",", ";", ":"}: return "DELIM"

  return null  // Caller leaves position_class as "OTHER"
```

**Discipline note:** these tags are *positional facts* the host
parser (Acorn) gives us, not interpretations. The substrate decides
whether being at a "DECL" site correlates with anything; the
adapter just records that the token is at one.

---

## 5. Adapter implementation contract

**File:** `corpus-adapter.js` (Phase 2 implementation, not built yet).

**Public surface:**

```
adaptCorpus(source: string): TokenIntakeStream
  // Tokenizes + parses via Acorn, derives position_class,
  // computes corpus-wide recurrence tallies, returns
  // a stream of TokenIntakeRecord in source-order.

TokenIntakeStream {
  records: TokenIntakeRecord[]
  metadata: {
    total_tokens: Integer
    distinct_texts: Integer
    distinct_kinds: Integer
    parse_errors: ParseError[]   // Acorn errors; empty if clean
  }
}
```

**Dependencies:**

- `acorn.min.js` — vendored, not CDN-loaded (per I5 CSP discipline).
  Latest stable release, ECMA-262 compliant.
- Nothing else. No babel, no postcss, no transformers.

**Behavior:**

1. Tokenize via `acorn.tokenizer(source, { ecmaVersion: 'latest' })`.
   Iterate, capture each token into a `TokenIntakeRecord` with
   `kind`, `kind_subtype`, `text`, `source_range`, `index`.
2. Parse via `acorn.parse(source, { ecmaVersion: 'latest',
   ranges: true })` to get the AST.
3. Walk the AST, applying the position_class derivation rules from
   §4 to each token by its source range.
4. Compute recurrence tallies in a single pass: count `kind`,
   `text`, and `(kind, text)` occurrences across the full token
   stream. Write back to each record.
5. Compute neighbor windows in a single pass: for each token,
   capture indices/kinds/texts of the 5 preceding and 5 following
   tokens.
6. Return the stream.

**Error handling:** if Acorn throws a parse error, the adapter
captures the error and continues — partial parsing is still useful.
The substrate sees whatever tokens were successfully tokenized.

---

## 6. What this spec commits to and doesn't

### Commits to

- One adapter per host language (currently only JavaScript; HTML
  and CSS adapters are extension candidates per §1).
- Acorn as the JS adapter's host-parser wrap (Q2 sub-rec 4).
- Five axes per the canon's SE-11 §2.1 reference set: kind,
  vocabulary, co-occurrence, position-class, recurrence.
- Per-token records carrying all five axes' information in
  source-order.
- Position-class derivation via AST walk over ESTree node types
  (the only axis requiring more than direct tokenizer passthrough).
- Adapter is intake-only: no interpretation, no aggregation
  beyond the recurrence tally, no substrate logic.

### Does not commit to

- That tokens are the right granularity (could be sub-token in
  some languages, line-level in others; for JavaScript via Acorn,
  token is the natural granularity).
- That the five axes are exhaustive (SE-11 names these as the
  reference set; future adapters or extensions may add axes).
- That position_class is the only derived axis (recurrence is
  derived too; future axes may add more derivation).
- That HTML/CSS adapters look identical (they'll wrap different
  host parsers — DOMParser, CSSOM — with their own axis derivation).
- That cross-language intersection is part of Phase 11 (named as
  Phase 7 extension candidate).
- Acorn version pinning (Phase 2 picks the version; pin is set at
  vendor time).

---

## 7. Falsification condition for Phase 1

Per `PLAN.md` §3 Phase 1:

> if Acorn's parse output can't be straightforwardly converted to
> intake records carrying all five axes' worth of per-token
> information, Phase 1 halts. We either add a thin annotation
> pass or change tokenizer.

**Assessment against this spec:**

- Axes 1 (kind) and 2 (vocabulary): direct from Acorn's
  `TokenType` and token text. No conversion difficulty.
- Axis 3 (co-occurrence): independent of Acorn — just a windowed
  pass over the emitted token list. No conversion difficulty.
- Axis 4 (position-class): requires running `acorn.parse()`
  alongside `acorn.tokenizer()` and walking the AST. This is the
  one nontrivial conversion. Acorn provides ESTree-compliant
  ASTs; the derivation rules in §4 cover the load-bearing cases.
  Difficulty: medium. Not a halting condition.
- Axis 5 (recurrence): a single tallying pass over emitted
  tokens. No conversion difficulty.

**Phase 1 does not halt.** Phase 2 (substrate factory) begins next.

---

## 8. What this spec leaves for Phase 2 to decide

The spec defines *what* the adapter emits. Phase 2 decides:

- The five peer substrates' configurations against the five axes.
  Each peer ingests the adapter's stream but observes through one
  axis's primitive vocabulary. Phase 2 specifies what each peer's
  primitive vocabulary is for its axis.
- How peers' constraint generation works against per-token
  records. (Per the discipline: M2/M3/K1 honored honestly. Phase 2
  specifies the placeholder content; Phase 1 just commits to the
  intake shape.)
- How peer state propagates to the composer. (Phase 3's concern,
  not Phase 1.)
- How the substrate's render reads back to source-pane / projection
  pane. (Phase 5's concern.)

---

## 9. Live status

| Date | Action |
|---|---|
| 2026-05-25 | Spec created. Adapter contract defined. JS-only scope committed; HTML/CSS extensions named as Phase 7 candidates. Falsification condition assessed: does not halt. Phase 2 (substrate factory) begins next. |
