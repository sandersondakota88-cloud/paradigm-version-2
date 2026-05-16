// stage2-string-analysis-substrate.js - SE-10 chain link, third peer

"use strict";

const crypto = require("crypto");

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const VERSION = "stage2-string-analysis-1.0.0";

// Same regime as the prior peers.
const FIDELITY_PROMOTE   = 2.5;
const FIDELITY_MIN_FIRES = 8;
const SUB_CASCADE_CAP    = 24;

// String-internal observation can produce many sub-tokens per string,
// so caps are sized to accommodate.
const CONSTRAINT_CAP_DEFAULT  = 8192;
const CORRELATION_CAP_DEFAULT = 8192;
const ROW_CAP_DEFAULT         = 32768;
const TRACE_CAP_DEFAULT       = 8192;
const NAMING_PREF_CAP         = 1.0;

// Window for sub-token co-occurrence within a single string.
const SUB_COOC_WINDOW = 4;

// Maximum string length we will analyze (bounded resource use).
const MAX_STRING_LEN = 256;

// Token kinds from Stage 1 that carry string literal content.
const STRING_BEARING_KINDS = Object.freeze({
  "STRING_DBL": true,
  "STRING_SGL": true
});

// ----------------------------------------------------------------------------
// Primitive types
// ----------------------------------------------------------------------------

const PRIMITIVE_KINDS = Object.freeze({
  STR_INNER_RECUR:    "STR_INNER_RECUR",     // a sub-token of a string recurs
  STR_INNER_COOC:     "STR_INNER_COOC",      // two sub-tokens co-occur in
                                             // the same string
  STR_HYPHEN_PATTERN: "STR_HYPHEN_PATTERN"   // hyphenation prefix or suffix
                                             // shared across strings
});

// ----------------------------------------------------------------------------
// Guards
// ----------------------------------------------------------------------------

function requireFiniteInt(v, name) {
  if (typeof v !== "number" || !Number.isFinite(v) || Math.floor(v) !== v) {
    throw new TypeError(name + " must be finite int");
  }
  return v;
}

function asciiOnly(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x09 || (c > 0x0D && c < 0x20) || c > 0x7E) return false;
  }
  return true;
}

function sha256Hex(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function clamp01(x) {
  if (typeof x !== "number" || !Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

// ----------------------------------------------------------------------------
// Stage 1 VSF parsing (autonomous per SE-10)
// ----------------------------------------------------------------------------

function parseStage1Vsf(vsfText) {
  if (typeof vsfText !== "string") throw new TypeError("vsfText must be string");
  if (!asciiOnly(vsfText)) throw new Error("vsf must be ASCII-only (I1)");
  const sepIdx = vsfText.indexOf("\n---\n");
  if (sepIdx < 0) throw new Error("vsf missing header/body separator");
  const bodySection = vsfText.slice(sepIdx + 5);

  const lines = bodySection.split("\n").filter(function (s) {
    return s.length > 0;
  });
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length > 4096) continue;
    const f = lines[i].split("|");
    if (f.length < 6) continue;
    const start = parseInt(f[0], 10);
    const end = parseInt(f[1], 10);
    const kind = f[2];
    const text = f[4];
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (typeof kind !== "string" || kind.length === 0) continue;
    rows.push(Object.freeze({
      start: start,
      end: end,
      kind: kind,
      text: text || ""
    }));
  }
  return Object.freeze({ rows: Object.freeze(rows) });
}

// ----------------------------------------------------------------------------
// String content sub-tokenization
// ----------------------------------------------------------------------------
//
// A string token from Stage 1 like `"sub-prime"` carries quotes plus
// content. We strip the quotes, then split the content into sub-tokens
// by character class. Sub-tokens are:
//   - alphanumeric runs (letters and digits, the morphological units)
//   - separator characters (- _ . / : space) tracked as their own tokens
//
// Examples:
//   "sub-prime"          -> [sub] [-] [prime]
//   "data-debt"          -> [data] [-] [debt]
//   "near-prime"         -> [near] [-] [prime]
//   "data-mortgage"      -> [data] [-] [mortgage]
//   "Foreign SubPrime Mortgage not underwriteable"
//                        -> [Foreign] [ ] [SubPrime] [ ] [Mortgage] ...
//   "100to250"           -> [100to250]   (single alphanumeric run by class;
//                                         we don't decompose digit-letter
//                                         transitions further)
//
// We keep separators as their own sub-tokens because they are
// structurally meaningful. The hyphen between data-debt is not noise;
// it is the shape of the compound. Tracking it lets us notice that
// hyphens recur where domain compound terms recur.

function stripStringQuotes(s) {
  if (typeof s !== "string" || s.length < 2) return s;
  const f = s.charAt(0);
  const l = s.charAt(s.length - 1);
  if ((f === "\"" && l === "\"") || (f === "'" && l === "'")) {
    return s.slice(1, -1);
  }
  return s;
}

function isAlphanumChar(c) {
  return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || (c >= "0" && c <= "9");
}

function isSeparatorChar(c) {
  return c === "-" || c === "_" || c === "." || c === "/" ||
         c === ":" || c === " " || c === "\\";
}

function subTokenize(content) {
  // content is the inside of a string (quotes already stripped).
  // Returns an array of sub-token records.
  if (typeof content !== "string" || content.length === 0) return [];
  if (content.length > MAX_STRING_LEN) {
    content = content.slice(0, MAX_STRING_LEN);
  }
  const subs = [];
  let i = 0;
  const len = content.length;
  while (i < len) {
    const c = content.charAt(i);
    if (isAlphanumChar(c)) {
      let j = i;
      while (j < len && isAlphanumChar(content.charAt(j))) j++;
      const text = content.substring(i, j);
      subs.push({ kind: "alpha-run", text: text, idx: subs.length });
      i = j;
      continue;
    }
    if (isSeparatorChar(c)) {
      subs.push({ kind: "sep", text: c, idx: subs.length });
      i++;
      continue;
    }
    // Other characters (punctuation, special chars) - emit as own kind
    subs.push({ kind: "other", text: c, idx: subs.length });
    i++;
  }
  return subs;
}

// ----------------------------------------------------------------------------
// Hyphenation pattern detection
// ----------------------------------------------------------------------------
//
// Given a list of sub-tokens for a string, compute its hyphenation
// signature: which alpha-runs are connected by hyphens? The signature
// is a list of (lhs, rhs) pairs.
//
// Examples:
//   "data-debt"          -> [(data, debt)]
//   "near-prime"         -> [(near, prime)]
//   "sub-prime"          -> [(sub, prime)]
//   "data-mortgage"      -> [(data, mortgage)]
//   "100to250"           -> []  (no hyphen)
//   "Foreign SubPrime"   -> []  (no hyphen)
//
// A hyphen pattern member that recurs across many strings (the lhs or
// rhs of multiple pairs) is a structural fact - it indicates a shared
// morphological prefix or suffix.

function hyphenPairs(subs) {
  const pairs = [];
  for (let i = 0; i + 2 < subs.length; i++) {
    if (subs[i].kind === "alpha-run" &&
        subs[i + 1].kind === "sep" && subs[i + 1].text === "-" &&
        subs[i + 2].kind === "alpha-run") {
      pairs.push({ lhs: subs[i].text, rhs: subs[i + 2].text });
    }
  }
  return pairs;
}

// ----------------------------------------------------------------------------
// Primitive derivations
// ----------------------------------------------------------------------------

function deriveStrInnerRecur(subTok) {
  if (subTok.kind !== "alpha-run") return null;  // only meaningful sub-tokens
  const text = subTok.text;
  if (text.length === 0) return null;
  if (text.length === 1) return null;  // single-char sub-tokens are noise
  if (!asciiOnly(text)) return null;
  return Object.freeze({
    primitive: PRIMITIVE_KINDS.STR_INNER_RECUR,
    family: "str-inner-recur",
    pattern: { type: "str-inner-recur", text: text, key: text },
    members: { text: text }
  });
}

function deriveStrInnerCooc(subA, subB) {
  if (subA.kind !== "alpha-run" || subB.kind !== "alpha-run") return null;
  const a = subA.text, b = subB.text;
  if (a.length < 2 || b.length < 2) return null;
  if (a === b) return null;
  if (!asciiOnly(a) || !asciiOnly(b)) return null;
  const pair = a < b ? (a + "<>" + b) : (b + "<>" + a);
  return Object.freeze({
    primitive: PRIMITIVE_KINDS.STR_INNER_COOC,
    family: "str-inner-cooc",
    pattern: { type: "str-inner-cooc", a: a, b: b, key: pair },
    members: { aText: a, bText: b }
  });
}

function deriveStrHyphenPattern(pair) {
  // Pattern is the (lhs, rhs) shape of one hyphenated compound.
  // We track patterns separately for the lhs and rhs sides because
  // both sides being recurrent are different structural facts:
  //   - "data-X" patterns (lhs=data) indicate dimension-prefix
  //     convention (every loan-eligibility attribute is data-something)
  //   - "X-prime" patterns (rhs=prime) indicate suffix convention
  //     (sub-prime, near-prime share the prime suffix)
  //
  // We emit two derived constraints per pair, one for each side.
  if (!pair || !pair.lhs || !pair.rhs) return [];
  if (pair.lhs.length < 2 || pair.rhs.length < 2) return [];
  return [
    Object.freeze({
      primitive: PRIMITIVE_KINDS.STR_HYPHEN_PATTERN,
      family: "str-hyphen-prefix",
      pattern: {
        type: "str-hyphen-prefix",
        prefix: pair.lhs,
        key: "lhs::" + pair.lhs
      },
      members: { prefix: pair.lhs, partneredWith: pair.rhs }
    }),
    Object.freeze({
      primitive: PRIMITIVE_KINDS.STR_HYPHEN_PATTERN,
      family: "str-hyphen-suffix",
      pattern: {
        type: "str-hyphen-suffix",
        suffix: pair.rhs,
        key: "rhs::" + pair.rhs
      },
      members: { suffix: pair.rhs, partneredWith: pair.lhs }
    })
  ];
}

// ----------------------------------------------------------------------------
// Substrate factory
// ----------------------------------------------------------------------------

function createStringAnalysisSubstrate(opts) {
  opts = opts || {};
  const id = String(opts.id || ("strana-" + crypto.randomBytes(4).toString("hex")));
  const constraintCap = requireFiniteInt(opts.constraintCap || CONSTRAINT_CAP_DEFAULT, "constraintCap");
  const correlationCap = requireFiniteInt(opts.correlationCap || CORRELATION_CAP_DEFAULT, "correlationCap");
  const rowCap = requireFiniteInt(opts.rowCap || ROW_CAP_DEFAULT, "rowCap");
  const traceCap = requireFiniteInt(opts.traceCap || TRACE_CAP_DEFAULT, "traceCap");

  const constraints = [];
  const constraintsById = Object.create(null);
  let idCtr = 0;
  const correlations = Object.create(null);
  const familyFidelity = Object.create(null);
  const subcascades = [];
  const namedSubsByName = Object.create(null);

  let step = 0;
  let scalarDelta = 1.0;
  let prevDelta = 1.0;
  let namingPref = 0.0;
  let totalTokensSeen = 0;        // counts Stage 1 rows ingested
  let totalStringTokensSeen = 0;  // string-bearing Stage 1 rows
  let totalSubTokensSeen = 0;     // sub-tokens within strings
  const trace = [];
  const rows = [];
  let sealed = false;

  // F1 SE-04 seed
  const SEED = Object.freeze({
    id: "seed::what-is-delta",
    family: "seed",
    pattern: { type: "seed" },
    permanent: true,
    weight: 1.0
  });

  // ----------------------------------------------------------------------
  // Helpers (mirror prior peers)
  // ----------------------------------------------------------------------

  function nextId() { idCtr++; return "sa::" + idCtr; }

  function recordTrace(op, detail) {
    if (sealed) return;
    if (trace.length >= traceCap) trace.shift();
    trace.push(Object.freeze({
      step: ++step,
      op: op,
      delta: scalarDelta,
      detail: Object.freeze(detail || {})
    }));
  }

  function findOrCreateConstraint(derivation) {
    if (!derivation) return null;
    const key = derivation.pattern && derivation.pattern.key;
    for (let i = 0; i < constraints.length; i++) {
      const c = constraints[i];
      if (c.family !== derivation.family) continue;
      if (c.pattern && c.pattern.key === key) return c;
    }
    if (constraints.length >= constraintCap) {
      let evictIdx = -1, lowest = Infinity;
      for (let i = 0; i < constraints.length; i++) {
        const w = constraints[i].weight || 0;
        if (w < lowest) { lowest = w; evictIdx = i; }
      }
      if (evictIdx >= 0) {
        const evicted = constraints.splice(evictIdx, 1)[0];
        delete constraintsById[evicted.id];
      }
    }
    const c = {
      id: nextId(),
      family: derivation.family,
      pattern: derivation.pattern,
      kind: "derived",
      uses: 0,
      weight: 0.5,
      lastUsed: step,
      members: derivation.members,
      birth: step
    };
    constraints.push(c);
    constraintsById[c.id] = c;
    return c;
  }

  function recordCorrelation(idA, idB) {
    if (!idA || !idB || idA === idB) return;
    const key = idA < idB ? (idA + "|" + idB) : (idB + "|" + idA);
    if (!correlations[key]) {
      correlations[key] = { a: idA, b: idB, coFire: 0, lastSeen: 0 };
    }
    correlations[key].coFire++;
    correlations[key].lastSeen = step;
    const keys = Object.keys(correlations);
    if (keys.length > correlationCap) {
      const entries = keys.map(function (k) {
        return { key: k, score: correlations[k].coFire + correlations[k].lastSeen / 100 };
      });
      entries.sort(function (a, b) { return a.score - b.score; });
      const toEvict = Math.floor(correlationCap * 0.1);
      for (let i = 0; i < toEvict; i++) delete correlations[entries[i].key];
    }
  }

  function markUsed(c) {
    if (!c) return;
    c.uses = (c.uses || 0) + 1;
    c.weight = Math.min(1.0, (c.weight || 0.5) + 0.05);
    c.lastUsed = step;
  }

  function recordFamilyFiring(family) {
    if (!familyFidelity[family]) familyFidelity[family] = { totalFires: 0 };
    familyFidelity[family].totalFires++;
  }

  function fieldAverageConstraintFires() {
    if (constraints.length === 0) return 0;
    let total = 0;
    for (let i = 0; i < constraints.length; i++) total += constraints[i].uses || 0;
    return total / constraints.length;
  }

  function fidelityOf(family) {
    const fid = familyFidelity[family];
    if (!fid || fid.totalFires === 0) return 0;
    const avg = fieldAverageConstraintFires();
    if (avg <= 0) return 0;
    let topUses = 0;
    for (let i = 0; i < constraints.length; i++) {
      if (constraints[i].family !== family) continue;
      if ((constraints[i].uses || 0) > topUses) topUses = constraints[i].uses;
    }
    return topUses / avg;
  }

  function subForFamily(family) {
    for (let i = 0; i < subcascades.length; i++) {
      if (subcascades[i].familyType === family) return subcascades[i];
    }
    return null;
  }

  function nameFromPattern(c) {
    if (!c || !c.pattern) return null;
    const p = c.pattern;
    let raw;
    if (p.type === "str-inner-recur")        raw = "sa-recur-" + (p.text || "");
    else if (p.type === "str-inner-cooc")    raw = "sa-cooc-" + (p.a || "") + "-" + (p.b || "");
    else if (p.type === "str-hyphen-prefix") raw = "sa-hpre-" + (p.prefix || "");
    else if (p.type === "str-hyphen-suffix") raw = "sa-hsuf-" + (p.suffix || "");
    else                                     raw = String(p.type);
    let name = raw.toLowerCase().replace(/[^a-z0-9-]/g, "").substring(0, 48);
    if (!name) name = "sa";
    let fin = name, suffix = 2;
    while (namedSubsByName[fin]) {
      fin = name + "-" + suffix;
      suffix++;
      if (suffix > 99) { fin = name + "-x"; break; }
    }
    return fin;
  }

  function checkPromotions() {
    const promoted = [];
    if (subcascades.length >= SUB_CASCADE_CAP) return promoted;
    for (const fam in familyFidelity) {
      if (subcascades.length >= SUB_CASCADE_CAP) break;
      const fid = familyFidelity[fam];
      if (fid.totalFires < FIDELITY_MIN_FIRES) continue;
      const fidelityValue = fidelityOf(fam);
      if (fidelityValue < FIDELITY_PROMOTE) continue;
      if (subForFamily(fam)) continue;
      const memberIds = [];
      let dom = null, maxU = -1;
      for (let i = 0; i < constraints.length; i++) {
        const c = constraints[i];
        if (c.family !== fam) continue;
        memberIds.push(c.id);
        if ((c.uses || 0) > maxU) { maxU = c.uses || 0; dom = c; }
      }
      if (memberIds.length < 2) continue;
      const name = nameFromPattern(dom);
      const sc = {
        id: "sc::" + (++idCtr),
        name: name,
        familyType: fam,
        memberIds: memberIds.slice(),
        birth: step,
        lastNamed: -1,
        namedCount: 0,
        fidAtBirth: fidelityValue
      };
      subcascades.push(sc);
      namedSubsByName[name] = sc;
      promoted.push(sc);
      recordTrace("promote", {
        family: fam, name: name, members: memberIds.length, fidAtBirth: fidelityValue
      });
    }
    return promoted;
  }

  function detectNamingInToken(token) {
    if (subcascades.length === 0) return;
    const tokText = (token.text || "").toLowerCase();
    if (!tokText) return;
    for (let i = 0; i < subcascades.length; i++) {
      const sc = subcascades[i];
      if (sc.name && tokText.indexOf(sc.name) >= 0) {
        sc.lastNamed = step;
        sc.namedCount++;
        namingPref = Math.min(NAMING_PREF_CAP, namingPref + 0.01);
        recordTrace("naming-event", { name: sc.name });
      }
    }
  }

  function computeFieldDelta() {
    let total = constraints.length + 1;
    let resolved = 0;
    for (let i = 0; i < constraints.length; i++) {
      if ((constraints[i].uses || 0) > 0 && (constraints[i].weight || 0) > 0.5) resolved++;
    }
    const unresolved = total - resolved;
    return clamp01(unresolved / Math.max(1, total));
  }

  // ----------------------------------------------------------------------
  // Main ingestion loop
  // ----------------------------------------------------------------------
  // Walks Stage 1 rows. For each string-bearing token, sub-tokenizes the
  // string content and fires the three primitives on the sub-token stream.
  // Hyphenation patterns are detected per string and fire their own
  // primitive.

  function ingestStage1Vsf(vsfText) {
    if (sealed) throw new Error("String analysis substrate is sealed");
    const parsed = parseStage1Vsf(vsfText);
    const tokens = parsed.rows;
    if (tokens.length === 0) return Object.freeze({ tokensSeen: 0, delta: scalarDelta });

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      totalTokensSeen++;
      prevDelta = scalarDelta;

      // Only string-bearing tokens contribute to this substrate's
      // observation. Other tokens are positional context that we do not
      // observe here (the kind peer and identifier peer cover them).
      if (!STRING_BEARING_KINDS[tok.kind]) {
        scalarDelta = computeFieldDelta();
        if ((totalTokensSeen % 256) === 0) {
          recordTrace("crawl-progress", {
            tokensSeen: totalTokensSeen,
            stringTokens: totalStringTokensSeen,
            subTokens: totalSubTokensSeen,
            constraints: constraints.length,
            delta: scalarDelta
          });
        }
        continue;
      }

      totalStringTokensSeen++;

      // Sub-tokenize the string contents
      const content = stripStringQuotes(tok.text || "");
      const subs = subTokenize(content);
      if (subs.length === 0) {
        scalarDelta = computeFieldDelta();
        continue;
      }

      const firedThisStep = [];

      // STR_INNER_RECUR: each alpha-run sub-token fires a recurrence
      // observation. A sub-token like "prime" appearing inside many
      // distinct strings ("sub-prime", "near-prime", just "prime") will
      // accumulate uses regardless of which whole-string it lived in.
      for (let j = 0; j < subs.length; j++) {
        const sub = subs[j];
        totalSubTokensSeen++;
        const der = deriveStrInnerRecur(sub);
        if (der) {
          const c = findOrCreateConstraint(der);
          if (c) { markUsed(c); firedThisStep.push(c); }
        }
      }

      // STR_INNER_COOC: pairs of alpha-runs within the same string,
      // within a small window. "sub-prime" produces (sub, prime).
      // "data-debt" produces (data, debt). Multi-token strings like
      // "Foreign SubPrime Mortgage not underwriteable" produce
      // pairwise co-occurrences.
      for (let j = 0; j < subs.length; j++) {
        const winEnd = Math.min(subs.length, j + SUB_COOC_WINDOW + 1);
        for (let k = j + 1; k < winEnd; k++) {
          const der = deriveStrInnerCooc(subs[j], subs[k]);
          if (der) {
            const c = findOrCreateConstraint(der);
            if (c) { markUsed(c); firedThisStep.push(c); }
          }
        }
      }

      // STR_HYPHEN_PATTERN: detect hyphenated alpha-run pairs in the
      // string. A string with no hyphenation produces no firings here.
      // Strings like "data-debt" and "near-prime" produce a prefix
      // firing AND a suffix firing each.
      const hPairs = hyphenPairs(subs);
      for (let j = 0; j < hPairs.length; j++) {
        const ders = deriveStrHyphenPattern(hPairs[j]);
        for (let k = 0; k < ders.length; k++) {
          const c = findOrCreateConstraint(ders[k]);
          if (c) { markUsed(c); firedThisStep.push(c); }
        }
      }

      // Correlations across firings this step
      for (let j = 0; j < firedThisStep.length; j++) {
        for (let k = j + 1; k < firedThisStep.length; k++) {
          recordCorrelation(firedThisStep[j].id, firedThisStep[k].id);
        }
      }

      // F1 seed: continuous delta read
      scalarDelta = computeFieldDelta();

      // Family fidelity counts per fired constraint (matches the prior
      // peers' counting after the same architectural fix).
      for (let j = 0; j < firedThisStep.length; j++) {
        recordFamilyFiring(firedThisStep[j].family);
      }

      // K3 naming detection (token text contains a sub-cascade name)
      detectNamingInToken(tok);

      // Periodic promotion check
      if ((totalStringTokensSeen % 32) === 0) {
        checkPromotions();
      }

      if ((totalTokensSeen % 256) === 0) {
        recordTrace("crawl-progress", {
          tokensSeen: totalTokensSeen,
          stringTokens: totalStringTokensSeen,
          subTokens: totalSubTokensSeen,
          constraints: constraints.length,
          subcascades: subcascades.length,
          delta: scalarDelta
        });
      }
    }

    // Final promotion sweep
    checkPromotions();

    // Emit rows for promoted sub-cascades
    emitRowsFromSubcascades();

    recordTrace("crawl-complete", {
      tokensSeen: totalTokensSeen,
      stringTokens: totalStringTokensSeen,
      subTokens: totalSubTokensSeen,
      constraints: constraints.length,
      subcascades: subcascades.length,
      delta: scalarDelta
    });

    return Object.freeze({
      tokensSeen: totalTokensSeen,
      stringTokens: totalStringTokensSeen,
      subTokens: totalSubTokensSeen,
      constraints: constraints.length,
      subcascades: subcascades.length,
      delta: scalarDelta,
      namingPref: namingPref
    });
  }

  function emitRowsFromSubcascades() {
    for (let i = 0; i < subcascades.length; i++) {
      const sc = subcascades[i];
      let already = false;
      for (let j = 0; j < rows.length; j++) {
        if (rows[j].family === sc.familyType && rows[j].name === sc.name) {
          already = true; break;
        }
      }
      if (already) continue;

      const dom = constraintsById[sc.memberIds[0]];
      const patternKind = dom && dom.pattern ? dom.pattern.type : "?";
      let totalUses = 0;
      for (let j = 0; j < sc.memberIds.length; j++) {
        const c = constraintsById[sc.memberIds[j]];
        if (c) totalUses += (c.uses || 0);
      }
      const body = ["subcascade", sanitize(sc.name), sanitize(sc.familyType),
                    String(sc.memberIds.length), String(totalUses),
                    sc.fidAtBirth.toFixed(4), patternKind].join("|");
      if (rows.length >= rowCap) rows.shift();
      const hash = sha256Hex(body);
      rows.push(Object.freeze({
        kind: "subcascade",
        name: sc.name,
        family: sc.familyType,
        members: sc.memberIds.length,
        totalUses: totalUses,
        fidAtBirth: sc.fidAtBirth,
        patternKind: patternKind,
        body: body,
        hash: hash
      }));
    }
  }

  function sanitize(s) {
    if (s === null || s === undefined) return "";
    let out = String(s).replace(/[|\r\n]/g, " ").trim();
    if (out.length > 128) out = out.slice(0, 128);
    return out;
  }

  function getState() {
    return Object.freeze({
      id: id,
      version: VERSION,
      step: step,
      sealed: sealed,
      delta: scalarDelta,
      namingPref: namingPref,
      totalTokensSeen: totalTokensSeen,
      totalStringTokensSeen: totalStringTokensSeen,
      totalSubTokensSeen: totalSubTokensSeen,
      constraints: constraints.slice(),
      subcascades: subcascades.slice(),
      rows: rows.slice(),
      trace: trace.slice(),
      seed: SEED,
      familyCount: Object.keys(familyFidelity).length,
      correlationCount: Object.keys(correlations).length
    });
  }

  function emitVsf() {
    const triads = [
      "kind:subcascade=0,str-inner-recur=1,str-inner-cooc=2,str-hyphen-prefix=3,str-hyphen-suffix=4|0|4",
      "name:ident|0|48",
      "family:family|0|64",
      "members:count|0|" + Math.max(1, constraints.length),
      "uses:count|0|99999",
      "fidAtBirth:value=0|0|1"
    ];
    const headerSection = triads.join(" | ");
    const bodySection = rows.map(function (r) { return r.body; }).join("\n");
    return headerSection + "\n---\n" + bodySection;
  }

  function seal() {
    if (sealed) return "";
    sealed = true;
    let h = sha256Hex(VERSION + ":" + id);
    for (let i = 0; i < rows.length; i++) {
      h = sha256Hex(h + ":" + rows[i].hash);
    }
    return h;
  }

  return Object.freeze({
    id: id,
    version: VERSION,
    ingestStage1Vsf: ingestStage1Vsf,
    getState: getState,
    emitVsf: emitVsf,
    seal: seal,
    _checkPromotions: checkPromotions,
    _computeFieldDelta: computeFieldDelta,
    _subTokenize: subTokenize,
    _hyphenPairs: hyphenPairs
  });
}

// ----------------------------------------------------------------------------
// Exports
// ----------------------------------------------------------------------------

module.exports = Object.freeze({
  VERSION: VERSION,
  PRIMITIVE_KINDS: PRIMITIVE_KINDS,
  STRING_BEARING_KINDS: STRING_BEARING_KINDS,
  FIDELITY_PROMOTE: FIDELITY_PROMOTE,
  FIDELITY_MIN_FIRES: FIDELITY_MIN_FIRES,
  SUB_CASCADE_CAP: SUB_CASCADE_CAP,
  SUB_COOC_WINDOW: SUB_COOC_WINDOW,
  parseStage1Vsf: parseStage1Vsf,
  createStringAnalysisSubstrate: createStringAnalysisSubstrate,
  asciiOnly: asciiOnly,
  sha256Hex: sha256Hex,
  // Pure helpers exposed for tests
  stripStringQuotes: stripStringQuotes,
  subTokenize: subTokenize,
  hyphenPairs: hyphenPairs,
  deriveStrInnerRecur: deriveStrInnerRecur,
  deriveStrInnerCooc: deriveStrInnerCooc,
  deriveStrHyphenPattern: deriveStrHyphenPattern
});
