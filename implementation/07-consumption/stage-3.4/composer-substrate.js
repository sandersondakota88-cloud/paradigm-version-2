// composer-substrate.js - SE-10 chain link 3 (composes parallel peers)

"use strict";

const crypto = require("crypto");

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const VERSION = "composer-1.0.0";

const FIDELITY_PROMOTE   = 2.0;   // composer fires less often than peers,
                                  // so a slightly looser threshold gives
                                  // promotion room without being noise
const FIDELITY_MIN_FIRES = 4;
const SUB_CASCADE_CAP    = 16;

const CONSTRAINT_CAP_DEFAULT  = 2048;
const CORRELATION_CAP_DEFAULT = 4096;
const ROW_CAP_DEFAULT         = 8192;
const TRACE_CAP_DEFAULT       = 4096;
const NAMING_PREF_CAP         = 1.0;

const PRIMITIVE_KINDS = Object.freeze({
  JOINT_RECUR:    "JOINT_RECUR",
  JOINT_NAMING:   "JOINT_NAMING",
  KIND_TEXT_BIND: "KIND_TEXT_BIND"
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
// Cascade-intake-style adapter
// ----------------------------------------------------------------------------
// Reads a peer substrate's getState() and produces a normalized "view"
// the composer can iterate. This is SE-08 (render-substrate intake) at
// the inter-substrate boundary, exactly as Phase 5.7's cascade-intake.js
// does it. The composer treats the view as input data; the peers do not
// know they are being observed.
//
// The view exposes per-peer:
//   subcascades:  array of { name, family, members[] (each with pattern), patternKind }
//   constraints:  reduced view of constraints involved in promoted
//                 sub-cascades (we don't need every constraint - only
//                 those carrying promoted-family information)
//   topByUses:    top-N constraints by use count, used for JOINT_RECUR
//                 firing
//
// Bucketing (per Phase 5.7's discipline): we don't pass raw float values
// across the boundary. We pass categorical structure (kinds, families,
// patterns, members). This avoids the per-step continuous-change noise
// the cascade-intake had to bucket out at the inter-layer boundary.

function viewOfPeer(peerState) {
  if (!peerState || typeof peerState !== "object") {
    throw new TypeError("peerState must be an object");
  }
  const subs = peerState.subcascades || [];
  const cons = peerState.constraints || [];

  // Index constraints by id for fast member lookup.
  const byId = Object.create(null);
  for (let i = 0; i < cons.length; i++) {
    byId[cons[i].id] = cons[i];
  }

  // Build sub-cascade view with concrete member patterns.
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
          // Capture kind/text fields where present so the composer can
          // match across primitives.
          a: c.pattern && c.pattern.a,         // kind for cooc/transition
          b: c.pattern && c.pattern.b,         // kind for cooc/transition
          from: c.pattern && c.pattern.from,   // kind for transition
          to: c.pattern && c.pattern.to,       // kind for transition
          kind: c.pattern && c.pattern.kind,   // kind for repetition/run
          text: c.pattern && c.pattern.text,   // text for ident-recur, ident-pos, repetition
          pos: c.pattern && c.pattern.pos      // position class for ident-pos
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

  // Top constraints by uses across the whole peer field. Useful for
  // JOINT_RECUR which fires when two peers each have a top-recurring
  // constraint that share a structural feature.
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
        pos: c.pattern && c.pattern.pos
      };
    });

  return Object.freeze({
    id: peerState.id,
    version: peerState.version,
    delta: peerState.delta,
    subcascades: subView,
    topByUses: topByUses
  });
}

// ----------------------------------------------------------------------------
// String normalization for cross-peer matching
// ----------------------------------------------------------------------------
// Stage 1's STRING_DBL tokens carry their quotes attached ("heavy" not
// heavy). The identifier substrate sees them with quotes; the
// kind-substrate sees them as STRING_DBL kind. When matching across,
// we strip the quotes so we're comparing the same string content.

function stripStringQuotes(s) {
  if (typeof s !== "string" || s.length < 2) return s;
  const first = s.charAt(0);
  const last = s.charAt(s.length - 1);
  if ((first === "\"" && last === "\"") || (first === "'" && last === "'")) {
    return s.slice(1, -1);
  }
  return s;
}

// Determine whether a kind-axis member's pattern involves a STRING_*
// kind on either side.
function kindPatternInvolvesString(memberPattern) {
  if (!memberPattern) return false;
  const stringKinds = { "STRING_DBL": true, "STRING_SGL": true };
  if (memberPattern.a && stringKinds[memberPattern.a]) return true;
  if (memberPattern.b && stringKinds[memberPattern.b]) return true;
  if (memberPattern.from && stringKinds[memberPattern.from]) return true;
  if (memberPattern.to && stringKinds[memberPattern.to]) return true;
  if (memberPattern.kind && stringKinds[memberPattern.kind]) return true;
  return false;
}

function kindPatternInvolvesPunct(memberPattern) {
  if (!memberPattern) return false;
  const punctKinds = {
    "PUNCT_OPEN": true, "PUNCT_CLOSE": true,
    "PUNCT_OP": true, "PUNCT_SEP": true
  };
  if (memberPattern.a && punctKinds[memberPattern.a]) return true;
  if (memberPattern.b && punctKinds[memberPattern.b]) return true;
  if (memberPattern.from && punctKinds[memberPattern.from]) return true;
  if (memberPattern.to && punctKinds[memberPattern.to]) return true;
  if (memberPattern.kind && punctKinds[memberPattern.kind]) return true;
  return false;
}

// ----------------------------------------------------------------------------
// The composer's primitive derivations
// ----------------------------------------------------------------------------

function deriveJointRecur(kindMember, textMember) {
  // Both peers have a recurrent pattern; the kind member involves a
  // string-bearing kind, and the text member's text is a string-shaped
  // value. This is the substrate noticing that "this kind level recurrence
  // and this text level recurrence are the same structural fact".
  const stripped = stripStringQuotes(textMember.text || "");
  const key = "jr::" + (kindMember.patternType || "?") + "::" +
              (kindMember.patternKey || "?") + "::" + stripped;
  return Object.freeze({
    primitive: PRIMITIVE_KINDS.JOINT_RECUR,
    family: "joint-recur",
    pattern: {
      type: "joint-recur",
      kindPattern: kindMember.patternKey,
      textValue: stripped,
      key: key
    },
    members: {
      kindFamily: kindMember.family,
      kindKey: kindMember.patternKey,
      textFamily: textMember.family,
      textValue: stripped,
      textPos: textMember.pos
    }
  });
}

function deriveJointNaming(kindSc, textSc) {
  // A sub-cascade from one peer references (in its name) a structure
  // from the other peer. This is K3-style: both peers structurally
  // surfaced the same naming.
  const key = "jn::" + kindSc.name + "::" + textSc.name;
  return Object.freeze({
    primitive: PRIMITIVE_KINDS.JOINT_NAMING,
    family: "joint-naming",
    pattern: {
      type: "joint-naming",
      kindName: kindSc.name,
      textName: textSc.name,
      key: key
    },
    members: {
      kindSubcascade: kindSc.name,
      textSubcascade: textSc.name
    }
  });
}

function deriveKindTextBind(kindMember, textMember) {
  // The load-bearing primitive: a structural kind pattern reliably
  // binds to a specific text value. This is what tells the composer
  // "the substrate has surfaced a structural shape AND a vocabulary
  // that fills that shape".
  //
  // Match conditions:
  //   - kindMember's pattern involves a punctuation kind (attribute
  //     selectors, function calls, all the syntactic shapes of bindings)
  //   - AND textMember has a position class that is meaningful (ATTR
  //     for attribute names, STR for string-literal values, DECL for
  //     declared names)
  //   - AND the bind is structural (the text value isn't trivially
  //     ubiquitous noise like a single-character string)
  if (!kindPatternInvolvesPunct(kindMember)) return null;
  const meaningfulPos = { "ATTR": true, "STR": true, "DECL": true };
  if (!meaningfulPos[textMember.pos]) return null;
  const stripped = stripStringQuotes(textMember.text || "");
  if (stripped.length === 0) return null;
  if (stripped.length === 1) return null;  // single-char texts are noise
  const key = "ktb::" + (kindMember.patternKey || "?") + "::" +
              stripped + "@@" + textMember.pos;
  return Object.freeze({
    primitive: PRIMITIVE_KINDS.KIND_TEXT_BIND,
    family: "kind-text-bind",
    pattern: {
      type: "kind-text-bind",
      kindPattern: kindMember.patternKey,
      textValue: stripped,
      pos: textMember.pos,
      key: key
    },
    members: {
      kindFamily: kindMember.family,
      kindKey: kindMember.patternKey,
      textValue: stripped,
      textPos: textMember.pos
    }
  });
}

// ----------------------------------------------------------------------------
// The composer substrate factory
// ----------------------------------------------------------------------------

function createComposerSubstrate(opts) {
  opts = opts || {};
  const id = String(opts.id || ("composer-" + crypto.randomBytes(4).toString("hex")));
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

  // ------------------------------------------------------------------
  // Mechanism (mirrors Stage 2 / identifier substrate exactly)
  // ------------------------------------------------------------------

  function nextId() { idCtr++; return "cc::" + idCtr; }

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

  function markUsed(c, recurrence) {
    // recurrence is the strength of this firing, derived from the joint
    // peer-recurrence of the pairing (default 1 for traditional one-shot).
    // The composer needs this because its firings are pair-sweeps over peer
    // states; without weighting by underlying peer recurrence, every pair
    // fires exactly once per observation regardless of how many times the
    // underlying pattern recurs in the source. That collapses the firing-
    // frequency-fidelity distribution at the composer level.
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
    if (p.type === "joint-recur") {
      raw = "jr-" + (p.textValue || "");
    } else if (p.type === "joint-naming") {
      raw = "jn-" + (p.kindName || "") + "-" + (p.textName || "");
    } else if (p.type === "kind-text-bind") {
      raw = "ktb-" + (p.textValue || "") + "-" + (p.pos || "");
    } else {
      raw = String(p.type);
    }
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

  // ------------------------------------------------------------------
  // The composer's observation loop
  // ------------------------------------------------------------------
  // observe(kindPeerState, textPeerState) reads both peers' settled
  // states through the cascade-intake adapter, fires the joint
  // primitives, and runs promotion. The peers are not modified;
  // they are not even called - their state objects are passed in.
  //
  // The composer can be observed multiple times (after each "settling
  // round" of the peers); each observation fires primitives based on
  // the current peer states. Observation is itself an SE-09-irreversible
  // operation: the composer's state evolves with each observation.

  function observe(kindPeerState, textPeerState) {
    if (sealed) throw new Error("Composer substrate is sealed");
    const kindView = viewOfPeer(kindPeerState);
    const textView = viewOfPeer(textPeerState);
    observationCount++;
    prevDelta = scalarDelta;

    const firedThisObservation = [];

    // -- JOINT_RECUR --
    // Iterate top-N constraints in each peer; fire JOINT_RECUR for
    // pairings where the kind member involves a string kind and the
    // text member is a string-shaped value (text starts/ends with a
    // matching quote, indicating Stage 1 emitted it as a STRING_*).
    //
    // Each firing is weighted by min(km.uses, tm.uses) - the conservative
    // joint strength of the pairing. A pairing where both peers see the
    // pattern many times is a strong joint recurrence; a pairing where
    // either side is weak is a weak joint recurrence regardless of how
    // strong the other side is. The "min" choice makes joint strength
    // honest: agreement is bounded by the weakest agreeing party.
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

    // -- JOINT_NAMING --
    // Pair every promoted sub-cascade in the kind peer with every
    // promoted sub-cascade in the text peer; fire JOINT_NAMING.
    // Joint strength here is the product of member counts (each sub-
    // cascade's structural breadth), capped to keep the metric bounded.
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
    }

    // -- KIND_TEXT_BIND --
    // The load-bearing one. For every top-recurrent text member with a
    // meaningful position class (ATTR, STR, DECL), pair it with every
    // top-recurrent kind member whose pattern involves a punctuation
    // kind. Each such pairing fires KIND_TEXT_BIND with joint-recurrence
    // weighting, so pairings where both peers see strong recurrence
    // (the syntactic shape happens often AND the text appears in that
    // shape often) get high uses; pairings where either side is weak
    // get low uses.
    //
    // We pre-filter the text-view to ident-pos members with meaningful
    // positions. The blind topByUses can be dominated by ident-recur and
    // ident-cooc members (which lack a pos field), starving KIND_TEXT_BIND
    // of valid text-side partners. Filtering at iteration time matches
    // what the primitive's derive function requires anyway and is the
    // structurally honest version of "iterate top recurrent text
    // members with meaningful positions".
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

    // Correlations across constraints fired this observation.
    for (let i = 0; i < firedThisObservation.length; i++) {
      for (let j = i + 1; j < firedThisObservation.length; j++) {
        recordCorrelation(firedThisObservation[i].id, firedThisObservation[j].id);
      }
    }

    // F1 seed: continuous delta read.
    scalarDelta = computeFieldDelta();

    // Family fidelity: count one firing per fired constraint, not one
    // per family per observation. This matches what the peers do (their
    // recordFamilyFiring is called per token-step that fires a member,
    // not per token-step). The composer's "step" is an observation, but
    // its primitive firings within an observation are the analog of the
    // peers' per-token firings - they should count the same way.
    for (let i = 0; i < firedThisObservation.length; i++) {
      recordFamilyFiring(firedThisObservation[i].family);
    }

    // Promotion check after each observation (composer fires fewer
    // events than peers, so we check more often relative to event rate).
    checkPromotions();

    recordTrace("observe", {
      observation: observationCount,
      kindPeer: kindView.id,
      textPeer: textView.id,
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
      "kind:joint-recur=0,joint-naming=1,kind-text-bind=2|0|2",
      "name:ident|0|64",
      "family:family|0|64",
      "members:count|0|" + Math.max(1, constraints.length),
      "uses:count|0|99999",
      "fidAtBirth:value=0|0|1"
    ];
    const headerSection = triads.join(" | ");
    // Emit one row per promoted sub-cascade.
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
  // Pure helpers exposed for tests.
  viewOfPeer: viewOfPeer,
  stripStringQuotes: stripStringQuotes,
  kindPatternInvolvesString: kindPatternInvolvesString,
  kindPatternInvolvesPunct: kindPatternInvolvesPunct,
  deriveJointRecur: deriveJointRecur,
  deriveJointNaming: deriveJointNaming,
  deriveKindTextBind: deriveKindTextBind
});
