// ============================================================================
// resolve.wgsl  -  WebGPU compute shader for constraint geometry resolution
// ============================================================================
// Dispatches 2880 invocations (the state space size). Each invocation walks
// the postfix instruction buffer once, maintaining a small condition stack,
// and writes one Output record to the outputs buffer.
//
// Semantics MUST match oracle.js byte-for-byte. If you change one, change the
// other. The Node-side harness verifies oracle.js against css-oracle.js; this
// shader's correctness reduces to "does oracle.js do the right thing", which
// is tested.
//
// Opcodes (see compile-constraints.js for the authoritative list):
//   0x01 MATCH_DIM   a=dim_index  b=value_index
//   0x02 AND
//   0x10 BEGIN_THEN
//   0x11 SET_SDF     a in {0, 1}   0 => -1, 1 => +1
//   0x12 SET_RT      a=rt_index
//   0x13 SET_RTH     a=rth_value (0..255)
//   0x14 SET_DOC     a=doc_index
//   0x15 SET_REG     a=reg_index
//   0x16 SET_DENY    a=deny_index
//   0xFF END_RULE
// ============================================================================

struct Constants {
  state_space_size:  u32,   // 2880 for the loan domain
  instruction_count: u32,   // length of the instructions array
  dim_count:         u32,   // 6
  _pad:              u32,
  // Per-dim cardinalities, packed into 2 vec4<u32>s. Up to 8 dims supported.
  // For 6 dims only the first 6 slots are used.
  dim_cards: array<vec4<u32>, 2>,
}

// Fixed-width output, 24 bytes per coord. Matches constraints.md section 5.
struct Output {
  sdf:  i32,
  rth:  u32,
  rt:   u32,
  doc:  u32,
  reg:  u32,
  deny: u32,
}

@group(0) @binding(0) var<uniform>            constants:    Constants;
@group(0) @binding(1) var<storage, read>      instructions: array<u32>;
@group(0) @binding(2) var<storage, read_write> outputs:     array<Output>;

// Unpack a linear coord index into the per-dim value index array.
// Last dim varies fastest (matches constraints.js unpackCoord).
// Returns values indexed by dim; unused dims (> dim_count) are zero.
fn unpack_coord(i: u32) -> array<u32, 8> {
  var out: array<u32, 8>;
  var remainder: u32 = i;
  // Iterate from last dim down. constants.dim_count <= 8.
  for (var d: i32 = i32(constants.dim_count) - 1; d >= 0; d = d - 1) {
    let idx: u32 = u32(d);
    // Look up cardinality for dim idx from dim_cards[0 or 1].
    var card: u32 = 0u;
    if (idx < 4u) {
      let v = constants.dim_cards[0];
      if      (idx == 0u) { card = v.x; }
      else if (idx == 1u) { card = v.y; }
      else if (idx == 2u) { card = v.z; }
      else                { card = v.w; }
    } else {
      let v = constants.dim_cards[1];
      if      (idx == 4u) { card = v.x; }
      else if (idx == 5u) { card = v.y; }
      else if (idx == 6u) { card = v.z; }
      else                { card = v.w; }
    }
    out[idx] = remainder % card;
    remainder = remainder / card;
  }
  return out;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let coord_index = gid.x;
  if (coord_index >= constants.state_space_size) { return; }

  let coord = unpack_coord(coord_index);

  // Default output record: sdf=-1, rest zero (UNCLASSIFIED / BASIC / VALID / "").
  var sdf:  i32 = -1;
  var rt:   u32 = 0u;
  var rth:  u32 = 0u;
  var doc:  u32 = 0u;
  var reg:  u32 = 0u;
  var deny: u32 = 0u;

  // Condition stack. Small fixed depth -- compiler never pushes more than
  // 6 booleans before reducing via AND.
  var stack: array<u32, 8>;
  var sp: u32 = 0u;

  var skipping: bool = false;
  var pc: u32 = 0u;

  loop {
    if (pc >= constants.instruction_count) { break; }
    let inst = instructions[pc];
    let op = inst & 0xFFu;
    let a  = (inst >> 8u)  & 0xFFu;
    let b  = (inst >> 16u) & 0xFFu;

    if (skipping) {
      if (op == 0xFFu) { // END_RULE
        skipping = false;
      }
      pc = pc + 1u;
      continue;
    }

    switch (op) {
      case 0x01u: { // MATCH_DIM a=dim_index b=value_index
        let v: u32 = coord[a];
        if (v == b) { stack[sp] = 1u; } else { stack[sp] = 0u; }
        sp = sp + 1u;
      }
      case 0x02u: { // AND
        // sp >= 2 by construction of the compiler.
        let top  = stack[sp - 1u];
        let next = stack[sp - 2u];
        stack[sp - 2u] = top & next;
        sp = sp - 1u;
      }
      case 0x10u: { // BEGIN_THEN -- pop condition
        sp = sp - 1u;
        let cond = stack[sp];
        if (cond == 0u) { skipping = true; }
      }
      case 0x11u: { // SET_SDF: a in {0, 1}, 0 => -1, 1 => +1
        if (a == 1u) { sdf = 1; } else { sdf = -1; }
      }
      case 0x12u: { rt   = a; }                          // SET_RT
      case 0x13u: { rth  = a; }                          // SET_RTH
      case 0x14u: { doc  = a; }                          // SET_DOC
      case 0x15u: { reg  = a; }                          // SET_REG
      case 0x16u: { deny = a; }                          // SET_DENY
      case 0xFFu: { /* END_RULE: nothing to do when not skipping */ }
      default: {
        // Unknown opcode: we would prefer to abort the kernel. WGSL has no
        // assertion mechanism; we clamp to a definitely-invalid output so
        // the harness's byte-comparison flags the coord immediately.
        sdf = 2;
        break;
      }
    }
    pc = pc + 1u;
  }

  // Post-process: sdf==1 implies DENIED region (reg index 1) and rth=0.
  if (sdf == 1) {
    reg = 1u;
    rth = 0u;
  }

  outputs[coord_index] = Output(sdf, rth, rt, doc, reg, deny);
}
