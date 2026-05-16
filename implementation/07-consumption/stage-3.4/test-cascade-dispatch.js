"use strict";
// Simulate the cascade-dispatch round-trip.
// We mimic the cascade's resolution by encoding each rule's
// selector matching as a JS function, then iterate the dispatcher
// just like the browser would.

// === Cascade rules (mirrored from cascade-dispatch-demo.html) ===
var rules = [
  // base
  function (c) {
    return {
      "--phase": "idle",
      "--next-op": "noop",
      "--display-tokens": "0",
      "--display-result": "0",
      "--display-error": "0"
    };
  },
  // input-present + idle => parse
  function (c) {
    if (c["data-input-present"] === "1" && c["data-phase"] === "idle") {
      return { "--next-op": "parse", "--phase": "parsing" };
    }
    return null;
  },
  // parsed => evaluate
  function (c) {
    if (c["data-phase"] === "parsed") {
      return { "--next-op": "evaluate", "--phase": "evaluating", "--display-tokens": "1" };
    }
    return null;
  },
  // evaluated => display
  function (c) {
    if (c["data-phase"] === "evaluated") {
      return { "--next-op": "display", "--phase": "complete",
               "--display-result": "1", "--display-tokens": "1" };
    }
    return null;
  },
  // error-present + not yet shown => format-error
  function (c) {
    if (c["data-error-present"] === "1" && c["data-phase"] !== "error-shown") {
      return { "--next-op": "format-error", "--display-error": "1" };
    }
    if (c["data-error-present"] === "1") {
      // already shown; just keep display flag set
      return { "--display-error": "1" };
    }
    return null;
  }
];

function resolveCascade(coords) {
  var resolved = {};
  for (var i = 0; i < rules.length; i++) {
    var out = rules[i](coords);
    if (out) for (var k in out) resolved[k] = out[k];  // later overrides earlier (cascade order)
  }
  return resolved;
}

// === Operations (mirrored from the demo) ===
var operations = {
  noop: function () { return null; },
  parse: function (c) {
    var expr = c["data-expr"];
    var tokens = [];
    var i = 0;
    try {
      while (i < expr.length) {
        var ch = expr.charAt(i);
        if (ch === " " || ch === "\t") { i++; continue; }
        if (/[0-9.]/.test(ch)) {
          var j = i;
          while (j < expr.length && /[0-9.]/.test(expr.charAt(j))) j++;
          tokens.push({ kind: "num", value: parseFloat(expr.substring(i, j)) });
          i = j; continue;
        }
        if (/[+\-*\/()]/.test(ch)) {
          tokens.push({ kind: "op", value: ch });
          i++; continue;
        }
        throw new Error("unexpected character: '" + ch + "'");
      }
    } catch (e) {
      return { "data-error": e.message, "data-error-present": "1", "data-phase": "errored" };
    }
    var encoded = tokens.map(function (t) { return t.kind === "num" ? String(t.value) : t.value; }).join(" ");
    return { "data-tokens": encoded, "data-phase": "parsed", "data-error-present": "0" };
  },
  evaluate: function (c) {
    var parts = c["data-tokens"].split(" ").filter(function (s) { return s.length > 0; });
    var tokens = parts.map(function (p) {
      if (/^-?[0-9]+(\.[0-9]+)?$/.test(p)) return { kind: "num", value: parseFloat(p) };
      return { kind: "op", value: p };
    });
    try {
      var pos = 0;
      function peek() { return pos < tokens.length ? tokens[pos] : null; }
      function consume() { return tokens[pos++]; }
      function parseExpr() {
        var left = parseTerm();
        while (peek() && peek().kind === "op" && (peek().value === "+" || peek().value === "-")) {
          var op = consume().value;
          var right = parseTerm();
          left = op === "+" ? left + right : left - right;
        }
        return left;
      }
      function parseTerm() {
        var left = parseFactor();
        while (peek() && peek().kind === "op" && (peek().value === "*" || peek().value === "/")) {
          var op = consume().value;
          var right = parseFactor();
          if (op === "/" && right === 0) throw new Error("divide by zero");
          left = op === "*" ? left * right : left / right;
        }
        return left;
      }
      function parseFactor() {
        var t = peek();
        if (!t) throw new Error("unexpected end of expression");
        if (t.kind === "op" && t.value === "(") {
          consume();
          var v = parseExpr();
          var close = consume();
          if (!close || close.value !== ")") throw new Error("missing )");
          return v;
        }
        if (t.kind === "num") { consume(); return t.value; }
        throw new Error("unexpected token: " + t.value);
      }
      var result = parseExpr();
      if (pos !== tokens.length) throw new Error("trailing input");
      return { "data-result": String(result), "data-phase": "evaluated", "data-error-present": "0" };
    } catch (e) {
      return { "data-error": e.message, "data-error-present": "1", "data-phase": "errored" };
    }
  },
  display: function () { return { "data-phase": "complete" }; },
  "format-error": function () { return { "data-phase": "error-shown" }; }
};

function runUntilQuiescent(coords, label) {
  var trace = [];
  var safety = 16;
  while (safety-- > 0) {
    var resolved = resolveCascade(coords);
    var op = (resolved["--next-op"] || "noop").trim();
    if (op === "noop") break;
    var fn = operations[op];
    if (!fn) { trace.push({ cycle: 16-safety, op: op, error: "unknown op" }); break; }
    var writes = fn(coords) || {};
    trace.push({ cycle: 16-safety, op: op, writes: writes });
    for (var k in writes) coords[k] = writes[k];
  }
  return { coords: coords, trace: trace };
}

// === Test cases ===
function makeInitial(expr) {
  var c = {
    "data-input-present": expr.length > 0 ? "1" : "0",
    "data-phase": "idle",
    "data-error-present": "0",
    "data-expr": expr,
    "data-tokens": "",
    "data-result": "",
    "data-error": ""
  };
  return c;
}

var tests = [
  { input: "2+3", expected: 5 },
  { input: "2+3*4", expected: 14 },
  { input: "(2+3)*4", expected: 20 },
  { input: "10/2-1", expected: 4 },
  { input: "1.5+2.5", expected: 4 },
  { input: "10/0", expectedErr: "divide by zero" },
  { input: "2+", expectedErr: "unexpected end" },
  { input: "abc", expectedErr: "unexpected character" }
];

console.log("Cascade-dispatch round-trip tests");
console.log("");
var pass = 0, fail = 0;
for (var i = 0; i < tests.length; i++) {
  var t = tests[i];
  var coords = makeInitial(t.input);
  var run = runUntilQuiescent(coords, t.input);
  var expected = t.expected !== undefined ? String(t.expected) : null;
  var expectedErr = t.expectedErr || null;

  var actualResult = run.coords["data-result"];
  var actualError = run.coords["data-error"];
  var ok = false;
  if (expected !== null) {
    ok = actualResult === expected && actualError === "";
  } else if (expectedErr) {
    ok = actualError.indexOf(expectedErr) >= 0;
  }
  console.log((ok ? "  OK   " : "  FAIL ") + JSON.stringify(t.input).padEnd(12) +
    "cycles=" + run.trace.length +
    " ops=" + run.trace.map(function (x) { return x.op; }).join(",") +
    (expected ? " result=" + actualResult : "") +
    (actualError ? " error=" + actualError : ""));
  if (ok) pass++; else fail++;
}
console.log("");
console.log(pass + "/" + tests.length + " passed");

// Detailed trace of one example
console.log("");
console.log("Detailed trace of '2+3*4':");
var detailedRun = runUntilQuiescent(makeInitial("2+3*4"), "2+3*4");
for (var k = 0; k < detailedRun.trace.length; k++) {
  var entry = detailedRun.trace[k];
  console.log("  cycle " + entry.cycle + " op=" + entry.op);
  for (var key in entry.writes) {
    console.log("    " + key + " <- " + JSON.stringify(entry.writes[key]));
  }
}

process.exit(fail > 0 ? 1 : 0);
