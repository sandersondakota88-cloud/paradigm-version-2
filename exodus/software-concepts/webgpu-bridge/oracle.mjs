// ============================================================================
// oracle.mjs  -  ES module version (mirror of oracle.js)
// ============================================================================

import { STATE_SPACE_SIZE, unpackCoord } from "./constraints.mjs";
import { OP } from "./compile-constraints.mjs";

function execute(instructions, coord) {
  let sdf = -1, rt = 0, rth = 0, doc = 0, reg = 0, deny = 0;

  const stack = new Int8Array(8);
  let sp = 0;
  let skipping = false;
  let pc = 0;
  const n = instructions.length;

  while (pc < n) {
    const inst = instructions[pc];
    const op = (inst >>> 0) & 0xFF;
    const a  = (inst >>> 8) & 0xFF;

    if (skipping) {
      if (op === OP.END_RULE) skipping = false;
      pc++;
      continue;
    }

    switch (op) {
      case OP.MATCH_DIM: {
        const b = (inst >>> 16) & 0xFF;
        stack[sp++] = (coord[a] === b) ? 1 : 0;
        break;
      }
      case OP.AND: {
        if (sp < 2) throw new Error("AND underflow at pc=" + pc);
        const top = stack[--sp];
        stack[sp - 1] = (stack[sp - 1] & top) & 1;
        break;
      }
      case OP.BEGIN_THEN: {
        if (sp < 1) throw new Error("BEGIN_THEN underflow at pc=" + pc);
        const cond = stack[--sp];
        if (cond === 0) skipping = true;
        break;
      }
      case OP.SET_SDF:  sdf  = (a === 1) ? 1 : -1; break;
      case OP.SET_RT:   rt   = a; break;
      case OP.SET_RTH:  rth  = a; break;
      case OP.SET_DOC:  doc  = a; break;
      case OP.SET_REG:  reg  = a; break;
      case OP.SET_DENY: deny = a; break;
      case OP.END_RULE: break;
      default: throw new Error("unknown opcode 0x" + op.toString(16) + " at pc=" + pc);
    }
    pc++;
  }

  if (sdf === 1) {
    reg = 1;
    rth = 0;
  }

  return { sdf, rt, rth, doc, reg, deny };
}

function executeAll(instructions) {
  const out = new Array(STATE_SPACE_SIZE);
  for (let i = 0; i < STATE_SPACE_SIZE; i++) {
    out[i] = execute(instructions, unpackCoord(i));
  }
  return out;
}

export { execute, executeAll };
