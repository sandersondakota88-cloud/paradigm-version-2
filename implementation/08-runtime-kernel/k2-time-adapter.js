// k2-time-adapter.js - Phase 8 K2 - Time as SE-08 contributor (A1)

"use strict";

const SOURCE_NAME = "time-adapter";

const CONFIG = Object.freeze({
  SAMPLE_INTERVAL_MS: 50,           // 20Hz, same as Phase 7
  TYPE_NOW: "time-now",
  TYPE_PERF: "time-perf"
});

// ============================================================================
// TimeAdapter (K2)
// ============================================================================

class TimeAdapter {
  constructor(opts) {
    opts = opts || {};
    this.config = Object.assign({}, CONFIG, opts.config || {});

    if (!opts.publisher) {
      throw new Error("k2-time-adapter: publisher is required");
    }
    this.publisher = opts.publisher;

    // Clock function. Defaults to the real host clock; tests inject a
    // mock to avoid coupling to real timers. Returns
    // { now: epoch_ms, perf: monotonic_ms_or_null }.
    //
    // The adapter using Date.now / performance.now HERE is legitimate
    // per closure-verifier semantics: this is the adapter module, the
    // ONE place in the deposition where host clock access is permitted.
    this.clock = opts.clock || defaultClock;

    // Optional setInterval / clearInterval injection for testability.
    // Defaults to host globals.
    this._setInterval = opts.setInterval || (typeof setInterval !== "undefined" ? setInterval : null);
    this._clearInterval = opts.clearInterval || (typeof clearInterval !== "undefined" ? clearInterval : null);

    this._sampleTimer = null;
    this._stopped = false;
    this._tickCount = 0;
  }

  // ----------------------------------------------------------------
  // start() / stop() -- lifecycle
  // ----------------------------------------------------------------
  start() {
    if (this._sampleTimer) return;
    if (this._stopped) return;
    if (!this._setInterval) {
      throw new Error("k2-time-adapter: setInterval not available");
    }
    // Initial tick so the field has a coordinate before the first interval.
    this._tick();
    this._sampleTimer = this._setInterval(() => {
      try {
        this._tick();
      } catch (e) {
        // Adapter failures are silent at the field level per F3.
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[k2-time-adapter] tick error:", e.message);
        }
      }
    }, this.config.SAMPLE_INTERVAL_MS);
  }

  stop() {
    if (this._sampleTimer && this._clearInterval) {
      this._clearInterval(this._sampleTimer);
      this._sampleTimer = null;
    }
    this._stopped = true;
  }

  // ----------------------------------------------------------------
  // _tick() -- the per-sample publish path
  // ----------------------------------------------------------------
  _tick() {
    const sample = this.clock();
    if (!sample || typeof sample.now !== "number") return;

    // Publish epoch-ms reading
    this.publisher.publish({
      type: this.config.TYPE_NOW,
      value: sample.now,
      source: SOURCE_NAME
    });

    // Publish monotonic-high-resolution reading if available.
    // Note we publish AS A SEPARATE record per SE-08's per-modality
    // discipline: the two modalities have different semantics and
    // application code that uses one is not interchangeable with the
    // other.
    if (typeof sample.perf === "number") {
      this.publisher.publish({
        type: this.config.TYPE_PERF,
        value: sample.perf,
        source: SOURCE_NAME
      });
    }

    this._tickCount++;
  }
}

// ============================================================================
// Default clock - the only call site for host time APIs in this module
// ============================================================================
//
// Per closure-verifier semantics, this module is an adapter and is the
// permitted site for Date.now/performance.now access. Application code
// in deposited form does NOT call defaultClock; it reads field state
// instead.
// ============================================================================

function defaultClock() {
  // Date.now() is the wall-clock-epoch reading.
  const now = (typeof Date !== "undefined") ? Date.now() : 0;

  // performance.now() is high-resolution monotonic time. May be absent
  // in older Node or headless environments. Returns null if unavailable
  // rather than falling back to wall-clock, because the modalities are
  // semantically distinct.
  let perf = null;
  if (typeof globalThis !== "undefined" &&
      globalThis.performance &&
      typeof globalThis.performance.now === "function") {
    perf = globalThis.performance.now();
  }

  return { now: now, perf: perf };
}

module.exports = Object.freeze({
  TimeAdapter: TimeAdapter,
  defaultClock: defaultClock,
  SOURCE_NAME: SOURCE_NAME,
  CONFIG: CONFIG
});
