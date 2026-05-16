// contributor-publisher.js - SE-08 unified pathway, adapters to field

"use strict";

class ContributorPublisher {
  constructor(field) {
    if (!field) {
      throw new Error("ContributorPublisher: field is required");
    }
    if (!field.intake || typeof field.intake.publish !== "function") {
      throw new Error("ContributorPublisher: field.intake.publish required " +
        "(install field-intake-extension before constructing publisher)");
    }
    this.field = field;
    this._publishCount = 0;
    this._validationFailures = 0;
  }

  // ----------------------------------------------------------------
  // publish(record) -- the only public method
  // ----------------------------------------------------------------
  // Validates and dispatches a contributor record. Returns void per F3.
  // Validation failures are counted (for observation) but do NOT throw,
  // since adapter failures are silent at the field level per Phase 7
  // time-adapter's discipline: "the adapter does not notify any engine
  // of its failures."
  // ----------------------------------------------------------------
  publish(record) {
    // F3 guarantee: this method returns nothing. Even if validation
    // fails, no error propagates. Adapters fire on their own cadence.
    if (!this._validRecord(record)) {
      this._validationFailures++;
      return;
    }
    // Auto-stamp timestamp from field.step if absent
    if (typeof record.timestamp !== "number") {
      record.timestamp = this.field.step;
    }
    this.field.intake.publish(record);
    this._publishCount++;
    // explicit no-return per F3
  }

  // ----------------------------------------------------------------
  // _validRecord(record) -- internal SE-08 shape check
  // ----------------------------------------------------------------
  // Checks the four-field schema: {type, value, timestamp?, source}.
  // Type and source are required strings; value is any non-undefined;
  // timestamp is optional (auto-stamped).
  // ----------------------------------------------------------------
  _validRecord(record) {
    if (!record || typeof record !== "object") return false;
    if (typeof record.type !== "string" || record.type.length === 0) return false;
    if (typeof record.source !== "string" || record.source.length === 0) return false;
    if (record.value === undefined) return false;
    return true;
  }

  // ----------------------------------------------------------------
  // observation surface (O-class observer per O1)
  // ----------------------------------------------------------------
  // Read-only counters for diagnostics. Not for engine consumption.
  // ----------------------------------------------------------------
  observe() {
    return {
      publishCount: this._publishCount,
      validationFailures: this._validationFailures,
      intakeRecordCount: (this.field.intake.records || []).length
    };
  }
}

// ============================================================================
// Static factory
// ============================================================================
// Common usage: attach a single publisher to a field. Adapters share it.
// ============================================================================

ContributorPublisher.attach = function (field) {
  return new ContributorPublisher(field);
};

module.exports = Object.freeze({ ContributorPublisher: ContributorPublisher });
