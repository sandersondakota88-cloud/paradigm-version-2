// css-subset-parser.js - Layer C1 - parse Phase 7 cascade rules

"use strict";

// ============================================================================
// Tokenizer
// ============================================================================

function tokenize(src) {
  const tokens = [];
  let i = 0;
  const n = src.length;

  while (i < n) {
    const c = src[i];

    // Whitespace
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }

    // Block comment /* ... */
    if (c === "/" && src[i+1] === "*") {
      const end = src.indexOf("*/", i+2);
      if (end < 0) throw new Error("css-subset-parser: unterminated block comment");
      i = end + 2;
      continue;
    }

    // Single-character punctuation
    if (c === "[" || c === "]" || c === "{" || c === "}" ||
        c === ":" || c === ";" || c === "=" || c === ",") {
      tokens.push({ type: "punct", value: c, pos: i });
      i++;
      continue;
    }

    // String literal "..."
    if (c === '"') {
      let j = i + 1;
      while (j < n && src[j] !== '"') {
        if (src[j] === "\\") j += 2;
        else j++;
      }
      if (j >= n) throw new Error("css-subset-parser: unterminated string at " + i);
      tokens.push({ type: "string", value: src.slice(i+1, j), pos: i });
      i = j + 1;
      continue;
    }

    // Identifier or value (CSS-style: --foo, foo-bar, foo)
    if ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z") ||
        c === "_" || c === "-") {
      let j = i;
      while (j < n) {
        const ch = src[j];
        if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") ||
            (ch >= "0" && ch <= "9") || ch === "_" || ch === "-") {
          j++;
        } else break;
      }
      tokens.push({ type: "ident", value: src.slice(i, j), pos: i });
      i = j;
      continue;
    }

    // Number (positive integer; negative not yet expected in this subset)
    if (c >= "0" && c <= "9") {
      let j = i;
      while (j < n && src[j] >= "0" && src[j] <= "9") j++;
      tokens.push({ type: "number", value: src.slice(i, j), pos: i });
      i = j;
      continue;
    }

    throw new Error("css-subset-parser: unexpected char '" + c + "' at " + i);
  }

  return tokens;
}

// ============================================================================
// Parser
// ============================================================================

function parseRules(src) {
  let tokens;
  try {
    tokens = tokenize(src);
  } catch (e) {
    return { rules: [], errors: [{ message: e.message, pos: -1 }] };
  }
  const rules = [];
  const errors = [];
  let i = 0;

  while (i < tokens.length) {
    // Skip stray semicolons
    if (tokens[i].type === "punct" && tokens[i].value === ";") {
      i++;
      continue;
    }

    try {
      const rule = parseRule(tokens, i);
      rules.push(rule.rule);
      i = rule.next;
    } catch (e) {
      // Recover: skip to next "}" and continue
      errors.push({
        message: e.message,
        pos: tokens[i] ? tokens[i].pos : -1
      });
      while (i < tokens.length &&
             !(tokens[i].type === "punct" && tokens[i].value === "}")) {
        i++;
      }
      if (i < tokens.length) i++;  // consume the }
    }
  }

  return { rules: rules, errors: errors };
}

function parseRule(tokens, start) {
  // selector { declarations }
  let i = start;
  const selectors = parseSelectorList(tokens, i);
  i = selectors.next;

  if (!isPunct(tokens[i], "{")) {
    throw new Error("expected '{' at token " + i);
  }
  i++;

  const decls = [];
  while (i < tokens.length && !isPunct(tokens[i], "}")) {
    const decl = parseDeclaration(tokens, i);
    decls.push(decl.decl);
    i = decl.next;
  }
  if (!isPunct(tokens[i], "}")) {
    throw new Error("unterminated rule");
  }
  i++;

  return {
    rule: {
      selectors: selectors.selectors,
      declarations: decls,
      raw: tokens.slice(start, i).map(t => t.value).join(" ")
    },
    next: i
  };
}

function parseSelectorList(tokens, start) {
  const selectors = [];
  let i = start;
  while (true) {
    const sel = parseCompoundSelector(tokens, i);
    selectors.push(sel.selector);
    i = sel.next;
    if (isPunct(tokens[i], ",")) {
      i++;
      continue;
    }
    break;
  }
  return { selectors: selectors, next: i };
}

function parseCompoundSelector(tokens, start) {
  // Compound selector: a sequence of simple selectors with no
  // combinators between them. Subset restriction: only attribute
  // selectors. We allow a leading "[..." with optional repeated
  // "[..." attributes.
  let i = start;
  const attributes = [];
  while (i < tokens.length && isPunct(tokens[i], "[")) {
    const attr = parseAttributeSelector(tokens, i);
    attributes.push(attr.attr);
    i = attr.next;
  }
  if (attributes.length === 0) {
    throw new Error("expected attribute selector at token " + start);
  }
  return {
    selector: {
      kind: "compound",
      attributes: attributes
    },
    next: i
  };
}

function parseAttributeSelector(tokens, start) {
  // [name] or [name="value"]
  let i = start;
  if (!isPunct(tokens[i], "[")) {
    throw new Error("expected '['");
  }
  i++;
  const nameTok = tokens[i];
  if (!nameTok || nameTok.type !== "ident") {
    throw new Error("expected attribute name");
  }
  const name = nameTok.value;
  i++;

  let value = null;
  if (isPunct(tokens[i], "=")) {
    i++;
    const valTok = tokens[i];
    if (valTok.type === "string") {
      value = valTok.value;
    } else if (valTok.type === "ident" || valTok.type === "number") {
      value = valTok.value;
    } else {
      throw new Error("expected attribute value at token " + i);
    }
    i++;
  } else if (isPunct(tokens[i], "~") || isPunct(tokens[i], "^") ||
             isPunct(tokens[i], "$") || isPunct(tokens[i], "*")) {
    // Out-of-subset attribute operator
    throw new Error("attribute operator '" + tokens[i].value +
                    "=' is out-of-subset");
  }

  if (!isPunct(tokens[i], "]")) {
    throw new Error("expected ']' at token " + i);
  }
  i++;

  return {
    attr: { name: name, value: value, hasValue: value !== null },
    next: i
  };
}

function parseDeclaration(tokens, start) {
  let i = start;
  const propTok = tokens[i];
  if (!propTok || propTok.type !== "ident") {
    throw new Error("expected property name");
  }
  const property = propTok.value;
  i++;

  if (!isPunct(tokens[i], ":")) {
    throw new Error("expected ':' after property '" + property + "'");
  }
  i++;

  // Value: a sequence of tokens until semicolon or close-brace.
  const valueTokens = [];
  while (i < tokens.length &&
         !isPunct(tokens[i], ";") && !isPunct(tokens[i], "}")) {
    valueTokens.push(tokens[i]);
    i++;
  }
  if (isPunct(tokens[i], ";")) i++;

  // For Phase 7, we expect a single string-literal value.
  let value = null;
  let valueKind = null;
  if (valueTokens.length === 1) {
    if (valueTokens[0].type === "string") {
      value = valueTokens[0].value;
      valueKind = "string";
    } else if (valueTokens[0].type === "ident") {
      value = valueTokens[0].value;
      valueKind = "ident";
    } else if (valueTokens[0].type === "number") {
      value = valueTokens[0].value;
      valueKind = "number";
    }
  }

  return {
    decl: {
      property: property,
      valueRaw: valueTokens.map(t => t.value).join(" "),
      value: value,
      valueKind: valueKind
    },
    next: i
  };
}

function isPunct(tok, ch) {
  return tok && tok.type === "punct" && tok.value === ch;
}

// ============================================================================
// Subset validation
// ============================================================================
//
// Walks the parsed rules and flags each as in-subset or out-of-subset
// for WGSL emission. Reasons are recorded so the migration tool can
// surface them in coverage reports.
// ============================================================================

function validateSubset(rules) {
  const inSubset = [];
  const outOfSubset = [];

  for (const rule of rules) {
    const issues = [];

    // Selector validation: we accept only single compound selectors
    // (no comma-separated lists with different shapes), and each
    // attribute must have a string/ident value.
    if (rule.selectors.length !== 1) {
      issues.push("multiple comma-separated selectors not yet supported");
    }
    const sel = rule.selectors[0];
    if (sel && sel.kind === "compound") {
      for (const attr of sel.attributes) {
        // It's OK to have a bare attribute (selector-presence check),
        // but the subset commits to value-equality matches; the
        // value-less form is allowed but only for [data-substrate-state]
        // (which is presence-only, treated as a constant True).
        if (!attr.hasValue && attr.name !== "data-substrate-state") {
          issues.push("attribute '[" + attr.name + "]' has no value " +
                      "(presence-only selector)");
        }
        if (attr.hasValue && typeof attr.value !== "string") {
          issues.push("attribute value not a string");
        }
      }
    }

    // Declaration validation: each declaration must be a CSS custom
    // property (starts with --). Phase 7 emitted only --next-op /
    // --next-target / --reg / --rt; Phase 8 P-layers extend this to
    // arbitrary custom properties (validity outputs like --name-valid,
    // form-aggregate outputs like --form-validity, field errors like
    // --field-error). Custom properties are the canonical shape cascade
    // rules emit; restricting to specific names was Phase 7's scope, not
    // a structural constraint.
    for (const decl of rule.declarations) {
      if (typeof decl.property !== "string" ||
          decl.property.indexOf("--") !== 0) {
        issues.push("property '" + decl.property +
                    "' is not a CSS custom property (must start with '--')");
      }
      if (decl.valueKind !== "string") {
        issues.push("property '" + decl.property +
                    "' value is not a string literal");
      }
    }

    if (issues.length === 0) {
      inSubset.push(rule);
    } else {
      outOfSubset.push({ rule: rule, issues: issues });
    }
  }

  return { inSubset: inSubset, outOfSubset: outOfSubset };
}

// ============================================================================
// Exports
// ============================================================================

module.exports = Object.freeze({
  tokenize: tokenize,
  parseRules: parseRules,
  validateSubset: validateSubset
});
