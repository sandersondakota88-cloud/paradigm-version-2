// corpus-adapter-css.js
// =============================================================================
// Phase 11 — CSS intake adapter. Browser-only.
//
// Per UTF Q2 sub-recognition 4: adapters wrap host-environment parsers and do
// not reimplement parsing. The browser's CSSOM (specifically
// CSSStyleSheet.cssRules) is the spec-authoritative CSS parser per the CSS
// Object Model spec (W3C/WHATWG). This adapter wraps it and emits per-rule
// + per-declaration intake records matching the same five-axis shape.
//
// Two record kinds per stylesheet:
//
//   1. selector records (one per selector in each rule's selector group)
//      - kind: "selector"
//      - kind_subtype: selector-fragment type (type/class/id/pseudo/attribute)
//      - text: the selector fragment text
//      - position_class: SELECTOR
//
//   2. declaration records (one per property declaration in each rule)
//      - kind: "declaration"
//      - kind_subtype: the CSS property name
//      - text: the value text
//      - position_class: DECLARATION
//
//   3. at-rule records for @media, @supports, @keyframes, @import, @charset
//      - kind: "at-rule"
//      - kind_subtype: rule name (media/supports/keyframes/import/charset)
//      - text: the prelude (e.g. "screen and (max-width: 600px)")
//      - position_class: AT_RULE
//
// Per Q2 sub-rec 4: we wrap the host's CSSStyleSheet, not reimplement parsing.
// Source injection happens via a detached <style> element so parsing runs but
// the rules are not applied to any rendered DOM.
// =============================================================================

"use strict";

(function (global) {

  const NEIGHBOR_WINDOW = 5;

  // ---------------------------------------------------------------------
  // Selector-fragment classification.
  // Per CSS Selectors Level 4 spec; we tag fragments by their leading
  // character/syntax. This is structural-shape classification, not authorial
  // interpretation.
  // ---------------------------------------------------------------------
  function _selectorFragmentType(fragment) {
    const f = fragment.trim();
    if (!f) return "empty";
    const c = f.charAt(0);
    if (c === "#") return "id";
    if (c === ".") return "class";
    if (c === "[") return "attribute";
    if (c === ":") return "pseudo";
    if (c === "*") return "universal";
    if (c === "&") return "nesting";
    if (/^[a-zA-Z]/.test(f)) return "type";
    return "other";
  }

  // Split a complex selector into its compound fragments. CSS Selectors L4
  // combinators: descendant (whitespace), child (>), adjacent sibling (+),
  // general sibling (~). We split on combinators and treat each compound
  // as a separate fragment record.
  function _splitSelector(selectorText) {
    // Replace combinators with single-space tokens then split.
    // This is approximate but spec-tracking: the CSSOM gives us already-
    // normalized selectorText (no comments, normalized whitespace).
    const parts = selectorText
      .replace(/\s*([>+~])\s*/g, " $1 ")
      .split(/\s+/)
      .filter(function (p) { return p && !/^[>+~]$/.test(p); });
    return parts;
  }

  // ---------------------------------------------------------------------
  // Walk parsed CSSRules in stylesheet order, emitting records.
  // ---------------------------------------------------------------------
  function _walkRules(rules, records, depth) {
    if (!rules) return;
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      const ruleType = rule.type;  // CSSRule type constants

      if (ruleType === 1 || rule.cssText && rule.style) {
        // CSSStyleRule
        const selectorText = rule.selectorText || "";
        // Each selector in the comma-separated list becomes its own record
        const selectors = selectorText.split(/\s*,\s*/);
        for (const sel of selectors) {
          // For each compound selector (separated by combinators), emit one
          // record so neighbor-window relations exist between fragments
          const fragments = _splitSelector(sel);
          for (const frag of fragments) {
            records.push(_makeRecord({
              kind: "selector",
              kind_subtype: _selectorFragmentType(frag),
              text: frag,
              position_class: "SELECTOR",
              depth: depth,
              full_selector: sel,
              rule_index: i
            }));
          }
        }
        // Then one record per declaration in the rule's style
        if (rule.style) {
          for (let j = 0; j < rule.style.length; j++) {
            const prop = rule.style[j];
            const val = rule.style.getPropertyValue(prop);
            records.push(_makeRecord({
              kind: "declaration",
              kind_subtype: prop,
              text: (val || "").trim().slice(0, 256),
              position_class: "DECLARATION",
              depth: depth,
              property: prop,
              rule_index: i,
              full_selector: selectorText
            }));
          }
        }
      } else if (ruleType === 3 || (rule.cssText && rule.cssText.indexOf("@import") === 0)) {
        records.push(_makeRecord({
          kind: "at-rule",
          kind_subtype: "import",
          text: rule.href || "",
          position_class: "AT_RULE",
          depth: depth,
          rule_index: i
        }));
      } else if (ruleType === 4 || (rule.media && rule.cssRules)) {
        // CSSMediaRule
        records.push(_makeRecord({
          kind: "at-rule",
          kind_subtype: "media",
          text: rule.media ? rule.media.mediaText : "",
          position_class: "AT_RULE",
          depth: depth,
          rule_index: i
        }));
        // Recurse into nested rules
        _walkRules(rule.cssRules, records, depth + 1);
      } else if (ruleType === 12 || (rule.conditionText && rule.cssRules)) {
        // CSSSupportsRule
        records.push(_makeRecord({
          kind: "at-rule",
          kind_subtype: "supports",
          text: rule.conditionText || "",
          position_class: "AT_RULE",
          depth: depth,
          rule_index: i
        }));
        _walkRules(rule.cssRules, records, depth + 1);
      } else if (ruleType === 7 || (rule.name && rule.cssRules)) {
        // CSSKeyframesRule
        records.push(_makeRecord({
          kind: "at-rule",
          kind_subtype: "keyframes",
          text: rule.name || "",
          position_class: "AT_RULE",
          depth: depth,
          rule_index: i
        }));
        // Each @keyframes selector (e.g. "0%", "100%") is a CSSKeyframeRule
        // with its own style block
        if (rule.cssRules) {
          for (let k = 0; k < rule.cssRules.length; k++) {
            const kr = rule.cssRules[k];
            records.push(_makeRecord({
              kind: "selector",
              kind_subtype: "keyframe-stop",
              text: kr.keyText || "",
              position_class: "SELECTOR",
              depth: depth + 1,
              rule_index: i
            }));
            if (kr.style) {
              for (let m = 0; m < kr.style.length; m++) {
                const prop = kr.style[m];
                records.push(_makeRecord({
                  kind: "declaration",
                  kind_subtype: prop,
                  text: (kr.style.getPropertyValue(prop) || "").trim().slice(0, 256),
                  position_class: "DECLARATION",
                  depth: depth + 1,
                  property: prop,
                  rule_index: i
                }));
              }
            }
          }
        }
      } else if (ruleType === 11 || (rule.name && !rule.cssRules)) {
        // CSSCounterStyleRule / CSSFontFaceRule / etc.
        records.push(_makeRecord({
          kind: "at-rule",
          kind_subtype: (rule.name || "other"),
          text: "",
          position_class: "AT_RULE",
          depth: depth,
          rule_index: i
        }));
      } else if (rule.cssText) {
        // Unknown rule type; emit a single at-rule record with the cssText
        // so the substrate still sees it
        records.push(_makeRecord({
          kind: "at-rule",
          kind_subtype: "unknown",
          text: rule.cssText.slice(0, 256),
          position_class: "AT_RULE",
          depth: depth,
          rule_index: i
        }));
      }
    }
  }

  function _makeRecord(spec) {
    return {
      index:           0,
      kind:            spec.kind,
      kind_subtype:    spec.kind_subtype,
      text:            spec.text,
      position_class:  spec.position_class,
      depth:           spec.depth || 0,
      property:        spec.property || null,
      full_selector:   spec.full_selector || null,
      rule_index:      spec.rule_index,
      neighbors_pre:   [],
      neighbors_post:  [],
      recurrence_kind:      0,
      recurrence_text:      0,
      recurrence_kind_text: 0
    };
  }

  // ---------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------
  function adaptCSS(source) {
    if (typeof source !== "string") {
      throw new TypeError("adaptCSS: source must be string");
    }
    if (typeof document === "undefined") {
      throw new Error("adaptCSS: requires browser DOM (document) for the CSSOM");
    }

    const records = [];
    const parseErrors = [];

    let sheet;
    let injected = null;
    try {
      // Browser host: inject source into a detached <style> element so the
      // host's CSS parser (CSSOM) parses it. Detached = not in any tree, so
      // the rules don't apply anywhere; we just want the parsed cssRules.
      injected = document.createElement("style");
      injected.textContent = source;
      // We DO need it in the document for sheet to be populated in some
      // browsers, so attach to head briefly then read.
      document.head.appendChild(injected);
      sheet = injected.sheet;
      if (!sheet) throw new Error("no sheet on injected <style>");
    } catch (e) {
      parseErrors.push({ phase: "parse", message: e.message, pos: -1 });
      if (injected && injected.parentNode) injected.parentNode.removeChild(injected);
      return {
        records: [],
        metadata: {
          total_records:  0,
          distinct_kinds: 0,
          distinct_texts: 0,
          parse_errors:   parseErrors
        }
      };
    }

    try {
      _walkRules(sheet.cssRules, records, 0);
    } catch (e) {
      parseErrors.push({ phase: "walk", message: e.message, pos: -1 });
    } finally {
      if (injected && injected.parentNode) injected.parentNode.removeChild(injected);
    }

    // Pass 2: index assignment
    for (let i = 0; i < records.length; i++) records[i].index = i;

    // Pass 3: neighbor windows
    for (let i = 0; i < records.length; i++) {
      const pre = [];
      const post = [];
      for (let j = Math.max(0, i - NEIGHBOR_WINDOW); j < i; j++) {
        pre.push({ index: records[j].index, kind: records[j].kind, text: records[j].text });
      }
      for (let j = i + 1; j < Math.min(records.length, i + 1 + NEIGHBOR_WINDOW); j++) {
        post.push({ index: records[j].index, kind: records[j].kind, text: records[j].text });
      }
      records[i].neighbors_pre = pre;
      records[i].neighbors_post = post;
    }

    // Pass 4: recurrence tallies
    const kindTally = Object.create(null);
    const textTally = Object.create(null);
    const ktTally   = Object.create(null);
    for (const r of records) {
      kindTally[r.kind] = (kindTally[r.kind] || 0) + 1;
      textTally[r.text] = (textTally[r.text] || 0) + 1;
      const kt = r.kind + "|" + r.text;
      ktTally[kt] = (ktTally[kt] || 0) + 1;
    }
    for (const r of records) {
      r.recurrence_kind      = kindTally[r.kind];
      r.recurrence_text      = textTally[r.text];
      r.recurrence_kind_text = ktTally[r.kind + "|" + r.text];
    }

    return {
      records: records,
      metadata: {
        total_records:  records.length,
        distinct_kinds: Object.keys(kindTally).length,
        distinct_texts: Object.keys(textTally).length,
        parse_errors:   parseErrors
      }
    };
  }

  // ---------------------------------------------------------------------
  // Module
  // ---------------------------------------------------------------------
  const CSSAdapter = Object.freeze({
    adaptCSS: adaptCSS
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = CSSAdapter;
  } else {
    global.CSSAdapter = CSSAdapter;
  }

})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));
