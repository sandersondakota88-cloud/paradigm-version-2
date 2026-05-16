// preparative-storage.js - representational mapping layer

"use strict";

// ============================================================================
// Constants
// ============================================================================

const DB_NAME = "preparative-substrate";
const DB_VERSION = 1;

const STORE_MAPS   = "preparative_maps";
const STORE_TRACES = "preparative_traces";

// Bounded caps (I5)
const MAX_MAP_RECORD_BYTES   = 1024 * 1024;       // 1 MiB per map
const MAX_TRACE_RECORD_BYTES = 16 * 1024;          // 16 KiB per trace
const MAX_TRACES_PER_SOURCE  = 256;                // retention per source

// SHA-256 hex pattern (validates sourceHash inputs)
const SHA256_RE = /^[0-9a-f]{64}$/;

// ============================================================================
// Validation helpers
// ============================================================================

function asciiOnly(s) {
  if (typeof s !== "string") return false;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x09 || (c > 0x0D && c < 0x20) || c > 0x7E) return false;
  }
  return true;
}

function requireSourceHash(s, where) {
  if (typeof s !== "string" || !SHA256_RE.test(s)) {
    throw new TypeError("invalid sourceHash at " + where);
  }
  return s;
}

function requireFiniteInt(v, name) {
  if (typeof v !== "number" || !Number.isFinite(v) || Math.floor(v) !== v) {
    throw new TypeError(name + " must be finite int");
  }
  return v;
}

function requireFiniteNumber(v, name) {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new TypeError(name + " must be finite number");
  }
  return v;
}

// Validate a preparative map record: structural invariants + ASCII.
// Throws TypeError on any violation.
function validateMapRecord(rec) {
  if (!rec || typeof rec !== "object") {
    throw new TypeError("map record must be object");
  }
  requireSourceHash(rec.sourceHash, "rec.sourceHash");
  if (typeof rec.version !== "string" || rec.version.length === 0) {
    throw new TypeError("rec.version must be non-empty string");
  }
  if (!asciiOnly(rec.version)) {
    throw new TypeError("rec.version must be ASCII (I1)");
  }
  requireFiniteInt(rec.sourceBytes, "rec.sourceBytes");
  requireFiniteInt(rec.tokensSeen, "rec.tokensSeen");
  requireFiniteInt(rec.textTokensSeen, "rec.textTokensSeen");
  if (typeof rec.sealed !== "boolean") {
    throw new TypeError("rec.sealed must be boolean");
  }
  if (typeof rec.sealHash !== "string") {
    throw new TypeError("rec.sealHash must be string");
  }
  if (!Array.isArray(rec.entries)) {
    throw new TypeError("rec.entries must be array");
  }
  for (let i = 0; i < rec.entries.length; i++) {
    const e = rec.entries[i];
    if (!e || typeof e !== "object") {
      throw new TypeError("rec.entries[" + i + "] must be object");
    }
    if (typeof e.text !== "string" || !asciiOnly(e.text)) {
      throw new TypeError("rec.entries[" + i + "].text must be ASCII");
    }
    if (typeof e.derivedKind !== "string" || !asciiOnly(e.derivedKind)) {
      throw new TypeError("rec.entries[" + i + "].derivedKind must be ASCII");
    }
    requireFiniteNumber(e.distinctiveness, "rec.entries[" + i + "].distinctiveness");
    requireFiniteInt(e.occurrenceCount, "rec.entries[" + i + "].occurrenceCount");
  }
  // size cap
  const serialized = JSON.stringify(rec);
  if (!asciiOnly(serialized)) {
    throw new TypeError("serialized map must be ASCII (I1)");
  }
  if (serialized.length > MAX_MAP_RECORD_BYTES) {
    throw new TypeError("map record exceeds " + MAX_MAP_RECORD_BYTES + " bytes (I5)");
  }
  return rec;
}

function validateTraceRecord(rec) {
  if (!rec || typeof rec !== "object") {
    throw new TypeError("trace record must be object");
  }
  requireFiniteInt(rec.opId, "rec.opId");
  if (rec.opId < 1) {
    throw new TypeError("rec.opId must be >= 1");
  }
  requireSourceHash(rec.sourceHash, "rec.sourceHash");
  if (typeof rec.op !== "string" || !asciiOnly(rec.op) || rec.op.length === 0) {
    throw new TypeError("rec.op must be non-empty ASCII string");
  }
  requireFiniteInt(rec.step, "rec.step");
  requireFiniteNumber(rec.delta, "rec.delta");
  requireFiniteInt(rec.timestamp, "rec.timestamp");
  if (rec.detail !== undefined && rec.detail !== null) {
    if (typeof rec.detail !== "object") {
      throw new TypeError("rec.detail must be object or null");
    }
  }
  const serialized = JSON.stringify(rec);
  if (!asciiOnly(serialized)) {
    throw new TypeError("serialized trace must be ASCII (I1)");
  }
  if (serialized.length > MAX_TRACE_RECORD_BYTES) {
    throw new TypeError("trace record exceeds " + MAX_TRACE_RECORD_BYTES + " bytes (I5)");
  }
  return rec;
}

// ============================================================================
// Map record builder
// ============================================================================
//
// Takes a preparative map (as produced by the preparative substrate's
// buildPreparativeMap function) and produces a fully-formed map record
// suitable for storage. The substrate's buildPreparativeMap produces a
// map without timestamp; the storage layer fills in the timestamp at
// write time. Same with sealed/sealHash, which the storage layer asks
// for from the substrate.
// ============================================================================

function makeMapRecord(preparativeMap, opts) {
  opts = opts || {};
  const ts = (typeof opts.timestamp === "number") ? opts.timestamp : Date.now();
  const sealed = !!opts.sealed;
  const sealHash = (typeof opts.sealHash === "string") ? opts.sealHash : "";
  const rec = {
    sourceHash: preparativeMap.sourceHash,
    version: preparativeMap.version,
    sourceBytes: preparativeMap.sourceBytes,
    seed: preparativeMap.seed,
    timestamp: ts,
    tokensSeen: preparativeMap.tokensSeen,
    textTokensSeen: preparativeMap.textTokensSeen,
    sealed: sealed,
    sealHash: sealHash,
    entries: preparativeMap.entries
  };
  return validateMapRecord(rec);
}

// ============================================================================
// In-memory storage adapter
// ============================================================================
//
// Implements the storage contract using plain JS objects. Used for
// tests and for ephemeral sessions where no IndexedDB backing exists.
// All operations are synchronous in implementation but exposed as
// Promises to match the IDB adapter's surface (so the contract is
// substrate-equivalent across backings).
// ============================================================================

function createInMemoryStorage(opts) {
  opts = opts || {};
  const maps   = Object.create(null);    // sourceHash -> map record
  const traces = [];                     // ordered by opId asc
  let nextOpId = 1;

  function getNextOpId() {
    return nextOpId++;
  }

  return Object.freeze({
    backing: "in-memory",

    // -------- maps --------

    async getMap(sourceHash) {
      requireSourceHash(sourceHash, "getMap");
      const rec = maps[sourceHash];
      return rec ? Object.freeze(JSON.parse(JSON.stringify(rec))) : null;
    },

    async putMap(rec) {
      const validated = validateMapRecord(rec);
      // Deep-clone to prevent later mutation of the caller's object
      maps[validated.sourceHash] = JSON.parse(JSON.stringify(validated));
      return validated.sourceHash;
    },

    async deleteMap(sourceHash) {
      requireSourceHash(sourceHash, "deleteMap");
      const had = !!maps[sourceHash];
      delete maps[sourceHash];
      return had;
    },

    async listMapHashes() {
      return Object.keys(maps).sort();
    },

    // -------- traces --------

    async appendTrace(rec) {
      // Caller may omit opId; we assign monotonically.
      const filled = Object.assign({}, rec);
      if (typeof filled.opId !== "number") filled.opId = getNextOpId();
      else if (filled.opId >= nextOpId) nextOpId = filled.opId + 1;
      if (typeof filled.timestamp !== "number") filled.timestamp = Date.now();
      validateTraceRecord(filled);
      traces.push(JSON.parse(JSON.stringify(filled)));

      // Retention: keep at most MAX_TRACES_PER_SOURCE per source hash
      const perSource = traces.filter(t => t.sourceHash === filled.sourceHash);
      if (perSource.length > MAX_TRACES_PER_SOURCE) {
        const overflow = perSource.length - MAX_TRACES_PER_SOURCE;
        // Drop oldest from this source by removing the first `overflow`
        // entries that match this sourceHash.
        let dropped = 0;
        for (let i = 0; i < traces.length && dropped < overflow; i++) {
          if (traces[i].sourceHash === filled.sourceHash) {
            traces.splice(i, 1);
            i--;
            dropped++;
          }
        }
      }
      return filled.opId;
    },

    async listTraces(sourceHash, opts) {
      requireSourceHash(sourceHash, "listTraces");
      opts = opts || {};
      const sinceOpId = (typeof opts.sinceOpId === "number") ? opts.sinceOpId : 0;
      const limit = (typeof opts.limit === "number") ? opts.limit : 1024;
      const out = [];
      for (let i = 0; i < traces.length && out.length < limit; i++) {
        const t = traces[i];
        if (t.sourceHash !== sourceHash) continue;
        if (t.opId <= sinceOpId) continue;
        out.push(Object.freeze(JSON.parse(JSON.stringify(t))));
      }
      return out;
    },

    async clearAll() {
      for (const k in maps) delete maps[k];
      traces.length = 0;
      nextOpId = 1;
    },

    // diagnostic
    _stats() {
      return Object.freeze({
        mapCount: Object.keys(maps).length,
        traceCount: traces.length,
        nextOpId: nextOpId
      });
    }
  });
}

// ============================================================================
// IndexedDB storage adapter
// ============================================================================
//
// Implements the same contract using window.indexedDB. All operations
// return Promises wrapping IDBRequest events. The DB is opened lazily
// on first use, with the schema established by onupgradeneeded.
//
// This adapter is browser-only: it requires `indexedDB` to be globally
// available. Calling it in Node will throw at adapter creation time,
// which is the right failure mode (S2 substrate-equivalence is provided
// by the in-memory adapter for non-browser environments).
// ============================================================================

function createIndexedDBStorage(opts) {
  opts = opts || {};
  const dbName = (typeof opts.dbName === "string") ? opts.dbName : DB_NAME;
  const dbVersion = (typeof opts.dbVersion === "number") ? opts.dbVersion : DB_VERSION;
  const idbHandle = opts.indexedDB || (typeof indexedDB !== "undefined" ? indexedDB : null);

  if (!idbHandle) {
    throw new Error("indexedDB not available (creating IDB adapter outside browser?)");
  }

  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      const req = idbHandle.open(dbName, dbVersion);
      req.onupgradeneeded = function (ev) {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_MAPS)) {
          db.createObjectStore(STORE_MAPS, { keyPath: "sourceHash" });
        }
        if (!db.objectStoreNames.contains(STORE_TRACES)) {
          const ts = db.createObjectStore(STORE_TRACES, { keyPath: "opId" });
          ts.createIndex("by_source", "sourceHash", { unique: false });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error("IDB open failed")); };
      req.onblocked = function () { reject(new Error("IDB open blocked")); };
    });
    return dbPromise;
  }

  function txPromise(storeNames, mode, fn) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(storeNames, mode);
        let result;
        tx.oncomplete = function () { resolve(result); };
        tx.onerror = function () { reject(tx.error || new Error("tx error")); };
        tx.onabort = function () { reject(tx.error || new Error("tx aborted")); };
        try {
          // The fn may set `result` synchronously based on request callbacks.
          result = fn(tx);
        } catch (e) {
          try { tx.abort(); } catch (_) { /* swallow */ }
          reject(e);
        }
      });
    });
  }

  function reqAsPromise(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error("request error")); };
    });
  }

  // Track nextOpId in-memory after first read; refreshed lazily.
  let cachedNextOpId = 0;
  async function getNextOpId() {
    if (cachedNextOpId > 0) return cachedNextOpId++;
    // Find max opId in STORE_TRACES; nextOpId = max + 1 (or 1 if empty)
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction([STORE_TRACES], "readonly");
        const store = tx.objectStore(STORE_TRACES);
        const req = store.openCursor(null, "prev");
        req.onsuccess = function () {
          const cur = req.result;
          if (cur) cachedNextOpId = cur.key + 1;
          else cachedNextOpId = 1;
          resolve(cachedNextOpId++);
        };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  return Object.freeze({
    backing: "indexeddb",

    // -------- maps --------

    getMap: function (sourceHash) {
      requireSourceHash(sourceHash, "getMap");
      return txPromise([STORE_MAPS], "readonly", function (tx) {
        const store = tx.objectStore(STORE_MAPS);
        const req = store.get(sourceHash);
        let recVal = null;
        req.onsuccess = function () { recVal = req.result || null; };
        // result is set in tx.oncomplete; we need to capture it via a
        // promise that resolves after the tx finishes
        return reqAsPromise(req).then(function (r) { return r || null; });
      });
    },

    putMap: function (rec) {
      const validated = validateMapRecord(rec);
      return txPromise([STORE_MAPS], "readwrite", function (tx) {
        const store = tx.objectStore(STORE_MAPS);
        const req = store.put(JSON.parse(JSON.stringify(validated)));
        return reqAsPromise(req).then(function () { return validated.sourceHash; });
      });
    },

    deleteMap: function (sourceHash) {
      requireSourceHash(sourceHash, "deleteMap");
      return txPromise([STORE_MAPS], "readwrite", function (tx) {
        const store = tx.objectStore(STORE_MAPS);
        const req = store.delete(sourceHash);
        return reqAsPromise(req).then(function () { return true; });
      });
    },

    listMapHashes: function () {
      return txPromise([STORE_MAPS], "readonly", function (tx) {
        const store = tx.objectStore(STORE_MAPS);
        const req = store.getAllKeys();
        return reqAsPromise(req).then(function (keys) {
          return (keys || []).slice().sort();
        });
      });
    },

    // -------- traces --------

    appendTrace: async function (rec) {
      const filled = Object.assign({}, rec);
      if (typeof filled.opId !== "number") filled.opId = await getNextOpId();
      if (typeof filled.timestamp !== "number") filled.timestamp = Date.now();
      validateTraceRecord(filled);

      // Two-step: (1) write the trace record, (2) prune retention.
      await txPromise([STORE_TRACES], "readwrite", function (tx) {
        const store = tx.objectStore(STORE_TRACES);
        const req = store.add(JSON.parse(JSON.stringify(filled)));
        return reqAsPromise(req);
      });

      // Retention prune: count traces for this source; if over cap,
      // drop the oldest by opId.
      await txPromise([STORE_TRACES], "readwrite", function (tx) {
        const store = tx.objectStore(STORE_TRACES);
        const idx = store.index("by_source");
        const countReq = idx.count(IDBKeyRange.only(filled.sourceHash));
        return reqAsPromise(countReq).then(function (count) {
          if (count <= MAX_TRACES_PER_SOURCE) return;
          const overflow = count - MAX_TRACES_PER_SOURCE;
          // Walk oldest-first via the by_source index
          return new Promise(function (resolve, reject) {
            const cursorReq = idx.openCursor(IDBKeyRange.only(filled.sourceHash), "next");
            let dropped = 0;
            cursorReq.onsuccess = function () {
              const cur = cursorReq.result;
              if (!cur || dropped >= overflow) { resolve(); return; }
              const delReq = store.delete(cur.primaryKey);
              delReq.onsuccess = function () {
                dropped++;
                cur.continue();
              };
              delReq.onerror = function () { reject(delReq.error); };
            };
            cursorReq.onerror = function () { reject(cursorReq.error); };
          });
        });
      });

      return filled.opId;
    },

    listTraces: function (sourceHash, opts) {
      requireSourceHash(sourceHash, "listTraces");
      opts = opts || {};
      const sinceOpId = (typeof opts.sinceOpId === "number") ? opts.sinceOpId : 0;
      const limit = (typeof opts.limit === "number") ? opts.limit : 1024;
      return txPromise([STORE_TRACES], "readonly", function (tx) {
        const store = tx.objectStore(STORE_TRACES);
        const idx = store.index("by_source");
        const range = IDBKeyRange.only(sourceHash);
        return new Promise(function (resolve, reject) {
          const req = idx.openCursor(range, "next");
          const out = [];
          req.onsuccess = function () {
            const cur = req.result;
            if (!cur || out.length >= limit) { resolve(out); return; }
            if (cur.value.opId > sinceOpId) {
              out.push(Object.freeze(cur.value));
            }
            cur.continue();
          };
          req.onerror = function () { reject(req.error); };
        });
      });
    },

    clearAll: function () {
      return txPromise([STORE_MAPS, STORE_TRACES], "readwrite", function (tx) {
        const m = tx.objectStore(STORE_MAPS).clear();
        const t = tx.objectStore(STORE_TRACES).clear();
        return Promise.all([reqAsPromise(m), reqAsPromise(t)]).then(function () {
          cachedNextOpId = 1;
        });
      });
    },

    _stats: function () {
      return txPromise([STORE_MAPS, STORE_TRACES], "readonly", function (tx) {
        const mc = tx.objectStore(STORE_MAPS).count();
        const tc = tx.objectStore(STORE_TRACES).count();
        return Promise.all([reqAsPromise(mc), reqAsPromise(tc)]).then(
          function (counts) {
            return Object.freeze({
              mapCount: counts[0],
              traceCount: counts[1],
              nextOpId: cachedNextOpId
            });
          }
        );
      });
    }
  });
}

// ============================================================================
// Mediator: connects a preparative substrate to a storage adapter
// ============================================================================
//
// The mediator wires a substrate's lifecycle to storage operations. It
// provides a consume-or-rebuild semantic:
//
//   ensureMap(sourceContent)  ->  if stored map exists for this source's
//                                 hash, return it; else null. The caller
//                                 decides whether to rebuild.
//   buildAndStore(substrate, sourceContent)  ->  build map from
//                                 substrate state, write to storage,
//                                 append a "map-write" trace, return
//                                 the stored map.
//
// The mediator never modifies substrate state. It reads state, writes
// records, and returns. This preserves S3 (no command path).
// ============================================================================

function createMediator(storage) {
  if (!storage) throw new TypeError("mediator requires storage adapter");
  if (typeof storage.getMap !== "function") {
    throw new TypeError("storage missing getMap");
  }
  if (typeof storage.putMap !== "function") {
    throw new TypeError("storage missing putMap");
  }
  if (typeof storage.appendTrace !== "function") {
    throw new TypeError("storage missing appendTrace");
  }

  return Object.freeze({
    storage: storage,

    async ensureMap(sourceHash) {
      requireSourceHash(sourceHash, "ensureMap");
      return await storage.getMap(sourceHash);
    },

    async buildAndStore(substrate, sourceContent) {
      if (!substrate || typeof substrate.buildPreparativeMap !== "function") {
        throw new TypeError("substrate must expose buildPreparativeMap");
      }
      if (typeof sourceContent !== "string") {
        throw new TypeError("sourceContent must be string");
      }
      const map = substrate.buildPreparativeMap(sourceContent);
      // Optionally seal the substrate before persistence; the substrate
      // returns the seal hash. Mediator does NOT call seal() automatically
      // because seal is an irreversible operation; the caller decides.
      const state = substrate.getState();
      const sealed = !!state.sealed;
      const rec = makeMapRecord(map, {
        timestamp: Date.now(),
        sealed: sealed,
        sealHash: ""  // caller can pass this through if they sealed first
      });
      await storage.putMap(rec);
      await storage.appendTrace({
        sourceHash: rec.sourceHash,
        op: "map-write",
        step: state.step,
        delta: state.delta,
        detail: {
          entries: rec.entries.length,
          tokensSeen: rec.tokensSeen,
          version: rec.version
        }
      });
      return rec;
    },

    async listSources() {
      return await storage.listMapHashes();
    },

    async traces(sourceHash, opts) {
      return await storage.listTraces(sourceHash, opts || {});
    }
  });
}

// ============================================================================
// Exports
// ============================================================================

module.exports = Object.freeze({
  // adapter factories
  createInMemoryStorage: createInMemoryStorage,
  createIndexedDBStorage: createIndexedDBStorage,
  createMediator: createMediator,
  // builders
  makeMapRecord: makeMapRecord,
  // validators (exported for tests and downstream consumers)
  validateMapRecord: validateMapRecord,
  validateTraceRecord: validateTraceRecord,
  asciiOnly: asciiOnly,
  requireSourceHash: requireSourceHash,
  // constants (exposed for diagnostics)
  DB_NAME: DB_NAME,
  DB_VERSION: DB_VERSION,
  STORE_MAPS: STORE_MAPS,
  STORE_TRACES: STORE_TRACES,
  MAX_MAP_RECORD_BYTES: MAX_MAP_RECORD_BYTES,
  MAX_TRACE_RECORD_BYTES: MAX_TRACE_RECORD_BYTES,
  MAX_TRACES_PER_SOURCE: MAX_TRACES_PER_SOURCE
});
