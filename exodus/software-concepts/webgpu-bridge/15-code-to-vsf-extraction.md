# 15 - Code-to-VSF Extraction (chunk, detect, infer)

**Status:** IMPLEMENTED.
**Primary origin:** `exodus-extractor.html` (the migration path proof)
**Secondary origin:** `Development_Roadmap` file inventory - "Migration
path proof"
**Implemented in:** `exodus-extractor.html` itself (1,087 lines after
line-ending normalization). Not ported to the canonical file.

---

## Narrow-claim scope

Takes an existing imperative JavaScript codebase (the demo input is a
~1,000-line jQuery POS module) and produces a VSF approximation of
its state space. The extractor identifies stateful dimensions, guesses
plausible value sets from usage, and emits a header + rows in the VSF
format. This is a migration tool: it closes the loop from "legacy
imperative code" to "VSF coordinates the legacy code operates within."

This is the single strongest piece of evidence that the architecture
is retrofittable, not greenfield-only.

## Pipeline

### Stage 1 - Chunk

Split the source into semantically-tagged chunks. Chunk boundaries
are the `// -- Section -----` comment headers the POS source uses;
fallback is function boundaries or top-level `var` blocks.

```
function chunkCode(code):
 lines = code.split("\n")
 chunks = []
 buf = []
 for line in lines:
 trimmed = line.trim()
 if trimmed matches section-header regex:
 flush buf as a chunk
 buf = [line]
 else:
 buf.append(line)
 flush buf as final chunk
 return chunks
```

### Stage 2 - Detect category

For each chunk, score it against a set of category patterns:

```
categories = [
 { name: "ui-event", re: /\$\(['"][^'"]+['"]\)\.on\(/ },
 { name: "ajax", re: /\$\.(get|post|ajax)\(/ },
 { name: "validation", re: /if\s*\(\s*!?\s*\w+\s*[\.\(]/ },
 { name: "state-mut", re: /state\.\w+\s*=/ },
 { name: "render", re: /\$\(['"][^'"]+['"]\)\.(text|html|val)\(/ },
 # ... more ...
]

function detectCategory(chunk):
 best = "unknown"
 bestScore = 0
 for cat in categories:
 matches = count of cat.re in chunk.text
 if matches > bestScore:
 bestScore = matches
 best = cat.name
 return best
```

### Stage 3 - Infer dimensions

Scan each chunk for signals that imply stateful dimensions:

```
function extractDimHint(chunk_text):
 hints = []
 # form field reads
 for match in /\$\s*\(['"]#?([\w-]+)['"]\)\s*\.val\s*\(/g:
 name = extract_id(match)
 hints.push(name)

 # comparisons against string literals
 for match in /\b(\w+)\s*===?\s*['"`]([^'"`]+)['"`]/g:
 var_name, value = parse_match(match)
 hints.push(var_name + ":" + value) # dimension + observed value

 return hints
```

Equivalently: a variable compared against a string literal is
evidence of a dimension. The variable is the dim name; the literal is
a value the dim can take. Multiple comparisons against the same var
yield multiple values.

### Stage 4 - Extract value sets

```
function extractValHints(chunk_text):
 vals = []
 for match in /===?\s*['"`]([^'"`]+)['"`]/g:
 literal = extract_literal(match)
 vals.push(literal)
 return vals
```

### Stage 5 - Assemble dim map

Per-chunk hints merge into a global map:

```
function buildDimMap(chunks):
 dimMap = {}
 for chunk in chunks:
 dim_hints = extractDimHint(chunk.text)
 for hint in dim_hints:
 if hint contains ":":
 dim_name, value = split(hint, ":")
 dimMap[dim_name].values.add(value)
 # ... etc ...
 return dimMap
```

### Stage 6 - Emit VSF

With dims + values in hand, emit a header (algorithm 09) and at least
one row per detected state configuration (algorithm 10).

Rows cannot be "real" at this stage because the imperative code has
not run; they are synthetic templates representing each category of
state the extractor believes exists.

## Coverage metric

```
total = total lines of code
classified = lines in chunks that matched any category pattern
unresolved = total - classified
coverage = classified / total
```

This is reported back to the user so they can judge whether the
extractor "understood" the source well enough to trust its output.

## Why this is load-bearing for the architecture

The common criticism of any declarative-runtime proposal is: "that's
great for greenfield but I have a million lines of imperative code."
The extractor demonstrates a concrete migration path:

1. Take existing code.
2. Extract approximate state geometry.
3. Emit VSF.
4. Manually refine dims and constraints.
5. Replace imperative branches with constraint rules.
6. Delete the old code as the VSF absorbs each responsibility.

Steps 1-3 are automated. Steps 4-6 are manual but incremental.

## Limitations

- **Pattern-based.** The extractor does not parse JavaScript; it
 regex-matches over source text. This misses dims expressed via
 method calls, dynamic property access, or indirect comparisons.
- **Ambiguity is not resolved.** If `var x` is compared against three
 unrelated literal strings in three different contexts, the
 extractor assumes `x` has three values; it does not check whether
 these three contexts even share the same variable.
- **Output is a starting point, not a final artifact.** A human must
 review and refine.
- **Demo source is embedded.** The extractor ships with the POS
 module source hardcoded as a large string constant. A more
 general version would accept file uploads; this is not
 architectural, just UI.

## What this shares with the canonical file

- Same defense stack (algorithm 14).
- Same VSF format (algorithms 09, 10).
- Same Server / IPC pattern for its own UI (algorithm 12).

What it does NOT share: it has no cascade engine of its own. It emits
constraints + coords that a canonical implementation can load and
run. Running them is out of scope for the extractor.

## Wide-claim scope

The origin framing - "closing the loop from code to VSF" - is
accurate for the narrow fact that an imperative source can be
regex-walked into a constraint geometry approximation. It is a proof
that the architecture has a migration story.

The wider claim - that any codebase can be losslessly converted to
VSF - is overstated. Dynamic dispatch, closures over mutable state,
cross-module side effects, and async control flow are all harder to
extract than the pattern-matched categories the extractor handles.
The value of the tool is that it produces a starting point that
amortizes the manual conversion effort; it does not produce a final
artifact.

## Related algorithms in this catalog

- `04-constraint-compilation.md` - what eats the extractor's output
- `09-vsf-header-triads.md` - header form
- `10-vsf-body-rows.md` - row form
- `14-security-defense-stack.md` - same defenses apply to the
 extractor's own UI
