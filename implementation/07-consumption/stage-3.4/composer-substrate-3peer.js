// composer-substrate-3peer.js

"use strict";

const crypto = require("crypto");

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const VERSION = "composer-3peer-1.0.0";

const FIDELITY_PROMOTE   = 2.0;
const FIDELITY_MIN_FIRES = 4;
const SUB_CASCADE_CAP    = 24;

const CONSTRAINT_CAP_DEFAULT  = 4096;
const CORRELATION_CAP_DEFAULT = 4096;
const ROW_CAP_DEFAULT         = 8192;
const TRACE_CAP_DEFAULT       = 4096;
const NAMING_PREF_CAP         = 1.0;

const PRIMITIVE_KINDS = Object.freeze({
  JOINT_RECUR:        "JOINT_RECUR",
  JOINT_NAMING:       "JOINT_NAMING",
  KIND_TEXT_BIND:     "KIND_TEXT_BIND",
  MORPHOLOGICAL_BIND: "MORPHOLOGICAL_BIND"
});

// ----------------------------------------------------------------------------
// Guards
// ----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------
// Cascade-intake adapter for peer states
// ----------------------------------------------------------------------------

function viewOfPeer(peerState) {
  if (!peerState || typeof peerState !== "object") {
    throw new TypeError("peerState must be an object");
  }
  const subs = peerState.subcascades || [];
  const cons = peerState.constraints || [];

  const byId = Object.create(null);
  for (let i = 0; i < cons.length; i++) byId[cons[i].id] = cons[i];

  const subView = subs.map(function (sc) {
    const memberPatterns = [];
    for (let i = 0; i < sc.memberIds.length; i++) {
      const c = byId[sc.memberIds[i]];
      if (c) {
        memberPatterns.push({
          family: c.family,
          patternKey: c.pattern && c.pattern.key,
          patternType: c.pattern && c.pattern.type,
          uses: c.uses || 0,
          a: c.pattern && c.pattern.a,
          b: c.pattern && c.pattern.b,
          from: c.pattern && c.pattern.from,
          to: c.pattern && c.pattern.to,
          kind: c.pattern && c.pattern.kind,
          text: c.pattern && c.pattern.text,
          pos: c.pattern && c.pattern.pos,
          prefix: c.pattern && c.pattern.prefix,
          suffix: c.pattern && c.pattern.suffix
        });
      }
    }
    return {
      name: sc.name,
      family: sc.familyType,
      memberCount: sc.memberIds.length,
      fidAtBirth: sc.fidAtBirth,
      patternType: memberPatterns[0] && memberPatterns[0].patternType,
      memberPatterns: memberPatterns
    };
  });

  const topByUses = cons.slice()
    .sort(function (a, b) { return (b.uses || 0) - (a.uses || 0); })
    .slice(0, 64)
    .map(function (c) {
      return {
        family: c.family,
        patternKey: c.pattern && c.pattern.key,
        patternType: c.pattern && c.pattern.type,
        uses: c.uses || 0,
        a: c.pattern && c.pattern.a,
        b: c.pattern && c.pattern.b,
        from: c.pattern && c.pattern.from,
        to: c.pattern && c.pattern.to,
        kind: c.pattern && c.pattern.kind,
        text: c.pattern && c.pattern.text,
        pos: c.pattern && c.pattern.pos,
        prefix: c.pattern && c.pattern.prefix,
        suffix: c.pattern && c.pattern.suffix
      };
    });

  return Object.freeze({
    id: peerState.id,
    version: peerState.version,
    delta: peerState.delta,
    subcascades: subView,
    topByUses: topByUses,
    // Full constraint list exposed for cross-axis lookups.
    allConstraints: cons.slice()
  });
}

// ----------------------------------------------------------------------------
// String quote handling and pattern probes
// ----------------------------------------------------------------------------

function stripStringQuotes(s) {
  if (typeof s !== "string" || s.length < 2) return s;
  const f = s.charAt(0);
  const l = s.charAt(s.length - 1);
  if ((f === "\"" && l === "\"") || (f === "'" && l === "'")) {
    return s.slice(1, -1);
  }
  return s;
}

function kindPatternInvolvesString(p) {
  if (!p) return false;
  const sk = { "STRING_DBL": true, "STRING_SGL": true };
  if (p.a && sk[p.a]) return true;
  if (p.b && sk[p.b]) return true;
  if (p.from && sk[p.from]) return true;
  if (p.to && sk[p.to]) return true;
  if (p.kind && sk[p.kind]) return true;
  return false;
}

function kindPatternInvolvesPunct(p) {
  if (!p) return false;
  const pk = { "PUNCT_OPEN": true, "PUNCT_CLOSE": true,
               "PUNCT_OP": true, "PUNCT_SEP": true };
  if (p.a && pk[p.a]) return true;
  if (p.b && pk[p.b]) return true;
  if (p.from && pk[p.from]) return true;
  if (p.to && pk[p.to]) return true;
  if (p.kind && pk[p.kind]) return true;
  return false;
}

// Does the string-axis peer have a hyphenation entry whose lhs+rhs
// reconstructs the given string content (or a meaningful chunk of it)?
function stringHasHyphenStructure(stringContent, stringPeer) {
  // stringContent is the unquoted text content.
  // stringPeer is the view of the string-analysis substrate.
  // We search the peer's allConstraints for a str-hyphen-prefix or
  // str-hyphen-suffix matching the lhs / rhs of the content.
  if (!stringContent || stringContent.indexOf("-") < 0) return null;
  // Split on first hyphen for the simple case (lhs-rhs).
  const idx = stringContent.indexOf("-");
  const lhs = stringContent.substring(0, idx);
  const rhs = stringContent.substring(idx + 1);
  if (lhs.length < 2 || rhs.length < 2) return null;
  if (rhs.indexOf("-") >= 0) {
    // Multi-hyphen string; use first hyphen split. The suffix may itself
    // be a compound but the prefix is the structurally-significant
    // lhs for our purposes.
  }

  let prefixUses = 0, suffixUses = 0;
  for (const c of stringPeer.allConstraints) {
    if (!c.pattern) continue;
    if (c.pattern.type === "str-hyphen-prefix" && c.pattern.prefix === lhs) {
      prefixUses += c.uses || 0;
    }
    if (c.pattern.type === "str-hyphen-suffix" && c.pattern.suffix === rhs) {
      suffixUses += c.uses || 0;
    }
  }
  if (prefixUses === 0 && suffixUses === 0) return null;
  return {
    lhs: lhs,
    rhs: rhs,
    prefixUses: prefixUses,
    suffixUses: suffixUses
  };
}

// ----------------------------------------------------------------------------
// Primitive derivations
// ----------------------------------------------------------------------------

function deriveJointRecur(km, tm) {
  const stripped = stripStringQuotes(tm.text || "");
  const key = "jr::" + (km.patternType || "?") + "::" +
              (km.patternKey || "?") + "::" + stripped;
  return Object.freeze({
    primitive: PRIMITIVE_KINDS.JOINT_RECUR,
    family: "joint-recur",
    pattern: {
      type: "joint-recur",
      kindPattern: km.patternKey,
      textValue: stripped,
      key: key
    },
    members: {
      kindFamily: km.family,
      kindKey: km.patternKey,
      textFamily: tm.family,
      textValue: stripped,
      textPos: tm.pos
    }
  });
}

function deriveJointNaming(ksc, tsc) {
  const key = "jn::" + ksc.name + "::" + tsc.name;
  return Object.freeze({
    primitive: PRIMITIVE_KINDS.JOINT_NAMING,
    family: "joint-naming",
    pattern: {
      type: "joint-naming",
      kindName: ksc.name,
      textName: tsc.name,
      key: key
    },
    members: {
      kindSubcascade: ksc.name,
      textSubcascade: tsc.name
    }
  });
}

function deriveKindTextBind(km, tm) {
  if (!kindPatternInvolvesPunct(km)) return null;
  const meaningfulPos = { "ATTR": true, "STR": true, "DECL": true };
  if (!meaningfulPos[tm.pos]) return null;
  const stripped = stripStringQuotes(tm.text || "");
  if (stripped.length < 2) return null;
  const key = "ktb::" + (km.patternKey || "?") + "::" +
              stripped + "@@" + tm.pos;
  return Object.freeze({
    primitive: PRIMITIVE_KINDS.KIND_TEXT_BIND,
    family: "kind-text-bind",
    pattern: {
      type: "kind-text-bind",
      kindPattern: km.patternKey,
      textValue: stripped,
      pos: tm.pos,
      key: key
    },
    members: {
      kindFamily: km.family,
      kindKey: km.patternKey,
      textValue: stripped,
      textPos: tm.pos
    }
  });
}

function deriveMorphologicalBind(km, tm, hyphenInfo) {
  // Three-axis intersection:
  //   km    : kind member (involves punct)
  //   tm    : text member (string in meaningful position)
  //   hyphenInfo: { lhs, rhs, prefixUses, suffixUses } from string axis
  if (!kindPatternInvolvesPunct(km)) return null;
  const meaningfulPos = { "ATTR": true, "STR": true, "DECL": true };
  if (!meaningfulPos[tm.pos]) return null;
  if (!hyphenInfo) return null;

  const stripped = stripStringQuotes(tm.text || "");
  const key = "mb::" + (km.patternKey || "?") + "::" +
              hyphenInfo.lhs + "-" + hyphenInfo.rhs + "@@" + tm.pos;
  return Object.freeze({
    primitive: PRIMITIVE_KINDS.MORPHOLOGICAL_BIND,
    family: "morphological-bind",
    pattern: {
      type: "morphological-bind",
      kindPattern: km.patternKey,
      compoundLhs: hyphenInfo.lhs,
      compoundRhs: hyphenInfo.rhs,
      pos: tm.pos,
      key: key
    },
    members: {
      kindFamily: km.family,
      kindKey: km.patternKey,
      compound: stripped,
      lhs: hyphenInfo.lhs,
      rhs: hyphenInfo.rhs,
      pos: tm.pos,
      lhsUses: hyphenInfo.prefixUses,
      rhsUses: hyphenInfo.suffixUses
    }
  });
}

// ----------------------------------------------------------------------------
// Composer factory
// ----------------------------------------------------------------------------

function createComposerSubstrate(opts) {
  opts = opts || {};
  const id = String(opts.id || ("comp3-" + crypto.randomBytes(4).toString("hex")));
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
  const trace = [];
  const rows = [];
  let sealed = false;
  let observationCount = 0;

  const SEED = Object.freeze({
    id: "seed::what-is-delta",
    family: "seed",
    pattern: { type: "seed" },
    permanent: true,
    weight: 1.0
  });

  // ---------------------------------------------------------
  // Mechanism (mirrors prior composer)
  // ---------------------------------------------------------

  function nextId() { idCtr++; return "ccc::" + idCtr; }

  function recordTrace(op, detail) {
    if (sealed) return;
    if (trace.length >= traceCap) trace.shift();
    trace.push(Object.freeze({
      step: ++step, op: op, delta: scalarDelta,
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

  function markUsed(c, recurrence) {
    if (!c) return;
    const r = (typeof recurrence === "number" && Number.isFinite(recurrence) && recurrence > 0) ? recurrence : 1;
    c.uses = (c.uses || 0) + r;
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
    if (p.type === "joint-recur") raw = "jr-" + (p.textValue || "");
    else if (p.type === "joint-naming") raw = "jn-" + (p.kindName || "") + "-" + (p.textName || "");
    else if (p.type === "kind-text-bind") raw = "ktb-" + (p.textValue || "") + "-" + (p.pos || "");
    else if (p.type === "morphological-bind") raw = "mb-" + (p.compoundLhs || "") + "-" + (p.compoundRhs || "") + "-" + (p.pos || "");
    else raw = String(p.type);
    let name = raw.toLowerCase().replace(/[^a-z0-9-]/g, "").substring(0, 64);
    if (!name) name = "cc";
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

  function computeFieldDelta() {
    let total = constraints.length + 1;
    let resolved = 0;
    for (let i = 0; i < constraints.length; i++) {
      if ((constraints[i].uses || 0) > 0 && (constraints[i].weight || 0) > 0.5) resolved++;
    }
    const unresolved = total - resolved;
    return clamp01(unresolved / Math.max(1, total));
  }

  // ---------------------------------------------------------
  // Three-peer observation loop
  // ---------------------------------------------------------

  function observe(kindPeerState, textPeerState, stringPeerState) {
    if (sealed) throw new Error("Composer substrate is sealed");
    const kindView = viewOfPeer(kindPeerState);
    const textView = viewOfPeer(textPeerState);
    const stringView = viewOfPeer(stringPeerState);
    observationCount++;
    prevDelta = scalarDelta;

    const firedThisObservation = [];

    // -- JOINT_RECUR -- (kind axis + text axis)
    for (let i = 0; i < kindView.topByUses.length; i++) {
      const km = kindView.topByUses[i];
      if (!kindPatternInvolvesString(km)) continue;
      for (let j = 0; j < textView.topByUses.length; j++) {
        const tm = textView.topByUses[j];
        if (!tm.text) continue;
        const isQuoted = tm.text.length >= 2 &&
          ((tm.text.charAt(0) === "\"" && tm.text.charAt(tm.text.length - 1) === "\"") ||
           (tm.text.charAt(0) === "'" && tm.text.charAt(tm.text.length - 1) === "'"));
        if (!isQuoted) continue;
        const der = deriveJointRecur(km, tm);
        const c = findOrCreateConstraint(der);
        if (c) {
          const jointStrength = Math.min(km.uses || 1, tm.uses || 1);
          markUsed(c, jointStrength);
          firedThisObservation.push(c);
        }
      }
    }

    // -- JOINT_NAMING -- (kind sub-cascades * text sub-cascades; we
    // also extend to include string sub-cascades when present)
    for (let i = 0; i < kindView.subcascades.length; i++) {
      for (let j = 0; j < textView.subcascades.length; j++) {
        const der = deriveJointNaming(kindView.subcascades[i], textView.subcascades[j]);
        const c = findOrCreateConstraint(der);
        if (c) {
          const jointStrength = Math.min(64,
            (kindView.subcascades[i].memberCount || 1) *
            (textView.subcascades[j].memberCount || 1));
          markUsed(c, jointStrength);
          firedThisObservation.push(c);
        }
      }
      for (let j = 0; j < stringView.subcascades.length; j++) {
        const der = deriveJointNaming(kindView.subcascades[i], stringView.subcascades[j]);
        const c = findOrCreateConstraint(der);
        if (c) {
          const jointStrength = Math.min(64,
            (kindView.subcascades[i].memberCount || 1) *
            (stringView.subcascades[j].memberCount || 1));
          markUsed(c, jointStrength);
          firedThisObservation.push(c);
        }
      }
    }
    // text * string sub-cascade joint-naming
    for (let i = 0; i < textView.subcascades.length; i++) {
      for (let j = 0; j < stringView.subcascades.length; j++) {
        const der = deriveJointNaming(textView.subcascades[i], stringView.subcascades[j]);
        const c = findOrCreateConstraint(der);
        if (c) {
          const jointStrength = Math.min(64,
            (textView.subcascades[i].memberCount || 1) *
            (stringView.subcascades[j].memberCount || 1));
          markUsed(c, jointStrength);
          firedThisObservation.push(c);
        }
      }
    }

    // -- KIND_TEXT_BIND -- (kind axis + text axis)
    const meaningfulPos = { "ATTR": true, "STR": true, "DECL": true };
    const textPosCandidates = textView.topByUses.filter(function (tm) {
      return tm.pos && meaningfulPos[tm.pos];
    });
    for (let i = 0; i < kindView.topByUses.length; i++) {
      const km = kindView.topByUses[i];
      if (!kindPatternInvolvesPunct(km)) continue;
      for (let j = 0; j < textPosCandidates.length; j++) {
        const tm = textPosCandidates[j];
        const der = deriveKindTextBind(km, tm);
        if (!der) continue;
        const c = findOrCreateConstraint(der);
        if (c) {
          const jointStrength = Math.min(km.uses || 1, tm.uses || 1);
          markUsed(c, jointStrength);
          firedThisObservation.push(c);
        }
      }
    }

    // -- MORPHOLOGICAL_BIND -- (kind + text + string axes)
    // For every text candidate with meaningful position, check if its
    // string content has a hyphenation pattern in the string axis.
    // If so, intersect with kind candidates that involve punctuation.
    for (let j = 0; j < textPosCandidates.length; j++) {
      const tm = textPosCandidates[j];
      const stripped = stripStringQuotes(tm.text || "");
      if (stripped.indexOf("-") < 0) continue;
      const hyphenInfo = stringHasHyphenStructure(stripped, stringView);
      if (!hyphenInfo) continue;
      for (let i = 0; i < kindView.topByUses.length; i++) {
        const km = kindView.topByUses[i];
        if (!kindPatternInvolvesPunct(km)) continue;
        const der = deriveMorphologicalBind(km, tm, hyphenInfo);
        if (!der) continue;
        const c = findOrCreateConstraint(der);
        if (c) {
          // Joint strength: min over three axes.
          const jointStrength = Math.min(
            km.uses || 1,
            tm.uses || 1,
            (hyphenInfo.prefixUses + hyphenInfo.suffixUses) || 1
          );
          markUsed(c, jointStrength);
          firedThisObservation.push(c);
        }
      }
    }

    // Correlations across firings this observation
    for (let i = 0; i < firedThisObservation.length; i++) {
      for (let j = i + 1; j < firedThisObservation.length; j++) {
        recordCorrelation(firedThisObservation[i].id, firedThisObservation[j].id);
      }
    }

    // F1 seed continuous delta
    scalarDelta = computeFieldDelta();

    // Family fidelity per fired constraint (matches peers)
    for (let i = 0; i < firedThisObservation.length; i++) {
      recordFamilyFiring(firedThisObservation[i].family);
    }

    checkPromotions();

    recordTrace("observe", {
      observation: observationCount,
      kindPeer: kindView.id,
      textPeer: textView.id,
      stringPeer: stringView.id,
      fired: firedThisObservation.length,
      constraints: constraints.length,
      subcascades: subcascades.length
    });

    return Object.freeze({
      observationCount: observationCount,
      fired: firedThisObservation.length,
      constraints: constraints.length,
      subcascades: subcascades.length,
      delta: scalarDelta
    });
  }

  function getState() {
    return Object.freeze({
      id: id,
      version: VERSION,
      step: step,
      sealed: sealed,
      delta: scalarDelta,
      namingPref: namingPref,
      observationCount: observationCount,
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
      "kind:joint-recur=0,joint-naming=1,kind-text-bind=2,morphological-bind=3|0|3",
      "name:ident|0|64",
      "family:family|0|64",
      "members:count|0|" + Math.max(1, constraints.length),
      "uses:count|0|99999",
      "fidAtBirth:value=0|0|1"
    ];
    const headerSection = triads.join(" | ");
    const bodyLines = [];
    for (let i = 0; i < subcascades.length; i++) {
      const sc = subcascades[i];
      const dom = constraintsById[sc.memberIds[0]];
      const patternType = dom && dom.pattern ? dom.pattern.type : "?";
      let totalUses = 0;
      for (let j = 0; j < sc.memberIds.length; j++) {
        const c = constraintsById[sc.memberIds[j]];
        if (c) totalUses += (c.uses || 0);
      }
      const body = ["subcascade", sc.name, sc.familyType,
                    String(sc.memberIds.length), String(totalUses),
                    sc.fidAtBirth.toFixed(4), patternType].join("|");
      bodyLines.push(body);
    }
    return headerSection + "\n---\n" + bodyLines.join("\n");
  }

  function seal() {
    if (sealed) return "";
    sealed = true;
    let h = sha256Hex(VERSION + ":" + id);
    for (let i = 0; i < subcascades.length; i++) {
      h = sha256Hex(h + ":" + subcascades[i].name);
    }
    return h;
  }

  return Object.freeze({
    id: id,
    version: VERSION,
    observe: observe,
    getState: getState,
    emitVsf: emitVsf,
    seal: seal,
    _checkPromotions: checkPromotions
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
  createComposerSubstrate: createComposerSubstrate,
  asciiOnly: asciiOnly,
  sha256Hex: sha256Hex,
  // Pure helpers exposed for tests
  viewOfPeer: viewOfPeer,
  stripStringQuotes: stripStringQuotes,
  kindPatternInvolvesString: kindPatternInvolvesString,
  kindPatternInvolvesPunct: kindPatternInvolvesPunct,
  stringHasHyphenStructure: stringHasHyphenStructure,
  deriveJointRecur: deriveJointRecur,
  deriveJointNaming: deriveJointNaming,
  deriveKindTextBind: deriveKindTextBind,
  deriveMorphologicalBind: deriveMorphologicalBind
});
