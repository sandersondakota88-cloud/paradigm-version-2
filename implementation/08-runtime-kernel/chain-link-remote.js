// chain-link-remote.js - Phase 8 M2 - chain link over transport binding

"use strict";

const Codec = require("./vsf-codec-min.js");

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_OUTSTANDING = 16;

// ============================================================================
// makeRemoteLink: caller-side
// ============================================================================

function makeRemoteLink(opts) {
  if (!opts || typeof opts !== "object") {
    throw new TypeError("makeRemoteLink: opts required");
  }
  if (typeof opts.id !== "string" || opts.id.length === 0) {
    throw new TypeError("makeRemoteLink: opts.id required");
  }
  if (!opts.transport || typeof opts.transport.send !== "function" ||
      typeof opts.transport.onReceive !== "function") {
    throw new TypeError("makeRemoteLink: opts.transport with send/onReceive required");
  }
  if (typeof opts.chainId !== "string" || opts.chainId.length === 0) {
    throw new TypeError("makeRemoteLink: opts.chainId required");
  }
  if (typeof opts.linkIdx !== "number" || !isFinite(opts.linkIdx)) {
    throw new TypeError("makeRemoteLink: opts.linkIdx required");
  }
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
  const maxOutstanding = opts.maxOutstanding || DEFAULT_MAX_OUTSTANDING;

  const transport = opts.transport;
  const chainId = opts.chainId;
  const linkIdx = opts.linkIdx;

  let producedCounter = 0;
  const pending = new Map();   // produced -> {resolve, reject, timeoutHandle}

  // Single subscription on the transport; route by produced id
  transport.onReceive(function (framedBytes) {
    const decoded = Codec.decode(framedBytes);
    if (!decoded.ok) return;   // ignore; we don't supervise the transport
    const f = decoded.frame;
    if (f.chainId !== chainId) return;
    if (f.linkIdx !== linkIdx) return;
    // Reply for one of our outstanding requests?
    const entry = pending.get(f.produced);
    if (!entry) return;
    pending.delete(f.produced);
    if (entry.timeoutHandle) clearTimeout(entry.timeoutHandle);
    // Reply's artifact carries contributions+metadata
    const reply = f.artifact;
    if (reply && Array.isArray(reply.contributions)) {
      entry.resolve({
        contributions: reply.contributions,
        metadata: reply.metadata || null
      });
    } else {
      entry.reject(new Error("remote-link: malformed reply"));
    }
  });

  function applyAsync(artifact) {
    if (pending.size >= maxOutstanding) {
      return Promise.reject(new Error(
        "remote-link: too many outstanding requests (cap=" + maxOutstanding + ")"));
    }
    producedCounter++;
    const produced = producedCounter;

    let framed;
    try {
      framed = Codec.encode({
        chainId: chainId,
        linkIdx: linkIdx,
        produced: produced,
        artifact: artifact
      });
    } catch (e) {
      return Promise.reject(e);
    }

    return new Promise(function (resolve, reject) {
      const timeoutHandle = setTimeout(function () {
        if (pending.has(produced)) {
          pending.delete(produced);
          reject(new Error("remote-link: timeout after " + timeoutMs + "ms"));
        }
      }, timeoutMs);
      pending.set(produced, {
        resolve: resolve,
        reject: reject,
        timeoutHandle: timeoutHandle
      });
      transport.send(framed).catch(function (e) {
        if (pending.has(produced)) {
          pending.delete(produced);
          clearTimeout(timeoutHandle);
          reject(e);
        }
      });
    });
  }

  return {
    id: opts.id,
    isRemote: true,
    chainId: chainId,
    linkIdx: linkIdx,
    transport: transport,
    applyAsync: applyAsync,
    // Synchronous apply intentionally absent: composer's runAsync()
    // is required for chains containing remote links.
    pending: pending,
    observe() {
      return {
        producedTotal: producedCounter,
        outstanding: pending.size
      };
    }
  };
}

// ============================================================================
// attachRemoteWorker: worker-side
// ============================================================================
// On the worker side of the transport, listen for incoming artifact frames,
// run the underlying link's apply() against them, send contributions back.
// ============================================================================

function attachRemoteWorker(opts) {
  if (!opts || typeof opts !== "object") {
    throw new TypeError("attachRemoteWorker: opts required");
  }
  if (!opts.transport || typeof opts.transport.send !== "function" ||
      typeof opts.transport.onReceive !== "function") {
    throw new TypeError("attachRemoteWorker: opts.transport required");
  }
  if (!opts.link || typeof opts.link.apply !== "function") {
    throw new TypeError("attachRemoteWorker: opts.link with apply() required");
  }
  if (typeof opts.chainId !== "string" || opts.chainId.length === 0) {
    throw new TypeError("attachRemoteWorker: opts.chainId required");
  }
  if (typeof opts.linkIdx !== "number" || !isFinite(opts.linkIdx)) {
    throw new TypeError("attachRemoteWorker: opts.linkIdx required");
  }

  const transport = opts.transport;
  const link = opts.link;
  const chainId = opts.chainId;
  const linkIdx = opts.linkIdx;

  const stats = {
    received: 0,
    applied: 0,
    rejected: 0,
    sentReplies: 0,
    errors: 0
  };

  const subscription = transport.onReceive(function (framedBytes) {
    stats.received++;
    const decoded = Codec.decode(framedBytes);
    if (!decoded.ok) { stats.rejected++; return; }
    const f = decoded.frame;
    if (f.chainId !== chainId) return;
    if (f.linkIdx !== linkIdx) return;
    // Skip reply frames (those have `contributions` in artifact). Worker
    // only handles request frames (artifact is a chain-composer artifact
    // with `rows` and `header`).
    if (!f.artifact || !Array.isArray(f.artifact.rows)) return;

    let applyResult;
    try {
      applyResult = link.apply(f.artifact);
    } catch (e) {
      stats.errors++;
      // F3: don't propagate engine errors to caller; reply with empty
      // contributions and metadata.error
      applyResult = { contributions: [], metadata: { error: e.message } };
    }
    if (!applyResult || !Array.isArray(applyResult.contributions)) {
      stats.errors++;
      applyResult = { contributions: [], metadata: { error: "malformed-apply-result" } };
    }
    stats.applied++;

    // Build reply frame: same chainId/linkIdx/produced, artifact field
    // carries {contributions, metadata} reply shape
    let replyBytes;
    try {
      replyBytes = Codec.encode({
        chainId: chainId,
        linkIdx: linkIdx,
        produced: f.produced,
        artifact: {
          contributions: applyResult.contributions,
          metadata: applyResult.metadata || null
        }
      });
    } catch (e) {
      stats.errors++;
      return;
    }
    transport.send(replyBytes).then(function () {
      stats.sentReplies++;
    }).catch(function () {
      stats.errors++;
    });
  });

  return {
    chainId: chainId,
    linkIdx: linkIdx,
    detach() {
      if (subscription && typeof subscription.unsubscribe === "function") {
        subscription.unsubscribe();
      }
    },
    observe() {
      return Object.assign({}, stats);
    }
  };
}

module.exports = Object.freeze({
  makeRemoteLink: makeRemoteLink,
  attachRemoteWorker: attachRemoteWorker,
  DEFAULT_TIMEOUT_MS: DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_OUTSTANDING: DEFAULT_MAX_OUTSTANDING
});
