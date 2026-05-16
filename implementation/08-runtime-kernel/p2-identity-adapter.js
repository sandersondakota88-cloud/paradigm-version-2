// p2-identity-adapter.js - Phase 8 P2 - Identity as SE-08 contributor

"use strict";

const SOURCE_NAME = "identity-adapter";

const VALID_ROLES = ["admin", "manager", "rep", "viewer"];
const VALID_VALIDITY = ["valid", "expired", "none"];

const CONFIG = Object.freeze({
  EXPIRY_POLL_MS: 5000   // 0.2 Hz; session changes are infrequent
});

class IdentityAdapter {
  constructor(opts) {
    opts = opts || {};
    this.config = Object.assign({}, CONFIG, opts.config || {});

    if (!opts.publisher) {
      throw new Error("p2-identity-adapter: publisher is required");
    }
    this.publisher = opts.publisher;

    // sessionSource is an injectable that returns the current session
    // (or null/undefined for "no session"). In tests, a stub. In a
    // deposition, wraps an OAuth client or cookie reader. The adapter
    // does NOT call into the session source's internals; it only reads
    // its current state.
    this.sessionSource = opts.sessionSource || null;

    this._setInterval = opts.setInterval ||
      (typeof setInterval !== "undefined" ? setInterval : null);
    this._clearInterval = opts.clearInterval ||
      (typeof clearInterval !== "undefined" ? clearInterval : null);

    this._pollTimer = null;
    this._stopped = false;
    this._lastPublishedSession = null;  // for change detection (S1: avoid redundant publishes)

    this.stats = {
      sessionsPublished: 0,
      logoutsPublished: 0,
      expiryDetected: 0,
      validationFailures: 0
    };
  }

  // --------------------------------------------------------------------
  // Lifecycle (optional, for sessionSource polling)
  // --------------------------------------------------------------------
  start() {
    if (this._pollTimer) return;
    if (this._stopped) return;
    if (!this.sessionSource) return;  // no source -> no polling
    if (!this._setInterval) {
      throw new Error("p2-identity-adapter: setInterval not available");
    }
    // Initial poll so the field has the current session at boot
    this._pollSession();
    const self = this;
    this._pollTimer = this._setInterval(function () {
      try {
        self._pollSession();
      } catch (e) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[p2-identity-adapter] poll error:", e.message);
        }
      }
    }, this.config.EXPIRY_POLL_MS);
  }

  stop() {
    if (this._pollTimer && this._clearInterval) {
      this._clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    this._stopped = true;
  }

  // --------------------------------------------------------------------
  // Externally-driven: set session (login or token refresh)
  // --------------------------------------------------------------------
  setSession(session) {
    if (!session) {
      this.clearSession();
      return;
    }
    if (!this._validSessionShape(session)) {
      this.stats.validationFailures++;
      return;
    }
    // Avoid redundant publishes (S1: no redundant intake records)
    if (this._sameSession(session, this._lastPublishedSession)) return;

    this.publisher.publish({
      type: "user-id",
      value: session.user_id,
      source: SOURCE_NAME
    });
    this.publisher.publish({
      type: "user-role",
      value: session.role,
      source: SOURCE_NAME
    });
    this.publisher.publish({
      type: "session-validity",
      value: session.expired ? "expired" : "valid",
      source: SOURCE_NAME
    });

    this._lastPublishedSession = {
      user_id: session.user_id,
      role: session.role,
      expired: !!session.expired
    };
    this.stats.sessionsPublished++;
  }

  // --------------------------------------------------------------------
  // Logout: clear identity coords
  // --------------------------------------------------------------------
  clearSession() {
    if (this._lastPublishedSession === null) return;  // already cleared
    this.publisher.publish({
      type: "user-id", value: "", source: SOURCE_NAME
    });
    this.publisher.publish({
      type: "user-role", value: "", source: SOURCE_NAME
    });
    this.publisher.publish({
      type: "session-validity", value: "none", source: SOURCE_NAME
    });
    this._lastPublishedSession = null;
    this.stats.logoutsPublished++;
  }

  // --------------------------------------------------------------------
  // Periodic expiry check via sessionSource
  // --------------------------------------------------------------------
  _pollSession() {
    if (!this.sessionSource) return;
    let current;
    try {
      current = this.sessionSource.getCurrentSession();
    } catch (e) {
      // Source error: do not propagate; F3
      return;
    }
    if (!current) {
      this.clearSession();
      return;
    }
    // Detect expiry transition: previously valid, now expired
    if (this._lastPublishedSession &&
        this._lastPublishedSession.user_id === current.user_id &&
        !this._lastPublishedSession.expired &&
        current.expired) {
      this.stats.expiryDetected++;
    }
    this.setSession(current);
  }

  // --------------------------------------------------------------------
  // Internal validation
  // --------------------------------------------------------------------
  _validSessionShape(s) {
    if (!s || typeof s !== "object") return false;
    if (typeof s.user_id !== "string" || s.user_id.length === 0) return false;
    if (typeof s.role !== "string") return false;
    if (VALID_ROLES.indexOf(s.role) < 0) return false;
    return true;
  }

  _sameSession(a, b) {
    if (!a || !b) return false;
    return a.user_id === b.user_id &&
           a.role === b.role &&
           !!a.expired === !!b.expired;
  }
}

module.exports = Object.freeze({
  IdentityAdapter: IdentityAdapter,
  SOURCE_NAME: SOURCE_NAME,
  VALID_ROLES: VALID_ROLES,
  VALID_VALIDITY: VALID_VALIDITY,
  CONFIG: CONFIG
});
