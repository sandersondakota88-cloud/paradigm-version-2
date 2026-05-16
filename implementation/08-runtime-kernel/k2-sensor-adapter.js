// k2-sensor-adapter.js - Phase 8 K2 - Pointer/keyboard as SE-08 contributor (A3)

"use strict";

const SOURCE_NAME = "sensor-adapter";

const CONFIG = Object.freeze({
  MOUSE_THROTTLE_MS: 16,    // ~60Hz
  MAX_KEYS_HELD: 8          // I3: cap concurrent key-down coords
});

class SensorAdapter {
  constructor(opts) {
    opts = opts || {};

    if (!opts.publisher) {
      throw new Error("k2-sensor-adapter: publisher is required");
    }
    this.publisher = opts.publisher;

    this.config = Object.assign({}, CONFIG, opts.config || {});

    // Channels enabled. Default: pointer + keyboard on. Caller can disable.
    this.channels = Object.assign(
      { pointer: true, keyboard: true },
      opts.channels || {}
    );

    // Document accessor for addEventListener. Tests inject a mock with
    // addEventListener / removeEventListener.
    this.doc = opts.doc || (typeof document !== "undefined" ? document : null);

    // Clock for throttle window. Adapter using Date.now HERE is the
    // legitimate site (Phase 7 closure-verifier discipline).
    this.clock = opts.clock || (typeof Date !== "undefined" ? function () { return Date.now(); } : function () { return 0; });

    this._listeners = [];           // [{target, type, fn}]
    this._heldKeys = new Set();
    this._lastMouseWrite = 0;
    this._stopped = false;

    this.stats = {
      eventsReceived: 0,
      mouseThrottleSkips: 0,
      keyCapRejections: 0
    };
  }

  // --------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------
  start() {
    if (this._stopped) return;
    if (!this.doc) {
      throw new Error("k2-sensor-adapter: no document available");
    }
    const self = this;
    if (this.channels.pointer) {
      this._addListener(this.doc, "mousemove", function (e) { self._onMouseMove(e); });
      this._addListener(this.doc, "mousedown", function (e) { self._onMouseButton(e); });
      this._addListener(this.doc, "mouseup",   function (e) { self._onMouseButton(e); });
    }
    if (this.channels.keyboard) {
      this._addListener(this.doc, "keydown", function (e) { self._onKey(e, true); });
      this._addListener(this.doc, "keyup",   function (e) { self._onKey(e, false); });
    }
  }

  stop() {
    for (const l of this._listeners) {
      if (l.target.removeEventListener) {
        l.target.removeEventListener(l.type, l.fn);
      }
    }
    this._listeners = [];
    this._stopped = true;
  }

  _addListener(target, type, fn) {
    target.addEventListener(type, fn);
    this._listeners.push({ target: target, type: type, fn: fn });
  }

  // --------------------------------------------------------------------
  // Pointer handlers
  // --------------------------------------------------------------------
  _onMouseMove(e) {
    this.stats.eventsReceived++;
    const now = this.clock();
    if (now - this._lastMouseWrite < this.config.MOUSE_THROTTLE_MS) {
      this.stats.mouseThrottleSkips++;
      return;
    }
    this._lastMouseWrite = now;
    this.publisher.publish({
      type: "mouse-x",
      value: e.clientX,
      source: SOURCE_NAME
    });
    this.publisher.publish({
      type: "mouse-y",
      value: e.clientY,
      source: SOURCE_NAME
    });
  }

  _onMouseButton(e) {
    this.stats.eventsReceived++;
    const buttons = (typeof e.buttons === "number") ? e.buttons : 0;
    this.publisher.publish({
      type: "mouse-buttons",
      value: buttons,
      source: SOURCE_NAME
    });
  }

  // --------------------------------------------------------------------
  // Keyboard handlers
  // --------------------------------------------------------------------
  _onKey(e, isDown) {
    this.stats.eventsReceived++;
    const keyName = this._sanitizeKeyName(e.key);
    if (!keyName) return;
    if (isDown) {
      if (this._heldKeys.has(keyName)) return;        // ignore repeat
      if (this._heldKeys.size >= this.config.MAX_KEYS_HELD) {
        this.stats.keyCapRejections++;
        return;
      }
      this._heldKeys.add(keyName);
      this.publisher.publish({
        type: "key-" + keyName,
        value: "1",
        source: SOURCE_NAME
      });
    } else {
      if (!this._heldKeys.has(keyName)) return;
      this._heldKeys.delete(keyName);
      this.publisher.publish({
        type: "key-" + keyName,
        value: "0",
        source: SOURCE_NAME
      });
    }
  }

  _sanitizeKeyName(rawKey) {
    if (typeof rawKey !== "string") return null;
    if (rawKey === " ") return "Space";
    const safe = rawKey.replace(/[^A-Za-z0-9_]/g, "_");
    if (safe.length === 0 || safe.length > 32) return null;
    return safe;
  }
}

module.exports = Object.freeze({
  SensorAdapter: SensorAdapter,
  SOURCE_NAME: SOURCE_NAME,
  CONFIG: CONFIG
});
