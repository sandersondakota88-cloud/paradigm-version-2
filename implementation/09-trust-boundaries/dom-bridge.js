// dom-bridge.js - Browser-side bidirectional flow (Phase 8 K1)

"use strict";

(function (global) {

// ============================================================================
// DEFAULT_BINDING - the conventions today's bridge uses
//
// Per Phase 9 architectural decision (PHASE_9_PLAN sec 15): the
// bridge's hardcoded conventions move from bridge code into the
// deposition. The DEFAULT_BINDING preserves today's behavior so
// existing layers continue to work without migration. Future
// depositions ship their own binding object.
//
// Fields:
//   presenceMarkerAttr - the attribute that marks the state element
//     as the substrate-state coord root. Cascade rules typically
//     match `[data-substrate-state]`; under a custom binding this
//     could be e.g. `[data-app-root]`.
//   outputAttrPrefix - the prefix to add when writing coord values
//     as DOM attributes. Today: "data-". A custom binding could
//     use any prefix admitted by HTML5.
//   objectKeysAsCoordsPrefixes - intake type prefixes whose records
//     carry an object value whose keys become coord names. Today:
//     ["dom"].
//   scalarValuesPrefixes - intake type prefixes whose records carry
//     a scalar value, with the dim name in the type after "::".
//     Today: ["time"]. (External::record records are caught by this
//     branch too; see projectFieldToDOM logic.)
//   defaultEventTriggerAttr - default event-target attribute the
//     bridge reads to populate the event record's "trigger" field.
//   defaultEventInputPresentAttr - default event-target attribute
//     for "input-present".
// ============================================================================
const DEFAULT_BINDING = Object.freeze({
  presenceMarkerAttr: "data-substrate-state",
  outputAttrPrefix: "data-",
  objectKeysAsCoordsPrefixes: Object.freeze(["dom"]),
  scalarValuesPrefixes: Object.freeze(["time"]),
  defaultEventTriggerAttr: "data-trigger",
  defaultEventInputPresentAttr: "data-input-present"
});

// resolveBinding: produce an effective binding from caller's overrides
// merged onto DEFAULT_BINDING. If caller passes nothing, returns the
// default unchanged. If caller passes overrides, fields not specified
// inherit from DEFAULT_BINDING.
function resolveBinding(overrides) {
  if (!overrides) return DEFAULT_BINDING;
  return Object.freeze({
    presenceMarkerAttr: overrides.presenceMarkerAttr ||
      DEFAULT_BINDING.presenceMarkerAttr,
    outputAttrPrefix: (typeof overrides.outputAttrPrefix === "string")
      ? overrides.outputAttrPrefix
      : DEFAULT_BINDING.outputAttrPrefix,
    objectKeysAsCoordsPrefixes: Array.isArray(overrides.objectKeysAsCoordsPrefixes)
      ? Object.freeze(overrides.objectKeysAsCoordsPrefixes.slice())
      : DEFAULT_BINDING.objectKeysAsCoordsPrefixes,
    scalarValuesPrefixes: Array.isArray(overrides.scalarValuesPrefixes)
      ? Object.freeze(overrides.scalarValuesPrefixes.slice())
      : DEFAULT_BINDING.scalarValuesPrefixes,
    defaultEventTriggerAttr: overrides.defaultEventTriggerAttr ||
      DEFAULT_BINDING.defaultEventTriggerAttr,
    defaultEventInputPresentAttr: overrides.defaultEventInputPresentAttr ||
      DEFAULT_BINDING.defaultEventInputPresentAttr
  });
}

// ============================================================================
// Bridge state - per-instance (init creates a new bridge object)
// ============================================================================

function createBridge() {
  let _field = null;
  let _stateElement = null;
  let _binding = DEFAULT_BINDING;
  let _listeners = [];   // for teardown
  let _lastObservedNextOp = null;
  let _lastObservedAtStep = -1;
  let _projectionCount = 0;

  // ----------------------------------------------------------------------
  // init: wire to field, locate state element, optionally apply binding
  //
  // binding (third arg) is optional. If absent, DEFAULT_BINDING is used,
  // preserving today's behavior. If present, the binding's conventions
  // override the defaults. Per Phase 9 architectural decision: the
  // binding moves from bridge code into deposition; different
  // deployments ship different bindings.
  // ----------------------------------------------------------------------
  function init(field, stateElement, binding) {
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
    _binding = resolveBinding(binding);
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
    const objectKeysPrefixes = _binding.objectKeysAsCoordsPrefixes;
    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      if (typeof rec.type !== "string") continue;
      const colon = rec.type.indexOf("::");
      // Three cases:
      //   1. <objectKeysPrefix>::<anything> with object value: object
      //      keys become coord keys (e.g., dom::evt with {trigger:"x"}
      //      -> coord "trigger" = "x")
      //   2. <anyOtherPrefix>::<dimName> with scalar value: dim name
      //      = after "::" (e.g., "time::now" with 1700... -> coord
      //      "now" = "1700...")
      //   3. type-name without "::": full type becomes dim name
      //      (e.g., "time-now" with 1700... -> coord "time-now" =
      //      "1700...")
      // Per Phase 9 architectural decision: routing prefixes come
      // from the binding rather than hardcoded.
      if (colon < 0) {
        // Case 3: no prefix - full type is the dim name
        coords[rec.type] = String(rec.value);
        continue;
      }
      const prefix = rec.type.substring(0, colon);
      const dimName = rec.type.substring(colon + 2);
      if (objectKeysPrefixes.indexOf(prefix) >= 0
          && rec.value && typeof rec.value === "object") {
        for (const k of Object.keys(rec.value)) {
          coords[k] = String(rec.value[k]);
        }
      } else {
        coords[dimName] = String(rec.value);
      }
    }
    // Set the presence marker if not already present
    if (!_stateElement.hasAttribute(_binding.presenceMarkerAttr)) {
      _stateElement.setAttribute(_binding.presenceMarkerAttr, "");
    }
    // Write coord values as attribute names (with binding's prefix)
    for (const k of Object.keys(coords)) {
      _stateElement.setAttribute(_binding.outputAttrPrefix + k, coords[k]);
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
    // Pull the trigger attribute off the target. The attribute name
    // comes from the binding (today: data-trigger). The cascade
    // matches against this attribute.
    const trigger = (typeof tgt.getAttribute === "function")
      ? tgt.getAttribute(_binding.defaultEventTriggerAttr) : null;
    if (!trigger) return null;
    const value = { trigger: trigger };
    // Optional: pull the input-present attribute
    const inputPresent = tgt.getAttribute &&
      tgt.getAttribute(_binding.defaultEventInputPresentAttr);
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
    diagnostics: diagnostics,
    getBinding: function () { return _binding; }
  };
}

// ============================================================================
// Exports
// ============================================================================

const DOMbridge = Object.freeze({
  createBridge: createBridge,
  DEFAULT_BINDING: DEFAULT_BINDING,
  resolveBinding: resolveBinding
});

if (typeof module !== "undefined" && module.exports) {
  module.exports = DOMbridge;
} else {
  global.DOMbridge = DOMbridge;
}

})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));
