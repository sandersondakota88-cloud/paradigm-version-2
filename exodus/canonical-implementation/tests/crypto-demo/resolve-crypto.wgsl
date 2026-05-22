// ============================================================================
// resolve-crypto.wgsl  -  crypto-stratified shader for the SHA-256 cross-
// substrate test.
//
// Same architecture as resolve-canon.wgsl (canon-shape, no post-process), with
// one new opcode:
//
//   OP_SET_HASH_RT  0x20
//     Compute SHA-256 over the predicate bytes (the rule's bytecode from rule
//     start through the last predicate instruction, exclusive of BEGIN_THEN).
//     Take the first 4 bytes of the digest as a big-endian u32. Write that
//     u32 into the `rt` output slot.
//
// The hash input is the same bytes the JS oracle hashes: the predicate u32
// instructions read as little-endian byte sequences (which on all web
// platforms matches Uint32Array byte layout).
//
// The shader implements SHA-256 single-block (input < 56 bytes) which covers
// any realistic predicate prefix in this corpus (max 6 WHEN-keys = 11
// instructions = 44 bytes).
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

// SHA-256 round constants (cube roots of first 64 primes, fractional parts)
const K: array<u32, 64> = array<u32, 64>(
  0x428a2f98u, 0x71374491u, 0xb5c0fbcfu, 0xe9b5dba5u, 0x3956c25bu, 0x59f111f1u, 0x923f82a4u, 0xab1c5ed5u,
  0xd807aa98u, 0x12835b01u, 0x243185beu, 0x550c7dc3u, 0x72be5d74u, 0x80deb1feu, 0x9bdc06a7u, 0xc19bf174u,
  0xe49b69c1u, 0xefbe4786u, 0x0fc19dc6u, 0x240ca1ccu, 0x2de92c6fu, 0x4a7484aau, 0x5cb0a9dcu, 0x76f988dau,
  0x983e5152u, 0xa831c66du, 0xb00327c8u, 0xbf597fc7u, 0xc6e00bf3u, 0xd5a79147u, 0x06ca6351u, 0x14292967u,
  0x27b70a85u, 0x2e1b2138u, 0x4d2c6dfcu, 0x53380d13u, 0x650a7354u, 0x766a0abbu, 0x81c2c92eu, 0x92722c85u,
  0xa2bfe8a1u, 0xa81a664bu, 0xc24b8b70u, 0xc76c51a3u, 0xd192e819u, 0xd6990624u, 0xf40e3585u, 0x106aa070u,
  0x19a4c116u, 0x1e376c08u, 0x2748774cu, 0x34b0bcb5u, 0x391c0cb3u, 0x4ed8aa4au, 0x5b9cca4fu, 0x682e6ff3u,
  0x748f82eeu, 0x78a5636fu, 0x84c87814u, 0x8cc70208u, 0x90befffau, 0xa4506cebu, 0xbef9a3f7u, 0xc67178f2u
);

// Right-rotate u32
fn rotr(x: u32, n: u32) -> u32 {
  return (x >> n) | (x << (32u - n));
}

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

// Compute SHA-256 over a single-block message. msg holds up to 55 bytes
// (so the 0x80 marker plus 8-byte length fits in one 64-byte block).
// Returns the first 4 bytes of the digest packed as a big-endian u32.
fn sha256_first4_u32(msg: array<u32, 16>, msg_byte_len: u32) -> u32 {
  // Build the padded block as 16 u32s in big-endian word order.
  // We received `msg` as 16 u32s holding the message bytes; we need to
  // (a) preserve bytes 0..msg_byte_len-1, (b) write 0x80 at position
  // msg_byte_len, (c) zero through byte 55, (d) write 64-bit big-endian
  // bit-length in bytes 56..63.
  //
  // Layout: each u32 in the block holds 4 big-endian bytes
  // (word[0] = bytes[0..3] as BE u32).
  //
  // Since the input came in as little-endian-byte-sequence words (matching
  // how JavaScript's Uint8Array view of Uint32Array packs them on all web
  // platforms), we need to byte-swap into big-endian word form before
  // hashing -- the JS reference does the same.

  var W: array<u32, 64>;

  // Convert msg (LE-byte u32s) to BE-byte u32s for SHA-256 word format.
  // For each word slot i:
  //   byte[i*4..i*4+3] are bytes from msg in their packed order.
  //   If we have msg_byte_len bytes total, we need to place 0x80 at byte
  //   index msg_byte_len, then zeros, then 64-bit length.

  // First load up to ceil(msg_byte_len/4) words from msg, byteswapping each
  // to BE. Then handle the partial word containing 0x80 padding.
  let full_words = msg_byte_len / 4u;
  let tail_bytes = msg_byte_len - full_words * 4u;

  for (var i: u32 = 0u; i < 16u; i = i + 1u) {
    W[i] = 0u;
  }

  // Full words from msg, byteswapped to BE
  for (var i: u32 = 0u; i < full_words; i = i + 1u) {
    let w = msg[i];
    // LE bytes in w: [b0, b1, b2, b3] = [w&0xff, (w>>8)&0xff, (w>>16)&0xff, (w>>24)&0xff]
    // BE word: b0<<24 | b1<<16 | b2<<8 | b3
    W[i] = ((w & 0xffu) << 24u) | (((w >> 8u) & 0xffu) << 16u) |
           (((w >> 16u) & 0xffu) << 8u) | ((w >> 24u) & 0xffu);
  }

  // Tail bytes from the next partial word, plus the 0x80 marker.
  // The tail occupies bytes [full_words*4 .. msg_byte_len-1].
  // Then 0x80 goes at byte msg_byte_len.
  // Position of 0x80 within the word `full_words`: byte index tail_bytes.
  if (tail_bytes > 0u) {
    let w = msg[full_words];
    var partial: u32 = 0u;
    if (tail_bytes >= 1u) { partial = partial | ((w & 0xffu) << 24u); }
    if (tail_bytes >= 2u) { partial = partial | (((w >> 8u) & 0xffu) << 16u); }
    if (tail_bytes >= 3u) { partial = partial | (((w >> 16u) & 0xffu) << 8u); }
    // Now insert 0x80 at the next byte position within this word
    let shift = (3u - tail_bytes) * 8u;
    partial = partial | (0x80u << shift);
    W[full_words] = partial;
  } else {
    // Whole word break: 0x80 goes at byte 0 of word `full_words`
    W[full_words] = 0x80u << 24u;
  }

  // 64-bit big-endian bit-length goes at W[14], W[15]
  let bit_len = msg_byte_len * 8u;
  W[14] = 0u;          // High 32 bits (we never reach 2^32 bits)
  W[15] = bit_len;

  // Message schedule extension
  for (var i: u32 = 16u; i < 64u; i = i + 1u) {
    let s0 = rotr(W[i - 15u], 7u) ^ rotr(W[i - 15u], 18u) ^ (W[i - 15u] >> 3u);
    let s1 = rotr(W[i - 2u], 17u) ^ rotr(W[i - 2u], 19u) ^ (W[i - 2u] >> 10u);
    W[i] = W[i - 16u] + s0 + W[i - 7u] + s1;
  }

  // Initial hash values
  var a: u32 = 0x6a09e667u;
  var b: u32 = 0xbb67ae85u;
  var c: u32 = 0x3c6ef372u;
  var d: u32 = 0xa54ff53au;
  var e: u32 = 0x510e527fu;
  var f: u32 = 0x9b05688cu;
  var g: u32 = 0x1f83d9abu;
  var h: u32 = 0x5be0cd19u;

  for (var i: u32 = 0u; i < 64u; i = i + 1u) {
    let S1 = rotr(e, 6u) ^ rotr(e, 11u) ^ rotr(e, 25u);
    let ch = (e & f) ^ ((~e) & g);
    let t1 = h + S1 + ch + K[i] + W[i];
    let S0 = rotr(a, 2u) ^ rotr(a, 13u) ^ rotr(a, 22u);
    let mj = (a & b) ^ (a & c) ^ (b & c);
    let t2 = S0 + mj;
    h = g; g = f; f = e;
    e = d + t1;
    d = c; c = b; b = a;
    a = t1 + t2;
  }

  // Final hash word[0] = H0 + a (big-endian)
  let h0 = 0x6a09e667u + a;
  return h0;
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
  var rule_start_pc: u32 = 0u;

  loop {
    if (pc >= constants.instruction_count) { break; }
    let inst = instructions[pc];
    let op = inst & 0xFFu;
    let a  = (inst >> 8u)  & 0xFFu;
    let b  = (inst >> 16u) & 0xFFu;

    if (skipping) {
      if (op == 0xFFu) { skipping = false; rule_start_pc = pc + 1u; }
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
      case 0x11u: { if (a == 1u) { sdf = 1; } else { sdf = -1; } }
      case 0x12u: { rt   = a; }
      case 0x13u: { rth  = a; }
      case 0x14u: { doc  = a; }
      case 0x15u: { reg  = a; }
      case 0x16u: { deny = a; }
      case 0x20u: {
        // SET_HASH_RT: hash predicate prefix bytes from rule_start_pc to
        // current pc (exclusive). Predicate bytes = pred-instruction u32s
        // packed as LE bytes (matching how JS Uint32Array sees them).
        var msg: array<u32, 16>;
        for (var i: u32 = 0u; i < 16u; i = i + 1u) { msg[i] = 0u; }
        let pred_word_count = pc - rule_start_pc - 1u; // exclude BEGIN_THEN
        // Defensive: clamp to 11 words (44 bytes); our messages are small.
        var word_count: u32 = pred_word_count;
        if (word_count > 11u) { word_count = 11u; }
        for (var i: u32 = 0u; i < word_count; i = i + 1u) {
          msg[i] = instructions[rule_start_pc + i];
        }
        rt = sha256_first4_u32(msg, word_count * 4u);
      }
      case 0xFFu: { rule_start_pc = pc + 1u; }
      default: { sdf = 2; break; }
    }
    pc = pc + 1u;
  }

  outputs[coord_index] = Output(sdf, rth, rt, doc, reg, deny);
}
