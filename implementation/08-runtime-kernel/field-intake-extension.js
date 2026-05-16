// field-intake-extension.js - SE-08 input-feature buffer (Phase 8)

"use strict";

(function (global) {

const DEFAULT_CAP = 256;

// ============================================================================
// install: attach Field.intake to a FieldModule's Field instance
// ============================================================================

function install(FieldModule, opts) {
  opts = opts || {};
  const cap = (opts.cap | 0) || DEFAULT_CAP;
  const Field = FieldModule.Field;

  if (!Field) {
    throw new Error("field-intake-extension: FieldModule has no Field");
  }
  if (Field.intake) {
    // Already installed; idempotent
    return Field.intake;
  }

  // ---- intake state ----
  // Hung directly on Field per SE-08 (the buffer "lives in field.js
  // as shared state").
  Field.intake = {
    records: [],
    cap: cap,
    totalReceived: 0,

    publish: function (record) {
      // Validate record shape per SE-08 contract sec 2:
      //   { type, value, timestamp, source }
      if (!record || typeof record !== "object") {
        // Silently ignore malformed records per F3 (no error path back
        // to caller). A future verifier may scan for adapter validation
        // problems; the buffer itself remains permissive at the boundary.
        return;
      }
      // Append. I3 bound enforced.
      this.records.push({
        type: String(record.type || ""),
        value: record.value,
        timestamp: (record.timestamp | 0),
        source: String(record.source || "")
      });
      this.totalReceived++;
      // Evict oldest if over cap. The records array is FIFO so shift
      // from the front.
      while (this.records.length > this.cap) {
        this.records.shift();
      }
      // No return value (F3).
    },

    snapshot: function () {
      // Shallow copy. ER reads this each resolution pass. Returning a
      // copy means a long resolution pass doesn't see live mutations
      // from concurrent publishes. Mid-pass mutations land on next pass.
      return this.records.slice();
    },

    // For diagnostics / testing only - not for engine consumption.
    occupancy: function () {
      return this.records.length;
    },

    // Adapter backpressure read - SE-08: "backpressure must be substrate-
    // readable; adapters can read records.length to self-throttle."
    // This is just a convenience accessor; reading records.length directly
    // is also valid.
    isFull: function () {
      return this.records.length >= this.cap;
    },

    clear: function () {
      this.records.length = 0;
      // totalReceived is monotonic - persists across clear() (the M5 trace
      // and the buffer occupancy are different facts).
    }
  };

  // ---- wrap Field.reset() to clear intake ----
  // Field.reset re-initializes all field state. Intake should reset too,
  // since the field is being returned to canonical starting state.
  const originalReset = Field.reset.bind(Field);
  Field.reset = function () {
    originalReset();
    if (Field.intake) {
      Field.intake.clear();
      Field.intake.totalReceived = 0;
    }
  };

  return Field.intake;
}

// ============================================================================
// Exports
// ============================================================================

const FieldIntakeExtension = Object.freeze({
  install: install,
  DEFAULT_CAP: DEFAULT_CAP
});

if (typeof module !== "undefined" && module.exports) {
  module.exports = FieldIntakeExtension;
} else {
  global.FieldIntakeExtension = FieldIntakeExtension;
}

})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));
