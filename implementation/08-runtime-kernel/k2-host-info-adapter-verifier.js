// k2-host-info-adapter-verifier.js - K2 acceptance for host-info adapter (A4)

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const Pub = require("./contributor-publisher.js");
const Adapter = require("./k2-host-info-adapter.js");

let pass = 0, fail = 0;
const failures = [];

function test(name, fn) {
  try { fn(); pass++; console.log("  OK   " + name); }
  catch (e) { fail++; failures.push({ name, error: e }); console.log("  FAIL " + name + ": " + e.message); }
}
function assert(c, m) { if (!c) throw new Error("assertion failed: " + (m || "")); }

function buildFieldFixture() {
  const sandbox = {
    console, setTimeout, setImmediate, Promise, Object, Array, Math, JSON,
    Uint32Array, Float64Array, Float32Array, Uint8Array,
    Map, Set, Error, TypeError, RangeError, String, Number, Boolean, Date,
    performance: { now: () => Date.now() }
  };
  sandbox.globalThis = sandbox; sandbox.global = sandbox;
  vm.createContext(sandbox);
  const fieldSrc = fs.readFileSync(
    path.join(__dirname, "kernel-src", "field.js"), "utf8");
  vm.runInContext(fieldSrc, sandbox, { filename: "field.js" });
  const ext = require(path.join(__dirname, "field-intake-extension.js"));
  ext.install(sandbox.FieldModule);
  return sandbox;
}

console.log("k2-host-info-adapter verification (A4)");
console.log("");

// ----------------------------------------------------------------------------
// PART A: construction
// ----------------------------------------------------------------------------

console.log("PART A: adapter construction");
console.log("");

test("constructor requires publisher", () => {
  let threw = false;
  try { new Adapter.HostInfoAdapter({}); } catch (e) { threw = true; }
  assert(threw);
});

test("default channels: location + cookie on", () => {
  const a = new Adapter.HostInfoAdapter({
    publisher: { publish: () => {} }
  });
  assert(a.channels.location === true);
  assert(a.channels.cookie === true);
});

test("CONFIG: 250ms poll, 64 cookies cap", () => {
  assert(Adapter.CONFIG.POLL_INTERVAL_MS === 250);
  assert(Adapter.CONFIG.MAX_COOKIES === 64);
});

test("LOCATION_PROPS lists 5 sampled properties", () => {
  assert(Adapter.LOCATION_PROPS.length === 5);
  assert(Adapter.LOCATION_PROPS.indexOf("href") >= 0);
  assert(Adapter.LOCATION_PROPS.indexOf("pathname") >= 0);
});

// ----------------------------------------------------------------------------
// PART B: location flow
// ----------------------------------------------------------------------------

console.log("");
console.log("PART B: location flow");
console.log("");

let sandbox, field, publisher;

test("fixture: field + intake wired", () => {
  sandbox = buildFieldFixture();
  field = sandbox.FieldModule.Field;
  field.reset();
  publisher = Pub.ContributorPublisher.attach(field);
});

test("First sample publishes records for each location property", () => {
  field.intake.clear();
  const loc = {
    href: "https://example.com/users/42",
    pathname: "/users/42",
    search: "",
    hash: "",
    host: "example.com"
  };
  const a = new Adapter.HostInfoAdapter({
    publisher: publisher,
    loc: loc,
    doc: null,
    channels: { location: true, cookie: false }
  });
  a._poll();

  const recs = field.intake.records;
  assert(recs.length === 5,
    "expected 5 records, got " + recs.length);
  assert(recs[0].type === "loc-href");
  assert(recs[0].value === "https://example.com/users/42");
  assert(recs[0].source === "host-info-adapter");
});

test("Second poll without changes publishes nothing (S1: no redundancy)", () => {
  field.intake.clear();
  const loc = { href: "/a", pathname: "/a", search: "", hash: "", host: "h" };
  const a = new Adapter.HostInfoAdapter({
    publisher: publisher,
    loc: loc,
    doc: null,
    channels: { location: true, cookie: false }
  });
  a._poll();
  const after1 = field.intake.records.length;
  a._poll();
  const after2 = field.intake.records.length;
  assert(after2 === after1, "second poll added " + (after2 - after1) + " records");
});

test("Location change publishes only the changed properties", () => {
  field.intake.clear();
  const loc = { href: "/a", pathname: "/a", search: "", hash: "", host: "h" };
  const a = new Adapter.HostInfoAdapter({
    publisher: publisher,
    loc: loc,
    doc: null,
    channels: { location: true, cookie: false }
  });
  a._poll();   // 5 records
  field.intake.clear();
  loc.pathname = "/b";
  loc.href = "/b";
  a._poll();
  const recs = field.intake.records;
  // Only href and pathname changed; 2 records
  assert(recs.length === 2,
    "expected 2 records, got " + recs.length + ": " +
    recs.map(r => r.type).join(", "));
  const types = recs.map(r => r.type).sort();
  assert(types[0] === "loc-href");
  assert(types[1] === "loc-pathname");
});

// ----------------------------------------------------------------------------
// PART C: cookie flow
// ----------------------------------------------------------------------------

console.log("");
console.log("PART C: cookie flow");
console.log("");

test("Cookie sample publishes per-cookie records", () => {
  field.intake.clear();
  const doc = { cookie: "session=abc123; theme=dark; lang=en" };
  const a = new Adapter.HostInfoAdapter({
    publisher: publisher,
    loc: null,
    doc: doc,
    channels: { location: false, cookie: true }
  });
  a._poll();

  const recs = field.intake.records;
  assert(recs.length === 3, "expected 3 records, got " + recs.length);
  const byType = {};
  for (const r of recs) byType[r.type] = r.value;
  assert(byType["cookie-session"] === "abc123");
  assert(byType["cookie-theme"] === "dark");
  assert(byType["cookie-lang"] === "en");
});

test("Cookie deletion publishes empty value", () => {
  field.intake.clear();
  const doc = { cookie: "a=1; b=2" };
  const a = new Adapter.HostInfoAdapter({
    publisher: publisher,
    loc: null,
    doc: doc,
    channels: { location: false, cookie: true }
  });
  a._poll();    // 2 records
  field.intake.clear();
  doc.cookie = "a=1";   // b deleted
  a._poll();

  const recs = field.intake.records;
  // Should publish a=1 (still present, but the per-poll publish always
  // emits) AND b="" (deletion)
  let foundDelete = false;
  for (const r of recs) {
    if (r.type === "cookie-b" && r.value === "") foundDelete = true;
  }
  assert(foundDelete, "deletion record not published");
});

test("Cookie name sanitization (data-attribute-safe)", () => {
  field.intake.clear();
  const doc = { cookie: "valid_name=ok; my-cookie=fine; bad.name=skipped-but-sanitized" };
  const a = new Adapter.HostInfoAdapter({
    publisher: publisher,
    loc: null,
    doc: doc,
    channels: { location: false, cookie: true }
  });
  a._poll();

  // bad.name -> bad_name
  const recs = field.intake.records;
  const types = recs.map(r => r.type);
  assert(types.indexOf("cookie-valid_name") >= 0);
  assert(types.indexOf("cookie-my-cookie") >= 0);
  assert(types.indexOf("cookie-bad_name") >= 0);
});

test("MAX_COOKIES cap enforced (I3)", () => {
  field.intake.clear();
  const cookies = [];
  for (let i = 0; i < 10; i++) cookies.push("c" + i + "=v" + i);
  const doc = { cookie: cookies.join("; ") };
  const a = new Adapter.HostInfoAdapter({
    publisher: publisher,
    loc: null,
    doc: doc,
    channels: { location: false, cookie: true },
    config: { MAX_COOKIES: 5, MAX_COOKIE_NAME_LEN: 64, MAX_COOKIE_VALUE_LEN: 4096 }
  });
  a._poll();

  // Only 5 cookies published
  assert(field.intake.records.length === 5);
  assert(a.stats.cookieCapRejections >= 1);
});

// ----------------------------------------------------------------------------
// PART D: F3 + closure
// ----------------------------------------------------------------------------

console.log("");
console.log("PART D: F3 + closure");
console.log("");

test("Adapter holds no engine references", () => {
  const a = new Adapter.HostInfoAdapter({
    publisher: publisher
  });
  assert(!a.field);
  assert(!a.er);
  assert(!a.ct);
});

test("k2-host-info-adapter.js: document.cookie is permitted (adapter site)", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "k2-host-info-adapter.js"), "utf8");
  // The adapter accesses doc.cookie via this.doc.cookie - that's the
  // legitimate site
  assert(src.indexOf("doc.cookie") >= 0 || src.indexOf(".cookie") >= 0);
});

test("k2-host-info-adapter.js: no localStorage, no fetch, no XMLHttpRequest", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "k2-host-info-adapter.js"), "utf8");
  assert(src.indexOf("localStorage") < 0);
  assert(src.indexOf("fetch(") < 0);
  assert(src.indexOf("XMLHttpRequest") < 0);
});

console.log("");
console.log("==========================================================");
console.log("Summary: " + pass + " passed, " + fail + " failed");
if (fail > 0) {
  for (const f of failures) {
    console.log("  - " + f.name);
    console.log("    " + (f.error.stack || f.error.message));
  }
  process.exit(1);
}
process.exit(0);
