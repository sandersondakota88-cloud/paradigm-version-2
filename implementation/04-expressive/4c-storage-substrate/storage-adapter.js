// storage-adapter.js - Persistent storage substrate (Phase 4c)

(function (global) {
"use strict";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const STORAGE_CFG = Object.freeze({
  DB_NAME: "vsf-paradigm-store",
  DB_VERSION: 1,                      // increment to trigger migration
  CONSTRAINTS_STORE: "constraints",
  SUBCASCADES_STORE: "subcascades",
  TRACE_STORE: "trace",
  SURFACE_STORE: "surfaceClauses",
  META_STORE: "meta",
  RECALL_WINDOW_DEFAULT: 50,          // records read per recall query
  CONSTRAINTS_CAP: 5000,              // soft cap; oldest-evicted on excess
  TRACE_CAP: 8000,
  SURFACE_CAP: 3000
});

// ---------------------------------------------------------------------------
// In-memory backend (used in Node test environment)
//
// Implements a subset of IndexedDB's surface that the adapter needs.
// All methods are async to match the IndexedDB-backed adapter.
// ---------------------------------------------------------------------------

class InMemoryBackend {
  constructor() {
    this.stores = {
      constraints: [],
      subcascades: [],
      trace: [],
      surfaceClauses: [],
      meta: []
    };
    this.opened = false;
  }

  async open() {
    this.opened = true;
    return true;
  }

  async put(storeName, record) {
    if (!this.opened) throw new Error("backend not opened");
    if (!this.stores[storeName]) throw new Error("unknown store: " + storeName);
    // Replace by id if present, else append
    const arr = this.stores[storeName];
    const idx = arr.findIndex(r => r.id === record.id);
    if (idx >= 0) arr[idx] = record;
    else arr.push(record);
    return record.id || true;
  }

  async getAll(storeName, opts) {
    if (!this.opened) throw new Error("backend not opened");
    if (!this.stores[storeName]) throw new Error("unknown store: " + storeName);
    let arr = this.stores[storeName].slice();
    if (opts && opts.minPersistedAt != null) {
      arr = arr.filter(r => (r.persistedAt || 0) >= opts.minPersistedAt);
    }
    if (opts && opts.maxPersistedAt != null) {
      arr = arr.filter(r => (r.persistedAt || 0) <= opts.maxPersistedAt);
    }
    if (opts && opts.limit != null) {
      // Most-recent first by persistedAt
      arr.sort((a, b) => (b.persistedAt || 0) - (a.persistedAt || 0));
      arr = arr.slice(0, opts.limit);
    }
    return arr;
  }

  async count(storeName) {
    if (!this.opened) throw new Error("backend not opened");
    return (this.stores[storeName] || []).length;
  }

  async deleteOlderThan(storeName, persistedAt) {
    if (!this.opened) throw new Error("backend not opened");
    const arr = this.stores[storeName];
    if (!arr) return 0;
    let removed = 0;
    for (let i = arr.length - 1; i >= 0; i -= 1) {
      if ((arr[i].persistedAt || 0) < persistedAt) {
        arr.splice(i, 1);
        removed += 1;
      }
    }
    return removed;
  }

  async clear() {
    for (const k of Object.keys(this.stores)) {
      this.stores[k] = [];
    }
    return true;
  }

  async close() {
    this.opened = false;
    return true;
  }
}

// ---------------------------------------------------------------------------
// IndexedDB backend
//
// Wraps the IndexedDB API in a promise-returning interface matching
// InMemoryBackend. Uses transactions per operation; the architecture's
// frame-paced rhythm means coarse-grained transactions are appropriate.
// ---------------------------------------------------------------------------

class IndexedDBBackend {
  constructor() {
    this.db = null;
  }

  async open() {
    if (this.db) return true;
    return new Promise((resolve, reject) => {
      const req = global.indexedDB.open(STORAGE_CFG.DB_NAME, STORAGE_CFG.DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        const oldVersion = e.oldVersion || 0;
        // Migration scaffold: each version step has its own block.
        // v0 -> v1: create initial stores
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains(STORAGE_CFG.CONSTRAINTS_STORE)) {
            const cs = db.createObjectStore(STORAGE_CFG.CONSTRAINTS_STORE, { keyPath: "id" });
            cs.createIndex("by_persistedAt", "persistedAt", { unique: false });
            cs.createIndex("by_kind", "kind", { unique: false });
          }
          if (!db.objectStoreNames.contains(STORAGE_CFG.SUBCASCADES_STORE)) {
            const ss = db.createObjectStore(STORAGE_CFG.SUBCASCADES_STORE, { keyPath: "id" });
            ss.createIndex("by_persistedAt", "persistedAt", { unique: false });
            ss.createIndex("by_name", "name", { unique: false });
          }
          if (!db.objectStoreNames.contains(STORAGE_CFG.TRACE_STORE)) {
            const ts = db.createObjectStore(STORAGE_CFG.TRACE_STORE, { keyPath: "id", autoIncrement: true });
            ts.createIndex("by_persistedAt", "persistedAt", { unique: false });
            ts.createIndex("by_tag", "tag", { unique: false });
          }
          if (!db.objectStoreNames.contains(STORAGE_CFG.SURFACE_STORE)) {
            const fs = db.createObjectStore(STORAGE_CFG.SURFACE_STORE, { keyPath: "id", autoIncrement: true });
            fs.createIndex("by_persistedAt", "persistedAt", { unique: false });
            fs.createIndex("by_kind", "kind", { unique: false });
          }
          if (!db.objectStoreNames.contains(STORAGE_CFG.META_STORE)) {
            db.createObjectStore(STORAGE_CFG.META_STORE, { keyPath: "key" });
          }
        }
        // Future migrations (v1 -> v2, etc.) go here as conditional blocks
        // checking oldVersion < 2, etc.
      };
      req.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(true);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async put(storeName, record) {
    if (!this.db) throw new Error("backend not opened");
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.put(record);
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async getAll(storeName, opts) {
    if (!this.db) throw new Error("backend not opened");
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], "readonly");
      const store = tx.objectStore(storeName);
      let req;
      if (opts && (opts.minPersistedAt != null || opts.maxPersistedAt != null)) {
        const idx = store.index("by_persistedAt");
        let range = null;
        if (opts.minPersistedAt != null && opts.maxPersistedAt != null) {
          range = IDBKeyRange.bound(opts.minPersistedAt, opts.maxPersistedAt);
        } else if (opts.minPersistedAt != null) {
          range = IDBKeyRange.lowerBound(opts.minPersistedAt);
        } else {
          range = IDBKeyRange.upperBound(opts.maxPersistedAt);
        }
        req = idx.getAll(range);
      } else {
        req = store.getAll();
      }
      req.onsuccess = (e) => {
        let arr = e.target.result || [];
        if (opts && opts.limit != null) {
          arr.sort((a, b) => (b.persistedAt || 0) - (a.persistedAt || 0));
          arr = arr.slice(0, opts.limit);
        }
        resolve(arr);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async count(storeName) {
    if (!this.db) throw new Error("backend not opened");
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], "readonly");
      const store = tx.objectStore(storeName);
      const req = store.count();
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async deleteOlderThan(storeName, persistedAt) {
    if (!this.db) throw new Error("backend not opened");
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], "readwrite");
      const store = tx.objectStore(storeName);
      const idx = store.index("by_persistedAt");
      const range = IDBKeyRange.upperBound(persistedAt, true);  // exclusive upper
      const req = idx.openCursor(range);
      let removed = 0;
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          cursor.delete();
          removed += 1;
          cursor.continue();
        } else {
          resolve(removed);
        }
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async clear() {
    if (!this.db) throw new Error("backend not opened");
    const stores = [
      STORAGE_CFG.CONSTRAINTS_STORE, STORAGE_CFG.SUBCASCADES_STORE,
      STORAGE_CFG.TRACE_STORE, STORAGE_CFG.SURFACE_STORE,
      STORAGE_CFG.META_STORE
    ];
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(stores, "readwrite");
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e.target.error);
      for (const s of stores) tx.objectStore(s).clear();
    });
  }

  async close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    return true;
  }
}

// ---------------------------------------------------------------------------
// StorageAdapter
//
// High-level interface used by CT engine. Chooses backend based on
// environment.
// ---------------------------------------------------------------------------

class StorageAdapter {
  constructor() {
    // Choose backend: IndexedDB if available (browser), else in-memory
    if (typeof global.indexedDB !== "undefined") {
      this.backend = new IndexedDBBackend();
      this.backendKind = "indexeddb";
    } else {
      this.backend = new InMemoryBackend();
      this.backendKind = "in-memory";
    }
    this.opened = false;
  }

  async open() {
    if (this.opened) return true;
    await this.backend.open();
    this.opened = true;
    return true;
  }

  // -------------------------------------------------------------------
  // Persistence: write curated records into stores
  // -------------------------------------------------------------------

  // Persist a constraint. Caller decides eligibility; this method just
  // stores. Records get a persistedAt timestamp.
  async persistConstraint(constraint) {
    if (!this.opened) throw new Error("storage not opened");
    const record = Object.assign({}, constraint, {
      persistedAt: Date.now(),
      recallSuccessCount: constraint.recallSuccessCount || 0
    });
    return this.backend.put(STORAGE_CFG.CONSTRAINTS_STORE, record);
  }

  async persistSubcascade(subcascade) {
    if (!this.opened) throw new Error("storage not opened");
    const record = Object.assign({}, subcascade, { persistedAt: Date.now() });
    return this.backend.put(STORAGE_CFG.SUBCASCADES_STORE, record);
  }

  async persistTraceEntry(entry) {
    if (!this.opened) throw new Error("storage not opened");
    const record = Object.assign({}, entry, { persistedAt: Date.now() });
    return this.backend.put(STORAGE_CFG.TRACE_STORE, record);
  }

  async persistSurfaceClause(clause) {
    if (!this.opened) throw new Error("storage not opened");
    const record = Object.assign({}, clause, { persistedAt: Date.now() });
    return this.backend.put(STORAGE_CFG.SURFACE_STORE, record);
  }

  // -------------------------------------------------------------------
  // Recall: read window of persisted records
  //
  // Returns an array of constraint records suitable for merging into
  // the live constraint set during ER evaluation. Records carry their
  // weight history from when they were persisted.
  // -------------------------------------------------------------------

  async recallConstraints(opts) {
    if (!this.opened) throw new Error("storage not opened");
    opts = opts || {};
    const limit = opts.limit != null ? opts.limit : STORAGE_CFG.RECALL_WINDOW_DEFAULT;
    const records = await this.backend.getAll(
      STORAGE_CFG.CONSTRAINTS_STORE,
      { limit: limit }
    );
    // Mark each as recalled (provenance flag) without overwriting kind.
    // Compiler needs to dispatch on original kind; CT engine and surface
    // observe the recalled flag for downstream identification.
    return records.map(r => Object.assign({}, r, {
      recalled: true,
      recalledAt: Date.now(),
      recalledFromPersistedAt: r.persistedAt
    }));
  }

  async recallSubcascades(opts) {
    if (!this.opened) throw new Error("storage not opened");
    opts = opts || {};
    const limit = opts.limit != null ? opts.limit : STORAGE_CFG.RECALL_WINDOW_DEFAULT;
    return this.backend.getAll(STORAGE_CFG.SUBCASCADES_STORE, { limit: limit });
  }

  async recallTrace(opts) {
    if (!this.opened) throw new Error("storage not opened");
    opts = opts || {};
    const limit = opts.limit != null ? opts.limit : STORAGE_CFG.RECALL_WINDOW_DEFAULT;
    return this.backend.getAll(STORAGE_CFG.TRACE_STORE, { limit: limit });
  }

  async recallSurfaceClauses(opts) {
    if (!this.opened) throw new Error("storage not opened");
    opts = opts || {};
    const limit = opts.limit != null ? opts.limit : STORAGE_CFG.RECALL_WINDOW_DEFAULT;
    return this.backend.getAll(STORAGE_CFG.SURFACE_STORE, { limit: limit });
  }

  // -------------------------------------------------------------------
  // Maintenance: cap enforcement, clear
  // -------------------------------------------------------------------

  async enforceCaps() {
    if (!this.opened) throw new Error("storage not opened");
    const results = {};
    // Constraints
    const cCount = await this.backend.count(STORAGE_CFG.CONSTRAINTS_STORE);
    if (cCount > STORAGE_CFG.CONSTRAINTS_CAP) {
      // Get all, sort by persistedAt, keep newest CAP, delete rest
      const all = await this.backend.getAll(STORAGE_CFG.CONSTRAINTS_STORE);
      all.sort((a, b) => (a.persistedAt || 0) - (b.persistedAt || 0));
      const toDelete = all.length - STORAGE_CFG.CONSTRAINTS_CAP;
      if (toDelete > 0) {
        const cutoffPersistedAt = all[toDelete].persistedAt;
        results.constraintsRemoved = await this.backend.deleteOlderThan(
          STORAGE_CFG.CONSTRAINTS_STORE, cutoffPersistedAt
        );
      }
    }
    // Trace
    const tCount = await this.backend.count(STORAGE_CFG.TRACE_STORE);
    if (tCount > STORAGE_CFG.TRACE_CAP) {
      const all = await this.backend.getAll(STORAGE_CFG.TRACE_STORE);
      all.sort((a, b) => (a.persistedAt || 0) - (b.persistedAt || 0));
      const toDelete = all.length - STORAGE_CFG.TRACE_CAP;
      if (toDelete > 0) {
        const cutoffPersistedAt = all[toDelete].persistedAt;
        results.traceRemoved = await this.backend.deleteOlderThan(
          STORAGE_CFG.TRACE_STORE, cutoffPersistedAt
        );
      }
    }
    // Surface
    const sCount = await this.backend.count(STORAGE_CFG.SURFACE_STORE);
    if (sCount > STORAGE_CFG.SURFACE_CAP) {
      const all = await this.backend.getAll(STORAGE_CFG.SURFACE_STORE);
      all.sort((a, b) => (a.persistedAt || 0) - (b.persistedAt || 0));
      const toDelete = all.length - STORAGE_CFG.SURFACE_CAP;
      if (toDelete > 0) {
        const cutoffPersistedAt = all[toDelete].persistedAt;
        results.surfaceRemoved = await this.backend.deleteOlderThan(
          STORAGE_CFG.SURFACE_STORE, cutoffPersistedAt
        );
      }
    }
    return results;
  }

  async clear() {
    if (!this.opened) throw new Error("storage not opened");
    return this.backend.clear();
  }

  async close() {
    if (!this.opened) return true;
    await this.backend.close();
    this.opened = false;
    return true;
  }

  async getCounts() {
    if (!this.opened) throw new Error("storage not opened");
    return {
      constraints: await this.backend.count(STORAGE_CFG.CONSTRAINTS_STORE),
      subcascades: await this.backend.count(STORAGE_CFG.SUBCASCADES_STORE),
      trace: await this.backend.count(STORAGE_CFG.TRACE_STORE),
      surfaceClauses: await this.backend.count(STORAGE_CFG.SURFACE_STORE)
    };
  }
}

// ---------------------------------------------------------------------------
// Persistence eligibility
//
// Determines which records are worth persisting. Called by CT engine
// when scheduling persistence work. Exposed as standalone functions so
// the rules are readable and testable in isolation.
// ---------------------------------------------------------------------------

const PersistenceEligibility = {
  // Constraint: persist if ratified, promoted compound, family-meta, or seed
  shouldPersistConstraint: function (c) {
    if (!c) return false;
    if (c.kind === "ratified") return true;
    if (c.kind === "compound" && c.promoted === true) return true;
    if (c.kind === "meta" && c.metaKind === "family") return true;
    // Seed is structural; persist for cross-session continuity of identity
    if (c.kind === "seed") return true;
    return false;
  },

  // Trace entry: persist if tagged
  shouldPersistTraceEntry: function (e) {
    if (!e) return false;
    if (!e.tag) return false;
    // Recall-related tags do NOT persist (bounded recursion: we do not
    // record observations of recall events in the recallable trace)
    if (e.tag === "recalled" || e.tag === "re-encountered") return false;
    return true;
  },

  // Surface clause: persist all clauses (the surface is curated by
  // construction). Exception: clauses about recall events do not
  // persist (bounded recursion).
  shouldPersistSurfaceClause: function (c) {
    if (!c) return false;
    if (c.kind === "recalled" || c.kind === "re-encountered") return false;
    return true;
  }
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

const StorageAdapterModule = Object.freeze({
  StorageAdapter: StorageAdapter,
  InMemoryBackend: InMemoryBackend,
  IndexedDBBackend: IndexedDBBackend,
  STORAGE_CFG: STORAGE_CFG,
  PersistenceEligibility: PersistenceEligibility
});

if (typeof module !== "undefined" && module.exports) {
  module.exports = StorageAdapterModule;
} else {
  global.StorageAdapterModule = StorageAdapterModule;
}

})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));
