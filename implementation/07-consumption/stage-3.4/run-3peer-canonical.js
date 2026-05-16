"use strict";
const fs = require("fs");
const M1 = require("./stage1-lexical-typing-substrate.js");
const M2 = require("./stage2-emergent-structural-substrate.js");
const Mid = require("./stage2-identifier-substrate.js");
const Msa = require("./stage2-string-analysis-substrate.js");
const Mc3 = require("./composer-substrate-3peer.js");

const source = fs.readFileSync("./canonical-source.html", "utf8");
console.log("Source: canonical-source.html (" + source.length + " bytes)");

const t0 = Date.now();
const sub1 = M1.createStage1Substrate({ id: "s1", rowCap: 32768 });
sub1.ingest(Buffer.from(source));
const vsf1 = sub1.emitVsf();
console.log("Stage 1: " + (Date.now()-t0) + "ms");

const t1 = Date.now();
const kp = M2.createStage2Substrate({ id: "kp", constraintCap: 1024 });
kp.ingestStage1Vsf(vsf1);
const ks = kp.getState();
console.log("Kind peer: " + (Date.now()-t1) + "ms, " + ks.constraints.length + " constraints");

const t2 = Date.now();
const tp = Mid.createIdentifierSubstrate({ id: "tp", constraintCap: 2048 });
tp.ingestStage1Vsf(vsf1);
const ts = tp.getState();
console.log("Text peer: " + (Date.now()-t2) + "ms, " + ts.constraints.length + " constraints");

const t3 = Date.now();
const sp = Msa.createStringAnalysisSubstrate({ id: "sp" });
sp.ingestStage1Vsf(vsf1);
const ss = sp.getState();
console.log("String peer: " + (Date.now()-t3) + "ms, " + ss.constraints.length + " constraints");
console.log("  string tokens: " + ss.totalStringTokensSeen + ", sub-tokens: " + ss.totalSubTokensSeen);

const t4 = Date.now();
const cmp = Mc3.createComposerSubstrate({ id: "cmp" });
cmp.observe(ks, ts, ss);
const cs = cmp.getState();
console.log("Composer: " + (Date.now()-t4) + "ms, " + cs.constraints.length + " constraints, " + cs.subcascades.length + " subs");

const fb = {};
for (const c of cs.constraints) fb[c.family] = (fb[c.family]||0) + 1;
console.log("\nComposer family breakdown: " + JSON.stringify(fb));

console.log("\nString peer sub-cascades:");
for (const sc of ss.subcascades) {
  console.log("  " + sc.name + " family=" + sc.familyType + " members=" + sc.memberIds.length + " fid=" + sc.fidAtBirth.toFixed(2));
}

console.log("\nString peer top hyphen patterns:");
const hp = ss.constraints.filter(c => c.family === "str-hyphen-prefix" || c.family === "str-hyphen-suffix").sort((a,b) => (b.uses||0)-(a.uses||0));
for (const c of hp.slice(0, 12)) {
  console.log("  uses=" + (c.uses||0).toString().padStart(3) + " " + c.family.padEnd(20) + " " + (c.pattern.key||"").slice(0, 40));
}

console.log("\nString peer top inner-recur:");
const ir = ss.constraints.filter(c => c.family === "str-inner-recur").sort((a,b) => (b.uses||0)-(a.uses||0));
for (const c of ir.slice(0, 12)) {
  console.log("  uses=" + (c.uses||0).toString().padStart(3) + " " + (c.pattern.text||""));
}

console.log("\nMorphological bindings (top 15):");
const morphConstraints = cs.constraints.filter(c => c.family === "morphological-bind");
const compounds = {};
for (const c of morphConstraints) {
  const k = c.pattern.compoundLhs + "-" + c.pattern.compoundRhs;
  if (!compounds[k]) compounds[k] = { uses: 0, bindings: 0 };
  compounds[k].uses += c.uses || 0;
  compounds[k].bindings++;
}
const sorted = Object.entries(compounds).sort((a,b) => b[1].uses - a[1].uses);
for (const [k, v] of sorted.slice(0, 15)) {
  console.log("  " + k.padEnd(32) + " uses=" + v.uses.toString().padStart(5) + " kind-bindings=" + v.bindings);
}

console.log("\nComposer promoted sub-cascades:");
for (const sc of cs.subcascades) {
  console.log("  " + sc.name + " family=" + sc.familyType + " members=" + sc.memberIds.length + " fid=" + sc.fidAtBirth.toFixed(2));
}
