# Idea: Preparative Representation via IndexedDB

**Status:** Tabled. Architectural sketch only. No implementation yet.

**Date noted:** May 2026, after parallel-substrate composer empirical run +
minification side-by-side test.

## The observation that motivates it

Four empirical findings across the corpus point at the same architectural
locus:

1. **Phase 5.7 Layer 2/3 convergence**: depth advantage in the substrate
   stack is bounded by intake's typing scheme.
2. **Phase 7 Stage 2 on canonical source**: surfaces formatting patterns,
   not domain structure, because domain signal is below threshold relative
   to the source's generic-code-pattern noise.
3. **Parallel-substrate composer on full canonical** (this session):
   identifier substrate's `topByUses` is dominated by JavaScript's vocabulary
   (`var`, `function`, `i`, `0`); domain dimensions (`mortgage`, `sub-prime`)
   are present in the substrate but below recurrence threshold for promotion.
4. **Minification side-by-side** (this session): structure survives
   minification cleanly (identifier rename produces byte-identical pipeline
   output), but Stage 1's generic tokenization can split hyphenated
   domain-distinctive terms (`sub-prime`, `near-prime`, `business-line`,
   `under50`) at boundary positions.

All four findings converge: **intake's typing scheme is the rate-limiting
step**. Stage 1 has no notion of what's domain-distinctive in a given
source. It treats `mortgage` and `getElementById` the same way (both are
ALPHA_RUN tokens). Discrimination has to happen downstream against all
the noise.

## The proposal

Introduce a **preparative substrate** that runs once per source-version
in *exploration mode* before the regular substrate stack ingests the
source. The preparative substrate:

1. Walks the bytes once, observing token-distinctiveness signals
   (hyphenation, string-literal-content dominance, naming-convention
   divergence, spatial clustering, neighbor-specificity).
2. Emits a **preparative map**: tokens annotated with distinctiveness
   scores plus an extended typing scheme (`DOMAIN_DIM`, `DOMAIN_VALUE`,
   `IDIOMATIC`, `LIBRARY_REF`).
3. Stores the preparative map in IndexedDB under a content-addressable
   key (sha-256 of the source's bytes).

Subsequent runs of the substrate stack on the same source-version use
the preparative map by extending Stage 1's typing scheme to honor the
map's annotations. Domain-distinctive tokens are emitted with their
preparative kind; downstream substrates see them as such and their
recurrence patterns surface against a much cleaner field.

## Why IndexedDB

Not incidental. The platform's persistence layer is already where Phase
5.7.7 demonstrated trajectory class round-trips through IndexedDB. The
preparative map is configuration about the source; configuration is
already a natural object the architecture commits to.

Properties IndexedDB gives this for free:

- **Per-application/per-domain scoping**: different sources have
  different distributions; preparative maps are source-local.
- **Content-addressable storage**: stable hash means dedup and cache.
- **Incremental update**: as the source evolves (developer edits),
  the preparative map updates incrementally.
- **Cold-load vs warm-load amortization**: first encounter is expensive;
  all subsequent encounters benefit.

The economic shape this gives the migration argument: migration is a
one-shot setup cost amortized across the application's deployment
lifetime. Same cost shape as cold-load caching.

## Architectural fit

Doesn't require new spec commitments. It's an extension of the typing
scheme Stage 1 emits, populated from a preparative pass that observes
the source through the same K1 mechanism (firing-frequency fidelity)
the rest of the substrate stack uses.

The preparative substrate is itself a substrate. It honors F1, F4, F5,
M5, S3, K1, I1, I5, SE-08, SE-10. Its primitives are different from
Stage 2's and the identifier substrate's, but the mechanism is the same.

## Open questions before this becomes buildable

1. **One substrate or two?** The preparative substrate could be one
   that does both exploration and consumption phases, or two coupled
   through emission. Two is cleaner architecturally. One is more
   pragmatic.

2. **Primitive vocabulary for the explorer.** Candidates:
   - Hyphenated tokens (almost always domain-coined).
   - Tokens that live in string literals more than as identifiers.
   - Convention-divergent tokens (kebab-case in camelCase codebase).
   - Spatially-clustered tokens (occur in bursts, not uniformly).
   - Specific-neighbor tokens (characteristic co-occurrences, not
     promiscuous).

3. **Consumption interface to Stage 1.** Cleanest version: Stage 1's
   typing scheme extends to honor the preparative map. Tokens get
   richer kinds. Downstream substrates inherit the richness without
   modification.

4. **Update granularity.** When the source changes, what gets
   recomputed? A diff-aware preparative pass that only re-explores
   changed regions would be the production version. A
   recompute-from-scratch version is the prototype.

5. **Cache invalidation.** Source changes must invalidate the
   preparative map for that source-version. Content-hash keying
   handles this automatically (different bytes -> different hash ->
   different cache key).

## Where this fits in the priority order

Two reasonable orderings:

**Order A (Stage 3 first):** Build Stage 3 against the current substrate
surface. Stage 3 surfaces what works and what doesn't with current intake.
Then build preparative representation, knowing what Stage 3 needs from
intake. Preparative representation gets designed to meet a concrete need
rather than a speculative one. Stage 3 lands sooner, demonstrating
migration is empirically possible at all. Preparative representation
lands second, demonstrating migration is empirically tractable at scale.

**Order B (Preparative first):** Build preparative representation first.
Stage 3 is then easier because it operates on cleaner input. Migration
argument lands faster as a unified deliverable. But preparative gets
designed without concrete knowledge of what Stage 3 wants from it.

Order A is probably the right default unless preparative representation
is fast enough to build that doing it first doesn't delay Stage 3
meaningfully.

## What this changes about the migration argument

The argument from PDF 3 ("feed your existing source in. See what comes
out.") has always rested on the substrate stack being able to discriminate
domain content from generic content automatically. This session's empirical
work showed the discrimination is below threshold on mixed-content sources
without help.

Preparative representation is the structural fix. It moves discrimination
upstream where it can use observation primitives specific to "what's
distinctive in this source," and stores the result at the platform's
persistence layer where the cost amortizes naturally.

If preparative representation works, the migration argument's empirical
status moves from "demonstrated on domain-dominant fixture, bottlenecked
on mixed-content sources" to "demonstrated on canonical source after
one-time preparative pass." That's the shape the migration tool needs
for production use.
