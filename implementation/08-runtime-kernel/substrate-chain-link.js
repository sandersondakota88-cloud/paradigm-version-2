// substrate-chain-link.js - Phase 8 M2 - chain link as substrate

"use strict";

const SOURCE_PREFIX = "chain-row";

function makeSubstrateChainLink(opts) {
  if (!opts || typeof opts !== "object") {
    throw new TypeError("makeSubstrateChainLink: opts required");
  }
  if (typeof opts.id !== "string" || opts.id.length === 0) {
    throw new TypeError("makeSubstrateChainLink: opts.id required");
  }
  if (!opts.publisher || typeof opts.publisher.publish !== "function") {
    throw new TypeError("makeSubstrateChainLink: opts.publisher required");
  }
  if (typeof opts.transform !== "function") {
    throw new TypeError("makeSubstrateChainLink: opts.transform required");
  }

  const stats = {
    appliesCalled: 0,
    rowsIngested: 0,
    contributionsEmitted: 0
  };

  function applyAsync(artifact) {
    stats.appliesCalled++;

    // ----------------------------------------------------------------
    // Step 1: publish each artifact row as SE-08 contributor record.
    // This is the "upstream emission arrives at downstream and
    // integrates as SE-08 contributor" pathway.
    // ----------------------------------------------------------------
    if (artifact && Array.isArray(artifact.rows)) {
      for (const row of artifact.rows) {
        const record = {
          type: String(row.coord),
          value: row.value,
          source: SOURCE_PREFIX + "::link-" + row.linkIdx
        };
        if (opts.onPublish) {
          try { opts.onPublish(record); } catch (e) { /* observer-only */ }
        }
        opts.publisher.publish(record);
        stats.rowsIngested++;
      }
    }

    // ----------------------------------------------------------------
    // Step 2: apply this link's local constraints. The transform fn
    // is invoked against the publisher's field; it reads intake state
    // and returns the link's contributions.
    // ----------------------------------------------------------------
    let contributions;
    try {
      contributions = opts.transform(opts.publisher.field);
    } catch (e) {
      // F3: errors in the transform are reported as metadata, not
      // propagated as command into the chain runner.
      return Promise.resolve({
        contributions: [],
        metadata: { error: e.message, linkId: opts.id }
      });
    }

    if (!Array.isArray(contributions)) {
      return Promise.resolve({
        contributions: [],
        metadata: { error: "transform did not return array", linkId: opts.id }
      });
    }

    stats.contributionsEmitted += contributions.length;

    return Promise.resolve({
      contributions: contributions,
      metadata: {
        linkId: opts.id,
        intakeRecordCount: (opts.publisher.field.intake.records || []).length,
        fieldStep: opts.publisher.field.step
      }
    });
  }

  return {
    id: opts.id,
    isRemote: false,
    isSubstrate: true,
    applyAsync: applyAsync,
    observe() {
      return Object.assign({}, stats);
    }
  };
}

module.exports = Object.freeze({
  makeSubstrateChainLink: makeSubstrateChainLink,
  SOURCE_PREFIX: SOURCE_PREFIX
});
