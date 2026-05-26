// peer-specs.js
// =============================================================================
// Phase 11 Phase 3.2 — five-axis intake-configuration specs.
//
// Each peer's spec carries the Phase 3.1 intake-configuration fields:
//   dimsFn, tokensFn, outputVar, defaultOutput, outputAlphabet,
//   domainRules, centroids, onRatify.
//
// Per phase-3-spec.md §3.3: placeholder dynamicities honor canonical shape:
//   - finite output alphabet per peer (canonical)
//   - one output token emitted per step (canonical)
//   - domainRules map coord -> output (canonical, most-specific-match wins)
//   - invention samples patterns at ratification (canonical per duel research,
//     consistent with SE-11 §3)
//   - K1 promotion shapes which patterns become structurally load-bearing
//     through measured fidelity (canonical)
// The specific alphabet members, domain-rule mappings, and centroid templates
// are simpler-than-canonical content (placeholder) the substrate accumulates
// fidelity around.
//
// Per discipline §2.1 / O3: output alphabets name STRUCTURAL-SHAPE roles
// (run-position, transition-type, recurrence-novelty), NOT domain-content
// roles (no "function-decl", no "variable-use"). Centroid templates use
// substrate-internal vocabulary only.
//
// Phase 3.2 scope: per-peer in ISOLATION. tokensFn returns intake tokens
// derived from the current token + the peer's own ctx.selfLastOutput;
// cross-peer outputs (ctx.peerLastOutputs) are not read here — that wiring
// is Phase 3.3.
// =============================================================================

"use strict";

(function (global) {

  // ---------------------------------------------------------------------
  // Common helpers
  // ---------------------------------------------------------------------

  // Sample a kind from constraints currently in the field (substrate-
  // internal vocabulary only per O3).
  function _sampleKindFromField(field) {
    const kinds = Object.create(null);
    for (const c of field.constraints) {
      if (!c.pattern) continue;
      if (c.pattern.kind)         kinds[c.pattern.kind]         = true;
      if (c.pattern.a)            kinds[c.pattern.a]            = true;
      if (c.pattern.b)            kinds[c.pattern.b]            = true;
      if (c.pattern.from)         kinds[c.pattern.from]         = true;
      if (c.pattern.to)           kinds[c.pattern.to]           = true;
      if (c.pattern.context_kind) kinds[c.pattern.context_kind] = true;
    }
    const ks = Object.keys(kinds);
    if (ks.length === 0) return null;
    return ks[Math.floor(Math.random() * ks.length)];
  }

  function _sampleTextFromField(field) {
    const texts = Object.create(null);
    for (const c of field.constraints) {
      if (!c.pattern) continue;
      if (c.pattern.text) texts[c.pattern.text] = true;
    }
    const ts = Object.keys(texts);
    if (ts.length === 0) return null;
    return ts[Math.floor(Math.random() * ts.length)];
  }

  function _samplePositionFromField(field) {
    const pos = Object.create(null);
    for (const c of field.constraints) {
      if (!c.pattern) continue;
      if (c.pattern.position) pos[c.pattern.position] = true;
    }
    const ps = Object.keys(pos);
    if (ps.length === 0) return null;
    return ps[Math.floor(Math.random() * ps.length)];
  }

  // ===================================================================
  // 1. KIND-PEER intake config
  // ===================================================================
  // Coord captures: current kind, prev-same, next-same, prev-kind
  // (substrate-internal: just lexical kind values from the Acorn
  // adapter). Output alphabet names run-position roles.

  const kindIntakeConfig = {
    dimsFn: function (token, ctx) {
      const prev = (token.neighbors_pre  && token.neighbors_pre.length > 0)
        ? token.neighbors_pre[token.neighbors_pre.length - 1]  : null;
      const next = (token.neighbors_post && token.neighbors_post.length > 0)
        ? token.neighbors_post[0]                              : null;
      const prevSame = prev && prev.kind === token.kind;
      const nextSame = next && next.kind === token.kind;
      return {
        kind:     token.kind,
        prevSame: prevSame ? "yes" : "no",
        nextSame: nextSame ? "yes" : "no",
        prevKind: prev ? prev.kind : "none"
      };
    },

    tokensFn: function (token, ctx) {
      const t = ["k-" + token.kind];
      if (ctx && ctx.selfLastOutput) t.push("self-" + ctx.selfLastOutput);
      // Cross-peer tokens will land here in Phase 3.3.
      return t;
    },

    outputVar:      "--kind-role",
    defaultOutput:  "kind-isolated",
    outputAlphabet: [
      "kind-run-start", "kind-run-mid", "kind-run-end",
      "kind-transition", "kind-isolated"
    ],

    // Placeholder rules. Most-specific match wins; ties → last declared.
    // These rules use ONLY substrate-internal coord values.
    domainRules: [
      // No-neighbors-same -> isolated (least specific)
      { when: { prevSame: "no",  nextSame: "no"  }, then: "kind-isolated" },
      // Run boundaries
      { when: { prevSame: "no",  nextSame: "yes" }, then: "kind-run-start" },
      { when: { prevSame: "yes", nextSame: "no"  }, then: "kind-run-end" },
      // Run interior
      { when: { prevSame: "yes", nextSame: "yes" }, then: "kind-run-mid" },
      // Explicit transition: prev exists, prev different from current,
      // next is either different or non-existent. We mark transitions
      // only when there IS a prev (so isolated-at-start stays isolated).
      // This rule is more specific than the prevSame=no/nextSame=no rule
      // because it specifies prevKind, so it wins on ties.
      // Note: "prevKind != none" filters out absolute-start positions.
      // We can't express "not-equal" in rule-form, so we leave this as
      // a placeholder — the substrate will accumulate fidelity around
      // whichever combinations actually fire.
    ],

    centroids: {
      "kind-run-start":  { contextSlot: "post" },
      "kind-run-mid":    { contextSlot: "both" },
      "kind-run-end":    { contextSlot: "pre" },
      "kind-transition": { contextSlot: "transition" },
      "kind-isolated":   { contextSlot: "neither" }
    },

    onRatify: function (c, field, ctx) {
      const centroid = this.centroids[ctx.selfLastOutput];
      const sampledKind = _sampleKindFromField(field);
      if (!sampledKind) return null;
      return {
        pattern: {
          type:    "kind-context-pattern",
          kind:    sampledKind,
          context: ctx.selfLastOutput,
          slot:    centroid ? centroid.contextSlot : "unknown"
        },
        desc: "kind-peer invented at " + ctx.selfLastOutput
      };
    }
  };

  // ===================================================================
  // 2. VOCAB-PEER intake config
  // ===================================================================
  // Observes vocabulary content. Coord: textBucket (per token recurrence),
  // position class, kind. Output alphabet names recurrence-novelty +
  // binding roles.

  function _bucketFromRecurrence(n) {
    if (n <= 1)  return "singleton";
    if (n <= 5)  return "rare";
    if (n <= 20) return "moderate";
    if (n <= 100) return "common";
    return "dominant";
  }

  const vocabIntakeConfig = {
    dimsFn: function (token, ctx) {
      return {
        bucket:   _bucketFromRecurrence(token.recurrence_text || 0),
        position: token.position_class,
        kind:     token.kind,
        // empty-text? (would distort vocab readings)
        empty: (!token.text || token.text.length === 0) ? "yes" : "no"
      };
    },

    tokensFn: function (token, ctx) {
      const t = [
        "v-" + (token.text || "").slice(0, 16),
        "pos-" + token.position_class,
        "bucket-" + _bucketFromRecurrence(token.recurrence_text || 0)
      ];
      if (ctx && ctx.selfLastOutput) t.push("self-" + ctx.selfLastOutput);
      return t;
    },

    outputVar:      "--vocab-role",
    defaultOutput:  "vocab-fresh",
    outputAlphabet: [
      "vocab-fresh", "vocab-recurring",
      "vocab-binding-decl", "vocab-binding-use", "vocab-positional"
    ],

    domainRules: [
      { when: { bucket: "singleton" },                  then: "vocab-fresh" },
      { when: { bucket: "rare" },                       then: "vocab-fresh" },
      { when: { bucket: "moderate" },                   then: "vocab-recurring" },
      { when: { bucket: "common" },                     then: "vocab-recurring" },
      { when: { bucket: "dominant" },                   then: "vocab-recurring" },
      // Position-bound: more specific (matches on 2 dims)
      { when: { position: "DECL" },                     then: "vocab-binding-decl" },
      { when: { position: "USE"  },                     then: "vocab-binding-use" },
      // Combination wins (3 dims) for recurring-in-position
      { when: { bucket: "moderate", position: "DECL" }, then: "vocab-binding-decl" },
      { when: { bucket: "common",   position: "DECL" }, then: "vocab-binding-decl" },
      { when: { bucket: "dominant", position: "DECL" }, then: "vocab-binding-decl" },
      { when: { bucket: "moderate", position: "USE"  }, then: "vocab-binding-use" },
      { when: { bucket: "common",   position: "USE"  }, then: "vocab-binding-use" },
      { when: { bucket: "dominant", position: "USE"  }, then: "vocab-binding-use" },
      // Positional but not DECL/USE
      { when: { position: "ATTR" },                     then: "vocab-positional" },
      { when: { position: "CALLEE" },                   then: "vocab-positional" },
      { when: { position: "KEY" },                      then: "vocab-positional" },
      { when: { position: "STR" },                      then: "vocab-positional" }
    ],

    centroids: {
      "vocab-fresh":          { focus: "text-presence" },
      "vocab-recurring":      { focus: "text-cooccurs" },
      "vocab-binding-decl":   { focus: "decl-context" },
      "vocab-binding-use":    { focus: "use-context" },
      "vocab-positional":     { focus: "position-context" }
    },

    onRatify: function (c, field, ctx) {
      const sampledText     = _sampleTextFromField(field);
      const sampledPosition = _samplePositionFromField(field);
      if (!sampledText) return null;
      return {
        pattern: {
          type:     "text-context-pattern",
          text:     sampledText,
          position: sampledPosition || "OTHER",
          context:  ctx.selfLastOutput,
          focus:    this.centroids[ctx.selfLastOutput] ?
                    this.centroids[ctx.selfLastOutput].focus : "unknown"
        },
        desc: "vocab-peer invented at " + ctx.selfLastOutput
      };
    }
  };

  // ===================================================================
  // 3. COOCCUR-PEER intake config
  // ===================================================================
  // Observes neighborhood signatures. Coord: pre-window length, post-
  // window length, symmetry. Output names neighborhood-character.

  function _isSymmetric(token) {
    const pre  = token.neighbors_pre  || [];
    const post = token.neighbors_post || [];
    if (pre.length !== post.length) return false;
    for (let i = 0; i < pre.length; i++) {
      if (pre[i].kind !== post[post.length - 1 - i].kind) return false;
    }
    return pre.length > 0;
  }

  function _neighborhoodBucket(token) {
    const pre  = (token.neighbors_pre  || []).length;
    const post = (token.neighbors_post || []).length;
    if (pre === 0 && post === 0) return "alone";
    if (pre === 0) return "leading";
    if (post === 0) return "trailing";
    return "embedded";
  }

  const cooccurIntakeConfig = {
    dimsFn: function (token, ctx) {
      return {
        bucket:    _neighborhoodBucket(token),
        symmetric: _isSymmetric(token) ? "yes" : "no",
        kind:      token.kind
      };
    },

    tokensFn: function (token, ctx) {
      const t = [
        "nb-" + _neighborhoodBucket(token),
        "sym-" + (_isSymmetric(token) ? "yes" : "no")
      ];
      // Add a couple of neighbor-kind tokens (substrate-internal)
      const pre  = token.neighbors_pre  || [];
      const post = token.neighbors_post || [];
      if (pre.length > 0)  t.push("nbpre-"  + pre[pre.length - 1].kind);
      if (post.length > 0) t.push("nbpost-" + post[0].kind);
      if (ctx && ctx.selfLastOutput) t.push("self-" + ctx.selfLastOutput);
      return t;
    },

    outputVar:      "--cooccur-role",
    defaultOutput:  "cooccur-isolated",
    outputAlphabet: [
      "cooccur-sig-novel", "cooccur-sig-recurring",
      "cooccur-symmetric", "cooccur-anchored", "cooccur-isolated"
    ],

    domainRules: [
      { when: { bucket: "alone" },                          then: "cooccur-isolated" },
      { when: { bucket: "leading" },                        then: "cooccur-anchored" },
      { when: { bucket: "trailing" },                       then: "cooccur-anchored" },
      { when: { bucket: "embedded" },                       then: "cooccur-sig-novel" },
      { when: { symmetric: "yes" },                         then: "cooccur-symmetric" },
      { when: { symmetric: "yes", bucket: "embedded" },     then: "cooccur-symmetric" }
    ],

    centroids: {
      "cooccur-sig-novel":     { signature: "novel-neighborhood" },
      "cooccur-sig-recurring": { signature: "recurring-neighborhood" },
      "cooccur-symmetric":     { signature: "mirror-neighborhood" },
      "cooccur-anchored":      { signature: "boundary-neighborhood" },
      "cooccur-isolated":      { signature: "lone-neighborhood" }
    },

    onRatify: function (c, field, ctx) {
      const sampledKind = _sampleKindFromField(field);
      if (!sampledKind) return null;
      return {
        pattern: {
          type:      "cooccur-context-pattern",
          kind:      sampledKind,
          context:   ctx.selfLastOutput,
          signature: this.centroids[ctx.selfLastOutput] ?
                     this.centroids[ctx.selfLastOutput].signature : "unknown"
        },
        desc: "cooccur-peer invented at " + ctx.selfLastOutput
      };
    }
  };

  // ===================================================================
  // 4. POSITION-PEER intake config
  // ===================================================================
  // Coord: position class, prev-position, position transition?
  // Output names position-role (decl/use/attr/other/transition).

  const positionIntakeConfig = {
    dimsFn: function (token, ctx) {
      const prev = (token.neighbors_pre && token.neighbors_pre.length > 0)
        ? token.neighbors_pre[token.neighbors_pre.length - 1] : null;
      const prevPos = prev ? prev.position_class || "OTHER" : "NONE";
      const isTransition = prev && prev.position_class &&
                           prev.position_class !== token.position_class;
      return {
        position:     token.position_class || "OTHER",
        prevPosition: prevPos,
        transition:   isTransition ? "yes" : "no"
      };
    },

    tokensFn: function (token, ctx) {
      const t = ["pos-" + (token.position_class || "OTHER")];
      const prev = (token.neighbors_pre && token.neighbors_pre.length > 0)
        ? token.neighbors_pre[token.neighbors_pre.length - 1] : null;
      if (prev) t.push("prev-pos-" + (prev.position_class || "OTHER"));
      if (ctx && ctx.selfLastOutput) t.push("self-" + ctx.selfLastOutput);
      return t;
    },

    outputVar:      "--position-role",
    defaultOutput:  "position-other",
    outputAlphabet: [
      "position-decl", "position-use", "position-attr",
      "position-other", "position-transition"
    ],

    domainRules: [
      { when: { position: "DECL"   }, then: "position-decl" },
      { when: { position: "USE"    }, then: "position-use" },
      { when: { position: "CALLEE" }, then: "position-use" },
      { when: { position: "ATTR"   }, then: "position-attr" },
      { when: { position: "KEY"    }, then: "position-attr" },
      { when: { position: "STR"    }, then: "position-other" },
      { when: { position: "OTHER"  }, then: "position-other" },
      // Transition wins on 2-dim specificity
      { when: { transition: "yes", position: "DECL"   }, then: "position-transition" },
      { when: { transition: "yes", position: "USE"    }, then: "position-transition" },
      { when: { transition: "yes", position: "ATTR"   }, then: "position-transition" },
      { when: { transition: "yes", position: "CALLEE" }, then: "position-transition" },
      { when: { transition: "yes", position: "KEY"    }, then: "position-transition" }
    ],

    centroids: {
      "position-decl":       { focus: "decl-site" },
      "position-use":        { focus: "use-site" },
      "position-attr":       { focus: "attr-site" },
      "position-other":      { focus: "other-site" },
      "position-transition": { focus: "site-boundary" }
    },

    onRatify: function (c, field, ctx) {
      const sampledPosition = _samplePositionFromField(field);
      const sampledKind     = _sampleKindFromField(field);
      if (!sampledPosition && !sampledKind) return null;
      return {
        pattern: {
          type:     "position-context-pattern",
          position: sampledPosition || "OTHER",
          kind:     sampledKind || "ident",
          context:  ctx.selfLastOutput,
          focus:    this.centroids[ctx.selfLastOutput] ?
                    this.centroids[ctx.selfLastOutput].focus : "unknown"
        },
        desc: "position-peer invented at " + ctx.selfLastOutput
      };
    }
  };

  // ===================================================================
  // 5. FREQUENCY-PEER intake config
  // ===================================================================
  // Coord: text bucket, kind bucket. Output names recurrence levels.
  //
  // Per Phase 2 frequency-peer finding (saturation at 31 derived):
  // the bucket-completion predictive strategy saturated because the
  // bucket space is small. Phase 3.2's frequency intake-config does
  // not retune that — it just gives the substrate an output alphabet
  // and a coord projection, leaving K1 to accumulate fidelity if it
  // can.

  const frequencyIntakeConfig = {
    dimsFn: function (token, ctx) {
      return {
        textBucket: _bucketFromRecurrence(token.recurrence_text || 0),
        kindBucket: _bucketFromRecurrence(token.recurrence_kind || 0),
        ktBucket:   _bucketFromRecurrence(token.recurrence_kind_text || 0)
      };
    },

    tokensFn: function (token, ctx) {
      const t = [
        "tb-" + _bucketFromRecurrence(token.recurrence_text || 0),
        "kb-" + _bucketFromRecurrence(token.recurrence_kind || 0),
        "ktb-" + _bucketFromRecurrence(token.recurrence_kind_text || 0)
      ];
      if (ctx && ctx.selfLastOutput) t.push("self-" + ctx.selfLastOutput);
      return t;
    },

    outputVar:      "--frequency-role",
    defaultOutput:  "freq-singleton",
    outputAlphabet: [
      "freq-singleton", "freq-rare", "freq-moderate",
      "freq-common", "freq-dominant"
    ],

    domainRules: [
      { when: { textBucket: "singleton" }, then: "freq-singleton" },
      { when: { textBucket: "rare"      }, then: "freq-rare" },
      { when: { textBucket: "moderate"  }, then: "freq-moderate" },
      { when: { textBucket: "common"    }, then: "freq-common" },
      { when: { textBucket: "dominant"  }, then: "freq-dominant" }
    ],

    centroids: {
      "freq-singleton": { level: "lonely" },
      "freq-rare":      { level: "low" },
      "freq-moderate":  { level: "mid" },
      "freq-common":    { level: "high" },
      "freq-dominant":  { level: "saturated" }
    },

    onRatify: function (c, field, ctx) {
      const sampledKind = _sampleKindFromField(field);
      const buckets = ["singleton", "rare", "moderate", "common", "dominant"];
      const sampledBucket = buckets[Math.floor(Math.random() * buckets.length)];
      if (!sampledKind) return null;
      return {
        pattern: {
          type:    "freq-context-pattern",
          kind:    sampledKind,
          bucket:  sampledBucket,
          context: ctx.selfLastOutput,
          level:   this.centroids[ctx.selfLastOutput] ?
                   this.centroids[ctx.selfLastOutput].level : "unknown"
        },
        desc: "frequency-peer invented at " + ctx.selfLastOutput
      };
    }
  };

  // ===================================================================
  // Bind onRatify closures so `this` inside them references the spec
  // ===================================================================

  kindIntakeConfig.onRatify      = kindIntakeConfig.onRatify.bind(kindIntakeConfig);
  vocabIntakeConfig.onRatify     = vocabIntakeConfig.onRatify.bind(vocabIntakeConfig);
  cooccurIntakeConfig.onRatify   = cooccurIntakeConfig.onRatify.bind(cooccurIntakeConfig);
  positionIntakeConfig.onRatify  = positionIntakeConfig.onRatify.bind(positionIntakeConfig);
  frequencyIntakeConfig.onRatify = frequencyIntakeConfig.onRatify.bind(frequencyIntakeConfig);

  // ===================================================================
  // Module
  // ===================================================================

  const PeerSpecs = Object.freeze({
    kind:      kindIntakeConfig,
    vocab:     vocabIntakeConfig,
    cooccur:   cooccurIntakeConfig,
    position:  positionIntakeConfig,
    frequency: frequencyIntakeConfig
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = PeerSpecs;
  } else {
    global.PeerSpecs = PeerSpecs;
  }

})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));
