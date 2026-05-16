// stage1-lexical-typing-substrate.js - SE-10 chain link 1 of N

"use strict";

const crypto = require("crypto");

// ----------------------------------------------------------------------------
// Constants and bounded caps (I5)
// ----------------------------------------------------------------------------

const VERSION = "stage1-1.0.0";
const ASCII_PRINTABLE_LO = 0x20;
const ASCII_PRINTABLE_HI = 0x7E;
const WINDOW_DEFAULT = 32;       // bytes per probe window
const PASS_CAP_DEFAULT = 4;      // multipass bound per window
const ROW_CAP_DEFAULT = 8192;    // active rows; older ages out
const TRACE_CAP_DEFAULT = 4096;  // active trace entries

// Token kinds Stage 1 emits. Each maps to a CSS-resolvable predicate.
// Kinds are CSS idents; values appear as `--token-kind` custom-property
// values in the resolved cascade output.
const KINDS = Object.freeze({
  WHITESPACE:   "WHITESPACE",
  DIGIT_RUN:    "DIGIT_RUN",
  ALPHA_RUN:    "ALPHA_RUN",
  IDENT:        "IDENT",
  STRING_DBL:   "STRING_DBL",
  STRING_SGL:   "STRING_SGL",
  PUNCT_OPEN:   "PUNCT_OPEN",   // ( [ {
  PUNCT_CLOSE:  "PUNCT_CLOSE",  // ) ] }
  PUNCT_SEP:    "PUNCT_SEP",    // , ; : .
  PUNCT_OP:     "PUNCT_OP",     // = + - * / < > ! & | ^ %
  COMMENT_LINE: "COMMENT_LINE", // // ...
  COMMENT_BLK:  "COMMENT_BLK",  // /* ... */
  KEYWORD:      "KEYWORD",      // var, function, return, if, ... (multi-pass: alpha-run + lookup)
  UNKNOWN:      "UNKNOWN"
});

// Multi-pass: keywords are recognised by re-running the cascade with the
// alpha-run text written back as a `data-text` attribute. Rule for KEYWORD
// matches `[data-text="<word>"]` after pass 1 promotes `[data-kind="ALPHA_RUN"]`
// runs to attributes carrying their text.
const KEYWORDS = Object.freeze([
  "var","let","const","function","return","if","else","for","while","do",
  "switch","case","break","continue","new","this","true","false","null","undefined",
  "typeof","instanceof","in","of","class","extends","super","import","export",
  "default","async","await","try","catch","finally","throw"
]);

// ----------------------------------------------------------------------------
// Guards (I1, I2)
// ----------------------------------------------------------------------------

function requireFiniteInt(v, name) {
  if (typeof v !== "number" || !Number.isFinite(v) || Math.floor(v) !== v)
    throw new TypeError(name + " must be finite int");
  return v;
}
function requireString(v, name) {
  if (typeof v !== "string") throw new TypeError(name + " must be string");
  return v;
}
function requireBytes(v, name) {
  if (!(v instanceof Uint8Array || Buffer.isBuffer(v)))
    throw new TypeError(name + " must be Uint8Array or Buffer");
  return v;
}
function asciiOnly(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x09 || (c > 0x0D && c < 0x20) || c > 0x7E) return false;
  }
  return true;
}
function sha256Hex(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

// ----------------------------------------------------------------------------
// The constraint set - Stage 1's typing rules
// ----------------------------------------------------------------------------
//
// Each constraint is a {when, then} pair. `when` matches probe attributes;
// `then` asserts custom-property output. The structure mirrors the canonical
// loan-eligibility constraint shape; the dim names differ because Stage 1
// types bytes, not loan applications.
//
// Probe attribute schema (input surface to the cascade):
//   data-pass     : "1" | "2"     -- which multipass round
//   data-byte0    : "0".."255"    -- first byte's ASCII code as decimal string
//   data-byte0-cls: "ws" | "digit" | "alpha" | "punct-open" | "punct-close"
//                 | "punct-sep" | "punct-op" | "quote-dbl" | "quote-sgl"
//                 | "slash" | "star" | "other"
//   data-run-cls  : same value-set, only set when probe-window is a homogeneous run
//   data-run-len  : "1".."64"
//   data-text     : the run's text (pass 2 only; alpha-runs only; safe set)
//
// Output custom properties (cascade's resolved typing):
//   --token-kind  : one of KINDS
//   --token-conf  : "0".."100"  (confidence 0..1 stored x100 to keep CSS ident-safe)
//
// The constraint set is closed and ASCII-only. All values are CSS-safe.
// ----------------------------------------------------------------------------

const STAGE1_CONSTRAINTS = Object.freeze([
  // Pass 1: classify by run class and length.
  { when: { pass: "1", "run-cls": "ws"          }, then: { kind: KINDS.WHITESPACE,   conf: 100 } },
  { when: { pass: "1", "run-cls": "digit"       }, then: { kind: KINDS.DIGIT_RUN,    conf: 100 } },
  { when: { pass: "1", "run-cls": "alpha"       }, then: { kind: KINDS.ALPHA_RUN,    conf:  90 } },
  { when: { pass: "1", "run-cls": "punct-open"  }, then: { kind: KINDS.PUNCT_OPEN,   conf: 100 } },
  { when: { pass: "1", "run-cls": "punct-close" }, then: { kind: KINDS.PUNCT_CLOSE,  conf: 100 } },
  { when: { pass: "1", "run-cls": "punct-sep"   }, then: { kind: KINDS.PUNCT_SEP,    conf: 100 } },
  { when: { pass: "1", "run-cls": "punct-op"    }, then: { kind: KINDS.PUNCT_OP,     conf: 100 } },

  // Pass 1 detection of comment/string openers - the windowizer marks
  // comment-line, comment-block, and string runs explicitly via run-cls.
  { when: { pass: "1", "run-cls": "comment-line"  }, then: { kind: KINDS.COMMENT_LINE, conf: 100 } },
  { when: { pass: "1", "run-cls": "comment-block" }, then: { kind: KINDS.COMMENT_BLK,  conf: 100 } },
  { when: { pass: "1", "run-cls": "string-dbl"    }, then: { kind: KINDS.STRING_DBL,   conf: 100 } },
  { when: { pass: "1", "run-cls": "string-sgl"    }, then: { kind: KINDS.STRING_SGL,   conf: 100 } },

  // Pass 2: keyword promotion. An ALPHA_RUN with text matching a known
  // keyword is promoted to KEYWORD. This requires data-text written back
  // by pass 1's cascade output -> JS attribute write -> pass 2 cascade.
  ...KEYWORDS.map(function (kw) {
    return {
      when: { pass: "2", "run-cls": "alpha", text: kw },
      then: { kind: KINDS.KEYWORD, conf: 100 }
    };
  }),

  // Pass 2: alpha-run that isn't a keyword is an IDENT.
  // Lower confidence than KEYWORD so KEYWORD wins by selection when both
  // would match (selection is delta-driven; higher conf reduces local delta).
  { when: { pass: "2", "run-cls": "alpha" }, then: { kind: KINDS.IDENT, conf: 80 } }
]);

// ----------------------------------------------------------------------------
// Constraint compiler - to CSS rule text and to oracle programs
// ----------------------------------------------------------------------------
//
// Each constraint produces:
//   * A CSS rule (text) that the browser cascade resolves
//   * An oracle entry (object) that the CPU oracle evaluates
// The two paths are byte-equivalent on output (S2). Browser harness verifies.
//
// Selectors target the probe element by tag-id "#probe" plus attribute
// selectors derived from the `when` map. Outputs are custom-property
// assignments derived from the `then` map.
// ----------------------------------------------------------------------------

const PROBE_SELECTOR_BASE = "#probe";

function compileToCssRule(c) {
  if (!c || typeof c !== "object") return "";
  if (!c.when || !c.then) return "";

  let tail = "";
  const whenKeys = Object.keys(c.when);
  for (let i = 0; i < whenKeys.length; i++) {
    const k = whenKeys[i];
    const v = c.when[k];
    if (typeof v !== "string") return "";
    if (!asciiOnly(v)) return "";
    if (!/^[A-Za-z0-9_-]{0,64}$/.test(k)) return "";
    if (!/^[A-Za-z0-9_./@-]{0,128}$/.test(v)) return "";
    tail += '[data-' + k + '="' + v + '"]';
  }
  const sel = PROBE_SELECTOR_BASE + tail;

  const decls = [];
  if (typeof c.then.kind === "string" && /^[A-Z_][A-Z0-9_]{0,32}$/.test(c.then.kind)) {
    decls.push("--token-kind: " + c.then.kind);
  }
  if (typeof c.then.conf === "number" && Number.isFinite(c.then.conf)) {
    decls.push("--token-conf: " + Math.max(0, Math.min(100, Math.round(c.then.conf))));
  }
  if (decls.length === 0) return "";
  return sel + " { " + decls.join("; ") + "; }";
}

function buildStage1Stylesheet(constraints) {
  // Base rule sets defaults that the cascade will override on match.
  const baseRule =
    PROBE_SELECTOR_BASE + " { " +
    "--token-kind: " + KINDS.UNKNOWN + "; " +
    "--token-conf: 0; }";
  const ruleTexts = [baseRule];
  for (let i = 0; i < constraints.length; i++) {
    const r = compileToCssRule(constraints[i]);
    if (r) ruleTexts.push(r);
  }
  return ruleTexts.join("\n");
}

// ----------------------------------------------------------------------------
// CPU oracle - byte-equivalent to CSS cascade for this constraint set (S2)
// ----------------------------------------------------------------------------
//
// The oracle resolves the same constraints the cascade would resolve, on
// the same probe attributes, producing the same custom-property outputs.
// Resolution semantics:
//   * For each constraint, check whether all `when` attributes match the
//     probe's current attribute values.
//   * Compute specificity as the count of attribute selectors in `when`.
//   * Among matched constraints, the highest specificity wins. Among ties,
//     the later constraint in source order wins. (CSS cascade semantics.)
//   * If nothing matches, fall back to the base rule's defaults.
// This is single-pass by design. Multipass is implemented above the oracle
// by setting new attributes from a prior pass's output and re-running.
// ----------------------------------------------------------------------------

function resolveProbe(probeAttrs, constraints) {
  let chosen = null;
  let chosenSpec = -1;
  let chosenIdx = -1;

  for (let i = 0; i < constraints.length; i++) {
    const c = constraints[i];
    if (!c || !c.when || !c.then) continue;
    const whenKeys = Object.keys(c.when);
    let allMatch = true;
    for (let j = 0; j < whenKeys.length; j++) {
      const k = whenKeys[j];
      if (probeAttrs[k] !== c.when[k]) { allMatch = false; break; }
    }
    if (!allMatch) continue;
    const spec = whenKeys.length;
    if (spec > chosenSpec || (spec === chosenSpec && i > chosenIdx)) {
      chosen = c;
      chosenSpec = spec;
      chosenIdx = i;
    }
  }

  if (!chosen) {
    return Object.freeze({ "token-kind": KINDS.UNKNOWN, "token-conf": 0 });
  }
  return Object.freeze({
    "token-kind": chosen.then.kind,
    "token-conf": Math.max(0, Math.min(100, Math.round(chosen.then.conf | 0)))
  });
}

// ----------------------------------------------------------------------------
// Windowizer - the byte-stream -> probe pipeline (SE-08 intake mechanism)
// ----------------------------------------------------------------------------
//
// The windowizer reads bytes from the input and produces probe records
// (objects with a data-* attribute set) suitable for cascade resolution.
//
// Strategy: greedy run extraction. The windowizer scans bytes left-to-right
// and groups consecutive bytes of the same class into a single window. When
// a class boundary is hit, the run is emitted as one probe; the next run
// begins.
//
// String and comment runs are handled with explicit state because their
// boundaries are content-defined (closing quote, closing */ , end-of-line).
// ----------------------------------------------------------------------------

function classifyByte(b) {
  if (b === 0x20 || b === 0x09 || b === 0x0A || b === 0x0D) return "ws";
  if (b >= 0x30 && b <= 0x39) return "digit";
  if ((b >= 0x41 && b <= 0x5A) || (b >= 0x61 && b <= 0x7A) || b === 0x5F /* _ */) return "alpha";
  if (b === 0x28 || b === 0x5B || b === 0x7B) return "punct-open";
  if (b === 0x29 || b === 0x5D || b === 0x7D) return "punct-close";
  if (b === 0x2C || b === 0x3B || b === 0x3A || b === 0x2E) return "punct-sep";
  if (b === 0x3D || b === 0x2B || b === 0x2D || b === 0x2A || b === 0x2F ||
      b === 0x3C || b === 0x3E || b === 0x21 || b === 0x26 || b === 0x7C ||
      b === 0x5E || b === 0x25) return "punct-op";
  if (b === 0x22) return "quote-dbl";
  if (b === 0x27) return "quote-sgl";
  if (b === 0x2F) return "slash";
  if (b === 0x2A) return "star";
  return "other";
}

function windowize(bytes, opts) {
  bytes = requireBytes(bytes, "bytes");
  opts = opts || {};
  const cap = requireFiniteInt(opts.windowCap || 64, "windowCap");
  const out = [];
  const n = bytes.length;
  let i = 0;

  while (i < n) {
    const b = bytes[i];

    // String literals - explicit state handling
    if (b === 0x22 /* " */ || b === 0x27 /* ' */) {
      const open = b;
      const cls = (open === 0x22) ? "string-dbl" : "string-sgl";
      const start = i;
      i++;  // consume opener
      while (i < n) {
        const c = bytes[i];
        if (c === 0x5C) { i += 2; continue; }  // backslash escape
        if (c === open) { i++; break; }
        if (c === 0x0A || c === 0x0D) break;   // unterminated; bail
        i++;
      }
      out.push(makeProbe(bytes, start, i, cls));
      continue;
    }

    // Line comment
    if (b === 0x2F && i + 1 < n && bytes[i + 1] === 0x2F) {
      const start = i;
      i += 2;
      while (i < n && bytes[i] !== 0x0A && bytes[i] !== 0x0D) i++;
      out.push(makeProbe(bytes, start, i, "comment-line"));
      continue;
    }

    // Block comment
    if (b === 0x2F && i + 1 < n && bytes[i + 1] === 0x2A) {
      const start = i;
      i += 2;
      while (i + 1 < n && !(bytes[i] === 0x2A && bytes[i + 1] === 0x2F)) i++;
      i = Math.min(n, i + 2);
      out.push(makeProbe(bytes, start, i, "comment-block"));
      continue;
    }

    // Run of same-class bytes (capped)
    const cls = classifyByte(b);
    const start = i;
    let end = i + 1;
    while (end < n && (end - start) < cap && classifyByte(bytes[end]) === cls) end++;
    out.push(makeProbe(bytes, start, end, cls));
    i = end;
  }
  return out;
}

function makeProbe(bytes, start, end, cls) {
  const text = bufToString(bytes, start, end);
  return Object.freeze({
    start: start,
    end: end,
    cls: cls,
    text: text,
    attrs: Object.freeze({
      pass: "1",
      "run-cls": cls,
      "run-len": String(end - start),
      "byte0": String(bytes[start]),
      "byte0-cls": cls
    })
  });
}

function bufToString(bytes, start, end) {
  let s = "";
  for (let i = start; i < end; i++) {
    const b = bytes[i];
    if (b >= ASCII_PRINTABLE_LO && b <= ASCII_PRINTABLE_HI) s += String.fromCharCode(b);
    else if (b === 0x09) s += "\\t";
    else if (b === 0x0A) s += "\\n";
    else if (b === 0x0D) s += "\\r";
    else s += "?";
  }
  return s;
}

// ----------------------------------------------------------------------------
// Multipass orchestration
// ----------------------------------------------------------------------------
//
// Pass 1: probe attrs from windowizer. Resolve. Read --token-kind + --token-conf.
// Pass 2: for probes whose pass-1 kind is ALPHA_RUN and whose text is short
//   and ASCII-safe, write `pass: "2"` and `text: <run text>` and re-resolve.
//   Output is either KEYWORD (text matched a known keyword) or IDENT.
// JS does not branch on pass-1 output for control flow; it derives pass-2
// attributes from pass-1 output mechanically (text runs have CSS-safe content
// or get bypassed). The cascade decides KEYWORD vs IDENT based on whether
// `[data-text="<text>"]` matches a keyword constraint.
// ----------------------------------------------------------------------------

function isCssSafeIdentText(s) {
  if (typeof s !== "string") return false;
  if (s.length === 0 || s.length > 32) return false;
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(s);
}

function runMultipass(probe, constraints, passCap) {
  const trace = [];
  let attrs = Object.assign({}, probe.attrs);
  let pass1 = resolveProbe(attrs, constraints);
  trace.push({ pass: 1, attrs: attrs, out: pass1 });

  // Pass 2 eligibility: alpha-run with CSS-safe text
  const eligibleForPass2 = (
    pass1["token-kind"] === KINDS.ALPHA_RUN &&
    isCssSafeIdentText(probe.text)
  );

  if (!eligibleForPass2 || passCap < 2) {
    return Object.freeze({
      probe: probe,
      passes: Object.freeze(trace),
      out: pass1
    });
  }

  attrs = Object.assign({}, attrs, { pass: "2", text: probe.text });
  const pass2 = resolveProbe(attrs, constraints);
  trace.push({ pass: 2, attrs: attrs, out: pass2 });

  return Object.freeze({
    probe: probe,
    passes: Object.freeze(trace),
    out: pass2
  });
}

// ----------------------------------------------------------------------------
// VSF row emission (algorithm 10, 11, 13)
// ----------------------------------------------------------------------------
//
// Row schema for Stage 1:
//   start | end | kind | conf | text | passes
//
// Pipe-delimited, ASCII-only, content-addressed. The hash column is filled
// at row creation (sync sha256 of the row body).
//
// Header triads describe the field's typed dimensions:
//   start: pos0..posN | 0 | maxBytes
//   end:   pos0..posN | 0 | maxBytes
//   kind:  WHITESPACE=0,...,UNKNOWN=K | 0 | K
//   conf:  0..100 | 0 | 100
// ----------------------------------------------------------------------------

function buildRowBody(emission) {
  const start = String(emission.probe.start);
  const end = String(emission.probe.end);
  const kind = emission.out["token-kind"];
  const conf = String(emission.out["token-conf"]);
  const text = sanitizeRowField(emission.probe.text);
  const passes = String(emission.passes.length);
  return [start, end, kind, conf, text, passes].join("|");
}

function sanitizeRowField(s) {
  if (s === null || s === undefined) return "";
  let out = String(s).replace(/[|\r\n,]/g, " ").trim();
  if (out.length > 256) out = out.slice(0, 256);
  return out;
}

function buildHeaderTriads(maxBytes) {
  const kindList = Object.values(KINDS);
  const kindMap = kindList.map(function (k, idx) { return k + "=" + idx; }).join(",");
  return Object.freeze([
    "start:" + maxBytesTriad(maxBytes),
    "end:" + maxBytesTriad(maxBytes),
    "kind:" + kindMap + "|0|" + (kindList.length - 1),
    "conf:" + confTriad()
  ]);
}

function maxBytesTriad(n) {
  return "byte=0|0|" + Math.max(0, n - 1);
}

function confTriad() {
  // 0..100 inclusive, no per-value alphabet.
  return "value=0|0|100";
}

// ----------------------------------------------------------------------------
// Delta and trace at field scope (F2, M5)
// ----------------------------------------------------------------------------

function computeFieldDelta(rows, totalProbes) {
  const totalDims = Math.max(1, totalProbes);
  let resolved = 0;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].kind !== KINDS.UNKNOWN) resolved++;
  }
  const unresolved = totalDims - resolved;
  return +(unresolved / totalDims).toFixed(4);
}

// ----------------------------------------------------------------------------
// The Stage 1 substrate factory
// ----------------------------------------------------------------------------
//
// Each call to createStage1Substrate produces an isolated link in an SE-10
// chain. Independent field, row store, trace, modulation. Passing the same
// bytes into two fresh substrates produces byte-equivalent state (S2) modulo
// per-instance counters.
//
// The substrate exposes:
//   .ingest(bytes)           - run bytes through windowize -> resolve -> emit
//   .getState()              - current rows, trace, delta, version
//   .emitVsf()               - serialize current state as VSF (header + body)
//   .seal()                  - mark current state as sealed; row store becomes
//                              a content-addressed Merkle commitment
//   .stylesheet()            - the stylesheet text Stage 1's cascade is
//                              currently configured to resolve. (For browser
//                              harness; identical content to what the oracle
//                              evaluates.)
// ----------------------------------------------------------------------------

function createStage1Substrate(opts) {
  opts = opts || {};
  const passCap = requireFiniteInt(opts.passCap || PASS_CAP_DEFAULT, "passCap");
  const rowCap = requireFiniteInt(opts.rowCap || ROW_CAP_DEFAULT, "rowCap");
  const traceCap = requireFiniteInt(opts.traceCap || TRACE_CAP_DEFAULT, "traceCap");
  const id = String(opts.id || ("stage1-" + crypto.randomBytes(4).toString("hex")));

  const constraints = STAGE1_CONSTRAINTS;
  const stylesheetText = buildStage1Stylesheet(constraints);

  const rows = [];        // {start,end,kind,conf,text,passes,hash}
  const trace = [];       // {step, op, ...details}
  let step = 0;
  let totalProbesSeen = 0;
  let scalarDelta = 1.0;  // F1: starts unresolved
  let sealed = false;
  let merkleRoot = "";

  // The seed (F1). It is permanent; it is consulted on every operation.
  // It cannot be evicted. Reading it always returns the current scalar
  // delta. Evaluating it does not mutate it, but it forces the field's
  // delta to be computed, which is a structural read of the field's
  // current state.
  const SEED = Object.freeze({
    id: "seed::what-is-delta",
    kind: "seed",
    when: { always: "true" },
    then: { delta: "compute(field)" },
    permanent: true
  });

  function recordTrace(op, detail) {
    if (sealed) return;
    if (trace.length >= traceCap) trace.shift();
    trace.push(Object.freeze({
      step: ++step,
      op: op,
      delta: scalarDelta,
      detail: Object.freeze(detail || {})
    }));
  }

  function ageRowsIfNeeded() {
    while (rows.length > rowCap) rows.shift();
  }

  function ingest(bytes) {
    if (sealed) throw new Error("substrate is sealed; cannot ingest");
    bytes = requireBytes(bytes, "bytes");
    if (bytes.length === 0) return Object.freeze({ emitted: 0, delta: scalarDelta });

    // SE-08: bytes enter at the rendering substrate as input feature records.
    const probes = windowize(bytes, { windowCap: WINDOW_DEFAULT });
    let emittedCount = 0;
    for (let i = 0; i < probes.length; i++) {
      const probe = probes[i];
      totalProbesSeen++;
      const emission = runMultipass(probe, constraints, passCap);
      const body = buildRowBody(emission);
      if (!asciiOnly(body)) continue;
      const hash = sha256Hex(body);
      const row = Object.freeze({
        start: emission.probe.start,
        end: emission.probe.end,
        kind: emission.out["token-kind"],
        conf: emission.out["token-conf"],
        text: emission.probe.text,
        passes: emission.passes.length,
        body: body,
        hash: hash
      });
      rows.push(row);
      ageRowsIfNeeded();
      emittedCount++;
      // Trace per emission, not per pass - keeps trace bounded usefully.
      recordTrace("emit", { hash: hash, kind: row.kind, passes: row.passes });
    }

    // F2: recompute scalar delta at field scope.
    scalarDelta = computeFieldDelta(rows, totalProbesSeen);
    recordTrace("delta-update", { delta: scalarDelta });

    return Object.freeze({ emitted: emittedCount, delta: scalarDelta });
  }

  function getState() {
    return Object.freeze({
      id: id,
      version: VERSION,
      step: step,
      sealed: sealed,
      delta: scalarDelta,
      rows: rows.slice(),
      trace: trace.slice(),
      totalProbesSeen: totalProbesSeen,
      stylesheetHash: sha256Hex(stylesheetText),
      merkleRoot: merkleRoot,
      seed: SEED
    });
  }

  function emitVsf() {
    const headerTriads = buildHeaderTriads(rows.reduce(function (m, r) {
      return Math.max(m, r.end);
    }, 0) || 1);
    const headerSection = headerTriads.join(" | ");
    const bodySection = rows.map(function (r) { return r.body; }).join("\n");
    return headerSection + "\n---\n" + bodySection;
  }

  function seal() {
    if (sealed) return merkleRoot;
    // Merkle root: simple linear hash chain. Sufficient for content-addressing.
    let h = sha256Hex(VERSION + ":" + id);
    for (let i = 0; i < rows.length; i++) {
      h = sha256Hex(h + ":" + rows[i].hash);
    }
    merkleRoot = h;
    sealed = true;
    return merkleRoot;
  }

  function stylesheet() {
    return stylesheetText;
  }

  return Object.freeze({
    id: id,
    version: VERSION,
    constraints: constraints,
    ingest: ingest,
    getState: getState,
    emitVsf: emitVsf,
    seal: seal,
    stylesheet: stylesheet,
    // Exposed for the test harness to verify oracle/cascade equivalence.
    _resolveProbe: function (attrs) { return resolveProbe(attrs, constraints); }
  });
}

// ----------------------------------------------------------------------------
// Module exports
// ----------------------------------------------------------------------------

module.exports = Object.freeze({
  VERSION: VERSION,
  KINDS: KINDS,
  KEYWORDS: KEYWORDS,
  STAGE1_CONSTRAINTS: STAGE1_CONSTRAINTS,
  buildStage1Stylesheet: buildStage1Stylesheet,
  compileToCssRule: compileToCssRule,
  resolveProbe: resolveProbe,
  windowize: windowize,
  classifyByte: classifyByte,
  createStage1Substrate: createStage1Substrate,
  // Pure helpers also exported for tests
  asciiOnly: asciiOnly,
  sha256Hex: sha256Hex
});
