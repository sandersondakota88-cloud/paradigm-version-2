// k2-network-adapter.js - Phase 8 K2 - Network as SE-08 contributor (A2)

"use strict";

const SOURCE_NAME = "network-adapter";

const CONFIG = Object.freeze({
  POLL_INTERVAL_MS: 50,
  MAX_OUTSTANDING: 8
});

class NetworkAdapter {
  constructor(opts) {
    opts = opts || {};
    this.config = Object.assign({}, CONFIG, opts.config || {});

    if (!opts.publisher) {
      throw new Error("k2-network-adapter: publisher is required");
    }
    this.publisher = opts.publisher;

    // The fetch implementation. In a browser, this is the host's fetch.
    // The adapter using fetch HERE is legitimate per closure-verifier
    // semantics: this is the adapter module, the ONE place network access
    // is permitted.
    this.fetch = opts.fetch || (typeof fetch !== "undefined" ? fetch : null);

    // Element that holds trigger coords. The cascade writes triggers here;
    // the adapter polls.
    this.stateElement = opts.stateElement || null;

    // Optional setInterval / clearInterval for testability
    this._setInterval = opts.setInterval ||
      (typeof setInterval !== "undefined" ? setInterval : null);
    this._clearInterval = opts.clearInterval ||
      (typeof clearInterval !== "undefined" ? clearInterval : null);

    this.endpoints = {};      // sliceName -> endpoint config
    this.outstanding = new Set();
    this._pollTimer = null;
    this._stopped = false;

    this.stats = {
      requestsDispatched: 0,
      responsesReceived: 0,
      errorsEncountered: 0,
      capRejections: 0
    };
  }

  registerEndpoint(sliceName, config) {
    if (typeof sliceName !== "string" || !sliceName) {
      throw new TypeError("registerEndpoint: sliceName required");
    }
    if (!config || !config.url) {
      throw new TypeError("registerEndpoint: config.url required");
    }
    this.endpoints[sliceName] = {
      url: config.url,
      method: config.method || "GET",
      headers: config.headers || {},
      // Trigger attribute: cascade writes "1" to dispatch fetch
      triggerAttr: "data-trigger-fetch-" + sliceName
    };
  }

  start() {
    if (this._pollTimer) return;
    if (this._stopped) return;
    if (!this._setInterval) {
      throw new Error("k2-network-adapter: setInterval not available");
    }
    const self = this;
    this._pollTimer = this._setInterval(function () {
      try {
        self._poll();
      } catch (e) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[k2-network-adapter] poll error:", e.message);
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
  // _poll: sample trigger coords; dispatch fetches
  // --------------------------------------------------------------------
  _poll() {
    if (!this.stateElement) return;
    for (const sliceName of Object.keys(this.endpoints)) {
      const e = this.endpoints[sliceName];
      const triggerValue = this.stateElement.getAttribute(e.triggerAttr);
      if (triggerValue === "1") {
        // Clear the trigger immediately to prevent re-dispatch
        this.stateElement.setAttribute(e.triggerAttr, "0");
        this._dispatchFetch(sliceName);
      }
    }
  }

  // --------------------------------------------------------------------
  // _dispatchFetch: async fetch; on resolve, publish response
  // --------------------------------------------------------------------
  _dispatchFetch(sliceName) {
    const e = this.endpoints[sliceName];
    if (!e) return;

    // Cap: reject if too many outstanding
    if (this.outstanding.size >= this.config.MAX_OUTSTANDING) {
      this.stats.capRejections++;
      this._publishStatus(sliceName, "rejected");
      return;
    }
    if (this.outstanding.has(sliceName)) return;

    this.outstanding.add(sliceName);
    this.stats.requestsDispatched++;
    this._publishStatus(sliceName, "loading");

    const self = this;

    // The adapter using fetch HERE is the legitimate host-API site.
    Promise.resolve(this.fetch(e.url, {
      method: e.method,
      headers: e.headers
    })).then(function (response) {
      // response is a Response-like object; for our minimal port, assume
      // .ok and .json()
      if (!response || !response.ok) {
        self._handleError(sliceName, "http-not-ok");
        return;
      }
      return Promise.resolve(response.json());
    }).then(function (body) {
      if (body === undefined) return;  // error handled
      self._handleResponse(sliceName, body);
    }).catch(function (err) {
      self._handleError(sliceName, err && err.message ? err.message : String(err));
    });
  }

  _handleResponse(sliceName, body) {
    this.outstanding.delete(sliceName);
    this.stats.responsesReceived++;

    // Publish response as a contributor record. Type uses the network::
    // prefix per the bridge convention so it projects to data-<sliceName>.
    this.publisher.publish({
      type: "network::" + sliceName,
      value: body,
      source: SOURCE_NAME
    });

    // Publish status
    this._publishStatus(sliceName, "ok");
  }

  _handleError(sliceName, errorMessage) {
    this.outstanding.delete(sliceName);
    this.stats.errorsEncountered++;

    this.publisher.publish({
      type: "network::" + sliceName + "-error",
      value: errorMessage,
      source: SOURCE_NAME
    });

    this._publishStatus(sliceName, "error");
  }

  _publishStatus(sliceName, status) {
    this.publisher.publish({
      type: "network::" + sliceName + "-status",
      value: status,
      source: SOURCE_NAME
    });
  }
}

module.exports = Object.freeze({
  NetworkAdapter: NetworkAdapter,
  SOURCE_NAME: SOURCE_NAME,
  CONFIG: CONFIG
});
