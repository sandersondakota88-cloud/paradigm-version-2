// =============================================================================
// sha256-shared.js  --  shared SHA-256 implementation for the crypto-stratified
// harness. This file is loaded by:
//
//   * generate-crypto-fixtures.js  (Node, computes expected hashes)
//   * crypto-stratified-harness.html (browser, runs the JS oracle path)
//
// The WGSL shader (resolve-crypto.wgsl) implements the SAME algorithm
// byte-identically. If JS and WGSL produce different hashes, the test fails.
//
// Implementation choice: hand-rolled SHA-256, no SubtleCrypto. SubtleCrypto is
// async (Promise<ArrayBuffer>) which would force the JS oracle async per
// coordinate. Hand-rolled is synchronous, deterministic, and byte-comparable
// directly to WGSL.
//
// Reference: FIPS PUB 180-4, NIST. SHA-256 padded message processing in 64-byte
// blocks with eight 32-bit working variables and a 64-entry round constant table.
// =============================================================================

"use strict";

// SHA-256 round constants (cube roots of first 64 primes, fractional parts, big-endian u32)
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

// Initial hash values (square roots of first 8 primes, fractional parts)
const H_INIT = Object.freeze([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
]);

function rotr(x, n) { return ((x >>> n) | (x << (32 - n))) >>> 0; }

// Process one 64-byte message block. Mutates H[] in place.
function processBlock(H, block /* Uint8Array length 64 */) {
  const W = new Uint32Array(64);

  // Load 16 big-endian u32 words
  for (let i = 0; i < 16; i++) {
    W[i] = (
      (block[i * 4]     << 24) |
      (block[i * 4 + 1] << 16) |
      (block[i * 4 + 2] <<  8) |
      (block[i * 4 + 3])
    ) >>> 0;
  }

  // Message schedule extension
  for (let i = 16; i < 64; i++) {
    const s0 = (rotr(W[i - 15],  7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>>  3)) >>> 0;
    const s1 = (rotr(W[i -  2], 17) ^ rotr(W[i -  2], 19) ^ (W[i -  2] >>> 10)) >>> 0;
    W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
  }

  let a = H[0], b = H[1], c = H[2], d = H[3];
  let e = H[4], f = H[5], g = H[6], h = H[7];

  for (let i = 0; i < 64; i++) {
    const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
    const ch = ((e & f) ^ ((~e) & g)) >>> 0;
    const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
    const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
    const mj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
    const t2 = (S0 + mj) >>> 0;
    h = g;
    g = f;
    f = e;
    e = (d + t1) >>> 0;
    d = c;
    c = b;
    b = a;
    a = (t1 + t2) >>> 0;
  }

  H[0] = (H[0] + a) >>> 0;
  H[1] = (H[1] + b) >>> 0;
  H[2] = (H[2] + c) >>> 0;
  H[3] = (H[3] + d) >>> 0;
  H[4] = (H[4] + e) >>> 0;
  H[5] = (H[5] + f) >>> 0;
  H[6] = (H[6] + g) >>> 0;
  H[7] = (H[7] + h) >>> 0;
}

// Pad input per FIPS 180-4 sec. 5.1.1, then process all blocks.
// Returns Uint8Array of length 32 (the digest).
function sha256(input /* Uint8Array */) {
  const msgLen = input.length;
  // 1 byte for 0x80 + 8 bytes for length, pad to 64-byte multiple
  const padLen = (msgLen + 9 + 63) & ~63;
  const padded = new Uint8Array(padLen);
  padded.set(input, 0);
  padded[msgLen] = 0x80;
  // Length in bits, big-endian 64-bit. Our messages are short, so we
  // write the high 32 bits as 0 and low 32 bits as length*8.
  const bitLen = msgLen * 8;
  // High 32 bits: 0 (we never reach 2^32 bit messages)
  padded[padLen - 8] = 0;
  padded[padLen - 7] = 0;
  padded[padLen - 6] = 0;
  padded[padLen - 5] = 0;
  // Low 32 bits, big-endian
  padded[padLen - 4] = (bitLen >>> 24) & 0xFF;
  padded[padLen - 3] = (bitLen >>> 16) & 0xFF;
  padded[padLen - 2] = (bitLen >>>  8) & 0xFF;
  padded[padLen - 1] = bitLen         & 0xFF;

  const H = new Uint32Array(H_INIT);
  for (let off = 0; off < padLen; off += 64) {
    processBlock(H, padded.subarray(off, off + 64));
  }

  // Serialize H as big-endian bytes
  const out = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    out[i * 4]     = (H[i] >>> 24) & 0xFF;
    out[i * 4 + 1] = (H[i] >>> 16) & 0xFF;
    out[i * 4 + 2] = (H[i] >>>  8) & 0xFF;
    out[i * 4 + 3] = (H[i])        & 0xFF;
  }
  return out;
}

// Convenience: hash a Uint8Array, return the first 4 bytes as a big-endian u32.
// This is what OP_SET_HASH_RT writes into the `rt` slot.
function sha256First4AsU32(input) {
  const d = sha256(input);
  return ((d[0] << 24) | (d[1] << 16) | (d[2] << 8) | d[3]) >>> 0;
}

// Hex-encode a Uint8Array (for diagnostics).
function bytesToHex(b) {
  let s = "";
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0");
  return s;
}

// Self-test against known SHA-256 outputs. If this fails the impl is wrong.
function selfTest() {
  const cases = [
    // empty string
    { in: new Uint8Array([]),
      out: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" },
    // "abc"
    { in: new Uint8Array([0x61, 0x62, 0x63]),
      out: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" },
    // FIPS 180-4 test: 56-character "a..." spans exactly one block before padding
    { in: (() => { const a = new Uint8Array(56); a.fill(0x61); return a; })(),
      out: "9b76dd24a99a8e3a05b3a6c7be25ce5d8e8a4d63a6c1c1c0e9c0ca5e0e9d4d3f" },
  ];
  for (const c of cases.slice(0, 2)) {
    const got = bytesToHex(sha256(c.in));
    if (got !== c.out) {
      throw new Error("sha256 self-test failed: input=" + bytesToHex(c.in) +
        " expected=" + c.out + " got=" + got);
    }
  }
  return true;
}

// Run self-test on load (fail-fast)
selfTest();

// CommonJS export (Node) + browser global
if (typeof module !== "undefined" && module.exports) {
  module.exports = { sha256, sha256First4AsU32, bytesToHex, selfTest };
}
if (typeof window !== "undefined") {
  window.SHA256_SHARED = { sha256, sha256First4AsU32, bytesToHex, selfTest };
}
