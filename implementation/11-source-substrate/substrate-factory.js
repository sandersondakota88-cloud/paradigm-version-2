// substrate-factory.js
// =============================================================================
// Phase 11 — produces a Peer substrate instance per axis-configuration.
//
// A Peer is one instance of the canonical SE-05/K1 cycle running over a
// single observation axis. The peer wraps the canonical Field's public
// methods (ratify, integrate, markUsed, modulate, refreshVectorDelta,
// evictStalePredictions, checkPromotions, recordFidelity) but constructs
// the per-tick cycle itself rather than going through the CT engine's
// compiler/ER evaluation path. See substrate-factory-spec.md §5 for why.
//
// Per Phase 11 discipline (PLAN.md §2):
//   - No hardcoded interpretation: peer's primitive vocabulary is plugged
//     in; the vocabulary's content is open and the cascade rules emerge
//     through K1 promotion.
//   - Substrate runs independently: no supervision, no orchestration,
//     each peer has its own state.
//   - Placeholder dynamicities honor canonical mechanism shape: M2/M3/K1/
//     SE-03/F2 preserved. Simpler primitive content per peer; faithful
//     cycle structure.
//
// Per substrate-factory-spec.md §5 revised: peers evaluate CPU-side in
// Phase 2. Phase 4 hoists peer fields to GPU.
// =============================================================================

"use strict";

(function (global) {

  // ---------------------------------------------------------------------
  // Fresh per-peer field state
  // ---------------------------------------------------------------------
  // The canonical Field is a singleton (object literal). Multiple peers
  // need independent state. The factory constructs a fresh peer-field by
  // shallow-copying the canonical Field's method references onto a fresh
  // state object. Methods are shared (correctness from one source); state
  // is per-peer.
  //
  // We don't modify the canonical Field; we make per-peer instances that
  // behave like it.

  function makePeerField(FieldModule, seedOverride) {
    const CanonField = FieldModule.Field;
    const CanonSeed = FieldModule.SEED;

    // Build a fresh state object with all Field slots set to their
    // initial values (matching Field.reset()'s initialization).
    const peerField = {
      // Constraint set
      constraints: [Object.assign({}, seedOverride || CanonSeed)],
      aged: [],
      inputCount: 0,
      step: 0,
      ratCount: 0,

      // Vector-delta at render scope
      scalarDelta: 1.0,
      fastDelta: 1.0,
      slowDelta: 1.0,
      gap: 0.0,

      // Substrate modulation (SE-03)
      fastMod: 0.0,
      slowMod: 0.5,

      // Recent ops window (for fast-delta computation)
      recentOps: [],

      // Correlation structure
      correlations: Object.create(null),

      // K1 fidelity tracking
      familyFidelity: Object.create(null),

      // K1 promoted sub-cascades
      subcascades: [],

      // K3 naming preference accumulator
      namingPref: 0.0,
      namedCount: 0,

      // CT-engine slots (peers don't use the CT engine but Field methods
      // may reference them; initialize defensively)
      ctPendingOps: [],
      ctInFlightOp: null,
      ctCommittedQueue: [],
      ctTotalOpsSeen: 0,
      ctOpsCompleted: 0,
      ctLastSnapshotStep: 0,
      execScalarDelta: 1.0,
      execFastDelta: 1.0,
      execSlowDelta: 1.0,
      execGap: 0.0,

      // Phase 4b compound machinery (unused by peers but present)
      compoundFidelity: Object.create(null),
      compoundGenerationHistory: [],

      // Phase 4c recall machinery (unused by peers but present)
      recallWindow: [],
      recallEventLog: [],

      lastMatchedCompoundIds: [],

      // Internal id counter for generated constraints
      _idCtr: 0
    };

    // Copy method references from the canonical Field. These will execute
    // with `this` bound to peerField when called as peerField.methodName().
    // The methods don't capture the canonical Field's state via closure;
    // they all use `this`.
    const METHOD_NAMES = [
      // Delta computation (F2, M1)
      "_deltaOver", "computeScalarDelta", "computeFastDelta",
      "updateSlowDelta", "refreshVectorDelta",
      // Predictive + ratification (M2.2, M3) -- we override generate +
      // generatePredictions per-peer (see makePeer below), but ratify
      // is the canonical implementation
      "ratify", "evictStalePredictions",
      // Constraint integration + flow discipline
      "integrate", "_enforceCaps",
      // Selection + use marking
      "selectFromMatches", "markUsed",
      // Modulation (SE-03, M4)
      "modulate", "recordOp",
      // K1 fidelity + promotion (includes helpers that checkPromotions calls)
      "recordFidelity", "fidelityOf", "checkPromotions",
      "_subForFamily", "_mkSubcascade", "_findById", "_nameInUse",
      "computeSubcascadeDelta", "reinforceNaming",
      // K2/K3 naming
      "detectNames", "findByName"
    ];

    for (const name of METHOD_NAMES) {
      if (typeof CanonField[name] === "function") {
        peerField[name] = CanonField[name];
      }
    }

    return peerField;
  }

  // ---------------------------------------------------------------------
  // The Peer instance
  // ---------------------------------------------------------------------

  function makePeer(opts) {
    if (!opts) throw new TypeError("makePeer: opts required");
    if (!opts.FieldModule) throw new TypeError("makePeer: FieldModule required");
    if (!opts.id || typeof opts.id !== "string") throw new TypeError("makePeer: id (string) required");
    if (!opts.axis || typeof opts.axis !== "string") throw new TypeError("makePeer: axis (string) required");
    if (!opts.primitiveVocab) throw new TypeError("makePeer: primitiveVocab required");

    const FieldModule = opts.FieldModule;
    const Trace = FieldModule.Trace;
    const CFG = FieldModule.CFG;
    const vocab = opts.primitiveVocab;

    // Construct the per-peer field with optional seed override
    const seedOverride = opts.seed || null;
    const field = makePeerField(FieldModule, seedOverride);

    // Stats per peer (read-only via observe())
    const stats = {
      tokensIngested: 0,
      derivedGenerated: 0,
      predictionsGenerated: 0,
      ratificationsObserved: 0,
      promotionsObserved: 0,
      evictionsObserved: 0
    };

    // ----------------------------------------------------------
    // The per-peer cycle. Mirrors ct-engine.js _opInput's structure
    // but uses vocab.matches() directly instead of compiler/ER.
    // ----------------------------------------------------------
    function ingest(token) {
      field.step++;
      field.inputCount++;
      stats.tokensIngested++;

      // Convert token to peer-input shape
      const input = vocab.tokenToInput(token);

      // Refresh vector-delta before evaluation (canonical kernel does
      // this in _opInput before matching)
      field.refreshVectorDelta();
      const vBefore = {
        scalar: field.scalarDelta,
        fast: field.fastDelta,
        slow: field.slowDelta,
        gap: field.gap
      };

      // Match against current constraints using the peer's vocab
      const matched = [];
      for (let i = 0; i < field.constraints.length; i++) {
        const c = field.constraints[i];
        if (!c || c.kind === "seed") continue;
        try {
          if (vocab.matches(c, input)) matched.push(i);
        } catch (e) {
          // Defensive: vocab errors don't kill the cycle
        }
      }

      // Ratify matched predictives (M3)
      const ratifiedThisStep = [];
      for (const idx of matched) {
        const c = field.constraints[idx];
        if (c && c.kind === "predictive") {
          if (field.ratify(idx)) {
            ratifiedThisStep.push(c);
            stats.ratificationsObserved++;
          }
        }
      }

      // Compute novelty for derived-generation gate
      const matchPopulation = Math.max(1, field.constraints.length - 1);
      const novelty = 1.0 - (matched.length / matchPopulation);
      const evalResult = { matched: matched, novelty: novelty };

      // Selection (set computation per Phase 5.5 kernel)
      const named = field.detectNames(token.text || ""); // K2/K3 surface
      if (named && named.length > 0) {
        field.namedCount++;
        for (const sc of named) {
          sc.namedCount = (sc.namedCount || 0) + 1;
          sc.lastNamed = field.step;
        }
      }
      const chosen = field.selectFromMatches(matched, named);

      // Mark used + advance weights
      field.markUsed(matched);

      // Record op for fast-delta window
      field.recordOp("input", chosen.map(function (c) { return c.idx; }));

      // Generate derived constraints from novelty (M2.1)
      if (novelty >= CFG.GEN_NOVELTY_THRESH) {
        let derived;
        try {
          derived = vocab.generateDerivedFromNovelty(input, field);
        } catch (e) {
          derived = [];
        }
        if (derived && derived.length > 0) {
          // Tag derived constraints with peer-canonical kind
          for (const d of derived) {
            if (!d.id) d.id = "c::" + (++field._idCtr);
            if (!d.kind) d.kind = "derived";
            if (d.birth === undefined) d.birth = field.step;
            if (d.lastUsed === undefined) d.lastUsed = field.step;
            if (d.uses === undefined) d.uses = 0;
            if (d.weight === undefined) d.weight = 1.0;
            if (d.permanent === undefined) d.permanent = false;
          }
          field.integrate(derived);
          stats.derivedGenerated += derived.length;
        }
      }

      // Refresh vector-delta after matches + generation, then modulate
      field.refreshVectorDelta();
      field.updateSlowDelta(field.scalarDelta);
      field.refreshVectorDelta();
      const vAfter = {
        scalar: field.scalarDelta,
        fast: field.fastDelta,
        slow: field.slowDelta,
        gap: field.gap
      };
      field.modulate();

      // Predictive reaching (M2.2 / SE-05)
      if (field.gap >= CFG.GAP_PREDICT_THRESH) {
        let predictions;
        try {
          predictions = vocab.generatePredictionsFromGap(field);
        } catch (e) {
          predictions = [];
        }
        if (predictions && predictions.length > 0) {
          for (const p of predictions) {
            if (!p.id) p.id = "p::" + (++field._idCtr);
            if (!p.kind) p.kind = "predictive";
            if (p.birth === undefined) p.birth = field.step;
            if (p.lastUsed === undefined) p.lastUsed = field.step;
            if (p.uses === undefined) p.uses = 0;
            if (p.weight === undefined) p.weight = 1.0;
            if (p.permanent === undefined) p.permanent = false;
          }
          field.integrate(predictions);
          stats.predictionsGenerated += predictions.length;
        }
      }

      // K1 family fidelity: record delta-drop per family that fired
      // Per the kernel's recordFidelity: groups matched by pattern.type,
      // pushes delta-drop observations to each family with >=2 fires.
      const deltaDrop = vBefore.scalar - vAfter.scalar;
      if (deltaDrop > 0) {
        field.recordFidelity(matched, deltaDrop);
      }

      // K1 promotion check
      const promotedThisStep = field.checkPromotions();
      if (promotedThisStep && promotedThisStep.length > 0) {
        stats.promotionsObserved += promotedThisStep.length;
      }

      // Flow discipline (SE-02)
      const evicted = field.evictStalePredictions();
      if (evicted && evicted.length > 0) {
        stats.evictionsObserved += evicted.length;
      }

      return {
        step: field.step,
        matched: matched.length,
        ratified: ratifiedThisStep.length,
        derived: stats.derivedGenerated,
        predictions: stats.predictionsGenerated,
        promoted: promotedThisStep.length,
        evicted: evicted.length,
        delta: vAfter
      };
    }

    // ----------------------------------------------------------
    // observe() — O1-compliant read-only snapshot
    // ----------------------------------------------------------
    function observe() {
      const constraintsByKind = { seed: 0, derived: 0, predictive: 0, ratified: 0, meta: 0, compound: 0, other: 0 };
      for (const c of field.constraints) {
        const k = c.kind || "other";
        if (constraintsByKind[k] !== undefined) constraintsByKind[k]++;
        else constraintsByKind.other++;
      }

      const fidelities = {};
      for (const fam in field.familyFidelity) {
        fidelities[fam] = {
          avg: field.fidelityOf(fam),
          totalFires: field.familyFidelity[fam].totalFires,
          observations: field.familyFidelity[fam].observations.length
        };
      }

      const subcascadeViews = field.subcascades.map(function (sc) {
        return {
          id: sc.id,
          name: sc.name,
          familyType: sc.familyType,
          memberCount: (sc.memberIds || []).length,
          fidAtBirth: sc.fidAtBirth,
          namedCount: sc.namedCount || 0
        };
      });

      return {
        id: opts.id,
        axis: opts.axis,
        step: field.step,
        constraintsByKind: constraintsByKind,
        constraintTotal: field.constraints.length,
        ratCount: field.ratCount,
        delta: {
          scalar: field.scalarDelta,
          fast: field.fastDelta,
          slow: field.slowDelta,
          gap: field.gap
        },
        mod: { fast: field.fastMod, slow: field.slowMod },
        fidelities: fidelities,
        subcascades: subcascadeViews,
        namingPref: field.namingPref,
        namedCount: field.namedCount,
        stats: Object.assign({}, stats)
      };
    }

    function teardown() {
      // Clear state slots (best-effort GC hint; not load-bearing)
      field.constraints = null;
      field.aged = null;
      field.correlations = null;
      field.familyFidelity = null;
      field.subcascades = null;
      field.recentOps = null;
    }

    return Object.freeze({
      id: opts.id,
      axis: opts.axis,
      field: field,
      primitiveVocab: vocab,
      ingest: ingest,
      observe: observe,
      teardown: teardown
    });
  }

  // ---------------------------------------------------------------------
  // Module exports
  // ---------------------------------------------------------------------
  const SubstrateFactory = Object.freeze({
    makePeer: makePeer,
    makePeerField: makePeerField
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = SubstrateFactory;
  } else {
    global.SubstrateFactory = SubstrateFactory;
  }

})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));
