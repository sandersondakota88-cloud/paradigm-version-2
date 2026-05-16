// stage3-tree-recognizer.js - tree-aware dimensional recognizer

"use strict";

const T = require("./stage1-tree.js");

// ============================================================================
// Helpers
// ============================================================================

function asciiOnly(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x09 || (c > 0x0D && c < 0x20) || c > 0x7E) return false;
  }
  return true;
}

function stripQuotes(s) {
  if (typeof s !== "string" || s.length < 2) return s;
  const f = s.charAt(0), l = s.charAt(s.length - 1);
  if ((f === "\"" && l === "\"") || (f === "'" && l === "'")) {
    return s.slice(1, -1);
  }
  return s;
}

function isCssIdent(s) {
  if (typeof s !== "string" || s.length === 0) return false;
  if (!asciiOnly(s)) return false;
  if (/^[0-9]/.test(s)) return false;
  return /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(s);
}

function isSafeAttrValue(s) {
  if (typeof s !== "string" || s.length === 0) return false;
  if (!asciiOnly(s)) return false;
  return /^[A-Za-z0-9_.-]{1,64}$/.test(s);
}

function cssEscapeString(raw) {
  let out = "\"";
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charAt(i);
    const cc = raw.charCodeAt(i);
    if (c === "\"" || c === "\\") {
      out += "\\" + c;
    } else if (cc < 0x20 || cc > 0x7E) {
      out += "\\" + cc.toString(16) + " ";
    } else {
      out += c;
    }
  }
  out += "\"";
  return out;
}

// ============================================================================
// Spatial cluster reconstruction within a script's row stream
// ============================================================================
//
// This is the same logic the row-based stage3-dimensional-recognizer.js
// uses for bracket-tracked clustering. It runs on the script subtree's
// rows[], producing clusters bounded to that script's content.
// ============================================================================

function reconstructSpatialClusters(rows) {
  const clusters = [];
  const stack = [];
  let lastNonWsIdent = null;

  function countOpens(text, ch) {
    let n = 0;
    for (let i = 0; i < text.length; i++) if (text.charAt(i) === ch) n++;
    return n;
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];

    if (r.kind === "PUNCT_OPEN") {
      const opens = countOpens(r.text, "{");
      for (let k = 0; k < opens; k++) {
        stack.push({
          depth: stack.length,
          openIdx: i,
          contextIdent: lastNonWsIdent,
          tokens: []
        });
      }
      continue;
    }

    if (r.kind === "PUNCT_CLOSE") {
      const closes = countOpens(r.text, "}");
      for (let k = 0; k < closes; k++) {
        if (stack.length > 0) {
          const cluster = stack.pop();
          cluster.closeIdx = i;
          clusters.push(cluster);
        }
      }
      continue;
    }

    if (stack.length > 0) {
      stack[stack.length - 1].tokens.push({
        kind: r.kind, text: r.text, idx: i,
        start: r.start, end: r.end
      });
    }

    if (r.kind === "ALPHA_RUN" || r.kind === "IDENT" || r.kind === "KEYWORD") {
      lastNonWsIdent = r.text;
    } else if (r.kind === "WHITESPACE" || r.kind === "PUNCT_OP") {
      // preserve
    } else if (r.kind === "PUNCT_SEP" && (r.text === ":" || r.text === ".")) {
      // preserve
    } else {
      lastNonWsIdent = null;
    }
  }

  return clusters;
}

// ============================================================================
// Dimension recognition
// ============================================================================

function recognizeDimensions(clusters) {
  const dimensions = [];
  for (const cl of clusters) {
    let nameValue = null;
    let valuesValues = [];
    let foundName = false, foundValues = false;

    for (let i = 0; i < cl.tokens.length; i++) {
      const t = cl.tokens[i];
      if ((t.kind === "ALPHA_RUN" || t.kind === "IDENT") && t.text === "name") {
        for (let j = i + 1; j < cl.tokens.length; j++) {
          if (cl.tokens[j].kind === "WHITESPACE") continue;
          if (cl.tokens[j].kind === "PUNCT_SEP" && cl.tokens[j].text === ":") continue;
          if (cl.tokens[j].kind === "STRING_DBL" || cl.tokens[j].kind === "STRING_SGL") {
            nameValue = stripQuotes(cl.tokens[j].text);
            foundName = true;
          }
          break;
        }
      }
      if ((t.kind === "ALPHA_RUN" || t.kind === "IDENT") && t.text === "values") {
        for (let j = i + 1; j < cl.tokens.length; j++) {
          const tt = cl.tokens[j];
          if (tt.kind === "STRING_DBL" || tt.kind === "STRING_SGL") {
            valuesValues.push(stripQuotes(tt.text));
          }
        }
        if (valuesValues.length > 0) foundValues = true;
        break;
      }
    }

    if (foundName && foundValues && nameValue && isCssIdent(nameValue)) {
      const validValues = valuesValues.filter(v => isSafeAttrValue(v));
      if (validValues.length === valuesValues.length && validValues.length > 0) {
        dimensions.push({
          name: nameValue,
          values: validValues,
          openIdx: cl.openIdx
        });
      }
    }
  }
  return dimensions;
}

// ============================================================================
// Constraint recognition
// ============================================================================

function recognizeConstraints(clusters, dimensions) {
  const dimensionNames = {};
  for (const d of dimensions) dimensionNames[d.name] = d.values;

  const knownOutputProperties = {
    "sdf": "number-or-int",
    "deny": "string",
    "reg": "ident",
    "rt": "ident",
    "rth": "number",
    "doc": "ident"
  };

  const constraints = [];

  for (const cl of clusters) {
    let hasWhen = false, hasThen = false;
    let whenIdx = -1, thenIdx = -1;
    for (let i = 0; i < cl.tokens.length; i++) {
      const t = cl.tokens[i];
      if ((t.kind === "ALPHA_RUN" || t.kind === "IDENT") && t.text === "when") {
        hasWhen = true;
        whenIdx = t.idx;
      }
      if ((t.kind === "ALPHA_RUN" || t.kind === "IDENT") && t.text === "then") {
        hasThen = true;
        thenIdx = t.idx;
      }
    }
    if (!hasWhen || !hasThen) continue;
    if (cl.closeIdx === undefined) continue;

    const directChildren = [];
    const candidates = clusters
      .filter(c => c.openIdx > cl.openIdx && c.closeIdx !== undefined && c.closeIdx < cl.closeIdx)
      .sort((a, b) => a.openIdx - b.openIdx);
    for (const cand of candidates) {
      let nested = false;
      for (const dc of directChildren) {
        if (cand.openIdx > dc.openIdx && cand.closeIdx < dc.closeIdx) {
          nested = true;
          break;
        }
      }
      if (!nested) directChildren.push(cand);
    }

    let whenCluster = null, thenCluster = null;
    for (const dc of directChildren) {
      if (whenCluster === null && dc.openIdx > whenIdx &&
          (thenIdx < 0 || dc.openIdx < thenIdx)) {
        whenCluster = dc;
      } else if (dc.openIdx > thenIdx) {
        if (thenCluster === null) thenCluster = dc;
      }
    }

    if (!whenCluster || !thenCluster) continue;

    const whenPairs = extractObjectPairs(whenCluster, dimensionNames);
    const thenPairs = extractThenPairs(thenCluster, knownOutputProperties);

    if (whenPairs.length === 0) continue;
    if (Object.keys(thenPairs).length === 0) continue;

    constraints.push({
      when: whenPairs,
      then: thenPairs,
      openIdx: cl.openIdx
    });
  }
  return constraints;
}

function extractObjectPairs(cluster, dimensionNames) {
  const pairs = [];
  for (let i = 0; i < cluster.tokens.length; i++) {
    const t = cluster.tokens[i];
    if (t.kind !== "ALPHA_RUN" && t.kind !== "IDENT") continue;
    const dim = t.text;
    if (!dimensionNames[dim]) continue;
    let j = i + 1;
    while (j < cluster.tokens.length && cluster.tokens[j].kind === "WHITESPACE") j++;
    if (j >= cluster.tokens.length) continue;
    if (cluster.tokens[j].kind !== "PUNCT_SEP" || cluster.tokens[j].text !== ":") continue;
    j++;
    while (j < cluster.tokens.length && cluster.tokens[j].kind === "WHITESPACE") j++;
    if (j >= cluster.tokens.length) continue;
    if (cluster.tokens[j].kind !== "STRING_DBL" && cluster.tokens[j].kind !== "STRING_SGL") continue;
    const value = stripQuotes(cluster.tokens[j].text);
    if (dimensionNames[dim].indexOf(value) < 0) continue;
    pairs.push({ dim: dim, value: value });
  }
  return pairs;
}

function extractThenPairs(cluster, knownOutputProperties) {
  const pairs = {};
  for (let i = 0; i < cluster.tokens.length; i++) {
    const t = cluster.tokens[i];
    if (t.kind !== "ALPHA_RUN" && t.kind !== "IDENT") continue;
    const prop = t.text;
    if (!knownOutputProperties[prop]) continue;
    let j = i + 1;
    while (j < cluster.tokens.length && cluster.tokens[j].kind === "WHITESPACE") j++;
    if (j >= cluster.tokens.length) continue;
    if (cluster.tokens[j].kind !== "PUNCT_SEP" || cluster.tokens[j].text !== ":") continue;
    j++;
    while (j < cluster.tokens.length && cluster.tokens[j].kind === "WHITESPACE") j++;
    if (j >= cluster.tokens.length) continue;
    const valTok = cluster.tokens[j];
    let value = null, valueType = null;
    if (valTok.kind === "STRING_DBL" || valTok.kind === "STRING_SGL") {
      value = stripQuotes(valTok.text);
      valueType = "string";
    } else if (valTok.kind === "DIGIT_RUN") {
      value = valTok.text;
      valueType = "number";
    } else if (valTok.kind === "ALPHA_RUN" || valTok.kind === "IDENT") {
      value = valTok.text;
      valueType = "ident";
    } else if (valTok.kind === "PUNCT_OP" && valTok.text === "-") {
      let k = j + 1;
      while (k < cluster.tokens.length && cluster.tokens[k].kind === "WHITESPACE") k++;
      if (k < cluster.tokens.length && cluster.tokens[k].kind === "DIGIT_RUN") {
        value = "-" + cluster.tokens[k].text;
        valueType = "number";
      }
    }
    if (value !== null) {
      pairs[prop] = { value: value, type: valueType };
    }
  }
  return pairs;
}

// ============================================================================
// CSS emission (matches the canonical's compileConstraint exactly)
// ============================================================================

function compileToCss(dimensions, constraints, opts) {
  opts = opts || {};
  const probeSelector = opts.probeSelector ||
    "#V-probe, #V-probe-container > div";

  const lines = [];
  lines.push("/* ========================================================");
  lines.push(" * Generated by Stage 3 tree-aware dimensional recognizer.");
  lines.push(" * Source: substrate's tree-bounded observation surface.");
  lines.push(" * Dimensions recognized: " + dimensions.length);
  lines.push(" * Constraints recognized: " + constraints.length);
  lines.push(" * ======================================================== */");
  lines.push("");

  lines.push(probeSelector + " {");
  lines.push("  --sdf: -1;");
  lines.push("  --deny: \"\";");
  lines.push("  --reg: VALID;");
  lines.push("  --rt: UNCLASSIFIED;");
  lines.push("  --rth: 0;");
  lines.push("  --doc: BASIC;");
  lines.push("}");
  lines.push("");

  const identProps = { "rt": true, "reg": true, "doc": true };
  const numberProps = { "sdf": true, "rth": true };

  for (const c of constraints) {
    const attrSel = c.when.map(w => '[data-' + w.dim + '="' + w.value + '"]').join("");
    const probeParts = probeSelector.split(",").map(s => s.trim());
    const fullSel = probeParts.map(p => p + attrSel).join(", ");
    lines.push(fullSel + " {");

    let sdfIsOne = false;
    for (const prop in c.then) {
      const v = c.then[prop];
      let cssValue;
      if (numberProps[prop]) {
        cssValue = String(v.value);
        if (prop === "sdf" && String(v.value) === "1") sdfIsOne = true;
      } else if (identProps[prop]) {
        if (isCssIdent(v.value)) {
          cssValue = v.value;
        } else {
          cssValue = cssEscapeString(String(v.value));
        }
      } else {
        cssValue = cssEscapeString(String(v.value));
      }
      lines.push("  --" + prop + ": " + cssValue + ";");
    }
    if (sdfIsOne) {
      lines.push("  --reg: DENIED;");
      lines.push("  --rth: 0;");
    }
    lines.push("}");
    lines.push("");
  }
  return lines.join("\n");
}

// ============================================================================
// Pipeline: parse source -> walk tree -> recognize per script -> emit CSS
// ============================================================================

function runStage3OnTree(source, opts) {
  opts = opts || {};
  const parser = T.createParser({ runRowTokenizer: true });
  const tree = parser.parse(source);
  const summary = T.summarizeTree(tree.root);

  const scripts = T.findScriptContent(tree.root);

  // Aggregate dimensions and constraints across all script subtrees.
  // Each script is observed independently; the union is what gets
  // emitted. (For the canonical there's exactly one script.)
  const allDimensions = [];
  const allConstraints = [];
  const perScript = [];

  for (const script of scripts) {
    if (!script.rows || script.rows.length === 0) continue;
    const clusters = reconstructSpatialClusters(script.rows);
    const dimensions = recognizeDimensions(clusters);
    const constraints = recognizeConstraints(clusters, dimensions);
    perScript.push({
      scriptId: script.id,
      scriptBytes: script.end - script.start,
      rowCount: script.rows.length,
      clusters: clusters.length,
      dimensions: dimensions.length,
      constraints: constraints.length
    });
    // Merge: dedupe dimensions by name, append unique constraints
    for (const d of dimensions) {
      if (!allDimensions.find(x => x.name === d.name)) allDimensions.push(d);
    }
    for (const c of constraints) allConstraints.push(c);
  }

  const css = compileToCss(allDimensions, allConstraints, opts);

  return Object.freeze({
    treeStats: summary,
    sourceBytes: source.length,
    scriptsFound: scripts.length,
    perScript: perScript,
    dimensions: allDimensions,
    constraints: allConstraints,
    css: css
  });
}

// ============================================================================
// Exports
// ============================================================================

module.exports = Object.freeze({
  runStage3OnTree: runStage3OnTree,
  reconstructSpatialClusters: reconstructSpatialClusters,
  recognizeDimensions: recognizeDimensions,
  recognizeConstraints: recognizeConstraints,
  compileToCss: compileToCss,
  asciiOnly: asciiOnly,
  isCssIdent: isCssIdent,
  cssEscapeString: cssEscapeString
});

// ============================================================================
// CLI
// ============================================================================

if (require.main === module) {
  const fs = require("fs");
  const sourcePath = process.argv[2] || "./canonical-source.html";
  const outputPath = process.argv[3] || "./stage3-canonical-tree.css";

  console.log("Stage 3 tree-aware recognizer");
  console.log("Source: " + sourcePath);
  console.log("");

  const source = fs.readFileSync(sourcePath, "utf8");
  const t0 = Date.now();
  const result = runStage3OnTree(source);
  const elapsed = Date.now() - t0;

  console.log("Source bytes:        " + result.sourceBytes);
  console.log("Tree nodes:          " + result.treeStats.nodeCount);
  console.log("Tree max depth:      " + result.treeStats.maxDepth);
  console.log("Scripts found:       " + result.scriptsFound);
  console.log("Total time:          " + elapsed + "ms");
  console.log("");

  for (const ps of result.perScript) {
    console.log("Script #" + ps.scriptId + ":");
    console.log("  bytes:       " + ps.scriptBytes);
    console.log("  token rows:  " + ps.rowCount);
    console.log("  clusters:    " + ps.clusters);
    console.log("  dimensions:  " + ps.dimensions);
    console.log("  constraints: " + ps.constraints);
  }
  console.log("");

  console.log("Dimensions recognized: " + result.dimensions.length);
  for (const d of result.dimensions) {
    console.log("  " + d.name + ": [" + d.values.join(", ") + "]");
  }
  console.log("");

  console.log("Constraints recognized: " + result.constraints.length);
  for (const c of result.constraints) {
    const wstr = c.when.map(w => w.dim + "=" + w.value).join(" AND ");
    const tstr = Object.keys(c.then).map(k => k + "=" + c.then[k].value).join(", ");
    console.log("  WHEN " + wstr);
    console.log("    THEN " + tstr);
  }
  console.log("");

  fs.writeFileSync(outputPath, result.css);
  console.log("CSS written to: " + outputPath + " (" + result.css.length + " bytes)");
  if (asciiOnly(result.css)) {
    console.log("CSS is ASCII clean (I1).");
  }
}
