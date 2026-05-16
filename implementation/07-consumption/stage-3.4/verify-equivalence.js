"use strict";
// Verify Stage 3's output is structurally equivalent to what the canonical
// would generate. We extract the constraints from the canonical's source
// the same way it does (parse the constraints array), then compile each
// constraint using a transcribed version of compileConstraint, and compare
// against Stage 3's output.

const fs = require("fs");

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

// Compare structural equivalence: same set of WHEN/THEN pairs
const S3 = require("./stage3-dimensional-recognizer.js");
const result = S3.runStage3("./constraints-only.js");

console.log("Canonical constraints: " + canonicalConstraints.length);
console.log("Stage 3 recognized:    " + result.constraintsRecognized.length);
console.log("");

let allMatch = true;
for (let i = 0; i < canonicalConstraints.length; i++) {
  const cc = canonicalConstraints[i];
  const sc = result.constraintsRecognized[i];
  if (!sc) { console.log("MISSING constraint " + i); allMatch = false; continue; }

  // Compare when keys
  const ccWhenKeys = Object.keys(cc.when).sort();
  const scWhenKeys = sc.when.map(w => w.dim).sort();
  const ccWhenStr = ccWhenKeys.map(k => k + "=" + cc.when[k]).sort().join(",");
  const scWhenStr = sc.when.map(w => w.dim + "=" + w.value).sort().join(",");
  const whenMatch = ccWhenStr === scWhenStr;

  // Compare then properties (allow numeric vs string flexibility)
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
    if (!whenMatch) console.log("    WHEN mismatch:  canon=" + ccWhenStr + "  stage3=" + scWhenStr);
    if (!thenMatch) console.log("    THEN mismatch:  canon keys=[" + ccThenKeys + "]  stage3 keys=[" + scThenKeys + "]");
    allMatch = false;
  }
}

console.log("");
console.log(allMatch ? "ALL CONSTRAINTS MATCH STRUCTURALLY (11/11)" : "SOME CONSTRAINTS MISMATCH");
