// gpu-cascade-runner.js
// =============================================================================
// WebGPU host code for the deposition cascade. Browser-only.
//
// Lifecycle:
//   const runner = await GpuCascadeRunner.create({
//     wgslSource: <string from fetch('./resolve-deposition.wgsl').then(r=>r.text())>,
//     compiled:   <result of GpuCascadeCompiler.compile(rules, dimsSpec)>
//   });
//
//   // Each tick:
//   runner.dispatch();                // fire-and-forget; readback resolves async
//   const latest = runner.latest();   // { tick, opByCoord: Uint32Array, matchedByCoord: Uint32Array, atDispatch }
//   const opForActive = runner.opForCoord(activeCoordObj);
//
// Async readback:
//   The shader runs every tick if we call dispatch(); readback (mapAsync) is
//   asynchronous, so the latest() result lags by 1-2 frames. We never block
//   the tick loop on it. The recorder picks up whatever the latest completed
//   pass returned. This matches the substrate-duality posture in SE-06:
//   render-scope (GPU) and execution-scope (JS tick loop) couple through the
//   field via delta, not through a barrier or sync primitive.
//
// Rule-set changes:
//   The deposition's cascade rules don't change at runtime in our current
//   implementation (rules are appended at boot, never mutated). The runner
//   builds the instructions buffer once at create() and reuses it. If a
//   future deposition mutates rules, call runner.recompile(newCompiled).
// =============================================================================

"use strict";

(function (global) {

  // ----------------------------------------------------------------------
  // Pure reduction helpers (testable without a GPU)
  //
  // These operate on a "latestResult" shape:
  //   { tick, slotsByCoord: [Uint32Array, ...], matchedByCoord: Uint32Array, ... }
  // and a "compiledOutputs" shape from the compiler:
  //   { properties: [...], slotByProperty: {...}, opTables: [[...], ...] }
  //
  // The runner's runtime closures call into these.
  // ----------------------------------------------------------------------

  function pureCountByValue(latestResult, compiledOutputs, propertyName) {
    if (!latestResult) return null;
    const slot = compiledOutputs.slotByProperty[propertyName];
    if (slot === undefined) {
      throw new Error("countByValue: unknown output property '" + propertyName + "'");
    }
    const table = compiledOutputs.opTables[slot];
    const slotArr = latestResult.slotsByCoord[slot];
    const counts = {};
    for (let i = 0; i < table.length; i++) counts[table[i]] = 0;
    for (let i = 0; i < slotArr.length; i++) {
      const v = table[slotArr[i]];
      if (v !== undefined) counts[v]++;
    }
    return counts;
  }

  function pureCoordsMatching(latestResult, compiledOutputs, propertyName, value, coordFromIndexFn) {
    if (!latestResult) return null;
    const slot = compiledOutputs.slotByProperty[propertyName];
    if (slot === undefined) {
      throw new Error("coordsMatching: unknown output property '" + propertyName + "'");
    }
    const table = compiledOutputs.opTables[slot];
    const targetIdx = table.indexOf(String(value));
    if (targetIdx < 0) return [];
    const slotArr = latestResult.slotsByCoord[slot];
    const out = [];
    for (let i = 0; i < slotArr.length; i++) {
      if (slotArr[i] === targetIdx) {
        out.push({ coord: coordFromIndexFn(i), coordIndex: i });
      }
    }
    return out;
  }

  function pureMatchedCoordCount(latestResult) {
    if (!latestResult) return null;
    const arr = latestResult.matchedByCoord;
    let matched = 0;
    for (let i = 0; i < arr.length; i++) if (arr[i] > 0) matched++;
    return {
      matched: matched,
      unmatched: arr.length - matched,
      total: arr.length
    };
  }

  function makeCoordFromIndex(dims) {
    return function (idx) {
      const out = {};
      let rem = idx;
      for (let i = dims.length - 1; i >= 0; i--) {
        const d = dims[i];
        const k = rem % d.values.length;
        out[d.name] = d.values[k];
        rem = (rem - k) / d.values.length;
      }
      return out;
    };
  }

  function detectSupport() {
    if (typeof navigator === "undefined" || !navigator.gpu) {
      return { supported: false, reason: "navigator.gpu not available" };
    }
    return { supported: true };
  }

  async function create(opts) {
    const support = detectSupport();
    if (!support.supported) throw new Error("gpu-cascade-runner: " + support.reason);
    if (!opts || !opts.wgslSource || !opts.compiled) {
      throw new Error("gpu-cascade-runner.create: { wgslSource, compiled } required");
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error("requestAdapter returned null");
    const device = await adapter.requestDevice();
    device.addEventListener("uncapturederror", function (e) {
      console.error("[gpu-cascade-runner] uncapturederror:", e.error && e.error.message);
    });

    const module = device.createShaderModule({
      label: "resolve-deposition.wgsl",
      code: opts.wgslSource
    });

    const pipeline = device.createComputePipeline({
      label: "resolve-deposition",
      layout: "auto",
      compute: { module: module, entryPoint: "main" }
    });

    // State held across dispatches
    const state = {
      device:          device,
      pipeline:        pipeline,
      compiled:        null,
      constantsBuf:    null,
      instructionsBuf: null,
      outputsBuf:      null,
      readbackBuf:     null,
      bindGroup:       null,
      // Output struct: 4 slots + matched + 3 pad = 8 u32s per coord (32B).
      // Padded to 32B so the struct's natural alignment is satisfied even
      // if WGSL implementations vary on struct end-padding.
      OUTPUT_U32S_PER_COORD: 8,
      dispatchCount:   0,
      readbackCount:   0,
      // latestResult: {
      //   tick, atDispatch,
      //   slotsByCoord: [Uint32Array, ...]  // one per output slot
      //   matchedByCoord: Uint32Array
      // }
      latestResult:    null,
      inFlight:        false,
      lastError:       null
    };

    function recompile(compiled) {
      // Destroy old buffers if present
      for (const k of ["constantsBuf", "instructionsBuf", "outputsBuf", "readbackBuf"]) {
        if (state[k]) { try { state[k].destroy(); } catch (_) {} state[k] = null; }
      }

      state.compiled = compiled;

      // Constants uniform: 4 u32s + 2 vec4<u32> (32 u32s = 128 bytes? no:
      // 4 + 8 = 12 u32s = 48 bytes). Matches resolve-deposition.wgsl
      // Constants struct.
      const constantsArr = new Uint32Array(12);
      constantsArr[0] = compiled.stateSpaceSize;
      constantsArr[1] = compiled.instructions.length;
      constantsArr[2] = compiled.dims.length;
      constantsArr[3] = 0;
      for (let i = 0; i < 8; i++) {
        constantsArr[4 + i] = (i < compiled.dims.length) ? compiled.dims[i].values.length : 0;
      }

      state.constantsBuf = device.createBuffer({
        label: "constants",
        size: constantsArr.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(state.constantsBuf, 0, constantsArr);

      // Instructions buffer must be > 0 bytes; if rules compile to zero
      // instructions (no cascade-match constraints), make a dummy.
      const instData = compiled.instructions.length > 0
        ? compiled.instructions
        : new Uint32Array([0xFF]); // OP_END_RULE alone; skipping=false, no effect

      state.instructionsBuf = device.createBuffer({
        label: "instructions",
        size: instData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(state.instructionsBuf, 0, instData);

      const outputBytes = compiled.stateSpaceSize * state.OUTPUT_U32S_PER_COORD * 4;
      state.outputsBuf = device.createBuffer({
        label: "outputs",
        size: outputBytes,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
      });
      state.readbackBuf = device.createBuffer({
        label: "readback",
        size: outputBytes,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });

      state.bindGroup = device.createBindGroup({
        label: "bindings",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: state.constantsBuf } },
          { binding: 1, resource: { buffer: state.instructionsBuf } },
          { binding: 2, resource: { buffer: state.outputsBuf } }
        ]
      });
    }

    recompile(opts.compiled);

    function dispatch() {
      if (state.inFlight) {
        // Previous readback hasn't returned. Don't pile up GPU work; skip
        // this tick. Witness mode is fine with lagging by a frame or two.
        return false;
      }
      const tickAt = ++state.dispatchCount;
      const wgSize = 64;
      const wgCount = Math.ceil(state.compiled.stateSpaceSize / wgSize);

      const encoder = device.createCommandEncoder({ label: "resolve-encoder" });
      const pass = encoder.beginComputePass({ label: "resolve-pass" });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, state.bindGroup);
      pass.dispatchWorkgroups(wgCount);
      pass.end();
      encoder.copyBufferToBuffer(
        state.outputsBuf, 0,
        state.readbackBuf, 0,
        state.compiled.stateSpaceSize * state.OUTPUT_U32S_PER_COORD * 4
      );
      device.queue.submit([encoder.finish()]);

      state.inFlight = true;
      state.readbackBuf.mapAsync(GPUMapMode.READ).then(function () {
        try {
          const raw = new Uint32Array(state.readbackBuf.getMappedRange().slice(0));
          state.readbackBuf.unmap();

          const n = state.compiled.stateSpaceSize;
          const stride = state.OUTPUT_U32S_PER_COORD;
          const numSlots = state.compiled.outputs.properties.length;
          const slotsByCoord = [];
          for (let s = 0; s < numSlots; s++) slotsByCoord.push(new Uint32Array(n));
          const matchedByCoord = new Uint32Array(n);
          for (let i = 0; i < n; i++) {
            const base = i * stride;
            for (let s = 0; s < numSlots; s++) {
              slotsByCoord[s][i] = raw[base + s];
            }
            matchedByCoord[i] = raw[base + 4];  // 'matched' lives at u32[4]
          }
          state.latestResult = {
            tick: tickAt,
            slotsByCoord: slotsByCoord,
            matchedByCoord: matchedByCoord,
            atDispatch: performance.now()
          };
          state.readbackCount++;
        } catch (e) {
          state.lastError = e;
          console.error("[gpu-cascade-runner] readback error:", e.message);
        } finally {
          state.inFlight = false;
        }
      }, function (err) {
        state.lastError = err;
        state.inFlight = false;
        console.error("[gpu-cascade-runner] mapAsync rejected:", err && err.message);
      });

      return true;
    }

    // Look up the resolved outputs for a given coord. Returns
    //   { matched, coordIndex, fromDispatch, values: {property: string|null, ...} }
    // values map: each registered output property -> resolved string (or
    // null if the intern index is 0 = default empty).
    function resolveCoord(coordObj) {
      if (!state.latestResult) return null;
      const idx = coordToIndex(coordObj);
      const matched = state.latestResult.matchedByCoord[idx];
      const values = {};
      const props = state.compiled.outputs.properties;
      const tables = state.compiled.outputs.opTables;
      for (let s = 0; s < props.length; s++) {
        const internIdx = state.latestResult.slotsByCoord[s][idx];
        const str = tables[s][internIdx];
        values[props[s]] = (str === "" || str === undefined) ? null : str;
      }
      return {
        matched: matched,
        coordIndex: idx,
        fromDispatch: state.latestResult.tick,
        values: values
      };
    }

    // Back-compat helper: resolve --next-op specifically.
    function opForCoord(coordObj) {
      const r = resolveCoord(coordObj);
      if (!r) return null;
      return {
        value: r.values["--next-op"],
        matched: r.matched > 0,
        coordIndex: r.coordIndex,
        fromDispatch: r.fromDispatch
      };
    }

    function coordToIndex(coordObj) {
      let index = 0;
      const dims = state.compiled.dims;
      for (let i = 0; i < dims.length; i++) {
        const d = dims[i];
        const v = (coordObj[d.name] !== undefined) ? String(coordObj[d.name]) : d.values[0];
        let k = d.values.indexOf(v);
        if (k < 0) k = 0;
        index = index * d.values.length + k;
      }
      return index;
    }

    // Inverse of coordToIndex. Last dim varies fastest, matching the
    // shader's unpack_coord. Reads state.compiled.dims at call time so
    // it stays correct across recompiles.
    function coordFromIndex(idx) {
      return makeCoordFromIndex(state.compiled.dims)(idx);
    }

    // ----------------------------------------------------------------------
    // Reductions over the resolved field
    //
    // These read the most recent readback only (no extra GPU work). They
    // surface answers that exist as a property of the full resolved coord
    // space, which is something the kernel evaluator and CSS substrate
    // cannot produce -- both of those only ever resolve the active coord.
    //
    // Per SE-11 (dimensional resolution): the GPU's contribution as a
    // substrate is the whole resolved field every dispatch. Reductions
    // over that field are the discrimination the GPU axis adds.
    // ----------------------------------------------------------------------

    // Reduction primitives -- thin wrappers around the pure helpers at
    // the top of this module, so they're testable without a GPU.
    function countByValue(propertyName) {
      return pureCountByValue(state.latestResult, state.compiled.outputs, propertyName);
    }
    function coordsMatching(propertyName, value) {
      return pureCoordsMatching(state.latestResult, state.compiled.outputs, propertyName, value, coordFromIndex);
    }
    function matchedCoordCount() {
      return pureMatchedCoordCount(state.latestResult);
    }

    function diagnostics() {
      return {
        dispatchCount: state.dispatchCount,
        readbackCount: state.readbackCount,
        inFlight:      state.inFlight,
        latestDispatch: state.latestResult ? state.latestResult.tick : null,
        stateSpaceSize: state.compiled.stateSpaceSize,
        instructionCount: state.compiled.instructions.length,
        outputs: {
          properties: state.compiled.outputs.properties.slice(),
          opTables:   state.compiled.outputs.opTables.map(function (t) { return t.slice(); })
        },
        dims:           state.compiled.dims.map(function (d) { return { name: d.name, card: d.values.length }; }),
        lastError:      state.lastError ? String(state.lastError.message || state.lastError) : null
      };
    }

    function teardown() {
      try {
        for (const k of ["constantsBuf", "instructionsBuf", "outputsBuf", "readbackBuf"]) {
          if (state[k]) state[k].destroy();
        }
        device.destroy();
      } catch (_) {}
    }

    return Object.freeze({
      dispatch:    dispatch,
      latest:      function () { return state.latestResult; },
      opForCoord:  opForCoord,
      resolveCoord: resolveCoord,
      coordToIndex: coordToIndex,
      coordFromIndex: coordFromIndex,
      countByValue: countByValue,
      coordsMatching: coordsMatching,
      matchedCoordCount: matchedCoordCount,
      recompile:   recompile,
      diagnostics: diagnostics,
      teardown:    teardown,
      outputs:     function () {
        return {
          properties: state.compiled.outputs.properties.slice(),
          opTables: state.compiled.outputs.opTables.map(function (t) { return t.slice(); })
        };
      }
    });
  }

  const GpuCascadeRunner = Object.freeze({
    detectSupport: detectSupport,
    create:        create,
    // Pure reduction helpers exposed for testing without a GPU.
    pureCountByValue:      pureCountByValue,
    pureCoordsMatching:    pureCoordsMatching,
    pureMatchedCoordCount: pureMatchedCoordCount,
    makeCoordFromIndex:    makeCoordFromIndex
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = GpuCascadeRunner;
  } else {
    global.GpuCascadeRunner = GpuCascadeRunner;
  }

})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));
