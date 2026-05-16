// stage3-dimensional-recognizer.js - bridge from substrate surface to CSS

"use strict";

const fs = require("fs");
const M1 = require("./stage1-lexical-typing-substrate.js");
const M2 = require("./stage2-emergent-structural-substrate.js");
const Mid = require("./stage2-identifier-substrate.js");
const Msa = require("./stage2-string-analysis-substrate.js");

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

// CSS identifier validator (subset: letters, digits, -, _, must not start with digit)
function isCssIdent(s) {
  if (typeof s !== "string" || s.length === 0) return false;
  if (!asciiOnly(s)) return false;
  if (/^[0-9]/.test(s)) return false;
  return /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(s);
}

// Attribute selector value validator (matches the canonical's requireSafeAttrValue)
// Values inside [data-X='VALUE'] can start with digits because they're quoted.
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
// Recognition: read Stage 1 emission to extract spatial structure
// ============================================================================
//
// Stage 1 emits rows with start/end byte positions. We can use these to
// reconstruct spatial co-occurrence: which tokens are inside the same
// `{ ... }` block, which key-value pairs are adjacent, which `when:`
// and `then:` keys precede which object literals.
//
// This is reading Stage 1's surface, not parsing. We don't build an AST.
// We walk the row stream and collect bracket-depth context for each text-
// bearing token. Tokens at the same bracket depth and inside the same
// outer bracket form a spatial cluster.
// ============================================================================

function reconstructSpatialClusters(stage1Rows) {
  // Walk rows tracking bracket depth and recent context idents.
  //
  // IMPORTANT: Stage 1 combines adjacent open/close punctuation into single
  // tokens. A token like "([" is one PUNCT_OPEN row that opens both a paren
  // and a square bracket. We have to count brackets at the character level,
  // not the token level, but we still attribute tokens to clusters at the
  // token level.
  const clusters = [];
  const stack = [];  // stack of cluster contexts being assembled
  let lastNonWsIdent = null;

  function countOpens(text, ch) {
    let n = 0;
    for (let i = 0; i < text.length; i++) if (text.charAt(i) === ch) n++;
    return n;
  }

  for (let i = 0; i < stage1Rows.length; i++) {
    const r = stage1Rows[i];

    if (r.kind === "PUNCT_OPEN") {
      // Count how many "{" this token opens. Each "{" creates a new cluster.
      const opens = countOpens(r.text, "{");
      for (let k = 0; k < opens; k++) {
        stack.push({
          depth: stack.length,
          openIdx: i,
          contextIdent: lastNonWsIdent,
          tokens: []
        });
      }
      // (We don't track [ and ( as cluster boundaries here - they're not
      // object literals. Their tokens just attach to the enclosing cluster.)
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

    // Add this row to the innermost open cluster
    if (stack.length > 0) {
      stack[stack.length - 1].tokens.push({
        kind: r.kind, text: r.text, idx: i,
        start: r.start, end: r.end
      });
    }

    // Track context idents (skip whitespace, skip strings)
    if (r.kind === "ALPHA_RUN" || r.kind === "IDENT" || r.kind === "KEYWORD") {
      lastNonWsIdent = r.text;
    } else if (r.kind === "WHITESPACE" || r.kind === "PUNCT_OP") {
      // don't update; preserve the most recent ident
    } else if (r.kind === "PUNCT_SEP" && (r.text === ":" || r.text === ".")) {
      // colon and dot don't reset context
    } else {
      lastNonWsIdent = null;
    }
  }

  return clusters;
}

// ============================================================================
// Recognize dimensions: object property keys at the top level of objects
// like { name: "credit", values: [...] }
// ============================================================================
//
// In the canonical, dimensions are declared as:
//   { name: "credit", values: Object.freeze(["prime", "near-prime", "sub-prime"]) }
//   { name: "product", values: Object.freeze(["mortgage", "personal", ...]) }
//
// We recognize dimensions by finding clusters that contain a `name:` key
// followed by a string, and a `values:` key followed by an array of strings.
// The dimension name is the value of the `name` key; the values are the
// strings inside the values array.
// ============================================================================

function recognizeDimensions(clusters, allRows) {
  // For each cluster, check if it has `name:` and `values:` keys
  const dimensions = [];

  for (const cl of clusters) {
    // Find the `name` key and capture its value
    let nameValue = null;
    let valuesValues = [];
    let foundName = false, foundValues = false;

    for (let i = 0; i < cl.tokens.length; i++) {
      const t = cl.tokens[i];
      if ((t.kind === "ALPHA_RUN" || t.kind === "IDENT") && t.text === "name") {
        // Look ahead for COLON then STRING
        for (let j = i + 1; j < cl.tokens.length; j++) {
          if (cl.tokens[j].kind === "WHITESPACE") continue;
          if (cl.tokens[j].kind === "PUNCT_SEP" && cl.tokens[j].text === ":") {
            // continue scan
            continue;
          }
          if (cl.tokens[j].kind === "STRING_DBL" || cl.tokens[j].kind === "STRING_SGL") {
            nameValue = stripQuotes(cl.tokens[j].text);
            foundName = true;
          }
          break;
        }
      }
      if ((t.kind === "ALPHA_RUN" || t.kind === "IDENT") && t.text === "values") {
        // Collect all subsequent STRING tokens within this cluster.
        // The values are strings inside a [...] array; that array was opened
        // by a PUNCT_OPEN whose text combined with the cluster's own open
        // brace, so we don't see a separate '[' token. Instead we collect
        // strings until we run out of cluster tokens or hit a structural
        // boundary.
        for (let j = i + 1; j < cl.tokens.length; j++) {
          const tt = cl.tokens[j];
          if (tt.kind === "STRING_DBL" || tt.kind === "STRING_SGL") {
            valuesValues.push(stripQuotes(tt.text));
          }
          // Stop if we hit another major key (an IDENT followed by colon
          // that's not 'values' itself); but since this is the dimension
          // cluster we expect values to be the last key, so we just keep
          // going until cluster tokens end.
        }
        if (valuesValues.length > 0) foundValues = true;
        break;
      }
    }

    if (foundName && foundValues && nameValue && isCssIdent(nameValue)) {
      // Validate every value is a safe attribute value (more permissive
      // than CSS ident; values inside quoted attribute selectors can start
      // with digits, as in `under50` or `100to250`).
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
// Recognize constraints: { when: {...}, then: {...} } objects
// ============================================================================
//
// A constraint cluster has both a `when:` key and a `then:` key, each
// followed by an object literal. We extract the dimension-value pairs from
// the when-object and the property-value pairs from the then-object.
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

  // Index clusters by openIdx so we can find children of a given parent
  // cluster (children are clusters whose openIdx > parent.openIdx and
  // closeIdx < parent.closeIdx).
  // Sort by openIdx to find them in source order.

  for (const cl of clusters) {
    // Check this cluster has both `when` and `then` as IDENT tokens
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

    // Find the immediate child clusters of this constraint cluster.
    // A child cluster has openIdx within (cl.openIdx, cl.closeIdx) and
    // is not nested inside another child of cl.
    const directChildren = [];
    const candidates = clusters
      .filter(c => c.openIdx > cl.openIdx && c.closeIdx !== undefined && c.closeIdx < cl.closeIdx)
      .sort((a, b) => a.openIdx - b.openIdx);
    for (const cand of candidates) {
      // Is cand inside any already-collected direct child?
      let nested = false;
      for (const dc of directChildren) {
        if (cand.openIdx > dc.openIdx && cand.closeIdx < dc.closeIdx) {
          nested = true;
          break;
        }
      }
      if (!nested) directChildren.push(cand);
    }

    // The when sub-cluster is the direct child whose openIdx is just after
    // whenIdx; the then sub-cluster is the one whose openIdx is just after
    // thenIdx.
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

    // Extract pairs
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
  // Walk tokens looking for IDENT/ALPHA_RUN followed by `:` followed by STRING
  // Each match is a (dim, value) pair. We validate dim is a known dimension
  // and value is in that dimension's values.
  const pairs = [];
  for (let i = 0; i < cluster.tokens.length; i++) {
    const t = cluster.tokens[i];
    if (t.kind !== "ALPHA_RUN" && t.kind !== "IDENT") continue;
    const dim = t.text;
    if (!dimensionNames[dim]) continue;
    // Look forward: must see COLON then STRING
    let j = i + 1;
    while (j < cluster.tokens.length && cluster.tokens[j].kind === "WHITESPACE") j++;
    if (j >= cluster.tokens.length) continue;
    if (cluster.tokens[j].kind !== "PUNCT_SEP" || cluster.tokens[j].text !== ":") continue;
    j++;
    while (j < cluster.tokens.length && cluster.tokens[j].kind === "WHITESPACE") j++;
    if (j >= cluster.tokens.length) continue;
    if (cluster.tokens[j].kind !== "STRING_DBL" && cluster.tokens[j].kind !== "STRING_SGL") continue;
    const value = stripQuotes(cluster.tokens[j].text);
    // Validate value is in dim's allowed values
    if (dimensionNames[dim].indexOf(value) < 0) continue;
    pairs.push({ dim: dim, value: value });
  }
  return pairs;
}

function extractThenPairs(cluster, knownOutputProperties) {
  // Walk tokens looking for IDENT followed by `:` followed by literal value
  // (string, number, or ident). Each match is a (property, value) pair.
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
      // negative number
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
// CSS emission
// ============================================================================

function compileToCss(dimensions, constraints, opts) {
  opts = opts || {};
  const probeSelector = opts.probeSelector ||
    "#V-probe, #V-probe-container > div";

  const lines = [];
  lines.push("/* ========================================================");
  lines.push(" * Generated by Stage 3 dimensional recognizer.");
  lines.push(" * Source: substrate's parallel-substrate surface.");
  lines.push(" * Dimensions recognized: " + dimensions.length);
  lines.push(" * Constraints recognized: " + constraints.length);
  lines.push(" * ======================================================== */");
  lines.push("");

  // Base rule: default output property values
  lines.push(probeSelector + " {");
  lines.push("  --sdf: -1;");
  lines.push("  --deny: \"\";");
  lines.push("  --reg: VALID;");
  lines.push("  --rt: UNCLASSIFIED;");
  lines.push("  --rth: 0;");
  lines.push("  --doc: BASIC;");
  lines.push("}");
  lines.push("");

  // Per-property emission style follows the canonical's compileConstraint:
  //   sdf, rth: numbers (emit raw)
  //   rt, reg, doc: CSS idents (validated, emit unquoted)
  //   deny: string (emit CSS-escaped quoted)
  const identProps = { "rt": true, "reg": true, "doc": true };
  const numberProps = { "sdf": true, "rth": true };

  // Each constraint -> selector + declarations
  for (const c of constraints) {
    // Build attribute selector chain. Use double quotes to match canonical's
    // emission style.
    const attrSel = c.when.map(w => '[data-' + w.dim + '="' + w.value + '"]').join("");
    // Apply to both sides of probeSelector
    const probeParts = probeSelector.split(",").map(s => s.trim());
    const fullSel = probeParts.map(p => p + attrSel).join(", ");
    lines.push(fullSel + " {");

    // Track whether sdf=1 so we can apply the canonical's auto-derived
    // additions (sdf=1 implies --reg: DENIED and --rth: 0).
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

    // Auto-derived: sdf=1 implies DENIED + rth=0 (matches canonical)
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
// Pipeline
// ============================================================================

function runStage3(sourcePath, opts) {
  opts = opts || {};
  const source = fs.readFileSync(sourcePath);

  // Run Stage 1 to get token rows
  const sub1 = M1.createStage1Substrate({ id: "s3-s1", rowCap: 32768 });
  sub1.ingest(source);
  const vsf1 = sub1.emitVsf();

  // Parse vsf1 directly to get rows we can iterate
  // (We use the same parse logic the substrates use)
  const stage1Rows = parseVsfRows(vsf1);

  // Run substrate stack for diagnostics (Stage 3 doesn't strictly need
  // them but we report on what was surfaced as a sanity check)
  const sub2 = M2.createStage2Substrate({ id: "s3-kp" });
  sub2.ingestStage1Vsf(vsf1);
  const sid = Mid.createIdentifierSubstrate({ id: "s3-tp" });
  sid.ingestStage1Vsf(vsf1);
  const sp = Msa.createStringAnalysisSubstrate({ id: "s3-sp" });
  sp.ingestStage1Vsf(vsf1);

  // Reconstruct spatial structure from Stage 1 rows
  const clusters = reconstructSpatialClusters(stage1Rows);

  // Recognize dimensions
  const dimensions = recognizeDimensions(clusters, stage1Rows);

  // Recognize constraints
  const constraints = recognizeConstraints(clusters, dimensions);

  // Compile to CSS
  const css = compileToCss(dimensions, constraints, opts);

  return {
    sourceBytes: source.length,
    stage1Rows: stage1Rows.length,
    clustersFound: clusters.length,
    dimensionsRecognized: dimensions,
    constraintsRecognized: constraints,
    css: css,
    substrateState: {
      kindPeer: sub2.getState().constraints.length,
      textPeer: sid.getState().constraints.length,
      stringPeer: sp.getState().constraints.length
    }
  };
}

function parseVsfRows(vsfText) {
  const sepIdx = vsfText.indexOf("\n---\n");
  if (sepIdx < 0) throw new Error("vsf missing separator");
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
    rows.push({
      start: start,
      end: end,
      kind: kind,
      text: text || ""
    });
  }
  return rows;
}

// ============================================================================
// Exports
// ============================================================================

module.exports = Object.freeze({
  runStage3: runStage3,
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
  const sourcePath = process.argv[2] || "./constraints-only.js";
  const outputPath = process.argv[3] || "./stage3-output.css";

  console.log("Stage 3: dimensional recognizer");
  console.log("Source: " + sourcePath);
  console.log("");

  const result = runStage3(sourcePath);

  console.log("Source bytes:        " + result.sourceBytes);
  console.log("Stage 1 rows:        " + result.stage1Rows);
  console.log("Spatial clusters:    " + result.clustersFound);
  console.log("Substrate surfaces:");
  console.log("  Kind peer:         " + result.substrateState.kindPeer + " constraints");
  console.log("  Text peer:         " + result.substrateState.textPeer + " constraints");
  console.log("  String peer:       " + result.substrateState.stringPeer + " constraints");
  console.log("");

  console.log("Dimensions recognized: " + result.dimensionsRecognized.length);
  for (const d of result.dimensionsRecognized) {
    console.log("  " + d.name + ": [" + d.values.join(", ") + "]");
  }
  console.log("");

  console.log("Constraints recognized: " + result.constraintsRecognized.length);
  for (const c of result.constraintsRecognized) {
    const wstr = c.when.map(w => w.dim + "=" + w.value).join(" AND ");
    const tstr = Object.keys(c.then).map(k => k + "=" + c.then[k].value).join(", ");
    console.log("  WHEN " + wstr);
    console.log("    THEN " + tstr);
  }
  console.log("");

  fs.writeFileSync(outputPath, result.css);
  console.log("CSS written to: " + outputPath + " (" + result.css.length + " bytes)");

  // ASCII check
  if (asciiOnly(result.css)) {
    console.log("CSS is ASCII clean (I1).");
  } else {
    console.log("WARNING: CSS contains non-ASCII characters.");
  }
}
