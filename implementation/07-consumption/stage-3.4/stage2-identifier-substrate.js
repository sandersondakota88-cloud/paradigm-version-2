// stage2-identifier-substrate.js - SE-10 chain link 2 (parallel peer)

"use strict";

const crypto = require("crypto");

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const VERSION = "stage2-identifier-1.0.0";

// Same regime as Stage 2: firing-frequency relative to field average.
const FIDELITY_PROMOTE   = 2.5;   // top-member firing-rate multiplier vs field avg
const FIDELITY_MIN_FIRES = 8;     // min firings before family is eligible
const SUB_CASCADE_CAP    = 24;    // matches canonical / Stage 2

// Bounded caps. Identifier space can be larger than kind space (every
// distinct text value is a candidate constraint), so caps are sized
// generously but bounded.
const CONSTRAINT_CAP_DEFAULT  = 8192;
const CORRELATION_CAP_DEFAULT = 8192;
const ROW_CAP_DEFAULT         = 32768;
const TRACE_CAP_DEFAULT       = 8192;
const NAMING_PREF_CAP         = 1.0;

// Co-occurrence window. Same shape as Stage 2's, but the unit is tokens
// of text (we ignore whitespace tokens for co-occurrence; otherwise every
// adjacent identifier pair would trivially co-occur with whitespace).
const COOC_WINDOW = 4;

// Token kinds (from Stage 1) that carry identifier-class text. Stage 1
// emits kinds verbatim; we treat these as the "text-bearing" kinds whose
// values populate the application's vocabulary.
const TEXT_BEARING_KINDS = Object.freeze({
  "ALPHA_RUN":   true,
  "IDENT":       true,
  "DIGIT_RUN":   true,
  "STRING_DBL":  true,
  "STRING_SGL":  true,
  "KEYWORD":     true   // KEYWORD is recognized in Stage 1 pass 2; we
                        // include it so that "var", "function", "return"
                        // also appear in the recurrence distribution. The
                        // identifier substrate doesn't suppress keywords;
                        // the composer's job is to discriminate, not ours.
});

// Position classes. Computed from the surrounding token kinds within a
// small window (PASS_WINDOW tokens). We keep this scheme minimal so it
// is interpretable in test output.
//
//   DECL  : preceded recently by a KEYWORD that introduces a binding
//           (var, let, const, function, class)
//   STR   : the token IS itself a STRING_DBL or STRING_SGL
//   ATTR  : appears immediately after a "[" (PUNCT_OPEN whose text is "[")
//           with structure suggestive of attribute selector: this is the
//           position the loan-app's [data-debt='heavy'] occupies
//   REF   : token is alphabetic and not in any other class
//   NUM   : token is DIGIT_RUN
//   OTHER : everything else
//
// The classes are intentionally coarse. Finer classes can be added once
// the substrate's behavior on the coarse classes is understood.
const POS_CLASSES = Object.freeze({
  DECL: "DECL",
  STR:  "STR",
  ATTR: "ATTR",
  REF:  "REF",
  NUM:  "NUM",
  OTHER: "OTHER"
});

const DECL_KEYWORDS = Object.freeze({
  "var": true, "let": true, "const": true,
  "function": true, "class": true
});

// ----------------------------------------------------------------------------
// Guards (I1, I2)
// ----------------------------------------------------------------------------

function requireString(v, name) {
  if (typeof v !== "string") throw new TypeError(name + " must be string");
  return v;
}
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
// Stage 1 VSF parsing
// ----------------------------------------------------------------------------
// Same parser shape as Stage 2's (and same I1 enforcement). We don't import
// Stage 2's parser because SE-10 commits each link to autonomy; this peer
// owns its own parsing.

function parseStage1Vsf(vsfText) {
  if (typeof vsfText !== "string") throw new TypeError("vsfText must be string");
  if (!asciiOnly(vsfText)) throw new Error("vsf must be ASCII-only (I1)");
  const sepIdx = vsfText.indexOf("\n---\n");
  if (sepIdx < 0) throw new Error("vsf missing header/body separator");
  const headerSection = vsfText.slice(0, sepIdx);
  const bodySection = vsfText.slice(sepIdx + 5);

  const headerTriads = headerSection.split(" | ").filter(function (s) {
    return s.length > 0;
  });

  const lines = bodySection.split("\n").filter(function (s) {
    return s.length > 0;
  });
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length > 4096) continue;        // algorithm 10 row cap
    const f = lines[i].split("|");
    if (f.length < 6) continue;
    const start = parseInt(f[0], 10);
    const end = parseInt(f[1], 10);
    const kind = f[2];
    const conf = parseInt(f[3], 10);
    const text = f[4];
    const passes = parseInt(f[5], 10);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (typeof kind !== "string" || kind.length === 0) continue;
    rows.push(Object.freeze({
      start: start,
      end: end,
      kind: kind,
      conf: Number.isFinite(conf) ? conf : 0,
      text: text || "",
      passes: Number.isFinite(passes) ? passes : 1
    }));
  }
  return Object.freeze({
    headerTriads: Object.freeze(headerTriads),
    rows: Object.freeze(rows)
  });
}

// ----------------------------------------------------------------------------
// Position-class derivation
// ----------------------------------------------------------------------------
// Look at a small window of surrounding tokens (we only look back; Stage 1
// emits sequentially and a forward-looking window would require lookahead
// which the substrate avoids). Recent prior kinds determine class.

function deriveTextPosClass(tokens, idx) {
  const tok = tokens[idx];
  if (tok.kind === "STRING_DBL" || tok.kind === "STRING_SGL") return POS_CLASSES.STR;
  if (tok.kind === "DIGIT_RUN") return POS_CLASSES.NUM;

  // Look back through the small window. We skip whitespace tokens because
  // they are the formatting layer; positional context lives in the non-
  // whitespace neighbors.
  let lookback = 0;
  for (let j = idx - 1; j >= 0 && lookback < 4; j--) {
    const prev = tokens[j];
    if (prev.kind === "WHITESPACE") continue;
    lookback++;
    // ATTR: previous non-whitespace token is "[" (PUNCT_OPEN with text "[")
    if (prev.kind === "PUNCT_OPEN" && prev.text === "[") {
      return POS_CLASSES.ATTR;
    }
    // DECL: previous non-whitespace token is a binding-introducing keyword
    if (prev.kind === "KEYWORD" && DECL_KEYWORDS[prev.text]) {
      return POS_CLASSES.DECL;
    }
    // After the first non-whitespace lookback, if it isn't a marker, stop
    // (we don't want to scan arbitrarily far; positional context is local)
    if (lookback >= 2) break;
  }

  if (tok.kind === "ALPHA_RUN" || tok.kind === "IDENT" || tok.kind === "KEYWORD") {
    return POS_CLASSES.REF;
  }
  return POS_CLASSES.OTHER;
}

// ----------------------------------------------------------------------------
// The identifier substrate's text-axis constraint primitives
// ----------------------------------------------------------------------------
//
// IDENT_RECUR : one text value recurs. Family member is the specific text.
//               Stage 2's repetition primitive, but keyed on text only
//               (not kind+text), so identical text appearing under
//               different kinds (e.g., "true" as KEYWORD vs as ALPHA_RUN
//               in different contexts) is one constraint. This is what
//               makes the application's vocabulary visible.
//
// IDENT_COOC  : two text values co-occur within a window of text-bearing
//               tokens. Pairs are unordered. This is where domain
//               structure shows up: "data-debt" co-occurring with "heavy",
//               "mortgage" co-occurring with "sub-prime".
//
// IDENT_POS   : a text value appears in a specific position class (DECL,
//               STR, ATTR, REF, NUM). Family member is (text, posClass).
//               This separates "mortgage" appearing as a string-literal
//               value from "mortgage" appearing as a function name; in
//               the loan-app the domain vocabulary lives almost
//               exclusively in STR position.
// ----------------------------------------------------------------------------

const PRIMITIVE_KINDS = Object.freeze({
  IDENT_RECUR: "IDENT_RECUR",
  IDENT_COOC:  "IDENT_COOC",
  IDENT_POS:   "IDENT_POS"
});

function deriveIdentRecurConstraint(tok) {
  let text = tok.text || "";
  if (typeof text !== "string") text = "";
  if (text.length > 64) text = text.slice(0, 64);
  if (!asciiOnly(text)) return null;
  if (text.length === 0) return null;
  return Object.freeze({
    primitive: PRIMITIVE_KINDS.IDENT_RECUR,
    family: "ident-recur",
    pattern: { type: "ident-recur", text: text, key: text },
    members: { text: text, kind: tok.kind }
  });
}

function deriveIdentCoocConstraint(textA, textB) {
  if (!textA || !textB || textA === textB) return null;
  if (textA.length > 64) textA = textA.slice(0, 64);
  if (textB.length > 64) textB = textB.slice(0, 64);
  if (!asciiOnly(textA) || !asciiOnly(textB)) return null;
  // Sort to make the pair unordered; same pair regardless of which came first.
  const pair = textA < textB ? (textA + "<>" + textB) : (textB + "<>" + textA);
  return Object.freeze({
    primitive: PRIMITIVE_KINDS.IDENT_COOC,
    family: "ident-cooc",
    pattern: { type: "ident-cooc", a: textA, b: textB, key: pair },
    members: { aText: textA, bText: textB }
  });
}

function deriveIdentPosConstraint(tok, posClass) {
  let text = tok.text || "";
  if (typeof text !== "string") text = "";
  if (text.length > 64) text = text.slice(0, 64);
  if (!asciiOnly(text)) return null;
  if (text.length === 0) return null;
  return Object.freeze({
    primitive: PRIMITIVE_KINDS.IDENT_POS,
    family: "ident-pos",
    pattern: { type: "ident-pos", text: text, pos: posClass, key: text + "@@" + posClass },
    members: { text: text, pos: posClass }
  });
}

// ----------------------------------------------------------------------------
// The substrate factory
// ----------------------------------------------------------------------------

function createIdentifierSubstrate(opts) {
  opts = opts || {};
  const id = String(opts.id || ("ident-" + crypto.randomBytes(4).toString("hex")));
  const constraintCap = requireFiniteInt(opts.constraintCap || CONSTRAINT_CAP_DEFAULT, "constraintCap");
  const correlationCap = requireFiniteInt(opts.correlationCap || CORRELATION_CAP_DEFAULT, "correlationCap");
  const rowCap = requireFiniteInt(opts.rowCap || ROW_CAP_DEFAULT, "rowCap");
  const traceCap = requireFiniteInt(opts.traceCap || TRACE_CAP_DEFAULT, "traceCap");

  // Field state - mirrors Stage 2's shape exactly so the composer can
  // read both substrates through the same pattern.
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
  let totalTokensSeen = 0;          // counts Stage 1 rows ingested
  let totalTextTokensSeen = 0;      // counts text-bearing tokens specifically
  const trace = [];
  const rows = [];
  let sealed = false;

  // The seed (F1, SE-04). Permanent. Forces delta read on every operation.
  // This substrate's seed is its own (per-instance per X1); the seed-as-
  // concept is universal but the seed-as-storage is per-substrate.
  const SEED = Object.freeze({
    id: "seed::what-is-delta",
    family: "seed",
    pattern: { type: "seed" },
    permanent: true,
    weight: 1.0
  });

  // ------------------------------------------------------------------
  // Helpers (mirror Stage 2's where the mechanism is identical)
  // ------------------------------------------------------------------

  function nextId() {
    idCtr++;
    return "ic::" + idCtr;
  }

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
    // Linear scan for matching constraint. Larger cap than Stage 2; we
    // accept the cost for now and will revisit if profiling shows it
    // matters. Stage 2 also scans linearly; the architecture's promotion
    // mechanics are the same here.
    for (let i = 0; i < constraints.length; i++) {
      const c = constraints[i];
      if (c.family !== derivation.family) continue;
      if (c.pattern && c.pattern.key === key) return c;
    }
    if (constraints.length >= constraintCap) {
      // Age out: evict lowest-weight constraint. The seed is not in this
      // array (it is a separate object); so eviction never touches it.
      let evictIdx = -1;
      let lowest = Infinity;
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
    if (!familyFidelity[family]) {
      familyFidelity[family] = { totalFires: 0 };
    }
    familyFidelity[family].totalFires++;
  }

  function fieldAverageConstraintFires() {
    if (constraints.length === 0) return 0;
    let total = 0;
    for (let i = 0; i < constraints.length; i++) {
      total += constraints[i].uses || 0;
    }
    return total / constraints.length;
  }

  function fidelityOf(family) {
    // Same firing-frequency-relative-to-field-average fidelity as Stage 2.
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
    if (p.type === "ident-recur")     raw = "id-recur-" + (p.text || "");
    else if (p.type === "ident-cooc") raw = "id-cooc-" + (p.a || "") + "-" + (p.b || "");
    else if (p.type === "ident-pos")  raw = "id-pos-" + (p.text || "") + "-" + (p.pos || "");
    else                              raw = String(p.type);
    let name = raw.toLowerCase().replace(/[^a-z0-9-]/g, "").substring(0, 48);
    if (!name) name = "ic";
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
        family: fam,
        name: name,
        members: memberIds.length,
        fidAtBirth: fidelityValue
      });
    }
    return promoted;
  }

  // K3: naming preference accumulates from operation. Same mechanism as
  // Stage 2 - bump namingPref each time a sub-cascade's name appears in
  // the token stream's text.
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
    // Same F2 formula as Stage 2 - unresolved/total at field scope.
    let total = constraints.length + 1;  // +1 for seed
    let resolved = 0;
    for (let i = 0; i < constraints.length; i++) {
      if ((constraints[i].uses || 0) > 0 && (constraints[i].weight || 0) > 0.5) resolved++;
    }
    const unresolved = total - resolved;
    return clamp01(unresolved / Math.max(1, total));
  }

  // ------------------------------------------------------------------
  // The main ingestion loop
  // ------------------------------------------------------------------
  // Reads Stage 1's VSF emission, walks the row stream, fires the
  // identifier-axis primitives. Mirrors Stage 2's loop in shape but
  // operates on text values, not on token kinds.

  function ingestStage1Vsf(vsfText) {
    if (sealed) throw new Error("Identifier substrate is sealed");
    const parsed = parseStage1Vsf(vsfText);
    const tokens = parsed.rows;
    if (tokens.length === 0) return Object.freeze({ tokensSeen: 0, delta: scalarDelta });

    // SE-08 boundary: bytes (the Stage 1 vsf) are observed; tokens (rows)
    // are this substrate's input feature records.

    // Recent text-bearing tokens for co-occurrence windowing. We track
    // a small ring; when a new text-bearing token arrives, it co-occurs
    // with each token already in the ring.
    const textRing = [];   // entries: { text, kind, idx }

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      totalTokensSeen++;
      prevDelta = scalarDelta;

      // We only fire identifier-axis primitives on text-bearing tokens.
      // Whitespace, punctuation, comments are positional context, not
      // identifier content.
      if (!TEXT_BEARING_KINDS[tok.kind]) {
        // Still update delta and record progress for non-text tokens, so
        // F1's continuous evaluation property holds.
        scalarDelta = computeFieldDelta();
        if ((totalTokensSeen % 256) === 0) {
          recordTrace("crawl-progress", {
            tokensSeen: totalTokensSeen,
            textTokens: totalTextTokensSeen,
            constraints: constraints.length,
            subcascades: subcascades.length,
            delta: scalarDelta
          });
        }
        continue;
      }

      totalTextTokensSeen++;
      const firedThisStep = [];

      // IDENT_RECUR: this text value appeared.
      const recurDeriv = deriveIdentRecurConstraint(tok);
      if (recurDeriv) {
        const c = findOrCreateConstraint(recurDeriv);
        if (c) { markUsed(c); firedThisStep.push(c); }
      }

      // IDENT_POS: this text appeared in a specific position class.
      const posClass = deriveTextPosClass(tokens, i);
      const posDeriv = deriveIdentPosConstraint(tok, posClass);
      if (posDeriv) {
        const c = findOrCreateConstraint(posDeriv);
        if (c) { markUsed(c); firedThisStep.push(c); }
      }

      // IDENT_COOC: this text co-occurs with each text-bearing token in
      // the recent ring.
      for (let r = 0; r < textRing.length; r++) {
        const partner = textRing[r];
        const coocDeriv = deriveIdentCoocConstraint(partner.text, tok.text);
        if (coocDeriv) {
          const c = findOrCreateConstraint(coocDeriv);
          if (c) { markUsed(c); firedThisStep.push(c); }
        }
      }

      // Update text ring.
      textRing.push({ text: tok.text, kind: tok.kind, idx: i });
      while (textRing.length > COOC_WINDOW) textRing.shift();

      // Correlations across constraints fired this step.
      for (let j = 0; j < firedThisStep.length; j++) {
        for (let k = j + 1; k < firedThisStep.length; k++) {
          recordCorrelation(firedThisStep[j].id, firedThisStep[k].id);
        }
      }

      // F1 seed: continuous delta read.
      scalarDelta = computeFieldDelta();

      // Family fidelity: count one firing per family per step. Mirrors
      // Stage 2's scheme exactly.
      const familiesThisStep = Object.create(null);
      for (let j = 0; j < firedThisStep.length; j++) {
        familiesThisStep[firedThisStep[j].family] = true;
      }
      for (const fam in familiesThisStep) {
        recordFamilyFiring(fam);
      }

      // K3 naming detection.
      detectNamingInToken(tok);

      // Periodic promotion check (every 32 text-bearing tokens to bound
      // cost; same cadence as Stage 2's check).
      if ((totalTextTokensSeen % 32) === 0) {
        checkPromotions();
      }

      // Periodic progress trace.
      if ((totalTokensSeen % 256) === 0) {
        recordTrace("crawl-progress", {
          tokensSeen: totalTokensSeen,
          textTokens: totalTextTokensSeen,
          constraints: constraints.length,
          subcascades: subcascades.length,
          delta: scalarDelta
        });
      }
    }

    // Final promotion sweep after crawl.
    checkPromotions();

    // Emit rows for promoted sub-cascades.
    emitRowsFromSubcascades();

    recordTrace("crawl-complete", {
      tokensSeen: totalTokensSeen,
      textTokens: totalTextTokensSeen,
      constraints: constraints.length,
      subcascades: subcascades.length,
      delta: scalarDelta
    });

    return Object.freeze({
      tokensSeen: totalTokensSeen,
      textTokens: totalTextTokensSeen,
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
      totalTextTokensSeen: totalTextTokensSeen,
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
    // Stage 2-shaped VSF. The composer reads this through the same
    // pattern Stage 2's emission uses.
    const triads = [
      "kind:subcascade=0,ident-recur=1,ident-cooc=2,ident-pos=3|0|3",
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
    // Exposed for test harness to verify substrate equivalence.
    _checkPromotions: checkPromotions,
    _computeFieldDelta: computeFieldDelta,
    _deriveTextPosClass: function (tokens, idx) {
      return deriveTextPosClass(tokens, idx);
    }
  });
}

// ----------------------------------------------------------------------------
// Exports
// ----------------------------------------------------------------------------

module.exports = Object.freeze({
  VERSION: VERSION,
  PRIMITIVE_KINDS: PRIMITIVE_KINDS,
  POS_CLASSES: POS_CLASSES,
  TEXT_BEARING_KINDS: TEXT_BEARING_KINDS,
  FIDELITY_PROMOTE: FIDELITY_PROMOTE,
  FIDELITY_MIN_FIRES: FIDELITY_MIN_FIRES,
  SUB_CASCADE_CAP: SUB_CASCADE_CAP,
  COOC_WINDOW: COOC_WINDOW,
  parseStage1Vsf: parseStage1Vsf,
  createIdentifierSubstrate: createIdentifierSubstrate,
  asciiOnly: asciiOnly,
  sha256Hex: sha256Hex,
  // Pure helpers exposed for tests.
  deriveTextPosClass: deriveTextPosClass,
  deriveIdentRecurConstraint: deriveIdentRecurConstraint,
  deriveIdentCoocConstraint: deriveIdentCoocConstraint,
  deriveIdentPosConstraint: deriveIdentPosConstraint
});
