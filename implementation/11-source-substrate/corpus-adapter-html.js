// corpus-adapter-html.js
// =============================================================================
// Phase 11 — HTML intake adapter. Browser-only.
//
// Per UTF Q2 sub-recognition 4: adapters wrap host-environment parsers and do
// not reimplement parsing. The browser's native DOMParser is the spec-
// authoritative HTML parser (HTML Living Standard / WHATWG). This adapter
// wraps DOMParser and emits per-node intake records matching the same
// five-axis shape the JS adapter produces.
//
// The substrate's peer specs read records by field name, not by host language
// — `record.kind`, `record.text`, `record.position_class`, etc. — so the same
// six peers can ingest HTML records alongside JS records without modification.
// This is the canon's stratification operating: one record shape, multiple
// host languages, peers blind to which.
//
// Public surface (mirrors corpus-adapter.js):
//
//   adaptHTML(source) -> NodeIntakeStream
//     records:  Array<HTMLIntakeRecord>   (one per significant node)
//     metadata: { total_records, distinct_kinds, distinct_texts, parse_errors }
//
// "Significant nodes" are: ELEMENT_NODE (1), TEXT_NODE (3 with non-whitespace
// content), ATTR_NODE (synthetic: one record per attribute on each element),
// COMMENT_NODE (8), DOCUMENT_TYPE_NODE (10). We skip pure whitespace text
// nodes since they don't carry structural signal.
//
// Per discipline §2.1 / O3: position_class names structural-shape roles,
// not semantic interpretations. ROOT/BRANCH/LEAF describe tree position;
// INTERACTIVE/STRUCTURAL/LANDMARK reflect the element's structural role per
// HTML spec, not authorial intent.
// =============================================================================

"use strict";

(function (global) {

  const NEIGHBOR_WINDOW = 5;

  // ---------------------------------------------------------------------
  // Structural-role classification per HTML Living Standard.
  // These are role categories the spec itself defines (or that follow
  // from spec-defined element semantics), not authorial interpretations.
  // ---------------------------------------------------------------------
  const STRUCTURAL_ELEMENTS = new Set([
    "html", "head", "body", "header", "footer", "main", "nav", "aside",
    "section", "article", "div", "span"
  ]);

  const INTERACTIVE_ELEMENTS = new Set([
    "input", "button", "select", "textarea", "form", "a", "label",
    "fieldset", "option", "details", "summary", "dialog"
  ]);

  const LANDMARK_ELEMENTS = new Set([
    "h1", "h2", "h3", "h4", "h5", "h6", "title"
  ]);

  const FLOW_ELEMENTS = new Set([
    "p", "ul", "ol", "li", "dl", "dt", "dd", "pre", "blockquote",
    "table", "tr", "td", "th", "img", "video", "audio", "canvas",
    "br", "hr"
  ]);

  function _positionClassForElement(tagName) {
    const t = tagName.toLowerCase();
    if (INTERACTIVE_ELEMENTS.has(t)) return "INTERACTIVE";
    if (LANDMARK_ELEMENTS.has(t))    return "LANDMARK";
    if (STRUCTURAL_ELEMENTS.has(t))  return "STRUCTURAL";
    if (FLOW_ELEMENTS.has(t))        return "FLOW";
    return "OTHER";
  }

  // ---------------------------------------------------------------------
  // Walk the parsed Document in source order, emitting records.
  // ---------------------------------------------------------------------
  function _walkDocument(doc, records) {
    // Doctype first if present
    if (doc.doctype) {
      records.push(_makeRecord({
        kind: "doctype",
        kind_subtype: doc.doctype.name || "",
        text: doc.doctype.name || "",
        position_class: "ROOT",
        depth: 0,
        tag: null,
        attrs: null
      }));
    }

    function visit(node, depth) {
      if (!node) return;
      const nt = node.nodeType;
      if (nt === 1) {  // ELEMENT_NODE
        const tag = node.tagName ? node.tagName.toLowerCase() : "";
        const hasChildren = node.childNodes && node.childNodes.length > 0;
        const positionClass = depth === 0 ? "ROOT" :
          (hasChildren ? _positionClassForElement(tag) : "LEAF");
        // Record the element itself
        records.push(_makeRecord({
          kind: "element",
          kind_subtype: tag,
          text: tag,
          position_class: positionClass,
          depth: depth,
          tag: tag,
          attrs: _attrSummary(node)
        }));
        // Then one record per attribute (so the substrate observes attrs
        // as first-class structural objects, not just as element metadata)
        if (node.attributes) {
          for (let i = 0; i < node.attributes.length; i++) {
            const a = node.attributes[i];
            records.push(_makeRecord({
              kind: "attribute",
              kind_subtype: a.name,
              text: a.value != null ? String(a.value) : "",
              position_class: "ATTR",
              depth: depth + 1,
              tag: tag,
              attrs: null,
              attr_name: a.name
            }));
          }
        }
        // Recurse into children
        if (node.childNodes) {
          for (let i = 0; i < node.childNodes.length; i++) {
            visit(node.childNodes[i], depth + 1);
          }
        }
      } else if (nt === 3) {  // TEXT_NODE
        const txt = node.nodeValue || "";
        if (/\S/.test(txt)) {
          records.push(_makeRecord({
            kind: "text",
            kind_subtype: "",
            text: txt.trim().slice(0, 256),
            position_class: "TEXT",
            depth: depth,
            tag: null,
            attrs: null
          }));
        }
      } else if (nt === 8) {  // COMMENT_NODE
        records.push(_makeRecord({
          kind: "comment",
          kind_subtype: "",
          text: (node.nodeValue || "").trim().slice(0, 256),
          position_class: "COMMENT",
          depth: depth,
          tag: null,
          attrs: null
        }));
      }
    }

    if (doc.documentElement) visit(doc.documentElement, 0);
    else if (doc.body) visit(doc.body, 0);
    else if (doc.firstChild) visit(doc.firstChild, 0);
  }

  function _attrSummary(node) {
    if (!node.attributes || node.attributes.length === 0) return null;
    const out = Object.create(null);
    for (let i = 0; i < node.attributes.length; i++) {
      const a = node.attributes[i];
      out[a.name] = a.value;
    }
    return out;
  }

  function _makeRecord(spec) {
    return {
      index:           0,  // assigned in second pass
      kind:            spec.kind,
      kind_subtype:    spec.kind_subtype,
      text:            spec.text,
      position_class:  spec.position_class,
      depth:           spec.depth,
      tag:             spec.tag,
      attr_name:       spec.attr_name || null,
      attrs:           spec.attrs,
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
  function adaptHTML(source) {
    if (typeof source !== "string") {
      throw new TypeError("adaptHTML: source must be string");
    }

    const records = [];
    const parseErrors = [];

    let doc;
    try {
      // Browser-only: DOMParser is the host's authoritative HTML parser.
      if (typeof DOMParser === "undefined") {
        throw new Error("DOMParser unavailable (this adapter is browser-only)");
      }
      const parser = new DOMParser();
      doc = parser.parseFromString(source, "text/html");
      // DOMParser reports errors as <parsererror> elements in the result
      const errs = doc.getElementsByTagName("parsererror");
      for (let i = 0; i < errs.length; i++) {
        parseErrors.push({ phase: "parse", message: errs[i].textContent || "parsererror", pos: -1 });
      }
    } catch (e) {
      parseErrors.push({ phase: "parse", message: e.message, pos: -1 });
      return {
        records: [],
        metadata: {
          total_records: 0,
          distinct_kinds: 0,
          distinct_texts: 0,
          parse_errors: parseErrors
        }
      };
    }

    // Pass 1: walk + emit
    _walkDocument(doc, records);

    // Pass 2: index assignment
    for (let i = 0; i < records.length; i++) records[i].index = i;

    // Pass 3: neighbor windows (per HTML doc-order siblings ± NEIGHBOR_WINDOW)
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

    // Pass 4: corpus-wide recurrence tallies
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
  const HTMLAdapter = Object.freeze({
    adaptHTML: adaptHTML
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = HTMLAdapter;
  } else {
    global.HTMLAdapter = HTMLAdapter;
  }

})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));
