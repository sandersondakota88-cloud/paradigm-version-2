// s3-schema-shape-observer.js - Phase 9 S3: schema-shape observation

"use strict";

const S1 = require("./s1-schema-projection.js");

// ----------------------------------------------------------------------------
// Known canonical coords - if these are present in projected output,
// we count projection as successful (or partial) for that artifact.
//
// As more canonical coords are added (each schema generation may
// extend), this list grows. It's the deployment's vocabulary of
// "what our application reads from the cascade."
// ----------------------------------------------------------------------------
const KNOWN_CANONICAL_COORDS = Object.freeze([
  "data-derived-tier",
  "data-derived-is-premium",
  "data-derived-acquisition"  // added in v5
]);

// ----------------------------------------------------------------------------
// SchemaShapeObserver - aggregates schema-shape across a corpus
//
// Constructor takes optional config:
//   - knownCanonicalCoords: list of coord names that count as
//     "successful projection" markers. Defaults to the deployment's
//     current vocabulary.
//   - knownVersions: list of declared-version strings the deployment
//     supports. Artifacts at versions not in this list are flagged
//     as unknownVersions.
//
// snapshot(corpus): given a list of coord-set objects, return:
//   - versionCounts: {versionString: count}
//   - projectionCoverage: {full, partial, none, total}
//   - unknownVersions: list of declared-version strings not in
//     knownVersions
//   - corpusSize: count of artifacts examined
// ----------------------------------------------------------------------------
class SchemaShapeObserver {
  constructor(opts) {
    opts = opts || {};
    this.knownCanonicalCoords = (opts.knownCanonicalCoords
      ? opts.knownCanonicalCoords.slice()
      : KNOWN_CANONICAL_COORDS.slice());
    this.knownVersions = (opts.knownVersions
      ? opts.knownVersions.slice()
      : ["v1", "v3", "v5"]);
  }

  // snapshot(corpus) - read-only aggregate over a list of coord-sets
  //
  // Per O1: this method does not mutate any external state. It does
  // not call .push() on caller's arrays, does not modify caller's
  // coord-set objects, does not write anywhere.
  snapshot(corpus) {
    if (!Array.isArray(corpus)) {
      throw new TypeError("snapshot: corpus must be array");
    }
    const versionCounts = {};
    const unknownVersions = {};
    const coverage = { full: 0, partial: 0, none: 0, total: 0 };

    for (const coords of corpus) {
      if (!coords || typeof coords !== "object") continue;
      coverage.total++;

      // Per-artifact shape from S1
      const shape = S1.describeSchemaShape(coords);

      // Version counts
      if (shape.declaredVersion) {
        versionCounts[shape.declaredVersion] =
          (versionCounts[shape.declaredVersion] || 0) + 1;
        if (this.knownVersions.indexOf(shape.declaredVersion) < 0) {
          unknownVersions[shape.declaredVersion] =
            (unknownVersions[shape.declaredVersion] || 0) + 1;
        }
      }

      // Projection coverage: count which canonical coords are present
      let presentCount = 0;
      for (const coordName of this.knownCanonicalCoords) {
        if (Object.prototype.hasOwnProperty.call(coords, coordName)) {
          presentCount++;
        }
      }
      if (presentCount === this.knownCanonicalCoords.length) {
        coverage.full++;
      } else if (presentCount > 0) {
        coverage.partial++;
      } else {
        coverage.none++;
      }
    }

    return {
      versionCounts: versionCounts,
      projectionCoverage: coverage,
      unknownVersions: unknownVersions,
      corpusSize: coverage.total
    };
  }
}

module.exports = Object.freeze({
  KNOWN_CANONICAL_COORDS: KNOWN_CANONICAL_COORDS,
  SchemaShapeObserver: SchemaShapeObserver
});
