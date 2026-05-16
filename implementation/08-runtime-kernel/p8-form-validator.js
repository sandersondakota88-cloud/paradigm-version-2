// p8-form-validator.js - Phase 8 P8 - validation as SE-08 contributor

"use strict";

const SOURCE_NAME = "form-validator";

// Built-in validators per field type. Each validator returns:
//   { empty: bool, patternMatch: bool, length: number }
const BUILTIN_VALIDATORS = Object.freeze({
  email: function (value) {
    const v = String(value || "");
    return {
      empty: v.length === 0,
      // Bounded simple email pattern: local@domain.tld, no fancy
      // RFC-5322 nesting; this is a validator demonstration not an
      // email library.
      patternMatch: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(v),
      length: v.length
    };
  },

  phone: function (value) {
    const v = String(value || "");
    // Simple pattern: optional + then 7-15 digits/spaces/dashes
    const cleaned = v.replace(/[\s\-()]/g, "");
    return {
      empty: v.length === 0,
      patternMatch: /^\+?[0-9]{7,15}$/.test(cleaned),
      length: v.length
    };
  },

  name: function (value) {
    const v = String(value || "");
    return {
      empty: v.length === 0,
      // Names: 1-200 chars, no leading/trailing whitespace
      patternMatch: v.length >= 1 && v.length <= 200 && v === v.trim(),
      length: v.length
    };
  },

  text: function (value) {
    // Generic text - just empty check + bounded length
    const v = String(value || "");
    return {
      empty: v.length === 0,
      patternMatch: v.length <= 1000,
      length: v.length
    };
  }
});

class FormValidator {
  constructor(opts) {
    opts = opts || {};

    if (!opts.publisher) {
      throw new Error("p8-form-validator: publisher is required");
    }
    this.publisher = opts.publisher;

    // Custom validator overrides
    this.validators = Object.assign({}, BUILTIN_VALIDATORS, opts.validators || {});

    this.stats = {
      validationsRun: 0,
      fieldsValidated: 0,
      patternMismatches: 0
    };
  }

  // --------------------------------------------------------------------
  // validate({fieldName: "email", fieldType: "email", value: "..."})
  //
  // Publishes 3 records (empty, pattern, length) for the field. The
  // cascade rules' job is to combine these into <field>-valid.
  // --------------------------------------------------------------------
  validate(spec) {
    if (!spec || typeof spec !== "object") return;
    if (typeof spec.fieldName !== "string" || spec.fieldName.length === 0) return;
    const fieldType = spec.fieldType || "text";
    const validator = this.validators[fieldType] || this.validators.text;

    let result;
    try {
      result = validator(spec.value);
    } catch (e) {
      // F3: validation errors do not propagate
      return;
    }
    if (!result || typeof result !== "object") return;

    const fn = spec.fieldName;
    this.publisher.publish({
      type: fn + "-empty",
      value: result.empty ? "1" : "0",
      source: SOURCE_NAME
    });
    this.publisher.publish({
      type: fn + "-pattern",
      value: result.patternMatch ? "match" : "no-match",
      source: SOURCE_NAME
    });
    this.publisher.publish({
      type: fn + "-length",
      value: String(result.length),
      source: SOURCE_NAME
    });

    this.stats.validationsRun++;
    this.stats.fieldsValidated++;
    if (!result.patternMatch && !result.empty) {
      this.stats.patternMismatches++;
    }
  }

  // --------------------------------------------------------------------
  // validateAll({fieldName: spec, ...}) - batch validation
  // --------------------------------------------------------------------
  validateAll(specs) {
    if (!specs || typeof specs !== "object") return;
    for (const fn of Object.keys(specs)) {
      const spec = specs[fn];
      if (typeof spec !== "object") continue;
      this.validate(Object.assign({ fieldName: fn }, spec));
    }
  }
}

module.exports = Object.freeze({
  FormValidator: FormValidator,
  SOURCE_NAME: SOURCE_NAME,
  BUILTIN_VALIDATORS: BUILTIN_VALIDATORS
});
