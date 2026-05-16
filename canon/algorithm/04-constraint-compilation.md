# 04 - Constraint Compilation (WHEN/THEN -> CSS selectors)

**Status:** IMPLEMENTED and tested.
**Primary origin:** `State_Converter.MD` (the three axioms)
**Secondary origin:** `references/cascade-engine.md` in the skill folder
**Implemented in:** `exodus-canonical.html` Client.rebuildCascade and
Client.compileConstraint
**Tests:** 14 injection-attack tests verify the escaping, plus the
full-space resolution tests verify correctness of compiled output

---

## Narrow-claim scope

A compiler from declarative WHEN/THEN rules in JavaScript objects to
CSS attribute-selector rules with custom-property declarations.
Compilation is deterministic, defended against CSS injection, and
produces a cascade that a single `getComputedStyle` call resolves.

## Specification

### Input

```
constraints: Array of { when: map, then: map }
```

Each constraint:
- `when` is a map of `dim_name -> value`. All listed dims must match for
 the rule to apply. Empty `when` is rejected.
- `then` is a partial map of output property names to values.

### Output

A single CSS string, injected as `<style id="cascade-rules">` into
`<head>`. Previous style element of the same ID is removed first
(teardown-before-inject).

### Compilation

For each constraint:

```
selector = "#V-probe" + tail + ", #V-probe-container > div" + tail

where tail is, for each (dim, value) in when:
 '[data-' + requireCssIdent(dim) + '="' + requireSafeAttrValue(value) + '"]'

declarations = [
 if 'sdf' in then: "--sdf: " + (then.sdf === 1 ? 1 : -1)
 if 'deny' in then: "--deny: " + cssEscapeString(then.deny)
 if 'rt' in then: "--rt: " + cssSafeToken(then.rt)
 if 'rth' in then: "--rth: " + requireFiniteNumber(then.rth)
 if 'doc' in then: "--doc: " + cssSafeToken(then.doc)
 if 'reg' in then: "--reg: " + cssSafeToken(then.reg)
 if then.sdf === 1:
 "--reg: DENIED" // always add
 "--rth: 0" // always add
]

rule = selector + " {\n " + declarations.join(";\n ") + ";\n}\n"
```

Plus a base rule that sets defaults for every output property.

### Dual-selector design

The generated rules select BOTH `#V-probe` (the single probe for the
current nav coord) AND `#V-probe-container > div` (every child of the
probe array container). This lets one cascade serve both single-probe
sampling and full-space parallel resolution without duplicating the
stylesheet.

## Defenses (injection prevention)

Three distinct validator/escaper functions, each used at the right spot:

- `requireCssIdent(s)`: regex `^[A-Za-z_][A-Za-z0-9_-]{0,63}$`. Used for
 dim names and CSS token values. Throws on violation.
- `requireSafeAttrValue(s)`: regex `^[A-Za-z0-9_.-]{1,64}$`. Used for
 the string inside `[data-x="VALUE"]`. Narrower than CSS allows;
 deliberately strict.
- `cssEscapeString(s)`: produces a `\XX `-escaped double-quoted CSS
 string. Used for deny messages and any free-form text. Bounded at 512
 chars. Escapes `"`, `\`, all control bytes, and all non-ASCII.

All three are applied at every compile boundary. Tested against:
attribute selector breaks, declaration breaks, rule breaks, comment
injection, newline injection, null bytes, tab characters, `expression()`
calls, `url(javascript:...)` injections.

## Rule ordering

CSS cascade specificity applies. More `[data-x]` attributes = higher
specificity = wins over less-specific rules. Within equal specificity,
source order wins, so later-listed constraints override earlier ones.

Guidelines (from `cascade-engine.md`):

1. Base defaults first (the `#V-probe` base rule)
2. Single-dimension rules (1 `[data-x]`)
3. Multi-dimension rules (2+ `[data-x]`)
4. Denial rules are typically the most-specific combinations

No `!important` is needed. Specificity handles ordering correctly.

## Why this works as execution

After compilation and injection, the CSS cascade IS the resolver. A
coordinate's outputs are determined by:

1. The `[data-*]` attributes on the probe element match a subset of
 the compiled selectors.
2. The cascade applies all matching rules in specificity order.
3. Final custom-property values are what `getComputedStyle` returns.

No JavaScript branching participates. This is the core of axiom 1 ("CSS
is the client runtime").

## Invariants

1. The compiled CSS, when paired with a probe carrying valid
 `data-*` attributes, resolves to a unique record for every coord
 in the state space. (Verified by the parallel probe array test:
 2,880 coords, 2,880 resolved records, no collisions, no
 unassigned properties.)
2. No user or constraint-supplied string can break out of its intended
 syntactic context to produce malicious CSS. (Verified by the 14
 injection-attack tests.)
3. Denial rules consistently override their non-denial counterparts
 because they have more `when` keys and therefore higher CSS
 specificity.

## Wide-claim scope

The origin documents frame this as "the CSS cascade IS the runtime" and
cite CSS specificity's deterministic conflict resolution across billions
of devices as evidence that a compile-to-CSS strategy inherits a lot of
battle-tested semantics for free. This is a legitimate narrow claim.

The wider claim - that constraint cascading in CSS is formally
equivalent to CSP solving - is overstated. The CSS cascade is a
closed-world evaluator (all matching rules, specificity-ordered), not a
general solver. It cannot backtrack, it cannot handle open-ended
constraints (regex, arithmetic on attribute values, recursive rules),
and it cannot express choice. What it CAN do - resolve conjunctions of
attribute presence to property assignments with deterministic ordering -
is exactly what the WHEN/THEN form of this compilation exploits. Don't
claim more.

## Related algorithms in this catalog

- `05-single-probe.md` - how one coord is sampled from the compiled
 cascade
- `06-parallel-probe-array.md` - how all coords are sampled in one
 style recalc
- `08-media-gated-observer-cascade.md` - extension using `@media`
 rules as additional cascade gates
- `14-security-defense-stack.md` - where these validators live in
 the overall threat model
- `16-gpu-postfix-stack-machine.md` - the GPU analog: same
 constraints, different evaluator
