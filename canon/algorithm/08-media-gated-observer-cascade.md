# 08 - @media-Gated Observer Cascade

**Status:** IMPLEMENTED in `exodus-vlan-sync.html` (not in the
canonical file; stands as a separate pattern demo)
**Primary origin:** `exodus-vlan-sync.html` SyncObserver module
**Secondary origin:** `Development_Roadmap` file inventory - "Advanced
pattern demo"
**Implemented in:** the vlan-sync file itself; not ported to canonical

---

## Narrow-claim scope

An extension of the cascade-as-runtime pattern that uses CSS `@media`
queries as additional constraint dimensions. The environment
(viewport width, color scheme preference, etc.) becomes a dimension
that must match for a rule to fire - alongside the `data-*` attribute
dimensions the canonical file uses.

## Specification

### Input

The same constraint model as algorithm 04, plus a "master metric"
parameter: a map of group names to coordinate values that the cascade
should check against.

### Output

A CSS stylesheet with two kinds of rules:

1. **Environment classification rules** (fire regardless of
 coordinate): set `--env-class` based on viewport width,
 `--color-context` based on prefers-color-scheme, etc.
2. **Master-coordinate confirmation rules** gated by `@media` blocks:
 a rule inside `@media (max-width: 768px)` only matches on compact
 viewports; a rule inside `@media (min-width: 769px)` only matches
 on expanded viewports.

### Structure

```
#sync-probe { --sync-state: pending; --env-class: unknown }

@media (max-width: 768px) { #sync-probe { --env-class: compact } }
@media (min-width: 769px) { #sync-probe { --env-class: expanded } }
@media (prefers-color-scheme: dark) { #sync-probe { --color-context: dark } }
@media (prefers-color-scheme: light) { #sync-probe { --color-context: light } }

# Compact env: partial confirmation (any 2 groups match fires)
@media (max-width: 768px) {
 #sync-probe[data-master-A="val"] {
 --sync-state: confirmed;
 --sync-env: compact;
 }
 # ... more groups ...
}

# Expanded env: full confirmation (ALL groups must match)
@media (min-width: 769px) {
 #sync-probe[data-master-A="val"][data-master-B="val"]... {
 --sync-state: confirmed;
 --sync-env: expanded;
 }
}
```

## Why this is interesting

The cascade now depends on:

1. The `data-*` attributes the probe element carries (coord dimensions).
2. The media environment the browser reports (viewport, color, etc.).

Both must align for a rule to fire. This is a straightforward
generalization of the cascade pattern: `@media` is already a filter on
whether a rule participates in cascade matching, so adding
environment-gating requires no new mechanism, only additional
selectors.

In the vlan-sync demo, this is used for two-level sync confirmation:
compact viewports use looser criteria (fewer groups must match);
expanded viewports require all groups to match. Both outcomes update
the same `--sync-state` custom property.

## What this demonstrates about the architecture

The cascade runtime is not limited to attribute-based logic. Every CSS
gate - `@media`, `@supports`, `@container`, `:has()`, `:is()`, custom
pseudo-classes - composes with attribute selectors to expand the
expressiveness of the runtime without adding JavaScript branching.

This matters for domain adaptation: a domain where the valid result
depends on environment state (mobile vs. desktop layout, online vs.
offline, accessibility mode, etc.) can encode that dependence directly
in the cascade.

## Invariants

1. Environment changes cause the cascade to re-evaluate automatically.
 The probe output changes as the viewport resizes or the color scheme
 switches - no JavaScript needs to re-run.
2. The cascade rebuild path (teardown-before-inject) still applies when
 the constraint set changes. `@media` rules are compiled the same
 way.

## Limitations

- `@media` queries are coarse. They cover viewport metrics and user
 preferences but don't let you express arbitrary predicates.
- Custom-property resolution under `@container` (2024+) opens a second
 axis of environment-gating, but support is inconsistent.

## Defenses

Same injection defenses as algorithm 04 apply. `@media` features are
finite and can be allowlist-validated if they're parameterized.

## Wide-claim scope

The origin document uses this pattern to demonstrate that the cascade
can carry "observation-aware" semantics: the environment (the
observer's context) affects the output at no JavaScript cost. That
framing is accurate. It's a clean demonstration that the cascade is not
just a rule table but a multi-dimensional constraint evaluator.

The wider claim - that `@media` gates are formally analogous to
observer-dependent measurements in physics - is decorative.

## Related algorithms in this catalog

- `04-constraint-compilation.md` - the base pattern this extends
- `06-parallel-probe-array.md` - could be paired with this to resolve
 environment-conditioned state spaces
- `19-observer-as-channel-triadic.md` - theoretical framing
