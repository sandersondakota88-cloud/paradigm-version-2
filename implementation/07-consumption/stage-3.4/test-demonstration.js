// Verify the demonstration's HTML structure is valid by parsing it
// and exercising the cascade rules against representative configurations.
"use strict";
const fs = require("fs");
const html = fs.readFileSync("./stage3-demonstration.html", "utf8");

// Extract the cascade <style id="stage3-cascade"> block
const styleStart = html.indexOf('<style id="stage3-cascade">');
const styleEnd = html.indexOf("</style>", styleStart);
if (styleStart < 0 || styleEnd < 0) {
  console.log("FAIL: cascade <style> block not found");
  process.exit(1);
}
const cascadeCss = html.substring(styleStart, styleEnd);
console.log("Cascade <style> block: " + cascadeCss.length + " bytes");

// Count rules in the cascade
const ruleCount = (cascadeCss.match(/\}\s*(\n|$)/g) || []).length;
console.log("Rule blocks: " + ruleCount);
const attrSelCount = (cascadeCss.match(/\[data-/g) || []).length;
console.log("Attribute selectors: " + attrSelCount);

// Count test configurations the cascade should handle
const dims = [
  ["credit", ["prime", "near-prime", "sub-prime"]],
  ["product", ["mortgage", "personal", "auto", "business-line"]],
  ["applicant", ["individual", "joint", "business", "trust"]],
  ["residency", ["domestic", "foreign", "diplomatic"]],
  ["income", ["under50", "50to100", "100to250", "over250"]],
  ["employment", ["employed", "self-employed", "retired", "student", "unemployed"]]
];
let totalCoords = 1;
for (const [_, vals] of dims) totalCoords *= vals.length;
console.log("State-space coordinates: " + totalCoords);

// Validate a few key test cases would be matched/denied correctly
// (we can't actually execute CSS in node, but we can simulate the cascade
// by matching attribute-selector logic against the rules in source)
console.log("");
console.log("Cascade sanity:");

// Each rule has (selector pattern -> declarations); simulate selector matching
// Parse rules from the CSS
const rules = [];
const ruleRe = /([^{]+)\{([^}]+)\}/g;
let m;
while ((m = ruleRe.exec(cascadeCss))) {
  const selector = m[1].trim();
  const decls = m[2].trim();
  if (selector.includes("V-probe")) {
    rules.push({ selector: selector, decls: decls });
  }
}
console.log("  Parsed " + rules.length + " rules from CSS");

// Simulate cascade for a few canonical test cases.
function resolve(config) {
  // Default values from base rule
  let outputs = { sdf: "-1", reg: "VALID", rt: "UNCLASSIFIED", rth: "0", doc: "BASIC", deny: "" };
  for (const r of rules) {
    // Does this rule's selector match config? Pull all [data-X="V"] from selector
    const attrRe = /\[data-([a-zA-Z-]+)="([^"]+)"\]/g;
    let allMatch = true, hadAny = false;
    let am;
    while ((am = attrRe.exec(r.selector))) {
      hadAny = true;
      if (config[am[1]] !== am[2]) { allMatch = false; break; }
    }
    if (hadAny && !allMatch) continue;
    // Apply declarations
    const declRe = /--([a-zA-Z-]+)\s*:\s*([^;]+);/g;
    let dm;
    while ((dm = declRe.exec(r.decls))) {
      let val = dm[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      outputs[dm[1]] = val;
    }
  }
  return outputs;
}

const tests = [
  { config: { credit: "prime", product: "mortgage", applicant: "individual", residency: "domestic", income: "over250", employment: "employed" }, expectedReg: "VALID", expectedRt: "A-PREFERRED" },
  { config: { credit: "sub-prime", product: "business-line", applicant: "individual", residency: "domestic", income: "over250", employment: "employed" }, expectedReg: "DENIED" },
  { config: { credit: "sub-prime", product: "mortgage", applicant: "individual", residency: "foreign", income: "over250", employment: "employed" }, expectedReg: "DENIED" },
  { config: { credit: "prime", product: "mortgage", applicant: "trust", residency: "domestic", income: "over250", employment: "employed" }, expectedReg: "VALID" },
  { config: { credit: "prime", product: "personal", applicant: "trust", residency: "domestic", income: "over250", employment: "employed" }, expectedReg: "DENIED" },
  { config: { credit: "near-prime", product: "auto", applicant: "individual", residency: "diplomatic", income: "100to250", employment: "self-employed" }, expectedReg: "VALID", expectedDoc: "MAXIMUM" }
];

let pass = 0, fail = 0;
for (const t of tests) {
  const r = resolve(t.config);
  const okReg = r.reg === t.expectedReg;
  const okRt = !t.expectedRt || r.rt === t.expectedRt;
  const okDoc = !t.expectedDoc || r.doc === t.expectedDoc;
  if (okReg && okRt && okDoc) {
    pass++;
    console.log("  ok   " + JSON.stringify(t.config).slice(0, 60) + " -> " + r.reg + " " + r.rt);
  } else {
    fail++;
    console.log("  FAIL " + JSON.stringify(t.config));
    console.log("       expected reg=" + t.expectedReg + " got " + r.reg);
    console.log("       resolved:", r);
  }
}

console.log("");
console.log(pass + "/" + (pass + fail) + " configurations resolved correctly");
process.exit(fail > 0 ? 1 : 0);
