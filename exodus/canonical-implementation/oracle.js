// ============================================================================
// oracle.js  -  pure-JS stack machine, identical semantics to resolve.wgsl
// ============================================================================
// The GPU path will eventually be WGSL running on real hardware. Before
// trusting the shader, we need to prove the STACK-MACHINE SEMANTICS are
// right. This file is the proving ground: it's a plain-JS interpreter that
// executes the same bytecode the shader will, with the same operational
// rules, producing the same output representation.
//
// If this oracle's output matches the CSS oracle's output byte-for-byte
// across the full state space, the bytecode semantics are correct and the
// remaining work on the GPU side is host-plumbing (device/pipeline/buffers),
// not semantics. That's the whole point of bridging via an explicit
// instruction set.
//
// Correspondence with resolve.wgsl:
//   - Same opcodes, same operand layout
//   - Same default output record (Output(-1, 0, 0, 0, 0, 0))
//   - Same condition-stack model (small bool stack, push/AND-reduce/consume)
//   - Same skipping rule when BEGIN_THEN sees false (advance pc past END_RULE)
//   - Same post-processing: sdf==1 implies reg=DENIED, rth=0
// ============================================================================

"use strict";

const { DIMS, STATE_SPACE_SIZE, unpackCoord } = require("./constraints.js");
const { OP, decode } = require("./compile-constraints.js");

// Execute one coordinate against the compiled instruction buffer.
// `coord` is an array of value indices, one per dim.
// Returns an index-valued record (same shape the WGSL shader emits).
function execute(instructions, coord) {
  // Defaults (as index form):
  //   sdf=-1, rt=0 (UNCLASSIFIED), rth=0, doc=0 (BASIC), reg=0 (VALID), deny=0 ("")
  let sdf = -1, rt = 0, rth = 0, doc = 0, reg = 0, deny = 0;

  // Condition stack. Small fixed depth; the compiler never emits more than
  // 6 MATCH_DIMs in a row (we only have 6 dims) and AND reduces them.
  const stack = new Int8Array(8);
  let sp = 0;

  let skipping = false;
  let pc = 0;
  const n = instructions.length;

  while (pc < n) {
    const inst = instructions[pc];
    const op = (inst >>> 0) & 0xFF;
    const a  = (inst >>> 8) & 0xFF;
    const b  = (inst >>> 16) & 0xFF;

    if (skipping) {
      if (op === OP.END_RULE) {
        skipping = false;
        // Stack should already be empty for a well-compiled program; we
        // do not clear it here because the WGSL will not either. If the
        // compiler ever violates this, the bug surfaces as a stack
        // underflow on a later rule, not as silent miscomputation.
      }
      pc++;
      continue;
    }

    switch (op) {
      case OP.MATCH_DIM: {
        // a = dim index, b = value index. Push 1 if coord[a] == b else 0.
        stack[sp++] = (coord[a] === b) ? 1 : 0;
        break;
      }
      case OP.AND: {
        // Pop two, push AND.
        if (sp < 2) throw new Error("AND underflow at pc=" + pc);
        const top = stack[--sp];
        const next = stack[sp - 1];
        stack[sp - 1] = (top & next) & 1;
        break;
      }
      case OP.BEGIN_THEN: {
        // Pop condition; if 0, skip until END_RULE.
        if (sp < 1) throw new Error("BEGIN_THEN underflow at pc=" + pc);
        const cond = stack[--sp];
        if (cond === 0) {
          skipping = true;
        }
        break;
      }
      case OP.SET_SDF: {
        // a=0 means -1, a=1 means +1
        sdf = (a === 1) ? 1 : -1;
        break;
      }
      case OP.SET_RT:   rt   = a; break;
      case OP.SET_RTH:  rth  = a; break;
      case OP.SET_DOC:  doc  = a; break;
      case OP.SET_REG:  reg  = a; break;
      case OP.SET_DENY: deny = a; break;
      case OP.END_RULE: {
        // A rule finished executing (we were NOT skipping, since the
        // skipping branch is handled above). Nothing to do here; the
        // effects have already been applied. Continue.
        break;
      }
      default: {
        throw new Error("unknown opcode 0x" + op.toString(16) + " at pc=" + pc);
      }
    }
    pc++;
  }

  // Post-processing: sdf==1 implies DENIED region and zeroed rth.
  // This is the derivation step from constraints.md section 4 step 3.
  if (sdf === 1) {
    reg = 1; // DENIED index in REG_TABLE
    rth = 0;
  }

  return { sdf, rt, rth, doc, reg, deny };
}

// Execute across the full state space. Returns array indexed by linear coord.
function executeAll(instructions) {
  const out = new Array(STATE_SPACE_SIZE);
  for (let i = 0; i < STATE_SPACE_SIZE; i++) {
    out[i] = execute(instructions, unpackCoord(i));
  }
  return out;
}

module.exports = { execute, executeAll };
