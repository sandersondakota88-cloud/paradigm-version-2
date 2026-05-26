// corpus-adapter.js
// =============================================================================
// Phase 11 — Acorn-wrapping adapter that converts JavaScript source into
// a stream of per-token UTF intake records, one record per token, in
// source-order. Each record carries the five-axis information per
// adapter-spec.md §3.
//
// Per UTF Q2 sub-recognition 4: the adapter wraps the host parser
// (Acorn, a spec-faithful implementation of ECMA-262 parsing); it does
// not reimplement parsing.
//
// Per Phase 11 discipline (PLAN §2): adapter is intake-only. No
// interpretation. No aggregation beyond the corpus-wide recurrence
// tally. No substrate logic.
// =============================================================================

"use strict";

(function (global) {

  // Window size for co-occurrence neighborhood (per adapter-spec §3:
  // "±5 token window... captures local patterns like `if ( foo ) {`")
  const NEIGHBOR_WINDOW = 5;

  // Operator set for position-class classification (per spec §4)
  const OPERATOR_SET = new Set([
    "+", "-", "*", "/", "%", "**",
    "=", "+=", "-=", "*=", "/=", "%=", "**=",
    "==", "===", "!=", "!==", "<", ">", "<=", ">=",
    "&&", "||", "!", "??",
    "&", "|", "^", "~", "<<", ">>", ">>>",
    "&=", "|=", "^=", "<<=", ">>=", ">>>=",
    "??=", "&&=", "||=",
    "++", "--", "...", "?.", "=>"
  ]);

  const DELIM_SET = new Set(["{", "}", "[", "]", "(", ")", ",", ";", ":"]);

  const CTRL_KEYWORDS = new Set([
    "if", "else", "for", "while", "do", "switch", "case", "default",
    "break", "continue", "return", "throw", "try", "catch", "finally"
  ]);

  const TYPE_KEYWORDS = new Set(["typeof", "instanceof", "in", "of"]);

  // ---------------------------------------------------------------------
  // Adapt JS source -> TokenIntakeStream
  // ---------------------------------------------------------------------

  function adaptCorpus(source, acornModule) {
    if (typeof source !== "string") {
      throw new TypeError("adaptCorpus: source must be string");
    }
    if (!acornModule || typeof acornModule.tokenizer !== "function") {
      throw new TypeError("adaptCorpus: acornModule with tokenizer required");
    }

    // ---- Pass 1: tokenize ----
    const tokens = [];
    const parseErrors = [];
    try {
      const tokenIter = acornModule.tokenizer(source, {
        ecmaVersion: "latest",
        sourceType: "module"  // allow import/export and top-level await
      });
      let idx = 0;
      for (const t of tokenIter) {
        if (t.type.label === "eof") continue;
        tokens.push({
          index: idx++,
          source_range: [t.start, t.end],
          kind: _kindOf(t),
          kind_subtype: _kindSubtypeOf(t),
          text: _textOf(t, source),
          position_class: "OTHER",  // filled in pass 2
          neighbors_pre: [],         // filled in pass 3
          neighbors_post: [],        // filled in pass 3
          recurrence_kind: 0,        // filled in pass 4
          recurrence_text: 0,        // filled in pass 4
          recurrence_kind_text: 0    // filled in pass 4
        });
      }
    } catch (e) {
      parseErrors.push({ phase: "tokenize", message: e.message, pos: e.pos });
    }

    // ---- Pass 2: parse + walk AST for position_class ----
    if (typeof acornModule.parse === "function") {
      try {
        const ast = acornModule.parse(source, {
          ecmaVersion: "latest",
          sourceType: "module",
          ranges: true,
          locations: false
        });
        _walkAndClassify(ast, tokens);
      } catch (e) {
        parseErrors.push({ phase: "parse", message: e.message, pos: e.pos });
      }
    }

    // After AST walk, classify any tokens still tagged OTHER by their
    // text/kind alone (keywords, operators, delimiters).
    for (const tok of tokens) {
      if (tok.position_class !== "OTHER") continue;
      if (CTRL_KEYWORDS.has(tok.text)) tok.position_class = "CTRL";
      else if (TYPE_KEYWORDS.has(tok.text)) tok.position_class = "TYPE";
      else if (DELIM_SET.has(tok.text)) tok.position_class = "DELIM";
      else if (OPERATOR_SET.has(tok.text)) tok.position_class = "OP";
    }

    // ---- Pass 3: neighbor windows ----
    for (let i = 0; i < tokens.length; i++) {
      const pre = [];
      const post = [];
      for (let j = Math.max(0, i - NEIGHBOR_WINDOW); j < i; j++) {
        pre.push({ index: tokens[j].index, kind: tokens[j].kind, text: tokens[j].text });
      }
      for (let j = i + 1; j < Math.min(tokens.length, i + 1 + NEIGHBOR_WINDOW); j++) {
        post.push({ index: tokens[j].index, kind: tokens[j].kind, text: tokens[j].text });
      }
      tokens[i].neighbors_pre = pre;
      tokens[i].neighbors_post = post;
    }

    // ---- Pass 4: corpus-wide recurrence tallies ----
    const kindTally = Object.create(null);
    const textTally = Object.create(null);
    const kindTextTally = Object.create(null);
    for (const tok of tokens) {
      kindTally[tok.kind] = (kindTally[tok.kind] || 0) + 1;
      textTally[tok.text] = (textTally[tok.text] || 0) + 1;
      const kt = tok.kind + "|" + tok.text;
      kindTextTally[kt] = (kindTextTally[kt] || 0) + 1;
    }
    for (const tok of tokens) {
      tok.recurrence_kind = kindTally[tok.kind];
      tok.recurrence_text = textTally[tok.text];
      tok.recurrence_kind_text = kindTextTally[tok.kind + "|" + tok.text];
    }

    // Distinct counts for metadata
    const distinctTexts = Object.keys(textTally).length;
    const distinctKinds = Object.keys(kindTally).length;

    return {
      records: tokens,
      metadata: {
        total_tokens: tokens.length,
        distinct_texts: distinctTexts,
        distinct_kinds: distinctKinds,
        parse_errors: parseErrors
      }
    };
  }

  // ---------------------------------------------------------------------
  // Helpers — Acorn token type -> our kind/kind_subtype/text
  // ---------------------------------------------------------------------

  function _kindOf(t) {
    const label = t.type.label;
    // Identifiers
    if (label === "name") return "ident";
    // Numbers
    if (label === "num") return "number";
    // Strings
    if (label === "string") return "string";
    // Template strings (parts)
    if (label === "template" || label === "`") return "template";
    // Regular expressions
    if (label === "regexp") return "regexp";
    // Privatized identifiers
    if (label === "privateId") return "ident";
    // Keywords (Acorn marks keywords with t.type.keyword)
    if (t.type.keyword) return "keyword";
    // Comments are not emitted by the tokenizer by default; handled
    // separately if onComment is wired. For Phase 2 smoke test, the
    // tokenizer's default behavior (skip comments) is acceptable.
    // EOF already filtered upstream.
    // Everything else: punctuation/operator/delimiter — single category
    // here, distinguished by kind_subtype.
    return "punctuation";
  }

  function _kindSubtypeOf(t) {
    if (t.type.keyword) return t.type.keyword;
    if (t.type.label === "name") return "";
    if (t.type.label === "num") return "";
    if (t.type.label === "string") return "";
    return t.type.label;
  }

  function _textOf(t, source) {
    // For strings/numbers/regexps/templates, t.value is the parsed value.
    // For identifiers, t.value is the name string.
    // For punctuation/keywords, t.value is undefined and the literal text
    // is at source[t.start:t.end].
    if (t.value !== undefined && t.value !== null) {
      // Strings come back without quotes; numbers as numbers; convert all
      // to string for axis-2 vocabulary observation.
      return String(t.value);
    }
    return source.substring(t.start, t.end);
  }

  // ---------------------------------------------------------------------
  // AST walk for position_class
  // ---------------------------------------------------------------------

  // Build an index from source position -> token index so AST walking
  // can map node ranges back to specific tokens.
  function _buildPosToTokenIndex(tokens) {
    const startIdx = new Map();
    for (let i = 0; i < tokens.length; i++) {
      startIdx.set(tokens[i].source_range[0], i);
    }
    return startIdx;
  }

  function _findTokenAtRange(startMap, range) {
    return startMap.get(range[0]);
  }

  function _classifyToken(tokens, idx, cls) {
    if (idx === undefined || idx < 0 || idx >= tokens.length) return;
    // Don't overwrite if already classified (first walk wins)
    if (tokens[idx].position_class === "OTHER") {
      tokens[idx].position_class = cls;
    }
  }

  function _walkAndClassify(ast, tokens) {
    const posMap = _buildPosToTokenIndex(tokens);

    function visit(node) {
      if (!node || typeof node !== "object") return;
      const type = node.type;
      if (!type) return;

      // ---- Classification by node type ----
      switch (type) {
        case "VariableDeclarator":
          if (node.id) _classifyId(node.id, posMap, tokens, "DECL");
          break;
        case "FunctionDeclaration":
        case "FunctionExpression":
        case "ClassDeclaration":
        case "ClassExpression":
          if (node.id) _classifyId(node.id, posMap, tokens, "DECL");
          if (node.params) {
            for (const p of node.params) _classifyId(p, posMap, tokens, "DECL");
          }
          break;
        case "ArrowFunctionExpression":
          if (node.params) {
            for (const p of node.params) _classifyId(p, posMap, tokens, "DECL");
          }
          break;
        case "CallExpression":
          if (node.callee && node.callee.type === "Identifier") {
            const idx = _findTokenAtRange(posMap, node.callee.range);
            _classifyToken(tokens, idx, "CALLEE");
          }
          break;
        case "MemberExpression":
          if (node.property) {
            const idx = _findTokenAtRange(posMap, node.property.range);
            _classifyToken(tokens, idx, "ATTR");
          }
          break;
        case "Property":
          if (node.key) {
            const idx = _findTokenAtRange(posMap, node.key.range);
            _classifyToken(tokens, idx, "KEY");
          }
          break;
        case "Literal":
          if (typeof node.value === "string" && node.range) {
            // Mark the token at this range as STR. Could be one or more
            // tokens for the literal itself (just the string token).
            const idx = _findTokenAtRange(posMap, node.range);
            _classifyToken(tokens, idx, "STR");
          }
          break;
        case "Identifier":
          // Generic identifier use site if not already classified
          if (node.range) {
            const idx = _findTokenAtRange(posMap, node.range);
            _classifyToken(tokens, idx, "USE");
          }
          break;
      }

      // ---- Recurse into children ----
      for (const key in node) {
        if (key === "type" || key === "range" || key === "loc" ||
            key === "start" || key === "end") continue;
        const child = node[key];
        if (Array.isArray(child)) {
          for (const c of child) visit(c);
        } else if (child && typeof child === "object") {
          visit(child);
        }
      }
    }

    function _classifyId(idNode, posMap, tokens, cls) {
      if (!idNode || !idNode.range) return;
      // Pattern nodes (ObjectPattern, ArrayPattern, RestElement, etc.)
      // contain nested identifiers; recurse if not a plain Identifier.
      if (idNode.type === "Identifier") {
        const idx = _findTokenAtRange(posMap, idNode.range);
        _classifyToken(tokens, idx, cls);
      } else if (idNode.type === "AssignmentPattern" && idNode.left) {
        _classifyId(idNode.left, posMap, tokens, cls);
      } else if (idNode.type === "RestElement" && idNode.argument) {
        _classifyId(idNode.argument, posMap, tokens, cls);
      } else if (idNode.type === "ObjectPattern" && idNode.properties) {
        for (const p of idNode.properties) {
          if (p.type === "Property" && p.value) _classifyId(p.value, posMap, tokens, cls);
          else if (p.type === "RestElement") _classifyId(p, posMap, tokens, cls);
        }
      } else if (idNode.type === "ArrayPattern" && idNode.elements) {
        for (const e of idNode.elements) if (e) _classifyId(e, posMap, tokens, cls);
      }
    }

    visit(ast);
  }

  // ---------------------------------------------------------------------
  // Module
  // ---------------------------------------------------------------------

  const CorpusAdapter = Object.freeze({
    adaptCorpus: adaptCorpus
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = CorpusAdapter;
  } else {
    global.CorpusAdapter = CorpusAdapter;
  }

})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));
