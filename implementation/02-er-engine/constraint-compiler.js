// constraint-compiler.js - Compile field constraints to shader instructions

"use strict";

(function (global) {

const OP = Object.freeze({
MATCH_HAS_TOKEN:    0x80,
MATCH_LENGTH_RANGE: 0x81,
MATCH_CHAR_CLASS:   0x82,
MATCH_CO_OCCURS:    0x83,
MATCH_META:         0x84,
CONSTRAINT_END:     0xFE
});

const CHAR_CLASS = Object.freeze({
digits: 0,
alpha:  1,
symbol: 2
});

// Pack 4 bytes into one u32. Param values must be 0..255.
function pack(op, a, b, c) {
return (op & 0xFF)
| ((a & 0xFF) << 8)
| ((b & 0xFF) << 16)
| ((c & 0xFF) << 24);
}

// Build a token table from the live field. Each unique token referenced by
// any constraint is assigned a small integer id. The id is what the shader
// instructions reference; the table itself is shipped to the shader as a
// separate buffer (lengths + offsets + chars).
function buildTokenTable(constraints) {
const seen = Object.create(null);
const tokens = [];

function intern(tok) {
if (typeof tok !== "string" || tok.length === 0) return -1;
if (Object.prototype.hasOwnProperty.call(seen, tok)) return seen[tok];
const id = tokens.length;
seen[tok] = id;
tokens.push(tok);
return id;
}

for (const c of constraints) {
if (!c.pattern) continue;
if (c.pattern.type === "has-token") intern(c.pattern.token);
else if (c.pattern.type === "co-occurs") {
intern(c.pattern.a);
intern(c.pattern.b);
}
}

// Pack tokens into a flat byte buffer + offsets/lengths.
// chars layout: [t0_byte0, t0_byte1, …, t1_byte0, …]
// offsets[i] = starting index of token i; lengths[i] = byte count.
const offsets = new Uint32Array(Math.max(1, tokens.length));
const lengths = new Uint32Array(Math.max(1, tokens.length));
let totalBytes = 0;
for (let i = 0; i < tokens.length; i++) {
offsets[i] = totalBytes;
lengths[i] = tokens[i].length;
totalBytes += tokens[i].length;
}
const chars = new Uint8Array(Math.max(1, totalBytes));
let cursor = 0;
for (const t of tokens) {
for (let i = 0; i < t.length; i++) chars[cursor++] = t.charCodeAt(i) & 0xFF;
}

return { tokens, intern: (s) => seen[s] !== undefined ? seen[s] : -1,
offsets, lengths, chars, count: tokens.length };
}

// Build a length-range table. Each unique [min,max] pair gets an id. The
// shader compares input length against the (lo,hi) values stored in this
// table indexed by id. We use a separate table because length values can
// exceed 255 and won’t fit in instruction parameter bytes.
function buildLengthTable(constraints) {
const seen = Object.create(null);
const ranges = [];
function intern(min, max) {
const key = min + ":" + max;
if (Object.prototype.hasOwnProperty.call(seen, key)) return seen[key];
const id = ranges.length;
seen[key] = id;
ranges.push({ min, max });
return id;
}
for (const c of constraints) {
if (c.pattern && c.pattern.type === "length-range") {
intern(c.pattern.min, c.pattern.max);
}
}
// Pack as flat Uint32: [min0, max0, min1, max1, …]
const buf = new Uint32Array(Math.max(2, ranges.length * 2));
for (let i = 0; i < ranges.length; i++) {
buf[i * 2]     = ranges[i].min;
buf[i * 2 + 1] = ranges[i].max;
}
return { ranges, buf, count: ranges.length, internOf: (min, max) => seen[min + ":" + max] };
}

// Build a constraint-id-to-program-offset map so meta refs can be resolved.
// Constraint programs are emitted in field-array order. The map records
// where each program starts in the instruction buffer.
function buildIdMap(constraints) {
const map = Object.create(null);
for (let i = 0; i < constraints.length; i++) {
map[constraints[i].id] = i;       // id -> field index
}
return map;
}

// Compile one base constraint to instructions.
// Returns [u32, u32, …] instructions for this single constraint, ending
// with a CONSTRAINT_END.
function compileBaseConstraint(c, tokenTable, lengthTable) {
const out = [];
if (!c.pattern) {
out.push(pack(OP.CONSTRAINT_END, 0, 0, 0));
return out;
}
const p = c.pattern;
if (p.type === "has-token") {
const id = tokenTable.intern(p.token);
if (id < 0 || id > 255) {
// unencodable -> emit an always-false constraint (just END)
out.push(pack(OP.CONSTRAINT_END, 0, 0, 0));
return out;
}
out.push(pack(OP.MATCH_HAS_TOKEN, id, 0, 0));
} else if (p.type === "length-range") {
const id = lengthTable.internOf(p.min, p.max);
if (id < 0 || id > 255) {
out.push(pack(OP.CONSTRAINT_END, 0, 0, 0));
return out;
}
out.push(pack(OP.MATCH_LENGTH_RANGE, id, 0, 0));
} else if (p.type === "char-class") {
const cls = CHAR_CLASS[p.cls];
if (cls === undefined) {
out.push(pack(OP.CONSTRAINT_END, 0, 0, 0));
return out;
}
out.push(pack(OP.MATCH_CHAR_CLASS, cls, 0, 0));
} else if (p.type === "co-occurs") {
const idA = tokenTable.intern(p.a);
const idB = tokenTable.intern(p.b);
if (idA < 0 || idA > 255 || idB < 0 || idB > 255) {
out.push(pack(OP.CONSTRAINT_END, 0, 0, 0));
return out;
}
out.push(pack(OP.MATCH_CO_OCCURS, idA, idB, 0));
} else {
out.push(pack(OP.CONSTRAINT_END, 0, 0, 0));
return out;
}
out.push(pack(OP.CONSTRAINT_END, 0, 0, 0));
return out;
}

// Compile a meta-constraint (refs other constraints by field-index).
// META takes ref_count and a list of field-indices that follow as
// "naked" u32 entries (not packed instructions).
function compileMetaConstraint(c, idMap) {
const out = [];
if (!c.refs || c.refs.length === 0) {
out.push(pack(OP.CONSTRAINT_END, 0, 0, 0));
return out;
}
// Resolve refs to field indices. Drop refs that don’t resolve.
const indices = [];
for (const refId of c.refs) {
const idx = idMap[refId];
if (idx === undefined) continue;
indices.push(idx);
}
if (indices.length === 0) {
out.push(pack(OP.CONSTRAINT_END, 0, 0, 0));
return out;
}
if (indices.length > 255) indices.length = 255; // safety
out.push(pack(OP.MATCH_META, indices.length, 0, 0));
for (const idx of indices) out.push(idx >>> 0);  // raw u32, not packed
out.push(pack(OP.CONSTRAINT_END, 0, 0, 0));
return out;
}

// Top-level: compile the full live field into:
//   programOffsets[i] = instruction buffer offset where constraint i begins
//   instructions      = the flat u32 instruction buffer
//   tokenTable        = { offsets, lengths, chars, count }
//   lengthTable       = { buf, count }
//   meta              = { count: total constraints compiled }
function compileField(constraints) {
const tokenTable  = buildTokenTable(constraints);
const lengthTable = buildLengthTable(constraints);
const idMap       = buildIdMap(constraints);

const offsets = new Uint32Array(constraints.length);
const allInsts = [];

for (let i = 0; i < constraints.length; i++) {
offsets[i] = allInsts.length;
const c = constraints[i];
if (c.kind === "seed") {
// Seed always-matches by definition. Encode as zero-instruction
// program (just an END, which the shader treats as match=true).
allInsts.push(pack(OP.CONSTRAINT_END, 1, 0, 0));   // a=1 marks always-match
continue;
}
if (c.kind === "meta") {
const block = compileMetaConstraint(c, idMap);
for (const u of block) allInsts.push(u);
continue;
}
// derived, predictive, ratified all use pattern matching
const block = compileBaseConstraint(c, tokenTable, lengthTable);
for (const u of block) allInsts.push(u);
}

return {
constraintCount:  constraints.length,
programOffsets:   offsets,
instructions:     new Uint32Array(allInsts),
tokenTable,
lengthTable
};
}

// ============================================================================
// Pre-compute input record (host side)
// ============================================================================
// The shader doesn’t tokenize. The host pre-computes a fixed-size input
// record: token-presence bitfield (relative to the field’s token table),
// length, and char-class flags. This is uploaded each frame an input
// arrives.

function computeInputRecord(input, tokenTable) {
const lower = (input || "").toLowerCase();
const tokens = lower.split(/\s+/).filter(t => t.length > 0);

// Token presence: bit i set if tokenTable.tokens[i] is present
const tokenBits = new Uint32Array(Math.ceil(Math.max(1, tokenTable.count) / 32));
for (const tok of tokens) {
const id = tokenTable.intern(tok);
if (id >= 0 && id < tokenTable.count) {
tokenBits[Math.floor(id / 32)] |= (1 << (id % 32));
}
}

// Char class flags
let flags = 0;
if (/\d/.test(input))        flags |= 0x1;   // digits
if (/[a-zA-Z]/.test(input))  flags |= 0x2;   // alpha
if (/[^\w\s]/.test(input))   flags |= 0x4;   // symbol

return {
length:    input ? input.length : 0,
flags:     flags,
tokenBits: tokenBits,
tokenBitsLen: tokenBits.length
};
}

// Bit-test helper used by the CPU oracle (must match shader semantics)
function tokenIdPresent(record, tokenId) {
if (tokenId < 0) return false;
const word = tokenId >>> 5;        // /32
const bit  = tokenId & 31;
if (word >= record.tokenBitsLen) return false;
return (record.tokenBits[word] & (1 << bit)) !== 0;
}

// ============================================================================
// Exports
// ============================================================================
const ConstraintCompiler = Object.freeze({
OP,
CHAR_CLASS,
pack,
compileField,
computeInputRecord,
tokenIdPresent
});

if (typeof module !== "undefined" && module.exports) {
module.exports = ConstraintCompiler;
} else {
global.ConstraintCompiler = ConstraintCompiler;
}

})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));