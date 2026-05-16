// p7-undo-binding.js - Phase 8 P7 - undo as trajectory replay

"use strict";

const CONFIG = Object.freeze({
  MAX_HISTORY: 200   // Cap the address history to prevent unbounded growth
});

class UndoBinding {
  constructor(opts) {
    if (!opts || typeof opts !== "object") {
      throw new TypeError("UndoBinding: opts required");
    }
    if (!opts.persistence ||
        typeof opts.persistence.commit !== "function" ||
        typeof opts.persistence.restore !== "function") {
      throw new TypeError(
        "UndoBinding: opts.persistence must expose commit() + restore()");
    }

    this.persistence = opts.persistence;
    this.config = Object.assign({}, CONFIG, opts.config || {});

    // Address history: a list of commit addresses, oldest first. The
    // current position points to the address most recently restored
    // (or committed without subsequent navigation).
    this._history = [];
    this._cursor = -1;   // -1 means "no commits yet"

    this._stats = {
      commitsRecorded: 0,
      undosApplied: 0,
      redosApplied: 0,
      redosLost: 0,         // count of redo entries discarded by new commits
      navigationsRefused: 0
    };
  }

  // --------------------------------------------------------------------
  // recordCommit(address) - called after each P3 commit
  //
  // Appends to the history. If the cursor was not at the tail (i.e., the
  // user had undone some history and is now committing), the entries
  // past the cursor are dropped (no longer reachable via redo). This
  // is standard undo semantics.
  // --------------------------------------------------------------------
  recordCommit(address) {
    if (typeof address !== "string" || address.length === 0) return;

    // If cursor is not at tail, truncate redo path
    if (this._cursor < this._history.length - 1) {
      const lostCount = (this._history.length - 1) - this._cursor;
      this._history = this._history.slice(0, this._cursor + 1);
      this._stats.redosLost += lostCount;
    }

    this._history.push(address);
    this._cursor = this._history.length - 1;

    // Cap history (drop oldest)
    if (this._history.length > this.config.MAX_HISTORY) {
      const drop = this._history.length - this.config.MAX_HISTORY;
      this._history.splice(0, drop);
      this._cursor -= drop;
    }

    this._stats.commitsRecorded++;
  }

  // --------------------------------------------------------------------
  // canUndo() / canRedo()
  // --------------------------------------------------------------------
  canUndo() {
    return this._cursor > 0;
  }

  canRedo() {
    return this._cursor >= 0 && this._cursor < this._history.length - 1;
  }

  // --------------------------------------------------------------------
  // undo() - restore to the prior commit address
  //
  // Returns {applied: bool, address: string | null}.
  // --------------------------------------------------------------------
  async undo() {
    if (!this.canUndo()) {
      this._stats.navigationsRefused++;
      return { applied: false, address: null };
    }
    const targetIdx = this._cursor - 1;
    const targetAddr = this._history[targetIdx];
    const ok = await this.persistence.restore(targetAddr);
    if (!ok) {
      this._stats.navigationsRefused++;
      return { applied: false, address: null };
    }
    this._cursor = targetIdx;
    this._stats.undosApplied++;
    return { applied: true, address: targetAddr };
  }

  // --------------------------------------------------------------------
  // redo() - restore to the next-forward commit address
  // --------------------------------------------------------------------
  async redo() {
    if (!this.canRedo()) {
      this._stats.navigationsRefused++;
      return { applied: false, address: null };
    }
    const targetIdx = this._cursor + 1;
    const targetAddr = this._history[targetIdx];
    const ok = await this.persistence.restore(targetAddr);
    if (!ok) {
      this._stats.navigationsRefused++;
      return { applied: false, address: null };
    }
    this._cursor = targetIdx;
    this._stats.redosApplied++;
    return { applied: true, address: targetAddr };
  }

  // --------------------------------------------------------------------
  // observation surface
  // --------------------------------------------------------------------
  history() {
    return this._history.slice();
  }

  cursor() {
    return this._cursor;
  }

  currentAddress() {
    return this._cursor >= 0 ? this._history[this._cursor] : null;
  }

  observe() {
    return Object.assign({}, this._stats, {
      historyLength: this._history.length,
      cursor: this._cursor,
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    });
  }
}

module.exports = Object.freeze({
  UndoBinding: UndoBinding,
  CONFIG: CONFIG
});
