// kernel-cascade-evaluator.js - ER pass for cascade-match constraints

"use strict";

(function (global) {

const KernelOracle = (typeof require !== "undefined")
  ? require("./kernel-cascade-match-oracle.js")
  : global.KernelCascadeMatchOracle;

// ============================================================================
// buildCoordSnapshotFromIntake
// ============================================================================
//
// Reads the current Field.intake records and builds a coord-state map
// representing the substrate's current input shape. The map's keys are
// dimension names (without "data-" prefix); values are the dimension
// values most-recently published.
//
// SE-08 NOTE: this pass over the buffer is the ER engine's "reads buffer
// alongside live constraints". It runs per resolution pass; it does not
// command adapters; adapters publish on their own clock.
//
// The intake records have shape { type, value, timestamp, source } per
// SE-08. The synthesis convention used here:
//
//   record.type = "dom::<dimname>" - dimname is a coord dimension
//     value: { dimname: <value-string> }
//
//   record.type = "time::<dimname>" - dimname is a coord dimension
//     value: <value-string-or-number>
//
// Other type prefixes are ignored by cascade-match; they may be consumed
// by other matcher types (predictive, text-token, etc.).
// ============================================================================

function buildCoordSnapshotFromIntake(field) {
  const coordValues = {};
  if (!field.intake || !field.intake.records) return coordValues;
  // Walk in order; later publishes overwrite earlier (latest wins per dim)
  for (const rec of field.intake.records) {
    if (typeof rec.type !== "string") continue;
    const colonIdx = rec.type.indexOf("::");
    if (colonIdx < 0) continue;
    const prefix = rec.type.substring(0, colonIdx);
    const dimName = rec.type.substring(colonIdx + 2);
    // For dom:: events, the value may be an object with the dim
    if (prefix === "dom" && rec.value && typeof rec.value === "object") {
      // value contains a map of dim -> value (e.g., {trigger: "toggle"})
      for (const k of Object.keys(rec.value)) {
        coordValues[k] = String(rec.value[k]);
      }
    } else {
      // Generic: rec.value is the dim value directly
      coordValues[dimName] = String(rec.value);
    }
  }
  return coordValues;
}

// ============================================================================
// evaluateCascade
// ============================================================================
//
// Per-tick ER pass over cascade-match constraints in the field.
//
// Walks all constraints with pattern.type === "cascade-match"; for each,
// evaluates against the current coord snapshot. Updates per-constraint
// match state. Last matching constraint per emit.property wins (cascade
// semantics: later rules override earlier).
//
// Honors F1: never modifies the seed (constraints[0] with kind=seed).
// ============================================================================

function evaluateCascade(field, opts) {
  opts = opts || {};
  const Trace = opts.traceModule || null;

  if (!field || !field.constraints) {
    return {
      matchedCount: 0,
      evaluatedCount: 0,
      currentNextOp: null,
      coordSnapshot: {}
    };
  }

  const coordValues = buildCoordSnapshotFromIntake(field);

  // Per-emit-property latest match
  const latestMatchByProp = {};

  let matchedCount = 0;
  let evaluatedCount = 0;

  for (let i = 0; i < field.constraints.length; i++) {
    const c = field.constraints[i];
    if (!c.pattern || c.pattern.type !== "cascade-match") continue;
    if (c.kind === "seed") continue;  // F1: seed not subject to cascade-match

    evaluatedCount++;
    const wasMatched = !!c.lastMatched;
    const matched = matchConstraintWithoutGeometry(c, coordValues);

    // Update constraint state (these are the "match flags" SE-08 references)
    c.lastMatched = matched;
    if (matched) {
      matchedCount++;
      c.uses = (c.uses | 0) + 1;
      c.lastUsed = field.step | 0;
      // Track latest match per property (cascade override semantics)
      if (c.emit && c.emit.property) {
        latestMatchByProp[c.emit.property] = c;
      }
      // M5: trace fires on match-flag flip from false to true
      if (!wasMatched && Trace) {
        Trace.append("er", "cascade-match", null,
          c.id + " -> " + c.emit.property + "=" + JSON.stringify(c.emit.value));
      }
    } else {
      // M5: trace fires on flip from true to false
      if (wasMatched && Trace) {
        Trace.append("er", "cascade-unmatch", null, c.id);
      }
    }
  }

  // Surface the resolved --next-op as field state for CT sampling.
  // Using a dedicated field property (field.cascadeOutput) per the
  // contract sec 3 "the cascade's --next-op is field state".
  if (!field.cascadeOutput) {
    field.cascadeOutput = {};
  }
  let currentNextOp = null;
  for (const prop of Object.keys(latestMatchByProp)) {
    const c = latestMatchByProp[prop];
    field.cascadeOutput[prop] = {
      value: c.emit.value,
      sourceConstraintId: c.id,
      atStep: field.step | 0
    };
    if (prop === "--next-op") {
      currentNextOp = c.emit.value;
    }
  }
  // Clear any previously-resolved properties no longer matched
  for (const prop of Object.keys(field.cascadeOutput)) {
    if (!latestMatchByProp[prop]) {
      delete field.cascadeOutput[prop];
    }
  }

  return {
    matchedCount: matchedCount,
    evaluatedCount: evaluatedCount,
    currentNextOp: currentNextOp,
    coordSnapshot: coordValues
  };
}

// ============================================================================
// matchConstraintWithoutGeometry
// ============================================================================
//
// Match logic for runtime evaluation - no geometry available (the
// kernel runtime doesn't carry the pre-computed geometry; geometry is
// a S2-verification artifact). Distinguishes presence-only attrs ("*")
// from value-tested attrs.
//
// Per the synthesizer convention:
//   selector["data-substrate-state"] = "*"   - presence-only marker
//   selector["data-trigger"] = "toggle"      - value test
//
// At runtime, presence-only attrs are always-true: the deposition's
// state element always has them set (per Phase 7 emission).
// ============================================================================

function matchConstraintWithoutGeometry(constraint, coordValues) {
  if (!constraint.pattern || constraint.pattern.type !== "cascade-match") {
    return false;
  }
  const sel = constraint.pattern.selector;
  for (const attr of Object.keys(sel)) {
    const required = sel[attr];
    const dimName = stripDataPrefix(attr);
    if (required === "*") {
      // Presence-only: the runtime treats this as always-true on a
      // state-element coord. The Phase 7 emission discipline guarantees
      // this attribute is present on the state element.
      continue;
    }
    const actual = coordValues[dimName];
    if (actual !== required) return false;
  }
  return true;
}

function stripDataPrefix(attr) {
  if (typeof attr !== "string") return attr;
  if (attr.indexOf("data-") === 0) return attr.substring(5);
  return attr;
}

// ============================================================================
// Exports
// ============================================================================

const KernelCascadeEvaluator = Object.freeze({
  evaluateCascade: evaluateCascade,
  buildCoordSnapshotFromIntake: buildCoordSnapshotFromIntake,
  matchConstraintWithoutGeometry: matchConstraintWithoutGeometry,
  stripDataPrefix: stripDataPrefix
});

if (typeof module !== "undefined" && module.exports) {
  module.exports = KernelCascadeEvaluator;
} else {
  global.KernelCascadeEvaluator = KernelCascadeEvaluator;
}

})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));
