# 09 trust boundaries

Phase 9 extends Phase 8's CRM forcing function to cross-trust-boundary
operation, schema evolution, and the SE-01-faithful architectural
decision (configuration as cascade-extruded text). Tests: 694/694 across
40 suites.

## Baseline

Phase 9 builds on Phase 8 (08-runtime-kernel/). 46 files were carried
through Phase 9 unchanged from Phase 8. Under V2's no-duplicates policy,
those files live once in 08-runtime-kernel/; Phase 9 contains only the
files this phase modified or added.

## Layer F (Phase 8 soft-spot closure)

F1: closure on emitted form. F2: retire kind="data" (closure leak).
F3: P5 workflow reframing as commitment-projection adapter.

## Layer T (trust boundaries)

T1: skeptical intake cascade with sacrificial arms.
T2: source-attributed contributor records (HMAC-SHA256 verification).
T3: cross-instance trust topology (peer-trust, partner-trust,
public-firewall, open-public).

## Layer S (schema evolution)

S1: schema-version coords + projection cascade rules.
S2: forward-compatibility verification.
S3: schema-shape as O-class observer surface.

## Files in this phase

- 27 net-new files (Phase 9 additions)
- 16 evolved files (revised versions of Phase 8 files)
- This README

The canonical kernel lives in implementation/kernel/. Phase 9 consumes
it unchanged from Phase 8's contribution.
