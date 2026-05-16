// vsf-codec-min.js - Phase 8 M2 - minimal VSF-style framed codec

"use strict";

const CODEC_VERSION = 1;
const MAX_FRAME_BYTES = 16 * 1024 * 1024;  // 16 MB cap (I3)

// ============================================================================
// Canonical JSON
// ============================================================================
// Deterministic serialization: object keys sorted; no whitespace. Same input
// produces identical bytes; necessary for byte-equivalence verification.
// ============================================================================

function canonicalize(obj) {
  if (obj === null || typeof obj === "undefined") return "null";
  if (typeof obj === "boolean") return obj ? "true" : "false";
  if (typeof obj === "number") {
    if (!isFinite(obj)) return "null";
    return JSON.stringify(obj);
  }
  if (typeof obj === "string") return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    const parts = [];
    for (const v of obj) parts.push(canonicalize(v));
    return "[" + parts.join(",") + "]";
  }
  if (typeof obj === "object") {
    const keys = Object.keys(obj).sort();
    const parts = [];
    for (const k of keys) {
      parts.push(JSON.stringify(k) + ":" + canonicalize(obj[k]));
    }
    return "{" + parts.join(",") + "}";
  }
  return "null";
}

// ============================================================================
// Hash
// ============================================================================
// Reuses chain-composer's hash convention for consistency. djb2-style;
// deterministic, not cryptographic. Same input -> same hash, every run.
// ============================================================================

function hashString(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) & 0xFFFFFFFF;
  }
  return "h" + (h >>> 0).toString(16);
}

// ============================================================================
// Encode
// ============================================================================

function encode(input) {
  if (!input || typeof input !== "object") {
    throw new TypeError("encode: input must be an object");
  }
  if (typeof input.chainId !== "string" || input.chainId.length === 0) {
    throw new TypeError("encode: chainId required");
  }
  if (typeof input.linkIdx !== "number" || !isFinite(input.linkIdx)) {
    throw new TypeError("encode: linkIdx required");
  }
  if (typeof input.produced !== "number" || !isFinite(input.produced)) {
    throw new TypeError("encode: produced required");
  }
  if (!input.artifact || typeof input.artifact !== "object") {
    throw new TypeError("encode: artifact required");
  }

  const innerCanonical = canonicalize(input.artifact);
  const artifactHash = hashString(innerCanonical);

  const frame = {
    v: CODEC_VERSION,
    chainId: input.chainId,
    linkIdx: input.linkIdx,
    produced: input.produced,
    artifactHash: artifactHash,
    artifact: input.artifact
  };

  const bytes = canonicalize(frame);

  if (bytes.length > MAX_FRAME_BYTES) {
    throw new RangeError("encode: frame exceeds MAX_FRAME_BYTES (" +
      bytes.length + " > " + MAX_FRAME_BYTES + ")");
  }

  return bytes;
}

// ============================================================================
// Decode
// ============================================================================
// Returns {ok, frame} | {ok: false, error}.
// Validates: codec version match, all required fields present, artifact
// hash matches the inner artifact's canonical form (integrity).
// ============================================================================

function decode(framedBytes) {
  if (typeof framedBytes !== "string") {
    return { ok: false, error: "decode: framedBytes must be string" };
  }
  if (framedBytes.length > MAX_FRAME_BYTES) {
    return { ok: false, error: "decode: bytes exceed MAX_FRAME_BYTES" };
  }
  let parsed;
  try {
    parsed = JSON.parse(framedBytes);
  } catch (e) {
    return { ok: false, error: "decode: parse failed: " + e.message };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "decode: not an object" };
  }
  if (parsed.v !== CODEC_VERSION) {
    return { ok: false, error: "decode: codec version mismatch (got " +
      parsed.v + ", expected " + CODEC_VERSION + ")" };
  }
  if (typeof parsed.chainId !== "string" || parsed.chainId.length === 0) {
    return { ok: false, error: "decode: chainId missing" };
  }
  if (typeof parsed.linkIdx !== "number") {
    return { ok: false, error: "decode: linkIdx missing" };
  }
  if (typeof parsed.produced !== "number") {
    return { ok: false, error: "decode: produced missing" };
  }
  if (typeof parsed.artifactHash !== "string") {
    return { ok: false, error: "decode: artifactHash missing" };
  }
  if (!parsed.artifact || typeof parsed.artifact !== "object") {
    return { ok: false, error: "decode: artifact missing" };
  }
  // Verify integrity
  const innerCanonical = canonicalize(parsed.artifact);
  const expectedHash = hashString(innerCanonical);
  if (expectedHash !== parsed.artifactHash) {
    return { ok: false, error: "decode: artifactHash mismatch (corruption)" };
  }
  return {
    ok: true,
    frame: {
      v: parsed.v,
      chainId: parsed.chainId,
      linkIdx: parsed.linkIdx,
      produced: parsed.produced,
      artifactHash: parsed.artifactHash,
      artifact: parsed.artifact
    }
  };
}

module.exports = Object.freeze({
  CODEC_VERSION: CODEC_VERSION,
  MAX_FRAME_BYTES: MAX_FRAME_BYTES,
  canonicalize: canonicalize,
  hashString: hashString,
  encode: encode,
  decode: decode
});
