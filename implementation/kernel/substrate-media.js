// substrate-media.js - Phase 5.7.2 - Substrate state as media artifact

"use strict";

const crypto = require("node:crypto");

// ============================================================================
// Codec 1: STRONG - full substrate state
// ============================================================================
//
// Built on Field.serialize / Field.deserialize. Full round-trip. Includes
// the substrate's complete state, version-tagged.
// ============================================================================

const codecStrong = {
  name: "strong",
  version: 1,

  encode(substrate) {
    const json = substrate.Field.serialize();
    const data = JSON.parse(json);
    return {
      codec: "strong",
      codecVersion: 1,
      substrateId: substrate.id || "anon",
      encodedAt: Date.now(),
      fieldData: data,
      // Trace included when not too large
      trace: (substrate.Trace && substrate.Trace.entries
        ? substrate.Trace.entries.slice(0, 200) : [])
    };
  },

  decode(artifact) {
    if (!artifact || artifact.codec !== "strong") {
      throw new Error("substrate-media.codecStrong.decode: not a strong artifact");
    }
    return {
      codec: "strong",
      data: artifact,
      applyTo(substrate) {
        const json = JSON.stringify(artifact.fieldData);
        const ok = substrate.Field.deserialize(json);
        if (!ok) {
          throw new Error("strong codec: Field.deserialize rejected artifact");
        }
        // Restore trace if present (trace is observational; restoration
        // is best-effort)
        if (substrate.Trace && Array.isArray(artifact.trace)) {
          substrate.Trace.entries = artifact.trace.slice();
        }
        return substrate;
      }
    };
  }
};

// ============================================================================
// Codec 2: PROMOTED - structural shape only
// ============================================================================
//
// Captures what the substrate "knows" structurally: subcascades, high-weight
// constraints, kind-distribution. Drops one-shot details. Storage-light.
// Suitable for transmitting application shape without trajectory specifics.
// ============================================================================

const codecPromoted = {
  name: "promoted",
  version: 1,

  encode(substrate, opts) {
    opts = opts || {};
    const minWeight = opts.minWeight || 1.05;  // skip baseline-weight constraints
    const minUses = opts.minUses || 1;          // skip unused constraints

    const state = substrate.getState();
    const cs = state.constraints.filter(c =>
      c.kind === "seed" || (c.weight >= minWeight && c.uses >= minUses)
    );

    return {
      codec: "promoted",
      codecVersion: 1,
      substrateId: substrate.id || "anon",
      encodedAt: Date.now(),
      structural: {
        constraints: cs,
        subcascades: state.subcascades,
        kindCounts: countKinds(state.constraints),
        scalarDelta: state.scalarDelta,
        fastDelta: state.fastDelta,
        slowDelta: state.slowDelta,
        slowMod: state.slowMod,  // permanent layer per SE-03
        ratCount: state.ratCount,
        namedCount: state.namedCount,
        step: state.step,
        // Filter thresholds used during encoding
        minWeight: minWeight,
        minUses: minUses
      }
    };
  },

  decode(artifact) {
    if (!artifact || artifact.codec !== "promoted") {
      throw new Error("substrate-media.codecPromoted.decode: not a promoted artifact");
    }
    return {
      codec: "promoted",
      data: artifact,
      applyTo(substrate) {
        // Reset substrate to clean state, then layer on the promoted
        // structure. The seed is already present from reset; we add the
        // promoted constraints, subcascades, and modulation state.
        substrate.Field.reset();

        const s = artifact.structural;
        // Replace constraints, preserving the seed if present in the
        // artifact (otherwise the existing reset-seed remains)
        const incomingSeed = s.constraints.find(c => c.kind === "seed");
        if (incomingSeed) {
          substrate.Field.constraints = s.constraints.map(c => Object.assign({}, c));
        } else {
          // Keep the reset-installed seed; add non-seed constraints
          const keep = substrate.Field.constraints.filter(c => c.kind === "seed");
          const incoming = s.constraints.filter(c => c.kind !== "seed")
            .map(c => Object.assign({}, c));
          substrate.Field.constraints = keep.concat(incoming);
        }

        // Restore subcascades
        if (Array.isArray(s.subcascades)) {
          substrate.Field.subcascades = s.subcascades.map(sc => Object.assign({}, sc));
        }

        // Restore modulation (slow layer is permanent per SE-03)
        if (typeof s.slowMod === "number") {
          substrate.Field.slowMod = s.slowMod;
        }
        // Restore deltas (fresh-substrate behavior would re-derive these
        // through refreshVectorDelta, but seeding them gives the substrate
        // continuity from the encoded shape)
        if (typeof s.scalarDelta === "number") {
          substrate.Field.scalarDelta = s.scalarDelta;
        }
        if (typeof s.fastDelta === "number") {
          substrate.Field.fastDelta = s.fastDelta;
        }
        if (typeof s.slowDelta === "number") {
          substrate.Field.slowDelta = s.slowDelta;
        }

        // Counters
        if (typeof s.ratCount === "number") substrate.Field.ratCount = s.ratCount | 0;
        if (typeof s.namedCount === "number") substrate.Field.namedCount = s.namedCount | 0;
        // Step is intentionally NOT restored - the restored substrate
        // begins its own stepping from 0 (per F4: substrate operates
        // indefinitely; step is per-substrate-run, not per-shape)

        return substrate;
      }
    };
  }
};

function countKinds(constraints) {
  const counts = Object.create(null);
  for (const c of constraints) {
    counts[c.kind] = (counts[c.kind] || 0) + 1;
  }
  return counts;
}

// ============================================================================
// Codec 3: TRAJECTORY - sequence of snapshots
// ============================================================================
//
// Records substrate state at intervals. Preserves how the substrate moved
// through state. Each snapshot is a structural digest (lightweight).
// Restoration applies the final snapshot via promoted codec; the trajectory
// itself remains queryable for replay or analysis.
//
// Encoding API differs from strong/promoted: this codec returns a recorder
// object you call .snapshot() on as the substrate operates, then .finalize()
// to produce the artifact.
// ============================================================================

const codecTrajectory = {
  name: "trajectory",
  version: 1,

  // Begin a recording. Returns an object you call .snapshot() on at intervals.
  beginRecording(substrate, opts) {
    opts = opts || {};
    const maxSnapshots = (opts.maxSnapshots | 0) || 100;
    const snapshots = [];

    return {
      snapshot() {
        if (snapshots.length >= maxSnapshots) {
          // Drop oldest snapshot but keep the first (initial state)
          // and the last N-1
          snapshots.splice(1, 1);
        }
        const state = substrate.getState();
        snapshots.push({
          step: state.step,
          scalarDelta: state.scalarDelta,
          fastDelta: state.fastDelta,
          slowDelta: state.slowDelta,
          slowMod: state.slowMod,
          fastMod: state.fastMod,
          constraintCount: state.constraintCount,
          subcascadeCount: state.subcascades.length,
          kindCounts: countKinds(state.constraints),
          ratCount: state.ratCount,
          namedCount: state.namedCount,
          inputCount: state.inputCount,
          // Hash of the canonical structural state for trajectory novelty
          // verification (this hash matches what F5/SE-09 commits to)
          stateHash: hashStructural(state)
        });
      },

      finalize() {
        // Final snapshot uses promoted codec for full structural detail
        const finalState = codecPromoted.encode(substrate);
        return {
          codec: "trajectory",
          codecVersion: 1,
          substrateId: substrate.id || "anon",
          encodedAt: Date.now(),
          snapshots: snapshots.slice(),
          finalState: finalState
        };
      },

      get count() { return snapshots.length; }
    };
  },

  decode(artifact) {
    if (!artifact || artifact.codec !== "trajectory") {
      throw new Error("substrate-media.codecTrajectory.decode: not a trajectory artifact");
    }
    return {
      codec: "trajectory",
      data: artifact,
      // Apply restores the final state via the promoted codec
      applyTo(substrate) {
        if (!artifact.finalState) {
          throw new Error("trajectory artifact has no finalState to restore");
        }
        const finalDecoded = codecPromoted.decode(artifact.finalState);
        return finalDecoded.applyTo(substrate);
      },
      // Trajectory-specific accessor: the snapshot sequence
      getTrajectory() {
        return artifact.snapshots.slice();
      }
    };
  }
};

function hashStructural(state) {
  const cdigest = state.constraints.map(c => [
    String(c.kind || ""),
    (c.uses | 0),
    (c.lastUsed | 0)
  ].join("|")).sort().join(",");
  const payload = "kinds=" + cdigest +
    "|sd=" + state.scalarDelta +
    "|fd=" + state.fastDelta +
    "|sld=" + state.slowDelta;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

// ============================================================================
// Content addressing
// ============================================================================
//
// Every artifact's address is the SHA-256 of its canonical JSON serialization.
// Canonical = sorted keys, no whitespace, deterministic.
// ============================================================================

function computeAddress(artifact) {
  return crypto.createHash("sha256")
    .update(canonicalJson(artifact))
    .digest("hex");
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJson).join(",") + "]";
  }
  const keys = Object.keys(value).sort();
  const parts = keys.map(k => JSON.stringify(k) + ":" + canonicalJson(value[k]));
  return "{" + parts.join(",") + "}";
}

// ============================================================================
// MediaStore - IndexedDB-equivalent content-addressed storage
//
// In Node: in-memory backend. In browser: would front a real IndexedDB store
// with the same async interface. The store API is content-addressed:
// put(artifact) returns the address, get(address) returns the artifact.
// Artifacts are immutable once stored.
// ============================================================================

class InMemoryMediaBackend {
  constructor() {
    this._records = new Map();
  }
  async put(address, artifact) {
    if (this._records.has(address)) return false;  // already stored
    this._records.set(address, JSON.parse(JSON.stringify(artifact)));
    return true;
  }
  async get(address) {
    const r = this._records.get(address);
    return r ? JSON.parse(JSON.stringify(r)) : null;
  }
  async has(address) { return this._records.has(address); }
  async list() { return Array.from(this._records.keys()); }
  async delete(address) {
    const had = this._records.has(address);
    this._records.delete(address);
    return had;
  }
  async size() { return this._records.size; }
  async close() { /* no-op for in-memory */ }
}

class MediaStore {
  constructor(opts) {
    opts = opts || {};
    this.backend = opts.backend || new InMemoryMediaBackend();
  }

  // Store an artifact; returns its content address.
  async put(artifact) {
    const address = computeAddress(artifact);
    const stored = await this.backend.put(address, artifact);
    return { address: address, alreadyStored: !stored };
  }

  // Retrieve an artifact by its content address.
  async get(address) {
    return await this.backend.get(address);
  }

  async has(address) { return await this.backend.has(address); }
  async list() { return await this.backend.list(); }
  async delete(address) { return await this.backend.delete(address); }
  async size() { return await this.backend.size(); }
  async close() { return await this.backend.close(); }
}

// ============================================================================
// Convenience: encode + store in one call
// ============================================================================

async function encodeAndStore(substrate, codecName, store, opts) {
  const codec = CODECS[codecName];
  if (!codec) throw new Error("unknown codec: " + codecName);
  const artifact = codec.encode(substrate, opts);
  const result = await store.put(artifact);
  return Object.assign({ codec: codecName, artifact: artifact }, result);
}

// Convenience: retrieve + decode
async function retrieveAndDecode(address, store) {
  const artifact = await store.get(address);
  if (!artifact) return null;
  const codecName = artifact.codec;
  const codec = CODECS[codecName];
  if (!codec) throw new Error("artifact has unknown codec: " + codecName);
  return codec.decode(artifact);
}

// ============================================================================
// Exports
// ============================================================================

const CODECS = {
  strong: codecStrong,
  promoted: codecPromoted,
  trajectory: codecTrajectory
};

module.exports = {
  codecs: CODECS,
  computeAddress: computeAddress,
  canonicalJson: canonicalJson,
  MediaStore: MediaStore,
  InMemoryMediaBackend: InMemoryMediaBackend,
  encodeAndStore: encodeAndStore,
  retrieveAndDecode: retrieveAndDecode
};
