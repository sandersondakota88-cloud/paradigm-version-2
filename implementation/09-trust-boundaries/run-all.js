// run-all.js - Phase 8 K1 unified regression runner

"use strict";

const { execSync } = require("child_process");
const path = require("path");

const SUITES = [
  "k1-skeleton-verifier.js",
  "k1-emitter-verifier.js",
  "k1-cascade-load-verifier.js",
  "k1-closure-test.js",
  "k1-longrun-verifier.js",
  "k1-s2-verifier.js",
  "k1-intake-verifier.js",
  "k1-flow-verifier.js",
  "k1-bridge-verifier.js",
  "k1-deposition-boot-verifier.js",
  "k2-time-adapter-verifier.js",
  "k1k2-integration-verifier.js",
  "k2-network-adapter-verifier.js",
  "k2-sensor-adapter-verifier.js",
  "k2-host-info-adapter-verifier.js",
  "m2-chain-transport-verifier.js",
  "m2-substrate-link-verifier.js",
  "p2-identity-adapter-verifier.js",
  "p8-form-validator-verifier.js",
  "m3-app-identity-verifier.js",
  "p5-workflow-detector-verifier.js",
  "p3-persistence-binding-verifier.js",
  "p7-undo-binding-verifier.js",
  "p6-report-observer-verifier.js",
  "p9-multiuser-verifier.js",
  "m1-substrate-instance-verifier.js",
  "f1-cascade-harness-verifier.js",
  "f1-pemission-closure-verifier.js",
  "t1-skeptical-intake-verifier.js",
  "t2-source-attribution-verifier.js",
  "t3-trust-topology-verifier.js",
  "s1-schema-projection-verifier.js",
  "s2-forward-compat-verifier.js",
  "s3-schema-shape-observer-verifier.js",
  "bridge-binding-verifier.js",
  "multi-pass-cascade-extrusion-verifier.js",
  "cascade-orchestrator-verifier.js",
  "emit-binding-verifier.js",
  "t1-cascade-extruded-verifier.js"
];

console.log("Phase 8 K1 regression suite");
console.log("===========================");
console.log("");

let totalPass = 0, totalFail = 0;
const results = [];

for (const suite of SUITES) {
  process.stdout.write(suite + " ... ");
  try {
    const out = execSync("node " + suite, {
      cwd: __dirname,
      timeout: 60000,
      encoding: "utf8"
    });
    const m = out.match(/Summary:\s+(\d+)\s+passed,\s+(\d+)\s+failed/);
    if (!m) {
      console.log("PARSE FAIL (no summary line)");
      results.push({ suite, ok: false, pass: 0, fail: 1 });
      totalFail++;
      continue;
    }
    const p = parseInt(m[1], 10), f = parseInt(m[2], 10);
    totalPass += p;
    totalFail += f;
    results.push({ suite, ok: f === 0, pass: p, fail: f });
    console.log(p + "/" + (p + f) + " " + (f === 0 ? "PASS" : "FAIL"));
  } catch (e) {
    console.log("CRASH (" + e.message.split("\n")[0] + ")");
    results.push({ suite, ok: false, pass: 0, fail: 1 });
    totalFail++;
  }
}

console.log("");
console.log("===========================");
console.log("Total: " + totalPass + " passed, " + totalFail + " failed");
console.log("");

for (const r of results) {
  const tag = r.ok ? "[PASS]" : "[FAIL]";
  console.log("  " + tag + " " + r.suite + " - " + r.pass + "/" + (r.pass + r.fail));
}

process.exit(totalFail > 0 ? 1 : 0);
