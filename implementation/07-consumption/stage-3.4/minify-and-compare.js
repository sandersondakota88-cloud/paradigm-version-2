// minify-and-compare.js

"use strict";

const fs = require("fs");
const M1 = require("./stage1-lexical-typing-substrate.js");
const M2 = require("./stage2-emergent-structural-substrate.js");
const Mid = require("./stage2-identifier-substrate.js");
const Mc = require("./composer-substrate.js");

// ----------------------------------------------------------------------------
// Aggressive whole-file minifier
// ----------------------------------------------------------------------------

function isWs(c) { return c === " " || c === "\t" || c === "\n" || c === "\r"; }

function aggressiveMinify(src) {
  let out = "";
  let i = 0;
  const len = src.length;
  let lastWasSpace = false;
  let lastChar = "";

  function emitChar(c) {
    if (isWs(c)) {
      if (out.length === 0 || lastWasSpace) return;
      // No space adjacent to syntax-punctuation
      if ("{}()[];,:<>=+-*/!&|?\"'".indexOf(lastChar) >= 0) return;
      out += " ";
      lastWasSpace = true;
      lastChar = " ";
      return;
    }
    if (lastWasSpace && "{}()[];,:<>=+-*/!&|?".indexOf(c) >= 0) {
      out = out.slice(0, -1);
    }
    out += c;
    lastWasSpace = false;
    lastChar = c;
  }

  while (i < len) {
    const c = src.charAt(i);
    if (c === "/" && i + 1 < len && src.charAt(i + 1) === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end < 0 ? len : end + 2;
      emitChar(" ");
      continue;
    }
    if (c === "/" && i + 1 < len && src.charAt(i + 1) === "/") {
      const eol = src.indexOf("\n", i);
      i = eol < 0 ? len : eol;
      emitChar(" ");
      continue;
    }
    if (c === "\"" || c === "'" || c === "`") {
      out += c;
      lastWasSpace = false;
      lastChar = c;
      const quote = c;
      i++;
      while (i < len) {
        const sc = src.charAt(i);
        out += sc;
        if (sc === "\\" && i + 1 < len) {
          out += src.charAt(i + 1);
          i += 2;
          continue;
        }
        i++;
        if (sc === quote) break;
      }
      lastChar = quote;
      lastWasSpace = false;
      continue;
    }
    emitChar(c);
    i++;
  }
  return out;
}

// ----------------------------------------------------------------------------
// Identifier rename
// ----------------------------------------------------------------------------

const BUILTINS = Object.freeze({
  "Object": 1, "Array": 1, "String": 1, "Number": 1, "Boolean": 1,
  "Math": 1, "JSON": 1, "Date": 1, "RegExp": 1, "Promise": 1,
  "document": 1, "window": 1, "console": 1, "navigator": 1, "location": 1,
  "Error": 1, "TypeError": 1, "RangeError": 1,
  "Map": 1, "Set": 1, "WeakMap": 1, "WeakSet": 1, "Symbol": 1,
  "undefined": 1, "null": 1, "true": 1, "false": 1,
  "this": 1, "super": 1, "arguments": 1, "globalThis": 1,
  "NaN": 1, "Infinity": 1,
  "var": 1, "let": 1, "const": 1, "function": 1, "return": 1, "if": 1,
  "else": 1, "for": 1, "while": 1, "do": 1, "switch": 1, "case": 1,
  "break": 1, "continue": 1, "new": 1, "typeof": 1, "instanceof": 1,
  "in": 1, "of": 1, "class": 1, "extends": 1, "import": 1, "export": 1,
  "default": 1, "async": 1, "await": 1, "try": 1, "catch": 1, "finally": 1,
  "throw": 1, "yield": 1, "void": 1, "delete": 1,
  "parseInt": 1, "parseFloat": 1, "isNaN": 1, "isFinite": 1,
  "setTimeout": 1, "setInterval": 1, "clearTimeout": 1, "clearInterval": 1,
  "fetch": 1, "Buffer": 1, "process": 1, "module": 1, "require": 1, "exports": 1
});

function shortName(idx) {
  let n = idx, s = "";
  do {
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function tokenize(src) {
  const toks = [];
  let i = 0;
  const len = src.length;
  while (i < len) {
    const c = src.charAt(i);
    if (isWs(c)) {
      let j = i;
      while (j < len && isWs(src.charAt(j))) j++;
      toks.push({ type: "ws", text: src.substring(i, j) });
      i = j; continue;
    }
    if (c === "\"" || c === "'" || c === "`") {
      const start = i, q = c;
      i++;
      while (i < len) {
        const cc = src.charAt(i);
        if (cc === "\\" && i + 1 < len) { i += 2; continue; }
        i++;
        if (cc === q) break;
      }
      toks.push({ type: "str", text: src.substring(start, i) });
      continue;
    }
    if (/[a-zA-Z_$]/.test(c)) {
      let j = i;
      while (j < len && /[a-zA-Z0-9_$]/.test(src.charAt(j))) j++;
      toks.push({ type: "ident", text: src.substring(i, j) });
      i = j; continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < len && /[0-9.eE+-]/.test(src.charAt(j))) j++;
      toks.push({ type: "num", text: src.substring(i, j) });
      i = j; continue;
    }
    toks.push({ type: "punct", text: c });
    i++;
  }
  return toks;
}

function renameIdentifiers(src) {
  const tokens = tokenize(src);
  const decls = Object.create(null);
  let counter = 0;
  function makeName() {
    let n = shortName(counter++);
    while (BUILTINS[n] || /^(if|in|of|do|new|var|let|for|try)$/.test(n)) {
      n = shortName(counter++);
    }
    return n;
  }
  // Pass 1: discover declarations
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type !== "ident") continue;
    const txt = t.text;
    if (txt === "var" || txt === "let" || txt === "const") {
      let j = i + 1, depth = 0;
      while (j < tokens.length) {
        const tt = tokens[j];
        if (tt.type === "punct") {
          if ("([{".indexOf(tt.text) >= 0) depth++;
          else if (")]}".indexOf(tt.text) >= 0) depth--;
          else if (depth === 0 && tt.text === ";") break;
          else if (depth === 0 && tt.text === "=") {
            j++;
            let xd = 0;
            while (j < tokens.length) {
              const tx = tokens[j];
              if (tx.type === "punct") {
                if ("([{".indexOf(tx.text) >= 0) xd++;
                else if (")]}".indexOf(tx.text) >= 0) xd--;
                else if (xd === 0 && (tx.text === "," || tx.text === ";")) break;
              }
              j++;
            }
            if (j < tokens.length && tokens[j].text === ";") break;
            continue;
          }
        }
        if (tt.type === "ident" && depth === 0 && !BUILTINS[tt.text]) {
          if (decls[tt.text] === undefined) decls[tt.text] = makeName();
        }
        j++;
      }
      i = j; continue;
    }
    if (txt === "function") {
      let j = i + 1;
      while (j < tokens.length && tokens[j].type === "ws") j++;
      if (j < tokens.length && tokens[j].type === "ident" && !BUILTINS[tokens[j].text]) {
        if (decls[tokens[j].text] === undefined) decls[tokens[j].text] = makeName();
        j++;
      }
      while (j < tokens.length && tokens[j].type === "ws") j++;
      if (j < tokens.length && tokens[j].text === "(") {
        j++;
        while (j < tokens.length && tokens[j].text !== ")") {
          if (tokens[j].type === "ident" && !BUILTINS[tokens[j].text]) {
            if (decls[tokens[j].text] === undefined) decls[tokens[j].text] = makeName();
          }
          j++;
        }
      }
      i = j; continue;
    }
  }
  // Pass 2: rewrite (skip property accesses)
  let out = "";
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === "ident") {
      let prev = i - 1;
      while (prev >= 0 && tokens[prev].type === "ws") prev--;
      const isProp = prev >= 0 && tokens[prev].type === "punct" && tokens[prev].text === ".";
      if (!isProp && decls[t.text] !== undefined) {
        out += decls[t.text];
        continue;
      }
    }
    out += t.text;
  }
  return out;
}

// ----------------------------------------------------------------------------
// Pipeline runner
// ----------------------------------------------------------------------------

function runPipeline(label, source) {
  const t0 = Date.now();
  const sub1 = M1.createStage1Substrate({ id: label + "-s1", rowCap: 32768 });
  sub1.ingest(Buffer.from(source));
  const vsf1 = sub1.emitVsf();
  const rowCount = vsf1.split("\n---\n")[1].split("\n").filter(s => s.length > 0).length;

  const sub2 = M2.createStage2Substrate({ id: label + "-kp" });
  sub2.ingestStage1Vsf(vsf1);
  const s2 = sub2.getState();

  const sid = Mid.createIdentifierSubstrate({ id: label + "-tp" });
  sid.ingestStage1Vsf(vsf1);
  const sidState = sid.getState();

  const sc = Mc.createComposerSubstrate({ id: label + "-comp" });
  sc.observe(s2, sidState);
  const compState = sc.getState();

  const t1 = Date.now();
  return {
    label: label,
    sourceBytes: source.length,
    elapsedMs: t1 - t0,
    stage1Rows: rowCount,
    kindPeer: {
      constraints: s2.constraints.length,
      subcascades: s2.subcascades.map(sc => ({
        name: sc.name, family: sc.familyType,
        members: sc.memberIds.length, fid: sc.fidAtBirth
      }))
    },
    textPeer: {
      constraints: sidState.constraints.length,
      subcascades: sidState.subcascades.map(sc => ({
        name: sc.name, family: sc.familyType,
        members: sc.memberIds.length, fid: sc.fidAtBirth
      })),
      topTextValues: sidState.constraints.slice()
        .sort((a, b) => (b.uses || 0) - (a.uses || 0))
        .slice(0, 15)
        .map(c => ({
          family: c.family,
          text: c.pattern.text || (c.pattern.a + "<>" + c.pattern.b),
          pos: c.pattern.pos,
          uses: c.uses
        }))
    },
    composer: {
      constraints: compState.constraints.length,
      subcascades: compState.subcascades.map(sc => ({
        name: sc.name, family: sc.familyType,
        members: sc.memberIds.length, fid: sc.fidAtBirth
      })),
      jointRecurTexts: extractTopTextValues(compState, "joint-recur"),
      kindTextBindTexts: extractTopTextValues(compState, "kind-text-bind")
    },
    domainValuesInJointRecur: extractDomainValueDetections(compState),
    identifierDomainPresence: extractIdentifierDomainPresence(sidState)
  };
}

function extractTopTextValues(compState, family) {
  const constraints = compState.constraints.filter(c => c.family === family);
  const byText = {};
  for (const c of constraints) {
    const tv = (c.pattern && c.pattern.textValue) || "?";
    byText[tv] = (byText[tv] || 0) + (c.uses || 0);
  }
  return Object.entries(byText).sort((a, b) => b[1] - a[1]).slice(0, 12);
}

function extractDomainValueDetections(compState) {
  const dimensions = ["credit", "product", "applicant", "residency", "income", "employment"];
  const values = ["prime", "near-prime", "sub-prime", "mortgage", "personal", "auto", "business-line",
                  "individual", "joint", "business", "trust",
                  "domestic", "foreign", "diplomatic",
                  "under50", "50to100", "100to250", "over250",
                  "employed", "self-employed", "retired", "student", "unemployed"];
  const found = {};
  for (const c of compState.constraints) {
    if (!c.pattern) continue;
    const tv = c.pattern.textValue || "";
    if (values.indexOf(tv) >= 0 || dimensions.indexOf(tv) >= 0) {
      found[tv] = (found[tv] || 0) + (c.uses || 0);
    }
  }
  return Object.entries(found).sort((a, b) => b[1] - a[1]);
}

function extractIdentifierDomainPresence(sidState) {
  const dimensions = ["credit", "product", "applicant", "residency", "income", "employment"];
  const values = ["prime", "near-prime", "sub-prime", "mortgage", "personal", "auto", "business-line",
                  "individual", "joint", "business", "trust",
                  "domestic", "foreign", "diplomatic",
                  "under50", "50to100", "100to250", "over250",
                  "employed", "self-employed", "retired", "student", "unemployed"];
  const all = dimensions.concat(values);
  const found = {};
  for (const term of all) {
    const matches = sidState.constraints.filter(c => {
      if (!c.pattern) return false;
      const text = c.pattern.text || "";
      return text === term || text === '"' + term + '"' || text === "'" + term + "'";
    });
    if (matches.length > 0) {
      const totalUses = matches.reduce((s, c) => s + (c.uses || 0), 0);
      found[term] = totalUses;
    }
  }
  return Object.entries(found).sort((a, b) => b[1] - a[1]);
}

// ----------------------------------------------------------------------------
// Compare and report
// ----------------------------------------------------------------------------

function compare(orig, minA, minB) {
  console.log("\n========================================================");
  console.log("SIDE-BY-SIDE COMPARISON");
  console.log("========================================================\n");

  const fmt = (a, b, c) =>
    a.toString().padStart(12) + b.toString().padStart(12) + c.toString().padStart(12);

  console.log("                 " + "ORIGINAL".padStart(12) + "MIN-A".padStart(12) + "MIN-B".padStart(12));
  console.log("                 " + "(format)".padStart(12) + "(rename)".padStart(12));
  console.log("                 " + "------------".padStart(12) + "------------".padStart(12) + "------------".padStart(12));

  console.log("source bytes    " + fmt(orig.sourceBytes, minA.sourceBytes, minB.sourceBytes));
  const rA = (100 * (1 - minA.sourceBytes / orig.sourceBytes)).toFixed(1);
  const rB = (100 * (1 - minB.sourceBytes / orig.sourceBytes)).toFixed(1);
  console.log("  reduction      " + "0.0%".padStart(12) + (rA + "%").padStart(12) + (rB + "%").padStart(12));

  console.log("\nstage1 rows     " + fmt(orig.stage1Rows, minA.stage1Rows, minB.stage1Rows));

  console.log("\n--- KIND PEER ---");
  console.log("constraints     " + fmt(orig.kindPeer.constraints, minA.kindPeer.constraints, minB.kindPeer.constraints));
  console.log("subcascades     " + fmt(orig.kindPeer.subcascades.length, minA.kindPeer.subcascades.length, minB.kindPeer.subcascades.length));

  console.log("\n--- TEXT PEER ---");
  console.log("constraints     " + fmt(orig.textPeer.constraints, minA.textPeer.constraints, minB.textPeer.constraints));
  console.log("subcascades     " + fmt(orig.textPeer.subcascades.length, minA.textPeer.subcascades.length, minB.textPeer.subcascades.length));

  console.log("\n--- COMPOSER ---");
  console.log("constraints     " + fmt(orig.composer.constraints, minA.composer.constraints, minB.composer.constraints));
  console.log("subcascades     " + fmt(orig.composer.subcascades.length, minA.composer.subcascades.length, minB.composer.subcascades.length));

  console.log("\n--- KIND PEER SUB-CASCADES ---");
  for (const v of [["ORIGINAL", orig], ["MIN-A", minA], ["MIN-B", minB]]) {
    console.log("  " + v[0] + ":");
    for (const sc of v[1].kindPeer.subcascades) {
      console.log("    " + sc.name + " (members=" + sc.members + ", fid=" + sc.fid.toFixed(2) + ")");
    }
  }

  console.log("\n--- TEXT PEER SUB-CASCADES ---");
  for (const v of [["ORIGINAL", orig], ["MIN-A", minA], ["MIN-B", minB]]) {
    console.log("  " + v[0] + ":");
    for (const sc of v[1].textPeer.subcascades) {
      console.log("    " + sc.name + " (members=" + sc.members + ", fid=" + sc.fid.toFixed(2) + ")");
    }
  }

  console.log("\n--- TEXT PEER TOP TEXT VALUES ---");
  for (const v of [["ORIGINAL", orig], ["MIN-A", minA], ["MIN-B", minB]]) {
    console.log("  " + v[0] + ":");
    for (const t of v[1].textPeer.topTextValues.slice(0, 10)) {
      console.log("    uses=" + (t.uses || 0).toString().padStart(4) + " " +
                  t.family.padEnd(14) + " " +
                  JSON.stringify(t.text || "").slice(0, 40) +
                  (t.pos ? " pos=" + t.pos : ""));
    }
  }

  console.log("\n--- COMPOSER PROMOTED SUB-CASCADES ---");
  for (const v of [["ORIGINAL", orig], ["MIN-A", minA], ["MIN-B", minB]]) {
    console.log("  " + v[0] + ":");
    for (const sc of v[1].composer.subcascades) {
      console.log("    " + sc.name + " (family=" + sc.family + ", members=" + sc.members + ", fid=" + sc.fid.toFixed(2) + ")");
    }
  }

  console.log("\n--- COMPOSER JOINT-RECUR TOP TEXT VALUES ---");
  console.log("  ORIGINAL: " + JSON.stringify(orig.composer.jointRecurTexts.slice(0, 8)));
  console.log("  MIN-A:    " + JSON.stringify(minA.composer.jointRecurTexts.slice(0, 8)));
  console.log("  MIN-B:    " + JSON.stringify(minB.composer.jointRecurTexts.slice(0, 8)));

  console.log("\n--- DOMAIN VALUES IN COMPOSER (joint-recur) ---");
  console.log("  ORIGINAL: " + JSON.stringify(orig.domainValuesInJointRecur));
  console.log("  MIN-A:    " + JSON.stringify(minA.domainValuesInJointRecur));
  console.log("  MIN-B:    " + JSON.stringify(minB.domainValuesInJointRecur));

  console.log("\n--- DOMAIN TERMS IN IDENTIFIER SUBSTRATE ---");
  console.log("  ORIGINAL: " + JSON.stringify(orig.identifierDomainPresence));
  console.log("  MIN-A:    " + JSON.stringify(minA.identifierDomainPresence));
  console.log("  MIN-B:    " + JSON.stringify(minB.identifierDomainPresence));

  const origIdent = new Set(orig.identifierDomainPresence.map(d => d[0]));
  const minAIdent = new Set(minA.identifierDomainPresence.map(d => d[0]));
  const minBIdent = new Set(minB.identifierDomainPresence.map(d => d[0]));
  const overlapA = [...origIdent].filter(d => minAIdent.has(d)).length;
  const overlapB = [...origIdent].filter(d => minBIdent.has(d)).length;

  console.log("\n--- IDENTIFIER-SUBSTRATE STRUCTURAL OVERLAP ---");
  console.log("  ORIGINAL surfaces " + origIdent.size + " domain terms");
  console.log("  MIN-A overlap with original: " + overlapA + "/" + origIdent.size);
  console.log("  MIN-B overlap with original: " + overlapB + "/" + origIdent.size);

  return { overlapA, overlapB, origSize: origIdent.size };
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

const sourcePath = process.argv[2] || "./canonical-source.html";
const source = fs.readFileSync(sourcePath, "utf8");

console.log("Source: " + sourcePath + " (" + source.length + " bytes)");

console.log("\nGenerating Minifier A (formatting-only)...");
const minA = aggressiveMinify(source);
fs.writeFileSync("./canonical-min-a.html", minA);
console.log("  written: " + minA.length + " bytes (" +
  ((1 - minA.length / source.length) * 100).toFixed(1) + "% smaller)");

console.log("Generating Minifier B (formatting + rename)...");
const minB = renameIdentifiers(minA);
fs.writeFileSync("./canonical-min-b.html", minB);
console.log("  written: " + minB.length + " bytes (" +
  ((1 - minB.length / source.length) * 100).toFixed(1) + "% smaller)");

console.log("\nRunning pipeline on ORIGINAL...");
const origResult = runPipeline("orig", source);
console.log("  done in " + origResult.elapsedMs + "ms (stage1 rows: " + origResult.stage1Rows + ")");

console.log("Running pipeline on MIN-A...");
const minAResult = runPipeline("min-a", minA);
console.log("  done in " + minAResult.elapsedMs + "ms (stage1 rows: " + minAResult.stage1Rows + ")");

console.log("Running pipeline on MIN-B...");
const minBResult = runPipeline("min-b", minB);
console.log("  done in " + minBResult.elapsedMs + "ms (stage1 rows: " + minBResult.stage1Rows + ")");

const summary = compare(origResult, minAResult, minBResult);

console.log("\n========================================================");
console.log("VERDICT");
console.log("========================================================");
if (summary.origSize === 0) {
  console.log("Original surfaced no domain terms in identifier substrate.");
  console.log("Test inconclusive at this fixture scale; canonical's signal-to-noise");
  console.log("is below threshold for both topologies.");
} else if (summary.overlapA === summary.origSize && summary.overlapB === summary.origSize) {
  console.log("STRUCTURAL: every domain term surfaced in original survives BOTH");
  console.log("formatting-only minification AND identifier rename. Architecture");
  console.log("catches structure, not formatting. Stage 3 path is empirically");
  console.log("supported.");
} else if (summary.overlapA === summary.origSize && summary.overlapB < summary.origSize) {
  console.log("MOSTLY STRUCTURAL: terms survive formatting-only minification but");
  console.log("some are lost under identifier rename. Architecture catches structure");
  console.log("but has some dependence on declaration-context recurrence.");
} else if (summary.overlapA >= summary.origSize * 0.7) {
  console.log("MOSTLY STRUCTURAL: most domain terms survive minification.");
  console.log("Stage 3 path is supported with caveats.");
} else {
  console.log("FORMATTING-DEPENDENT: terms lost under minification. Architecture");
  console.log("is catching tokenization patterns more than structural recurrence.");
  console.log("Stage 1 sub-tokenization needed before Stage 3 has solid ground.");
}
