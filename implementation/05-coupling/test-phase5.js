// test-phase5.js - Phase 5 integration runner

"use strict";

const couplingAudit = require("./phase5-coupling-audit.js");
const kindmultAudit = require("./kindmult-audit.js");

const phase5a = require("./test-phase5a.js");
const phase5b = require("./test-phase5b.js");
const phase5c = require("./test-phase5c.js");
const phase5d = require("./test-phase5d.js");
const phase5e = require("./test-phase5e.js");
const phase5f = require("./test-phase5f.js");

async function runAll() {
  const results = {};

  // 1. Coupling-path audit (source-level, fast)
  console.log("==============================================================");
  console.log("Phase 5 verification");
  console.log("==============================================================");
  console.log("");
  console.log("[1/8] Coupling-path audit (source-level SE-06 verification)");
  console.log("--------------------------------------------------------------");
  const couplingResults = couplingAudit.runAudit(__dirname);
  const couplingReport = couplingAudit.formatReport(couplingResults);
  console.log(couplingReport.text);
  results.coupling = couplingReport;

  // 2-7. Per-category stress tests
  const categories = [
    { id: "5a", name: "rapid input stream", mod: phase5a },
    { id: "5b", name: "divergence induction", mod: phase5b },
    { id: "5c", name: "cross-engine ratification", mod: phase5c },
    { id: "5d", name: "persistence durability", mod: phase5d },
    { id: "5e", name: "compound coherence under stress", mod: phase5e },
    { id: "5f", name: "substrate equivalence at scale", mod: phase5f }
  ];

  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    console.log("\n[" + (i + 2) + "/8] " + cat.id + " " + cat.name);
    console.log("--------------------------------------------------------------");
    const r = await cat.mod.run();
    results[cat.id] = r;
  }

  // 8. kindMult audit (advisory)
  console.log("\n[8/8] kindMult audit (advisory, v2.2 section 8 principle 4)");
  console.log("--------------------------------------------------------------");
  const auditResult = await kindmultAudit.audit();
  results.kindmult = auditResult;

  // ---- Summary ----
  console.log("\n==============================================================");
  console.log("Phase 5 summary");
  console.log("==============================================================");
  console.log("");
  console.log("Coupling-path audit: " + couplingReport.passed + "/" + couplingReport.total + " checks passed");
  console.log("");

  let totalPass = 0, totalFail = 0;
  for (const cat of categories) {
    const r = results[cat.id];
    console.log("  " + cat.id + " " + cat.name + ": " + r.pass + "/" + r.total + " tests passed");
    totalPass += r.pass;
    totalFail += r.fail;
  }
  const totalTests = totalPass + totalFail;
  console.log("");
  console.log("Stress tests: " + totalPass + "/" + totalTests + " passed");
  console.log("");
  console.log("kindMult audit: complete (advisory; see findings above)");
  console.log("");

  const allPassed = couplingReport.failed === 0 && totalFail === 0;
  if (allPassed) {
    console.log("STATUS: Phase 5 verification PASSED.");
    console.log("Stable Phase 5 deliverable: ready for ship.");
  } else {
    console.log("STATUS: Phase 5 verification has failures.");
    console.log("  Coupling failures: " + couplingReport.failed);
    console.log("  Stress failures: " + totalFail);
  }

  return {
    coupling: couplingReport,
    stressTotal: { pass: totalPass, fail: totalFail, total: totalTests },
    audit: auditResult,
    allPassed: allPassed
  };
}

if (require.main === module) {
  runAll().then(r => process.exit(r.allPassed ? 0 : 1)).catch(e => {
    console.error("integration runner failed:", e && e.stack || e);
    process.exit(1);
  });
}

module.exports = { runAll: runAll };
