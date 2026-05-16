// resolve-fresh.wgsl - Dynamic constraint resolution shader (Phase 2)

struct Constants {
  constraint_count:    u32,
  instruction_count:   u32,
  token_count:         u32,
  length_range_count:  u32,
  input_length:        u32,
  input_flags:         u32,    // bit 0 digits, bit 1 alpha, bit 2 symbol
  token_bits_len:      u32,    // length of token_presence array (in u32)
  _pad:                u32
}

@group(0) @binding(0) var<uniform>             constants:        Constants;
@group(0) @binding(1) var<storage, read>       program_offsets:  array<u32>;
@group(0) @binding(2) var<storage, read>       instructions:     array<u32>;
@group(0) @binding(3) var<storage, read>       token_presence:   array<u32>;
@group(0) @binding(4) var<storage, read>       length_ranges:    array<u32>;
@group(0) @binding(5) var<storage, read_write> match_results:    array<u32>;

// Test whether a token id is present in the input.
fn token_present(token_id: u32) -> bool {
  let word_idx = token_id >> 5u;        // / 32
  let bit_idx  = token_id & 31u;
  if (word_idx >= constants.token_bits_len) { return false; }
  let word = token_presence[word_idx];
  return (word & (1u << bit_idx)) != 0u;
}

// Evaluate one constraint program. Returns 1 if matched, 0 if not.
// pc starts at the constraint's first instruction; reads up to and including
// CONSTRAINT_END (0xFE). For meta constraints, recursively-similar logic by
// reading the referenced constraint's match result from match_results.
//
// Note: the meta evaluation depends on referenced constraints having been
// evaluated first. We enforce this with a simple constraint: the host
// emits derived/seed/predictive/ratified BEFORE meta in field-array order
// when compiling. (The compiler in constraint-compiler.js preserves the
// original field order; meta constraints reference field-indices which
// the host ensures are lower than the meta's own index.)
//
// In a single-pass parallel model, meta constraints whose referenced
// constraints are at HIGHER indices would race. The current architecture
// emits meta after their refs, but for safety we double-check by reading
// match_results conservatively and treating not-yet-written entries
// (zero-init) as non-match.
fn evaluate_constraint(start_pc: u32) -> u32 {
  var pc: u32 = start_pc;

  loop {
    if (pc >= constants.instruction_count) { return 0u; }
    let inst = instructions[pc];
    let op = inst & 0xFFu;
    let a  = (inst >> 8u)  & 0xFFu;
    let b  = (inst >> 16u) & 0xFFu;

    switch (op) {
      case 0xFEu: {
        // CONSTRAINT_END. Param a=1 marks always-match (seed).
        if (a == 1u) { return 1u; } else {
          // We only reach END without a prior match-op for empty programs
          // (compileBaseConstraint emits END for unencodable constraints).
          // Treat as no-match.
          return 0u;
        }
      }
      case 0x80u: {
        // MATCH_HAS_TOKEN: a = token_id
        if (token_present(a)) { return 1u; } else { return 0u; }
      }
      case 0x81u: {
        // MATCH_LENGTH_RANGE: a = range_id  (lookup in length_ranges)
        let base = a * 2u;
        if (base + 1u >= u32(arrayLength(&length_ranges))) { return 0u; }
        let lo = length_ranges[base];
        let hi = length_ranges[base + 1u];
        if (constants.input_length >= lo && constants.input_length <= hi) {
          return 1u;
        } else {
          return 0u;
        }
      }
      case 0x82u: {
        // MATCH_CHAR_CLASS: a = class_id  (0 digits, 1 alpha, 2 symbol)
        let bit_mask = 1u << a;
        if ((constants.input_flags & bit_mask) != 0u) { return 1u; } else { return 0u; }
      }
      case 0x83u: {
        // MATCH_CO_OCCURS: a = token_id_a, b = token_id_b
        if (token_present(a) && token_present(b)) { return 1u; } else { return 0u; }
      }
      case 0x84u: {
        // MATCH_META: a = ref_count
        // Following PCs (pc+1 through pc+a) contain raw u32 ref indices.
        let ref_count = a;
        var i: u32 = 0u;
        loop {
          if (i >= ref_count) { break; }
          let ref_pc = pc + 1u + i;
          if (ref_pc >= constants.instruction_count) { return 0u; }
          let ref_idx = instructions[ref_pc];
          if (ref_idx >= constants.constraint_count) { return 0u; }
          // Read the referenced constraint's match result.
          // Safe under the ordering invariant: meta indexes higher than refs.
          let ref_match = match_results[ref_idx];
          if (ref_match != 1u) { return 0u; }
          i = i + 1u;
        }
        return 1u;
      }
      default: {
        // Unknown opcode: bail safely
        return 0u;
      }
    }
    // Unreachable; each case returns. Keep loop syntax happy:
    pc = pc + 1u;
  }
  // Defensive fallthrough
  return 0u;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let constraint_idx = gid.x;
  if (constraint_idx >= constants.constraint_count) { return; }

  let start_pc = program_offsets[constraint_idx];
  let result = evaluate_constraint(start_pc);
  match_results[constraint_idx] = result;
}
