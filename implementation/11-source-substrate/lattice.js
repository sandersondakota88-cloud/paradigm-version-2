// lattice.js
// =============================================================================
// Phase 11 Phase 3.3 — lattice wiring layer.
//
// Instantiates the six-peer lattice (kind, vocab, cooccur, position,
// frequency, composer) and orchestrates per-tick ingest with cross-channels.
//
// Per phase-3-spec.md §2.3 and §4.3:
//   - At tick T, each peer reads other peers' lastOutputs FROM TICK T-1.
//   - The lattice wiring layer holds a snapshot of all six lastOutputs
//     and rotates it per tick.
//   - Order of evaluation within a tick is irrelevant (all read T-1).
//     This honors F3 by removing within-tick ordering as a supervision path.
//
// Per SE-10/M5: cross-channels are byproduct-at-channel, not commands.
// Each peer's lastOutput is byproduct emitted at its own boundary; other
// peers consume it at their own intake boundary on subsequent ticks.
//
// The lattice has no orchestrator that supervises the peers. The lattice
// is a wiring layer that mediates the timing of byproduct-flow only.
// =============================================================================

"use strict";

(function (global) {

  // The five axis peers' axis names + the composer
  const AXES = ["kind", "vocab", "cooccur", "position", "frequency"];
  const ALL_PEERS = AXES.concat(["composer"]);

  function makeLattice(opts) {
    if (!opts) throw new TypeError("makeLattice: opts required");
    if (!opts.FieldModule) throw new TypeError("makeLattice: FieldModule required");
    if (!opts.SubstrateFactory) throw new TypeError("makeLattice: SubstrateFactory required");
    if (!opts.PeerSpecs) throw new TypeError("makeLattice: PeerSpecs required");
    if (!opts.PrimitiveVocabs) throw new TypeError("makeLattice: PrimitiveVocabs required");

    const SubstrateFactory = opts.SubstrateFactory;
    const PeerSpecs = opts.PeerSpecs;
    const PrimitiveVocabs = opts.PrimitiveVocabs;
    const FieldModule = opts.FieldModule;

    // Construct all six peers
    const peers = Object.create(null);
    for (const axis of ALL_PEERS) {
      const spec = PeerSpecs[axis];
      const vocab = PrimitiveVocabs[axis];
      if (!spec) throw new TypeError("makeLattice: missing PeerSpecs[" + axis + "]");
      if (!vocab) throw new TypeError("makeLattice: missing PrimitiveVocabs[" + axis + "]");

      peers[axis] = SubstrateFactory.makePeer({
        FieldModule:    FieldModule,
        id:             axis + "-peer",
        axis:           axis,
        primitiveVocab: vocab,
        dimsFn:         spec.dimsFn,
        tokensFn:       spec.tokensFn,
        outputVar:      spec.outputVar,
        defaultOutput:  spec.defaultOutput,
        outputAlphabet: spec.outputAlphabet,
        domainRules:    spec.domainRules,
        centroids:      spec.centroids,
        onRatify:       spec.onRatify,
        onPromote:      spec.onPromote
      });
    }

    // T-1 lastOutput snapshot. Initialized to each peer's defaultOutput.
    let snapshot = Object.create(null);
    for (const axis of ALL_PEERS) {
      snapshot[axis] = peers[axis].getLastOutput();
    }

    // Per-tick stats at lattice scope (not per peer)
    const latticeStats = {
      ticks: 0,
      tokensIngested: 0,
      crossChannelTokenCount: 0
    };

    // ----------------------------------------------------------
    // ingest(token) — fan out to all six peers with the T-1 snapshot
    // as their ctx.peerLastOutputs. After all six have ingested, rotate
    // the snapshot.
    // ----------------------------------------------------------
    function ingest(token) {
      latticeStats.ticks++;
      latticeStats.tokensIngested++;

      // The snapshot we pass is FROZEN per tick — every peer reads the
      // same T-1 view. The T-1 discipline removes within-tick ordering
      // as a supervision path (F3).
      const tickSnapshot = Object.assign({}, snapshot);
      const extCtx = { peerLastOutputs: tickSnapshot };

      const results = Object.create(null);
      for (const axis of ALL_PEERS) {
        try {
          results[axis] = peers[axis].ingest(token, extCtx);
        } catch (e) {
          results[axis] = { error: e.message };
        }
      }

      // Rotate snapshot: next tick reads this tick's lastOutputs as T-1
      const newSnapshot = Object.create(null);
      for (const axis of ALL_PEERS) {
        newSnapshot[axis] = peers[axis].getLastOutput();
      }
      snapshot = newSnapshot;

      // Count how many cross-channel tokens flowed this tick (rough
      // signal: each peer sees (N-1) cross-tokens when all others have
      // non-null lastOutputs)
      let crossCount = 0;
      for (const a in tickSnapshot) {
        if (tickSnapshot[a]) crossCount++;
      }
      // Each peer reads (crossCount - 1) cross-tokens; total across
      // 6 peers = 6 * (crossCount - 1) when all others have outputs.
      latticeStats.crossChannelTokenCount += Math.max(0, ALL_PEERS.length * (crossCount - 1));

      return {
        tick: latticeStats.ticks,
        results: results,
        snapshot: newSnapshot
      };
    }

    function observe() {
      const peerObs = Object.create(null);
      for (const axis of ALL_PEERS) {
        peerObs[axis] = peers[axis].observe();
      }
      return {
        lattice: latticeStats,
        snapshot: Object.assign({}, snapshot),
        peers: peerObs
      };
    }

    function teardown() {
      for (const axis of ALL_PEERS) {
        peers[axis].teardown();
      }
    }

    return Object.freeze({
      peers: peers,
      ingest: ingest,
      observe: observe,
      teardown: teardown,
      AXES: AXES.slice(),
      ALL_PEERS: ALL_PEERS.slice()
    });
  }

  // ---------------------------------------------------------------------
  // Module
  // ---------------------------------------------------------------------
  const Lattice = Object.freeze({
    makeLattice: makeLattice,
    AXES: AXES.slice(),
    ALL_PEERS: ALL_PEERS.slice()
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Lattice;
  } else {
    global.Lattice = Lattice;
  }

})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));
