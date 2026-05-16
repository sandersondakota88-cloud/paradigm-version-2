// app-identity-binding.js - Phase 8 M3 - substrate-media as app identity

"use strict";

const SubstrateMedia = require("./kernel-src/substrate-media.js");

class AppIdentityBinding {
  constructor(opts) {
    if (!opts || typeof opts !== "object") {
      throw new TypeError("AppIdentityBinding: opts required");
    }
    if (!opts.fieldModule ||
        !opts.fieldModule.Field ||
        typeof opts.fieldModule.Field.serialize !== "function" ||
        typeof opts.fieldModule.Field.deserialize !== "function") {
      throw new TypeError(
        "AppIdentityBinding: opts.fieldModule with Field.serialize/" +
        "deserialize required");
    }

    this.fieldModule = opts.fieldModule;
    this.store = opts.store || new SubstrateMedia.MediaStore();
    this.id = opts.id || "app-instance";

    this._lastAddress = null;
    this._lastCommit = null;
    this._stats = {
      commits: 0,
      hydrations: 0,
      hydrationFailures: 0
    };
  }

  // ---------------------------------------------------------------
  // commit(codecName)
  //
  // Encode current field state via the named codec ("strong" by
  // default), store in the MediaStore, return commit metadata
  // including the content address.
  // ---------------------------------------------------------------
  async commit(codecName) {
    codecName = codecName || "strong";

    // Adapt the lowercase kernel-runtime convention to substrate-media's
    // uppercase Field/Trace expectation. The substrate-media module
    // remains unchanged per the M3 spec.
    const adaptedSubstrate = {
      Field: this.fieldModule.Field,
      Trace: this.fieldModule.Trace,
      id: this.id
    };

    const result = await SubstrateMedia.encodeAndStore(
      adaptedSubstrate, codecName, this.store);

    this._lastAddress = result.address;
    this._lastCommit = {
      address: result.address,
      codec: codecName,
      committedAtStep: this.fieldModule.Field.step,
      constraintCount: this.fieldModule.Field.constraints.length,
      // The artifact ITSELF is the application state per phase7direction.
      // We don't return the full artifact here (it can be large); the
      // caller can fetch via store.get(address) if needed.
      stored: result.stored !== false
    };
    this._stats.commits++;

    return Object.assign({}, this._lastCommit);
  }

  // ---------------------------------------------------------------
  // hydrate(address)
  //
  // Retrieve the artifact at the given content address; decode it;
  // apply to the kernel-runtime's field. Per F5: this is restoration,
  // not rollback. The trace gets a new entry; future operations
  // branch from the restored state.
  //
  // Returns true on success, false if address not found / artifact
  // corrupted.
  // ---------------------------------------------------------------
  async hydrate(address) {
    if (typeof address !== "string" || address.length === 0) {
      this._stats.hydrationFailures++;
      return false;
    }

    let decoded;
    try {
      decoded = await SubstrateMedia.retrieveAndDecode(address, this.store);
    } catch (e) {
      this._stats.hydrationFailures++;
      return false;
    }
    if (!decoded) {
      this._stats.hydrationFailures++;
      return false;
    }

    const adaptedSubstrate = {
      Field: this.fieldModule.Field,
      Trace: this.fieldModule.Trace
    };

    try {
      decoded.applyTo(adaptedSubstrate);
    } catch (e) {
      this._stats.hydrationFailures++;
      return false;
    }

    this._lastAddress = address;
    this._stats.hydrations++;
    return true;
  }

  // ---------------------------------------------------------------
  // identity()
  //
  // The application's current content-address identity. Per
  // phase7direction sec 2.3: "Source code is no longer the locus
  // of the application after consumption; the artifact is."
  // ---------------------------------------------------------------
  identity() {
    return this._lastAddress;
  }

  // ---------------------------------------------------------------
  // observe()
  //
  // O-class observer surface (read-only).
  // ---------------------------------------------------------------
  observe() {
    return {
      id: this.id,
      currentAddress: this._lastAddress,
      lastCommit: this._lastCommit ? Object.assign({}, this._lastCommit) : null,
      commits: this._stats.commits,
      hydrations: this._stats.hydrations,
      hydrationFailures: this._stats.hydrationFailures,
      storeBackend: this.store.backend &&
        this.store.backend.constructor &&
        this.store.backend.constructor.name
    };
  }
}

module.exports = Object.freeze({
  AppIdentityBinding: AppIdentityBinding,
  // Re-export substrate-media building blocks so callers don't have
  // to know about the underlying module path
  MediaStore: SubstrateMedia.MediaStore,
  InMemoryMediaBackend: SubstrateMedia.InMemoryMediaBackend,
  computeAddress: SubstrateMedia.computeAddress,
  codecs: SubstrateMedia.codecs
});
