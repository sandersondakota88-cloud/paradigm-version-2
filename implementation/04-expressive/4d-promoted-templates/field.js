// field.js - Shared field state (Phase 3)

(function (global) {
"use strict";

const Guards = {
  clampString: function (s, max) {
    if (typeof s !== "string") s = String(s == null ? "" : s);
    return s.length > max ? s.substring(0, max) : s;
  },
  clamp01: function (n) {
    n = +n;
    if (!isFinite(n)) return 0;
    return n < 0 ? 0 : (n > 1 ? 1 : n);
  }
};

const CFG = Object.freeze({
  INPUT_MAX: 512,
  FIELD_LIVE_CAP: 200,
  FIELD_AGED_CAP: 80,
  TRACE_CAP: 512,
  OUT_CAP: 28,
  FAST_WINDOW: 12,
  FAST_DECAY: 0.85,
  SLOW_STEP: 0.002,
  MOD_SIGMA: 0.15,
  GEN_NOVELTY_THRESH: 0.35,
  GAP_PREDICT_THRESH: 0.12,
  PRED_MAX_NEW_PER_STEP: 2,
  PRED_AGE_LIMIT: 40,
  PRED_WEIGHT_BOOST: 1.8,
  AGE_STEP_WINDOW: 24,
  CORR_CAP: 200,
  CORR_MIN_USES: 2,
  CORR_THRESH: 0.30,
  FAMILY_MIN_SIZE: 3,
  FIDELITY_WINDOW: 8,
  FIDELITY_PROMOTE: 0.03,
  FIDELITY_MIN_FIRES: 3,
  SUB_CASCADE_CAP: 24,
  NAMING_WEIGHT_BONUS: 1.5,
  NAMING_DELTA_DROP: 0.15,
  NAMING_PREF_RATE: 0.005,
  SELECT_RECENCY_EXP: 1.5,
  AUTO_TICK_COUNT: 20,
  OPS_LOG_CAP: 48,
  // Phase 3 additions
  CT_OP_QUEUE_CAP: 64,           // pending ops in execution scope
  CT_SNAPSHOT_INTERVAL: 30,      // snapshot every N steps
  CT_TRACE_FLUSH_INTERVAL: 16,   // flush trace to persistent every N entries
  EXEC_GAP_PREDICT_THRESH: 0.15, // execution-scope gap threshold for reaching
  // Phase 4b additions
  COMPOUND_GEN_HISTORY_CAP: 16,    // ring buffer of compound-generation snapshots
  COMPOUND_QUEUE_SATURATION_FRAC: 0.75,    // queue full fraction for trigger 2
  COMPOUND_PERSISTENT_GAP_STEPS: 3,        // consecutive steps for trigger 3
  COMPOUND_PERSISTENT_GAP_THRESH: 0.20,    // render-gap threshold for trigger 3
  COMPOUND_FIDELITY_WINDOW: 8,             // observations per compound
  COMPOUND_FIDELITY_PROMOTE: 0.04,         // avg drop to promote compound
  COMPOUND_FIDELITY_MIN_FIRES: 3,          // min observations before promotion
  COMPOUND_KIND_MULT: 1.25,                // selection bias for matched compounds
  // Phase 4c additions
  RECALL_WINDOW_SIZE: 50,                  // records pulled per recall event
  RECALL_EVENT_LOG_CAP: 32,                // bounded recall-event observation buffer
  RECALL_GAP_THRESH: 0.12,                 // render-gap threshold for recall trigger (matches GAP_PREDICT_THRESH)
  RECALL_SUCCESS_BOOST: 0.05               // weight bump on successful recall match
});

const SEED = Object.freeze({
  id: "seed::what-is-delta",
  kind: "seed",
  question: "what is delta?",
  when: "always",
  then: "assert(delta = compute(field.state))",
  birth: 0,
  uses: 0,
  permanent: true,
  weight: 1.0
});

// ---------------------------------------------------------------------------
// Field - shared state
// ---------------------------------------------------------------------------

const Field = {
  // Render-scope state (read by ER engine, written by CT engine through ops)
  constraints: [],
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
  recentOps: [],

  // Phase 1 state
  correlations: Object.create(null),
  familyFidelity: Object.create(null),
  subcascades: [],
  namingPref: 0.0,
  namedCount: 0,

  // ID counter (private to field; both engines respect it)
  _idCtr: 0,

  // ---------- Phase 3: execution-scope state ----------
  //
  // The CT engine reads/writes these. They represent the sequential,
  // operation-paced view of the field. Render-scope state above is the
  // parallel, frame-paced view.
  //
  // Execution scope tracks:
  //   - pending ops: queued operations not yet executed
  //   - in-flight ops: operations started but not yet committed
  //   - committed but not persisted: operations committed to in-memory
  //     state but not yet written to persistent storage
  //
  // Execution-scope delta = (pending + in-flight + uncommitted) / total

  ctPendingOps: [],          // queue of pending CT operations
  ctInFlightOp: null,         // currently-executing op (or null)
  ctCommittedQueue: [],       // committed but not persisted
  ctTotalOpsSeen: 0,          // running total (denominator for execution scope)
  ctOpsCompleted: 0,
  ctLastSnapshotStep: 0,

  // Vector-delta at execution scope
  execScalarDelta: 1.0,
  execFastDelta: 1.0,
  execSlowDelta: 1.0,
  execGap: 0.0,

  // ---------- Phase 4b: cross-substrate compound state ----------
  //
  // A compound constraint is a constraint kind whose pattern is a
  // tuple (renderPredicate, execPredicate). Both predicates must hold
  // for the compound to match. Compounds bridge render-scope and
  // execution-scope: they describe coincidences that span the
  // substrate split SE-06 introduced.
  //
  // Compound state tracks:
  //   - compoundFidelity: per-compound running observation of delta
  //     contribution when matched, parallel to familyFidelity
  //   - compoundGenerationHistory: per-step record of trigger-relevant
  //     state, used to detect persistence of conditions across steps
  //     (e.g. "high render-gap for several consecutive steps")

  compoundFidelity: Object.create(null),
  compoundGenerationHistory: [],

  // ---------- Phase 4c: recall state ----------
  //
  // Recall is gap-triggered (parallel to predictive reaching). When
  // render-scope gap is high, the field reaches in two directions:
  //   - forward: predictive constraints generated speculatively
  //   - backward: recall window read from persistent storage
  //
  // Recalled records merge into the live constraint set for evaluation
  // (per-frame, transient) without modifying Field.constraints. They
  // carry their weight history from when they were persisted.
  //
  // Per "let delta decide before imposing precedence" (IMPLEMENTATION_
  // PATH section 8): no kindMult is applied to recalled records. They
  // compete on their accumulated weight in selection.
  //
  // recallWindow holds the records read in the most recent recall
  // event. It is transient: cleared and rebuilt per recall trigger.
  //
  // recallEventLog tracks recall events for the reflexive surface to
  // observe. Bounded buffer.

  recallWindow: [],
  recallEventLog: [],

  // ---------- Phase 4d: surface Pass B observation state ----------
  //
  // The reflexive surface's Pass B detector emits "compound-active"
  // clauses when a promoted compound's predicates currently both hold.
  // To detect this, the surface needs to know which compounds matched
  // the most recent input. The CT engine records that here after
  // evaluating compounds in _opInput.
  //
  // lastMatchedCompoundIds: array of compound IDs that matched on the
  // most recent input. Transient: rewritten per input. Read by the
  // surface; not modified by the surface (per O1: observation is
  // read-only with respect to field state that engines write).

  lastMatchedCompoundIds: [],

  // ---------------------------------------------------------------
  reset: function () {
    this.constraints = [Object.assign({}, SEED)];
    this.aged = [];
    this.inputCount = 0;
    this.step = 0;
    this.ratCount = 0;
    this.scalarDelta = 1.0;
    this.fastDelta = 1.0;
    this.slowDelta = 1.0;
    this.gap = 0.0;
    this.fastMod = 0.0;
    this.slowMod = 0.5;
    this.recentOps = [];
    this.correlations = Object.create(null);
    this.familyFidelity = Object.create(null);
    this.subcascades = [];
    this.namingPref = 0.0;
    this.namedCount = 0;
    // Phase 3
    this.ctPendingOps = [];
    this.ctInFlightOp = null;
    this.ctCommittedQueue = [];
    this.ctTotalOpsSeen = 0;
    this.ctOpsCompleted = 0;
    this.ctLastSnapshotStep = 0;
    this.execScalarDelta = 1.0;
    this.execFastDelta = 1.0;
    this.execSlowDelta = 1.0;
    this.execGap = 0.0;
    // Phase 4b
    this.compoundFidelity = Object.create(null);
    this.compoundGenerationHistory = [];
    // Phase 4c
    this.recallWindow = [];
    this.recallEventLog = [];
    // Phase 4d
    this.lastMatchedCompoundIds = [];
  },

  // ============================================================
  // RENDER-SCOPE delta (existing from Phase 1/2)
  // ============================================================
  _deltaOver: function (cs) {
    if (!cs || cs.length === 0) return 1.0;
    let unresolved = 0, stale = 0;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (c.kind === "seed" || c.kind === "predictive") { unresolved++; continue; }
      if ((c.uses || 0) === 0) { unresolved++; continue; }
      const age = this.step - (c.lastUsed || 0);
      stale += Math.min(1, age / CFG.AGE_STEP_WINDOW);
    }
    return Guards.clamp01((unresolved + stale * 0.5) / cs.length);
  },
  computeScalarDelta: function () { return this._deltaOver(this.constraints); },
  computeFastDelta: function () {
    const recent = Object.create(null);
    for (let i = 0; i < this.recentOps.length; i++) {
      const op = this.recentOps[i];
      if (op.touched) for (let j = 0; j < op.touched.length; j++) recent[op.touched[j]] = true;
    }
    recent[SEED.id] = true;
    const fc = this.constraints.filter(c => recent[c.id]);
    return fc.length === 0 ? 1.0 : this._deltaOver(fc);
  },
  updateSlowDelta: function (cs) {
    this.slowDelta = this.slowDelta * (1 - CFG.SLOW_STEP) + cs * CFG.SLOW_STEP;
  },
  refreshVectorDelta: function () {
    this.scalarDelta = this.computeScalarDelta();
    this.fastDelta = this.computeFastDelta();
    this.gap = Math.abs(this.fastDelta - this.slowDelta);
  },

  // ============================================================
  // EXECUTION-SCOPE delta (Phase 3)
  //
  // Computed from the CT engine's operation queue state. Same
  // formula structure as render-scope, applied to a different
  // population (pending/in-flight/uncommitted ops vs total ops
  // seen in this run).
  // ============================================================
  computeExecScalarDelta: function () {
    // Execution-scope delta: fraction of ops still unresolved over total
    // ops seen this run. Unresolved = pending + in-flight. Committed-but-
    // not-persisted is tracked separately (ctCommittedQueue) because
    // persistence latency is a different aspect of execution scope and
    // mixing it into delta would conflate "work pending" with "trace
    // backlog".
    if (this.ctTotalOpsSeen === 0) return 1.0;
    const unresolved = this.ctPendingOps.length + (this.ctInFlightOp ? 1 : 0);
    return Guards.clamp01(unresolved / Math.max(1, this.ctTotalOpsSeen));
  },
  computeExecFastDelta: function () {
    // Fast: of recent operational pressure, how much remains unresolved?
    // Approximated by: pending + in-flight, scaled against a recent-window
    // baseline. When queue is drained, fast-delta drops; when queue
    // saturates, fast-delta rises.
    const windowSize = CFG.FAST_WINDOW;
    const unresolved = this.ctPendingOps.length + (this.ctInFlightOp ? 1 : 0);
    const denom = Math.max(windowSize, unresolved);
    return Guards.clamp01(unresolved / denom);
  },
  updateExecSlowDelta: function (cs) {
    this.execSlowDelta = this.execSlowDelta * (1 - CFG.SLOW_STEP) + cs * CFG.SLOW_STEP;
  },
  refreshExecVectorDelta: function () {
    this.execScalarDelta = this.computeExecScalarDelta();
    this.execFastDelta = this.computeExecFastDelta();
    this.execGap = Math.abs(this.execFastDelta - this.execSlowDelta);
  },

  // ============================================================
  // CONSTRAINT GENERATION (called by CT engine in process op)
  // ============================================================
  generate: function (input, evalResult) {
    if (!input) return [];
    const lower = input.toLowerCase();
    const tokens = lower.split(/\s+/).filter(t => t.length > 0);
    const gen = [];
    if (evalResult.novelty < CFG.GEN_NOVELTY_THRESH) return gen;
    for (const t of tokens) {
      if (gen.length >= 3) break;
      if (t.length < 2 || t.length > 32) continue;
      if (this._hasLike("has-token", t)) continue;
      gen.push(this._mkDerived("has-token", { token: t },
        "input contains '" + Guards.clampString(t, 24) + "'"));
    }
    const L = input.length;
    if (!this._hasLengthCovering(L)) {
      const lo = Math.max(1, L - 8), hi = L + 8;
      gen.push(this._mkDerived("length-range", { min: lo, max: hi },
        "length in [" + lo + "," + hi + "]"));
    }
    if (/\d/.test(input) && !this._hasLike("char-class", "digits"))
      gen.push(this._mkDerived("char-class", { cls: "digits" }, "contains digits"));
    if (/[a-zA-Z]/.test(input) && !this._hasLike("char-class", "alpha"))
      gen.push(this._mkDerived("char-class", { cls: "alpha" }, "contains letters"));
    if (/[^\w\s]/.test(input) && !this._hasLike("char-class", "symbol"))
      gen.push(this._mkDerived("char-class", { cls: "symbol" }, "contains symbol"));
    if (tokens.length >= 2 && gen.length < 5) {
      const a = tokens[0], b = tokens[tokens.length - 1];
      if (a !== b && a.length >= 3 && b.length >= 3 && !this._hasCoOccurs(a, b)) {
        gen.push(this._mkDerived("co-occurs", { a: a, b: b },
          "'" + Guards.clampString(a, 16) + "' with '" + Guards.clampString(b, 16) + "'"));
      }
    }
    return gen;
  },

  _hasLike: function (type, arg) {
    return this.constraints.some(c => c.pattern && c.pattern.type === type
      && (type === "has-token" ? c.pattern.token === arg : c.pattern.cls === arg));
  },
  _hasLengthCovering: function (L) {
    return this.constraints.some(c => c.pattern && c.pattern.type === "length-range"
      && L >= c.pattern.min && L <= c.pattern.max);
  },
  _hasCoOccurs: function (a, b) {
    return this.constraints.some(c => c.pattern && c.pattern.type === "co-occurs"
      && ((c.pattern.a === a && c.pattern.b === b) || (c.pattern.a === b && c.pattern.b === a)));
  },
  _mkDerived: function (type, pattern, desc) {
    return {
      id: "c::" + (++this._idCtr),
      kind: "derived",
      pattern: Object.assign({ type: type }, pattern),
      desc: Guards.clampString(desc, 120),
      birth: this.step,
      lastUsed: this.step,
      uses: 0,
      weight: 1.0,
      permanent: false
    };
  },

  // ============================================================
  // PREDICTIVE GENERATION at RENDER scope
  // (Phase 3 introduces execution-scope predictions in ct-engine.js)
  // ============================================================
  generatePredictions: function () {
    if (this.gap < CFG.GAP_PREDICT_THRESH) return [];
    const gen = [];
    const hasD = this._hasLike("char-class", "digits");
    const hasA = this._hasLike("char-class", "alpha");
    const hasS = this._hasLike("char-class", "symbol");
    if (hasA && !hasD && gen.length < CFG.PRED_MAX_NEW_PER_STEP)
      gen.push(this._mkPredictive("char-class", { cls: "digits" },
        "prediction: input containing digits would close the gap"));
    if (hasD && !hasA && gen.length < CFG.PRED_MAX_NEW_PER_STEP)
      gen.push(this._mkPredictive("char-class", { cls: "alpha" },
        "prediction: input containing letters would close the gap"));
    if ((hasA || hasD) && !hasS && gen.length < CFG.PRED_MAX_NEW_PER_STEP)
      gen.push(this._mkPredictive("char-class", { cls: "symbol" },
        "prediction: input containing symbols would close the gap"));
    return gen;
  },
  _mkPredictive: function (type, pattern, desc) {
    return {
      id: "p::" + (++this._idCtr),
      kind: "predictive",
      pattern: Object.assign({ type: type }, pattern),
      desc: Guards.clampString(desc, 160),
      birth: this.step,
      lastUsed: this.step,
      uses: 0,
      weight: 1.0,
      permanent: false
    };
  },

  ratify: function (idx) {
    const c = this.constraints[idx];
    if (!c || c.kind !== "predictive") return false;
    c.kind = "ratified";
    c.weight = Math.min(3.0, c.weight * CFG.PRED_WEIGHT_BOOST);
    c.lastUsed = this.step;
    this.ratCount++;
    return true;
  },

  evictStalePredictions: function () {
    const evicted = [], kept = [];
    for (let i = 0; i < this.constraints.length; i++) {
      const c = this.constraints[i];
      if (c.kind === "predictive" && (this.step - c.birth) > CFG.PRED_AGE_LIMIT) {
        evicted.push(c);
        this.aged.push(c);
      } else {
        kept.push(c);
      }
    }
    this.constraints = kept;
    while (this.aged.length > CFG.FIELD_AGED_CAP) this.aged.shift();
    return evicted;
  },

  integrate: function (newCs) {
    for (let i = 0; i < newCs.length; i++) this.constraints.push(newCs[i]);
    this._enforceCaps();
  },

  _enforceCaps: function () {
    if (this.constraints.length <= CFG.FIELD_LIVE_CAP) return;
    const scored = [];
    for (let i = 0; i < this.constraints.length; i++) {
      const c = this.constraints[i];
      if (c.kind === "seed") continue;
      const recency = this.step - (c.lastUsed || 0);
      const kindBonus = (c.kind === "ratified") ? 15 : 0;
      scored.push({ idx: i, score: (c.uses||0)*10 + (c.weight||1)*5 + kindBonus - recency });
    }
    scored.sort((a, b) => a.score - b.score);
    const toEvict = this.constraints.length - CFG.FIELD_LIVE_CAP;
    const evictIdx = Object.create(null);
    for (let j = 0; j < toEvict; j++) evictIdx[scored[j].idx] = true;
    const kept = [];
    for (let k = 0; k < this.constraints.length; k++) {
      if (evictIdx[k]) this.aged.push(this.constraints[k]);
      else kept.push(this.constraints[k]);
    }
    this.constraints = kept;
    while (this.aged.length > CFG.FIELD_AGED_CAP) this.aged.shift();
  },

  selectFromMatches: function (matched, named) {
    if (matched.length === 0) return [];
    const namedIds = Object.create(null);
    if (named) for (const sc of named) for (const id of sc.memberIds) namedIds[id] = true;
    const chosen = [];
    for (let i = 0; i < matched.length; i++) {
      const idx = matched[i];
      const c = this.constraints[idx];
      if (!c) continue;
      const recency = this.step - (c.lastUsed || 0);
      const recencyFactor = 1.0 / (1.0 + recency * 0.05);
      const fastBias = 1.0 + this.fastMod * 0.5;
      let kindMult = 1.0;
      if (c.kind === "ratified") kindMult = 1.3;
      else if (c.kind === "meta") kindMult = 1.15;
      else if (c.kind === "compound") kindMult = 1.25;
      const namedBias = namedIds[c.id] ? CFG.NAMING_WEIGHT_BONUS : 1.0;
      const eff = (c.weight || 1.0)
                * Math.pow(recencyFactor, CFG.SELECT_RECENCY_EXP)
                * fastBias * kindMult * namedBias;
      chosen.push({ idx: idx, effectiveWeight: eff, kind: c.kind, named: !!namedIds[c.id] });
    }
    chosen.sort((a, b) => b.effectiveWeight - a.effectiveWeight);
    return chosen;
  },

  markUsed: function (matched) {
    for (let i = 0; i < matched.length; i++) {
      const c = this.constraints[matched[i]];
      if (!c || c.kind === "seed") continue;
      c.uses = (c.uses || 0) + 1;
      c.lastUsed = this.step;
      c.weight = Math.min(3.0, (c.weight || 1.0) + 0.02);
    }
    if (this.constraints[0] && this.constraints[0].kind === "seed") {
      this.constraints[0].uses = (this.constraints[0].uses || 0) + 1;
    }
  },

  modulate: function () {
    const dev = this.fastDelta - this.slowDelta;
    this.fastMod = this.fastMod * CFG.FAST_DECAY + dev * CFG.MOD_SIGMA;
    this.slowMod = this.slowMod * (1 - CFG.SLOW_STEP) + this.slowDelta * CFG.SLOW_STEP;
  },

  recordOp: function (kind, touched) {
    this.recentOps.push({ step: this.step, kind: kind, touched: touched || [] });
    while (this.recentOps.length > CFG.FAST_WINDOW) this.recentOps.shift();
  },
  _findById: function (id) {
    for (let i = 0; i < this.constraints.length; i++) {
      if (this.constraints[i].id === id) return this.constraints[i];
    }
    return null;
  },

  // Phase 1: correlations, develop patterns, reason, fidelity, sub-cascades
  updateCorrelations: function (matched) {
    for (let i = 0; i < matched.length; i++) {
      for (let j = i + 1; j < matched.length; j++) {
        const ca = this.constraints[matched[i]];
        const cb = this.constraints[matched[j]];
        if (!ca || !cb || ca.kind === "seed" || cb.kind === "seed") continue;
        const key = (ca.id < cb.id) ? (ca.id + "::" + cb.id) : (cb.id + "::" + ca.id);
        if (!this.correlations[key]) {
          this.correlations[key] = { a: ca.id, b: cb.id, coFire: 0, lastSeen: 0 };
        }
        this.correlations[key].coFire++;
        this.correlations[key].lastSeen = this.step;
      }
    }
    const keys = Object.keys(this.correlations);
    if (keys.length > CFG.CORR_CAP) {
      const entries = keys.map(k => ({
        key: k,
        score: this.correlations[k].coFire + this.correlations[k].lastSeen / 100
      }));
      entries.sort((a, b) => a.score - b.score);
      const toEvict = keys.length - CFG.CORR_CAP;
      for (let i = 0; i < toEvict; i++) delete this.correlations[entries[i].key];
    }
  },
  topCorrelations: function (limit) {
    limit = limit || 20;
    const out = [];
    for (const k in this.correlations) {
      if (Object.prototype.hasOwnProperty.call(this.correlations, k)) out.push(this.correlations[k]);
    }
    out.sort((a, b) => b.coFire - a.coFire);
    return out.slice(0, limit);
  },

  developPatterns: function () {
    const produced = [];
    const corrs = this.topCorrelations(30);
    for (const corr of corrs) {
      const ca = this._findById(corr.a), cb = this._findById(corr.b);
      if (!ca || !cb || (ca.uses||0) < CFG.CORR_MIN_USES || (cb.uses||0) < CFG.CORR_MIN_USES) continue;
      if (this._hasMetaWithRefs([corr.a, corr.b])) continue;
      const ratio = corr.coFire / Math.max(ca.uses, cb.uses);
      if (ratio < CFG.CORR_THRESH) continue;
      produced.push(this._mkMeta([corr.a, corr.b],
        "pair: " + (ca.desc||ca.id) + " + " + (cb.desc||cb.id) + " (coFire=" + corr.coFire + ")",
        "pair"));
    }
    const families = Object.create(null);
    for (const c of this.constraints) {
      if ((c.kind !== "derived" && c.kind !== "ratified") || !c.pattern) continue;
      if (!families[c.pattern.type]) families[c.pattern.type] = [];
      families[c.pattern.type].push(c.id);
    }
    for (const famName in families) {
      if (families[famName].length < CFG.FAMILY_MIN_SIZE) continue;
      if (this._hasFamilyMetaFor(famName)) continue;
      const fm = this._mkMeta(families[famName],
        "family: " + families[famName].length + " of type '" + famName + "'", "family");
      fm.familyType = famName;
      produced.push(fm);
    }
    if (produced.length > 0) this.integrate(produced);
    return produced;
  },
  _mkMeta: function (refs, desc, metaKind) {
    return {
      id: "m::" + (++this._idCtr),
      kind: "meta",
      metaKind: metaKind || "pair",
      refs: refs.slice(),
      desc: Guards.clampString(desc, 160),
      birth: this.step,
      lastUsed: this.step,
      uses: 0,
      weight: 1.0,
      permanent: false
    };
  },
  _hasMetaWithRefs: function (refs) {
    const sorted = refs.slice().sort().join("|");
    return this.constraints.some(c => c.kind === "meta" && c.refs
      && c.refs.slice().sort().join("|") === sorted);
  },
  _hasFamilyMetaFor: function (famType) {
    return this.constraints.some(c => c.kind === "meta" && c.metaKind === "family"
      && c.familyType === famType);
  },

  reason: function () {
    const findings = [];
    const derived = this.constraints.filter(c =>
      (c.kind === "derived" || c.kind === "ratified") && (c.uses || 0) >= 1);
    const byType = Object.create(null);
    for (const c of derived) {
      if (!c.pattern) continue;
      if (!byType[c.pattern.type]) byType[c.pattern.type] = [];
      byType[c.pattern.type].push(c);
    }
    for (const t in byType) {
      const arr = byType[t];
      if (arr.length === 1) findings.push({
        kind: "isolated", text: "'" + arr[0].desc + "' is the only '" + t + "' constraint"
      });
      else findings.push({
        kind: "differentiation",
        text: "'" + arr[0].desc + "' vs '" + arr[1].desc + "': " + this._diffPair(arr[0], arr[1])
      });
    }
    const unused = this.constraints.filter(c =>
      (c.kind === "derived" || c.kind === "predictive") && (c.uses || 0) === 0);
    if (unused.length > 0) findings.push({
      kind: "observation", text: unused.length + " constraint(s) never matched input since creation"
    });
    const pred = this.constraints.filter(c => c.kind === "predictive").length;
    const rat = this.constraints.filter(c => c.kind === "ratified").length;
    if (pred + rat > 0) findings.push({
      kind: "reaching",
      text: "field has " + pred + " active prediction(s), " + rat + " ratified; ratification rate = "
            + (this.ratCount / Math.max(1, this.inputCount)).toFixed(2)
    });
    if (this.subcascades.length > 0) findings.push({
      kind: "observation",
      text: this.subcascades.length + " sub-cascade(s); naming preference = "
            + this.namingPref.toFixed(3)
    });
    if (this.gap > CFG.GAP_PREDICT_THRESH) findings.push({
      kind: "vector-delta",
      text: "render-scope gap " + this.gap.toFixed(3) + " above threshold; field is reaching"
    });
    else findings.push({
      kind: "vector-delta",
      text: "render-scope gap " + this.gap.toFixed(3) + " within threshold; field is settled"
    });
    if (this.execGap > CFG.EXEC_GAP_PREDICT_THRESH) findings.push({
      kind: "vector-delta",
      text: "execution-scope gap " + this.execGap.toFixed(3) + " above threshold; CT engine is reaching"
    });
    return findings;
  },
  _diffPair: function (a, b) {
    if (!a.pattern || !b.pattern) return "patterns missing";
    const t = a.pattern.type;
    if (t === "has-token") return "tokens '" + a.pattern.token + "' vs '" + b.pattern.token + "'";
    if (t === "length-range") return "ranges [" + a.pattern.min + "," + a.pattern.max + "] vs ["
                                    + b.pattern.min + "," + b.pattern.max + "]";
    if (t === "char-class") return "classes " + a.pattern.cls + " vs " + b.pattern.cls;
    if (t === "co-occurs") return "pairs '" + a.pattern.a + "+" + a.pattern.b + "' vs '"
                                  + b.pattern.a + "+" + b.pattern.b + "'";
    return "same type";
  },

  recordFidelity: function (matched, deltaDrop) {
    const byFam = Object.create(null);
    for (const idx of matched) {
      const c = this.constraints[idx];
      if (!c || !c.pattern || (c.kind !== "derived" && c.kind !== "ratified")) continue;
      byFam[c.pattern.type] = (byFam[c.pattern.type] || 0) + 1;
    }
    for (const fam in byFam) {
      if (byFam[fam] < 2) continue;
      if (!this.familyFidelity[fam]) this.familyFidelity[fam] = { observations: [], totalFires: 0 };
      const fid = this.familyFidelity[fam];
      fid.observations.push(deltaDrop);
      fid.totalFires++;
      while (fid.observations.length > CFG.FIDELITY_WINDOW) fid.observations.shift();
    }
  },
  fidelityOf: function (famType) {
    const fid = this.familyFidelity[famType];
    if (!fid || fid.observations.length === 0) return 0;
    return fid.observations.reduce((s, x) => s + x, 0) / fid.observations.length;
  },
  checkPromotions: function () {
    const promoted = [];
    if (this.subcascades.length >= CFG.SUB_CASCADE_CAP) return promoted;
    for (const fam in this.familyFidelity) {
      const fid = this.familyFidelity[fam];
      if (fid.totalFires < CFG.FIDELITY_MIN_FIRES) continue;
      const avg = this.fidelityOf(fam);
      if (avg < CFG.FIDELITY_PROMOTE) continue;
      if (this._subForFamily(fam)) continue;
      const members = this.constraints
        .filter(c => (c.kind === "derived" || c.kind === "ratified")
                 && c.pattern && c.pattern.type === fam)
        .map(c => c.id);
      if (members.length < 2) continue;
      const sc = this._mkSubcascade(fam, members, avg);
      this.subcascades.push(sc);
      promoted.push(sc);
      if (this.subcascades.length >= CFG.SUB_CASCADE_CAP) break;
    }
    return promoted;
  },
  _subForFamily: function (famType) {
    return this.subcascades.find(sc => sc.familyType === famType) || null;
  },
  _mkSubcascade: function (famType, memberIds, fidAtBirth) {
    let dom = null, maxU = -1;
    for (const id of memberIds) {
      const c = this._findById(id);
      if (c && (c.uses || 0) > maxU) { maxU = c.uses || 0; dom = c; }
    }
    let raw = famType;
    if (dom && dom.pattern) {
      const p = dom.pattern;
      if (p.type === "has-token") raw = p.token;
      else if (p.type === "char-class") raw = p.cls;
      else if (p.type === "length-range") raw = "len-" + p.min + "-" + p.max;
      else if (p.type === "co-occurs") raw = p.a + "-" + p.b;
    }
    let name = String(raw).toLowerCase().replace(/[^a-z0-9-]/g, "").substring(0, 20);
    if (!name) name = "sc";
    let fin = name, suffix = 2;
    while (this._nameInUse(fin)) {
      fin = name + "-" + suffix;
      suffix++;
      if (suffix > 99) { fin = name + "-x"; break; }
    }
    return {
      id: "sc::" + (++this._idCtr),
      name: fin,
      familyType: famType,
      memberIds: memberIds.slice(),
      birth: this.step,
      lastNamed: -1,
      namedCount: 0,
      fidAtBirth: fidAtBirth
    };
  },
  _nameInUse: function (name) {
    return this.subcascades.some(sc => sc.name === name);
  },
  detectNames: function (input) {
    if (!input || this.subcascades.length === 0) return [];
    const tokens = input.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    return this.subcascades.filter(sc => sc.name && tokens.indexOf(sc.name) >= 0);
  },
  computeSubcascadeDelta: function (sc) {
    if (!sc || !sc.memberIds.length) return 1.0;
    const members = sc.memberIds.map(id => this._findById(id)).filter(c => c);
    return this._deltaOver(members);
  },
  reinforceNaming: function (wasNamed) {
    if (wasNamed) this.namingPref = Math.min(1.0, this.namingPref + CFG.NAMING_PREF_RATE * 2);
    else this.namingPref = Math.max(0.0, this.namingPref - CFG.NAMING_PREF_RATE * 0.5);
  },

  // ============================================================
  // PHASE 4b: CROSS-SUBSTRATE COMPOUND CONSTRAINTS
  //
  // Compound constraints have a tuple pattern: (renderPredicate,
  // execPredicate). Both must hold for the compound to match.
  // Render predicate is one of the existing pattern types
  // (has-token, length-range, char-class, co-occurs). Exec predicate
  // is one of: queue-depth, recent-op, exec-gap-state.
  //
  // Compounds are matched CPU-side, by the CT engine after the ER
  // engine returns its render-side match results. The exec-side
  // predicate reads current Field state directly.
  // ============================================================

  // Construct a compound constraint
  _mkCompound: function (renderPred, execPred, desc, refs) {
    return {
      id: "x::" + (++this._idCtr),
      kind: "compound",
      pattern: {
        type: "compound",
        render: renderPred,    // one of: has-token, length-range, char-class, co-occurs
        exec: execPred         // one of: queue-depth, recent-op, exec-gap-state
      },
      refs: refs ? refs.slice() : [],
      desc: Guards.clampString(desc, 160),
      birth: this.step,
      lastUsed: this.step,
      uses: 0,
      weight: 1.0,
      permanent: false
    };
  },

  // Test a render-scope predicate against an input record. Mirrors
  // the matching logic in cpu-oracle.js but applied to a single
  // predicate, not a full constraint instruction stream.
  _evalRenderPredicate: function (pred, inputRec) {
    if (!pred || !inputRec) return false;
    if (pred.type === "has-token") {
      // inputRec.tokenPresence is a bitfield indexed by tokenTable
      // For host-side eval we need a different access pattern. We
      // store inputRec.tokens as a set when computed for compound use.
      if (inputRec.tokenSet) return !!inputRec.tokenSet[pred.token];
      return false;
    }
    if (pred.type === "length-range") {
      return inputRec.length >= pred.min && inputRec.length <= pred.max;
    }
    if (pred.type === "char-class") {
      if (pred.cls === "digits") return !!inputRec.hasDigits;
      if (pred.cls === "alpha") return !!inputRec.hasAlpha;
      if (pred.cls === "symbol") return !!inputRec.hasSymbol;
      return false;
    }
    if (pred.type === "co-occurs") {
      if (!inputRec.tokenSet) return false;
      return !!(inputRec.tokenSet[pred.a] && inputRec.tokenSet[pred.b]);
    }
    return false;
  },

  // Test an execution-scope predicate against current Field state.
  // Pure read of Field; no writes.
  _evalExecPredicate: function (pred) {
    if (!pred) return false;
    if (pred.type === "queue-depth") {
      const d = this.ctPendingOps.length;
      const min = pred.min == null ? 0 : pred.min;
      const max = pred.max == null ? Infinity : pred.max;
      return d >= min && d <= max;
    }
    if (pred.type === "recent-op") {
      // Last completed op kind matches
      if (this.ctCommittedQueue.length === 0) return false;
      const last = this.ctCommittedQueue[this.ctCommittedQueue.length - 1];
      return last.kind === pred.kind;
    }
    if (pred.type === "exec-gap-state") {
      const eg = this.execGap;
      if (pred.state === "high") return eg > CFG.EXEC_GAP_PREDICT_THRESH;
      if (pred.state === "low") return eg <= CFG.EXEC_GAP_PREDICT_THRESH * 0.5;
      if (pred.state === "reaching") return eg > CFG.EXEC_GAP_PREDICT_THRESH * 1.5;
      return false;
    }
    return false;
  },

  // Build a tokenSet from input string (used for compound render
  // predicate evaluation; mirrors what the compiler builds for the
  // ER engine but as a simple object lookup)
  _buildInputRec: function (input) {
    const lower = (input || "").toLowerCase();
    const tokens = lower.split(/\s+/).filter(t => t.length > 0);
    const tokenSet = Object.create(null);
    for (const t of tokens) tokenSet[t] = true;
    return {
      length: input ? input.length : 0,
      hasDigits: /\d/.test(input || ""),
      hasAlpha: /[a-zA-Z]/.test(input || ""),
      hasSymbol: /[^\w\s]/.test(input || ""),
      tokenSet: tokenSet
    };
  },

  // Evaluate all compound constraints against current input + state.
  // Returns array of matched constraint indices (in this.constraints).
  evaluateCompounds: function (input) {
    if (!this.constraints || !this.constraints.length) return [];
    const matched = [];
    const inputRec = this._buildInputRec(input);
    for (let i = 0; i < this.constraints.length; i++) {
      const c = this.constraints[i];
      if (c.kind !== "compound") continue;
      if (!c.pattern || !c.pattern.render || !c.pattern.exec) continue;
      const renderHits = this._evalRenderPredicate(c.pattern.render, inputRec);
      if (!renderHits) continue;
      const execHits = this._evalExecPredicate(c.pattern.exec);
      if (!execHits) continue;
      matched.push(i);
    }
    return matched;
  },

  // Record a snapshot of trigger-relevant state. Called per step by
  // the CT engine. The compound generator uses this history to detect
  // multi-step persistence triggers.
  recordCompoundGenerationSnapshot: function () {
    this.compoundGenerationHistory.push({
      step: this.step,
      gap: this.gap,
      execGap: this.execGap,
      pendingOps: this.ctPendingOps.length,
      ratCount: this.ratCount,
      namedCount: this.namedCount,
      lastInputCount: this.inputCount
    });
    while (this.compoundGenerationHistory.length > CFG.COMPOUND_GEN_HISTORY_CAP) {
      this.compoundGenerationHistory.shift();
    }
  },

  // Generate compound constraints from coincidence triggers.
  // Returns array of newly-created compounds (not yet integrated;
  // caller should call integrate()).
  //
  // Three triggers:
  //   T1: ratification co-occurs with non-input op pending
  //       => "render-side ratification while exec-side reaching"
  //   T2: naming event co-occurs with queue saturation
  //       => "naming under load"
  //   T3: persistent high render-gap across consecutive steps
  //       => "render reaching while exec also unresolved"
  generateCompounds: function (input) {
    const produced = [];
    const hist = this.compoundGenerationHistory;
    if (hist.length < 2) return produced;
    const prev = hist[hist.length - 2];
    const cur = hist[hist.length - 1];

    // T1: ratification just incremented and there's a non-input op queued
    const ratIncrement = cur.ratCount - prev.ratCount;
    if (ratIncrement > 0) {
      const hasNonInputPending = this.ctPendingOps.some(op => op.kind !== "input");
      if (hasNonInputPending) {
        // Find the most-recently-ratified constraint as the render anchor
        const recentRatified = this.constraints
          .filter(c => c.kind === "ratified" && c.lastUsed === this.step);
        if (recentRatified.length > 0) {
          const rc = recentRatified[0];
          if (rc.pattern && !this._hasCompoundWithRefs([rc.id])) {
            const compound = this._mkCompound(
              rc.pattern,
              { type: "queue-depth", min: 1, max: CFG.CT_OP_QUEUE_CAP },
              "render ratified (" + this._predDesc(rc.pattern) +
              ") while exec queue had non-input pending",
              [rc.id]
            );
            produced.push(compound);
          }
        }
      }
    }

    // T2: naming just incremented and queue is saturated
    const namedIncrement = cur.namedCount - prev.namedCount;
    if (namedIncrement > 0) {
      const saturationFloor = Math.floor(
        CFG.CT_OP_QUEUE_CAP * CFG.COMPOUND_QUEUE_SATURATION_FRAC
      );
      if (cur.pendingOps >= saturationFloor) {
        // Find the named sub-cascade
        const recentlyNamed = this.subcascades
          .filter(sc => sc.lastNamed === this.step);
        if (recentlyNamed.length > 0) {
          const sc = recentlyNamed[0];
          // Render predicate: a has-token for the sub-cascade's name
          if (!this._hasCompoundForSubcascade(sc.id)) {
            const compound = this._mkCompound(
              { type: "has-token", token: sc.name },
              { type: "queue-depth", min: saturationFloor,
                max: CFG.CT_OP_QUEUE_CAP },
              "naming '" + Guards.clampString(sc.name, 24) +
              "' under exec load (queue >= " + saturationFloor + ")",
              [sc.id]
            );
            produced.push(compound);
          }
        }
      }
    }

    // T3: persistent high render-gap across COMPOUND_PERSISTENT_GAP_STEPS
    if (hist.length >= CFG.COMPOUND_PERSISTENT_GAP_STEPS) {
      const window = hist.slice(-CFG.COMPOUND_PERSISTENT_GAP_STEPS);
      const allHighGap = window.every(s =>
        s.gap > CFG.COMPOUND_PERSISTENT_GAP_THRESH &&
        s.execGap > CFG.EXEC_GAP_PREDICT_THRESH
      );
      if (allHighGap && !this._hasCompoundOfKind("persistent-dual-gap")) {
        // Render predicate: a char-class predicate that doesn't yet
        // exist (so render-side reaching has something to land on)
        const hasD = this._hasLike("char-class", "digits");
        const hasA = this._hasLike("char-class", "alpha");
        const hasS = this._hasLike("char-class", "symbol");
        let target = null;
        if (!hasD) target = "digits";
        else if (!hasS) target = "symbol";
        else if (!hasA) target = "alpha";
        if (target) {
          const compound = this._mkCompound(
            { type: "char-class", cls: target },
            { type: "exec-gap-state", state: "high" },
            "persistent dual-gap: render reaching for " + target +
            " while exec-gap remains high",
            []
          );
          compound.compoundKind = "persistent-dual-gap";
          produced.push(compound);
        }
      }
    }

    return produced;
  },

  // Helper to describe a render predicate compactly
  _predDesc: function (pred) {
    if (!pred) return "?";
    if (pred.type === "has-token") return "'" + pred.token + "'";
    if (pred.type === "char-class") return pred.cls;
    if (pred.type === "length-range") return "[" + pred.min + "," + pred.max + "]";
    if (pred.type === "co-occurs") return "'" + pred.a + "+" + pred.b + "'";
    return pred.type;
  },

  // Compound deduplication helpers
  _hasCompoundWithRefs: function (refs) {
    const sorted = refs.slice().sort().join("|");
    return this.constraints.some(c =>
      c.kind === "compound" && c.refs &&
      c.refs.slice().sort().join("|") === sorted
    );
  },
  _hasCompoundForSubcascade: function (scId) {
    return this.constraints.some(c =>
      c.kind === "compound" && c.refs && c.refs.indexOf(scId) >= 0
    );
  },
  _hasCompoundOfKind: function (compoundKind) {
    return this.constraints.some(c =>
      c.kind === "compound" && c.compoundKind === compoundKind
    );
  },

  // Compound fidelity: parallel to family fidelity. Track delta drop
  // observations per compound; promote (mark with weight bonus) when
  // sustained drops accumulate.
  recordCompoundFidelity: function (matchedCompoundIndices, deltaDrop) {
    for (const idx of matchedCompoundIndices) {
      const c = this.constraints[idx];
      if (!c || c.kind !== "compound") continue;
      if (!this.compoundFidelity[c.id]) {
        this.compoundFidelity[c.id] = { observations: [], totalFires: 0 };
      }
      const fid = this.compoundFidelity[c.id];
      fid.observations.push(deltaDrop);
      fid.totalFires++;
      while (fid.observations.length > CFG.COMPOUND_FIDELITY_WINDOW) {
        fid.observations.shift();
      }
    }
  },

  compoundFidelityOf: function (compoundId) {
    const fid = this.compoundFidelity[compoundId];
    if (!fid || fid.observations.length === 0) return 0;
    return fid.observations.reduce((s, x) => s + x, 0) / fid.observations.length;
  },

  // Check compound fidelity and promote eligible compounds. Promotion
  // here means: weight bonus + mark as promoted. (Sub-cascade-style
  // promotion to a named structure may follow in a later phase, but
  // weight-bonus promotion is sufficient for compounds to be
  // selectively biased the way ratified constraints are.)
  checkCompoundPromotions: function () {
    const promoted = [];
    for (const c of this.constraints) {
      if (c.kind !== "compound" || c.promoted) continue;
      const fid = this.compoundFidelity[c.id];
      if (!fid || fid.totalFires < CFG.COMPOUND_FIDELITY_MIN_FIRES) continue;
      const avg = this.compoundFidelityOf(c.id);
      if (avg < CFG.COMPOUND_FIDELITY_PROMOTE) continue;
      c.promoted = true;
      c.weight = Math.min(3.0, c.weight * 1.5);
      c.fidAtPromotion = avg;
      promoted.push(c);
    }
    return promoted;
  },

  // ============================================================
  // PHASE 4c: RECALL
  //
  // Recall extends the field across time. Persisted records become
  // available as candidates for evaluation when render-scope gap is
  // high enough to trigger recall (parallel to predictive reaching).
  //
  // Recalled records:
  //   - Carry their original kind (ratified, meta, compound, seed)
  //     so the compiler dispatches correctly
  //   - Carry a `recalled: true` flag for downstream identification
  //   - Carry weight history from when they were persisted
  //
  // Per "let delta decide before imposing precedence": no kindMult.
  // Recalled records compete on accumulated weight in selectFromMatches.
  // ============================================================

  // Decide whether to recall this step. Mirrors predictive-reaching
  // trigger logic: gap above threshold motivates reaching.
  shouldTriggerRecall: function () {
    return this.gap >= CFG.RECALL_GAP_THRESH;
  },

  // Set the recall window. Called by CT engine after fetching from
  // storage. Replaces the previous window (windows are per-event,
  // not accumulated).
  setRecallWindow: function (records) {
    this.recallWindow = Array.isArray(records) ? records : [];
  },

  // Build the population for the next ER evaluation. Returns a flat
  // array of constraints to compile: live constraints followed by
  // recall window. The returned array's indices are used by the
  // ER engine and CT engine; indices >= Field.constraints.length
  // are recall-window records.
  buildEvaluationPopulation: function () {
    if (!this.recallWindow.length) return this.constraints;
    return this.constraints.concat(this.recallWindow);
  },

  // Identify recalled-record matches from a matched-index array
  // produced by ER evaluation over the combined population.
  // Returns indices that point INTO the recall window (offset
  // already subtracted), separate from live-constraint matches.
  partitionMatches: function (combinedMatched) {
    const liveCount = this.constraints.length;
    const live = [];
    const recalled = [];
    for (const idx of combinedMatched) {
      if (idx < liveCount) {
        live.push(idx);
      } else {
        recalled.push({
          combinedIdx: idx,
          windowIdx: idx - liveCount,
          record: this.recallWindow[idx - liveCount]
        });
      }
    }
    return { live: live, recalled: recalled };
  },

  // Record a recall event for surface observation. Bounded buffer.
  recordRecallEvent: function (eventKind, payload) {
    this.recallEventLog.push({
      step: this.step,
      kind: eventKind,         // "recalled" or "re-encountered"
      payload: payload || {}
    });
    while (this.recallEventLog.length > CFG.RECALL_EVENT_LOG_CAP) {
      this.recallEventLog.shift();
    }
  },

  // When a recalled record matched current input and contributed to
  // closure, increment its recallSuccessCount and bump its weight.
  // The record is in the recall window; the CT engine is responsible
  // for asking storage to persist the updated record back.
  reinforceRecallMatch: function (windowIdx) {
    if (windowIdx < 0 || windowIdx >= this.recallWindow.length) return null;
    const r = this.recallWindow[windowIdx];
    r.recallSuccessCount = (r.recallSuccessCount || 0) + 1;
    r.weight = Math.min(3.0, (r.weight || 1.0) + CFG.RECALL_SUCCESS_BOOST);
    r.lastUsed = this.step;
    return r;
  },

  // ============================================================
  // PERSISTENCE: serialize / deserialize for snapshots
  // ============================================================
  serialize: function () {
    return JSON.stringify({
      version: 4,
      constraints: this.constraints,
      aged: this.aged,
      inputCount: this.inputCount,
      step: this.step,
      ratCount: this.ratCount,
      scalarDelta: this.scalarDelta,
      fastDelta: this.fastDelta,
      slowDelta: this.slowDelta,
      gap: this.gap,
      fastMod: this.fastMod,
      slowMod: this.slowMod,
      recentOps: this.recentOps,
      correlations: this.correlations,
      familyFidelity: this.familyFidelity,
      subcascades: this.subcascades,
      namingPref: this.namingPref,
      namedCount: this.namedCount,
      _idCtr: this._idCtr,
      // Phase 3
      ctTotalOpsSeen: this.ctTotalOpsSeen,
      ctOpsCompleted: this.ctOpsCompleted,
      ctLastSnapshotStep: this.ctLastSnapshotStep,
      execScalarDelta: this.execScalarDelta,
      execFastDelta: this.execFastDelta,
      execSlowDelta: this.execSlowDelta,
      execGap: this.execGap,
      // Phase 4b
      compoundFidelity: this.compoundFidelity,
      compoundGenerationHistory: this.compoundGenerationHistory
    });
  },
  deserialize: function (json) {
    let data;
    try { data = JSON.parse(json); }
    catch (e) { return false; }
    if (!data || (data.version !== 3 && data.version !== 4)) return false;
    // Restore fields with type-checking
    this.constraints = Array.isArray(data.constraints) ? data.constraints : [Object.assign({}, SEED)];
    this.aged = Array.isArray(data.aged) ? data.aged : [];
    this.inputCount = +data.inputCount || 0;
    this.step = +data.step || 0;
    this.ratCount = +data.ratCount || 0;
    this.scalarDelta = Guards.clamp01(+data.scalarDelta);
    this.fastDelta = Guards.clamp01(+data.fastDelta);
    this.slowDelta = Guards.clamp01(+data.slowDelta);
    this.gap = Guards.clamp01(+data.gap);
    this.fastMod = +data.fastMod || 0;
    this.slowMod = Guards.clamp01(+data.slowMod);
    this.recentOps = Array.isArray(data.recentOps) ? data.recentOps : [];
    this.correlations = data.correlations && typeof data.correlations === "object"
      ? data.correlations : Object.create(null);
    this.familyFidelity = data.familyFidelity && typeof data.familyFidelity === "object"
      ? data.familyFidelity : Object.create(null);
    this.subcascades = Array.isArray(data.subcascades) ? data.subcascades : [];
    this.namingPref = Guards.clamp01(+data.namingPref);
    this.namedCount = +data.namedCount || 0;
    this._idCtr = +data._idCtr || 0;
    // Phase 3
    this.ctTotalOpsSeen = +data.ctTotalOpsSeen || 0;
    this.ctOpsCompleted = +data.ctOpsCompleted || 0;
    this.ctLastSnapshotStep = +data.ctLastSnapshotStep || 0;
    this.execScalarDelta = Guards.clamp01(+data.execScalarDelta);
    this.execFastDelta = Guards.clamp01(+data.execFastDelta);
    this.execSlowDelta = Guards.clamp01(+data.execSlowDelta);
    this.execGap = Guards.clamp01(+data.execGap);
    // Phase 4b (only in v4 snapshots)
    if (data.version === 4) {
      this.compoundFidelity = data.compoundFidelity && typeof data.compoundFidelity === "object"
        ? data.compoundFidelity : Object.create(null);
      this.compoundGenerationHistory = Array.isArray(data.compoundGenerationHistory)
        ? data.compoundGenerationHistory : [];
    } else {
      // v3 snapshot: initialize compound state empty (forward-compat read)
      this.compoundFidelity = Object.create(null);
      this.compoundGenerationHistory = [];
    }
    return true;
  }
};

// ---------------------------------------------------------------------------
// Trace: shared trace log, written by both engines, read by host UI
// ---------------------------------------------------------------------------
const Trace = {
  entries: [],
  flushedToStorage: 0,    // index up to which entries have been persisted
  append: function (scope, op, vd, detail, tag) {
    this.entries.push({
      step: Field.step,
      scope: String(scope || "field"),
      op: String(op || ""),
      scalar: vd && typeof vd.scalar === "number" ? vd.scalar : Field.scalarDelta,
      fast: vd && typeof vd.fast === "number" ? vd.fast : Field.fastDelta,
      slow: vd && typeof vd.slow === "number" ? vd.slow : Field.slowDelta,
      gap: vd && typeof vd.gap === "number" ? vd.gap : Field.gap,
      detail: Guards.clampString(detail || "", 100),
      tag: tag || null
    });
    while (this.entries.length > CFG.TRACE_CAP) {
      this.entries.shift();
      if (this.flushedToStorage > 0) this.flushedToStorage -= 1;
    }
  },
  clear: function () { this.entries = []; this.flushedToStorage = 0; },
  unflushed: function () { return this.entries.slice(this.flushedToStorage); },
  markFlushed: function () { this.flushedToStorage = this.entries.length; }
};

// ---------------------------------------------------------------------------
// OpsLog: human-readable log of high-level operations (for UI)
// ---------------------------------------------------------------------------
const OpsLog = {
  entries: [],
  append: function (opLabel, detail) {
    this.entries.unshift({
      step: Field.step,
      op: String(opLabel),
      detail: Guards.clampString(detail || "", 140)
    });
    while (this.entries.length > CFG.OPS_LOG_CAP) this.entries.pop();
  },
  clear: function () { this.entries = []; }
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
const FieldModule = Object.freeze({
  Guards: Guards,
  CFG: CFG,
  SEED: SEED,
  Field: Field,
  Trace: Trace,
  OpsLog: OpsLog
});

if (typeof module !== "undefined" && module.exports) {
  module.exports = FieldModule;
} else {
  global.FieldModule = FieldModule;
}

})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));
