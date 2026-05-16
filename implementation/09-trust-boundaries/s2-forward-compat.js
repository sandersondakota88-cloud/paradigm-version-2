// s2-forward-compat.js - Phase 9 S2: forward-compatibility harness

"use strict";

const S1 = require("./s1-schema-projection.js");

// ----------------------------------------------------------------------------
// V5 schema additions (deployment-evolution example)
//
// Suppose v5 introduces:
//   data-record-tier        - same as v3 (compatible)
//   data-record-acquisition - new field: "inbound" | "outbound" | "referral"
//
// The acquisition coord doesn't affect tier or is-premium derivation;
// v5 projection rules pass tier/is-premium through (same as v3) and
// emit a new --derived-acquisition canonical coord.
//
// The v3 application cascade ignores --derived-acquisition (it
// doesn't know about it). A future v5+ application cascade matches
// against --derived-acquisition for richer behavior.
// ----------------------------------------------------------------------------
const REFERENCE_V5_PROJECTION_RULES = [
  // v5 native: tier and is-premium passthrough (same as v3)
  '[data-substrate-state][data-schema-version="v5"][data-record-tier="standard"] { --derived-tier: "standard"; --derived-is-premium: "0"; }',
  '[data-substrate-state][data-schema-version="v5"][data-record-tier="platinum"] { --derived-tier: "platinum"; --derived-is-premium: "1"; }',
  '[data-substrate-state][data-schema-version="v5"][data-record-tier="inactive"] { --derived-tier: "inactive"; --derived-is-premium: "0"; }',
  // v5 native: acquisition (new canonical coord)
  '[data-substrate-state][data-schema-version="v5"][data-record-acquisition="inbound"] { --derived-acquisition: "inbound"; }',
  '[data-substrate-state][data-schema-version="v5"][data-record-acquisition="outbound"] { --derived-acquisition: "outbound"; }',
  '[data-substrate-state][data-schema-version="v5"][data-record-acquisition="referral"] { --derived-acquisition: "referral"; }'
].join("\n");

// ----------------------------------------------------------------------------
// composeDeploymentRules - join multiple version-projection rule sets
// into a single composed cascade rule string.
//
// The composition is just string concatenation; the cascade
// evaluator handles ordering via specificity (per SE-01: "each
// cascade's ordering is local to itself"). Different versions emit
// to disjoint or shared canonical coords; specificity resolves
// conflicts at the cascade level if they arise (in practice they
// don't, because versions are partitioned by [data-schema-version]
// matching, which is mutually exclusive).
// ----------------------------------------------------------------------------
function composeDeploymentRules(ruleSetByVersion) {
  if (!ruleSetByVersion || typeof ruleSetByVersion !== "object") {
    throw new TypeError("composeDeploymentRules: object required");
  }
  const out = [];
  const versions = Object.keys(ruleSetByVersion).sort();
  for (const v of versions) {
    const rules = ruleSetByVersion[v];
    if (typeof rules !== "string") {
      throw new TypeError("composeDeploymentRules: rules for " + v +
        " must be string; got " + typeof rules);
    }
    out.push("/* === schema version: " + v + " === */");
    out.push(rules);
  }
  return out.join("\n");
}

// ----------------------------------------------------------------------------
// Reference deployment configurations
// ----------------------------------------------------------------------------

// Initial deployment: v1+v3 rules from S1
const DEPLOYMENT_INITIAL = S1.REFERENCE_PROJECTION_RULES;

// Evolved deployment: v1+v3+v5 (adds v5 rules)
const DEPLOYMENT_EVOLVED = composeDeploymentRules({
  "v1-v3": S1.REFERENCE_PROJECTION_RULES,
  "v5": REFERENCE_V5_PROJECTION_RULES
});

module.exports = Object.freeze({
  REFERENCE_V5_PROJECTION_RULES: REFERENCE_V5_PROJECTION_RULES,
  composeDeploymentRules: composeDeploymentRules,
  DEPLOYMENT_INITIAL: DEPLOYMENT_INITIAL,
  DEPLOYMENT_EVOLVED: DEPLOYMENT_EVOLVED
});
