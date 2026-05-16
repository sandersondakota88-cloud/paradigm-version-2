// k2-network-adapter-verifier.js - K2 acceptance for network adapter (A2)

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const Pub = require("./contributor-publisher.js");
const Adapter = require("./k2-network-adapter.js");

let pass = 0, fail = 0;
const failures = [];

function test(name, fn) {
  try { fn(); pass++; console.log("  OK   " + name); }
  catch (e) { fail++; failures.push({ name, error: e }); console.log("  FAIL " + name + ": " + e.message); }
}
async function asyncTest(name, fn) {
  try { await fn(); pass++; console.log("  OK   " + name); }
  catch (e) { fail++; failures.push({ name, error: e }); console.log("  FAIL " + name + ": " + e.message); }
}
function assert(c, m) { if (!c) throw new Error("assertion failed: " + (m || "")); }

// ----------------------------------------------------------------------------
// Field fixture
// ----------------------------------------------------------------------------

function buildFieldFixture() {
  const sandbox = {
    console, setTimeout, setImmediate, Promise, Object, Array, Math, JSON,
    Uint32Array, Float64Array, Float32Array, Uint8Array,
    Map, Set, Error, TypeError, RangeError, String, Number, Boolean, Date,
    performance: { now: () => Date.now() }
  };
  sandbox.globalThis = sandbox;
  sandbox.global = sandbox;
  vm.createContext(sandbox);

  const kernelDir = path.join(__dirname, "kernel-src");
  const fieldSrc = fs.readFileSync(path.join(kernelDir, "field.js"), "utf8");
  vm.runInContext(fieldSrc, sandbox, { filename: "field.js" });

  const ext = require(path.join(__dirname, "field-intake-extension.js"));
  ext.install(sandbox.FieldModule);

  return sandbox;
}

// ----------------------------------------------------------------------------
// Mock state element
// ----------------------------------------------------------------------------

function makeStateElement() {
  const attrs = {};
  return {
    getAttribute(n) { return attrs.hasOwnProperty(n) ? attrs[n] : null; },
    setAttribute(n, v) { attrs[n] = String(v); },
    hasAttribute(n) { return attrs.hasOwnProperty(n); },
    _attrs: attrs
  };
}

// ----------------------------------------------------------------------------
// Mock fetch - returns a Promise<{ok, json}>
// ----------------------------------------------------------------------------

function makeMockFetch(scenarios) {
  // scenarios: map url -> {ok, body} OR url -> {throws: errMessage}
  return function (url, opts) {
    const sc = scenarios[url];
    if (!sc) {
      return Promise.reject(new Error("mock-fetch: unknown URL " + url));
    }
    if (sc.throws) {
      return Promise.reject(new Error(sc.throws));
    }
    return Promise.resolve({
      ok: sc.ok !== false,
      json: function () { return Promise.resolve(sc.body); }
    });
  };
}

console.log("k2-network-adapter verification (A2)");
console.log("");

async function main() {

// ----------------------------------------------------------------------------
// PART A: construction
// ----------------------------------------------------------------------------

console.log("PART A: adapter construction");
console.log("");

test("constructor requires publisher", () => {
  let threw = false;
  try { new Adapter.NetworkAdapter({}); } catch (e) { threw = true; }
  assert(threw);
});

test("default config: 50ms poll, 8 outstanding cap", () => {
  assert(Adapter.CONFIG.POLL_INTERVAL_MS === 50);
  assert(Adapter.CONFIG.MAX_OUTSTANDING === 8);
});

test("registerEndpoint validates inputs", () => {
  const a = new Adapter.NetworkAdapter({
    publisher: { publish: () => {} },
    fetch: () => Promise.resolve({})
  });
  let threw = false;
  try { a.registerEndpoint("", {}); } catch (e) { threw = true; }
  assert(threw, "empty sliceName rejected");
  threw = false;
  try { a.registerEndpoint("users", {}); } catch (e) { threw = true; }
  assert(threw, "missing url rejected");
  // Valid
  a.registerEndpoint("users", { url: "/api/users" });
  assert(a.endpoints["users"].url === "/api/users");
  assert(a.endpoints["users"].triggerAttr === "data-trigger-fetch-users");
});

// ----------------------------------------------------------------------------
// PART B: response flow
// ----------------------------------------------------------------------------

console.log("");
console.log("PART B: response flow (async fetch -> publisher.publish)");
console.log("");

let sandbox, field, publisher;

test("fixture: field + intake wired", () => {
  sandbox = buildFieldFixture();
  field = sandbox.FieldModule.Field;
  field.reset();
  publisher = Pub.ContributorPublisher.attach(field);
  assert(publisher);
});

await asyncTest("Successful fetch publishes response + status records", async () => {
  field.intake.clear();
  const stateEl = makeStateElement();
  const adapter = new Adapter.NetworkAdapter({
    publisher: publisher,
    fetch: makeMockFetch({
      "/api/users": { ok: true, body: { users: ["alice", "bob"] } }
    }),
    stateElement: stateEl
  });
  adapter.registerEndpoint("users", { url: "/api/users" });
  // Trigger via DOM (cascade-equivalent path)
  stateEl.setAttribute("data-trigger-fetch-users", "1");
  adapter._poll();
  // Wait for the fetch promise chain to resolve
  await new Promise(r => setImmediate(r));
  await new Promise(r => setImmediate(r));
  await new Promise(r => setImmediate(r));

  const records = field.intake.records;
  // Expect 3 records: status=loading, response, status=ok
  assert(records.length === 3,
    "expected 3 records, got " + records.length + ": " +
    records.map(r => r.type + "=" + JSON.stringify(r.value)).join(", "));

  // First: status=loading
  assert(records[0].type === "network::users-status");
  assert(records[0].value === "loading");

  // Second: the response
  const resp = records[1];
  assert(resp.type === "network::users");
  assert(resp.value && Array.isArray(resp.value.users));
  assert(resp.source === "network-adapter");

  // Third: status=ok
  assert(records[2].type === "network::users-status");
  assert(records[2].value === "ok");
});

await asyncTest("Trigger is cleared after dispatch (no double-fire)", async () => {
  field.intake.clear();
  const stateEl = makeStateElement();
  const adapter = new Adapter.NetworkAdapter({
    publisher: publisher,
    fetch: makeMockFetch({
      "/api/data": { ok: true, body: { x: 1 } }
    }),
    stateElement: stateEl
  });
  adapter.registerEndpoint("data", { url: "/api/data" });
  stateEl.setAttribute("data-trigger-fetch-data", "1");
  adapter._poll();
  // After _poll, trigger should be cleared
  assert(stateEl.getAttribute("data-trigger-fetch-data") === "0");

  // Subsequent _poll without trigger does nothing
  await new Promise(r => setImmediate(r));
  await new Promise(r => setImmediate(r));
  await new Promise(r => setImmediate(r));
  const recordsAfterFirst = field.intake.records.length;
  adapter._poll();
  await new Promise(r => setImmediate(r));
  assert(field.intake.records.length === recordsAfterFirst,
    "second _poll should not re-fire");
});

await asyncTest("HTTP error publishes -error record", async () => {
  field.intake.clear();
  const stateEl = makeStateElement();
  const adapter = new Adapter.NetworkAdapter({
    publisher: publisher,
    fetch: makeMockFetch({
      "/api/fail": { ok: false }
    }),
    stateElement: stateEl
  });
  adapter.registerEndpoint("fail", { url: "/api/fail" });
  stateEl.setAttribute("data-trigger-fetch-fail", "1");
  adapter._poll();
  await new Promise(r => setImmediate(r));
  await new Promise(r => setImmediate(r));
  await new Promise(r => setImmediate(r));

  const records = field.intake.records;
  // Expect: status=loading, error, status=error
  assert(records.length === 3, "got " + records.length);
  assert(records[1].type === "network::fail-error");
  assert(records[1].value === "http-not-ok");
  assert(records[2].type === "network::fail-status");
  assert(records[2].value === "error");
});

await asyncTest("Network exception publishes -error record", async () => {
  field.intake.clear();
  const stateEl = makeStateElement();
  const adapter = new Adapter.NetworkAdapter({
    publisher: publisher,
    fetch: makeMockFetch({
      "/api/dead": { throws: "ECONNREFUSED" }
    }),
    stateElement: stateEl
  });
  adapter.registerEndpoint("dead", { url: "/api/dead" });
  stateEl.setAttribute("data-trigger-fetch-dead", "1");
  adapter._poll();
  await new Promise(r => setImmediate(r));
  await new Promise(r => setImmediate(r));
  await new Promise(r => setImmediate(r));

  const records = field.intake.records;
  // Expect: status=loading, error
  // status=ok is not published; status=error is.
  let foundErr = false;
  for (const r of records) {
    if (r.type === "network::dead-error" && r.value === "ECONNREFUSED") {
      foundErr = true;
    }
  }
  assert(foundErr, "ECONNREFUSED error not published");
});

// ----------------------------------------------------------------------------
// PART C: F3 (no supervision)
// ----------------------------------------------------------------------------

console.log("");
console.log("PART C: F3 (no supervision)");
console.log("");

test("Adapter does not call into ER or CT", () => {
  const stateEl = makeStateElement();
  const adapter = new Adapter.NetworkAdapter({
    publisher: publisher,
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
    stateElement: stateEl
  });
  // Adapter should have no engine references
  assert(!adapter.er);
  assert(!adapter.ct);
  assert(!adapter.field);
});

test("Cap rejection: outstanding > MAX_OUTSTANDING short-circuits dispatch", () => {
  field.intake.clear();
  const stateEl = makeStateElement();
  const adapter = new Adapter.NetworkAdapter({
    publisher: publisher,
    fetch: function () {
      // Returns a never-resolving promise so requests stay outstanding
      return new Promise(function () {});
    },
    stateElement: stateEl,
    config: { MAX_OUTSTANDING: 2 }
  });
  for (let i = 0; i < 5; i++) {
    adapter.registerEndpoint("s" + i, { url: "/api/s" + i });
    stateEl.setAttribute("data-trigger-fetch-s" + i, "1");
  }
  adapter._poll();
  // Should have 2 outstanding + 3 cap-rejected
  assert(adapter.outstanding.size === 2);
  assert(adapter.stats.capRejections === 3);
});

// ----------------------------------------------------------------------------
// PART D: I3 (bounded)
// ----------------------------------------------------------------------------

console.log("");
console.log("PART D: I3 (bounded)");
console.log("");

test("MAX_OUTSTANDING enforced", () => {
  assert(Adapter.CONFIG.MAX_OUTSTANDING === 8);
});

test("Endpoint registration is bounded by explicit register calls", () => {
  const a = new Adapter.NetworkAdapter({
    publisher: { publish: () => {} },
    fetch: () => Promise.resolve({})
  });
  // No automatic endpoint discovery; only explicit registrations
  assert(Object.keys(a.endpoints).length === 0);
  a.registerEndpoint("a", { url: "/a" });
  a.registerEndpoint("b", { url: "/b" });
  assert(Object.keys(a.endpoints).length === 2);
});

// ----------------------------------------------------------------------------
// PART E: closure check
// ----------------------------------------------------------------------------

console.log("");
console.log("PART E: closure - adapter is the legitimate fetch site");
console.log("");

test("k2-network-adapter source contains fetch (permitted in adapter)", () => {
  const src = fs.readFileSync(path.join(__dirname, "k2-network-adapter.js"), "utf8");
  // Adapter calls this.fetch which is the legitimate site
  assert(src.indexOf("this.fetch(") >= 0 || src.indexOf("this.fetch (") >= 0);
});

test("k2-network-adapter.js: no localStorage, no Date.now, no XMLHttpRequest", () => {
  const src = fs.readFileSync(path.join(__dirname, "k2-network-adapter.js"), "utf8");
  assert(src.indexOf("localStorage") < 0);
  assert(src.indexOf("Date.now") < 0);
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

}  // end async main

main().catch(e => { console.error("Fatal:", e); process.exit(2); });
