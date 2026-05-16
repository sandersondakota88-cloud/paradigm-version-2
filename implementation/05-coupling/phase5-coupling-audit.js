// phase5-coupling-audit.js - Static coupling-path analysis

"use strict";

const fs = require("fs");
const path = require("path");

const CHECKS = [
  {
    id: "C1",
    name: "CT binds to ER",
    file: "ct-engine.js",
    expectMatch: /this\.erBinding\s*=\s*erEngine/,
    direction: "expect-present",
    rationale: "CT engine requests ER evaluation; binding is allowed and necessary"
  },
  {
    id: "C2",
    name: "ER does not bind to CT",
    file: "er-engine.js",
    expectMatch: /\bctBinding\b|\bctEngine\b/,
    direction: "expect-absent",
    rationale: "Reverse binding would constitute a command channel"
  },
  {
    id: "C3",
    name: "Reflexive surface does not bind to engines",
    file: "reflexive-surface.js",
    expectMatch: /\b(erBinding|ctBinding|erEngine|ctEngine)\b/,
    direction: "expect-absent",
    rationale: "Surface reads Field state directly; engine bindings would be command paths"
  },
  {
    id: "C4",
    name: "Storage adapter does not reference engines",
    file: "storage-adapter.js",
    expectMatch: /\b(erBinding|ctBinding|erEngine|ctEngine|reflexiveSurface)\b/,
    direction: "expect-absent",
    rationale: "Storage is a substrate; it does not call back into engines"
  },
  {
    id: "C5",
    name: "ER engine does not reference storage adapter",
    file: "er-engine.js",
    // Looking for the specific identifiers the storage adapter exports.
    // Note: ER engine uses 'storage' in 'GPUBufferUsage.STORAGE' - that is
    // a GPU resource concept, not the storage adapter. We pattern-match
    // the adapter's specific identifiers.
    expectMatch: /\b(StorageAdapter|persistConstraint|recallConstraints|storageBinding|persistenceEligibility)\b/,
    direction: "expect-absent",
    rationale: "ER engine resolves over what's compiled; storage substrate is invisible to it"
  },
  {
    id: "C6",
    name: "Field is read-only from surface module",
    file: "reflexive-surface.js",
    // The surface should never assign to Field properties or call mutating
    // Field methods. We can't catch every form of mutation via regex, but
    // we can flag obvious assignments like Field.X = ... or Field.method(args)
    // for known mutating methods (integrate, ratify, generate, etc).
    expectMatch: /Field\.(integrate|ratify|generate|markUsed|recordOp|modulate|recordFidelity|recordCompoundFidelity|reinforceNaming|setRecallWindow|reinforceRecallMatch|recordRecallEvent|recordCompoundGenerationSnapshot|generateCompounds|checkCompoundPromotions|reset|deserialize)\b/,
    direction: "expect-absent",
    rationale: "O1 invariant: surface reads Field state but does not write"
  },
  {
    id: "C7",
    name: "CT engine does not import surface",
    file: "ct-engine.js",
    expectMatch: /reflexive-surface|ReflexiveSurfaceModule|reflexiveSurface\b/,
    direction: "expect-absent",
    rationale: "Engines do not couple to observers - observers read engines' shared field"
  }
];

function runAudit(srcDir) {
  srcDir = srcDir || ".";
  const results = [];
  for (const check of CHECKS) {
    const filepath = path.join(srcDir, check.file);
    let src;
    try {
      src = fs.readFileSync(filepath, "utf-8");
    } catch (e) {
      results.push({
        id: check.id,
        name: check.name,
        file: check.file,
        passed: false,
        reason: "could not read file: " + (e && e.message || e)
      });
      continue;
    }
    const matched = check.expectMatch.test(src);
    let passed;
    if (check.direction === "expect-present") passed = matched;
    else if (check.direction === "expect-absent") passed = !matched;
    else passed = false;

    results.push({
      id: check.id,
      name: check.name,
      file: check.file,
      direction: check.direction,
      matched: matched,
      passed: passed,
      rationale: check.rationale
    });
  }
  return results;
}

function formatReport(results) {
  const lines = [];
  lines.push("=== Coupling-Path Audit ===");
  let passed = 0, failed = 0;
  for (const r of results) {
    const status = r.passed ? "PASS" : "FAIL";
    lines.push("  [" + status + "] " + r.id + " " + r.name + " (" + r.file + ")");
    if (!r.passed) {
      lines.push("        " + (r.reason || ("expected " + r.direction + ", regex matched=" + r.matched)));
      lines.push("        rationale: " + r.rationale);
    }
    if (r.passed) passed += 1;
    else failed += 1;
  }
  lines.push("");
  lines.push("  " + passed + "/" + results.length + " coupling-path checks passed");
  return { text: lines.join("\n"), passed: passed, failed: failed, total: results.length };
}

if (require.main === module) {
  const results = runAudit(__dirname);
  const report = formatReport(results);
  console.log(report.text);
  process.exit(report.failed === 0 ? 0 : 1);
}

module.exports = { runAudit: runAudit, formatReport: formatReport, CHECKS: CHECKS };
