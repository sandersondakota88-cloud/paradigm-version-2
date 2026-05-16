// chain-runner-async.js - Phase 8 M2 - async chain runner

"use strict";

const ChainComposer = require("./chain-composer.js");

function makeAsyncRunner(links, opts) {
  opts = opts || {};

  // Validate links: each must have id and either apply or applyAsync
  for (const link of links) {
    if (!link || typeof link !== "object") {
      throw new TypeError("runAsync: link must be object");
    }
    if (typeof link.id !== "string") {
      throw new TypeError("runAsync: link.id required");
    }
    if (typeof link.apply !== "function" && typeof link.applyAsync !== "function") {
      throw new TypeError("runAsync: link '" + link.id +
        "' must have apply() or applyAsync()");
    }
  }
  // Unique ids
  const seen = new Set();
  for (const link of links) {
    if (seen.has(link.id)) {
      throw new Error("runAsync: duplicate link id '" + link.id + "'");
    }
    seen.add(link.id);
  }

  return {
    links: links.slice(),
    async run(input, runOpts) {
      runOpts = runOpts || {};
      const dimensions = runOpts.dimensions || opts.dimensions || [];
      let artifact = ChainComposer.makeGenesisArtifact(input,
        { dimensions: dimensions });
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

        let result;
        if (link.isRemote || typeof link.applyAsync === "function") {
          // Remote / async link
          result = await link.applyAsync(artifact);
        } else {
          // Local sync link (chain-composer style)
          result = link.apply(artifact);
        }

        if (!result || !Array.isArray(result.contributions)) {
          throw new Error("link '" + link.id +
            "' did not return {contributions: [...]}");
        }

        // Verify the link did not mutate the input artifact (M5).
        // For remote links this is automatic - they only see a
        // serialized copy - but we check anyway for the local case.
        if (artifact.address !== beforeAddress) {
          throw new Error("link '" + link.id +
            "' mutated input artifact (M5 violation)");
        }
        if (artifact.rows.length !== beforeRowCount) {
          throw new Error("link '" + link.id +
            "' mutated input artifact rows (M5 violation)");
        }

        artifact = ChainComposer.appendRows(artifact, link.id, i,
          result.contributions);

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

module.exports = Object.freeze({
  makeAsyncRunner: makeAsyncRunner
});
