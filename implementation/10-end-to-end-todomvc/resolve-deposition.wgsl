// ============================================================================
// resolve-deposition.wgsl
// ============================================================================
// Canon-shape WGSL compute shader for the deposition's cascade-match rules.
// Per-coord postfix instruction walk, bounded condition stack, skip-on-false
// then-block, no post-processing.
//
// Multi-output:
//   Up to 4 output slots per coord. Each slot holds a u8 intern-index (u32
//   storage) that the host maps to a string via its slot-specific opTable.
//   The shader is slot-agnostic; it executes SET_OUTPUT a=slot b=index.
//   'matched' counts how many rules fired at this coord (0 if none).
//
// Coord-axis sweep (SE-06 / SE-11):
//   One invocation per coord. Each invocation walks the full instruction
//   buffer once. The output buffer holds the resolved record for every
//   coord; the host reads the active coord and (optionally) the full field.
//
// Opcodes (emitted by gpu-cascade-compiler.js):
//   OP_MATCH_DIM    0x01  a=dim_index   b=value_index
//   OP_AND          0x02
//   OP_BEGIN_THEN   0x10
//   OP_SET_OUTPUT   0x12  a=slot        b=intern_index
//   OP_END_RULE     0xFF
// ============================================================================

struct Constants {
  state_space_size:  u32,
  instruction_count: u32,
  dim_count:         u32,
  _pad:              u32,
  dim_cards: array<vec4<u32>, 2>,
}

struct Output {
  slot0:   u32,
  slot1:   u32,
  slot2:   u32,
  slot3:   u32,
  matched: u32,
  _pad0:   u32,
  _pad1:   u32,
  _pad2:   u32,
}

@group(0) @binding(0) var<uniform>             constants:    Constants;
@group(0) @binding(1) var<storage, read>       instructions: array<u32>;
@group(0) @binding(2) var<storage, read_write> outputs:      array<Output>;

fn unpack_coord(i: u32) -> array<u32, 8> {
  var out: array<u32, 8>;
  var remainder: u32 = i;
  for (var d: i32 = i32(constants.dim_count) - 1; d >= 0; d = d - 1) {
    let idx: u32 = u32(d);
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

  var slot0: u32 = 0u;
  var slot1: u32 = 0u;
  var slot2: u32 = 0u;
  var slot3: u32 = 0u;
  var matched: u32 = 0u;

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
      if (op == 0xFFu) { skipping = false; }
      pc = pc + 1u;
      continue;
    }

    switch (op) {
      case 0x01u: { // MATCH_DIM a=dim b=value
        let v: u32 = coord[a];
        if (v == b) { stack[sp] = 1u; } else { stack[sp] = 0u; }
        sp = sp + 1u;
      }
      case 0x02u: { // AND
        let top  = stack[sp - 1u];
        let next = stack[sp - 2u];
        stack[sp - 2u] = top & next;
        sp = sp - 1u;
      }
      case 0x10u: { // BEGIN_THEN: pop condition
        sp = sp - 1u;
        let cond = stack[sp];
        if (cond == 0u) { skipping = true; }
      }
      case 0x12u: { // SET_OUTPUT a=slot b=intern-index
        if      (a == 0u) { slot0 = b; }
        else if (a == 1u) { slot1 = b; }
        else if (a == 2u) { slot2 = b; }
        else if (a == 3u) { slot3 = b; }
        matched = matched + 1u;
      }
      case 0xFFu: { /* END_RULE */ }
      default: {
        slot0 = 0xFFFFFFFFu;
        matched = 0xFFFFFFFFu;
        break;
      }
    }
    pc = pc + 1u;
  }

  outputs[coord_index] = Output(slot0, slot1, slot2, slot3, matched, 0u, 0u, 0u);
}
