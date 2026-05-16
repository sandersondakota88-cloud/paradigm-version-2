// chain-transport-binding.js - Phase 8 M2 - SE-10 chain transport bindings

"use strict";

// ============================================================================
// MemoryTransport
// ============================================================================
// The simplest transport. send() invokes the receive callback synchronously
// in the same tick. Used as the baseline for byte-equivalence verification:
// the chain's terminal artifact via memory transport must match direct
// in-process composition exactly.
// ============================================================================

class MemoryTransport {
  constructor() {
    this.kind = "memory";
    this._receiveCallbacks = [];
    this._stats = { sent: 0, received: 0, errors: 0 };
    this._closed = false;
  }

  send(framedBytes) {
    if (this._closed) {
      this._stats.errors++;
      return Promise.reject(new Error("MemoryTransport: closed"));
    }
    if (typeof framedBytes !== "string") {
      this._stats.errors++;
      return Promise.reject(new TypeError(
        "MemoryTransport: framedBytes must be string"));
    }
    this._stats.sent++;
    // Synchronously deliver to subscribers. Memory transport's whole point
    // is zero latency for baseline equivalence checking.
    for (const cb of this._receiveCallbacks) {
      try {
        cb(framedBytes);
        this._stats.received++;
      } catch (e) {
        this._stats.errors++;
      }
    }
    return Promise.resolve();
  }

  onReceive(callback) {
    if (typeof callback !== "function") {
      throw new TypeError("onReceive: callback must be a function");
    }
    this._receiveCallbacks.push(callback);
    const self = this;
    return {
      unsubscribe() {
        const i = self._receiveCallbacks.indexOf(callback);
        if (i >= 0) self._receiveCallbacks.splice(i, 1);
      }
    };
  }

  observe() {
    return Object.assign({ kind: this.kind }, this._stats);
  }

  close() {
    this._closed = true;
    this._receiveCallbacks = [];
  }
}

// ============================================================================
// LoopbackTransport (paired)
// ============================================================================
// Two LoopbackTransport instances are paired: send() on one delivers to the
// receive callback of the other. Models cross-process / cross-tab semantics
// without requiring real network.
//
// Use case: link 1 in "tab A", link 2 in "tab B". Tab A holds the upstream
// transport; Tab B holds the downstream. Bytes sent by upstream arrive at
// downstream's receive subscribers.
// ============================================================================

class LoopbackTransport {
  constructor() {
    this.kind = "loopback";
    this._receiveCallbacks = [];
    this._peer = null;
    this._stats = { sent: 0, received: 0, errors: 0 };
    this._closed = false;
  }

  // Returns a NEW peer LoopbackTransport. The returned peer's send() will
  // deliver to THIS instance's onReceive subscribers. Symmetric.
  static pair() {
    const a = new LoopbackTransport();
    const b = new LoopbackTransport();
    a._peer = b;
    b._peer = a;
    return [a, b];
  }

  send(framedBytes) {
    if (this._closed || !this._peer) {
      this._stats.errors++;
      return Promise.reject(new Error("LoopbackTransport: closed or unpaired"));
    }
    if (typeof framedBytes !== "string") {
      this._stats.errors++;
      return Promise.reject(new TypeError(
        "LoopbackTransport: framedBytes must be string"));
    }
    this._stats.sent++;
    // Deliver async to model cross-process semantics: receiver sees the
    // bytes on a future tick, not in the same call frame.
    const peer = this._peer;
    return new Promise(function (resolve) {
      // setTimeout(..., 0) puts delivery on the next tick. setImmediate
      // works in Node; setTimeout is the cross-environment fallback.
      const dispatch = function () {
        for (const cb of peer._receiveCallbacks) {
          try {
            cb(framedBytes);
            peer._stats.received++;
          } catch (e) {
            peer._stats.errors++;
          }
        }
        resolve();
      };
      if (typeof setImmediate === "function") {
        setImmediate(dispatch);
      } else {
        setTimeout(dispatch, 0);
      }
    });
  }

  onReceive(callback) {
    if (typeof callback !== "function") {
      throw new TypeError("onReceive: callback must be a function");
    }
    this._receiveCallbacks.push(callback);
    const self = this;
    return {
      unsubscribe() {
        const i = self._receiveCallbacks.indexOf(callback);
        if (i >= 0) self._receiveCallbacks.splice(i, 1);
      }
    };
  }

  observe() {
    return Object.assign({
      kind: this.kind,
      paired: !!this._peer
    }, this._stats);
  }

  close() {
    this._closed = true;
    this._receiveCallbacks = [];
  }
}

// ============================================================================
// BroadcastChannelTransport
// ============================================================================
// Uses the browser's BroadcastChannel API to ship bytes across tabs of the
// same origin. Each transport instance binds to a named channel; sends go
// to all other listeners on the same name.
//
// The channelFactory lets tests inject a mock BroadcastChannel without
// depending on global BroadcastChannel availability.
// ============================================================================

class BroadcastChannelTransport {
  constructor(opts) {
    opts = opts || {};
    this.kind = "broadcast-channel";

    if (typeof opts.channelName !== "string" || opts.channelName.length === 0) {
      throw new TypeError(
        "BroadcastChannelTransport: opts.channelName required");
    }
    this._channelName = opts.channelName;

    const factory = opts.channelFactory ||
      (typeof BroadcastChannel !== "undefined" ?
        function (n) { return new BroadcastChannel(n); } : null);
    if (typeof factory !== "function") {
      throw new Error(
        "BroadcastChannelTransport: BroadcastChannel not available; " +
        "inject opts.channelFactory");
    }
    this._channel = factory(this._channelName);

    this._receiveCallbacks = [];
    this._stats = { sent: 0, received: 0, errors: 0 };
    this._closed = false;

    const self = this;
    if (typeof this._channel.addEventListener === "function") {
      this._messageHandler = function (e) {
        const data = e && e.data;
        if (typeof data !== "string") return;
        for (const cb of self._receiveCallbacks) {
          try {
            cb(data);
            self._stats.received++;
          } catch (err) {
            self._stats.errors++;
          }
        }
      };
      this._channel.addEventListener("message", this._messageHandler);
    } else if (typeof this._channel.onmessage !== "undefined") {
      this._channel.onmessage = function (e) {
        const data = e && e.data;
        if (typeof data !== "string") return;
        for (const cb of self._receiveCallbacks) {
          try {
            cb(data);
            self._stats.received++;
          } catch (err) {
            self._stats.errors++;
          }
        }
      };
    }
  }

  send(framedBytes) {
    if (this._closed) {
      this._stats.errors++;
      return Promise.reject(new Error("BroadcastChannelTransport: closed"));
    }
    if (typeof framedBytes !== "string") {
      this._stats.errors++;
      return Promise.reject(new TypeError(
        "BroadcastChannelTransport: framedBytes must be string"));
    }
    try {
      this._channel.postMessage(framedBytes);
      this._stats.sent++;
      return Promise.resolve();
    } catch (e) {
      this._stats.errors++;
      return Promise.reject(e);
    }
  }

  onReceive(callback) {
    if (typeof callback !== "function") {
      throw new TypeError("onReceive: callback must be a function");
    }
    this._receiveCallbacks.push(callback);
    const self = this;
    return {
      unsubscribe() {
        const i = self._receiveCallbacks.indexOf(callback);
        if (i >= 0) self._receiveCallbacks.splice(i, 1);
      }
    };
  }

  observe() {
    return Object.assign({
      kind: this.kind,
      channelName: this._channelName
    }, this._stats);
  }

  close() {
    this._closed = true;
    if (this._channel && typeof this._channel.close === "function") {
      this._channel.close();
    }
    this._receiveCallbacks = [];
  }
}

module.exports = Object.freeze({
  MemoryTransport: MemoryTransport,
  LoopbackTransport: LoopbackTransport,
  BroadcastChannelTransport: BroadcastChannelTransport
});
