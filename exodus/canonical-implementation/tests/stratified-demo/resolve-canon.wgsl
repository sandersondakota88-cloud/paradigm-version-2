// ============================================================================
// resolve-canon.wgsl  -  canon-shape variant of resolve.wgsl
// ============================================================================
// Difference from the canonical shader: NO post-processing step. The original
// shader's lines 156-160 implemented the spec's step-3 derivation
// (sdf:1 => reg:DENIED, rth:0) as post-processing after the instruction loop.
//
// canon/UTF/01-foundations.md section 3 commits the substrate to WHEN:THEN
// shape with no post-processing. This shader honors that commitment: the
// resolved record is exactly what the WHEN:THEN composition produces.
//
// To get the same final output the original shader produced, the canon-shape
// fixture generator (generate-canon-fixtures.js) normalizes every THEN that
// sets sdf:1 to also explicitly set reg:"DENIED" and rth:0. The commitment
// moves from post-processing into the THEN where it belongs.
//
// Use with: tests/stratified-demo/canon-fixtures.json
// ============================================================================

struct Constants {
  state_space_size:  u32,
  instruction_count: u32,
  dim_count:         u32,
  _pad:              u32,
  dim_cards: array<vec4<u32>, 2>,
}

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

  var sdf:  i32 = -1;
  var rt:   u32 = 0u;
  var rth:  u32 = 0u;
  var doc:  u32 = 0u;
  var reg:  u32 = 0u;
  var deny: u32 = 0u;

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
      if (op == 0xFFu) {
        skipping = false;
      }
      pc = pc + 1u;
      continue;
    }

    switch (op) {
      case 0x01u: {
        let v: u32 = coord[a];
        if (v == b) { stack[sp] = 1u; } else { stack[sp] = 0u; }
        sp = sp + 1u;
      }
      case 0x02u: {
        let top  = stack[sp - 1u];
        let next = stack[sp - 2u];
        stack[sp - 2u] = top & next;
        sp = sp - 1u;
      }
      case 0x10u: {
        sp = sp - 1u;
        let cond = stack[sp];
        if (cond == 0u) { skipping = true; }
      }
      case 0x11u: {
        if (a == 1u) { sdf = 1; } else { sdf = -1; }
      }
      case 0x12u: { rt   = a; }
      case 0x13u: { rth  = a; }
      case 0x14u: { doc  = a; }
      case 0x15u: { reg  = a; }
      case 0x16u: { deny = a; }
      case 0xFFu: { /* END_RULE */ }
      default: {
        sdf = 2;
        break;
      }
    }
    pc = pc + 1u;
  }

  // NO post-processing. Canon-shape: the resolved record is exactly what
  // WHEN:THEN composition produced. No derivation across the full record.

  outputs[coord_index] = Output(sdf, rth, rt, doc, reg, deny);
}
