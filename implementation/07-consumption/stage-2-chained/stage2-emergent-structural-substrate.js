// stage2-emergent-structural-substrate.js - SE-10 chain link 2 of N

"use strict";

const crypto = require("crypto");

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const VERSION = "stage2-1.0.0";

// Stage-2-specific fidelity thresholds (frequency-based, see header comment)
const FIDELITY_PROMOTE   = 2.5;   // firing-rate multiplier vs field avg
const FIDELITY_MIN_FIRES = 8;     // min firings before eligible
const SUB_CASCADE_CAP    = 24;    // matches canonical

// Bounded caps for Stage 2 specifically
const CONSTRAINT_CAP_DEFAULT  = 4096;
const CORRELATION_CAP_DEFAULT = 8192;
const ROW_CAP_DEFAULT         = 32768;
const TRACE_CAP_DEFAULT       = 8192;
const NAMING_PREF_CAP         = 1.0;

// Stage 2's universal primitives
const PRIMITIVE_KINDS = Object.freeze({
  COOC:        "COOC",          // two kinds co-occur within a window
  TRANSITION:  "TRANSITION",    // kind A immediately precedes kind B
  REPETITION:  "REPETITION",    // text appears multiple times
  RUN:         "RUN",           // same kind appears in a homogeneous run
  TRIPLE:      "TRIPLE"         // three-kind sequence (only after promotion)
});

// Window size for co-occurrence detection
const COOC_WINDOW = 4;

// ----------------------------------------------------------------------------
// Guards
// ----------------------------------------------------------------------------

function requireString(v, name) {
  if (typeof v !== "string") throw new TypeError(name + " must be string");
  return v;
}
function requireFiniteInt(v, name) {
  if (typeof v !== "number" || !Number.isFinite(v) || Math.floor(v) !== v)
    throw new TypeError(name + " must be finite int");
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
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

// ----------------------------------------------------------------------------
// VSF parsing - intake of Stage 1 emission
// ----------------------------------------------------------------------------
//
// Stage 1 emits VSF as: header section, "---" separator, body section.
// Stage 2 parses this back into token records. It does not call Stage 1;
// it reads the bytes Stage 1 deposited at the channel (M5).
//
// Stage 1 row body shape: start | end | kind | conf | text | passes
// ----------------------------------------------------------------------------

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
// Stage 2's universal constraint primitives
// ----------------------------------------------------------------------------
//
// Each primitive is a generator of derived constraints. When the substrate
// observes the token stream, primitives fire and produce derived constraint
// records carrying their family-type tag. Family fidelity accumulates per
// type; promotion produces sub-cascades named from the dominant member's
// pattern (K3 honored).
//
// The primitives are universal in the sense that any token stream produces
// some firings under them. They do not embed knowledge of source structure.
// ----------------------------------------------------------------------------

function deriveCoocConstraint(tokA, tokB) {
  // Co-occurrence: tokA and tokB observed within COOC_WINDOW.
  // FAMILY is the primitive type ("cooc"). Specific kind-pair lives in
  // the pattern, making each pair a member of the cooc family. Promotion
  // surfaces the cooc family when its members - the specific kind-pairs -
  // collectively fire above field average.
  const kindPair = [tokA.kind, tokB.kind].sort().join("--");
  return Object.freeze({
    primitive: PRIMITIVE_KINDS.COOC,
    family: "cooc",
    pattern: { type: "cooc", a: tokA.kind, b: tokB.kind, key: kindPair },
    members: { aText: tokA.text, bText: tokB.text }
  });
}

function deriveTransitionConstraint(tokA, tokB) {
  // Directed transition: tokA immediately followed by tokB.
  const dirPair = tokA.kind + ">>" + tokB.kind;
  return Object.freeze({
    primitive: PRIMITIVE_KINDS.TRANSITION,
    family: "trans",
    pattern: { type: "transition", from: tokA.kind, to: tokB.kind, key: dirPair },
    members: { fromText: tokA.text, toText: tokB.text }
  });
}

function deriveRepetitionConstraint(tok) {
  let text = tok.text;
  if (typeof text !== "string") text = "";
  if (text.length > 64) text = text.slice(0, 64);
  if (!asciiOnly(text)) return null;
  return Object.freeze({
    primitive: PRIMITIVE_KINDS.REPETITION,
    family: "rep",
    pattern: { type: "repetition", kind: tok.kind, text: text, key: tok.kind + "::" + text },
    members: { text: text }
  });
}

function deriveRunConstraint(tokens) {
  if (!tokens || tokens.length < 2) return null;
  const kind = tokens[0].kind;
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i].kind !== kind) return null;
  }
  return Object.freeze({
    primitive: PRIMITIVE_KINDS.RUN,
    family: "run",
    pattern: { type: "run", kind: kind, length: tokens.length, key: kind + "::" + tokens.length },
    members: { kind: kind, length: tokens.length }
  });
}

// ----------------------------------------------------------------------------
// The Stage 2 substrate factory
// ----------------------------------------------------------------------------

function createStage2Substrate(opts) {
  opts = opts || {};
  const id = String(opts.id || ("stage2-" + crypto.randomBytes(4).toString("hex")));
  const constraintCap = requireFiniteInt(opts.constraintCap || CONSTRAINT_CAP_DEFAULT, "constraintCap");
  const correlationCap = requireFiniteInt(opts.correlationCap || CORRELATION_CAP_DEFAULT, "correlationCap");
  const rowCap = requireFiniteInt(opts.rowCap || ROW_CAP_DEFAULT, "rowCap");
  const traceCap = requireFiniteInt(opts.traceCap || TRACE_CAP_DEFAULT, "traceCap");

  // Field state
  const constraints = [];        // {id, family, pattern, kind: "derived"/"ratified", uses, weight, lastUsed, members}
  const constraintsById = Object.create(null);
  const constraintsByKey = Object.create(null);  // family + "##" + pattern.key -> constraint, O(1) lookup
  let idCtr = 0;
  const correlations = Object.create(null);  // key -> {a, b, coFire, lastSeen}
  const familyFidelity = Object.create(null); // family -> {observations, totalFires, lastDelta}
  const subcascades = [];        // {id, name, familyType, memberIds, birth, lastNamed, namedCount, fidAtBirth}
  const namedSubsByName = Object.create(null);

  let step = 0;
  let scalarDelta = 1.0;
  let prevDelta = 1.0;
  let namingPref = 0.0;
  let totalTokensSeen = 0;
  const trace = [];
  const rows = [];               // Stage 2 emission rows
  let sealed = false;

  // The seed (F1, SE-04). Permanent. Forces delta read on every operation.
  const SEED = Object.freeze({
    id: "seed::what-is-delta",
    family: "seed",
    pattern: { type: "seed" },
    permanent: true,
    weight: 1.0
  });

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  function nextId() {
    idCtr++;
    return "c::" + idCtr;
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
    // Look for existing constraint with matching family + pattern.key
    // (constraint identity is family + specific pattern instance; same
    // observation converges to one constraint with rising weight).
    const key = derivation.pattern && derivation.pattern.key;
    for (let i = 0; i < constraints.length; i++) {
      const c = constraints[i];
      if (c.family !== derivation.family) continue;
      if (c.pattern && c.pattern.key === key) return c;
    }
    if (constraints.length >= constraintCap) {
      // Age out: evict the oldest non-seed, lowest-weight constraint.
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
    // Bound correlations
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
    // Frequency fidelity: how prominent the family's top-firing members
    // are relative to field-average constraint firings.
    // We take the family's top member's uses divided by field average.
    // A family with one or more "lighthouse" members (firing far above
    // the average constraint) has high fidelity; this captures families
    // whose specific instances the application's structure extrudes.
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
    if (p.type === "cooc")        raw = "cooc-" + p.a + "-" + p.b;
    else if (p.type === "transition") raw = "trans-" + p.from + "-" + p.to;
    else if (p.type === "repetition") raw = "rep-" + p.kind + "-" + (p.text || "");
    else if (p.type === "run")    raw = "run-" + p.kind + "-" + p.length;
    else                          raw = String(p.type);
    let name = raw.toLowerCase().replace(/[^a-z0-9-]/g, "").substring(0, 32);
    if (!name) name = "sc";
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
      const avg = fidelityOf(fam);
      if (avg < FIDELITY_PROMOTE) continue;
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
        fidAtBirth: avg
      };
      subcascades.push(sc);
      namedSubsByName[name] = sc;
      promoted.push(sc);
      recordTrace("promote", { family: fam, name: name, members: memberIds.length, fidAtBirth: avg });
    }
    return promoted;
  }

  // K3: naming preference accumulates from operation. We bump namingPref
  // each time a sub-cascade's name appears in a token's text within the
  // ingestion stream.
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
    // F2 single formula: unresolvedDims / totalDims at field scope.
    // For Stage 2: a constraint contributes "resolved" if uses > 0 and
    // weight > 0.5 (it has fired at least once and has gained weight from
    // markUsed). Constraints not yet fired or aged-out-low-weight contribute
    // unresolved. The seed always counts toward totalDims and is always
    // unresolved (F1 seed permanent unresolvable).
    let total = constraints.length + 1;  // +1 for seed
    let resolved = 0;
    for (let i = 0; i < constraints.length; i++) {
      if ((constraints[i].uses || 0) > 0 && (constraints[i].weight || 0) > 0.5) resolved++;
    }
    const unresolved = total - resolved;
    return clamp01(unresolved / Math.max(1, total));
  }

  function ingestStage1Vsf(vsfText) {
    if (sealed) throw new Error("Stage 2 substrate is sealed");
    const parsed = parseStage1Vsf(vsfText);
    const tokens = parsed.rows;
    if (tokens.length === 0) return Object.freeze({ tokensSeen: 0, delta: scalarDelta });

    // SE-08: bytes (the vsf text) entered at the rendering substrate; tokens
    // are the input feature records the rendering substrate produces for
    // Stage 2's parallel resolution.

    // We crawl the entire token stream. No depth restriction. Recurrence
    // emerges from the substrate's own settling. Pre-derived values:
    // co-occurrence within window, directed transitions, run detection,
    // text repetition.

    const lastFirings = []; // ring of last constraint ids for correlation tracking

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      totalTokensSeen++;
      prevDelta = scalarDelta;

      // Derive primitive constraints relevant to this token
      const firedThisStep = [];

      // Repetition
      const repDeriv = deriveRepetitionConstraint(tok);
      if (repDeriv) {
        const c = findOrCreateConstraint(repDeriv);
        if (c) { markUsed(c); firedThisStep.push(c); }
      }

      // Transition (with prior token)
      if (i > 0) {
        const transDeriv = deriveTransitionConstraint(tokens[i - 1], tok);
        const tc = findOrCreateConstraint(transDeriv);
        if (tc) { markUsed(tc); firedThisStep.push(tc); }
      }

      // Co-occurrence within window (with up to COOC_WINDOW prior tokens)
      const winStart = Math.max(0, i - COOC_WINDOW);
      for (let j = winStart; j < i; j++) {
        const coocDeriv = deriveCoocConstraint(tokens[j], tok);
        const cc = findOrCreateConstraint(coocDeriv);
        if (cc) { markUsed(cc); firedThisStep.push(cc); }
      }

      // Run detection (look back; if previous tokens form a run with current)
      // Cheap: only check if previous token has same kind, count back
      let runEnd = i;
      let runStart = i;
      while (runStart > 0 && tokens[runStart - 1].kind === tok.kind) runStart--;
      if (runEnd - runStart >= 1) {
        const runTokens = tokens.slice(runStart, runEnd + 1);
        if (runTokens.length >= 2) {
          const runDeriv = deriveRunConstraint(runTokens);
          if (runDeriv) {
            const rc = findOrCreateConstraint(runDeriv);
            if (rc) { markUsed(rc); firedThisStep.push(rc); }
          }
        }
      }

      // Update correlations among fired constraints
      for (let j = 0; j < firedThisStep.length; j++) {
        for (let k = j + 1; k < firedThisStep.length; k++) {
          recordCorrelation(firedThisStep[j].id, firedThisStep[k].id);
        }
      }

      // F1 seed: force a delta read (mechanical, not supervisory)
      scalarDelta = computeFieldDelta();

      // Family fidelity: each family that fired this step records a firing.
      // Stage 2's fidelity is firing-frequency relative to field average,
      // so we just count firings per family.
      const familiesThisStep = Object.create(null);
      for (let j = 0; j < firedThisStep.length; j++) {
        familiesThisStep[firedThisStep[j].family] = true;
      }
      for (const fam in familiesThisStep) {
        recordFamilyFiring(fam);
      }

      // Detect naming events (K3)
      detectNamingInToken(tok);

      // Periodic promotion check (every N tokens to bound cost)
      if ((totalTokensSeen % 32) === 0) {
        checkPromotions();
      }

      // Step counter advance via trace
      if ((totalTokensSeen % 64) === 0) {
        recordTrace("crawl-progress", {
          tokensSeen: totalTokensSeen,
          constraints: constraints.length,
          subcascades: subcascades.length,
          delta: scalarDelta
        });
      }

      lastFirings.push(firedThisStep.map(function (c) { return c.id; }));
      while (lastFirings.length > 16) lastFirings.shift();
    }

    // Final promotion sweep after crawl
    checkPromotions();

    // Emit Stage 2 rows for all promoted sub-cascades (these are what
    // surfaced from the application's structural extrusion)
    emitRowsFromSubcascades();

    recordTrace("crawl-complete", {
      tokensSeen: totalTokensSeen,
      constraints: constraints.length,
      subcascades: subcascades.length,
      delta: scalarDelta
    });

    return Object.freeze({
      tokensSeen: totalTokensSeen,
      constraints: constraints.length,
      subcascades: subcascades.length,
      delta: scalarDelta,
      namingPref: namingPref
    });
  }

  function emitRowsFromSubcascades() {
    // Each sub-cascade emits one row capturing its emergent identity.
    // Row schema: kind | name | family | members | uses | fidAtBirth | hash
    // Deduplication is on (family, name) - a sub-cascade's structural
    // identity. Re-emission with updated stats produces no new row, only
    // the original. This is idempotent against re-ingest: same input
    // produces same field, same field promotes same sub-cascades, same
    // structural identities are already present in rows.
    for (let i = 0; i < subcascades.length; i++) {
      const sc = subcascades[i];
      // Skip if already emitted (structural identity match)
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
    // Stage 2's outbound VSF.
    // Header triads describe the substrate's resolved structure dimensions.
    const triads = [
      "kind:subcascade=0,run=1,trans=2,cooc=3,rep=4|0|4",
      "name:ident|0|32",
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
    // exposed for tests
    _checkPromotions: checkPromotions,
    _computeFieldDelta: computeFieldDelta
  });
}

// ----------------------------------------------------------------------------
// Exports
// ----------------------------------------------------------------------------

module.exports = Object.freeze({
  VERSION: VERSION,
  PRIMITIVE_KINDS: PRIMITIVE_KINDS,
  FIDELITY_PROMOTE: FIDELITY_PROMOTE,
  FIDELITY_MIN_FIRES: FIDELITY_MIN_FIRES,
  SUB_CASCADE_CAP: SUB_CASCADE_CAP,
  COOC_WINDOW: COOC_WINDOW,
  parseStage1Vsf: parseStage1Vsf,
  createStage2Substrate: createStage2Substrate,
  asciiOnly: asciiOnly,
  sha256Hex: sha256Hex
});
