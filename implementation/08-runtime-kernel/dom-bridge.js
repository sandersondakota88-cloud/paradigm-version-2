// dom-bridge.js - Browser-side bidirectional flow (Phase 8 K1)

"use strict";

(function (global) {

// ============================================================================
// Bridge state - per-instance (init creates a new bridge object)
// ============================================================================

function createBridge() {
  let _field = null;
  let _stateElement = null;
  let _listeners = [];   // for teardown
  let _lastObservedNextOp = null;
  let _lastObservedAtStep = -1;
  let _projectionCount = 0;

  // ----------------------------------------------------------------------
  // init: wire to field, locate state element
  // ----------------------------------------------------------------------
  function init(field, stateElement) {
    _field = field;
    _stateElement = stateElement;
    if (!_field) throw new Error("dom-bridge: field required");
    if (!_stateElement) throw new Error("dom-bridge: stateElement required");
    if (!_field.intake) {
      throw new Error("dom-bridge: field.intake not installed; " +
        "call FieldIntakeExtension.install(FieldModule) first");
    }
    // Verify state element supports the DOM APIs we need. If not, this
    // is a stub or non-DOM environment; the bridge stays initialized
    // but projectFieldToDOM and event listening become no-ops.
    if (typeof _stateElement.setAttribute !== "function" ||
        typeof _stateElement.hasAttribute !== "function") {
      _stateElement = null;  // degrade to no-op projection
    }
    _projectionCount = 0;
    _lastObservedNextOp = null;
    _lastObservedAtStep = -1;
  }

  // ----------------------------------------------------------------------
  // projectFieldToDOM: flow 4a
  //
  // Walk Field.intake records; for each "dom::*" or "time::*" record
  // whose value names a coord dimension, set the data-* attribute.
  // Latest record per dimension wins (FIFO buffer; later overwrites).
  //
  // S1 honored: regenerated each call from current field state. No
  // caching, no diff against previous projection.
  // ----------------------------------------------------------------------
  function projectFieldToDOM() {
    if (!_field || !_stateElement) return;
    const records = _field.intake.records;
    const coords = {};
    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      if (typeof rec.type !== "string") continue;
      const colon = rec.type.indexOf("::");
      // Three cases:
      //   1. "dom::evt" with object value: object keys become coord keys
      //      (e.g., {trigger:"toggle"} -> data-trigger="toggle")
      //   2. "prefix::dimName" with scalar value: dim name = after "::"
      //      (e.g., "time::now" with 1700... -> data-now="1700...")
      //   3. "type-name" without "::": full type becomes dim name
      //      (e.g., "time-now" with 1700... -> data-time-now="1700...")
      // Case 3 supports K2 adapters that publish flat type names matching
      // Phase 7's coord conventions (data-time-now, data-time-perf, etc.).
      if (colon < 0) {
        // Case 3: no prefix - full type is the dim name
        coords[rec.type] = String(rec.value);
        continue;
      }
      const prefix = rec.type.substring(0, colon);
      const dimName = rec.type.substring(colon + 2);
      if (prefix === "dom" && rec.value && typeof rec.value === "object") {
        for (const k of Object.keys(rec.value)) {
          coords[k] = String(rec.value[k]);
        }
      } else {
        coords[dimName] = String(rec.value);
      }
    }
    // Set the substrate-state presence marker if not already present
    if (!_stateElement.hasAttribute("data-substrate-state")) {
      _stateElement.setAttribute("data-substrate-state", "");
    }
    // Write coord values as data-* attributes
    for (const k of Object.keys(coords)) {
      _stateElement.setAttribute("data-" + k, coords[k]);
    }
    _projectionCount++;
  }

  // ----------------------------------------------------------------------
  // addEventListener: flow 4b
  //
  // Wrap a DOM event listener to construct a contributor record and
  // publish to Field.intake. The bridge's wrap-and-publish stays
  // utterly mechanical: it does not contain application logic.
  //
  // recordBuilder(domEvent) -> { type, value, ... } returns the record
  // shape the application's geometry expects. Default: dom::click
  // with the target's data-trigger.
  // ----------------------------------------------------------------------
  function addDOMEventListener(target, eventType, recordBuilder) {
    if (!_field) throw new Error("dom-bridge: not initialized");
    if (!target || typeof target.addEventListener !== "function") return;
    const handler = function (domEvent) {
      const record = (typeof recordBuilder === "function")
        ? recordBuilder(domEvent)
        : defaultEventRecord(eventType, domEvent);
      if (record) {
        _field.intake.publish(record);
      }
    };
    target.addEventListener(eventType, handler, false);
    _listeners.push({ target: target, eventType: eventType, handler: handler });
  }

  function defaultEventRecord(eventType, domEvent) {
    const tgt = domEvent && domEvent.target;
    if (!tgt) return null;
    // Pull data-trigger off the target (the rule the cascade is
    // matching). This mirrors the deposition convention: clickable
    // elements carry data-trigger="<op>" and the cascade matches.
    const trigger = (typeof tgt.getAttribute === "function")
      ? tgt.getAttribute("data-trigger") : null;
    if (!trigger) return null;
    const value = { trigger: trigger };
    // Optional: pull data-input-present if the target also exposes it
    const inputPresent = tgt.getAttribute && tgt.getAttribute("data-input-present");
    if (inputPresent !== null && inputPresent !== undefined) {
      value["input-present"] = String(inputPresent);
    }
    return {
      type: "dom::" + eventType,
      value: value,
      timestamp: (typeof domEvent.timeStamp === "number")
        ? Math.floor(domEvent.timeStamp) : 0,
      source: "dom-bridge"
    };
  }

  // ----------------------------------------------------------------------
  // sampleNextOp: kernel-authoritative read
  //
  // Reads Field.cascadeOutput["--next-op"] (populated by the kernel
  // evaluator). Returns null if no value, the current value otherwise.
  //
  // Caller (CT or tick loop) compares the returned value against
  // last-observed and dedupes before enqueueing.
  // ----------------------------------------------------------------------
  function sampleNextOp() {
    if (!_field || !_field.cascadeOutput) return null;
    const entry = _field.cascadeOutput["--next-op"];
    if (!entry) return null;
    return entry;
  }

  // ----------------------------------------------------------------------
  // sampleNextOpFromCss: browser-CSS-authoritative read
  //
  // Reads the cascade's resolved --next-op via getComputedStyle. This
  // is the alternative path per contract sec 4. Per S2, both paths
  // yield the same value. Useful for runtime cross-check / debugging.
  // ----------------------------------------------------------------------
  function sampleNextOpFromCss() {
    if (!_stateElement || typeof getComputedStyle !== "function") return null;
    const style = getComputedStyle(_stateElement);
    const raw = style.getPropertyValue("--next-op");
    if (!raw) return null;
    // Custom property values come back as strings, possibly quoted
    return raw.trim().replace(/^"(.*)"$/, "$1");
  }

  // ----------------------------------------------------------------------
  // dispatchToCT: combines sample + dedup + enqueue
  //
  // Per contract sec 3: CT.enqueueFromCascade samples Field.cascadeOutput.
  // The bridge handles the CT-side bookkeeping for dedup. Returns true
  // if enqueued, false if deduplicated or no-op.
  // ----------------------------------------------------------------------
  function dispatchToCT(ct) {
    const entry = sampleNextOp();
    if (!entry) return false;
    if (entry.value === _lastObservedNextOp &&
        entry.atStep === _lastObservedAtStep) {
      return false;  // already dispatched
    }
    _lastObservedNextOp = entry.value;
    _lastObservedAtStep = entry.atStep;
    return ct.enqueueInternal("cascade-op", {
      op: entry.value,
      sourceConstraintId: entry.sourceConstraintId,
      observedAtStep: entry.atStep
    });
  }

  // ----------------------------------------------------------------------
  // teardown: remove event listeners
  // ----------------------------------------------------------------------
  function teardown() {
    for (const l of _listeners) {
      try {
        l.target.removeEventListener(l.eventType, l.handler, false);
      } catch (_) { /* best effort */ }
    }
    _listeners = [];
    _field = null;
    _stateElement = null;
  }

  // ----------------------------------------------------------------------
  // Diagnostic accessors (no command path)
  // ----------------------------------------------------------------------
  function diagnostics() {
    return {
      initialized: _field !== null,
      stateElementId: _stateElement && _stateElement.id ? _stateElement.id : null,
      listenerCount: _listeners.length,
      projectionCount: _projectionCount,
      lastObservedNextOp: _lastObservedNextOp,
      lastObservedAtStep: _lastObservedAtStep
    };
  }

  return {
    init: init,
    projectFieldToDOM: projectFieldToDOM,
    addDOMEventListener: addDOMEventListener,
    sampleNextOp: sampleNextOp,
    sampleNextOpFromCss: sampleNextOpFromCss,
    dispatchToCT: dispatchToCT,
    teardown: teardown,
    diagnostics: diagnostics
  };
}

// ============================================================================
// Exports
// ============================================================================

const DOMbridge = Object.freeze({
  createBridge: createBridge
});

if (typeof module !== "undefined" && module.exports) {
  module.exports = DOMbridge;
} else {
  global.DOMbridge = DOMbridge;
}

})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));
