// gpu-lattice-compiler.js
// =============================================================================
// Phase 11 Phase 4 — compile the lattice's joint coord-space cascade.
//
// The Phase 3 lattice resolves per-peer constraints CPU-side. Each peer emits
// a lastOutput per token. The lattice's JOINT coord space is the cartesian
// product of the six peers' output alphabets (5 × 5 × 5 × 5 × 5 × 4 = 12,500
// coords). Composer constraints (composer-pair, composer-tuple,
// composer-extension, composer-axis-affinity) are predicates over this joint
// coord space — they say "at coords where axis A has output X and axis B has
// output Y, this constraint fires."
//
// The cascade structurally cannot hold this joint space: it resolves one
// probe at a time. VRAM holds the whole 12,500-coord field as geometry and
// the GPU resolves every coord in parallel.
//
// This compiler converts lattice-state (composer constraints + peer
// alphabets) into postfix bytecode the WGSL shader walks per-coord.
//
// Per Phase 4 design (operator 2026-05-26): we don't re-verify byte-for-byte
// against CPU. Per SE-01 reflexive scope + F2 (one delta formula), the GPU
// adds a NEW reading position (lattice-scope delta over the joint coord
// space) that the cascade never had. Per-peer delta readings preserved
// CPU-side.
//
// Reuses Phase 10's gpu-cascade-compiler instruction encoding (opcode set,
// postfix layout, output-slot intern tables). The compiler is specialized
// to lattice constraints; the shader walk is the same shape.
// =============================================================================

"use strict";

(function (global) {

  const OP = Object.freeze({
    MATCH_DIM:    0x01,
    AND:          0x02,
    BEGIN_THEN:   0x10,
    SET_OUTPUT:   0x12,
    END_RULE:     0xFF
  });

  function encode(op, a, b) {
    if (a === undefined) a = 0;
    if (b === undefined) b = 0;
    if (a < 0 || a > 0xFF) throw new Error("operand a out of u8: " + a);
    if (b < 0 || b > 0xFF) throw new Error("operand b out of u8: " + b);
    return ((op & 0xFF) | ((a & 0xFF) << 8) | ((b & 0xFF) << 16)) >>> 0;
  }

  // ---------------------------------------------------------------------
  // The lattice's joint coord space.
  //
  // Six axes; each axis's output alphabet is the values for its dim.
  // Order is canonical (matches lattice.js ALL_PEERS order).
  // ---------------------------------------------------------------------
  function buildLatticeDimsSpec(peerSpecs) {
    const AXES = ["kind", "vocab", "cooccur", "position", "frequency", "composer"];
    const dims = [];
    for (const axis of AXES) {
      const spec = peerSpecs[axis];
      if (!spec || !Array.isArray(spec.outputAlphabet)) {
        throw new Error("peer-specs[" + axis + "].outputAlphabet missing");
      }
      // We use the alphabet directly (not "default" prefixed) because each
      // peer's defaultOutput is already in its alphabet.
      dims.push({
        name: axis,
        values: spec.outputAlphabet.slice()
      });
    }
    return dims;
  }

  // ---------------------------------------------------------------------
  // Extract lattice-resolvable constraints from peer fields.
  //
  // Lattice-resolvable means: the constraint pattern is a predicate over
  // joint coord-space values (combinations of axis outputs). Currently
  // these are the composer's pattern types. Axis-peer patterns
  // (kind-presence, text-with-cross-context, etc.) are NOT
  // lattice-resolvable — they fire on input token features, not on
  // coord-space values. Those continue to run CPU-side.
  //
  // Each extracted constraint becomes a cascade-match rule with a
  // `selector` mapping axis-name -> output-token and an `emit` writing
  // the constraint's id into the lattice's output slot.
  // ---------------------------------------------------------------------
  function extractLatticeRules(peerObservations, peers) {
    // peerObservations: { kind: PeerObs, vocab: PeerObs, ..., composer: PeerObs }
    // peers: { kind: Peer, vocab: Peer, ..., composer: Peer }
    const rules = [];

    // Walk composer's field for lattice-resolvable patterns.
    const composer = peers.composer;
    if (!composer || !composer.field) return rules;

    for (const c of composer.field.constraints) {
      if (!c.pattern) continue;
      const t = c.pattern.type;

      if (t === "composer-pair") {
        // pattern: { aAxis, bAxis, aOut, bOut }
        const selector = Object.create(null);
        selector[c.pattern.aAxis] = c.pattern.aOut;
        selector[c.pattern.bAxis] = c.pattern.bOut;
        rules.push({
          id: c.id || "composer-pair-" + rules.length,
          source: "composer",
          kind: c.kind,
          pattern: { type: "cascade-match", selector: selector },
          emit: { property: "--lattice-fire", value: c.id || ("cp" + rules.length) }
        });
      } else if (t === "composer-extension") {
        // pattern: { aAxis, bAxis, aOut, bOut } — fires when both pinned
        // axes match AND at least one other dim is non-default. We approximate
        // the "at least one other" check by emitting a wildcard rule (just
        // the two pinned dims) and letting the shader walk decide. The
        // additional non-default condition is honored implicitly: any coord
        // matching the two pinned axes is a candidate; downstream consumers
        // can filter by the joint coord's other-dim values.
        const selector = Object.create(null);
        selector[c.pattern.aAxis] = c.pattern.aOut;
        selector[c.pattern.bAxis] = c.pattern.bOut;
        rules.push({
          id: c.id || "composer-ext-" + rules.length,
          source: "composer",
          kind: c.kind,
          pattern: { type: "cascade-match", selector: selector },
          emit: { property: "--lattice-fire", value: c.id || ("ce" + rules.length) }
        });
      } else if (t === "composer-tuple") {
        // pattern: { key, outputs: {axis: out, ...} }
        // outputs is a snapshot of all six axes at the moment the tuple
        // was derived. Each entry becomes a selector pin.
        if (!c.pattern.outputs || typeof c.pattern.outputs !== "object") continue;
        const selector = Object.create(null);
        for (const axis in c.pattern.outputs) {
          selector[axis] = c.pattern.outputs[axis];
        }
        if (Object.keys(selector).length === 0) continue;
        rules.push({
          id: c.id || "composer-tup-" + rules.length,
          source: "composer",
          kind: c.kind,
          pattern: { type: "cascade-match", selector: selector },
          emit: { property: "--lattice-fire", value: c.id || ("ct" + rules.length) }
        });
      } else if (t === "composer-axis-affinity") {
        // pattern: { aAxis, bAxis, aOut, bOut, context, focus }
        // Same coord-shape as composer-pair: pin two axes.
        const selector = Object.create(null);
        selector[c.pattern.aAxis] = c.pattern.aOut;
        selector[c.pattern.bAxis] = c.pattern.bOut;
        rules.push({
          id: c.id || "composer-aff-" + rules.length,
          source: "composer",
          kind: c.kind,
          pattern: { type: "cascade-match", selector: selector },
          emit: { property: "--lattice-fire", value: c.id || ("ca" + rules.length) }
        });
      }
      // Other constraint pattern types are not lattice-resolvable.
      // The full list: kind-presence, kind-cooccurs, kind-transition,
      // kind-with-cross-context, kind-context-pattern, text-*, position-*,
      // cooccur-*, freq-* — all fire on input token features, not on
      // joint coord values. They remain CPU-side.
    }

    return rules;
  }

  // ---------------------------------------------------------------------
  // Compile a set of cascade-match rules into postfix bytecode for the
  // shader. Reuses Phase 10's encoding (rule-by-rule MATCH_DIM ... AND ...
  // BEGIN_THEN ... SET_OUTPUT ... END_RULE).
  // ---------------------------------------------------------------------
  function buildDimIndex(dims) {
    const byName = Object.create(null);
    for (let i = 0; i < dims.length; i++) {
      const d = dims[i];
      byName[d.name] = {
        index: i,
        values: d.values,
        valueIndex: function (v) {
          const k = d.values.indexOf(String(v));
          if (k < 0) return -1;  // unknown value; rule skipped
          return k;
        }
      };
    }
    return byName;
  }

  function compileRule(rule, dimIdx, outputs) {
    const insts = [];
    const sel = (rule.pattern && rule.pattern.selector) || {};

    const matches = [];
    for (const k of Object.keys(sel)) {
      const v = sel[k];
      if (v === "*") continue;
      if (!dimIdx[k]) {
        // Unknown dim — rule can't be expressed in current coord space.
        return null;
      }
      const vIdx = dimIdx[k].valueIndex(v);
      if (vIdx < 0) {
        // Value not in dim's alphabet (e.g., axis hasn't emitted this
        // output yet). Rule can't fire on any current coord; skip.
        return null;
      }
      matches.push({ dIdx: dimIdx[k].index, vIdx: vIdx });
    }

    if (matches.length === 0) return null;  // would match every coord; skip

    matches.sort(function (x, y) { return x.dIdx - y.dIdx; });
    for (const m of matches) insts.push(encode(OP.MATCH_DIM, m.dIdx, m.vIdx));
    for (let i = 0; i < matches.length - 1; i++) insts.push(encode(OP.AND));
    insts.push(encode(OP.BEGIN_THEN));

    const emit = rule.emit;
    if (emit && emit.property) {
      const slot = outputs.slotByProperty[emit.property];
      if (slot !== undefined) {
        const table = outputs.opTables[slot];
        const v = String(emit.value);
        let idx = table.indexOf(v);
        if (idx < 0) {
          if (table.length > 0xFF) {
            // Intern table overflow — skip this emit (could log).
            insts.push(encode(OP.END_RULE));
            return insts;
          }
          table.push(v);
          idx = table.length - 1;
        }
        insts.push(encode(OP.SET_OUTPUT, slot, idx));
      }
    }
    insts.push(encode(OP.END_RULE));
    return insts;
  }

  function sortRules(rules) {
    const indexed = rules.map(function (r, i) {
      const sel = (r.pattern && r.pattern.selector) || {};
      let effective = 0;
      for (const k of Object.keys(sel)) if (sel[k] !== "*") effective++;
      return { rule: r, origIdx: i, effective: effective };
    });
    indexed.sort(function (x, y) {
      const d = x.effective - y.effective;
      if (d !== 0) return d;
      return x.origIdx - y.origIdx;
    });
    return indexed.map(function (e) { return e.rule; });
  }

  function compile(rules, dimsSpec, outputProperties) {
    if (!Array.isArray(rules)) throw new Error("rules must be array");
    if (!Array.isArray(dimsSpec) || dimsSpec.length === 0) {
      throw new Error("dimsSpec must be non-empty array");
    }
    if (dimsSpec.length > 8) {
      throw new Error("max 8 dims supported");
    }
    for (const d of dimsSpec) {
      if (d.values.length > 0xFF) {
        throw new Error("dim '" + d.name + "' has >255 values");
      }
    }

    const dimIdx = buildDimIndex(dimsSpec);

    const slotByProperty = Object.create(null);
    const opTables = [];
    for (let i = 0; i < outputProperties.length; i++) {
      slotByProperty[outputProperties[i]] = i;
      opTables.push([""]);
    }
    const outputs = {
      properties: outputProperties.slice(),
      slotByProperty: slotByProperty,
      opTables: opTables
    };

    const sorted = sortRules(rules);
    const all = [];
    const perRule = [];
    let ruleSkipped = 0;
    for (const r of sorted) {
      const insts = compileRule(r, dimIdx, outputs);
      if (insts === null) { ruleSkipped++; continue; }
      perRule.push(insts.length);
      for (const inst of insts) all.push(inst);
    }

    let stateSpaceSize = 1;
    for (const d of dimsSpec) stateSpaceSize *= d.values.length;

    return {
      instructions: Uint32Array.from(all),
      dims: dimsSpec,
      stateSpaceSize: stateSpaceSize,
      outputs: outputs,
      stats: {
        ruleCount: perRule.length,
        ruleSkipped: ruleSkipped,
        totalInstructions: all.length,
        perRule: perRule,
        byteSize: all.length * 4
      }
    };
  }

  // ---------------------------------------------------------------------
  // Convert a joint-space coord linear index into the per-axis output
  // tuple. Inverse of coordToIndex in the Phase 10 compiler.
  // ---------------------------------------------------------------------
  function indexToCoord(idx, dimsSpec) {
    const out = Object.create(null);
    let rem = idx;
    for (let i = dimsSpec.length - 1; i >= 0; i--) {
      const d = dimsSpec[i];
      out[d.name] = d.values[rem % d.values.length];
      rem = Math.floor(rem / d.values.length);
    }
    return out;
  }

  function coordToIndex(coordObj, dimsSpec) {
    let index = 0;
    for (let i = 0; i < dimsSpec.length; i++) {
      const d = dimsSpec[i];
      const v = (coordObj[d.name] !== undefined) ? String(coordObj[d.name]) : d.values[0];
      let k = d.values.indexOf(v);
      if (k < 0) k = 0;
      index = index * d.values.length + k;
    }
    return index;
  }

  // ---------------------------------------------------------------------
  // Module
  // ---------------------------------------------------------------------
  const GpuLatticeCompiler = Object.freeze({
    OP: OP,
    buildLatticeDimsSpec: buildLatticeDimsSpec,
    extractLatticeRules: extractLatticeRules,
    compile: compile,
    coordToIndex: coordToIndex,
    indexToCoord: indexToCoord
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = GpuLatticeCompiler;
  } else {
    global.GpuLatticeCompiler = GpuLatticeCompiler;
  }

})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));
