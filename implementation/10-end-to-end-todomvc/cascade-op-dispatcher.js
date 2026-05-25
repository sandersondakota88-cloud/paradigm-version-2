// cascade-op-dispatcher.js
// =============================================================================
// The CT-side tissue Phase 8 documented but did not implement.
//
// What this is for:
//
//   Phase 8's DOMbridge.dispatchToCT(CT) enqueues operations to CT.engine as:
//
//     CT.enqueueInternal("cascade-op", {op, sourceConstraintId, observedAtStep})
//
//   CT's _executeOp switch in implementation/kernel/ct-engine.js does NOT have
//   a case for "cascade-op". If one lands in CT.ctPendingOps and CT.drainAll()
//   runs, it throws "unknown op kind: cascade-op". The kernel runtime contract
//   in Phase 8's KERNEL_RUNTIME_CONTRACT.md describes this integration but the
//   integration was never built.
//
//   This module is the integration. It does NOT modify the kernel. It does
//   NOT modify CT. It intercepts cascade-op records from CT.ctPendingOps
//   BEFORE CT.drainAll runs, dispatches each to a registered operation
//   handler with the current intake-derived coord snapshot, and publishes the
//   handler's writebacks as new intake records.
//
// Contract:
//
//   register(opName, fn)
//     opName: string matching a cascade rule's emit.value (e.g. "add-todo")
//     fn: (coordSnapshot) => writebackMap | null
//         coordSnapshot: { dimName: value, ... } -- derived from Field.intake
//                        same shape KernelCascadeEvaluator builds
//         writebackMap: { coordName: newValue, ... } -- becomes a new
//                       "dom::set-attr"-style intake record so subsequent
//                       cascade evaluations see the writeback
//
//   drainCascadeOps(field, fieldModule)
//     Scans field.ctPendingOps for kind === "cascade-op". For each, removes
//     it from the queue, builds the coord snapshot, runs the handler, and
//     publishes writebacks. Call this BEFORE CT.drainAll() each tick.
//
// Why publish writebacks as intake records instead of mutating attributes:
//
//   The DOMbridge is responsible for projecting field state to DOM
//   attributes (via bridge.projectFieldToDOM). The handler shouldn't bypass
//   the bridge -- it publishes structured state changes; the bridge
//   projects them. This keeps the dispatcher F3-clean: it doesn't supervise
//   anything; it only contributes to intake.
// =============================================================================

"use strict";

(function (global) {

  const operations = Object.create(null);

  function register(opName, fn) {
    if (typeof opName !== "string" || !opName) {
      throw new TypeError("register: opName must be a non-empty string");
    }
    if (typeof fn !== "function") {
      throw new TypeError("register: fn must be a function");
    }
    operations[opName] = fn;
  }

  function unregister(opName) {
    delete operations[opName];
  }

  function listRegistered() {
    return Object.keys(operations);
  }

  // Build a coord snapshot the same way KernelCascadeEvaluator does, so the
  // handler sees the same view the cascade evaluator did when it resolved
  // the matching op. We duplicate the logic intentionally rather than
  // calling into the evaluator; the evaluator's snapshot is not exposed as
  // a public API.
  function buildCoordSnapshotFromIntake(field) {
    const coordValues = {};
    if (!field.intake || !field.intake.records) return coordValues;
    for (const rec of field.intake.records) {
      if (typeof rec.type !== "string") continue;
      const colonIdx = rec.type.indexOf("::");
      if (colonIdx < 0) continue;
      const prefix = rec.type.substring(0, colonIdx);
      const dimName = rec.type.substring(colonIdx + 2);
      if (prefix === "dom" && rec.value && typeof rec.value === "object") {
        for (const k of Object.keys(rec.value)) {
          coordValues[k] = String(rec.value[k]);
        }
      } else {
        coordValues[dimName] = String(rec.value);
      }
    }
    return coordValues;
  }

  // Publish a writeback map as a single dom::set-attr intake record so the
  // bridge will project it to DOM and the cascade evaluator will see the
  // new coord values on the next tick.
  function publishWriteback(field, writebacks, sourceConstraintId) {
    if (!writebacks || typeof writebacks !== "object") return;
    const keys = Object.keys(writebacks);
    if (keys.length === 0) return;
    if (!field.intake || typeof field.intake.publish !== "function") return;
    // Strip any "data-" prefix the handler may have used; the snapshot
    // convention is unprefixed dim names. Bridge re-adds the prefix on
    // projection.
    const value = {};
    for (const k of keys) {
      const cleanKey = (k.indexOf("data-") === 0) ? k.substring(5) : k;
      value[cleanKey] = String(writebacks[k]);
    }
    field.intake.publish({
      type: "dom::set-attr",
      value: value,
      timestamp: (typeof performance !== "undefined" && performance.now)
        ? performance.now() : Date.now(),
      source: "cascade-op-dispatcher::" + (sourceConstraintId || "unknown")
    });
  }

  // Main entry point. Call before CT.drainAll each tick.
  function drainCascadeOps(field) {
    if (!field || !Array.isArray(field.ctPendingOps)) {
      return { drained: 0, dispatched: 0, errors: [] };
    }
    let drained = 0;
    let dispatched = 0;
    const errors = [];

    // Walk pending ops; pull out and dispatch any cascade-op kind.
    // We iterate index-by-index and splice to avoid mutating the array
    // while iterating forward.
    let i = 0;
    while (i < field.ctPendingOps.length) {
      const op = field.ctPendingOps[i];
      if (op && op.kind === "cascade-op") {
        field.ctPendingOps.splice(i, 1);
        drained++;
        const payload = op.payload || {};
        const opName = payload.op;
        const handler = operations[opName];
        if (!handler) {
          errors.push({
            op: opName,
            reason: "no handler registered",
            sourceConstraintId: payload.sourceConstraintId
          });
          continue;
        }
        try {
          const coords = buildCoordSnapshotFromIntake(field);
          const writebacks = handler(coords);
          publishWriteback(field, writebacks, payload.sourceConstraintId);
          dispatched++;
        } catch (e) {
          errors.push({
            op: opName,
            reason: "handler threw: " + (e && e.message ? e.message : String(e)),
            sourceConstraintId: payload.sourceConstraintId
          });
        }
        // Don't advance i; splice shifted everything left
      } else {
        i++;
      }
    }

    return { drained: drained, dispatched: dispatched, errors: errors };
  }

  const CascadeOpDispatcher = Object.freeze({
    register: register,
    unregister: unregister,
    listRegistered: listRegistered,
    drainCascadeOps: drainCascadeOps,
    buildCoordSnapshotFromIntake: buildCoordSnapshotFromIntake
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = CascadeOpDispatcher;
  } else {
    global.CascadeOpDispatcher = CascadeOpDispatcher;
  }

})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));
