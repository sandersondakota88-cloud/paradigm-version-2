# Phase 5 - Coupling verification

Per IMPLEMENTATION_PATH.md v2.2 section 6. Builds tests and diagnostic
tooling that verify the engines remain coherent under stress.

## What's in this directory

### Production code (unchanged from Phase 4d)

These files are the running implementation. Phase 5 does not modify
them - Phase 5 is verification, not feature work.

- `field.js` - the field, delta computation, vector-delta, predictive
  reaching, compounds, recall window
- `ct-engine.js` - critical thought engine (sequential, queue-driven)
- `er-engine.js` - experiential reality engine (CPU oracle / WGSL
  compute shader)
- `cpu-oracle.js` - CPU equivalent of resolve-fresh.wgsl, used as the
  byte-equivalence reference
- `constraint-compiler.js` - compiles field constraints to instruction
  buffers
- `reflexive-surface.js` - structural-event clauses, Pass A + Pass B
- `storage-adapter.js` - persistence substrate (in-memory in Node;
  IndexedDB in browser)
- `resolve-fresh.wgsl` - the WGSL compute shader
- `index.html` - browser host

### Phase 5 verification artifacts

- `phase5-harness.js` - shared stress harness (setup, input streams,
  snapshots, drainage, metric helpers, runtime invariant checks)
- `phase5-coupling-audit.js` - source-level static analysis verifying
  SE-06's no-command-path commitment (S3) and the engine-binding
  topology
- `test-phase5a.js` through `test-phase5f.js` - the six stress test
  categories (rapid input, divergence, ratification, persistence,
  compound coherence, substrate equivalence)
- `kindmult-audit.js` - comparative-run audit of kindMult constants
  per v2.2 section 8 ordering principle 4
- `test-phase5.js` - integration runner that calls everything and
  produces a summary

### Prior regression tests (preserved, all passing)

- `test-phase3.js` (8/8)
- `test-reflexive-surface.js` (12/12, 4a)
- `test-phase4b.js` (14/14)
- `test-phase4c.js` (14/14)
- `test-phase4d.js` (13/13)

## Running

```
# Full Phase 5 verification (recommended)
node test-phase5.js

# Individual categories
node test-phase5a.js
node test-phase5b.js
node test-phase5c.js
node test-phase5d.js
node test-phase5e.js
node test-phase5f.js

# Audits in isolation
node phase5-coupling-audit.js
node kindmult-audit.js

# Prior regression
node test-phase3.js
node test-reflexive-surface.js
node test-phase4b.js
node test-phase4c.js
node test-phase4d.js
```

## What Phase 5 verifies

- **F1** (seed permanent): tested across rapid, divergence, and
  persistence streams (5a.5, 5b.5, 5c.7, 5d.2, 5e.8)
- **F4** (indefinite operation, step monotonicity): 5a.2, 5c.3
- **I3** (bounded everything): 5a.3, 5a.4, 5e.2, 5e.5, 5e.7
- **M1-M3** (vector-delta, predictive constraints, ratification):
  5b.1, 5b.2, 5c.1, 5c.3, 5c.5
- **S1** (shared field): 5c.6
- **S2** (substrate-resolution determinism): 5f.1, 5f.6, 5f.7
  (CPU oracle side; WGSL side inherits from Phase 2's 22/22)
- **S3** (no command path): coupling-path audit (7 source-level
  checks); 5a.9, 5b.5, 5c.7, 5e.8 (runtime checks)
- **O1** (surface read-only): coupling-path audit C6
- **Persistence durability**: 5d.1, 5d.2, 5d.3, 5d.4, 5d.5, 5d.6, 5d.7
- **Compound coherence**: 5e.1 through 5e.8

## What Phase 5 does NOT verify

- **WGSL substrate byte-equivalence at scale**. Node cannot run
  WebGPU. Phase 2's `test-equivalence.js` verified CPU-vs-WGSL on
  the static 2880-coord loan domain at 22/22. Phase 5f extends the
  CPU-side determinism claim; the WGSL inheritance is documented
  but not re-tested in Node.
- **Distribution properties** (algorithm 17). Out of scope per
  Phase 6 dependency.

## kindMult audit findings (advisory)

The audit ran the same input stream against three configurations:
baseline, kind-multipliers-flattened, and all-imposed-multipliers-
flattened. Across two distinct stream shapes:

- Ratification count: zero change
- Compound generation count: zero change
- Named events: zero change
- Mean delta trajectory: < 0.5% change

The current selection-bias constants - ratified=1.3, meta=1.15,
compound=1.25, namingBonus=1.5, recencyExp=1.5 - produce no observable
change in runtime metrics under tested streams. Per v2.2 section 8
principle 4 ("Let delta decide before imposing precedence"), these
are candidates for removal.

The recommendation is advisory. Phase 5 production-code discipline
is verification only; any removal belongs to Phase 5.5 or later,
after additional stream-shape verification and consumer-side audit.

The mechanism explaining the finding: `selectFromMatches` returns a
sorted ranking, but the consumers (`markUsed`, `updateCorrelations`,
`ratify`) operate on the chosen indices as a set, not in order. The
multipliers change the ranking; nothing downstream reads the ranking
order. If the architecture is later extended to consume the ranking's
order (e.g., select-best-N selection, top-K only firing), the
multipliers will start mattering.

## Phase 5 status

- 47/47 stress tests passing
- 7/7 coupling-path checks passing
- kindMult audit: complete with cross-stream finding
- 61/61 prior regression tests still passing

Total: **108 tests passing** plus 7 source-level checks plus advisory
audit data.

Phase 5 deliverable per v2.2 section 8: stable, all phases through 5
green.
