// p8-closure-verifier.js - Phase 8 sec 3.1 closure verifier

"use strict";

const fs = require("fs");

const FORBIDDEN_PATTERNS = [
  { name: "localStorage.getItem",     regex: /localStorage\s*\.\s*getItem/g },
  { name: "localStorage.setItem",     regex: /localStorage\s*\.\s*setItem/g },
  { name: "localStorage.removeItem",  regex: /localStorage\s*\.\s*removeItem/g },
  { name: "fetch()",                  regex: /\bfetch\s*\(/g },
  { name: "XMLHttpRequest",           regex: /\bXMLHttpRequest\b/g },
  { name: "WebSocket",                regex: /\bnew\s+WebSocket\b/g },
  { name: "Date.now()",               regex: /\bDate\s*\.\s*now\s*\(/g },
  { name: "new Date()",               regex: /\bnew\s+Date\s*\(/g },
  { name: "performance.now()",        regex: /\bperformance\s*\.\s*now\s*\(/g },
  { name: "window.location",          regex: /\bwindow\s*\.\s*location\b/g },
  { name: "document.cookie",          regex: /\bdocument\s*\.\s*cookie\b/g }
];

const KERNEL_OPEN  = "=== KERNEL RUNTIME ===";
const KERNEL_CLOSE = "=== END KERNEL RUNTIME ===";
const APP_OPEN     = "=== APPLICATION ===";
const APP_CLOSE    = "=== END APPLICATION ===";

function findRange(html, openMarker, closeMarker) {
  const openIdx = html.indexOf(openMarker);
  if (openIdx < 0) return null;
  const closeIdx = html.indexOf(closeMarker, openIdx);
  if (closeIdx < 0) return null;
  return { start: openIdx, end: closeIdx + closeMarker.length };
}

function extractScripts(html) {
  const scripts = [];
  const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  let idx = 0;
  while ((m = re.exec(html)) !== null) {
    scripts.push({
      index: idx++,
      src: m[1],
      offset: m.index,
      endOffset: m.index + m[0].length
    });
  }
  return scripts;
}

function classifyScript(script, kernelRange, appRange) {
  // A script is in a section if its entire body is within the section's range
  if (kernelRange &&
      script.offset >= kernelRange.start &&
      script.endOffset <= kernelRange.end) {
    return "kernel";
  }
  if (appRange &&
      script.offset >= appRange.start &&
      script.endOffset <= appRange.end) {
    return "application";
  }
  // Outside both - treat as kernel-runtime infrastructure (init scripts,
  // status display, etc., emitted by the runtime emitter not migrated
  // from application source).
  return "infrastructure";
}

function scanScript(script) {
  const findings = [];
  const lines = script.src.split("\n");
  for (const pattern of FORBIDDEN_PATTERNS) {
    pattern.regex.lastIndex = 0;
    let match;
    while ((match = pattern.regex.exec(script.src)) !== null) {
      let lineNum = 1;
      let pos = 0;
      for (const line of lines) {
        if (pos + line.length >= match.index) break;
        pos += line.length + 1;
        lineNum++;
      }
      findings.push({
        pattern: pattern.name,
        scriptIndex: script.index,
        lineInScript: lineNum,
        snippet: lines[lineNum - 1] ? lines[lineNum - 1].trim().slice(0, 100) : ""
      });
    }
  }
  return findings;
}

function verify(htmlPath, opts) {
  opts = opts || {};
  const verbose = !!opts.verbose;

  const html = fs.readFileSync(htmlPath, "utf8");
  const scripts = extractScripts(html);
  const kernelRange = findRange(html, KERNEL_OPEN, KERNEL_CLOSE);
  const appRange = findRange(html, APP_OPEN, APP_CLOSE);

  if (verbose) {
    console.log("Phase 8 closure-boundary verifier (sec 3.1)");
    console.log("Input: " + htmlPath);
    console.log("Script blocks: " + scripts.length);
    console.log("Kernel runtime range: " +
      (kernelRange ? "[" + kernelRange.start + ", " + kernelRange.end + ")" : "(absent)"));
    console.log("Application range: " +
      (appRange ? "[" + appRange.start + ", " + appRange.end + ")" : "(absent)"));
    console.log("");
  }

  if (!kernelRange) {
    return {
      ok: false,
      reason: "no KERNEL RUNTIME section markers found",
      violations: 0,
      scripts: scripts.length
    };
  }
  if (!appRange) {
    return {
      ok: false,
      reason: "no APPLICATION section markers found",
      violations: 0,
      scripts: scripts.length
    };
  }

  let totalViolations = 0;
  const violations = [];
  const counts = { kernel: 0, application: 0, infrastructure: 0 };

  for (const script of scripts) {
    const cls = classifyScript(script, kernelRange, appRange);
    counts[cls]++;
    const findings = scanScript(script);

    if (verbose) {
      const label = cls === "kernel" ? "[kernel]" :
                    cls === "application" ? "[application]" :
                    "[infrastructure]";
      console.log("Script " + script.index + " " + label +
        " (" + script.src.length + " bytes, offset " + script.offset + ")");
    }

    if (cls === "application") {
      // Application scripts are scanned for violations
      if (findings.length === 0) {
        if (verbose) console.log("  no forbidden patterns");
      } else {
        if (verbose) console.log("  " + findings.length + " VIOLATIONS:");
        for (const f of findings) {
          if (verbose) {
            console.log("    L" + f.lineInScript + " " + f.pattern + ": " + f.snippet);
          }
          violations.push(f);
          totalViolations++;
        }
      }
    } else if (cls === "kernel") {
      if (verbose) {
        if (findings.length === 0) {
          console.log("  no forbidden patterns");
        } else {
          console.log("  " + findings.length + " forbidden patterns (PERMITTED - kernel runtime)");
        }
      }
    } else {
      // infrastructure (init script, status display)
      if (verbose) {
        if (findings.length === 0) {
          console.log("  no forbidden patterns");
        } else {
          console.log("  " + findings.length + " forbidden patterns (PERMITTED - emitter infrastructure)");
        }
      }
    }
    if (verbose) console.log("");
  }

  return {
    ok: totalViolations === 0,
    violations: totalViolations,
    violationDetails: violations,
    scriptCount: scripts.length,
    counts: counts,
    kernelRange: kernelRange,
    appRange: appRange
  };
}

module.exports = Object.freeze({
  verify: verify,
  FORBIDDEN_PATTERNS: FORBIDDEN_PATTERNS,
  KERNEL_OPEN: KERNEL_OPEN,
  APP_OPEN: APP_OPEN
});

// ============================================================================
// CLI
// ============================================================================

if (require.main === module) {
  const htmlPath = process.argv[2];
  if (!htmlPath) {
    console.error("Usage: node p8-closure-verifier.js <deposition.html>");
    process.exit(2);
  }
  if (!fs.existsSync(htmlPath)) {
    console.error("File not found: " + htmlPath);
    process.exit(2);
  }
  const result = verify(htmlPath, { verbose: true });
  console.log("============================================================");
  if (!result.ok) {
    if (result.reason) {
      console.log("ERROR: " + result.reason);
    } else {
      console.log("FAIL: " + result.violations + " violation(s) in " +
        result.counts.application + " application script(s)");
    }
    process.exit(1);
  } else {
    console.log("PASS: " + result.scriptCount + " scripts scanned");
    console.log("  kernel: " + result.counts.kernel +
      ", application: " + result.counts.application +
      ", infrastructure: " + result.counts.infrastructure);
    process.exit(0);
  }
}
