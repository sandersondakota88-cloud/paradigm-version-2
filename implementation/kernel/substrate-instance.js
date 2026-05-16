// substrate-instance.js - Per-instance substrate factory (Phase 5.7)

"use strict";

const path = require("path");

// Modules that need per-instance isolation. Every require of these from
// within an instance must hit a fresh cache entry, not the singleton.
const ISOLATED_MODULES = [
  "./field.js",
  "./ct-engine.js",
  "./er-engine.js",
  "./constraint-compiler.js",
  "./cpu-oracle.js",
  "./reflexive-surface.js",
  "./storage-adapter.js",
  "./trajectory-recorder.js"
];

// Resolve absolute paths once - we need them for cache key manipulation.
const RESOLVED = (function () {
  const map = {};
  for (const m of ISOLATED_MODULES) {
    try {
      map[m] = require.resolve(path.join(__dirname, m));
    } catch (e) {
      // Some modules may not exist in all phases; skip silently.
    }
  }
  return map;
})();

// ----------------------------------------------------------------------------
// createSubstrate(opts)
// ----------------------------------------------------------------------------
// Returns an isolated substrate instance with its own Field/Trace/CT/ER.
//
// opts:
//   id         (string)   -- identifier for this instance, used in trace
//                             prefixing and diagnostic output
//   seed       (string)   -- override seed token; default uses canonical
//                             "what-is-delta" seed from field.js
// ----------------------------------------------------------------------------

function createSubstrate(opts) {
  opts = opts || {};
  const id = String(opts.id || "substrate-anon");

  // Clear cache entries for all isolated modules so the next require
  // produces fresh module-level state.
  for (const k in RESOLVED) {
    delete require.cache[RESOLVED[k]];
  }

  // Re-require with cleared cache. Each of these is now a fresh module
  // instance with its own module-level Field/Trace/etc.
  const FieldModule = require(path.join(__dirname, "./field.js"));
  const CTengineModule = require(path.join(__dirname, "./ct-engine.js"));
  const ERengineModule = require(path.join(__dirname, "./er-engine.js"));
  const CompilerModule = require(path.join(__dirname, "./constraint-compiler.js"));

  const Field = FieldModule.Field;
  const Trace = FieldModule.Trace;
  const OpsLog = FieldModule.OpsLog;
  const CFG = FieldModule.CFG;
  const SEED = FieldModule.SEED;

  // Initialize this instance's Field to canonical starting state
  Field.reset();
  Trace.clear();
  if (OpsLog && OpsLog.clear) OpsLog.clear();

  // Wire the engines per the canonical harness pattern
  const ER = new ERengineModule.ERengine();
  ER.state = "cpu-fallback";  // headless Node: CPU oracle only

  const CT = new CTengineModule.CTengine();
  CT.bind(ER, CompilerModule);

  // ----- public API on the instance -----

  const instance = {
    id: id,
    Field: Field,
    Trace: Trace,
    OpsLog: OpsLog,
    CFG: CFG,
    SEED: SEED,
    ct: CT,
    er: ER,

    // Submit text input. Returns when the input op has been drained.
    async input(text) {
      CT.enqueueInput(String(text));
      await CT.drainAll(8);
      return this;
    },

    // Drive N internal ticks (settling without external input)
    async tick(n) {
      n = (n | 0) || 1;
      for (let i = 0; i < n; i++) {
        CT.enqueueInternal("tick", {});
        await CT.drainAll(8);
      }
      return this;
    },

    // Drive N develop/correlate cycles (substrate operating on its own
    // accumulated structure rather than waiting for input)
    async settle(n) {
      n = (n | 0) || 1;
      for (let i = 0; i < n; i++) {
        CT.enqueueInternal("develop", {});
        CT.enqueueInternal("correlate", {});
        await CT.drainAll(8);
      }
      return this;
    },

    // Get a structural snapshot of the instance's current state
    getState() {
      Field.refreshVectorDelta();
      const cs = (Field.constraints || []).map(c => ({
        id: c.id, kind: c.kind, uses: c.uses | 0,
        lastUsed: c.lastUsed | 0,
        weight: typeof c.weight === "number" ? c.weight : 0
      }));
      const subs = (Field.subcascades || []).map(s => ({
        id: s.id,
        namedCount: s.namedCount | 0,
        localDelta: typeof s.localDelta === "number" ? s.localDelta : 0
      }));
      return {
        id: id,
        step: Field.step,
        scalarDelta: Field.scalarDelta,
        fastDelta: Field.fastDelta,
        slowDelta: Field.slowDelta,
        execScalarDelta: Field.execScalarDelta,
        execFastDelta: Field.execFastDelta,
        execSlowDelta: Field.execSlowDelta,
        fastMod: Field.fastMod,
        slowMod: Field.slowMod,
        ratCount: Field.ratCount | 0,
        namedCount: Field.namedCount | 0,
        inputCount: Field.inputCount | 0,
        constraintCount: cs.length,
        constraints: cs,
        subcascades: subs,
        traceLength: (Trace.entries || []).length
      };
    },

    // Teardown - reset field state. The require cache stays primed; caller
    // wanting full isolation should call createSubstrate() again, which
    // clears caches and re-loads modules fresh.
    async teardown() {
      Field.reset();
      Trace.clear();
      if (OpsLog && OpsLog.clear) OpsLog.clear();
      return this;
    }
  };

  return instance;
}

// ----------------------------------------------------------------------------
// Diagnostic: verify isolation between two instances
// ----------------------------------------------------------------------------

async function verifyIsolation() {
  const a = createSubstrate({ id: "a" });
  const b = createSubstrate({ id: "b" });

  if (a.Field === b.Field) {
    return { ok: false, reason: "a.Field === b.Field (singleton leaked)" };
  }
  if (a.Trace === b.Trace) {
    return { ok: false, reason: "a.Trace === b.Trace (singleton leaked)" };
  }

  await a.input("alpha");
  await b.input("beta gamma delta");

  const stateA = a.getState();
  const stateB = b.getState();

  if (stateA.constraintCount === stateB.constraintCount &&
      stateA.scalarDelta === stateB.scalarDelta) {
    // Could be coincidence with very specific inputs; but with these
    // distinct inputs it would indicate aliased state.
    return {
      ok: false,
      reason: "Distinct inputs produced identical state - possible aliasing"
    };
  }

  return {
    ok: true,
    a: { id: stateA.id, step: stateA.step, constraintCount: stateA.constraintCount },
    b: { id: stateB.id, step: stateB.step, constraintCount: stateB.constraintCount }
  };
}

module.exports = {
  createSubstrate: createSubstrate,
  verifyIsolation: verifyIsolation
};
