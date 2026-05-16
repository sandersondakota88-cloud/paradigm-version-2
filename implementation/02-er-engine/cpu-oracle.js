// cpu-oracle.js - CPU equivalent of resolve-fresh.wgsl

"use strict";

(function (global) {

const OP = {
MATCH_HAS_TOKEN:    0x80,
MATCH_LENGTH_RANGE: 0x81,
MATCH_CHAR_CLASS:   0x82,
MATCH_CO_OCCURS:    0x83,
MATCH_META:         0x84,
CONSTRAINT_END:     0xFE
};

// Test whether a token id is present in the input. Mirrors token_present()
// in the WGSL shader exactly.
function tokenPresent(record, tokenId) {
if (tokenId < 0) return false;
const wordIdx = tokenId >>> 5;
const bitIdx  = tokenId & 31;
if (wordIdx >= record.tokenBitsLen) return false;
return (record.tokenBits[wordIdx] & (1 << bitIdx)) !== 0;
}

// Walk instructions starting at startPc. Returns 1 if matched, 0 if not.
// Mirrors evaluate_constraint() in the shader exactly.
//
// matchResults is the partially-populated array from prior constraints
// in this same dispatch. Meta lookups read it. The host ensures meta
// constraints come after their refs in field-array order so this is safe.
function evaluateConstraint(
startPc, instructions, instructionCount,
programOffsets, constraintCount,
inputRecord, lengthRanges, matchResults
) {
let pc = startPc;
while (true) {
if (pc >= instructionCount) return 0;
const inst = instructions[pc];
const op = inst & 0xFF;
const a  = (inst >>> 8)  & 0xFF;
const b  = (inst >>> 16) & 0xFF;

```
switch (op) {
  case OP.CONSTRAINT_END:
    // a=1 marks always-match (seed). Otherwise empty/unencodable.
    return (a === 1) ? 1 : 0;

  case OP.MATCH_HAS_TOKEN:
    return tokenPresent(inputRecord, a) ? 1 : 0;

  case OP.MATCH_LENGTH_RANGE: {
    const base = a * 2;
    if (base + 1 >= lengthRanges.length) return 0;
    const lo = lengthRanges[base];
    const hi = lengthRanges[base + 1];
    return (inputRecord.length >= lo && inputRecord.length <= hi) ? 1 : 0;
  }

  case OP.MATCH_CHAR_CLASS: {
    const mask = 1 << a;
    return (inputRecord.flags & mask) !== 0 ? 1 : 0;
  }

  case OP.MATCH_CO_OCCURS:
    return (tokenPresent(inputRecord, a) && tokenPresent(inputRecord, b)) ? 1 : 0;

  case OP.MATCH_META: {
    const refCount = a;
    for (let i = 0; i < refCount; i++) {
      const refPc = pc + 1 + i;
      if (refPc >= instructionCount) return 0;
      const refIdx = instructions[refPc] >>> 0;
      if (refIdx >= constraintCount) return 0;
      if (matchResults[refIdx] !== 1) return 0;
    }
    return 1;
  }

  default:
    return 0;
}
// Each case returns; this is unreachable but we keep loop legal
// pc++;
```

}
}

// Top-level: evaluate the full field. Returns Uint32Array of match results,
// indexed by constraint field-index. Identical to what the shader writes.
function evaluateField(compiled, inputRecord) {
const constraintCount = compiled.constraintCount;
const matchResults = new Uint32Array(constraintCount);
const lengthRanges = compiled.lengthTable.buf;

for (let i = 0; i < constraintCount; i++) {
const startPc = compiled.programOffsets[i];
matchResults[i] = evaluateConstraint(
startPc,
compiled.instructions, compiled.instructions.length,
compiled.programOffsets, constraintCount,
inputRecord, lengthRanges, matchResults
);
}

return matchResults;
}

// ============================================================================
// Exports
// ============================================================================
const CpuOracle = Object.freeze({
OP,
tokenPresent,
evaluateConstraint,
evaluateField
});

if (typeof module !== "undefined" && module.exports) {
module.exports = CpuOracle;
} else {
global.CpuOracle = CpuOracle;
}

})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));