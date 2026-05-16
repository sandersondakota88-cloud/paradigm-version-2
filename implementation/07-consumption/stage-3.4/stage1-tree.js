// stage1-tree.js - tree-based Stage 1 for the substrate stack

"use strict";

const M1Row = require("./stage1-lexical-typing-substrate.js");

// ============================================================================
// Constants
// ============================================================================

const VERSION = "stage1-tree-1.0.0";

// HTML5 void elements (no closing tag, no content)
const VOID_ELEMENTS = Object.freeze({
  "area": 1, "base": 1, "br": 1, "col": 1, "embed": 1, "hr": 1,
  "img": 1, "input": 1, "link": 1, "meta": 1, "param": 1,
  "source": 1, "track": 1, "wbr": 1
});

// Elements whose content is raw text (not parsed as HTML)
const RAW_TEXT_ELEMENTS = Object.freeze({
  "script": 1, "style": 1
});

// Bounds (I5)
const MAX_NODES_DEFAULT = 65536;
const MAX_DEPTH_DEFAULT = 256;
const MAX_ATTR_LENGTH = 65536;
const MAX_TEXT_NODE_LENGTH = 1048576;  // 1 MiB

// Node kinds in the substrate's tree
const NODE_KINDS = Object.freeze({
  ROOT:     "ROOT",       // synthesized root
  DOCTYPE:  "DOCTYPE",    // <!DOCTYPE html>
  ELEMENT:  "ELEMENT",    // <tagname ...>...</tagname>
  TEXT:     "TEXT",       // textual content between elements
  COMMENT:  "COMMENT",    // <!-- ... -->
  ATTRIBUTE:"ATTRIBUTE",  // attribute on an element (modeled as child)
  SCRIPT_CONTENT: "SCRIPT_CONTENT",  // inside <script> - has token rows
  STYLE_CONTENT:  "STYLE_CONTENT"    // inside <style> - raw text for now
});

// ============================================================================
// Helpers (I1, validation)
// ============================================================================

function asciiOnly(s) {
  if (typeof s !== "string") return false;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x09 || (c > 0x0D && c < 0x20) || c > 0x7E) return false;
  }
  return true;
}

function requireFiniteInt(v, name) {
  if (typeof v !== "number" || !Number.isFinite(v) || Math.floor(v) !== v) {
    throw new TypeError(name + " must be finite int");
  }
  return v;
}

// ============================================================================
// Tree node factory
// ============================================================================

let _nextNodeId = 1;

function makeNode(kind, parent, opts) {
  opts = opts || {};
  const node = {
    id: _nextNodeId++,
    kind: kind,
    parent: parent,
    siblingIdx: parent ? parent.children.length : 0,
    depth: parent ? parent.depth + 1 : 0,
    name: opts.name || null,
    text: opts.text || null,           // for TEXT, COMMENT, STYLE_CONTENT
    rows: opts.rows || null,           // for SCRIPT_CONTENT (token rows)
    attrs: opts.attrs || null,         // for ELEMENT (array of {name, value, start, end})
    start: opts.start !== undefined ? opts.start : -1,
    end: opts.end !== undefined ? opts.end : -1,
    children: []
  };
  if (parent) parent.children.push(node);
  return node;
}

function freezeTree(node) {
  // Freeze node and all descendants. Done after parsing completes
  // (F5: emissions deposit irreversibly).
  Object.freeze(node.children);
  for (const c of node.children) freezeTree(c);
  if (node.attrs) {
    for (const a of node.attrs) Object.freeze(a);
    Object.freeze(node.attrs);
  }
  if (node.rows) {
    for (const r of node.rows) Object.freeze(r);
    Object.freeze(node.rows);
  }
  Object.freeze(node);
}

// ============================================================================
// HTML5 parser (minimal, well-formed input only)
// ============================================================================

function createParser(opts) {
  opts = opts || {};
  const maxNodes = requireFiniteInt(opts.maxNodes || MAX_NODES_DEFAULT, "maxNodes");
  const maxDepth = requireFiniteInt(opts.maxDepth || MAX_DEPTH_DEFAULT, "maxDepth");
  const runRowTokenizer = opts.runRowTokenizer !== false;

  return {
    parse: function (source) {
      if (typeof source !== "string") throw new TypeError("source must be string");
      if (!asciiOnly(source)) {
        // Non-ASCII can be tolerated by passing-through; we strip nothing,
        // we just record the violation. For now: refuse to maintain I1.
        throw new Error("Stage 1 tree parser requires ASCII input (I1)");
      }
      _nextNodeId = 1;
      const root = makeNode(NODE_KINDS.ROOT, null, {
        name: "ROOT", start: 0, end: source.length
      });
      let nodeCount = 1;

      let i = 0;
      const stack = [root];
      const len = source.length;

      function top() { return stack[stack.length - 1]; }
      function checkBounds() {
        if (nodeCount >= maxNodes) {
          throw new Error("max node count exceeded (" + maxNodes + ")");
        }
        if (top().depth >= maxDepth) {
          throw new Error("max depth exceeded (" + maxDepth + ")");
        }
      }

      // Skip a single LF or CR or CRLF starting at idx; return new idx
      function skipLineBreak(idx) {
        if (idx >= len) return idx;
        const c = source.charCodeAt(idx);
        if (c === 0x0A) return idx + 1;
        if (c === 0x0D) {
          if (idx + 1 < len && source.charCodeAt(idx + 1) === 0x0A) return idx + 2;
          return idx + 1;
        }
        return idx;
      }

      function parseDoctype(start) {
        // <!DOCTYPE ...>
        const end = source.indexOf(">", start);
        if (end < 0) throw new Error("Unterminated DOCTYPE at " + start);
        checkBounds();
        makeNode(NODE_KINDS.DOCTYPE, top(), {
          text: source.substring(start, end + 1),
          start: start, end: end + 1
        });
        nodeCount++;
        return end + 1;
      }

      function parseComment(start) {
        // <!-- ... -->
        const end = source.indexOf("-->", start + 4);
        if (end < 0) throw new Error("Unterminated comment at " + start);
        checkBounds();
        makeNode(NODE_KINDS.COMMENT, top(), {
          text: source.substring(start + 4, end),
          start: start, end: end + 3
        });
        nodeCount++;
        return end + 3;
      }

      function parseAttributes(s, e) {
        // s..e is the attribute region inside an opening tag (after the
        // tag name, before the closing > or /> ).
        const attrs = [];
        let p = s;
        while (p < e) {
          // Skip whitespace
          while (p < e && /\s/.test(source.charAt(p))) p++;
          if (p >= e) break;
          // Read attribute name
          const nameStart = p;
          while (p < e && !/[\s=>/]/.test(source.charAt(p))) p++;
          if (p === nameStart) break;
          const name = source.substring(nameStart, p).toLowerCase();
          // Skip whitespace
          while (p < e && /\s/.test(source.charAt(p))) p++;
          let value = "";
          let valStart = -1, valEnd = -1;
          if (p < e && source.charAt(p) === "=") {
            p++;
            while (p < e && /\s/.test(source.charAt(p))) p++;
            if (p < e && (source.charAt(p) === "\"" || source.charAt(p) === "'")) {
              const quote = source.charAt(p);
              p++;
              valStart = p;
              while (p < e && source.charAt(p) !== quote) p++;
              valEnd = p;
              value = source.substring(valStart, valEnd);
              if (p < e) p++;  // skip closing quote
            } else {
              valStart = p;
              while (p < e && !/[\s>]/.test(source.charAt(p))) p++;
              valEnd = p;
              value = source.substring(valStart, valEnd);
            }
          }
          if (value.length > MAX_ATTR_LENGTH) {
            throw new Error("attribute value too long: " + name);
          }
          attrs.push({
            name: name, value: value,
            start: nameStart, end: p
          });
        }
        return attrs;
      }

      function findTagEnd(start) {
        // Find the end of an opening tag. Have to handle quoted attribute
        // values that may contain '>'.
        let p = start + 1;
        while (p < len) {
          const c = source.charAt(p);
          if (c === "\"" || c === "'") {
            const close = source.indexOf(c, p + 1);
            if (close < 0) return -1;
            p = close + 1;
            continue;
          }
          if (c === ">") return p;
          p++;
        }
        return -1;
      }

      function parseOpenTag(start) {
        // <tagname attrs...> or <tagname attrs.../>
        const tagEnd = findTagEnd(start);
        if (tagEnd < 0) throw new Error("Unterminated tag at " + start);

        // Read tag name
        let p = start + 1;
        const nameStart = p;
        while (p < tagEnd && /[a-zA-Z0-9_:-]/.test(source.charAt(p))) p++;
        const tagName = source.substring(nameStart, p).toLowerCase();
        if (tagName.length === 0) {
          throw new Error("Empty tag name at " + start);
        }

        // Self-closing detection: trailing /
        let selfClosing = false;
        let attrEnd = tagEnd;
        if (source.charAt(tagEnd - 1) === "/") {
          selfClosing = true;
          attrEnd = tagEnd - 1;
        }

        // Parse attributes
        const attrs = parseAttributes(p, attrEnd);

        checkBounds();
        const elem = makeNode(NODE_KINDS.ELEMENT, top(), {
          name: tagName,
          attrs: attrs,
          start: start,
          end: tagEnd + 1
        });
        nodeCount++;

        // Add attribute nodes as children for substrate observation
        for (const a of attrs) {
          checkBounds();
          makeNode(NODE_KINDS.ATTRIBUTE, elem, {
            name: a.name, text: a.value,
            start: a.start, end: a.end
          });
          nodeCount++;
        }

        // If void or self-closing, don't push to stack
        if (VOID_ELEMENTS[tagName] || selfClosing) {
          return tagEnd + 1;
        }

        // Raw-text elements: capture content until matching close tag,
        // don't recurse into children
        if (RAW_TEXT_ELEMENTS[tagName]) {
          const closeTag = "</" + tagName;
          const contentStart = tagEnd + 1;
          // Find closing tag (case-insensitive)
          let contentEnd = -1;
          let scan = contentStart;
          while (scan < len) {
            const idx = source.toLowerCase().indexOf(closeTag, scan);
            if (idx < 0) break;
            const after = source.charAt(idx + closeTag.length);
            if (after === ">" || /\s/.test(after) || after === "/") {
              contentEnd = idx;
              break;
            }
            scan = idx + 1;
          }
          if (contentEnd < 0) {
            throw new Error("Unterminated " + tagName + " element starting at " + start);
          }
          const rawContent = source.substring(contentStart, contentEnd);
          if (rawContent.length > MAX_TEXT_NODE_LENGTH) {
            throw new Error("raw-text content too long for <" + tagName + ">");
          }

          if (tagName === "script" && runRowTokenizer) {
            // Run the row-based tokenizer on script content
            const rowSub = M1Row.createStage1Substrate({
              id: "tree-script-" + elem.id,
              rowCap: 65536
            });
            // The tokenizer expects bytes; pass UTF-8 buffer
            try {
              rowSub.ingest(Buffer.from(rawContent, "ascii"));
              const vsf = rowSub.emitVsf();
              const rows = parseVsfRows(vsf);
              checkBounds();
              makeNode(NODE_KINDS.SCRIPT_CONTENT, elem, {
                text: rawContent,
                rows: rows,
                start: contentStart, end: contentEnd
              });
              nodeCount++;
            } catch (e) {
              // If tokenizer fails, fall back to text content
              checkBounds();
              makeNode(NODE_KINDS.SCRIPT_CONTENT, elem, {
                text: rawContent, rows: [],
                start: contentStart, end: contentEnd
              });
              nodeCount++;
            }
          } else if (tagName === "style") {
            checkBounds();
            makeNode(NODE_KINDS.STYLE_CONTENT, elem, {
              text: rawContent,
              start: contentStart, end: contentEnd
            });
            nodeCount++;
          } else {
            checkBounds();
            makeNode(NODE_KINDS.TEXT, elem, {
              text: rawContent,
              start: contentStart, end: contentEnd
            });
            nodeCount++;
          }

          // Find the end of the close tag
          const closeEnd = source.indexOf(">", contentEnd);
          elem.end = closeEnd + 1;
          return closeEnd + 1;
        }

        // Regular element: push to stack and continue
        stack.push(elem);
        return tagEnd + 1;
      }

      function parseCloseTag(start) {
        // </tagname>
        const tagEnd = source.indexOf(">", start);
        if (tagEnd < 0) throw new Error("Unterminated close tag at " + start);
        let p = start + 2;
        while (p < tagEnd && /[a-zA-Z0-9_:-]/.test(source.charAt(p))) p++;
        const tagName = source.substring(start + 2, p).toLowerCase();

        // Pop the stack until we find a matching element. If none found,
        // treat as orphan close (skip).
        for (let s = stack.length - 1; s > 0; s--) {
          if (stack[s].name === tagName) {
            stack[s].end = tagEnd + 1;
            stack.length = s;
            return tagEnd + 1;
          }
        }
        return tagEnd + 1;
      }

      function parseTextNode(start, end) {
        if (end <= start) return;
        const text = source.substring(start, end);
        if (text.length > MAX_TEXT_NODE_LENGTH) {
          throw new Error("text node too long");
        }
        checkBounds();
        makeNode(NODE_KINDS.TEXT, top(), {
          text: text, start: start, end: end
        });
        nodeCount++;
      }

      // Main loop
      while (i < len) {
        if (source.charAt(i) === "<") {
          // Possible tag, comment, or DOCTYPE
          if (i + 4 < len && source.substring(i, i + 4) === "<!--") {
            i = parseComment(i);
            continue;
          }
          if (i + 9 < len && source.substring(i, i + 9).toLowerCase() === "<!doctype") {
            i = parseDoctype(i);
            continue;
          }
          if (i + 1 < len && source.charAt(i + 1) === "/") {
            i = parseCloseTag(i);
            continue;
          }
          if (i + 1 < len && /[a-zA-Z]/.test(source.charAt(i + 1))) {
            i = parseOpenTag(i);
            continue;
          }
          // < not starting a tag; treat as text
        }
        // Find next < and emit text node
        const next = source.indexOf("<", i);
        const textEnd = next < 0 ? len : next;
        // Trim whitespace-only text nodes (HTML treats them as ignorable
        // in most contexts; including them would balloon the tree)
        const textRaw = source.substring(i, textEnd);
        if (textRaw.trim().length > 0) {
          parseTextNode(i, textEnd);
        }
        i = textEnd;
      }

      // Freeze the tree (F5)
      freezeTree(root);

      return Object.freeze({
        version: VERSION,
        sourceBytes: source.length,
        nodeCount: nodeCount,
        root: root
      });
    }
  };
}

function parseVsfRows(vsfText) {
  const sepIdx = vsfText.indexOf("\n---\n");
  if (sepIdx < 0) return [];
  const body = vsfText.slice(sepIdx + 5);
  const lines = body.split("\n").filter(s => s.length > 0);
  const rows = [];
  for (const line of lines) {
    if (line.length > 4096) continue;
    const f = line.split("|");
    if (f.length < 6) continue;
    const start = parseInt(f[0], 10);
    const end = parseInt(f[1], 10);
    const kind = f[2];
    const text = f[4];
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (typeof kind !== "string" || kind.length === 0) continue;
    rows.push({ start: start, end: end, kind: kind, text: text || "" });
  }
  return rows;
}

// ============================================================================
// Tree traversal helpers
// ============================================================================

function walkTree(root, visitor) {
  function visit(node, depth) {
    visitor(node, depth);
    for (const c of node.children) visit(c, depth + 1);
  }
  visit(root, 0);
}

function findElements(root, tagName) {
  const out = [];
  walkTree(root, function (n) {
    if (n.kind === NODE_KINDS.ELEMENT && n.name === tagName) out.push(n);
  });
  return out;
}

function findScriptContent(root) {
  const out = [];
  walkTree(root, function (n) {
    if (n.kind === NODE_KINDS.SCRIPT_CONTENT) out.push(n);
  });
  return out;
}

function findStyleContent(root) {
  const out = [];
  walkTree(root, function (n) {
    if (n.kind === NODE_KINDS.STYLE_CONTENT) out.push(n);
  });
  return out;
}

function summarizeTree(root) {
  const counts = Object.create(null);
  let totalDepth = 0, maxDepth = 0, nodeCount = 0;
  walkTree(root, function (n, depth) {
    counts[n.kind] = (counts[n.kind] || 0) + 1;
    totalDepth += depth;
    if (depth > maxDepth) maxDepth = depth;
    nodeCount++;
  });
  return Object.freeze({
    nodeCount: nodeCount,
    maxDepth: maxDepth,
    avgDepth: nodeCount > 0 ? totalDepth / nodeCount : 0,
    countsByKind: Object.freeze(counts)
  });
}

// ============================================================================
// Exports
// ============================================================================

module.exports = Object.freeze({
  VERSION: VERSION,
  NODE_KINDS: NODE_KINDS,
  VOID_ELEMENTS: VOID_ELEMENTS,
  RAW_TEXT_ELEMENTS: RAW_TEXT_ELEMENTS,
  createParser: createParser,
  walkTree: walkTree,
  findElements: findElements,
  findScriptContent: findScriptContent,
  findStyleContent: findStyleContent,
  summarizeTree: summarizeTree,
  asciiOnly: asciiOnly,
  parseVsfRows: parseVsfRows
});
