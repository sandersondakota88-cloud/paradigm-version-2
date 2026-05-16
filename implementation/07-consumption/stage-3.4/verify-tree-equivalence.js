"use strict";
const fs = require("fs");
const S3T = require("./stage3-tree-recognizer.js");

const canonicalConstraints = [
  { when: { credit: "prime"      }, then: { rt: "A-PREFERRED", rth: 160, doc: "BASIC" } },
  { when: { credit: "near-prime" }, then: { rt: "B-STANDARD",  rth: 130, doc: "ENHANCED" } },
  { when: { credit: "sub-prime"  }, then: { rt: "C-ELEVATED",  rth:  95, doc: "ENHANCED" } },
  { when: { residency: "foreign"     }, then: { doc: "ENHANCED" } },
  { when: { residency: "diplomatic"  }, then: { doc: "MAXIMUM"  } },
  { when: { credit: "sub-prime", product: "business-line" },
    then: { sdf: 1, deny: "SubPrime cannot hold BusinessLine" } },
  { when: { residency: "foreign", product: "mortgage", credit: "sub-prime" },
    then: { sdf: 1, deny: "Foreign SubPrime Mortgage not underwriteable" } },
  { when: { employment: "unemployed", product: "mortgage" },
    then: { sdf: 1, deny: "Mortgage requires income source" } },
  { when: { employment: "student", product: "business-line" },
    then: { sdf: 1, deny: "Student cannot hold BusinessLine" } },
  { when: { applicant: "trust", product: "personal" },
    then: { sdf: 1, deny: "Trust cannot hold Personal" } },
  { when: { income: "under50", product: "mortgage" },
    then: { sdf: 1, deny: "Mortgage requires minimum qualifying income" } }
];

const source = fs.readFileSync("./canonical-source.html", "utf8");
const result = S3T.runStage3OnTree(source);

console.log("Canonical constraints: " + canonicalConstraints.length);
console.log("Tree-Stage 3 found:    " + result.constraints.length);
console.log("");

let allMatch = true;
for (let i = 0; i < canonicalConstraints.length; i++) {
  const cc = canonicalConstraints[i];
  const sc = result.constraints[i];
  if (!sc) { console.log("MISSING constraint " + i); allMatch = false; continue; }

  const ccWhenStr = Object.keys(cc.when).sort().map(k => k + "=" + cc.when[k]).join(",");
  const scWhenStr = sc.when.map(w => w.dim + "=" + w.value).sort().join(",");
  const whenMatch = ccWhenStr === scWhenStr;

  const ccThenKeys = Object.keys(cc.then).sort();
  const scThenKeys = Object.keys(sc.then).sort();
  let thenMatch = ccThenKeys.length === scThenKeys.length;
  if (thenMatch) {
    for (const k of ccThenKeys) {
      if (!sc.then[k]) { thenMatch = false; break; }
      const ccVal = String(cc.then[k]);
      const scVal = String(sc.then[k].value);
      if (ccVal !== scVal) { thenMatch = false; break; }
    }
  }

  const status = (whenMatch && thenMatch) ? "OK   " : "DIFF ";
  console.log(status + " #" + (i+1).toString().padStart(2) + " " + ccWhenStr + " => " + ccThenKeys.join(","));
  if (!whenMatch || !thenMatch) {
    if (!whenMatch) console.log("    WHEN mismatch:  canon=" + ccWhenStr + "  tree=" + scWhenStr);
    if (!thenMatch) console.log("    THEN mismatch:  canon=" + ccThenKeys + "  tree=" + scThenKeys);
    allMatch = false;
  }
}

console.log("");
console.log(allMatch ? "ALL CONSTRAINTS MATCH STRUCTURALLY (11/11) ON FULL LOAN APPLICATION" : "SOME MISMATCHES");
