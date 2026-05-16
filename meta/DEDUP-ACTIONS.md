# DEDUP_ACTIONS

Shell-actionable list of byte-for-byte duplicates in the project
zip. Confirmed via md5sum across all 175 files. 46 duplicate hash
groups, 77 redundant files total.

## Format

For each hash group, the **KEEP** line is the canonical copy; **DROP**
lines are byte-identical and can be deleted.

This file is structured for paste-into-shell removal. Verify before
running any rm command. Copy the DROP lines to a script if you want
to execute them; do not run them blind.

The shell variable `$P` is set to the project root before the rm
commands. All paths are relative to project root.

```
P="/path/to/Current_Working_Project"
```

-----

## Catalog files (3 copies each, 21 hash groups)

For each catalog file 00-20: keep `all_artifacts/`, drop the other
two. (If you instead want to mirror the session-output set,
keep `/mnt/user-data/outputs/algorithms/<file>` as canonical and
drop all three in-zip copies; the session-output versions are
identical.)

```
KEEP:  all_artifacts/00-INDEX.md
DROP:  Demonstration/Canonocial/canonical1.1/00-INDEX.md
DROP:  Software Concepts/WebGPUBridge/00-INDEX.md

KEEP:  all_artifacts/01-manifold-reflex-primitives.md
DROP:  Demonstration/Canonocial/canonical1.1/01-manifold-reflex-primitives.md
DROP:  Software Concepts/WebGPUBridge/01-manifold-reflex-primitives.md

KEEP:  all_artifacts/02-delta-computation.md
DROP:  Demonstration/Canonocial/canonical1.1/02-delta-computation.md
DROP:  Software Concepts/WebGPUBridge/02-delta-computation.md

KEEP:  all_artifacts/03-delta-ipc-channel-fidelity.md
DROP:  Demonstration/Canonocial/canonical1.1/03-delta-ipc-channel-fidelity.md
DROP:  Software Concepts/WebGPUBridge/03-delta-ipc-channel-fidelity.md

KEEP:  all_artifacts/04-constraint-compilation.md
DROP:  Demonstration/Canonocial/canonical1.1/04-constraint-compilation.md
DROP:  Software Concepts/WebGPUBridge/04-constraint-compilation.md

KEEP:  all_artifacts/05-single-probe.md
DROP:  Demonstration/Canonocial/canonical1.1/05-single-probe.md
DROP:  Software Concepts/WebGPUBridge/05-single-probe.md

KEEP:  all_artifacts/06-parallel-probe-array.md
DROP:  Demonstration/Canonocial/canonical1.1/06-parallel-probe-array.md
DROP:  Software Concepts/WebGPUBridge/06-parallel-probe-array.md

KEEP:  all_artifacts/07-vessel-dom-bfs.md
DROP:  Demonstration/Canonocial/canonical1.1/07-vessel-dom-bfs.md
DROP:  Software Concepts/WebGPUBridge/07-vessel-dom-bfs.md

KEEP:  all_artifacts/08-media-gated-observer-cascade.md
DROP:  Demonstration/Canonocial/canonical1.1/08-media-gated-observer-cascade.md
DROP:  Software Concepts/WebGPUBridge/08-media-gated-observer-cascade.md

KEEP:  all_artifacts/09-vsf-header-triads.md
DROP:  Demonstration/Canonocial/canonical1.1/09-vsf-header-triads.md
DROP:  Software Concepts/WebGPUBridge/09-vsf-header-triads.md

KEEP:  all_artifacts/10-vsf-body-rows.md
DROP:  Demonstration/Canonocial/canonical1.1/10-vsf-body-rows.md
DROP:  Software Concepts/WebGPUBridge/10-vsf-body-rows.md

KEEP:  all_artifacts/11-vsf-binary-encoding.md
DROP:  Demonstration/Canonocial/canonical1.1/11-vsf-binary-encoding.md
DROP:  Software Concepts/WebGPUBridge/11-vsf-binary-encoding.md

KEEP:  all_artifacts/12-synchronous-logged-ipc.md
DROP:  Demonstration/Canonocial/canonical1.1/12-synchronous-logged-ipc.md
DROP:  Software Concepts/WebGPUBridge/12-synchronous-logged-ipc.md

KEEP:  all_artifacts/13-content-addressing-and-merkle.md
DROP:  Demonstration/Canonocial/canonical1.1/13-content-addressing-and-merkle.md
DROP:  Software Concepts/WebGPUBridge/13-content-addressing-and-merkle.md

KEEP:  all_artifacts/14-security-defense-stack.md
DROP:  Demonstration/Canonocial/canonical1.1/14-security-defense-stack.md
DROP:  Software Concepts/WebGPUBridge/14-security-defense-stack.md

KEEP:  all_artifacts/15-code-to-vsf-extraction.md
DROP:  Demonstration/Canonocial/canonical1.1/15-code-to-vsf-extraction.md
DROP:  Software Concepts/WebGPUBridge/15-code-to-vsf-extraction.md

KEEP:  all_artifacts/16-gpu-postfix-stack-machine.md
DROP:  Demonstration/Canonocial/canonical1.1/16-gpu-postfix-stack-machine.md
DROP:  Software Concepts/WebGPUBridge/16-gpu-postfix-stack-machine.md

KEEP:  all_artifacts/17-distributed-collapse-network.md
DROP:  Demonstration/Canonocial/canonical1.1/17-distributed-collapse-network.md
DROP:  Software Concepts/WebGPUBridge/17-distributed-collapse-network.md

KEEP:  all_artifacts/18-send-receive-potential-reference-tetrad.md
DROP:  Demonstration/Canonocial/canonical1.1/18-send-receive-potential-reference-tetrad.md
DROP:  Software Concepts/WebGPUBridge/18-send-receive-potential-reference-tetrad.md

KEEP:  all_artifacts/19-observer-as-channel-triadic.md
DROP:  Demonstration/Canonocial/canonical1.1/19-observer-as-channel-triadic.md
DROP:  Software Concepts/WebGPUBridge/19-observer-as-channel-triadic.md

KEEP:  all_artifacts/20-four-constraint-minimum-processor.md
DROP:  Demonstration/Canonocial/canonical1.1/20-four-constraint-minimum-processor.md
DROP:  Software Concepts/WebGPUBridge/20-four-constraint-minimum-processor.md

KEEP:  all_artifacts/dynamics_statistical_iterator.html
DROP:  Demonstration/Canonocial/canonical1.1/dynamics_statistical_iterator.html
DROP:  Software Concepts/WebGPUBridge/dynamics_statistical_iterator.html
```

-----

## CLAUDE.md (4 copies)

```
KEEP:  all_artifacts/CLAUDE.md
DROP:  Demonstration/Canonocial/CLAUDE.md
DROP:  Demonstration/Canonocial/canonical1.1/CLAUDE.md
DROP:  Software Concepts/WebGPUBridge/CLAUDE.md
```

-----

## exodus-canonical.html (4 copies)

```
KEEP:  all_artifacts/exodus-canonical.html
DROP:  Demonstration/Canonocial/canonical1.1/exodus-canonical.html
DROP:  Demonstration/Canonocial/exodus-canonical.html
DROP:  Software Concepts/WebGPUBridge/exodus-canonical.html
```

-----

## constraints.md (4 copies)

```
KEEP:  all_artifacts/constraints.md
DROP:  Demonstration/Canonocial/canonical1.1/constraints.md
DROP:  Demonstration/Canonocial/constraints.md
DROP:  Software Concepts/WebGPUBridge/constraints.md
```

-----

## EXODUS spec.pdf (3 copies)

```
KEEP:  The Exodus Project (RETIRED)/EXODUS spec.pdf
DROP:  The Exodus Project (RETIRED)/.index/Exodus/EXODUS spec.pdf
DROP:  The Exodus Project (RETIRED)/backup.index/Exodus/EXODUS spec.pdf
```

-----

## GPU bridge supporting files (2 copies each)

For each: keep `Software Concepts/WebGPUBridge/<file>` as canonical
since the bridge is its own self-contained directory. Drop the
duplicate from `all_artifacts/`.

```
KEEP:  Software Concepts/WebGPUBridge/compile-constraints.js
DROP:  all_artifacts/compile-constraints.js

KEEP:  Software Concepts/WebGPUBridge/compile-constraints.mjs
DROP:  all_artifacts/compile-constraints.mjs

KEEP:  Software Concepts/WebGPUBridge/constraints.js
DROP:  all_artifacts/constraints.js

KEEP:  Software Concepts/WebGPUBridge/constraints.mjs
DROP:  all_artifacts/constraints.mjs

KEEP:  Software Concepts/WebGPUBridge/css-oracle.js
DROP:  all_artifacts/css-oracle.js

KEEP:  Software Concepts/WebGPUBridge/css-oracle.mjs
DROP:  all_artifacts/css-oracle.mjs

KEEP:  Software Concepts/WebGPUBridge/oracle.js
DROP:  all_artifacts/oracle.js

KEEP:  Software Concepts/WebGPUBridge/oracle.mjs
DROP:  all_artifacts/oracle.mjs

KEEP:  Software Concepts/WebGPUBridge/gpu-path.js
DROP:  all_artifacts/gpu-path.js

KEEP:  Software Concepts/WebGPUBridge/harness.mjs
DROP:  all_artifacts/harness.mjs

KEEP:  Software Concepts/WebGPUBridge/index.html
DROP:  all_artifacts/index.html

KEEP:  Software Concepts/WebGPUBridge/resolve.wgsl
DROP:  all_artifacts/resolve.wgsl

KEEP:  Software Concepts/WebGPUBridge/test-oracle.js
DROP:  all_artifacts/test-oracle.js

KEEP:  Software Concepts/WebGPUBridge/README.md
DROP:  all_artifacts/README.md
```

-----

## The Exodus Project HTML duplicates

```
KEEP:  The Exodus Project (RETIRED)/.index/Exodus/Exodus.html
DROP:  The Exodus Project (RETIRED)/backup.index/Exodus.html

KEEP:  The Exodus Project (RETIRED)/.index/Exodus/The Exodus Spec.html
DROP:  The Exodus Project (RETIRED)/backup.index/The Exodus Spec.html

KEEP:  The Exodus Project (RETIRED)/.index/Exodus/The Vessel/VesselPOC.html
DROP:  The Exodus Project (RETIRED)/backup.index/VesselPOC.html

KEEP:  The Exodus Project (RETIRED)/.index/Exodus/The Vessel/The_Vessel.text
DROP:  The Exodus Project (RETIRED)/backup.index/The_Vessel.text

KEEP:  The Exodus Project (RETIRED)/.index/Exodus/Research/Exodus Criteque Research.
DROP:  The Exodus Project (RETIRED)/backup.index/Exodus Criteque Research.

KEEP:  The Exodus Project (RETIRED)/.index/Exodus/The Vessel/VesselPOC.html
DROP:  The Exodus Project (RETIRED)/.index/Exodus/The Vessel/Vessel_Proof_of_Concept.jsx
```

The last entry is notable: `VesselPOC.html` and
`Vessel_Proof_of_Concept.jsx` are byte-identical. One is misnamed
(an HTML file with a `.jsx` extension). The HTML version is
canonical; the misnamed copy can be dropped.

```
KEEP:  The Exodus Project (RETIRED)/.index/Exodus/The Vessel/Copy of VesselPOC.jsx
DROP:  The Exodus Project (RETIRED)/backup.index/Exodus/Copy of VesselPOC.jsx
```

-----

## Summary

- **Total files in zip:** 175
- **Unique by content:** 98
- **Files to drop (byte-for-byte duplicates):** 77
- **Files remaining after dedup:** 98

After dedup, 16 of the remaining 98 unique files are also worth
considering for archive-vs-canon classification (see MANIFEST.md):
the user must decide whether to keep older bootstraps, generator
versions, etc., as historical reference (archive) or remove them
entirely (delete).

-----

## How to execute

These are recommendations, not commands. Verify each KEEP path
exists and contains the expected content before deleting any DROP
path. A safe approach:

1. `cd` into the project root
1. For each group, verify the KEEP file exists and has the expected
   md5: `md5sum "$KEEP_PATH"`
1. Verify each DROP file has the same md5
1. Then `rm "$DROP_PATH"`

If any md5 differs from what’s listed here, stop and investigate;
do not delete.

Alternatively, do nothing yet and just preserve this list as a
record. The duplicates are not harmful in place; they only consume
disk and create ambiguity about which copy is canonical.

-----

## What this list does not do

- Does not delete anything.
- Does not move or rename files.
- Does not address content-level drift between near-duplicates that
  have different md5s but might still be near-identical.
- Does not classify the 98 unique files into CANON vs ARCHIVE; that
  classification is in MANIFEST.md.

-----

## Version

DEDUP_ACTIONS.md v1.0. Pinned to the zip
`Current_Working_Project.zip` as supplied. If new files are added
or existing files are modified, hashes change and this list goes
stale. Re-run `find . -type f -exec md5sum {} \; | sort` to
regenerate.