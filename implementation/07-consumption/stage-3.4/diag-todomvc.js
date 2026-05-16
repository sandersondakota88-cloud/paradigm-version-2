"use strict";
const fs = require("fs");
const T = require("./stage1-tree.js");

const source = fs.readFileSync("./test-app-todomvc.html", "utf8");
const parser = T.createParser();
const tree = parser.parse(source);

const summary = T.summarizeTree(tree.root);
console.log("Tree summary:");
console.log("  nodes: " + summary.nodeCount);
console.log("  max depth: " + summary.maxDepth);
for (const k in summary.countsByKind) console.log("  " + k.padEnd(20) + ": " + summary.countsByKind[k]);

// Find all elements with id or data-* attributes - these are likely state-bearing
console.log("\nElements with id:");
T.walkTree(tree.root, function (n) {
  if (n.kind === "ELEMENT" && n.attrs) {
    const idAttr = n.attrs.find(a => a.name === "id");
    if (idAttr) console.log("  <" + n.name + " id=\"" + idAttr.value + "\">");
  }
});

console.log("\nElements with data-* attributes:");
T.walkTree(tree.root, function (n) {
  if (n.kind === "ELEMENT" && n.attrs) {
    const dataAttrs = n.attrs.filter(a => a.name.indexOf("data-") === 0);
    if (dataAttrs.length > 0) {
      const desc = dataAttrs.map(a => a.name + "=\"" + a.value + "\"").join(" ");
      console.log("  <" + n.name + " " + desc + ">");
    }
  }
});

// Look at the script content - what idents recur?
console.log("\nScript content tokens (top 20 idents by recurrence):");
const scripts = T.findScriptContent(tree.root);
for (const s of scripts) {
  const counts = {};
  for (const r of s.rows) {
    if (r.kind === "ALPHA_RUN" || r.kind === "IDENT") {
      counts[r.text] = (counts[r.text] || 0) + 1;
    }
  }
  const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
  for (const [name, n] of sorted.slice(0, 20)) {
    console.log("  " + n.toString().padStart(3) + "  " + name);
  }
}

// Look at top-level structural patterns in the script:
// function declarations (function fn(...) {})
// state object initialization (var state = { ... })
// event handler patterns (addEventListener)
// localStorage access
console.log("\nStructural patterns in script:");
const patterns = {
  "function declarations": /function\s+(\w+)\s*\(/g,
  "var declarations": /\bvar\s+(\w+)\s*=/g,
  "addEventListener calls": /addEventListener/g,
  "localStorage usage": /localStorage/g,
  "getElementById calls": /getElementById/g,
  "querySelector calls": /querySelector/g
};
const scriptText = scripts[0] ? scripts[0].text : "";
for (const [label, re] of Object.entries(patterns)) {
  const matches = scriptText.match(re) || [];
  console.log("  " + label.padEnd(28) + ": " + matches.length);
}
