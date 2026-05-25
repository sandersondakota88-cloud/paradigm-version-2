// gpu-cascade-compiler.js
// =============================================================================
// Compile the deposition's cascade-match constraints into a postfix u32
// instruction buffer the WGSL shader walks. Same encoding as
// exodus/canonical-implementation/compile-constraints.js, adapted to our
// cascade-match constraint shape and to a single-output (--next-op) record.
//
// Input shape (from Field.constraints, kind = "derived", pattern.type =
// "cascade-match"):
//
//   { id, pattern: { type: "cascade-match", selector: { dim: value, ... } },
//     emit: { property: "--next-op", value: <opName> } }
//
// We treat selector keys as dim names and selector values as dim values.
// Wildcards ("*") are treated as "do not constrain this dim" (omit the
// MATCH_DIM instruction). The emit value becomes a u32 interned-string
// index, written into the shader's single output slot.
//
// Coord-space spec (passed in from the runner):
//
//   {
//     dims: [
//       { name: "trigger",  values: ["",      "submit", "toggle", "delete", ...] },
//       { name: "filter",   values: ["all",   "active", "completed"] },
//       ...
//     ]
//   }
//
// Each dim has a name and an ordered values array. The value at index 0 is
// the default. Wildcard selectors (no entry, or "*") match every value of
// that dim.
//
// Output:
//
//   {
//     instructions: Uint32Array,
//     dims:         [{name, values}, ...],   // echoed
//     stateSpaceSize: number,                // product of dim cardinalities
//     opTable:      [string, ...],           // interned --next-op values
//                                            //   index 0 = "" (default)
//     stats:        { ruleCount, totalInstructions, perRule, byteSize }
//   }
//
// Opcodes (subset of algorithm 16, generalized to multi-output):
//
//   OP_MATCH_DIM     0x01  a=dim_index       b=value_index
//   OP_AND           0x02
//   OP_BEGIN_THEN    0x10
//   OP_SET_OUTPUT    0x12  a=output_slot     b=intern_index
//                          (output_slot: which output property to set;
//                           intern_index: index into that slot's opTable)
//   OP_END_RULE      0xFF
//
// Each output property (--next-op, --todo-visible, etc.) maps to a fixed
// output slot (0, 1, ...). The shader's Output struct has one u32 per slot
// plus a 'matched' flag. The host registers output properties in declaration
// order and gives each its own intern table; the compiler emits SET_OUTPUT
// instructions using those slot indices.
// =============================================================================

"use strict";

(function (global) {

  const OP = Object.freeze({
    MATCH_DIM:    0x01,
    AND:          0x02,
    BEGIN_THEN:   0x10,
    SET_OUTPUT:   0x12,    // a=slot, b=intern-index
    END_RULE:     0xFF
  });

  function encode(op, a, b) {
    if (a === undefined) a = 0;
    if (b === undefined) b = 0;
    if (a < 0 || a > 0xFF) throw new Error("operand a out of u8: " + a);
    if (b < 0 || b > 0xFF) throw new Error("operand b out of u8: " + b);
    return ((op & 0xFF) | ((a & 0xFF) << 8) | ((b & 0xFF) << 16)) >>> 0;
  }

  function buildDimIndex(dims) {
    const byName = Object.create(null);
    for (let i = 0; i < dims.length; i++) {
      const d = dims[i];
      byName[d.name] = {
        index: i,
        values: d.values,
        valueIndex: function (v) {
          const k = d.values.indexOf(String(v));
          if (k < 0) throw new Error("value not in dim '" + d.name + "': " + JSON.stringify(v));
          return k;
        }
      };
    }
    return byName;
  }

  // Sort rules by |effective when| ascending, source-order tiebreak.
  // Wildcard ("*" or missing) selector entries don't count toward |when|.
  function sortRules(rules) {
    const indexed = rules.map(function (r, i) {
      const sel = (r.pattern && r.pattern.selector) || {};
      let effective = 0;
      for (const k of Object.keys(sel)) {
        if (sel[k] !== "*") effective++;
      }
      return { rule: r, origIdx: i, effective: effective };
    });
    indexed.sort(function (x, y) {
      const d = x.effective - y.effective;
      if (d !== 0) return d;
      return x.origIdx - y.origIdx;
    });
    return indexed.map(function (e) { return e.rule; });
  }

  // Compile one rule. Wildcards skipped (the dim is unconstrained, the
  // rule matches every coord value along that dim). Emits are normalized
  // into an array of {property, value}.
  function normalizeEmits(emit, ruleId) {
    if (!emit) throw new Error("rule '" + ruleId + "' has no emit");
    if (Array.isArray(emit)) return emit;
    if (typeof emit === "object" && emit.property) return [emit];
    throw new Error("rule '" + ruleId + "' emit must be {property,value} or array of same");
  }

  function compileRule(rule, dimIdx, outputs) {
    const insts = [];
    const sel = (rule.pattern && rule.pattern.selector) || {};

    const matches = [];
    for (const k of Object.keys(sel)) {
      const v = sel[k];
      // The deposition uses CSS-style attribute selectors with "data-"
      // prefix (e.g. "data-trigger"). Coord dims are the unprefixed name
      // ("trigger") to match the bridge's projection convention. The
      // "data-substrate-state" selector is the presence marker, not a
      // dim, so it's ignored at GPU resolution scope.
      const cleanKey = (k.indexOf("data-") === 0) ? k.substring(5) : k;
      if (cleanKey === "substrate-state") continue;
      if (v === "*") continue;
      if (!dimIdx[cleanKey]) {
        throw new Error("rule '" + rule.id + "' references unknown dim '" + cleanKey + "' (raw key '" + k + "')");
      }
      matches.push({
        dIdx: dimIdx[cleanKey].index,
        vIdx: dimIdx[cleanKey].valueIndex(v)
      });
    }

    if (matches.length === 0) {
      throw new Error("rule '" + rule.id + "' has no non-wildcard selectors; would match every coord");
    }

    // Deterministic dim-index order for stable diffs.
    matches.sort(function (x, y) { return x.dIdx - y.dIdx; });
    for (const m of matches) {
      insts.push(encode(OP.MATCH_DIM, m.dIdx, m.vIdx));
    }
    for (let i = 0; i < matches.length - 1; i++) {
      insts.push(encode(OP.AND));
    }
    insts.push(encode(OP.BEGIN_THEN));

    const emits = normalizeEmits(rule.emit, rule.id);
    for (const em of emits) {
      const slot = outputs.slotByProperty[em.property];
      if (slot === undefined) {
        throw new Error("rule '" + rule.id + "' emits unknown property '" + em.property + "'");
      }
      const table = outputs.opTables[slot];
      const v = String(em.value);
      let idx = table.indexOf(v);
      if (idx < 0) {
        table.push(v);
        idx = table.length - 1;
        if (idx > 0xFF) {
          throw new Error("intern table overflow for '" + em.property + "' (>255 distinct values)");
        }
      }
      insts.push(encode(OP.SET_OUTPUT, slot, idx));
    }
    insts.push(encode(OP.END_RULE));
    return insts;
  }

  // Compile a full set of cascade-match rules against a coord-space spec
  // and an output-properties list. Each output property gets its own slot
  // (0, 1, ...) and its own intern table; intern index 0 is always ""
  // (the default when no rule writes that slot).
  //
  //   compile(rules, dimsSpec, outputProperties)
  //     dimsSpec:         [{name, values}, ...]
  //     outputProperties: ["--next-op", "--todo-visible", ...] in slot order
  //
  // Returns:
  //   {
  //     instructions: Uint32Array,
  //     dims: dimsSpec,
  //     stateSpaceSize: number,
  //     outputs: {
  //       properties: [...],        // echoed
  //       slotByProperty: {prop: idx},
  //       opTables: [[...], [...]]  // one per slot
  //     },
  //     stats: {...}
  //   }
  function compile(rules, dimsSpec, outputProperties) {
    if (!Array.isArray(rules)) throw new Error("rules must be array");
    if (!Array.isArray(dimsSpec) || dimsSpec.length === 0) {
      throw new Error("dimsSpec must be non-empty array");
    }
    if (dimsSpec.length > 8) {
      throw new Error("max 8 dims supported (shader struct holds 2 vec4<u32>)");
    }
    for (const d of dimsSpec) {
      if (!d.name || !Array.isArray(d.values) || d.values.length === 0) {
        throw new Error("each dim needs name + non-empty values");
      }
      if (d.values.length > 0xFF) {
        throw new Error("dim '" + d.name + "' has >255 values; doesn't fit u8");
      }
    }
    if (!Array.isArray(outputProperties) || outputProperties.length === 0) {
      throw new Error("outputProperties must be non-empty array");
    }
    if (outputProperties.length > 4) {
      throw new Error("max 4 output slots supported (shader Output struct width)");
    }

    const dimIdx = buildDimIndex(dimsSpec);

    const slotByProperty = Object.create(null);
    const opTables = [];
    for (let i = 0; i < outputProperties.length; i++) {
      slotByProperty[outputProperties[i]] = i;
      opTables.push([""]);  // slot 0 of every table is the default
    }
    const outputs = {
      properties: outputProperties.slice(),
      slotByProperty: slotByProperty,
      opTables: opTables
    };

    // Only consider cascade-match constraints. The seed (kind=seed) and any
    // other constraint shapes are ignored for GPU resolution -- the GPU's
    // job is the cascade only.
    const cascadeRules = rules.filter(function (r) {
      return r && r.pattern && r.pattern.type === "cascade-match";
    });

    const sorted = sortRules(cascadeRules);
    const all = [];
    const perRule = [];
    for (const r of sorted) {
      const insts = compileRule(r, dimIdx, outputs);
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
        ruleCount: sorted.length,
        totalInstructions: all.length,
        perRule: perRule,
        byteSize: all.length * 4
      }
    };
  }

  // Given a coord (object of dim-name -> value), compute its linear index
  // using the same packing the shader uses (last dim varies fastest).
  function coordToIndex(coordObj, dimsSpec) {
    let index = 0;
    for (let i = 0; i < dimsSpec.length; i++) {
      const d = dimsSpec[i];
      const v = (coordObj[d.name] !== undefined) ? String(coordObj[d.name]) : d.values[0];
      let k = d.values.indexOf(v);
      if (k < 0) k = 0; // unknown value -> default slot
      index = index * d.values.length + k;
    }
    return index;
  }

  const GpuCascadeCompiler = Object.freeze({
    OP: OP,
    compile: compile,
    coordToIndex: coordToIndex
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = GpuCascadeCompiler;
  } else {
    global.GpuCascadeCompiler = GpuCascadeCompiler;
  }

})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));
