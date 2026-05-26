// gpu-lattice-runner.js
// =============================================================================
// Phase 11 Phase 4 — runner for the lattice's joint coord-space resolution.
//
// Provides two execution paths:
//
//   1. cpuWalk(compileResult)
//      Walks the same postfix bytecode the WGSL shader would walk, in JS.
//      Runs Node-side. This is NOT a verification harness — Phase 10's
//      exodus result establishes byte-for-byte equivalence; we trust it.
//      cpuWalk exists so the lattice-scope delta reading can be observed
//      without requiring a browser+WebGPU stack. Same instruction set,
//      same coord unpacking, same per-coord output struct.
//
//   2. createGpuRunner(device)  [browser only]
//      Wraps WebGPU device, compiles the WGSL shader, dispatches the
//      bytecode + uniform buffer + output buffer. Returns the same
//      output structure cpuWalk produces.
//
// Both paths return:
//   {
//     stateSpaceSize:   number,
//     outputs:          Array<Output>,    // one per coord, source-order
//     latticeDelta:     { unresolved, total, scalar }   // F2 at lattice scope
//   }
//
//   Output {
//     slot0..slot3:  u32                // intern-index for each output slot
//     matched:       u32                // # rules that fired at this coord
//   }
// =============================================================================

"use strict";

(function (global) {

  const OP_MATCH_DIM  = 0x01;
  const OP_AND        = 0x02;
  const OP_BEGIN_THEN = 0x10;
  const OP_SET_OUTPUT = 0x12;
  const OP_END_RULE   = 0xFF;

  // ---------------------------------------------------------------------
  // Unpack a coord linear index into per-dim values (matching the
  // shader's unpack_coord). Last dim varies fastest.
  // ---------------------------------------------------------------------
  function unpackCoord(idx, cards) {
    const out = new Array(cards.length);
    let rem = idx;
    for (let d = cards.length - 1; d >= 0; d--) {
      out[d] = rem % cards[d];
      rem = Math.floor(rem / cards[d]);
    }
    return out;
  }

  // ---------------------------------------------------------------------
  // CPU walker — executes the same postfix bytecode the WGSL shader does.
  // Per the Phase 4 design note: this is NOT verification, it's the
  // Node-runnable execution path. Trust transfer comes from Phase 10's
  // empirical record at exodus/.
  // ---------------------------------------------------------------------
  function cpuWalk(compileResult) {
    const inst = compileResult.instructions;
    const dims = compileResult.dims;
    const cards = dims.map(function (d) { return d.values.length; });
    const N = compileResult.stateSpaceSize;

    const outputs = new Array(N);
    let totalMatched = 0;

    for (let coordIdx = 0; coordIdx < N; coordIdx++) {
      const coord = unpackCoord(coordIdx, cards);

      let slot0 = 0, slot1 = 0, slot2 = 0, slot3 = 0;
      let matched = 0;

      const stack = new Uint32Array(8);
      let sp = 0;
      let skipping = false;
      let pc = 0;

      while (pc < inst.length) {
        const u = inst[pc];
        const op = u & 0xFF;
        const a = (u >>> 8) & 0xFF;
        const b = (u >>> 16) & 0xFF;

        if (skipping) {
          if (op === OP_END_RULE) skipping = false;
          pc++;
          continue;
        }

        switch (op) {
          case OP_MATCH_DIM: {
            const v = coord[a];
            stack[sp++] = (v === b) ? 1 : 0;
            break;
          }
          case OP_AND: {
            const top = stack[sp - 1];
            const next = stack[sp - 2];
            stack[sp - 2] = top & next;
            sp--;
            break;
          }
          case OP_BEGIN_THEN: {
            sp--;
            const cond = stack[sp];
            if (cond === 0) skipping = true;
            break;
          }
          case OP_SET_OUTPUT: {
            if (a === 0) slot0 = b;
            else if (a === 1) slot1 = b;
            else if (a === 2) slot2 = b;
            else if (a === 3) slot3 = b;
            matched++;
            break;
          }
          case OP_END_RULE: {
            break;
          }
          default: {
            slot0 = 0xFFFFFFFF;
            matched = 0xFFFFFFFF;
            pc = inst.length;  // break outer
            continue;
          }
        }
        pc++;
      }

      outputs[coordIdx] = { slot0: slot0, slot1: slot1, slot2: slot2, slot3: slot3, matched: matched };
      if (matched > 0 && matched !== 0xFFFFFFFF) totalMatched++;
    }

    // F2 lattice-scope delta. Population = state-space size; unresolved =
    // coords with matched==0. We use the canonical (unresolved + stale*0.5)/N
    // formula with stale=0 here (joint-space resolution has no per-coord
    // staleness concept; the freshness comes from the lattice's per-tick
    // recompile).
    const unresolved = N - totalMatched;
    const scalar = N === 0 ? 1.0 : unresolved / N;

    return {
      stateSpaceSize: N,
      outputs: outputs,
      latticeDelta: {
        unresolved: unresolved,
        matched: totalMatched,
        total: N,
        scalar: scalar
      },
      stats: {
        instructionCount: inst.length,
        coordsResolved: N
      }
    };
  }

  // ---------------------------------------------------------------------
  // Browser-only GPU runner (factored out so this file loads in Node;
  // createGpuRunner returns null when WebGPU is unavailable).
  // ---------------------------------------------------------------------
  async function createGpuRunner(device, shaderSource) {
    if (typeof navigator === "undefined" || !navigator.gpu) {
      return null;
    }
    if (!device || !shaderSource) {
      throw new Error("createGpuRunner: device + shaderSource required");
    }

    const module = device.createShaderModule({ code: shaderSource });
    const pipeline = device.createComputePipeline({
      layout: "auto",
      compute: { module: module, entryPoint: "main" }
    });

    async function dispatch(compileResult) {
      const N = compileResult.stateSpaceSize;
      const dimCount = compileResult.dims.length;

      // Build dim_cards (vec4<u32>[2])
      const dimCards = new Uint32Array(8);
      for (let i = 0; i < dimCount && i < 8; i++) {
        dimCards[i] = compileResult.dims[i].values.length;
      }

      // Uniform buffer: state_space_size, instruction_count, dim_count, _pad,
      // dim_cards (vec4<u32>[2] = 8 u32).
      const uniformData = new Uint32Array(4 + 8);
      uniformData[0] = N;
      uniformData[1] = compileResult.instructions.length;
      uniformData[2] = dimCount;
      uniformData[3] = 0;
      uniformData.set(dimCards, 4);

      const uniformBuf = device.createBuffer({
        size: uniformData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(uniformBuf, 0, uniformData);

      const instBuf = device.createBuffer({
        size: compileResult.instructions.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(instBuf, 0, compileResult.instructions);

      // Output struct: 8 u32 per coord
      const outSize = N * 8 * 4;
      const outBuf = device.createBuffer({
        size: outSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
      });
      const readBuf = device.createBuffer({
        size: outSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });

      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniformBuf } },
          { binding: 1, resource: { buffer: instBuf } },
          { binding: 2, resource: { buffer: outBuf } }
        ]
      });

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      const workgroups = Math.ceil(N / 64);
      pass.dispatchWorkgroups(workgroups);
      pass.end();
      encoder.copyBufferToBuffer(outBuf, 0, readBuf, 0, outSize);
      device.queue.submit([encoder.finish()]);

      await readBuf.mapAsync(GPUMapMode.READ);
      const view = new Uint32Array(readBuf.getMappedRange().slice(0));
      readBuf.unmap();

      const outputs = new Array(N);
      let totalMatched = 0;
      for (let i = 0; i < N; i++) {
        const base = i * 8;
        const matched = view[base + 4];
        outputs[i] = {
          slot0: view[base + 0],
          slot1: view[base + 1],
          slot2: view[base + 2],
          slot3: view[base + 3],
          matched: matched
        };
        if (matched > 0 && matched !== 0xFFFFFFFF) totalMatched++;
      }

      const unresolved = N - totalMatched;
      const scalar = N === 0 ? 1.0 : unresolved / N;

      return {
        stateSpaceSize: N,
        outputs: outputs,
        latticeDelta: {
          unresolved: unresolved,
          matched: totalMatched,
          total: N,
          scalar: scalar
        }
      };
    }

    return { dispatch: dispatch };
  }

  // ---------------------------------------------------------------------
  // Module
  // ---------------------------------------------------------------------
  const GpuLatticeRunner = Object.freeze({
    cpuWalk: cpuWalk,
    createGpuRunner: createGpuRunner
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = GpuLatticeRunner;
  } else {
    global.GpuLatticeRunner = GpuLatticeRunner;
  }

})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));
