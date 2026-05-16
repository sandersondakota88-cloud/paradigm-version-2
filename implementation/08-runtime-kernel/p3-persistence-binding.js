// p3-persistence-binding.js - Phase 8 P3 - persistence as substrate-media

"use strict";

const Binding = require("./app-identity-binding.js");

const CONFIG = Object.freeze({
  // Default cadence: commit every 10 kernel ticks. Tunable per app:
  // too-frequent saturates storage; too-sparse loses recent state on
  // crash. P1 sec 11.4 notes the cadence is empirical.
  COMMIT_EVERY_TICKS: 10,

  // Codec: strong by default (full fidelity). Apps that need lighter
  // storage can choose "promoted" or "trajectory".
  CODEC: "strong"
});

class PersistenceBinding {
  constructor(opts) {
    if (!opts || typeof opts !== "object") {
      throw new TypeError("PersistenceBinding: opts required");
    }
    if (!opts.fieldModule) {
      throw new TypeError("PersistenceBinding: opts.fieldModule required");
    }
    this.config = Object.assign({}, CONFIG, opts.config || {});
    this.fieldModule = opts.fieldModule;

    // The underlying M3 binding. Reused unchanged; this layer only
    // adds the lifecycle wiring.
    this.identity = new Binding.AppIdentityBinding({
      fieldModule: opts.fieldModule,
      store: opts.store,
      id: opts.id || "persistence"
    });

    // The "save state" boundary callback. The deposition wires this to
    // wherever durable state lives - URL fragment, IndexedDB, M2 chain
    // link to remote store. Default is no-op.
    this.onAddressChanged = opts.onAddressChanged || function () {};

    // Last-known address for boot hydration. If provided, bootHydrate()
    // attempts to restore from this address.
    this.lastKnownAddress = opts.lastKnownAddress || null;

    this._lastCommittedStep = -1;
    this._stats = {
      autocommits: 0,
      bootHydrations: 0,
      bootHydrationFailures: 0,
      manualCommits: 0
    };
  }

  // --------------------------------------------------------------------
  // bootHydrate() - restore from lastKnownAddress if available
  //
  // Called during the deposition's load sequence, before any operations
  // run. Returns {hydrated: bool, address: string | null}.
  // --------------------------------------------------------------------
  async bootHydrate() {
    if (!this.lastKnownAddress) {
      return { hydrated: false, address: null };
    }
    const ok = await this.identity.hydrate(this.lastKnownAddress);
    if (ok) {
      this._stats.bootHydrations++;
      this._lastCommittedStep = this.fieldModule.Field.step;
      return { hydrated: true, address: this.lastKnownAddress };
    } else {
      this._stats.bootHydrationFailures++;
      return { hydrated: false, address: this.lastKnownAddress };
    }
  }

  // --------------------------------------------------------------------
  // tick() - called by the kernel's tick loop or metabolism cadence
  //
  // Determines whether to autocommit based on COMMIT_EVERY_TICKS.
  // Returns null if no commit, or the commit result if one happened.
  // --------------------------------------------------------------------
  async tick() {
    const currentStep = this.fieldModule.Field.step;
    if (this._lastCommittedStep < 0) {
      // First tick: commit baseline so we have something to fall back to
      return await this._doCommit();
    }
    const ticksSinceCommit = currentStep - this._lastCommittedStep;
    if (ticksSinceCommit < this.config.COMMIT_EVERY_TICKS) {
      return null;
    }
    return await this._doCommit();
  }

  // --------------------------------------------------------------------
  // commit() - explicit commit (e.g., on user-driven "save" boundary)
  //
  // Always commits regardless of cadence. The "save state" boundary
  // can be triggered by the metabolism (auto) or by a user explicitly
  // (manual). Both paths produce the same artifact format.
  // --------------------------------------------------------------------
  async commit() {
    this._stats.manualCommits++;
    return await this._doCommit();
  }

  // --------------------------------------------------------------------
  // restore(address) - hydrate from arbitrary address (P7's undo path)
  //
  // Like bootHydrate but for runtime-driven restoration. Per F5:
  // restoration produces a new branch from the recorded state; original
  // and any post-restore artifacts both remain in the store.
  // --------------------------------------------------------------------
  async restore(address) {
    const ok = await this.identity.hydrate(address);
    if (ok) {
      this._lastCommittedStep = this.fieldModule.Field.step;
    }
    return ok;
  }

  // --------------------------------------------------------------------
  // identity surface
  // --------------------------------------------------------------------
  currentAddress() {
    return this.identity.identity();
  }

  observe() {
    return Object.assign({}, this._stats, {
      lastCommittedStep: this._lastCommittedStep,
      currentAddress: this.identity.identity(),
      identityObs: this.identity.observe()
    });
  }

  // ====================================================================
  // Internal
  // ====================================================================

  async _doCommit() {
    const r = await this.identity.commit(this.config.CODEC);
    this._lastCommittedStep = this.fieldModule.Field.step;
    this._stats.autocommits++;

    // Notify the "save state" boundary. The callback is the deposition's
    // wiring to durable storage (URL fragment, IndexedDB, M2 chain).
    try {
      this.onAddressChanged(r.address, r);
    } catch (e) {
      // F3: callback errors do not propagate
    }

    return r;
  }
}

module.exports = Object.freeze({
  PersistenceBinding: PersistenceBinding,
  CONFIG: CONFIG,
  // Re-export from M3 for convenience
  MediaStore: Binding.MediaStore,
  InMemoryMediaBackend: Binding.InMemoryMediaBackend
});
