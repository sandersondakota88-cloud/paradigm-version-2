// k2-host-info-adapter.js - Phase 8 K2 - Location/cookie as SE-08 contributor (A4)

"use strict";

const SOURCE_NAME = "host-info-adapter";

const CONFIG = Object.freeze({
  POLL_INTERVAL_MS: 250,        // 4 Hz; URL changes are infrequent
  MAX_COOKIES: 64,              // I3: cap parsed cookies
  MAX_COOKIE_NAME_LEN: 64,
  MAX_COOKIE_VALUE_LEN: 4096
});

const LOCATION_PROPS = ["href", "pathname", "search", "hash", "host"];

class HostInfoAdapter {
  constructor(opts) {
    opts = opts || {};

    if (!opts.publisher) {
      throw new Error("k2-host-info-adapter: publisher is required");
    }
    this.publisher = opts.publisher;

    this.config = Object.assign({}, CONFIG, opts.config || {});

    this.channels = Object.assign(
      { location: true, cookie: true },
      opts.channels || {}
    );

    // Injectable hosts. Tests inject mocks; deposited form binds to
    // location and document.
    this.loc = opts.loc || (typeof location !== "undefined" ? location : null);
    this.doc = opts.doc || (typeof document !== "undefined" ? document : null);

    this._setInterval = opts.setInterval ||
      (typeof setInterval !== "undefined" ? setInterval : null);
    this._clearInterval = opts.clearInterval ||
      (typeof clearInterval !== "undefined" ? clearInterval : null);

    this._pollTimer = null;
    this._stopped = false;
    this._lastLocSnapshot = {};
    this._knownCookieNames = new Set();

    this.stats = {
      locSamples: 0,
      cookieSamples: 0,
      cookieCapRejections: 0
    };
  }

  // --------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------
  start() {
    if (this._pollTimer) return;
    if (this._stopped) return;
    if (!this._setInterval) {
      throw new Error("k2-host-info-adapter: setInterval not available");
    }
    // Initial sample so the field has values before the first poll fires
    this._poll();
    const self = this;
    this._pollTimer = this._setInterval(function () {
      try {
        self._poll();
      } catch (e) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[k2-host-info-adapter] poll error:", e.message);
        }
      }
    }, this.config.POLL_INTERVAL_MS);
  }

  stop() {
    if (this._pollTimer && this._clearInterval) {
      this._clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    this._stopped = true;
  }

  // --------------------------------------------------------------------
  // _poll: sample location + cookies; publish changes only
  // --------------------------------------------------------------------
  _poll() {
    if (this.channels.location) this._sampleLocation();
    if (this.channels.cookie) this._sampleCookies();
  }

  // --------------------------------------------------------------------
  // Location
  // --------------------------------------------------------------------
  _sampleLocation() {
    if (!this.loc) return;
    this.stats.locSamples++;
    for (const prop of LOCATION_PROPS) {
      const value = this.loc[prop];
      if (typeof value !== "string") continue;
      // Only publish if changed (S1 + I3: avoid redundant intake records)
      if (this._lastLocSnapshot[prop] === value) continue;
      this._lastLocSnapshot[prop] = value;
      this.publisher.publish({
        type: "loc-" + prop,
        value: value,
        source: SOURCE_NAME
      });
    }
  }

  // --------------------------------------------------------------------
  // Cookies
  // --------------------------------------------------------------------
  _sampleCookies() {
    if (!this.doc) return;
    this.stats.cookieSamples++;

    // Adapter using document.cookie HERE is the legitimate site
    const raw = (typeof this.doc.cookie === "string") ? this.doc.cookie : "";

    const parsed = this._parseCookies(raw);
    const seen = new Set();

    for (const name of Object.keys(parsed)) {
      if (seen.size >= this.config.MAX_COOKIES) {
        this.stats.cookieCapRejections++;
        break;
      }
      seen.add(name);

      const value = parsed[name];
      this._knownCookieNames.add(name);
      this.publisher.publish({
        type: "cookie-" + name,
        value: value,
        source: SOURCE_NAME
      });
    }

    // Cookies that disappeared since last sample: publish empty value
    for (const name of this._knownCookieNames) {
      if (!seen.has(name)) {
        this.publisher.publish({
          type: "cookie-" + name,
          value: "",
          source: SOURCE_NAME
        });
        this._knownCookieNames.delete(name);
      }
    }
  }

  _parseCookies(raw) {
    const result = {};
    if (!raw) return result;
    const parts = raw.split(";");
    for (const part of parts) {
      const idx = part.indexOf("=");
      if (idx < 0) continue;
      const name = part.substring(0, idx).trim();
      const value = part.substring(idx + 1).trim();
      if (!name || name.length > this.config.MAX_COOKIE_NAME_LEN) continue;
      if (value.length > this.config.MAX_COOKIE_VALUE_LEN) continue;
      // Sanitize name to data-attribute-safe form
      const safeName = name.replace(/[^A-Za-z0-9_-]/g, "_");
      if (safeName.length === 0) continue;
      result[safeName] = value;
    }
    return result;
  }
}

module.exports = Object.freeze({
  HostInfoAdapter: HostInfoAdapter,
  SOURCE_NAME: SOURCE_NAME,
  CONFIG: CONFIG,
  LOCATION_PROPS: LOCATION_PROPS
});
