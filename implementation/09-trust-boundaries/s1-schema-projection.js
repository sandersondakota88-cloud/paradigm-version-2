// s1-schema-projection.js - Phase 9 S1: schema-version + projection

"use strict";

// ----------------------------------------------------------------------------
// Reference projection cascade rules
//
// Per Phase 9 architectural decision (PHASE_9_PLAN sec 15) and the
// synthesizer fix that closed Lesson 10's debt, multi-property rule
// bodies are honored. Each rule emits both --derived-tier and
// --derived-is-premium together; the synthesizer produces two
// constraints per rule (one per declaration), all sharing the
// selector. Six logical projections, expressed grammar-faithfully
// rather than split for synthesizer convenience.
//
// v1 -> canonical projection: maps v1's status coord to canonical
// --derived-tier and --derived-is-premium (one rule per source case,
// each emitting both canonical coords).
//
// v3 native: passes through tier and is-premium directly.
// ----------------------------------------------------------------------------
const REFERENCE_PROJECTION_RULES = [
  // v1 projections
  '[data-substrate-state][data-schema-version="v1"][data-record-status="active"] { --derived-tier: "standard"; --derived-is-premium: "0"; }',
  '[data-substrate-state][data-schema-version="v1"][data-record-status="vip"] { --derived-tier: "platinum"; --derived-is-premium: "1"; }',
  '[data-substrate-state][data-schema-version="v1"][data-record-status="inactive"] { --derived-tier: "inactive"; --derived-is-premium: "0"; }',
  // v3 native (passthrough)
  '[data-substrate-state][data-schema-version="v3"][data-record-tier="standard"] { --derived-tier: "standard"; --derived-is-premium: "0"; }',
  '[data-substrate-state][data-schema-version="v3"][data-record-tier="platinum"] { --derived-tier: "platinum"; --derived-is-premium: "1"; }',
  '[data-substrate-state][data-schema-version="v3"][data-record-tier="inactive"] { --derived-tier: "inactive"; --derived-is-premium: "0"; }'
].join("\n");

// ----------------------------------------------------------------------------
// Reference v3 application rules
//
// These are the cascade rules a v3 application installs alongside
// the projection rules. The v3 app reads --derived-tier and
// --derived-is-premium (canonical), not data-record-status (v1) or
// data-record-tier (v3-native). The projection makes the source
// version invisible to the application.
// ----------------------------------------------------------------------------
const REFERENCE_V3_APPLICATION_RULES = [
  // Premium contacts get a different next-op
  '[data-substrate-state][data-derived-is-premium="1"] { --next-op: "show-premium-actions"; }',
  '[data-substrate-state][data-derived-is-premium="0"] { --next-op: "show-standard-actions"; }'
].join("\n");

// ----------------------------------------------------------------------------
// Helpers for testing and for K2-adapter integration
// ----------------------------------------------------------------------------

// Compose projection rules with v3 application rules for end-to-end testing
function composedRules() {
  return REFERENCE_PROJECTION_RULES + "\n" + REFERENCE_V3_APPLICATION_RULES;
}

// Build the coord set the v3 cascade sees AFTER projection has run.
// This simulates the "bridge writes derived coords back as data-*
// attributes" step that happens in deposition. Takes initial coords
// (the v1 or v3 artifact's hydrated state) and projection cascade
// output; returns the augmented coords for the v3 application
// cascade to read.
function applyProjectionToCoords(initialCoords, projectionOutput) {
  const out = Object.assign({}, initialCoords);
  for (const key of Object.keys(projectionOutput)) {
    if (!key.indexOf("--derived-")) {
      // --derived-tier -> data-derived-tier
      const propName = key.substring(2);  // strip --
      const attrName = "data-" + propName;
      out[attrName] = projectionOutput[key].value;
    }
  }
  return out;
}

// ----------------------------------------------------------------------------
// SchemaShape helper - given a hydrated state's coords, report which
// schema versions appear represented (via data-schema-version coords
// AND via data-record-* coord presence).
//
// Used by Layer S3 (schema-shape derivation from artifact) for audit
// tooling and by Layer S2 (forward-compat verification) to confirm
// projection coverage.
// ----------------------------------------------------------------------------
function describeSchemaShape(coords) {
  const shape = {
    declaredVersion: null,
    hasV1Coords: false,
    hasV3Coords: false,
    derivedCoordsPresent: []
  };
  if (coords["data-schema-version"]) {
    shape.declaredVersion = coords["data-schema-version"];
  }
  if (coords["data-record-status"]) shape.hasV1Coords = true;
  if (coords["data-record-tier"]) shape.hasV3Coords = true;
  for (const k of Object.keys(coords)) {
    if (k.indexOf("data-derived-") === 0) {
      shape.derivedCoordsPresent.push(k);
    }
  }
  return shape;
}

module.exports = Object.freeze({
  REFERENCE_PROJECTION_RULES: REFERENCE_PROJECTION_RULES,
  REFERENCE_V3_APPLICATION_RULES: REFERENCE_V3_APPLICATION_RULES,
  composedRules: composedRules,
  applyProjectionToCoords: applyProjectionToCoords,
  describeSchemaShape: describeSchemaShape
});
