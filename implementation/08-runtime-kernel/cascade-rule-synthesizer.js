// cascade-rule-synthesizer.js - CSS cascade rules -> kernel constraints

"use strict";

const Parser = require("./css-subset-parser.js");

// ============================================================================
// Synthesize one constraint from a parsed CSS rule
// ============================================================================
//
// Input: a parsed rule from css-subset-parser.js
// Output: a kernel constraint record per the contract
// ============================================================================

function synthesizeOne(parsedRule, idCounter) {
  if (!parsedRule || !parsedRule.selectors || parsedRule.selectors.length === 0) {
    throw new Error("synthesizeOne: rule has no selectors");
  }
  if (!parsedRule.declarations || parsedRule.declarations.length === 0) {
    throw new Error("synthesizeOne: rule has no declarations");
  }

  // Walk the selector's attributes to build the selector map
  const sel = parsedRule.selectors[0];
  const selectorMap = {};
  for (const attr of sel.attributes) {
    if (attr.hasValue) {
      selectorMap[attr.name] = attr.value;
    } else {
      // Presence-only attribute (no value test)
      selectorMap[attr.name] = "*";
    }
  }

  // Take the first declaration's property and value as the emit clause.
  // Phase 7 emits exactly one declaration per cascade rule (the --next-op
  // assignment for B2 bindings, for example), so this is the canonical case.
  // If a rule has multiple declarations, this synthesizer uses the first;
  // multi-declaration support is bounded engineering for later.
  const decl = parsedRule.declarations[0];

  return {
    id: "deposit::" + idCounter,
    kind: "derived",
    pattern: {
      type: "cascade-match",
      selector: selectorMap
    },
    emit: {
      property: decl.property,
      value: decl.value
    },
    birth: 0,
    lastUsed: 0,
    uses: 0,
    weight: 1.0,
    permanent: false
  };
}

// ============================================================================
// Synthesize all constraints from a CSS source
// ============================================================================

function synthesizeFromCss(cssSource) {
  const parsed = Parser.parseRules(cssSource);
  if (parsed.errors.length > 0) {
    return {
      ok: false,
      reason: "css parse errors",
      errors: parsed.errors,
      constraints: []
    };
  }
  const subset = Parser.validateSubset(parsed.rules);
  const constraints = [];
  for (let i = 0; i < subset.inSubset.length; i++) {
    constraints.push(synthesizeOne(subset.inSubset[i], i + 1));
  }
  return {
    ok: true,
    constraints: constraints,
    inSubsetCount: subset.inSubset.length,
    outOfSubsetCount: subset.outOfSubset.length,
    outOfSubsetRules: subset.outOfSubset
  };
}

// ============================================================================
// Synthesize from a list of pre-parsed rules
// ============================================================================

function synthesizeFromParsedRules(parsedRules) {
  const constraints = [];
  for (let i = 0; i < parsedRules.length; i++) {
    constraints.push(synthesizeOne(parsedRules[i], i + 1));
  }
  return {
    ok: true,
    constraints: constraints,
    inSubsetCount: parsedRules.length,
    outOfSubsetCount: 0,
    outOfSubsetRules: []
  };
}

// ============================================================================
// Inverse: stringify constraints back to CSS (for debugging / round-trip)
// ============================================================================
//
// Per S2: round-trip should produce byte-identical output through any
// substrate. This stringifier is the kernel substrate's emission of the
// same geometry the deposition's CSS substrate represents. They should
// match.
// ============================================================================

function stringifyOne(constraint) {
  if (!constraint || !constraint.pattern || constraint.pattern.type !== "cascade-match") {
    throw new Error("stringifyOne: not a cascade-match constraint");
  }
  const sel = constraint.pattern.selector;
  const parts = [];
  for (const attr of Object.keys(sel)) {
    if (sel[attr] === "*") {
      parts.push("[" + attr + "]");
    } else {
      parts.push("[" + attr + '="' + sel[attr] + '"]');
    }
  }
  return parts.join("") + " { " + constraint.emit.property + ": " +
    JSON.stringify(constraint.emit.value) + "; }";
}

function stringifyAll(constraints) {
  const lines = [];
  for (const c of constraints) {
    if (c.pattern && c.pattern.type === "cascade-match") {
      lines.push(stringifyOne(c));
    }
  }
  return lines.join("\n");
}

// ============================================================================
// Exports
// ============================================================================

module.exports = Object.freeze({
  synthesizeOne: synthesizeOne,
  synthesizeFromCss: synthesizeFromCss,
  synthesizeFromParsedRules: synthesizeFromParsedRules,
  stringifyOne: stringifyOne,
  stringifyAll: stringifyAll
});
