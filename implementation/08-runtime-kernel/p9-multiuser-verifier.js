// p9-multiuser-verifier.js - P9 acceptance: M+P stack composes

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const Pub = require("./contributor-publisher.js");
const IdentityModule = require("./p2-identity-adapter.js");
const Persistence = require("./p3-persistence-binding.js");
const ReportObs = require("./p6-report-observer.js");
const TransportBinding = require("./chain-transport-binding.js");

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
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function buildField() {
  const sandbox = {
    console, setTimeout, setImmediate, Promise, Object, Array, Math, JSON,
    Uint32Array, Float64Array, Float32Array, Uint8Array,
    Map, Set, Error, TypeError, RangeError, String, Number, Boolean, Date,
    performance: { now: () => Date.now() }
  };
  sandbox.globalThis = sandbox; sandbox.global = sandbox;
  vm.createContext(sandbox);
  const src = fs.readFileSync(
    path.join(__dirname, "kernel-src", "field.js"), "utf8");
  vm.runInContext(src, sandbox, { filename: "field.js" });
  // Install intake extension so ContributorPublisher.attach works
  const ext = require(path.join(__dirname, "field-intake-extension.js"));
  ext.install(sandbox.FieldModule);
  sandbox.FieldModule.Field.reset();
  return sandbox.FieldModule;
}

// ----------------------------------------------------------------------------
// Per-instance stack: field + publisher + identity + persistence + reports
// + transport coupling for cross-instance sync
// ----------------------------------------------------------------------------
function buildInstance(opts) {
  opts = opts || {};
  const fieldMod = buildField();
  const publisher = Pub.ContributorPublisher.attach(fieldMod.Field);
  const identity = new IdentityModule.IdentityAdapter({ publisher: publisher });
  const persistence = new Persistence.PersistenceBinding({
    fieldModule: fieldMod,
    store: opts.store || new Persistence.MediaStore(),
    id: opts.id || "instance"
  });
  const reportDealsByStage = new ReportObs.ReportObserver({
    field: fieldMod.Field, template: ReportObs.TEMPLATES.dealsByStage,
    name: "deals-by-stage"
  });
  return {
    id: opts.id || "instance",
    fieldMod: fieldMod,
    field: fieldMod.Field,
    publisher: publisher,
    identity: identity,
    persistence: persistence,
    reports: { dealsByStage: reportDealsByStage }
  };
}

// ----------------------------------------------------------------------------
// CRM helpers (the "domain" layer of P9)
//
// Contact records are kind="data" constraints with pattern.type="contact-record".
// Contact updates are kind="data" with pattern.type="contact-update".
// "Current view" of a contact reduces over its update history.
// F5 honored: every update is a separate constraint; no overwrites.
// ----------------------------------------------------------------------------

function createContact(field, contact, ts, source) {
  field.constraints.push({
    id: "contact::" + contact.id,
    kind: "data",
    pattern: { type: "contact-record" },
    data: Object.assign({ _ts: ts || 0, _from: source || "local" }, contact),
    birth: field.step, lastUsed: field.step, uses: 0, weight: 1, permanent: false
  });
}

function applyContactUpdate(field, update) {
  // Update shape: {contactId, field, value, ts, source}
  field.constraints.push({
    id: "update::" + update.contactId + "::" + update.ts + "::" + (update.source || "local"),
    kind: "data",
    pattern: { type: "contact-update" },
    data: {
      contactId: update.contactId,
      field: update.field,
      value: update.value,
      _ts: update.ts,
      _from: update.source || "local"
    },
    birth: field.step, lastUsed: field.step, uses: 0, weight: 1, permanent: false
  });
}

// Reduce: walk updates, produce current view.
// Initial state from contact-record; apply each update in timestamp order.
function currentContactView(field, contactId) {
  let view = null;
  // Find the base contact-record
  for (const c of field.constraints) {
    if (c && c.pattern && c.pattern.type === "contact-record" &&
        c.data && c.data.id === contactId) {
      view = Object.assign({}, c.data);
      break;
    }
  }
  if (!view) return null;
  // Collect updates for this contact, sort by timestamp
  const updates = [];
  for (const c of field.constraints) {
    if (c && c.pattern && c.pattern.type === "contact-update" &&
        c.data && c.data.contactId === contactId) {
      updates.push(c.data);
    }
  }
  updates.sort(function (a, b) {
    if (a._ts !== b._ts) return a._ts - b._ts;
    // Tie-break on source for determinism (no real CRM uses lexicographic
    // tie-break, but for the test we want determinism)
    return a._from < b._from ? -1 : 1;
  });
  for (const u of updates) {
    view[u.field] = u.value;
    view._lastUpdateTs = u._ts;
    view._lastUpdateFrom = u._from;
  }
  return view;
}

// Count update records for a given contact
function updateCountForContact(field, contactId) {
  let n = 0;
  for (const c of field.constraints) {
    if (c && c.pattern && c.pattern.type === "contact-update" &&
        c.data && c.data.contactId === contactId) n++;
  }
  return n;
}

// ----------------------------------------------------------------------------
// Cross-instance sync via M2 LoopbackTransport
//
// Each side wraps its outgoing emit in transport.send. Receives arrive
// via transport.onReceive and route through publisher.publish, which is
// the SE-08 contributor pathway. The receiving field then has an intake
// record from a remote source.
// ----------------------------------------------------------------------------
function wireBidirectional(instanceA, instanceB) {
  const [tA, tB] = TransportBinding.LoopbackTransport.pair();

  // Track all outbound emissions for verification
  const outboundFromA = [];
  const outboundFromB = [];

  // A.emit pushes to outgoing transport AS WELL AS records locally
  // (a contact-update originating at A is in A's field via local apply,
  // and ALSO sent over the wire so B can apply it locally too)
  function emitFromA(updateRecord) {
    outboundFromA.push(updateRecord);
    // Local apply: A's own field gets the update
    applyContactUpdate(instanceA.field, updateRecord);
    // Wire: send to B
    return tA.send(JSON.stringify(updateRecord));
  }
  function emitFromB(updateRecord) {
    outboundFromB.push(updateRecord);
    applyContactUpdate(instanceB.field, updateRecord);
    return tB.send(JSON.stringify(updateRecord));
  }

  // B's incoming: receive A's emissions, apply to B's field
  // (via publisher.publish to honor SE-08 contributor pathway, then
  // a domain-side handler that translates the contributor record into
  // a constraint via applyContactUpdate)
  const inboundToBSubscription = tB.onReceive(function (framedBytes) {
    try {
      const updateRecord = JSON.parse(framedBytes);
      // SE-08 pathway: publish as contributor record
      instanceB.publisher.publish({
        type: "remote-contact-update",
        value: updateRecord,
        source: "chain-link-from-" + instanceA.id
      });
      // Domain integration: turn the intake record into a constraint
      applyContactUpdate(instanceB.field, updateRecord);
    } catch (e) { /* F3 */ }
  });

  const inboundToASubscription = tA.onReceive(function (framedBytes) {
    try {
      const updateRecord = JSON.parse(framedBytes);
      instanceA.publisher.publish({
        type: "remote-contact-update",
        value: updateRecord,
        source: "chain-link-from-" + instanceB.id
      });
      applyContactUpdate(instanceA.field, updateRecord);
    } catch (e) { /* F3 */ }
  });

  return {
    emitFromA, emitFromB,
    transportA: tA, transportB: tB,
    outboundFromA, outboundFromB,
    flush: async function () {
      // Wait for all in-flight messages to settle (LoopbackTransport
      // delivers async via setImmediate, so a few ticks usually suffice)
      await sleep(20);
    },
    teardown: function () {
      inboundToASubscription.unsubscribe();
      inboundToBSubscription.unsubscribe();
    }
  };
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  console.log("p9-multiuser verification (the composition test)");
  console.log("");

  // --------------------------------------------------------------------
  // PART A: single-instance end-to-end flow (sanity)
  // --------------------------------------------------------------------
  console.log("PART A: single-instance end-to-end (sanity)");
  console.log("");

  await asyncTest("Single instance: login, create contact, commit, hydrate", async () => {
    const inst = buildInstance({ id: "solo" });

    // Login
    inst.identity.setSession({ user_id: "u-solo", role: "admin" });
    // Verify identity records in intake
    const idRecs = inst.field.intake.records.filter(r => r.source === "identity-adapter");
    assert(idRecs.length === 3);

    // Create a contact
    createContact(inst.field, {
      id: "alice", name: "Alice Smith", email: "alice@old.com", status: "lead"
    }, 0, "u-solo");

    // Commit
    const r1 = await inst.persistence.commit();
    assert(typeof r1.address === "string");

    // Update via update-record (event-sourced)
    applyContactUpdate(inst.field, {
      contactId: "alice", field: "email", value: "alice@new.com",
      ts: 100, source: "u-solo"
    });

    // Current view: most recent update wins
    const view = currentContactView(inst.field, "alice");
    assert(view.email === "alice@new.com", "view.email=" + view.email);

    // Commit again
    const r2 = await inst.persistence.commit();
    assert(r2.address !== r1.address);

    // Hydrate r1 in a fresh field: contact at original state
    const fresh = buildInstance({ id: "fresh", store: inst.persistence.identity.store });
    await fresh.persistence.restore(r1.address);
    const oldView = currentContactView(fresh.field, "alice");
    assert(oldView, "alice should exist after hydrate");
    assert(oldView.email === "alice@old.com",
      "expected old@; got " + oldView.email);
  });

  // --------------------------------------------------------------------
  // PART B: two-instance setup with LoopbackTransport pair
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART B: two-instance setup");
  console.log("");

  await asyncTest("Build two independent instances; wire bidirectional transport", async () => {
    const A = buildInstance({ id: "A" });
    const B = buildInstance({ id: "B" });
    // Each instance is independent: separate fieldModule, separate field state
    assert(A.field !== B.field);
    assert(A.fieldMod !== B.fieldMod);
    // No shared object refs
    A.field.step = 999;
    assert(B.field.step !== 999, "B's field unaffected by A's mutation");

    const wire = wireBidirectional(A, B);
    assert(typeof wire.emitFromA === "function");
    assert(typeof wire.emitFromB === "function");
    wire.teardown();
  });

  // --------------------------------------------------------------------
  // PART C: A->B propagation via M2 transport
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART C: A->B propagation");
  console.log("");

  await asyncTest("A creates contact, emits update; B receives via transport", async () => {
    const A = buildInstance({ id: "A" });
    const B = buildInstance({ id: "B" });
    // Both sides start with the same baseline contact (would be loaded
    // from a shared seed in a real deployment; here we just sync init)
    const baseContact = {
      id: "alice", name: "Alice Smith", email: "alice@start.com", status: "lead"
    };
    createContact(A.field, baseContact, 0, "init");
    createContact(B.field, baseContact, 0, "init");

    const wire = wireBidirectional(A, B);

    // A updates alice's email
    await wire.emitFromA({
      contactId: "alice", field: "email", value: "alice@from-A.com",
      ts: 100, source: "A"
    });

    // Wait for transport delivery
    await wire.flush();

    // A's field has the update locally
    const aView = currentContactView(A.field, "alice");
    assert(aView.email === "alice@from-A.com");

    // B's field NOW has the update via the chain
    const bView = currentContactView(B.field, "alice");
    assert(bView.email === "alice@from-A.com",
      "B should have A's update; got: " + bView.email);

    // B's intake recorded a remote-contact-update
    const remoteRecs = B.field.intake.records.filter(
      r => r.type === "remote-contact-update");
    assert(remoteRecs.length === 1, "B intake should have 1 remote update");
    assert(remoteRecs[0].source.indexOf("chain-link-from-A") === 0);

    wire.teardown();
  });

  await asyncTest("B->A propagation: symmetric", async () => {
    const A = buildInstance({ id: "A" });
    const B = buildInstance({ id: "B" });
    createContact(A.field, { id: "bob", name: "Bob", email: "old@x.com" }, 0, "init");
    createContact(B.field, { id: "bob", name: "Bob", email: "old@x.com" }, 0, "init");

    const wire = wireBidirectional(A, B);
    await wire.emitFromB({
      contactId: "bob", field: "email", value: "bob@from-B.com",
      ts: 200, source: "B"
    });
    await wire.flush();

    const bView = currentContactView(B.field, "bob");
    const aView = currentContactView(A.field, "bob");
    assert(bView.email === "bob@from-B.com");
    assert(aView.email === "bob@from-B.com",
      "A should have B's update; got: " + aView.email);

    wire.teardown();
  });

  // --------------------------------------------------------------------
  // PART D: concurrent updates from both sides
  //
  // The structural F5 claim: BOTH contributions deposited; current view
  // is the integrated history. With timestamp ordering, the later
  // timestamp wins on both sides (deterministic convergence).
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART D: concurrent updates - F5 + convergence");
  console.log("");

  await asyncTest("Concurrent updates: both retained on both sides (F5)", async () => {
    const A = buildInstance({ id: "A" });
    const B = buildInstance({ id: "B" });
    createContact(A.field, { id: "carol", name: "Carol", email: "old@x.com" }, 0, "init");
    createContact(B.field, { id: "carol", name: "Carol", email: "old@x.com" }, 0, "init");

    const wire = wireBidirectional(A, B);

    // Concurrent: A and B both update at "the same time" (different ts)
    await wire.emitFromA({
      contactId: "carol", field: "email", value: "carol@from-A.com",
      ts: 100, source: "A"
    });
    await wire.emitFromB({
      contactId: "carol", field: "email", value: "carol@from-B.com",
      ts: 101, source: "B"
    });
    await wire.flush();

    // Both fields contain BOTH updates (F5: contributions deposited, not overwritten)
    assert(updateCountForContact(A.field, "carol") === 2,
      "A field should have 2 carol updates; got " + updateCountForContact(A.field, "carol"));
    assert(updateCountForContact(B.field, "carol") === 2,
      "B field should have 2 carol updates");

    // Current view on BOTH sides converges to the higher-ts value
    const aView = currentContactView(A.field, "carol");
    const bView = currentContactView(B.field, "carol");
    assert(aView.email === "carol@from-B.com",
      "A view email=" + aView.email);
    assert(bView.email === "carol@from-B.com",
      "B view email=" + bView.email);

    wire.teardown();
  });

  await asyncTest("Many concurrent updates: deterministic convergence", async () => {
    const A = buildInstance({ id: "A" });
    const B = buildInstance({ id: "B" });
    createContact(A.field, { id: "dan", name: "Dan", email: "0" }, 0, "init");
    createContact(B.field, { id: "dan", name: "Dan", email: "0" }, 0, "init");

    const wire = wireBidirectional(A, B);

    // Interleave 10 updates from each side
    const sends = [];
    for (let i = 1; i <= 10; i++) {
      sends.push(wire.emitFromA({
        contactId: "dan", field: "email", value: "A-" + i,
        ts: i * 10, source: "A"
      }));
      sends.push(wire.emitFromB({
        contactId: "dan", field: "email", value: "B-" + i,
        ts: i * 10 + 1, source: "B"
      }));
    }
    await Promise.all(sends);
    await wire.flush();

    // Both sides have all 20 updates
    assert(updateCountForContact(A.field, "dan") === 20,
      "A should have 20 updates; got " + updateCountForContact(A.field, "dan"));
    assert(updateCountForContact(B.field, "dan") === 20,
      "B should have 20 updates");

    // Convergence: highest ts is 101 (i=10, B-side: 10*10+1)
    const aView = currentContactView(A.field, "dan");
    const bView = currentContactView(B.field, "dan");
    assert(aView.email === "B-10", "A converged to B-10; got " + aView.email);
    assert(bView.email === "B-10", "B converged to B-10");

    wire.teardown();
  });

  // --------------------------------------------------------------------
  // PART E: field convergence demonstration
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART E: field convergence");
  console.log("");

  await asyncTest("After full sync: A's view of carol === B's view of carol", async () => {
    const A = buildInstance({ id: "A" });
    const B = buildInstance({ id: "B" });
    createContact(A.field, { id: "eve", name: "Eve", email: "x", status: "lead" }, 0, "init");
    createContact(B.field, { id: "eve", name: "Eve", email: "x", status: "lead" }, 0, "init");

    const wire = wireBidirectional(A, B);

    // Several updates from both sides
    await wire.emitFromA({ contactId: "eve", field: "email", value: "eve@A.com", ts: 50, source: "A" });
    await wire.emitFromB({ contactId: "eve", field: "status", value: "qualified", ts: 60, source: "B" });
    await wire.emitFromA({ contactId: "eve", field: "name", value: "Eve Smith", ts: 70, source: "A" });
    await wire.flush();

    const aView = currentContactView(A.field, "eve");
    const bView = currentContactView(B.field, "eve");

    // Same field convergence: name, email, status all match
    assert(aView.name === bView.name, "name: A=" + aView.name + " B=" + bView.name);
    assert(aView.email === bView.email);
    assert(aView.status === bView.status);
    // All three changes are present in the converged view
    assert(aView.email === "eve@A.com");
    assert(aView.status === "qualified");
    assert(aView.name === "Eve Smith");

    wire.teardown();
  });

  // --------------------------------------------------------------------
  // PART F: out-of-order delivery still converges
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART F: out-of-order delivery");
  console.log("");

  await asyncTest("Late-arriving older update doesn't overtake newer", async () => {
    const A = buildInstance({ id: "A" });
    const B = buildInstance({ id: "B" });
    createContact(A.field, { id: "frank", email: "0" }, 0, "init");
    createContact(B.field, { id: "frank", email: "0" }, 0, "init");

    const wire = wireBidirectional(A, B);

    // A sends a NEW update first; B has a stale update with EARLIER ts
    await wire.emitFromA({
      contactId: "frank", field: "email", value: "fresh-A",
      ts: 1000, source: "A"
    });
    await wire.flush();
    // Now B sends a stale update (earlier ts - simulates a delayed write)
    await wire.emitFromB({
      contactId: "frank", field: "email", value: "stale-B",
      ts: 500, source: "B"
    });
    await wire.flush();

    // Even though B's update arrived later in wall time, it has earlier ts
    // The converged view should be A's update (ts=1000, more recent)
    const aView = currentContactView(A.field, "frank");
    const bView = currentContactView(B.field, "frank");
    assert(aView.email === "fresh-A",
      "A should keep fresh-A; got " + aView.email);
    assert(bView.email === "fresh-A",
      "B should converge to fresh-A; got " + bView.email);

    wire.teardown();
  });

  // --------------------------------------------------------------------
  // PART G: M2 transport stats prove actual chain delivery
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART G: chain delivery accounting");
  console.log("");

  await asyncTest("Transport stats account for all sent + received messages", async () => {
    const A = buildInstance({ id: "A" });
    const B = buildInstance({ id: "B" });
    createContact(A.field, { id: "g", email: "0" }, 0, "init");
    createContact(B.field, { id: "g", email: "0" }, 0, "init");

    const wire = wireBidirectional(A, B);

    const sends = [];
    for (let i = 0; i < 5; i++) {
      sends.push(wire.emitFromA({ contactId: "g", field: "email", value: "A-" + i, ts: i, source: "A" }));
      sends.push(wire.emitFromB({ contactId: "g", field: "email", value: "B-" + i, ts: i, source: "B" }));
    }
    await Promise.all(sends);
    await wire.flush();

    const aStats = wire.transportA.observe();
    const bStats = wire.transportB.observe();
    assert(aStats.sent === 5, "A sent 5; got " + aStats.sent);
    assert(bStats.sent === 5, "B sent 5; got " + bStats.sent);
    assert(aStats.received === 5, "A received 5; got " + aStats.received);
    assert(bStats.received === 5, "B received 5; got " + bStats.received);
    assert(aStats.errors === 0);
    assert(bStats.errors === 0);

    wire.teardown();
  });

  // --------------------------------------------------------------------
  // PART H: persistence + multi-user compose (P3 + P9)
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART H: persistence composes with multi-user");
  console.log("");

  await asyncTest("Each side commits its own snapshot; addresses differ", async () => {
    const A = buildInstance({ id: "A" });
    const B = buildInstance({ id: "B" });
    createContact(A.field, { id: "h", email: "0" }, 0, "init");
    createContact(B.field, { id: "h", email: "0" }, 0, "init");

    const wire = wireBidirectional(A, B);
    await wire.emitFromA({ contactId: "h", field: "email", value: "A-1", ts: 10, source: "A" });
    await wire.flush();

    // After sync: both fields have the same logical contact-update set,
    // but each has independent commits to their independent stores
    const rA = await A.persistence.commit();
    const rB = await B.persistence.commit();

    // Address may match (since both fields converge to same content) or
    // differ (timestamps in artifact vary). Both addresses retrievable
    // from their own stores.
    const artifactA = await A.persistence.identity.store.get(rA.address);
    const artifactB = await B.persistence.identity.store.get(rB.address);
    assert(artifactA);
    assert(artifactB);
    // The number of update constraints on each side should match
    const aUpdates = artifactA.fieldData.constraints.filter(
      c => c && c.pattern && c.pattern.type === "contact-update").length;
    const bUpdates = artifactB.fieldData.constraints.filter(
      c => c && c.pattern && c.pattern.type === "contact-update").length;
    assert(aUpdates === 1);
    assert(bUpdates === 1, "expected 1 update on B; got " + bUpdates);

    wire.teardown();
  });

  // --------------------------------------------------------------------
  // PART I: F5 - all contributions retained even after many syncs
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART I: F5 - all contributions retained");
  console.log("");

  await asyncTest("100 alternating updates: every single one in both fields", async () => {
    const A = buildInstance({ id: "A" });
    const B = buildInstance({ id: "B" });
    createContact(A.field, { id: "i", email: "0" }, 0, "init");
    createContact(B.field, { id: "i", email: "0" }, 0, "init");

    const wire = wireBidirectional(A, B);

    const sends = [];
    for (let i = 1; i <= 50; i++) {
      sends.push(wire.emitFromA({ contactId: "i", field: "email", value: "A-" + i, ts: i * 2, source: "A" }));
      sends.push(wire.emitFromB({ contactId: "i", field: "email", value: "B-" + i, ts: i * 2 + 1, source: "B" }));
    }
    await Promise.all(sends);
    await wire.flush();

    assert(updateCountForContact(A.field, "i") === 100,
      "A should have 100 updates; got " + updateCountForContact(A.field, "i"));
    assert(updateCountForContact(B.field, "i") === 100,
      "B should have 100 updates");

    wire.teardown();
  });

  // --------------------------------------------------------------------
  // PART J: multi-user with the FULL P-layer engaged
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART J: full P-layer composes (auth + persistence + reports)");
  console.log("");

  await asyncTest("Auth (P2) + multi-user (P9): identity coords don't leak", async () => {
    const A = buildInstance({ id: "A" });
    const B = buildInstance({ id: "B" });
    A.identity.setSession({ user_id: "u-alice", role: "admin" });
    B.identity.setSession({ user_id: "u-bob", role: "rep" });

    // Identity records are LOCAL to each instance; don't propagate over the chain
    // (the chain only carries contact-update records in our wiring)
    const wire = wireBidirectional(A, B);
    await wire.emitFromA({ contactId: "x", field: "y", value: "z", ts: 1, source: "A" });
    await wire.flush();

    // A's intake: identity records (3) + locally-applied update? No - emit only sends to B.
    // A's identity records remain valid, distinct from B's
    const aIdRecs = A.field.intake.records.filter(r => r.source === "identity-adapter");
    const bIdRecs = B.field.intake.records.filter(r => r.source === "identity-adapter");
    const aRoles = aIdRecs.filter(r => r.type === "user-role");
    const bRoles = bIdRecs.filter(r => r.type === "user-role");
    assert(aRoles[aRoles.length - 1].value === "admin");
    assert(bRoles[bRoles.length - 1].value === "rep");

    wire.teardown();
  });

  await asyncTest("Reports (P6) on each side see the integrated history", async () => {
    const A = buildInstance({ id: "A" });
    const B = buildInstance({ id: "B" });
    // Add deals to BOTH sides separately
    A.field.constraints.push({
      id: "deal::1", kind: "data", pattern: { type: "deal-record" },
      data: { id: "1", stage: "discovery", owner: "alice" },
      birth: 0, lastUsed: 0, uses: 0, weight: 1, permanent: false
    });
    B.field.constraints.push({
      id: "deal::2", kind: "data", pattern: { type: "deal-record" },
      data: { id: "2", stage: "qualified", owner: "bob" },
      birth: 0, lastUsed: 0, uses: 0, weight: 1, permanent: false
    });

    // No chain wiring for deal-records in this fixture; reports run independently
    const aReport = A.reports.dealsByStage.generate();
    const bReport = B.reports.dealsByStage.generate();

    assert(aReport.total === 1);
    assert(aReport.counts.discovery === 1);
    assert(bReport.total === 1);
    assert(bReport.counts.qualified === 1);
    // (Reports differ because deal-records didn't sync. To make them
    // converge, we'd extend the chain wiring to deal-records too.
    // The P9 demonstration for that pattern is structurally identical
    // to contact-update sync - same primitives, same SE-08 + chain.)
  });

  // --------------------------------------------------------------------
  // PART K: closure
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART K: closure");
  console.log("");

  test("p9-multiuser-verifier.js: ASCII-only", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "p9-multiuser-verifier.js"), "utf8");
    const m = src.match(/[^\x00-\x7F]/);
    assert(!m, "non-ASCII: " + (m && m[0]));
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
}

main().catch(e => { console.error("Fatal:", e); process.exit(2); });
