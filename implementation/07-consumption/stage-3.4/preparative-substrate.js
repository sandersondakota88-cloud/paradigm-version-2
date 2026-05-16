// preparative-substrate.js - fourth orthogonal axis: distinctiveness

"use strict";

const crypto = require("crypto");

// ============================================================================
// Constants
// ============================================================================

const VERSION = "preparative-substrate-1.0.0";

// Promotion regime - same as the prior peers
const FIDELITY_PROMOTE   = 2.5;
const FIDELITY_MIN_FIRES = 8;
const SUB_CASCADE_CAP    = 24;

// Bounded caps
const CONSTRAINT_CAP_DEFAULT  = 8192;
const CORRELATION_CAP_DEFAULT = 8192;
const ROW_CAP_DEFAULT         = 32768;
const TRACE_CAP_DEFAULT       = 8192;

// Thresholds for distinctiveness assignment to derived kind classes.
// These are observation thresholds, not architectural commitments;
// they can be tuned without revising the spec stack.
const DOMAIN_VALUE_MIN_DISTINCTIVENESS = 0.6;
const DOMAIN_DIM_MIN_DISTINCTIVENESS   = 0.5;
const IDIOMATIC_MAX_DISTINCTIVENESS    = 0.2;

// Token kinds from Stage 1 that carry text-bearing content
const TEXT_BEARING_KINDS = Object.freeze({
  "ALPHA_RUN":  true,
  "IDENT":      true,
  "DIGIT_RUN":  true,
  "STRING_DBL": true,
  "STRING_SGL": true,
  "KEYWORD":    true
});

// Standard library names that should be classified IDIOMATIC regardless
// of their distinctiveness signature. This is the only place the
// preparative substrate uses external knowledge - and it uses it
// minimally and conservatively.
const STDLIB_NAMES = Object.freeze({
  "Object": 1, "Array": 1, "String": 1, "Number": 1, "Boolean": 1,
  "Math": 1, "JSON": 1, "Date": 1, "RegExp": 1, "Promise": 1,
  "document": 1, "window": 1, "console": 1, "navigator": 1,
  "Error": 1, "TypeError": 1, "RangeError": 1,
  "Map": 1, "Set": 1, "WeakMap": 1, "WeakSet": 1, "Symbol": 1,
  "var": 1, "let": 1, "const": 1, "function": 1, "return": 1,
  "if": 1, "else": 1, "for": 1, "while": 1, "do": 1, "switch": 1,
  "case": 1, "break": 1, "continue": 1, "new": 1, "typeof": 1,
  "instanceof": 1, "in": 1, "of": 1, "class": 1, "extends": 1,
  "import": 1, "export": 1, "default": 1, "async": 1, "await": 1,
  "try": 1, "catch": 1, "finally": 1, "throw": 1, "yield": 1,
  "void": 1, "delete": 1,
  "true": 1, "false": 1, "null": 1, "undefined": 1, "this": 1,
  "super": 1, "arguments": 1
});

// Derived kind classes the preparative map can assign
const DERIVED_KINDS = Object.freeze({
  DOMAIN_VALUE: "DOMAIN_VALUE",     // text appearing in string literal
                                    // positions with high distinctiveness
  DOMAIN_DIM:   "DOMAIN_DIM",       // text appearing as object key /
                                    // declaration with high distinctiveness
  IDIOMATIC:    "IDIOMATIC",        // high frequency but low distinctiveness
                                    // (var, function, i, etc.)
  LIBRARY_REF:  "LIBRARY_REF",      // matches stdlib names
  UNCLASSIFIED: "UNCLASSIFIED"      // default for tokens that don't reach
                                    // any threshold
});

// ============================================================================
// Guards (I1, I2)
// ============================================================================

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

function requireFiniteInt(v, name) {
  if (typeof v !== "number" || !Number.isFinite(v) || Math.floor(v) !== v) {
    throw new TypeError(name + " must be finite int");
  }
  return v;
}

// ============================================================================
// Stage 1 VSF parsing (autonomous per SE-10)
// ============================================================================

function parseStage1Vsf(vsfText) {
  if (typeof vsfText !== "string") throw new TypeError("vsfText must be string");
  if (!asciiOnly(vsfText)) throw new Error("vsf must be ASCII-only (I1)");
  const sepIdx = vsfText.indexOf("\n---\n");
  if (sepIdx < 0) throw new Error("vsf missing header/body separator");
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
    rows.push(Object.freeze({
      start: start,
      end: end,
      kind: kind,
      text: text || ""
    }));
  }
  return Object.freeze({ rows: Object.freeze(rows) });
}

// ============================================================================
// Token normalization
// ============================================================================
//
// Each token observation is normalized to a (text, position-class) pair
// where position-class indicates the structural role:
//   STR  = text appeared inside a string literal
//   DECL = text appeared as a declared identifier
//   REF  = text appeared as a reference to an identifier
//   OTHER = anything else
//
// Positions are derived from immediate prior context the same way the
// identifier substrate's deriveTextPosClass does it. We don't import
// the identifier substrate (SE-10 autonomy) - we own the derivation.
// ============================================================================

const POS_DECL = "DECL";
const POS_STR  = "STR";
const POS_REF  = "REF";
const POS_OTHER = "OTHER";

const DECL_KEYWORDS = Object.freeze({
  "var": true, "let": true, "const": true,
  "function": true, "class": true
});

function derivePosClass(tokens, idx) {
  const tok = tokens[idx];
  if (tok.kind === "STRING_DBL" || tok.kind === "STRING_SGL") return POS_STR;

  // Look backward through up to 4 non-whitespace tokens
  let lookback = 0;
  for (let j = idx - 1; j >= 0 && lookback < 4; j--) {
    const prev = tokens[j];
    if (prev.kind === "WHITESPACE") continue;
    lookback++;
    if (prev.kind === "KEYWORD" && DECL_KEYWORDS[prev.text]) return POS_DECL;
    if (lookback >= 2) break;
  }

  if (tok.kind === "ALPHA_RUN" || tok.kind === "IDENT" || tok.kind === "KEYWORD") {
    return POS_REF;
  }
  return POS_OTHER;
}

function stripQuotes(s) {
  if (typeof s !== "string" || s.length < 2) return s;
  const f = s.charAt(0), l = s.charAt(s.length - 1);
  if ((f === "\"" && l === "\"") || (f === "'" && l === "'")) {
    return s.slice(1, -1);
  }
  return s;
}

// Tokenize the *contents* of a string literal so that "sub-prime" yields
// ["sub", "-", "prime"] sub-tokens. This lets the preparative substrate
// observe morphological structure inside string literals - the same
// information the string-analysis peer sees, but used here for
// distinctiveness scoring rather than for joint-recurrence promotion.
function subTokenizeStringContent(content) {
  if (typeof content !== "string" || content.length === 0) return [];
  if (content.length > 256) content = content.slice(0, 256);
  const out = [];
  let i = 0;
  while (i < content.length) {
    const c = content.charAt(i);
    if (/[a-zA-Z0-9]/.test(c)) {
      let j = i;
      while (j < content.length && /[a-zA-Z0-9]/.test(content.charAt(j))) j++;
      out.push({ kind: "alpha", text: content.substring(i, j) });
      i = j;
    } else if (c === "-" || c === "_" || c === "." || c === ":" || c === " ") {
      out.push({ kind: "sep", text: c });
      i++;
    } else {
      out.push({ kind: "other", text: c });
      i++;
    }
  }
  return out;
}

// ============================================================================
// Distinctiveness primitives
// ============================================================================
//
// Four primitives, each producing a score for a given token observation.
// The combined distinctiveness is a weighted combination; each primitive
// is observable from one source without corpus-level statistics.
//
// 1. HYPHENATION: token contains a hyphen. Code-generic identifiers
//    don't have hyphens in most languages; hyphenated tokens are almost
//    always domain-coined.
//
// 2. STRING_DOMINANCE: ratio of string-position occurrences to total
//    occurrences. High = token primarily appears in string literals.
//
// 3. BURSTINESS: variance of inter-occurrence gaps relative to mean
//    gap. High variance = clustered occurrences (domain content).
//    Low variance = uniform distribution (code-generic).
//
// 4. NEIGHBOR_SPECIFICITY: negative entropy of the distribution of
//    immediate neighbors (preceding token's text). High specificity =
//    characteristic neighbors (e.g., "prime" always near "credit",
//    "sub-", "near-"). Low specificity = promiscuous (e.g., "i" near
//    everything).
// ============================================================================

function scoreHyphenation(text) {
  if (text.indexOf("-") >= 0 && text.length > 1) {
    // Hyphen-bearing tokens get a strong boost. The position of the
    // hyphen matters: internal hyphens (sub-prime) are the strongest
    // indicator. Leading/trailing hyphens are often syntactic.
    if (text.charAt(0) === "-" || text.charAt(text.length - 1) === "-") return 0.4;
    return 0.9;
  }
  return 0;
}

function scoreStringDominance(occurrences) {
  // occurrences: array of { pos: POS_STR | POS_DECL | POS_REF | POS_OTHER }
  if (!occurrences || occurrences.length === 0) return 0;
  let strCount = 0;
  for (const o of occurrences) if (o.pos === POS_STR) strCount++;
  return clamp01(strCount / occurrences.length);
}

function scoreBurstiness(occurrences) {
  // occurrences sorted by absolute position. Compute inter-occurrence
  // gaps; compute coefficient of variation (std / mean) of gaps.
  // Score = clamp01((CV - 1) / 3). CV near 0 = uniform; CV >> 1 = bursty.
  if (!occurrences || occurrences.length < 4) return 0;
  const sorted = occurrences.slice().sort((a, b) => a.absPos - b.absPos);
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i].absPos - sorted[i - 1].absPos);
  }
  if (gaps.length === 0) return 0;
  let sum = 0;
  for (const g of gaps) sum += g;
  const mean = sum / gaps.length;
  if (mean === 0) return 0;
  let varSum = 0;
  for (const g of gaps) varSum += (g - mean) * (g - mean);
  const std = Math.sqrt(varSum / gaps.length);
  const cv = std / mean;
  // cv ~ 0: uniform; cv ~ 1: random/poisson; cv >> 1: bursty
  return clamp01((cv - 1) / 3);
}

function scoreNeighborSpecificity(occurrences) {
  // occurrences[].neighbor is the preceding non-ws token's text (or null).
  // Compute Shannon entropy H of neighbor distribution. Specificity
  // score = clamp01((maxH - H) / maxH) where maxH = log2(n_distinct).
  if (!occurrences || occurrences.length < 4) return 0;
  const counts = Object.create(null);
  let total = 0;
  for (const o of occurrences) {
    const n = o.neighbor || "<none>";
    counts[n] = (counts[n] || 0) + 1;
    total++;
  }
  if (total === 0) return 0;
  const distinct = Object.keys(counts).length;
  if (distinct <= 1) return 1.0;  // perfectly specific
  let h = 0;
  for (const k in counts) {
    const p = counts[k] / total;
    if (p > 0) h -= p * Math.log2(p);
  }
  const maxH = Math.log2(distinct);
  if (maxH === 0) return 0;
  return clamp01((maxH - h) / maxH);
}

// Combined distinctiveness: weighted average of the four scores.
// Weights chosen so any single strong signal can lift a token, but
// confluence of multiple signals dominates.
function combinedDistinctiveness(scores) {
  // scores: { hyphenation, stringDominance, burstiness, neighborSpecificity }
  const w = {
    hyphenation: 0.30,
    stringDominance: 0.25,
    burstiness: 0.20,
    neighborSpecificity: 0.25
  };
  let total = 0;
  total += w.hyphenation * (scores.hyphenation || 0);
  total += w.stringDominance * (scores.stringDominance || 0);
  total += w.burstiness * (scores.burstiness || 0);
  total += w.neighborSpecificity * (scores.neighborSpecificity || 0);
  return clamp01(total);
}

// ============================================================================
// The preparative substrate factory
// ============================================================================

function createPreparativeSubstrate(opts) {
  opts = opts || {};
  const id = String(opts.id || ("prep-" + crypto.randomBytes(4).toString("hex")));
  const constraintCap = requireFiniteInt(opts.constraintCap || CONSTRAINT_CAP_DEFAULT, "constraintCap");
  const traceCap = requireFiniteInt(opts.traceCap || TRACE_CAP_DEFAULT, "traceCap");

  let step = 0;
  let scalarDelta = 1.0;
  let totalTokensSeen = 0;
  let totalTextTokensSeen = 0;
  const trace = [];
  let sealed = false;

  // Per-token observation aggregator. Keys are token texts (with quote-
  // stripping for strings + sub-tokenization for hyphenated string
  // contents). Each entry holds: occurrences[], total derived
  // distinctiveness, and the eventual derived-kind assignment.
  const observations = Object.create(null);

  const SEED = Object.freeze({
    id: "seed::what-is-distinctive",
    family: "seed",
    pattern: { type: "seed" },
    permanent: true,
    weight: 1.0
  });

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

  // Record a single observation: a token at a given position with a
  // given preceding-neighbor context.
  function recordObservation(text, pos, neighbor, absPos, sourceTokKind) {
    if (typeof text !== "string" || text.length === 0) return;
    if (text.length > 64) text = text.slice(0, 64);
    if (!asciiOnly(text)) return;

    if (!observations[text]) {
      observations[text] = {
        text: text,
        occurrences: [],
        sourceKinds: Object.create(null)
      };
      if (Object.keys(observations).length > constraintCap) {
        // Age out: remove the entry with the fewest occurrences
        let evictKey = null, lowest = Infinity;
        for (const k in observations) {
          if (observations[k].occurrences.length < lowest) {
            lowest = observations[k].occurrences.length;
            evictKey = k;
          }
        }
        if (evictKey) delete observations[evictKey];
      }
    }
    const entry = observations[text];
    entry.occurrences.push({ pos: pos, neighbor: neighbor, absPos: absPos });
    entry.sourceKinds[sourceTokKind] = (entry.sourceKinds[sourceTokKind] || 0) + 1;
  }

  // Compute field delta: ratio of unresolved tokens (not yet scored)
  // to total. Stays > 0 throughout per F1.
  function computeFieldDelta() {
    const totalTokens = Object.keys(observations).length + 1;  // +1 for seed
    let scored = 0;
    for (const k in observations) {
      if (observations[k].distinctiveness !== undefined) scored++;
    }
    const unresolved = totalTokens - scored;
    return clamp01(unresolved / Math.max(1, totalTokens));
  }

  // The main observation pass: walk Stage 1's tokens, record each
  // text-bearing observation along with its position and neighbor.
  function ingestStage1Vsf(vsfText) {
    if (sealed) throw new Error("Preparative substrate is sealed");
    const parsed = parseStage1Vsf(vsfText);
    const tokens = parsed.rows;
    if (tokens.length === 0) return Object.freeze({ tokensSeen: 0, delta: scalarDelta });

    let lastNonWsText = null;

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      totalTokensSeen++;

      if (!TEXT_BEARING_KINDS[tok.kind]) {
        if (tok.kind !== "WHITESPACE") {
          lastNonWsText = tok.text || null;
        }
        scalarDelta = computeFieldDelta();
        continue;
      }

      totalTextTokensSeen++;

      const pos = derivePosClass(tokens, i);

      // For string literals, observe the whole stripped string AND
      // each alphanumeric sub-token. The sub-tokens are what carry
      // the morphological distinctiveness (sub, prime, mortgage).
      if (tok.kind === "STRING_DBL" || tok.kind === "STRING_SGL") {
        const stripped = stripQuotes(tok.text);
        // Whole-string observation (covers cases like "DENIED" used as
        // a single value).
        recordObservation(stripped, POS_STR, lastNonWsText, tok.start, tok.kind);
        // Sub-token observations
        const subs = subTokenizeStringContent(stripped);
        for (let s = 0; s < subs.length; s++) {
          if (subs[s].kind === "alpha") {
            // Neighbor is the prior alpha sub-token if present, else
            // the prior outer token.
            let neighbor = lastNonWsText;
            for (let p = s - 1; p >= 0; p--) {
              if (subs[p].kind === "alpha") { neighbor = subs[p].text; break; }
            }
            recordObservation(
              subs[s].text,
              POS_STR,
              neighbor,
              tok.start + s,  // approximate position
              tok.kind + "_inner"
            );
          }
        }
      } else {
        recordObservation(tok.text, pos, lastNonWsText, tok.start, tok.kind);
      }

      lastNonWsText = tok.text || null;
      scalarDelta = computeFieldDelta();

      if ((totalTokensSeen % 256) === 0) {
        recordTrace("crawl-progress", {
          tokensSeen: totalTokensSeen,
          textTokens: totalTextTokensSeen,
          observed: Object.keys(observations).length,
          delta: scalarDelta
        });
      }
    }

    // After the crawl, score every observation.
    scoreAllObservations();

    recordTrace("crawl-complete", {
      tokensSeen: totalTokensSeen,
      observed: Object.keys(observations).length,
      delta: scalarDelta
    });

    return Object.freeze({
      tokensSeen: totalTokensSeen,
      textTokens: totalTextTokensSeen,
      observed: Object.keys(observations).length,
      delta: scalarDelta
    });
  }

  function scoreAllObservations() {
    // For each observed token, compute the four primitive scores and the
    // combined distinctiveness. Then assign a derived kind class.
    for (const text in observations) {
      const entry = observations[text];
      const scores = {
        hyphenation:       scoreHyphenation(text),
        stringDominance:   scoreStringDominance(entry.occurrences),
        burstiness:        scoreBurstiness(entry.occurrences),
        neighborSpecificity: scoreNeighborSpecificity(entry.occurrences)
      };
      const distinctiveness = combinedDistinctiveness(scores);
      entry.scores = scores;
      entry.distinctiveness = distinctiveness;
      entry.derivedKind = assignDerivedKind(text, entry, distinctiveness);
    }
  }

  function assignDerivedKind(text, entry, distinctiveness) {
    // LIBRARY_REF takes precedence regardless of distinctiveness
    if (STDLIB_NAMES[text]) return DERIVED_KINDS.LIBRARY_REF;

    // Determine the dominant position class for this token
    let strCount = 0, declCount = 0, refCount = 0;
    for (const o of entry.occurrences) {
      if (o.pos === POS_STR) strCount++;
      else if (o.pos === POS_DECL) declCount++;
      else if (o.pos === POS_REF) refCount++;
    }
    const total = entry.occurrences.length;
    const strRatio  = total > 0 ? strCount  / total : 0;
    const declRatio = total > 0 ? declCount / total : 0;

    // High distinctiveness AND dominantly in string position -> DOMAIN_VALUE
    if (distinctiveness >= DOMAIN_VALUE_MIN_DISTINCTIVENESS && strRatio >= 0.5) {
      return DERIVED_KINDS.DOMAIN_VALUE;
    }
    // High distinctiveness AND dominantly in decl position -> DOMAIN_DIM
    if (distinctiveness >= DOMAIN_DIM_MIN_DISTINCTIVENESS && declRatio >= 0.3) {
      return DERIVED_KINDS.DOMAIN_DIM;
    }
    // Low distinctiveness with high frequency -> IDIOMATIC
    if (distinctiveness <= IDIOMATIC_MAX_DISTINCTIVENESS && total >= 4) {
      return DERIVED_KINDS.IDIOMATIC;
    }
    return DERIVED_KINDS.UNCLASSIFIED;
  }

  // ============================================================
  // The preparative map: serializable structure for IndexedDB
  // ============================================================

  function buildPreparativeMap(sourceContent) {
    if (!sealed && Object.keys(observations).length === 0) {
      throw new Error("buildPreparativeMap called before any ingestion");
    }
    const sourceHash = sha256Hex(sourceContent);
    const entries = [];
    for (const text in observations) {
      const entry = observations[text];
      // Skip UNCLASSIFIED entries to keep the map compact - downstream
      // consumers fall back to default Stage 1 typing for unmapped
      // tokens, which is the right behavior.
      if (entry.derivedKind === DERIVED_KINDS.UNCLASSIFIED) continue;
      entries.push({
        text: text,
        derivedKind: entry.derivedKind,
        distinctiveness: entry.distinctiveness,
        occurrenceCount: entry.occurrences.length,
        scores: {
          h:  +entry.scores.hyphenation.toFixed(3),
          sd: +entry.scores.stringDominance.toFixed(3),
          b:  +entry.scores.burstiness.toFixed(3),
          ns: +entry.scores.neighborSpecificity.toFixed(3)
        }
      });
    }
    // Sort by distinctiveness desc for diagnostic friendliness
    entries.sort((a, b) => b.distinctiveness - a.distinctiveness);

    const mapObj = {
      version: VERSION,
      sourceHash: sourceHash,
      sourceBytes: sourceContent.length,
      seed: SEED,
      timestamp: 0,           // caller fills this when writing to IDB
      tokensSeen: totalTokensSeen,
      textTokensSeen: totalTextTokensSeen,
      entries: entries
    };
    return Object.freeze(mapObj);
  }

  function getState() {
    return Object.freeze({
      id: id,
      version: VERSION,
      step: step,
      sealed: sealed,
      delta: scalarDelta,
      totalTokensSeen: totalTokensSeen,
      totalTextTokensSeen: totalTextTokensSeen,
      observationCount: Object.keys(observations).length,
      trace: trace.slice(),
      seed: SEED
    });
  }

  function seal() {
    if (sealed) return "";
    sealed = true;
    let h = sha256Hex(VERSION + ":" + id);
    const keys = Object.keys(observations).sort();
    for (const k of keys) {
      h = sha256Hex(h + ":" + k + ":" + (observations[k].derivedKind || ""));
    }
    return h;
  }

  return Object.freeze({
    id: id,
    version: VERSION,
    ingestStage1Vsf: ingestStage1Vsf,
    buildPreparativeMap: buildPreparativeMap,
    getState: getState,
    seal: seal,
    // Exposed for tests
    _observations: function () { return observations; },
    _scoreAllObservations: scoreAllObservations
  });
}

// ============================================================================
// Preparative-map application: enrich Stage 1's emission
// ============================================================================
//
// Given a preparative map plus a Stage 1 VSF emission, produce an enriched
// VSF where token kinds are upgraded according to the map's classifications.
// Tokens with a DOMAIN_VALUE classification get their kind changed to
// DOMAIN_VALUE; tokens with DOMAIN_DIM get DOMAIN_DIM; etc. Tokens not in
// the map keep their original Stage 1 kind.
//
// This is the consumption side: downstream substrates (kind peer, text
// peer, string peer) ingest the enriched VSF and see the structurally-
// distinctive tokens with their derived kinds, so their primitives operate
// on a richer typing scheme than Stage 1's generic one.
// ============================================================================

function applyPreparativeMapToVsf(vsfText, preparativeMap) {
  if (typeof vsfText !== "string") throw new TypeError("vsfText must be string");
  if (!preparativeMap || !preparativeMap.entries) {
    throw new TypeError("preparativeMap must have entries[]");
  }

  // Build a lookup: text -> derivedKind
  const lookup = Object.create(null);
  for (const e of preparativeMap.entries) {
    lookup[e.text] = e.derivedKind;
  }

  const sepIdx = vsfText.indexOf("\n---\n");
  if (sepIdx < 0) throw new Error("vsf missing separator");
  const header = vsfText.slice(0, sepIdx);
  const body = vsfText.slice(sepIdx + 5);
  const lines = body.split("\n");

  const enrichedLines = [];
  for (const line of lines) {
    if (line.length === 0) { enrichedLines.push(line); continue; }
    const f = line.split("|");
    if (f.length < 6) { enrichedLines.push(line); continue; }
    const text = f[4];
    // Try whole-string match first
    let mappedKind = null;
    if (lookup[text]) {
      mappedKind = lookup[text];
    } else {
      // For strings, try the stripped form
      const stripped = stripQuotes(text);
      if (stripped !== text && lookup[stripped]) {
        mappedKind = lookup[stripped];
      }
    }
    if (mappedKind && mappedKind !== "UNCLASSIFIED") {
      // Replace the kind field
      f[2] = mappedKind;
      enrichedLines.push(f.join("|"));
    } else {
      enrichedLines.push(line);
    }
  }

  return header + "\n---\n" + enrichedLines.join("\n");
}

// ============================================================================
// Exports
// ============================================================================

module.exports = Object.freeze({
  VERSION: VERSION,
  DERIVED_KINDS: DERIVED_KINDS,
  TEXT_BEARING_KINDS: TEXT_BEARING_KINDS,
  FIDELITY_PROMOTE: FIDELITY_PROMOTE,
  FIDELITY_MIN_FIRES: FIDELITY_MIN_FIRES,
  SUB_CASCADE_CAP: SUB_CASCADE_CAP,
  parseStage1Vsf: parseStage1Vsf,
  createPreparativeSubstrate: createPreparativeSubstrate,
  applyPreparativeMapToVsf: applyPreparativeMapToVsf,
  asciiOnly: asciiOnly,
  sha256Hex: sha256Hex,
  // pure helpers for tests
  derivePosClass: derivePosClass,
  stripQuotes: stripQuotes,
  subTokenizeStringContent: subTokenizeStringContent,
  scoreHyphenation: scoreHyphenation,
  scoreStringDominance: scoreStringDominance,
  scoreBurstiness: scoreBurstiness,
  scoreNeighborSpecificity: scoreNeighborSpecificity,
  combinedDistinctiveness: combinedDistinctiveness
});
