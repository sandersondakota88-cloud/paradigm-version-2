// ============================================================================
// gpu-path.js  -  WebGPU host code for the compute-shader constraint path
// ============================================================================
// This file is browser-only. Node does not have navigator.gpu.
//
// Responsibilities:
//   1. Request adapter + device (detect absence of WebGPU and fail cleanly).
//   2. Compile resolve.wgsl into a pipeline.
//   3. Allocate three buffers:
//        - uniform: Constants (state_space_size, instruction_count, dim_count,
//          dim_cards) -- matches the struct in resolve.wgsl
//        - storage read: the compiled instruction buffer (Uint32Array from
//          compile-constraints.js)
//        - storage read_write: outputs array (6 u32s per coord * 2880 coords)
//   4. Dispatch (ceil(2880 / 64) = 45 workgroups).
//   5. Copy outputs back, unpack into records, return an array of index-valued
//      output records shaped like oracle.js's output.
//
// The harness (harness.js) then compares these byte-for-byte against the
// JS oracle's output. If they match, the full GPU path is validated. If
// they don't, the JS oracle output serves as the diagnostic reference
// because it is already proven correct by test-oracle.js.
// ============================================================================

// This file is written as an ES module for the browser. Load it via
// <script type="module"> from index.html.

import {
  DIMS, STATE_SPACE_SIZE, SPEC_VERSION
} from "./constraints.mjs";  // see note below about .mjs vs .js

// Note on module interop:
// The Node test (test-oracle.js) uses CommonJS (require). The browser
// harness needs ES modules. We keep both working by shipping constraints.js
// as CJS and also exposing an ES-module shim at constraints.mjs that
// re-exports the same values. See constraints.mjs (generated alongside).

const OP_CODES_USED = "see compile-constraints.js for authoritative list";

// Human-readable WebGPU-error reporter.
function reportError(where, err) {
  console.error("[gpu-path] " + where + ": " + (err && err.message ? err.message : err));
}

// Detect WebGPU support. Returns { supported: bool, reason?: string }.
export function detectSupport() {
  if (typeof navigator === "undefined" || !navigator.gpu) {
    return { supported: false, reason: "navigator.gpu is not available in this browser" };
  }
  return { supported: true };
}

// Full GPU path: compile -> dispatch -> read back -> shape into records.
// `instructions` is a Uint32Array produced by compileAll().
// Returns Promise<Array<Record>> where each record is
//   { sdf: i32, rt: u32, rth: u32, doc: u32, reg: u32, deny: u32 }
// indexed by linear coord (matches oracle.executeAll output shape).
export async function runGpuPath(instructions, wgslSource) {
  const support = detectSupport();
  if (!support.supported) throw new Error(support.reason);

  // ---- Device setup ------------------------------------------------------
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("navigator.gpu.requestAdapter() returned null");
  const device = await adapter.requestDevice();

  // Surface device errors (uncaptured validation errors, OOM, etc.)
  device.addEventListener("uncapturederror", (e) => reportError("uncapturederror", e.error));

  // ---- Shader module -----------------------------------------------------
  const module = device.createShaderModule({
    label: "resolve.wgsl",
    code: wgslSource
  });

  // ---- Constants uniform -------------------------------------------------
  // Layout (matches resolve.wgsl Constants struct):
  //   state_space_size:  u32
  //   instruction_count: u32
  //   dim_count:         u32
  //   _pad:              u32
  //   dim_cards[0]: vec4<u32>  -> cards for dims 0..3
  //   dim_cards[1]: vec4<u32>  -> cards for dims 4..7
  // Total: 4 u32s + 2*4 u32s = 12 u32s = 48 bytes.
  const constantsArr = new Uint32Array(12);
  constantsArr[0] = STATE_SPACE_SIZE;
  constantsArr[1] = instructions.length;
  constantsArr[2] = DIMS.length;
  constantsArr[3] = 0; // pad
  // dim_cards[0].xyzw
  constantsArr[4]  = DIMS[0] ? DIMS[0].values.length : 0;
  constantsArr[5]  = DIMS[1] ? DIMS[1].values.length : 0;
  constantsArr[6]  = DIMS[2] ? DIMS[2].values.length : 0;
  constantsArr[7]  = DIMS[3] ? DIMS[3].values.length : 0;
  // dim_cards[1].xyzw
  constantsArr[8]  = DIMS[4] ? DIMS[4].values.length : 0;
  constantsArr[9]  = DIMS[5] ? DIMS[5].values.length : 0;
  constantsArr[10] = DIMS[6] ? DIMS[6].values.length : 0;
  constantsArr[11] = DIMS[7] ? DIMS[7].values.length : 0;

  const constantsBuf = device.createBuffer({
    label: "constants",
    size: constantsArr.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  device.queue.writeBuffer(constantsBuf, 0, constantsArr);

  // ---- Instructions buffer -----------------------------------------------
  const instructionsBuf = device.createBuffer({
    label: "instructions",
    size: instructions.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  });
  device.queue.writeBuffer(instructionsBuf, 0, instructions);

  // ---- Outputs buffer ----------------------------------------------------
  // 6 u32s per coord (sdf reinterpreted as i32 in the shader, but same 4 bytes).
  const OUTPUT_U32S_PER_COORD = 6;
  const outputsByteSize = STATE_SPACE_SIZE * OUTPUT_U32S_PER_COORD * 4;
  const outputsBuf = device.createBuffer({
    label: "outputs",
    size: outputsByteSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
  });

  // Readback buffer (outputsBuf is not MAP_READ-capable when it's STORAGE).
  const readbackBuf = device.createBuffer({
    label: "readback",
    size: outputsByteSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
  });

  // ---- Pipeline + bind group --------------------------------------------
  const pipeline = device.createComputePipeline({
    label: "resolve",
    layout: "auto",
    compute: { module, entryPoint: "main" }
  });

  const bindGroup = device.createBindGroup({
    label: "bindings",
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: constantsBuf } },
      { binding: 1, resource: { buffer: instructionsBuf } },
      { binding: 2, resource: { buffer: outputsBuf } }
    ]
  });

  // ---- Dispatch ----------------------------------------------------------
  const workgroupSize = 64;
  const workgroupCount = Math.ceil(STATE_SPACE_SIZE / workgroupSize); // 45

  const encoder = device.createCommandEncoder({ label: "resolve-encoder" });
  const pass = encoder.beginComputePass({ label: "resolve-pass" });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(workgroupCount);
  pass.end();

  encoder.copyBufferToBuffer(outputsBuf, 0, readbackBuf, 0, outputsByteSize);
  device.queue.submit([encoder.finish()]);

  // ---- Readback ----------------------------------------------------------
  await readbackBuf.mapAsync(GPUMapMode.READ);
  const mapped = readbackBuf.getMappedRange();
  // Copy because unmap invalidates the view.
  const raw = new Uint32Array(mapped.slice(0));
  readbackBuf.unmap();

  // ---- Shape into records ------------------------------------------------
  // Struct field order (from resolve.wgsl):
  //   Output { sdf: i32, rth: u32, rt: u32, doc: u32, reg: u32, deny: u32 }
  // Read sdf as signed by reinterpreting the bit pattern.
  const results = new Array(STATE_SPACE_SIZE);
  const sdfView = new Int32Array(raw.buffer);
  for (let i = 0; i < STATE_SPACE_SIZE; i++) {
    const base = i * OUTPUT_U32S_PER_COORD;
    results[i] = {
      sdf:  sdfView[base + 0],
      rth:  raw[base + 1] >>> 0,
      rt:   raw[base + 2] >>> 0,
      doc:  raw[base + 3] >>> 0,
      reg:  raw[base + 4] >>> 0,
      deny: raw[base + 5] >>> 0
    };
  }

  // ---- Cleanup -----------------------------------------------------------
  constantsBuf.destroy();
  instructionsBuf.destroy();
  outputsBuf.destroy();
  readbackBuf.destroy();
  device.destroy();

  return results;
}
