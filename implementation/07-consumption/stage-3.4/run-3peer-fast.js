"use strict";
const fs = require("fs");
const M1 = require("./stage1-lexical-typing-substrate.js");
const Msa = require("./stage2-string-analysis-substrate.js");

// Just run Stage 1 + string peer on canonical, since the string peer is fast
// (only fires on string-bearing kinds).
const source = fs.readFileSync("./canonical-source.html", "utf8");
console.log("Source: " + source.length + " bytes");

const t0 = Date.now();
const sub1 = M1.createStage1Substrate({ id: "s1", rowCap: 32768 });
sub1.ingest(Buffer.from(source));
const vsf1 = sub1.emitVsf();
console.log("Stage 1: " + (Date.now()-t0) + "ms");

const t1 = Date.now();
const sp = Msa.createStringAnalysisSubstrate({ id: "sp" });
sp.ingestStage1Vsf(vsf1);
const ss = sp.getState();
console.log("String peer: " + (Date.now()-t1) + "ms, " + ss.constraints.length + " constraints, " + ss.subcascades.length + " subs");
console.log("  string tokens: " + ss.totalStringTokensSeen + ", sub-tokens: " + ss.totalSubTokensSeen);

console.log("\nString peer sub-cascades:");
for (const sc of ss.subcascades) {
  console.log("  " + sc.name + " family=" + sc.familyType + " members=" + sc.memberIds.length + " fid=" + sc.fidAtBirth.toFixed(2));
}

console.log("\nString peer top hyphen prefixes (uses >= 4):");
const hPrefix = ss.constraints.filter(c => c.family === "str-hyphen-prefix" && c.uses >= 4).sort((a,b) => (b.uses||0)-(a.uses||0));
for (const c of hPrefix.slice(0, 15)) {
  console.log("  uses=" + (c.uses||0).toString().padStart(3) + " lhs=" + (c.pattern.prefix||""));
}
console.log("\nString peer top hyphen suffixes (uses >= 4):");
const hSuffix = ss.constraints.filter(c => c.family === "str-hyphen-suffix" && c.uses >= 4).sort((a,b) => (b.uses||0)-(a.uses||0));
for (const c of hSuffix.slice(0, 15)) {
  console.log("  uses=" + (c.uses||0).toString().padStart(3) + " rhs=" + (c.pattern.suffix||""));
}

console.log("\nString peer top inner-recur (sub-tokens, uses >= 5):");
const ir = ss.constraints.filter(c => c.family === "str-inner-recur" && c.uses >= 5).sort((a,b) => (b.uses||0)-(a.uses||0));
for (const c of ir.slice(0, 25)) {
  console.log("  uses=" + (c.uses||0).toString().padStart(4) + " " + (c.pattern.text||""));
}

console.log("\nDomain dimension presence in string peer:");
const dimensions = ["credit", "product", "applicant", "residency", "income", "employment"];
const values = ["prime", "near-prime", "sub-prime", "mortgage", "personal", "auto", "business-line",
                "individual", "joint", "business", "trust", "domestic", "foreign", "diplomatic",
                "under50", "50to100", "100to250", "over250", "employed", "self-employed",
                "retired", "student", "unemployed", "data-debt", "data-mortgage", "data-employed",
                "data-foreign", "data-under50"];
console.log("\n  Atomic terms surfaced:");
for (const term of [...dimensions, ...values]) {
  const matches = ss.constraints.filter(c => 
    (c.pattern.text === term) ||
    (c.pattern.prefix === term) ||
    (c.pattern.suffix === term)
  );
  if (matches.length > 0) {
    const totalUses = matches.reduce((s,c) => s + (c.uses||0), 0);
    console.log("    " + term.padEnd(20) + " uses=" + totalUses + " (" + matches.length + " constraints)");
  }
}
