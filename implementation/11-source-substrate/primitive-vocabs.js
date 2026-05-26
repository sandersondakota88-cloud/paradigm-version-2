// primitive-vocabs.js
// =============================================================================
// Phase 11 — five per-axis primitive vocabularies for the substrate factory.
//
// Per substrate-factory-spec.md §4: each vocabulary defines five interfaces:
//   tokenToInput(token)              -> peer-input shape
//   generateDerivedFromNovelty(in,f) -> derived constraints (M2.1)
//   generatePredictionsFromGap(f)    -> predictive constraints (M2.2)
//   matches(constraint, input)       -> Bool, used in peer cycle
//   familyType(constraint)           -> String (family-key for K1 fidelity)
//
// Each vocabulary is the per-axis primitive set per SE-11 §2.1.
// Constraints carry `pattern: { type: <family>, ... }` so that the
// canonical Field.recordFidelity (which groups by pattern.type) treats
// each primitive type as its own family for K1 promotion.
//
// Per Phase 11 discipline (PLAN §2): primitive content kept simple but
// faithful to the canonical mechanism shape. No hardcoded interpretation
// — vocabularies generate constraint candidates; whether they ratify and
// promote is determined by the substrate's measured fidelity.
// =============================================================================

"use strict";

(function (global) {

  // Cap on how many derived/predictive constraints any single ingest
  // can generate per axis. Prevents one extreme token from spawning
  // hundreds of constraints at once (which would distort fidelity
  // measurement and overflow the field cap before any K1 promotion
  // could occur).
  const GEN_MAX_PER_TOKEN = 3;
  const PRED_MAX_PER_GAP = 2;

  // --- helpers -------------------------------------------------------

  function _has(field, type, predicate) {
    for (const c of field.constraints) {
      if (!c || !c.pattern || c.pattern.type !== type) continue;
      if (predicate(c.pattern)) return true;
    }
    return false;
  }

  function _mkDerived(type, patternFields, desc) {
    return {
      pattern: Object.assign({ type: type }, patternFields),
      desc: desc
    };
  }

  function _mkPredictive(type, patternFields, desc) {
    return {
      pattern: Object.assign({ type: type }, patternFields),
      desc: desc
    };
  }

  // ------ Cross-channel intake helpers (Phase 3.3b) ----------------
  //
  // The lattice routes each peer's lastOutput into other peers' intake
  // as origin-tagged tokens "from-<axis>:<output>" placed in
  // input.intakeTokens by the per-peer tokensFn (see peer-specs.js).
  //
  // These helpers let each axis vocab read cross-channel data uniformly
  // and generate/match cross-context patterns whose vocabulary is
  // substrate-internal only (axis names + output alphabet tokens) per
  // O3 / discipline 2.1.

  function _parseCrossTokens(input) {
    // Returns map: { axisName: outputToken, ... } parsed from intakeTokens
    const out = Object.create(null);
    if (!input || !input.intakeTokens) return out;
    for (const t of input.intakeTokens) {
      if (typeof t !== "string" || t.indexOf("from-") !== 0) continue;
      const colon = t.indexOf(":");
      if (colon < 5) continue;
      const axis = t.slice(5, colon);
      const tok = t.slice(colon + 1);
      if (axis && tok) out[axis] = tok;
    }
    return out;
  }

  function _allCrossPairings(field, type) {
    // Returns the set of (otherAxis, otherOutput) currently observed in
    // derived/ratified constraints of the given type.
    const seen = Object.create(null);
    for (const c of field.constraints) {
      if (!c.pattern || c.pattern.type !== type) continue;
      if (c.kind !== "derived" && c.kind !== "ratified") continue;
      const key = c.pattern.otherAxis + "|" + c.pattern.otherOut;
      seen[key] = true;
    }
    return seen;
  }

  // ===================================================================
  // 1. KIND-PEER vocabulary
  // ===================================================================
  // Observes lexical kind (Acorn TokenType: "keyword", "ident",
  // "punctuation", "string", "number", "regexp", "template", "comment").
  // Primitives: kind-presence, kind-cooccurs (any direction within
  // window), kind-transition (preceding neighbor only), kind-run.

  const kindVocab = {
    tokenToInput: function (token) {
      const neighborKinds = [];
      if (token.neighbors_pre) for (const n of token.neighbors_pre) neighborKinds.push(n.kind);
      if (token.neighbors_post) for (const n of token.neighbors_post) neighborKinds.push(n.kind);
      const prevKind = (token.neighbors_pre && token.neighbors_pre.length > 0)
        ? token.neighbors_pre[token.neighbors_pre.length - 1].kind
        : null;
      return {
        kind: token.kind,
        neighborKinds: neighborKinds,
        prevKind: prevKind
      };
    },

    generateDerivedFromNovelty: function (input, field) {
      const gen = [];
      // kind-presence
      if (!_has(field, "kind-presence", function (p) { return p.kind === input.kind; })) {
        gen.push(_mkDerived("kind-presence", { kind: input.kind },
          "kind " + input.kind + " present"));
      }
      // kind-cooccurs for each neighbor kind
      const seen = Object.create(null);
      for (const nk of input.neighborKinds) {
        if (nk === input.kind) continue;
        if (seen[nk]) continue;
        seen[nk] = true;
        if (gen.length >= GEN_MAX_PER_TOKEN) break;
        if (!_has(field, "kind-cooccurs", function (p) {
          return (p.a === input.kind && p.b === nk) || (p.a === nk && p.b === input.kind);
        })) {
          gen.push(_mkDerived("kind-cooccurs", { a: input.kind, b: nk },
            "kinds " + input.kind + " & " + nk + " co-occur"));
        }
      }
      // kind-transition from prev to current
      if (gen.length < GEN_MAX_PER_TOKEN && input.prevKind && input.prevKind !== input.kind) {
        if (!_has(field, "kind-transition", function (p) {
          return p.from === input.prevKind && p.to === input.kind;
        })) {
          gen.push(_mkDerived("kind-transition", { from: input.prevKind, to: input.kind },
            "transition " + input.prevKind + " -> " + input.kind));
        }
      }
      // Phase 3.3b: kind-with-cross-context. Generate when current kind
      // co-occurs with a not-yet-observed (kind, otherAxis, otherOut) tuple.
      const cross = _parseCrossTokens(input);
      for (const otherAxis in cross) {
        if (gen.length >= GEN_MAX_PER_TOKEN) break;
        const otherOut = cross[otherAxis];
        if (!_has(field, "kind-with-cross-context", function (p) {
          return p.kind === input.kind && p.otherAxis === otherAxis && p.otherOut === otherOut;
        })) {
          gen.push(_mkDerived("kind-with-cross-context",
            { kind: input.kind, otherAxis: otherAxis, otherOut: otherOut },
            "kind " + input.kind + " under " + otherAxis + ":" + otherOut));
        }
      }
      return gen;
    },

    generatePredictionsFromGap: function (field) {
      // Bootstrap: predictives generate from derived-or-ratified structure
      // (per canonical kernel's char-class predictive pattern in
      // field.js generatePredictions). Looking only at ratified would
      // create a chicken-and-egg: ratification requires existing predictives.
      //
      // Strategy: for every cooccurs pair (a,b) observed but with no
      // observed transition (a->b or b->a), predict the transition.
      // This is the "reaching" — the substrate has seen the kinds appear
      // together but hasn't seen them in sequence yet, and predicts that
      // sequence input would close the gap.
      const gen = [];
      const cooccurs = [];
      const transitions = Object.create(null);
      for (const c of field.constraints) {
        if (!c.pattern) continue;
        if (c.kind !== "derived" && c.kind !== "ratified") continue;
        if (c.pattern.type === "kind-cooccurs") {
          cooccurs.push(c.pattern);
        } else if (c.pattern.type === "kind-transition") {
          transitions[c.pattern.from + "->" + c.pattern.to] = true;
        }
      }
      for (const co of cooccurs) {
        const ab = co.a + "->" + co.b;
        const ba = co.b + "->" + co.a;
        if (!transitions[ab]) {
          if (gen.length >= PRED_MAX_PER_GAP) break;
          gen.push(_mkPredictive("kind-transition", { from: co.a, to: co.b },
            "predicted: transition " + co.a + " -> " + co.b + " (cooccurs observed)"));
          transitions[ab] = true;  // avoid dup in same call
        }
        if (!transitions[ba]) {
          if (gen.length >= PRED_MAX_PER_GAP) break;
          gen.push(_mkPredictive("kind-transition", { from: co.b, to: co.a },
            "predicted: transition " + co.b + " -> " + co.a + " (cooccurs observed)"));
          transitions[ba] = true;
        }
      }
      // Phase 3.3b: predict kind-with-cross-context tuples for pairings
      // observed once but not under all kinds (substrate reaches for
      // "this otherAxis output also appears with kinds we know").
      const seenPairings = _allCrossPairings(field, "kind-with-cross-context");
      const kindsKnown = Object.create(null);
      for (const c of field.constraints) {
        if (!c.pattern) continue;
        if (c.pattern.type === "kind-presence" || c.pattern.type === "kind-with-cross-context") {
          if (c.pattern.kind) kindsKnown[c.pattern.kind] = true;
        }
      }
      const knownKinds = Object.keys(kindsKnown);
      const pairKeys = Object.keys(seenPairings);
      outer: for (const pk of pairKeys) {
        const [otherAxis, otherOut] = pk.split("|");
        for (const k of knownKinds) {
          const probe = otherAxis + "|" + otherOut;
          // Predict: this kind under this (axis, output) is plausible but
          // not yet observed. Check if specifically this kind+axis+out is
          // already a derived/ratified pattern; if not, predict it.
          const exists = _has(field, "kind-with-cross-context", function (p) {
            return p.kind === k && p.otherAxis === otherAxis && p.otherOut === otherOut;
          });
          if (!exists) {
            if (gen.length >= PRED_MAX_PER_GAP) break outer;
            gen.push(_mkPredictive("kind-with-cross-context",
              { kind: k, otherAxis: otherAxis, otherOut: otherOut },
              "predicted: kind " + k + " under " + otherAxis + ":" + otherOut));
          }
        }
      }
      return gen;
    },

    matches: function (c, input) {
      if (!c || !c.pattern) return false;
      const p = c.pattern;
      switch (p.type) {
        case "kind-presence": return p.kind === input.kind;
        case "kind-cooccurs":
          if (p.a === input.kind) return input.neighborKinds.indexOf(p.b) >= 0;
          if (p.b === input.kind) return input.neighborKinds.indexOf(p.a) >= 0;
          return false;
        case "kind-transition":
          return p.to === input.kind && p.from === input.prevKind;
        case "kind-run":
          // Run-detection requires sequential state we don't track here;
          // treat as never-matches for now (predictive only).
          return false;
        case "kind-with-cross-context": {
          if (p.kind !== input.kind) return false;
          const cross = _parseCrossTokens(input);
          return cross[p.otherAxis] === p.otherOut;
        }
      }
      return false;
    },

    familyType: function (c) {
      return c && c.pattern ? c.pattern.type : null;
    }
  };

  // ===================================================================
  // 2. VOCAB-PEER vocabulary
  // ===================================================================
  // Observes vocabulary content (token's actual text). Primitives:
  // text-presence, text-cooccurs, text-in-position, text-kind-binding.

  const vocabVocab = {
    tokenToInput: function (token) {
      const neighborTexts = [];
      if (token.neighbors_pre) for (const n of token.neighbors_pre) neighborTexts.push(n.text);
      if (token.neighbors_post) for (const n of token.neighbors_post) neighborTexts.push(n.text);
      return {
        text: token.text,
        kind: token.kind,
        position: token.position_class,
        neighborTexts: neighborTexts
      };
    },

    generateDerivedFromNovelty: function (input, field) {
      const gen = [];
      // Skip degenerate texts that would spam the field
      if (!input.text || input.text.length === 0) return gen;

      // text-presence
      if (!_has(field, "text-presence", function (p) { return p.text === input.text; })) {
        gen.push(_mkDerived("text-presence", { text: input.text },
          "text '" + input.text + "' present"));
      }
      // text-in-position binding
      if (gen.length < GEN_MAX_PER_TOKEN && input.position && input.position !== "OTHER") {
        if (!_has(field, "text-in-position", function (p) {
          return p.text === input.text && p.position === input.position;
        })) {
          gen.push(_mkDerived("text-in-position",
            { text: input.text, position: input.position },
            "'" + input.text + "' in " + input.position + " position"));
        }
      }
      // text-kind-binding
      if (gen.length < GEN_MAX_PER_TOKEN && input.kind) {
        if (!_has(field, "text-kind-binding", function (p) {
          return p.text === input.text && p.kind === input.kind;
        })) {
          gen.push(_mkDerived("text-kind-binding",
            { text: input.text, kind: input.kind },
            "'" + input.text + "' as " + input.kind));
        }
      }
      // Phase 3.3b: text-with-cross-context (text co-occurs with another
      // peer's lastOutput; cross-axis text affinity).
      const cross = _parseCrossTokens(input);
      for (const otherAxis in cross) {
        if (gen.length >= GEN_MAX_PER_TOKEN) break;
        const otherOut = cross[otherAxis];
        if (!_has(field, "text-with-cross-context", function (p) {
          return p.text === input.text && p.otherAxis === otherAxis && p.otherOut === otherOut;
        })) {
          gen.push(_mkDerived("text-with-cross-context",
            { text: input.text, otherAxis: otherAxis, otherOut: otherOut },
            "'" + input.text + "' under " + otherAxis + ":" + otherOut));
        }
      }
      return gen;
    },

    generatePredictionsFromGap: function (field) {
      // Bootstrap from derived-or-ratified (see kindVocab comment above).
      const gen = [];
      const declTexts = Object.create(null);
      const useTexts = Object.create(null);
      for (const c of field.constraints) {
        if (!c.pattern) continue;
        if (c.kind !== "derived" && c.kind !== "ratified") continue;
        if (c.pattern.type === "text-in-position") {
          if (c.pattern.position === "DECL") declTexts[c.pattern.text] = true;
          if (c.pattern.position === "USE") useTexts[c.pattern.text] = true;
        }
      }
      for (const t in declTexts) {
        if (useTexts[t]) continue;
        if (gen.length >= PRED_MAX_PER_GAP) break;
        gen.push(_mkPredictive("text-in-position",
          { text: t, position: "USE" },
          "predicted: '" + t + "' appears in USE position (DECL observed)"));
      }
      return gen;
    },

    matches: function (c, input) {
      if (!c || !c.pattern) return false;
      const p = c.pattern;
      switch (p.type) {
        case "text-presence": return p.text === input.text;
        case "text-in-position":
          return p.text === input.text && p.position === input.position;
        case "text-kind-binding":
          return p.text === input.text && p.kind === input.kind;
        case "text-cooccurs":
          if (p.a === input.text) return input.neighborTexts.indexOf(p.b) >= 0;
          if (p.b === input.text) return input.neighborTexts.indexOf(p.a) >= 0;
          return false;
        case "text-with-cross-context": {
          if (p.text !== input.text) return false;
          const cross = _parseCrossTokens(input);
          return cross[p.otherAxis] === p.otherOut;
        }
      }
      return false;
    },

    familyType: function (c) {
      return c && c.pattern ? c.pattern.type : null;
    }
  };

  // ===================================================================
  // 3. COOCCUR-PEER vocabulary
  // ===================================================================
  // Observes neighborhood signatures (kind-sequence around the token).
  // Primitives: neighborhood-signature, kind-in-neighborhood,
  // neighborhood-symmetry.

  // Stable hash of a string array — small, deterministic, no collisions
  // for the scales we operate at.
  function _hashKindSeq(arr) {
    let h = 5381;
    for (const s of arr) {
      const str = s || "_";
      for (let i = 0; i < str.length; i++) {
        h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
      }
      h = ((h << 5) + h + 124) >>> 0;  // separator
    }
    return "h" + h.toString(36);
  }

  const cooccurVocab = {
    tokenToInput: function (token) {
      const preKinds = (token.neighbors_pre || []).map(function (n) { return n.kind; });
      const postKinds = (token.neighbors_post || []).map(function (n) { return n.kind; });
      return {
        kind: token.kind,
        sig: _hashKindSeq(preKinds.concat(["|"], postKinds)),
        preKinds: preKinds,
        postKinds: postKinds,
        symmetric: preKinds.length === postKinds.length &&
          preKinds.every(function (k, i) {
            return k === postKinds[postKinds.length - 1 - i];
          })
      };
    },

    generateDerivedFromNovelty: function (input, field) {
      const gen = [];
      // neighborhood signature
      if (!_has(field, "neighborhood-sig", function (p) { return p.sig === input.sig; })) {
        gen.push(_mkDerived("neighborhood-sig", { sig: input.sig },
          "neighborhood-sig " + input.sig));
      }
      // kind-in-neighborhood
      if (gen.length < GEN_MAX_PER_TOKEN) {
        if (!_has(field, "kind-in-neighborhood", function (p) {
          return p.kind === input.kind && p.sig === input.sig;
        })) {
          gen.push(_mkDerived("kind-in-neighborhood", { kind: input.kind, sig: input.sig },
            input.kind + " in neighborhood " + input.sig));
        }
      }
      // symmetry
      if (gen.length < GEN_MAX_PER_TOKEN && input.symmetric && input.preKinds.length > 0) {
        if (!_has(field, "neighborhood-symmetry", function (p) { return p.sig === input.sig; })) {
          gen.push(_mkDerived("neighborhood-symmetry", { sig: input.sig },
            "symmetric neighborhood " + input.sig));
        }
      }
      // Phase 3.3b: cooccur-with-cross-context. Tie kind+cross-axis output
      // to neighborhood-bucket coarsely (avoid full-sig dimensionality).
      const cross = _parseCrossTokens(input);
      for (const otherAxis in cross) {
        if (gen.length >= GEN_MAX_PER_TOKEN) break;
        const otherOut = cross[otherAxis];
        if (!_has(field, "cooccur-with-cross-context", function (p) {
          return p.kind === input.kind && p.otherAxis === otherAxis && p.otherOut === otherOut;
        })) {
          gen.push(_mkDerived("cooccur-with-cross-context",
            { kind: input.kind, otherAxis: otherAxis, otherOut: otherOut },
            "cooccur kind " + input.kind + " under " + otherAxis + ":" + otherOut));
        }
      }
      return gen;
    },

    generatePredictionsFromGap: function (field) {
      // Bootstrap from derived-or-ratified (see kindVocab comment above).
      const gen = [];
      const seenKinIn = [];
      const haveSig = Object.create(null);
      for (const c of field.constraints) {
        if (!c.pattern) continue;
        if (c.kind !== "derived" && c.kind !== "ratified") continue;
        if (c.pattern.type === "kind-in-neighborhood") {
          seenKinIn.push(c.pattern);
        }
        if (c.pattern.type === "neighborhood-sig") {
          haveSig[c.pattern.sig] = true;
        }
      }
      for (const p of seenKinIn) {
        if (haveSig[p.sig]) continue;
        if (gen.length >= PRED_MAX_PER_GAP) break;
        gen.push(_mkPredictive("neighborhood-sig", { sig: p.sig },
          "predicted: neighborhood " + p.sig + " standalone presence"));
      }
      return gen;
    },

    matches: function (c, input) {
      if (!c || !c.pattern) return false;
      const p = c.pattern;
      switch (p.type) {
        case "neighborhood-sig": return p.sig === input.sig;
        case "kind-in-neighborhood": return p.kind === input.kind && p.sig === input.sig;
        case "neighborhood-symmetry": return p.sig === input.sig && input.symmetric;
        case "cooccur-with-cross-context": {
          if (p.kind !== input.kind) return false;
          const cross = _parseCrossTokens(input);
          return cross[p.otherAxis] === p.otherOut;
        }
      }
      return false;
    },

    familyType: function (c) {
      return c && c.pattern ? c.pattern.type : null;
    }
  };

  // ===================================================================
  // 4. POSITION-PEER vocabulary
  // ===================================================================
  // Observes syntactic position class. Primitives: position-presence,
  // position-text-binding (load-bearing for DECL-USE binding),
  // position-transition.

  const positionVocab = {
    tokenToInput: function (token) {
      const prevPos = (token.neighbors_pre && token.neighbors_pre.length > 0)
        ? (token.neighbors_pre[token.neighbors_pre.length - 1].position_class || null)
        : null;
      return {
        position: token.position_class,
        text: token.text,
        kind: token.kind,
        prevPosition: prevPos
      };
    },

    generateDerivedFromNovelty: function (input, field) {
      const gen = [];
      // position-presence
      if (!_has(field, "position-presence", function (p) { return p.position === input.position; })) {
        gen.push(_mkDerived("position-presence", { position: input.position },
          "position " + input.position + " present"));
      }
      // position-text-binding
      if (gen.length < GEN_MAX_PER_TOKEN && input.text && input.position !== "OTHER") {
        if (!_has(field, "position-text-binding", function (p) {
          return p.position === input.position && p.text === input.text;
        })) {
          gen.push(_mkDerived("position-text-binding",
            { position: input.position, text: input.text },
            "'" + input.text + "' bound to " + input.position));
        }
      }
      // position-transition
      if (gen.length < GEN_MAX_PER_TOKEN && input.prevPosition && input.prevPosition !== input.position) {
        if (!_has(field, "position-transition", function (p) {
          return p.from === input.prevPosition && p.to === input.position;
        })) {
          gen.push(_mkDerived("position-transition",
            { from: input.prevPosition, to: input.position },
            "position " + input.prevPosition + " -> " + input.position));
        }
      }
      // Phase 3.3b: position-with-cross-context
      const cross = _parseCrossTokens(input);
      for (const otherAxis in cross) {
        if (gen.length >= GEN_MAX_PER_TOKEN) break;
        const otherOut = cross[otherAxis];
        if (!_has(field, "position-with-cross-context", function (p) {
          return p.position === input.position && p.otherAxis === otherAxis && p.otherOut === otherOut;
        })) {
          gen.push(_mkDerived("position-with-cross-context",
            { position: input.position, otherAxis: otherAxis, otherOut: otherOut },
            "position " + input.position + " under " + otherAxis + ":" + otherOut));
        }
      }
      return gen;
    },

    generatePredictionsFromGap: function (field) {
      // DECL-USE completion: text bound to DECL but not to USE
      // (already uses derived-or-ratified — leave as is, this one was correct).
      const gen = [];
      const declTexts = Object.create(null);
      const useTexts = Object.create(null);
      for (const c of field.constraints) {
        if (!c.pattern || c.pattern.type !== "position-text-binding") continue;
        if (c.kind !== "ratified" && c.kind !== "derived") continue;
        if (c.pattern.position === "DECL") declTexts[c.pattern.text] = true;
        if (c.pattern.position === "USE") useTexts[c.pattern.text] = true;
      }
      for (const t in declTexts) {
        if (useTexts[t]) continue;
        if (gen.length >= PRED_MAX_PER_GAP) break;
        gen.push(_mkPredictive("position-text-binding",
          { position: "USE", text: t },
          "predicted: '" + t + "' USE site (DECL was bound)"));
      }
      return gen;
    },

    matches: function (c, input) {
      if (!c || !c.pattern) return false;
      const p = c.pattern;
      switch (p.type) {
        case "position-presence": return p.position === input.position;
        case "position-text-binding":
          return p.position === input.position && p.text === input.text;
        case "position-transition":
          return p.to === input.position && p.from === input.prevPosition;
        case "position-with-cross-context": {
          if (p.position !== input.position) return false;
          const cross = _parseCrossTokens(input);
          return cross[p.otherAxis] === p.otherOut;
        }
      }
      return false;
    },

    familyType: function (c) {
      return c && c.pattern ? c.pattern.type : null;
    }
  };

  // ===================================================================
  // 5. FREQUENCY-PEER vocabulary
  // ===================================================================
  // Observes recurrence statistics. Primitives: recurrence-bucket,
  // kind-recurrence-binding.

  // Bucket thresholds (per substrate-factory-spec §4.5):
  //   singleton  (1)
  //   rare       (2-5)
  //   moderate   (6-20)
  //   common     (21-100)
  //   dominant   (>100)
  function _bucketOf(count) {
    if (count <= 1) return "singleton";
    if (count <= 5) return "rare";
    if (count <= 20) return "moderate";
    if (count <= 100) return "common";
    return "dominant";
  }

  const frequencyVocab = {
    tokenToInput: function (token) {
      return {
        textBucket: _bucketOf(token.recurrence_text || 0),
        kindTextBucket: _bucketOf(token.recurrence_kind_text || 0),
        kind: token.kind,
        text: token.text
      };
    },

    generateDerivedFromNovelty: function (input, field) {
      const gen = [];
      // recurrence-bucket for text
      if (!_has(field, "recurrence-bucket", function (p) { return p.bucket === input.textBucket; })) {
        gen.push(_mkDerived("recurrence-bucket", { bucket: input.textBucket },
          "text-recurrence " + input.textBucket));
      }
      // kind-recurrence binding
      if (gen.length < GEN_MAX_PER_TOKEN && input.kind) {
        if (!_has(field, "kind-recurrence", function (p) {
          return p.kind === input.kind && p.bucket === input.textBucket;
        })) {
          gen.push(_mkDerived("kind-recurrence",
            { kind: input.kind, bucket: input.textBucket },
            input.kind + " has " + input.textBucket + " text recurrence"));
        }
      }
      // Phase 3.3b: freq-with-cross-context. The closed bucket-space
      // saturated in Phase 2; cross-context patterns add a new dimension
      // along which derivations can keep generating.
      const cross = _parseCrossTokens(input);
      for (const otherAxis in cross) {
        if (gen.length >= GEN_MAX_PER_TOKEN) break;
        const otherOut = cross[otherAxis];
        if (!_has(field, "freq-with-cross-context", function (p) {
          return p.bucket === input.textBucket && p.otherAxis === otherAxis && p.otherOut === otherOut;
        })) {
          gen.push(_mkDerived("freq-with-cross-context",
            { bucket: input.textBucket, otherAxis: otherAxis, otherOut: otherOut },
            "bucket " + input.textBucket + " under " + otherAxis + ":" + otherOut));
        }
      }
      return gen;
    },

    generatePredictionsFromGap: function (field) {
      // Predict bucket completion: if 3+ buckets are observed (derived
      // or ratified), predict any standard bucket still missing.
      const STANDARD_BUCKETS = ["singleton", "rare", "moderate", "common", "dominant"];
      const observedBuckets = Object.create(null);
      let count = 0;
      for (const c of field.constraints) {
        if (!c.pattern) continue;
        if (c.kind !== "derived" && c.kind !== "ratified") continue;
        if (c.pattern.type === "recurrence-bucket") {
          observedBuckets[c.pattern.bucket] = true;
          count++;
        }
      }
      if (count < 3) return [];
      const gen = [];
      for (const b of STANDARD_BUCKETS) {
        if (observedBuckets[b]) continue;
        if (gen.length >= PRED_MAX_PER_GAP) break;
        gen.push(_mkPredictive("recurrence-bucket", { bucket: b },
          "predicted: " + b + " bucket appears (others observed)"));
      }
      return gen;
    },

    matches: function (c, input) {
      if (!c || !c.pattern) return false;
      const p = c.pattern;
      switch (p.type) {
        case "recurrence-bucket": return p.bucket === input.textBucket;
        case "kind-recurrence":
          return p.kind === input.kind && p.bucket === input.textBucket;
        case "freq-with-cross-context": {
          if (p.bucket !== input.textBucket) return false;
          const cross = _parseCrossTokens(input);
          return cross[p.otherAxis] === p.otherOut;
        }
      }
      return false;
    },

    familyType: function (c) {
      return c && c.pattern ? c.pattern.type : null;
    }
  };

  // ===================================================================
  // 6. COMPOSER-PEER vocabulary (Phase 3.3)
  // ===================================================================
  // The composer reads the five peers' lastOutputs as input (it has no
  // direct corpus access). Its tokenToInput is therefore a thin shim
  // that exposes ctx.peerLastOutputs to matches(). Derivation generates
  // intersection patterns when multiple peers' outputs agree on a
  // structural read; predictive generation reaches for output
  // combinations not yet seen.

  const COMPOSER_GEN_MAX_PER_TOKEN = 3;
  const COMPOSER_PRED_MAX_PER_GAP = 2;

  const composerVocab = {
    tokenToInput: function (token) {
      // The composer's "input" is constructed by makePeer's tokensFn
      // path — see peer-specs.js composer spec. The token-level fields
      // here just expose the corpus token's identity for completeness.
      return {
        index: token.index || 0,
        kind: token.kind,
        text: token.text,
        position: token.position_class
        // intakeTokens (from tokensFn) is what matches() actually reads.
      };
    },

    generateDerivedFromNovelty: function (input, field) {
      const gen = [];
      const tokens = input.intakeTokens || [];
      // Extract the per-axis "from-<axis>:<output>" projections.
      const peerOutputs = Object.create(null);
      for (const t of tokens) {
        if (typeof t !== "string" || t.indexOf("from-") !== 0) continue;
        const colonIdx = t.indexOf(":");
        if (colonIdx < 5) continue;
        const axis = t.slice(5, colonIdx);
        const out = t.slice(colonIdx + 1);
        peerOutputs[axis] = out;
      }
      const axes = Object.keys(peerOutputs);
      if (axes.length < 2) return gen;

      // Derived: pair-presence (which two axes agreed on what?)
      for (let i = 0; i < axes.length; i++) {
        for (let j = i + 1; j < axes.length; j++) {
          if (gen.length >= COMPOSER_GEN_MAX_PER_TOKEN) break;
          const aAxis = axes[i], bAxis = axes[j];
          const aOut = peerOutputs[aAxis], bOut = peerOutputs[bAxis];
          if (!_has(field, "composer-pair", function (p) {
            return p.aAxis === aAxis && p.bAxis === bAxis &&
                   p.aOut === aOut && p.bOut === bOut;
          })) {
            gen.push(_mkDerived("composer-pair",
              { aAxis: aAxis, bAxis: bAxis, aOut: aOut, bOut: bOut },
              "composer pair: " + aAxis + ":" + aOut + " & " + bAxis + ":" + bOut));
          }
        }
        if (gen.length >= COMPOSER_GEN_MAX_PER_TOKEN) break;
      }
      // Derived: full-tuple (all five peers' outputs on this step)
      if (gen.length < COMPOSER_GEN_MAX_PER_TOKEN && axes.length >= 3) {
        const tupleKey = axes.sort().map(function (a) {
          return a + ":" + peerOutputs[a];
        }).join("|");
        if (!_has(field, "composer-tuple", function (p) { return p.key === tupleKey; })) {
          gen.push(_mkDerived("composer-tuple",
            { key: tupleKey, outputs: Object.assign({}, peerOutputs) },
            "composer tuple: " + tupleKey));
        }
      }
      return gen;
    },

    generatePredictionsFromGap: function (field) {
      const gen = [];
      // Predict: for each pair-presence derived/ratified, predict a
      // third axis's output that "completes" the tuple. Bootstrap from
      // derived-or-ratified (chicken-and-egg fix per peer-vocabs).
      const pairs = [];
      for (const c of field.constraints) {
        if (!c.pattern) continue;
        if (c.kind !== "derived" && c.kind !== "ratified") continue;
        if (c.pattern.type === "composer-pair") pairs.push(c.pattern);
      }
      const tuples = Object.create(null);
      for (const c of field.constraints) {
        if (c.pattern && c.pattern.type === "composer-tuple") {
          tuples[c.pattern.key] = true;
        }
      }
      for (const p of pairs) {
        if (gen.length >= COMPOSER_PRED_MAX_PER_GAP) break;
        // Predict that a third axis agreement extends this pair
        gen.push(_mkPredictive("composer-extension",
          { aAxis: p.aAxis, bAxis: p.bAxis, aOut: p.aOut, bOut: p.bOut },
          "predicted: " + p.aAxis + ":" + p.aOut + " & " + p.bAxis + ":" + p.bOut + " extends"));
      }
      return gen;
    },

    matches: function (c, input) {
      if (!c || !c.pattern) return false;
      const p = c.pattern;
      const tokens = input.intakeTokens || [];
      const peerOutputs = Object.create(null);
      for (const t of tokens) {
        if (typeof t !== "string" || t.indexOf("from-") !== 0) continue;
        const colonIdx = t.indexOf(":");
        if (colonIdx < 5) continue;
        peerOutputs[t.slice(5, colonIdx)] = t.slice(colonIdx + 1);
      }
      switch (p.type) {
        case "composer-pair":
          return peerOutputs[p.aAxis] === p.aOut &&
                 peerOutputs[p.bAxis] === p.bOut;
        case "composer-tuple": {
          const axes = Object.keys(peerOutputs).sort();
          if (axes.length < 2) return false;
          const tupleKey = axes.map(function (a) {
            return a + ":" + peerOutputs[a];
          }).join("|");
          return tupleKey === p.key;
        }
        case "composer-extension":
          // Match when the two stipulated axes hold their outputs AND
          // at least one additional axis is present (extension confirmed)
          if (peerOutputs[p.aAxis] !== p.aOut) return false;
          if (peerOutputs[p.bAxis] !== p.bOut) return false;
          const others = Object.keys(peerOutputs).filter(function (a) {
            return a !== p.aAxis && a !== p.bAxis;
          });
          return others.length >= 1;
      }
      return false;
    },

    familyType: function (c) {
      return c && c.pattern ? c.pattern.type : null;
    }
  };

  // ===================================================================
  // Module
  // ===================================================================

  const PrimitiveVocabs = Object.freeze({
    kind:      kindVocab,
    vocab:     vocabVocab,
    cooccur:   cooccurVocab,
    position:  positionVocab,
    frequency: frequencyVocab,
    composer:  composerVocab
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = PrimitiveVocabs;
  } else {
    global.PrimitiveVocabs = PrimitiveVocabs;
  }

})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));
