# STAGE_1_OBSERVATIONS - Lexical Typing Substrate

**Stage:** 1 of N (SE-10 resolution-accretion chain)
**Status:** Built and verified at oracle level. Cascade-equivalence harness exists; browser run pending.
**Constraint set version:** stage1-1.0.0
**Test count:** 88/88 passing

-----

## What this stage is

The first link of an SE-10 resolution-accretion chain that turns raw
source bytes into the application’s runtime stylesheet. Stage 1 reads
bytes; it emits typed tokens as VSF rows; downstream stages will use
those rows as input to produce structural typing, then CSS-shape
typing, then the terminal stylesheet.

Stage 1 does not know about loan eligibility, web applications,
JavaScript semantics, or any specific application domain. Stage 1 only
sees byte windows. It classifies each window’s structural shape
(whitespace, alpha run, digit run, punctuation, string, comment,
keyword, ident, unknown) and emits the classification as a typed
record. Domain-specific typing belongs to later stages.

This is the SE-10 chain’s first link. Per SE-10’s per-link autonomy
commitment, Stage 1 runs on its own field, with its own constraint
set, computing its own delta. Nothing supervises it. What it emits is
byproduct at the channel (M5), readable by Stage 2 as input.

-----

## Architectural commitments verified

The full INVARIANTS.md cluster relevant to this stage:

**F1 Seed permanent.** Each Stage 1 substrate carries the seed at
init. The seed is permanent (cannot be evicted), is checked on every
operation, and produces a continuous delta read. Verified by direct
inspection in tests - seed is present after construction, after one
ingestion, after multiple ingestions, after sealing.

**F2 Delta single formula at every scope.** `unresolvedDims / totalDims` is the single arithmetic at field scope. Initial delta is
1.0 (nothing resolved); after ingestion, delta drops as rows accumulate
with non-UNKNOWN kinds. The same formula could be applied at sub-cascade
scope (per-kind populations) and channel scope; tests check the field-
scope read and the bounded range [0, 1].

**F3 No supervision.** Selection happens through cascade resolution
(via the CPU oracle in Node, or the actual cascade in the browser). No
JS function inspects intermediate cascade output to decide what kind
to assign. Multipass eligibility (alpha runs with CSS-safe ident text)
is a structural property of pass-1 output, not a supervisory decision  -
it dictates a mechanical attribute write that triggers pass-2 cascade
resolution. Verified by determinism: two fresh substrate instances on
the same input produce byte-equivalent rows including identical hashes.

**F4 Indefinite operation.** The substrate is not closed by any
operation other than explicit `seal()`. Multiple ingestions accumulate;
the step counter advances; the substrate stays ready for more bytes.
Verified by sequential ingestion tests and by the absence of any
internal terminator.

**F5 Observation irreversible.** Every emission appends to the row
store. No operation rewrites prior rows. After sealing, ingestion
throws. Verified by hash-stability tests on prior rows across
subsequent ingestions, and by sealed-state behavior.

**M5 Trace at channel.** The trace is append-only, bounded, and
contains both `emit` and `delta-update` entries. Step counter is
monotonic. The trace is owned by neither the writer (substrate
internals) nor the reader (test harness, downstream stages); both
observe it as ambient. Verified directly.

**S1 Substrate shared.** Within a single instance, multiple reads
produce identical state. Verified by repeated `getState()` calls.

**S2 Resolution deterministic across substrates.** Two fresh
instances of the substrate, given the same input bytes, produce row
sequences that match byte-for-byte including every sha256 hash. The
stylesheet text is also identical. Verified.

**SE-08 Render-substrate intake.** Bytes enter the field at the
rendering substrate (the cascade probe surface). The CPU oracle and
the cascade both consume the same `data-*` attribute records.
Verified at the oracle layer; the cascade-equivalence harness
verifies the cascade layer runs in the browser.

**SE-09 Operational irreversibility.** The row store grows
monotonically; no operation removes prior emissions in-place; aging
happens at boundaries (when `rowCap` is hit, oldest is removed by
shift, not by content-aware mutation). Sealing is final; subsequent
ingestion throws.

**I1 ASCII-only.** Every emitted row body is checked for ASCII before
being added to the store. The full VSF emission is ASCII-clean. The
stylesheet is ASCII-clean. Verified across all tests including the
72KB loan-application source ingest.

**I5 Bounded caps with aging.** Row cap and trace cap are configurable
and respected. When cap is hit, oldest entries age out. Verified with
a small-cap test forcing 20 emissions through a 16-row cap.

-----

## What runs

A self-contained Node module:

`stage1-lexical-typing-substrate.js`

- `createStage1Substrate(opts)` factory producing isolated substrate instances
- `STAGE1_CONSTRAINTS` constraint set (~50 entries, mostly the keyword list)
- `compileToCssRule(c)` turns one constraint into a CSS rule string
- `buildStage1Stylesheet(constraints)` emits the full stylesheet text
- `resolveProbe(attrs, constraints)` is the CPU oracle, byte-equivalent to
  CSS cascade per S2
- `windowize(bytes, opts)` is the SE-08 intake mechanism - turns raw bytes
  into probe records carrying `data-*` attributes
- `ingest(bytes)` is the substrate’s primary input method: windowize,
  resolve through cascade (oracle in Node), emit VSF rows
- `emitVsf()` produces the chain’s outbound byte stream - header triads
  plus pipe-delimited body rows with content-addressed hashes
- `seal()` produces a Merkle root over all rows, marking final state

Test harness `test-stage1.js` runs Node-side and verifies all of the
above. 88/88 passing.

Browser harness `cascade-equivalence-harness.html` verifies S2 against
the actual CSS cascade (separate from CPU oracle). Run by opening in
any modern browser; results display inline.

-----

## What the loan-application source produces

The canonical loan-eligibility reference (~72 KB of mixed JS, HTML,
CSS) emits the following kind distribution when fed through Stage 1:

```
COMMENT_BLK    122
DIGIT_RUN      474
IDENT         3951
KEYWORD        809
PUNCT_CLOSE   1237
PUNCT_OP      1486
PUNCT_OPEN    1337
PUNCT_SEP     2592
STRING_DBL     558
STRING_SGL      22
UNKNOWN         67
WHITESPACE    5433
```

This is plausible for the file: many block comments (the file is
heavily commented), many idents (variable and function names dominate),
~800 keyword promotions (var/let/const/function/return are
ubiquitous), ~67 UNKNOWN (mostly characters that aren’t classified by
the byte-class table - high-bit characters in the file’s small set of
non-ASCII content, which the substrate flags rather than silently
absorbing). Total emitted rows: 18,078.

The substrate processed 72 KB of mixed-syntax source without any
domain-specific knowledge. The output is structurally accurate at the
lexical level. This is the chain’s first link doing its work.

-----

## What is not yet built

Stage 1 is one link. The chain has more.

**Stage 2 (Structural typing).** Reads Stage 1’s VSF as input. Identifies
constraint shapes - `when`/`then` patterns in source, function
definitions, control flow blocks. Emits structural records.

**Stage 3 (CSS-shape typing).** Reads Stage 2’s VSF as input. Tests each
structural record against the cascade’s expressive limits. Marks which
need single-pass cascade, which need multipass, which require
JavaScript fallback. Emits typed records that Stage 4 can compile
without re-discovering structure.

**Stage 4 (Stylesheet emission).** The terminal link. Reads Stage 3’s
typed records. Compiles them to CSS rules using the existing
`compileConstraint`-style pattern from the canonical loan app. Emits
the final stylesheet that the browser cascade will resolve to run the
application.

These stages remain unimplemented. SE-10 specifies what they would
have to honor; this implementation gives the first one a working
existence proof.

-----

## What is observable that surprised me

The keyword detection through multipass works cleanly. Pass 1
classifies every alpha run as ALPHA_RUN with conf 90. Pass 2 then
re-resolves with `data-text` set to the run’s content; if the text
matches a known keyword, the more-specific selector wins via cascade
specificity rules and the kind promotes to KEYWORD with conf 100.

The architectural significance: this is multipass cascade evaluation
implemented without JavaScript supervision. JavaScript writes the
attribute that triggers pass 2; the cascade decides KEYWORD vs IDENT
based on its own resolution rules. The structural commitment “the
cascade is doing the constraint resolution, not equivalent to it”
holds for Stage 1’s output.

The CPU oracle’s specificity-and-source-order semantics match the CSS
cascade’s by construction. S2 holds within Stage 1 across both
execution surfaces. This is what algorithm 16 verifies generally and
what this stage verifies for its constraint set specifically.

-----

## Open questions

1. The naming-preference accumulation (K3 in INVARIANTS) is not
   exercised by Stage 1. Stage 1 has no inputs that “name” sub-cascades;
   sub-cascades themselves don’t promote because the constraint set is
   small and the kinds are first-class. Whether K3’s accumulation should
   live in Stage 1 or in later stages is not yet decided.
1. The seed in Stage 1 is structurally present but not actively
   participating in selection (because the constraint set’s outcomes
   are deterministic given input). The seed’s role becomes load-bearing
   in stages that have ambiguity and need delta-driven resolution. The
   commitment is honored; the operational role is minimal here.
1. The chain’s transport format is Stage 1’s `emitVsf()` output. The
   format is pipe-delimited rows with header triads. Whether Stage 2
   should consume this directly or whether an intermediate INJECT step
   is needed (per algorithm 10) depends on whether Stage 2’s field
   shares geometry with Stage 1’s. Open until Stage 2 is built.
1. The 67 UNKNOWN rows in the loan-app ingestion are the substrate’s
   honest report of bytes it could not classify. Whether to extend the
   constraint set to absorb them (e.g., add classification for
   high-bit bytes) or to leave UNKNOWN as a structural signal that
   Stage 1 found something not in its grammar is a design choice.
   Current decision: leave as-is. UNKNOWN is meaningful information.

-----

## Files

- `stage1-lexical-typing-substrate.js` (implementation, 580 lines)
- `test-stage1.js` (test suite, 460 lines, 88/88 passing)
- `cascade-equivalence-harness.html` (browser S2 verification)
- `STAGE_1_OBSERVATIONS.md` (this document)