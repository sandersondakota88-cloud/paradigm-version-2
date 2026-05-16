// er-engine.js - Experiential Reality engine (Phase 2)

"use strict";

(function (global) {

const ER_STATE = Object.freeze({
IDLE:            "idle",
INITIALIZING:    "initializing",
GPU_READY:       "gpu-ready",
CPU_FALLBACK:    "cpu-fallback",
ERROR:           "error"
});

class ERengine {
constructor() {
this.state         = ER_STATE.IDLE;
this.gpuDevice     = null;
this.shaderModule  = null;
this.pipeline      = null;
this.lastError     = null;
this.framesRun     = 0;
this.lastDispatchMS= 0;
// last-emitted match results (for the host to read)
this.lastMatch     = null;
this.lastInput     = "";
this.lastCompiled  = null;
}

// ––––––––––––––––––––––––––––––––
// Initialization. Try to acquire a WebGPU device; on failure, set
// CPU_FALLBACK and continue. Either path is a valid implementation
// of SE-06’s substrate-independence commitment.
// ––––––––––––––––––––––––––––––––
async init(shaderSourceFetcher) {
this.state = ER_STATE.INITIALIZING;
try {
if (typeof navigator === "undefined" || !navigator.gpu) {
this.state = ER_STATE.CPU_FALLBACK;
this.lastError = "navigator.gpu unavailable";
return this.state;
}
const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
this.state = ER_STATE.CPU_FALLBACK;
this.lastError = "no GPU adapter";
return this.state;
}
this.gpuDevice = await adapter.requestDevice();
const shaderSource = await shaderSourceFetcher();
this.shaderModule = this.gpuDevice.createShaderModule({ code: shaderSource });
this.pipeline = this.gpuDevice.createComputePipeline({
layout: "auto",
compute: { module: this.shaderModule, entryPoint: "main" }
});
this.state = ER_STATE.GPU_READY;
return this.state;
} catch (e) {
this.state = ER_STATE.CPU_FALLBACK;
this.lastError = e && e.message ? e.message : String(e);
return this.state;
}
}

// ––––––––––––––––––––––––––––––––
// Evaluate the current field against the current input. Returns
// a Uint32Array of match results (one entry per constraint).
//
// This is the per-frame operation. The host calls this each frame
// it wants resolution. A frame without input still runs (the
// architecture operates indefinitely; idle frames refresh the
// vector-delta).
// ––––––––––––––––––––––––––––––––
evaluate(compiled, inputRecord) {
this.lastCompiled = compiled;
if (this.state === ER_STATE.GPU_READY) {
const t0 = (typeof performance !== "undefined") ? performance.now() : 0;
try {
const result = this._evaluateGPU(compiled, inputRecord);
const t1 = (typeof performance !== "undefined") ? performance.now() : 0;
this.lastDispatchMS = t1 - t0;
this.framesRun++;
this.lastMatch = result;
return result;
} catch (e) {
// GPU eval failed mid-flight; switch to CPU fallback for this and
// future frames. Algorithm 16’s substrate-equivalence guarantees
// the fallback produces identical results.
this.state = ER_STATE.CPU_FALLBACK;
this.lastError = "GPU eval error: " + (e && e.message ? e.message : String(e));
}
}
// CPU fallback path
const t0 = (typeof performance !== "undefined") ? performance.now() : 0;
const result = this._evaluateCPU(compiled, inputRecord);
const t1 = (typeof performance !== "undefined") ? performance.now() : 0;
this.lastDispatchMS = t1 - t0;
this.framesRun++;
this.lastMatch = result;
return result;
}

_evaluateCPU(compiled, inputRecord) {
const CpuOracle = (typeof require !== "undefined")
? require("./cpu-oracle.js")
: global.CpuOracle;
return CpuOracle.evaluateField(compiled, inputRecord);
}

_evaluateGPU(compiled, inputRecord) {
const device = this.gpuDevice;
const N = compiled.constraintCount;
if (N === 0) return new Uint32Array(0);

```
// ---- Build buffers from compiled state ----

// Constants uniform buffer (8 u32 = 32 bytes)
const constants = new Uint32Array(8);
constants[0] = N;
constants[1] = compiled.instructions.length;
constants[2] = compiled.tokenTable.count;
constants[3] = compiled.lengthTable.count;
constants[4] = inputRecord.length >>> 0;
constants[5] = inputRecord.flags >>> 0;
constants[6] = inputRecord.tokenBitsLen >>> 0;
constants[7] = 0;

const constantsBuf = device.createBuffer({
  size: constants.byteLength,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
});
device.queue.writeBuffer(constantsBuf, 0, constants);

// Storage buffers
const programOffsetsBuf = this._mkStorageBuf(device, compiled.programOffsets);
const instructionsBuf   = this._mkStorageBuf(device, compiled.instructions);
const tokenPresenceBuf  = this._mkStorageBuf(device, inputRecord.tokenBits);
const lengthRangesBuf   = this._mkStorageBuf(device, compiled.lengthTable.buf);

// Output: match_results, one u32 per constraint
const matchByteLen = N * 4;
const matchResultsBuf = device.createBuffer({
  size: matchByteLen,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
});
const readbackBuf = device.createBuffer({
  size: matchByteLen,
  usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
});

const bindGroup = device.createBindGroup({
  layout: this.pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: constantsBuf       } },
    { binding: 1, resource: { buffer: programOffsetsBuf } },
    { binding: 2, resource: { buffer: instructionsBuf   } },
    { binding: 3, resource: { buffer: tokenPresenceBuf  } },
    { binding: 4, resource: { buffer: lengthRangesBuf   } },
    { binding: 5, resource: { buffer: matchResultsBuf   } }
  ]
});

const encoder = device.createCommandEncoder();
const pass = encoder.beginComputePass();
pass.setPipeline(this.pipeline);
pass.setBindGroup(0, bindGroup);
pass.dispatchWorkgroups(Math.ceil(N / 64));
pass.end();
encoder.copyBufferToBuffer(matchResultsBuf, 0, readbackBuf, 0, matchByteLen);
device.queue.submit([encoder.finish()]);

// Synchronous readback. In a real frame loop this would be
// pipelined; for Phase 2 minimum-viable, we map and read.
// The Promise is awaited by the caller via evaluateAsync if needed.
// For evaluate() we return a sentinel and let the host
// poll lastMatch on the next frame, OR await readbackBuf.mapAsync.
//
// Implementation choice: the host calls evaluateAsync() per frame
// if it wants to await the readback; evaluate() does the synchronous
// CPU fallback when called in non-async context. This file exposes
// both paths.

// For Phase 2 we expose evaluateAsync(); this synchronous evaluate()
// path on GPU is not actually supported (mapAsync is async-only).
// Throw so the caller migrates to evaluateAsync.
throw new Error("GPU path requires evaluateAsync(); use that method.");
```

}

// Async variant for frame-loop callers. Returns Promise<Uint32Array>.
async evaluateAsync(compiled, inputRecord) {
this.lastCompiled = compiled;
if (this.state !== ER_STATE.GPU_READY) {
// CPU path is synchronous; wrap in resolved promise for uniformity
const result = this._evaluateCPU(compiled, inputRecord);
this.framesRun++;
this.lastMatch = result;
return result;
}

```
const t0 = performance.now();
try {
  const device = this.gpuDevice;
  const N = compiled.constraintCount;
  if (N === 0) {
    this.framesRun++;
    this.lastMatch = new Uint32Array(0);
    return this.lastMatch;
  }

  const constants = new Uint32Array(8);
  constants[0] = N;
  constants[1] = compiled.instructions.length;
  constants[2] = compiled.tokenTable.count;
  constants[3] = compiled.lengthTable.count;
  constants[4] = inputRecord.length >>> 0;
  constants[5] = inputRecord.flags >>> 0;
  constants[6] = inputRecord.tokenBitsLen >>> 0;
  constants[7] = 0;

  const constantsBuf = device.createBuffer({
    size: constants.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  device.queue.writeBuffer(constantsBuf, 0, constants);

  const programOffsetsBuf = this._mkStorageBuf(device, compiled.programOffsets);
  const instructionsBuf   = this._mkStorageBuf(device, compiled.instructions);
  const tokenPresenceBuf  = this._mkStorageBuf(device, inputRecord.tokenBits);
  const lengthRangesBuf   = this._mkStorageBuf(device, compiled.lengthTable.buf);

  const matchByteLen = N * 4;
  const matchResultsBuf = device.createBuffer({
    size: matchByteLen,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
  });
  const readbackBuf = device.createBuffer({
    size: matchByteLen,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
  });

  const bindGroup = device.createBindGroup({
    layout: this.pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: constantsBuf       } },
      { binding: 1, resource: { buffer: programOffsetsBuf } },
      { binding: 2, resource: { buffer: instructionsBuf   } },
      { binding: 3, resource: { buffer: tokenPresenceBuf  } },
      { binding: 4, resource: { buffer: lengthRangesBuf   } },
      { binding: 5, resource: { buffer: matchResultsBuf   } }
    ]
  });

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(this.pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(N / 64));
  pass.end();
  encoder.copyBufferToBuffer(matchResultsBuf, 0, readbackBuf, 0, matchByteLen);
  device.queue.submit([encoder.finish()]);

  await readbackBuf.mapAsync(GPUMapMode.READ);
  const view = new Uint32Array(readbackBuf.getMappedRange().slice(0));
  readbackBuf.unmap();

  // Free transient buffers
  constantsBuf.destroy();
  programOffsetsBuf.destroy();
  instructionsBuf.destroy();
  tokenPresenceBuf.destroy();
  lengthRangesBuf.destroy();
  matchResultsBuf.destroy();
  readbackBuf.destroy();

  this.lastDispatchMS = performance.now() - t0;
  this.framesRun++;
  this.lastMatch = view;
  return view;
} catch (e) {
  // Fall back permanently for this engine. Algorithm 16 guarantees
  // the CPU path produces equivalent results.
  this.state = ER_STATE.CPU_FALLBACK;
  this.lastError = "GPU eval error: " + (e && e.message ? e.message : String(e));
  const result = this._evaluateCPU(compiled, inputRecord);
  this.framesRun++;
  this.lastMatch = result;
  return result;
}
```

}

_mkStorageBuf(device, typedArray) {
const buf = device.createBuffer({
size: Math.max(typedArray.byteLength, 4),
usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
});
device.queue.writeBuffer(buf, 0, typedArray);
return buf;
}
}

const ERengineModule = Object.freeze({ ERengine, ER_STATE });

if (typeof module !== "undefined" && module.exports) {
module.exports = ERengineModule;
} else {
global.ERengineModule = ERengineModule;
}

})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));