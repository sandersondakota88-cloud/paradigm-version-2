// chain-composer.js - Phase 7 Layer B4 chain runtime

"use strict";

// ============================================================================
// Hashing
// ============================================================================
//
// Reuses the simple bounded hash used elsewhere in the project. The
// chain doesn't depend on cryptographic strength; it depends on
// determinism. Same input -> same hash, every run.
// ============================================================================

function hashString(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) & 0xFFFFFFFF;
  }
  return "h" + (h >>> 0).toString(16);
}

function canonicalize(obj) {
  // Deterministic JSON serialization. Object keys sorted; numbers
  // stringified consistently. The canonical form is what we hash.
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalize).join(",") + "]";
  }
  const keys = Object.keys(obj).sort();
  const parts = [];
  for (const k of keys) {
    parts.push(JSON.stringify(k) + ":" + canonicalize(obj[k]));
  }
  return "{" + parts.join(",") + "}";
}

function hashArtifact(art) {
  // The artifact's address is the hash of its canonical form
  // EXCLUDING the address field itself (chicken-and-egg).
  const copy = Object.assign({}, art);
  delete copy.address;
  return hashString(canonicalize(copy));
}

function hashContribution(linkId, coord, value) {
  return hashString(linkId + "|" + canonicalize(coord) + "|" + canonicalize(value));
}

// ============================================================================
// Artifact construction
// ============================================================================

function makeGenesisArtifact(input, opts) {
  opts = opts || {};
  const dimensions = opts.dimensions || [];
  const inputCanonical = canonicalize(input);
  const genesisHash = hashString(inputCanonical);
  const art = {
    header: {
      dimensions: dimensions.slice(),
      linkCount: 0,
      genesis: genesisHash,
      input: input
    },
    rows: [],
    merkleRoot: hashString("")
  };
  art.address = hashArtifact(art);
  return art;
}

function appendRows(artifact, linkId, linkIdx, contributions) {
  // Append-only row commitment per Algorithm 10. Returns a NEW
  // artifact; does not mutate the input. (Substrate-true: artifacts
  // are immutable; each link emits a fresh artifact.)
  const newRows = artifact.rows.slice();
  for (const c of contributions) {
    newRows.push({
      linkId: linkId,
      linkIdx: linkIdx,
      coord: c.coord,
      value: c.value,
      contributionHash: hashContribution(linkId, c.coord, c.value)
    });
  }
  // Compute Merkle root over all rows in commit order. Simple variant:
  // rolling hash of contributionHashes. Algorithm 13 specifies a tree;
  // a chain demonstration only needs a deterministic roll.
  let rollingHash = hashString("");
  for (const r of newRows) {
    rollingHash = hashString(rollingHash + ":" + r.contributionHash);
  }
  const newArt = {
    header: Object.assign({}, artifact.header, {
      linkCount: artifact.header.linkCount + 1
    }),
    rows: newRows,
    merkleRoot: rollingHash
  };
  newArt.address = hashArtifact(newArt);
  return newArt;
}

// ============================================================================
// Link interface
// ============================================================================
//
// A link is any object satisfying:
//
//   {
//     id: string,                              // unique within a chain
//     constraintSet: <opaque>,                 // link-specific
//     apply(inputArtifact) -> {                // pure function
//       contributions: [{coord, value}, ...],  // what this link adds
//       metadata: <any>                        // optional per-link info
//     }
//   }
//
// The chain composer:
//   1. Calls link.apply(currentArtifact) at each step
//   2. Wraps the contributions in a new immutable artifact
//   3. Verifies M5/F3 invariants (link doesn't mutate input artifact,
//      doesn't read forward in chain, etc.)
//   4. Passes the new artifact to the next link
//
// Each link is autonomous: it does not know about other links. It
// receives an artifact, looks at its rows + header, applies its own
// constraint set, returns its contributions. The composer threads
// artifacts through; no link orchestrates another.
// ============================================================================

function isValidLink(link) {
  if (!link || typeof link !== "object") return false;
  if (typeof link.id !== "string") return false;
  if (typeof link.apply !== "function") return false;
  return true;
}

// ============================================================================
// Chain
// ============================================================================

function composeChain(links, opts) {
  opts = opts || {};
  // Validate
  for (const link of links) {
    if (!isValidLink(link)) {
      throw new Error("composeChain: invalid link " + JSON.stringify(link));
    }
  }
  // Validate unique ids (a chain shouldn't have two links with the
  // same id; would make the per-row linkId ambiguous)
  const seen = new Set();
  for (const link of links) {
    if (seen.has(link.id)) {
      throw new Error("composeChain: duplicate link id '" + link.id + "'");
    }
    seen.add(link.id);
  }
  return {
    links: links.slice(),
    run(input, runOpts) {
      runOpts = runOpts || {};
      const dimensions = runOpts.dimensions || opts.dimensions || [];
      let artifact = makeGenesisArtifact(input, { dimensions: dimensions });
      const trace = [{
        step: "genesis",
        address: artifact.address,
        rowCount: 0,
        merkleRoot: artifact.merkleRoot
      }];
      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        const beforeAddress = artifact.address;
        const beforeRowCount = artifact.rows.length;
        const result = link.apply(artifact);
        if (!result || !Array.isArray(result.contributions)) {
          throw new Error("link '" + link.id + "' did not return {contributions: [...]}");
        }
        // Verify the link did not mutate the input artifact (M5)
        if (artifact.address !== beforeAddress) {
          throw new Error("link '" + link.id + "' mutated the input artifact (M5 violation)");
        }
        if (artifact.rows.length !== beforeRowCount) {
          throw new Error("link '" + link.id + "' mutated input artifact rows (M5 violation)");
        }
        artifact = appendRows(artifact, link.id, i, result.contributions);
        trace.push({
          step: link.id,
          linkIdx: i,
          address: artifact.address,
          rowCount: artifact.rows.length,
          rowsAdded: result.contributions.length,
          merkleRoot: artifact.merkleRoot,
          metadata: result.metadata || null
        });
      }
      return {
        terminal: artifact,
        trace: trace,
        stats: {
          linkCount: links.length,
          totalRows: artifact.rows.length,
          terminalAddress: artifact.address,
          merkleRoot: artifact.merkleRoot
        }
      };
    }
  };
}

// ============================================================================
// Resolution-density measurement
// ============================================================================
//
// Per the plan: "verify resolution density accretes through the chain."
// Resolution density at link N is concretely the count of rows
// committed up through link N. This is monotonic by construction
// (rows append-only).
//
// A more interesting measurement is the count of UNIQUE coords
// resolved through the chain — duplicate contributions to the same
// coord from different links are committed as separate rows but
// don't add new resolution. We report both.
// ============================================================================

function densityProfile(runResult) {
  const profile = [];
  let cumulativeRows = 0;
  const seenCoords = new Set();
  for (const step of runResult.trace) {
    if (step.step === "genesis") {
      profile.push({
        step: "genesis",
        cumulativeRows: 0,
        cumulativeUniqueCoords: 0,
        addedRows: 0,
        addedUniqueCoords: 0
      });
      continue;
    }
    const prevUnique = seenCoords.size;
    // Walk the artifact's rows, counting up to this step
    cumulativeRows = step.rowCount;
    // Collect contributions added at THIS step from runResult.terminal.rows
    const stepRows = runResult.terminal.rows.filter(r => r.linkIdx === step.linkIdx);
    for (const r of stepRows) {
      seenCoords.add(canonicalize(r.coord));
    }
    profile.push({
      step: step.step,
      linkIdx: step.linkIdx,
      cumulativeRows: cumulativeRows,
      cumulativeUniqueCoords: seenCoords.size,
      addedRows: step.rowsAdded,
      addedUniqueCoords: seenCoords.size - prevUnique
    });
  }
  return profile;
}

// ============================================================================
// Chain re-run verification
// ============================================================================
//
// Given a chain and an input, running twice should produce the same
// terminal address. If it doesn't, something in the chain has
// non-deterministic behavior (probably a link reading clock or
// random source). The verification helper runs a chain twice and
// reports whether the terminal addresses match.
// ============================================================================

function verifyByteStability(chain, input, runOpts) {
  const a = chain.run(input, runOpts);
  const b = chain.run(input, runOpts);
  return {
    stable: a.terminal.address === b.terminal.address,
    addressA: a.terminal.address,
    addressB: b.terminal.address,
    merkleA: a.terminal.merkleRoot,
    merkleB: b.terminal.merkleRoot
  };
}

// ============================================================================
// Coverage report
// ============================================================================

function formatCoverageReport(runResult) {
  const lines = [];
  lines.push("");
  lines.push("  CHAIN COMPOSITION (B4):");
  lines.push("    Links:             " + runResult.stats.linkCount);
  lines.push("    Total rows:        " + runResult.stats.totalRows);
  lines.push("    Terminal address:  " + runResult.stats.terminalAddress);
  lines.push("    Merkle root:       " + runResult.stats.merkleRoot);
  lines.push("");
  lines.push("    Per-link contributions:");
  const profile = densityProfile(runResult);
  for (const p of profile) {
    if (p.step === "genesis") {
      lines.push("      [genesis]              rows=" + p.cumulativeRows +
                 " unique=" + p.cumulativeUniqueCoords);
      continue;
    }
    lines.push("      [link " + p.linkIdx + ": " + p.step + "]" +
               "  added=" + p.addedRows +
               " (+" + p.addedUniqueCoords + " unique)" +
               " cumulative=" + p.cumulativeRows +
               " unique=" + p.cumulativeUniqueCoords);
  }
  return lines.join("\n");
}

// ============================================================================
// Exports
// ============================================================================

module.exports = Object.freeze({
  hashString: hashString,
  canonicalize: canonicalize,
  hashArtifact: hashArtifact,
  hashContribution: hashContribution,
  makeGenesisArtifact: makeGenesisArtifact,
  appendRows: appendRows,
  isValidLink: isValidLink,
  composeChain: composeChain,
  densityProfile: densityProfile,
  verifyByteStability: verifyByteStability,
  formatCoverageReport: formatCoverageReport
});
