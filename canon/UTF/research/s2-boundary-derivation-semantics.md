# Research: An S2 Boundary — Derivation Semantics Cannot Be Expressed in Single-Pass CSS

**Role.** Reference material. Documents an empirical boundary of
the S2 commitment (substrate-resolution is deterministic across
substrates), discovered via the stratified-harness run on
2026-05-19. The boundary is structural, not implementation-bug,
and qualifies S2 in a way the spec has not previously named.

**Date produced.** 2026-05-19

**Status.** Reference material. The finding is empirical and
reproducible. Promotion to spec-level commitment (whether as an
S2 qualification or a new SE-N entry) is pending sit-time.

**Provenance.** Surfaced during the
[stratified-harness](../../../exodus/canonical-implementation/tests/stratified-harness.html)
run on 2026-05-19. The harness ran all three resolvers (real
browser CSS via `getComputedStyle`, the JS postfix oracle, the
WGSL compute shader) concurrently per fixture across 2,602
fixture sets. Result: **2,500 stratified agreements, 102
divergences, 0 outright disagreements between JS and WGSL.** All
102 divergences showed the same signature: `JS ≡ WGSL ≡ expected
hash; CSS produces different output`.

Root cause traced via
[reproduce-divergence.js](../../../exodus/canonical-implementation/tests/reproduce-divergence.js):
the Node-side `css-oracle.mjs` (a JS reimplementation of cascade
semantics) agrees with the JS postfix oracle on every divergent
fixture. The disagreement is between the **real browser cascade**
and the postfix machines, not between cascade semantics and
postfix semantics.

-----

## 1. The boundary, named precisely

The architecture's S2 commitment says:

> *Constraint resolution produces identical output regardless of
> which substrate computes it (CSS cascade, JS stack machine, GPU
> compute shader, native CPU evaluator).*

The 2026-05-19 empirical finding qualifies this:

**S2 holds for resolution semantics that can be expressed in a
single-pass parallel cascade. It does not hold for resolution
semantics that require post-processing across the full rule set
to a fixed point.**

The specific divergent semantics is the spec's `sdf:1 → reg:DENIED,
rth:0` derivation, defined in
[constraints.md §4 step 3](../../../exodus/canonical-implementation/constraints.md):

> *"If sdf == 1 at the end, derive reg = 'DENIED' and rth = 0."*

The phrase **"at the end"** is the load-bearing one. It commits
the derivation to running after all rules have been applied to
the coordinate, and it commits the derivation's output to being
*terminal* — not subject to override by any rule.

-----

## 2. How each substrate implements the derivation

**JS oracle ([oracle.js:110-115](../../../exodus/canonical-implementation/oracle.js)):**

```javascript
if (sdf === 1) { reg = 1; rth = 0; }
```

This block runs after the instruction loop terminates. The
derivation is unconditional once `sdf === 1` and applies to the
final output, regardless of what intermediate rules wrote to
`rth`. Implements "at the end" correctly.

**WGSL shader ([resolve.wgsl](../../../exodus/canonical-implementation/resolve.wgsl)):**

Identical structure to the JS oracle. Post-process after the
instruction loop. Implements "at the end" correctly.

**Node CSS oracle ([css-oracle.mjs:57-60](../../../exodus/canonical-implementation/css-oracle.mjs)):**

```javascript
if (out.sdf === 1) {
  out.reg = "DENIED";
  out.rth = 0;
}
```

Same post-process pattern. Implements "at the end" correctly.

**Real browser CSS cascade (via exodus-canonical.html's
`compileConstraint`):**

```css
.probe[data-applicant="business"] {
  --sdf: 1;
  --deny: "...";
  --reg: DENIED;
  --rth: 0;
}
```

The derivation is **inlined** into the sdf:1 rule. The cascade
applies this rule alongside all others by specificity then
source order. **Any rule that writes `--rth` with equal or
greater specificity at later source-order position overrides
the derivation's `--rth: 0`.**

This is not a bug in `compileConstraint`. **It is the only way
to express the derivation in a single-pass cascade**, because
CSS has no construct that means "run this after all other rules
have been applied to the same element."

-----

## 3. Why this is structural, not patchable

CSS is a parallel constraint resolver. It applies all matching
rules concurrently to a single style-recalc cycle, with
specificity + source-order as the tiebreaker function. **It does
not have a sequencing primitive that means "after all other rule
applications have completed."**

There is no `@after-cascade` rule. There is no `@derived` block
that runs after specificity resolution. There is no way to make
a CSS declaration *override the cascade's normal tiebreaking
behavior* except via `!important`, which has its own override
rules and is not load-bearing in the way "post-processing"
requires.

Three patch options exist, none of them clean:

**Option A: Emit derivations with `!important`.**
```css
.probe[data-applicant="business"] {
  --rth: 0 !important;  /* derived from sdf:1 */
}
```
Works for this specific case, but `!important` is itself a
cascade-level construct that can be overridden by another
`!important` declaration with greater specificity. It is *more
robust* than source-order tiebreaking but not absolutely
terminal.

**Option B: Two-pass resolution with synthetic attributes.**
Read `--sdf` via `getComputedStyle`, write a synthetic
`data-sdf-derived` attribute on each probe, then read the final
properties from a second cascade pass that emits derivations as
high-specificity rules matching the synthetic attribute. Loses
the single-pass property that makes the cascade a parallel
constraint resolver and reintroduces JavaScript orchestration
between resolution stages.

**Option C: Restrict the constraint grammar to forbid
derivations that require post-processing.**
Spec-level fix: remove the `sdf:1 → reg:DENIED, rth:0`
derivation rule entirely. Require constraint authors to write
the denial output explicitly:
```
{ when: {...}, then: { sdf: 1, reg: "DENIED", rth: 0, deny: "..." } }
```
Eliminates the divergence by removing the semantics CSS can't
express. Loses the spec's syntactic convenience but preserves
S2 in its full strength.

None of these is a bug-fix. They are different ways of
*navigating a structural boundary the architecture has now
empirically located.*

-----

## 4. Why the canonical 11-rule reference doesn't surface this

The canonical reference set has 11 carefully-designed rules
where:

- The six denial rules all set both `sdf: 1` and `deny: "..."`
- None of the non-denial rules (credit-tier defaults, residency
  uplifts) set `rth` on a coordinate that any denial rule also
  matches

This avoids the structural collision: no coordinate ever has
both a denial rule and an rth-setting rule applying to it. The
inlined `--rth: 0` derivation is never overridden because
nothing else writes `--rth` on a denied coordinate.

**The 66/66 + 2,880 × 2,602 byte-identical record empirically
holds for the canonical reference**. The reference was
sufficient to demonstrate S2's *common case*. It was
insufficient to surface S2's *boundary case*.

The stratified harness, running random multi-rule fixtures,
produced collisions in 102 of 2,602 cases. The boundary is real
and reachable; it just wasn't reached by the reference's input
distribution.

-----

## 5. What this changes about S2

Before this finding, S2 read as an unqualified empirical claim
backed by 45M byte-identical comparisons.

After this finding, S2 needs to be read as a *conditional*
empirical claim:

**S2 (revised, informal):** *For constraint sets whose
resolution semantics can be expressed in a single-pass cascade —
specifically, where all output fields are written only by
explicit rule declarations and no field's final value depends on
a derivation that requires "after all rules have applied"
sequencing — the CSS, JS, and WGSL substrates produce
byte-identical output.*

This is a meaningful narrowing. The original S2 framing implied
substrate-independence as a structural property of the
architecture. The revised framing locates substrate-independence
as a property of *a subset of expressible constraint semantics*.
Outside that subset, the substrates diverge — not because the
implementations are wrong, but because the substrates have
different expressive capacities.

The 11-rule reference falls inside the subset by construction.
Most realistic constraint sets will too — derivation rules of
the `if X at end then Y` shape are rare in domain modeling.
But the architecture cannot honestly claim S2 holds in general
when the empirical evidence shows it holds *in the typical case
and fails in the structural-collision case*.

-----

## 6. Three readings of what to do

**Reading A: Patch the canonical CSS path and re-run.**
Apply Option A (`!important`) or Option B (two-pass) from §3,
re-run the stratified harness, and if 2,602/2,602 stratified
agreements result, declare S2 restored. This treats the finding
as an implementation gap that can be closed without spec
revision.

**Reading B: Restrict the spec to remove derivations
(Option C).**
Edit constraints.md to remove the `sdf:1 → derived` rule and
require explicit denial outputs in every denial constraint.
Re-run with the updated rules; expect 2,602/2,602 stratified
agreements. This treats the finding as evidence that the spec's
syntactic shortcuts cost it cross-substrate consistency.

**Reading C: Accept the boundary as structural and revise S2.**
Document the finding as a known boundary of S2. Update the
canon to read S2 as conditional on resolution-semantics
expressibility in a single-pass cascade. Treat the canonical
11-rule reference as the *demonstration of the common case*
rather than the *demonstration of S2 in general*. This treats
the finding as architectural information about the substrate's
capacity.

**Recommendation: Reading C, with optional later movement to
Reading B.**

Reading C is the most honest. The boundary is real; pretending
otherwise via Reading A (patching with !important) buys
back the original S2 framing at the cost of obscuring the
structural fact. Reading B is also honest but is a bigger
spec change that should happen, if at all, only after the
implications are understood.

The architecture's value does not depend on S2 being
unqualified. The substrate's interest is *what it actually
exhibits across substrates*, which is most-of-the-time
byte-identical and sometimes-structurally-divergent. Both
parts are findings; the structural divergence is more
informative than the agreement was.

-----

## 7. What this does and does not claim

### Does claim

- 102 of 2,602 stratified fixtures (3.9%) produced CSS
  resolution that diverges byte-identical from JS+WGSL
  resolution.
- All 102 divergences trace to the same structural cause: the
  `sdf:1 → derived` rule cannot be implemented as
  "post-processing" in CSS because CSS has no
  post-processing construct.
- The JS oracle and the WGSL shader are byte-identical across
  all 2,602 fixtures. The postfix machines have no
  cross-substrate boundary; only the cascade does.
- The canonical reference's 11 rules avoid the divergent
  semantics by construction.

### Does not claim

- Does not claim CSS is "broken." CSS is a single-pass
  parallel cascade by design. Its absence of post-processing
  is a structural property, not a defect.
- Does not claim the architecture is invalidated. S2 holds
  for the substantial subset of constraint semantics that
  can be expressed in a single-pass cascade. That subset is
  large and includes the canonical reference.
- Does not claim 45M+ comparisons are wrong. Those
  comparisons were JS-vs-WGSL (via pre-computed Node-side
  hashes); they remain valid. The stratified harness adds
  *real-cascade-vs-postfix* comparisons that the existing
  harness did not perform.
- Does not propose a specific spec revision. Three readings
  are presented in §6; the decision is held for sit-time.

-----

## 8. Implications for the Reddit framing and the UTF spec work

**Reddit / external framing.** The previous claim was "three
runtimes produce byte-identical output across ~45M
comparisons." That remains true *with the qualification* that
the comparisons were between two of the three runtimes (JS and
WGSL) with the third (the Node CSS oracle, not the real
browser cascade) serving as a JS-implemented reference. The
new finding sharpens the claim:

- *JS and WGSL produce byte-identical output across 2,602
  random multi-rule fixtures (45M+ field comparisons), zero
  divergence.*
- *Real CSS via getComputedStyle agrees on 2,500 of 2,602
  fixtures; diverges on 102, with all divergences traceable
  to a single structural boundary of the cascade vs.
  post-processing distinction.*
- *This is exactly the kind of finding that an empirical
  stratified harness was built to surface.*

The narrower claim is more defensible and more interesting.
"We found a structural boundary at 3.9%" is a better story
than "everything agrees 100%" because the boundary is real
information, not an embarrassment.

**UTF spec work.** This finding affects how Q4 (where
vocabulary growth lives) and Q7 (canonical encodings) get
answered. Specifically:

- If the spec preserves the derivation grammar (sdf:1 → derived
  reg, rth), then the canonical encoding must be one that
  can express post-processing semantics. Pure CSS cannot. The
  postfix bytecode can. So the bytecode is the more
  fundamental encoding; CSS is a *projection of the bytecode*
  whose accuracy depends on the constraint set falling within
  the cascade's expressive subset.
- If the spec removes the derivation grammar, the encoding
  decision is freer because all encodings would be equally
  expressive.

This is decision-relevant input for Q7. Held here until Q7 is
answered.

-----

## Live status

| Date (yyyy-mm-dd) | Action |
|---|---|
| 2026-05-19 | Finding produced from stratified-harness run. Article written. Pending sit-time before any S2 revision or spec change is committed. |
