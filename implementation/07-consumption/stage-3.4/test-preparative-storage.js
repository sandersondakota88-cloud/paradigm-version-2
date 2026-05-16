// test-preparative-storage.js

"use strict";

const fs = require("fs");
const M1 = require("./stage1-lexical-typing-substrate.js");
const Mp = require("./preparative-substrate.js");
const Ms = require("./preparative-storage.js");

let pass = 0, fail = 0;
const failures = [];

function check(name, fn) {
  return Promise.resolve().then(fn).then(function () {
    pass++;
    console.log("  ok    " + name);
  }).catch(function (e) {
    fail++;
    failures.push({ name: name, error: e });
    console.log("  FAIL  " + name + "  --  " + e.message);
  });
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error((msg || "assertEqual") + ": " + JSON.stringify(a) + " !== " + JSON.stringify(b));
}

function assertDeepEqual(a, b, msg) {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa !== sb) throw new Error((msg || "assertDeepEqual") + ": " + sa + " !== " + sb);
}

function assertThrows(fn, pattern, msg) {
  let threw = false, errMsg = "";
  try { fn(); } catch (e) { threw = true; errMsg = e.message; }
  if (!threw) throw new Error((msg || "expected throw") + ": did not throw");
  if (pattern && errMsg.indexOf(pattern) < 0) {
    throw new Error((msg || "throw pattern") + ": expected '" + pattern + "', got '" + errMsg + "'");
  }
}

// Build a real preparative map by running the substrate on the canonical fixture
function buildRealMap() {
  const source = fs.readFileSync("./constraints-only.js", "utf8");
  const sub1 = M1.createStage1Substrate({ id: "s1" });
  sub1.ingest(Buffer.from(source, "ascii"));
  const vsf1 = sub1.emitVsf();
  const ps = Mp.createPreparativeSubstrate({ id: "test" });
  ps.ingestStage1Vsf(vsf1);
  const map = ps.buildPreparativeMap(source);
  return { source: source, vsf: vsf1, substrate: ps, map: map };
}

(async function () {

  console.log("== validation ==");

  await check("validateMapRecord rejects non-object", function () {
    assertThrows(function () { Ms.validateMapRecord(null); }, "must be object");
    assertThrows(function () { Ms.validateMapRecord("string"); }, "must be object");
  });

  await check("validateMapRecord rejects bad sourceHash", function () {
    assertThrows(function () {
      Ms.validateMapRecord({
        sourceHash: "not-a-hash",
        version: "v",
        sourceBytes: 1, tokensSeen: 1, textTokensSeen: 1,
        sealed: false, sealHash: "",
        entries: []
      });
    }, "invalid sourceHash");
  });

  await check("validateMapRecord rejects non-ASCII version", function () {
    const badRec = {
      sourceHash: "0000000000000000000000000000000000000000000000000000000000000000",
      version: "v\u00e9",
      sourceBytes: 1, tokensSeen: 1, textTokensSeen: 1,
      sealed: false, sealHash: "",
      entries: []
    };
    assertThrows(function () { Ms.validateMapRecord(badRec); }, "ASCII");
  });

  await check("validateMapRecord rejects non-ASCII entry text", function () {
    const badRec = {
      sourceHash: "0000000000000000000000000000000000000000000000000000000000000000",
      version: "v", sourceBytes: 1, tokensSeen: 1, textTokensSeen: 1,
      sealed: false, sealHash: "",
      entries: [{
        text: "caf\u00e9",
        derivedKind: "DOMAIN_VALUE",
        distinctiveness: 0.5,
        occurrenceCount: 1
      }]
    };
    assertThrows(function () { Ms.validateMapRecord(badRec); }, "ASCII");
  });

  await check("validateTraceRecord rejects opId < 1", function () {
    assertThrows(function () {
      Ms.validateTraceRecord({
        opId: 0, sourceHash: "0000000000000000000000000000000000000000000000000000000000000000",
        op: "x", step: 0, delta: 0, timestamp: 0
      });
    }, ">= 1");
  });

  console.log("== makeMapRecord ==");

  await check("makeMapRecord builds a valid record from substrate output", function () {
    const r = buildRealMap();
    const rec = Ms.makeMapRecord(r.map, { timestamp: 12345 });
    assertEqual(rec.sourceHash, r.map.sourceHash, "sourceHash preserved");
    assertEqual(rec.timestamp, 12345, "timestamp set");
    assertEqual(rec.sealed, false, "default sealed=false");
    assertEqual(rec.entries.length, r.map.entries.length, "entries count preserved");
    if (rec.entries.length > 0) {
      const e0 = rec.entries[0];
      assertEqual(typeof e0.text, "string", "entry has text");
      assertEqual(typeof e0.derivedKind, "string", "entry has derivedKind");
    }
  });

  console.log("== in-memory storage: maps ==");

  await check("getMap returns null for missing hash", async function () {
    const s = Ms.createInMemoryStorage();
    const r = await s.getMap("0000000000000000000000000000000000000000000000000000000000000000");
    assertEqual(r, null, "missing returns null");
  });

  await check("putMap then getMap round-trips", async function () {
    const s = Ms.createInMemoryStorage();
    const r = buildRealMap();
    const rec = Ms.makeMapRecord(r.map);
    const writtenHash = await s.putMap(rec);
    assertEqual(writtenHash, rec.sourceHash, "putMap returns hash");
    const got = await s.getMap(rec.sourceHash);
    if (!got) throw new Error("getMap returned null");
    assertEqual(got.sourceHash, rec.sourceHash, "round-trip sourceHash");
    assertEqual(got.entries.length, rec.entries.length, "round-trip entries");
  });

  await check("putMap deep-clones (storage isolated from caller)", async function () {
    const s = Ms.createInMemoryStorage();
    const r = buildRealMap();
    const rec = Ms.makeMapRecord(r.map);
    await s.putMap(rec);
    // Mutate the caller's record
    rec.entries.push({ text: "INJECTED", derivedKind: "DOMAIN_VALUE", distinctiveness: 1, occurrenceCount: 1 });
    const got = await s.getMap(rec.sourceHash);
    if (got.entries.find(function (e) { return e.text === "INJECTED"; })) {
      throw new Error("storage was mutated through caller's reference");
    }
  });

  await check("listMapHashes returns sorted hashes", async function () {
    const s = Ms.createInMemoryStorage();
    const r = buildRealMap();
    const rec1 = Ms.makeMapRecord(r.map);
    // Build a second record with a different hash by altering source slightly
    const altSource = r.source + "\n// hello";
    const sub1 = M1.createStage1Substrate({ id: "alt" });
    sub1.ingest(Buffer.from(altSource, "ascii"));
    const altVsf = sub1.emitVsf();
    const ps2 = Mp.createPreparativeSubstrate({ id: "alt-test" });
    ps2.ingestStage1Vsf(altVsf);
    const map2 = ps2.buildPreparativeMap(altSource);
    const rec2 = Ms.makeMapRecord(map2);
    await s.putMap(rec1);
    await s.putMap(rec2);
    const hashes = await s.listMapHashes();
    assertEqual(hashes.length, 2, "two hashes");
    assertEqual(hashes[0] < hashes[1], true, "sorted ascending");
  });

  await check("deleteMap removes entry", async function () {
    const s = Ms.createInMemoryStorage();
    const r = buildRealMap();
    const rec = Ms.makeMapRecord(r.map);
    await s.putMap(rec);
    const removed = await s.deleteMap(rec.sourceHash);
    assertEqual(removed, true, "delete returned true");
    const got = await s.getMap(rec.sourceHash);
    assertEqual(got, null, "post-delete is null");
  });

  console.log("== in-memory storage: traces ==");

  await check("appendTrace assigns monotonic opIds", async function () {
    const s = Ms.createInMemoryStorage();
    const sh = "1111111111111111111111111111111111111111111111111111111111111111";
    const id1 = await s.appendTrace({ sourceHash: sh, op: "test", step: 1, delta: 0.5, detail: {} });
    const id2 = await s.appendTrace({ sourceHash: sh, op: "test", step: 2, delta: 0.4, detail: {} });
    const id3 = await s.appendTrace({ sourceHash: sh, op: "test", step: 3, delta: 0.3, detail: {} });
    assertEqual(id1, 1, "first opId is 1");
    assertEqual(id2, 2, "second is 2");
    assertEqual(id3, 3, "third is 3");
  });

  await check("listTraces filters by sourceHash and sinceOpId", async function () {
    const s = Ms.createInMemoryStorage();
    const a = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const b = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    await s.appendTrace({ sourceHash: a, op: "x", step: 1, delta: 1, detail: {} });
    await s.appendTrace({ sourceHash: b, op: "x", step: 1, delta: 1, detail: {} });
    await s.appendTrace({ sourceHash: a, op: "y", step: 2, delta: 0.5, detail: {} });
    await s.appendTrace({ sourceHash: a, op: "z", step: 3, delta: 0.25, detail: {} });
    const aTraces = await s.listTraces(a);
    const bTraces = await s.listTraces(b);
    assertEqual(aTraces.length, 3, "a has 3 traces");
    assertEqual(bTraces.length, 1, "b has 1 trace");
    const after2 = await s.listTraces(a, { sinceOpId: 1 });
    // Note: appendTrace returns IDs in insertion order; a's traces are
    // opIds 1, 3, 4. sinceOpId=1 -> opIds 3 and 4.
    assertEqual(after2.length, 2, "sinceOpId=1 returns 2 traces");
  });

  await check("trace retention caps at MAX_TRACES_PER_SOURCE", async function () {
    const s = Ms.createInMemoryStorage();
    const sh = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
    const N = Ms.MAX_TRACES_PER_SOURCE + 50;
    for (let i = 0; i < N; i++) {
      await s.appendTrace({ sourceHash: sh, op: "t", step: i, delta: 1 - i/N, detail: {} });
    }
    const traces = await s.listTraces(sh, { limit: 10000 });
    if (traces.length !== Ms.MAX_TRACES_PER_SOURCE) {
      throw new Error("expected " + Ms.MAX_TRACES_PER_SOURCE + " traces, got " + traces.length);
    }
    // Oldest 50 should have been dropped; smallest opId should be 51
    assertEqual(traces[0].opId, 51, "oldest opId after retention is 51");
  });

  await check("listTraces honors limit", async function () {
    const s = Ms.createInMemoryStorage();
    const sh = "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
    for (let i = 0; i < 20; i++) {
      await s.appendTrace({ sourceHash: sh, op: "t", step: i, delta: 0.5, detail: {} });
    }
    const five = await s.listTraces(sh, { limit: 5 });
    assertEqual(five.length, 5, "limit=5");
  });

  await check("clearAll empties both stores", async function () {
    const s = Ms.createInMemoryStorage();
    const r = buildRealMap();
    await s.putMap(Ms.makeMapRecord(r.map));
    await s.appendTrace({ sourceHash: r.map.sourceHash, op: "x", step: 1, delta: 1, detail: {} });
    await s.clearAll();
    const stats = s._stats();
    assertEqual(stats.mapCount, 0, "maps empty");
    assertEqual(stats.traceCount, 0, "traces empty");
  });

  console.log("== mediator ==");

  await check("ensureMap returns null for unknown source", async function () {
    const s = Ms.createInMemoryStorage();
    const m = Ms.createMediator(s);
    const got = await m.ensureMap("eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
    assertEqual(got, null, "unknown source returns null");
  });

  await check("buildAndStore writes map and trace, ensureMap retrieves", async function () {
    const s = Ms.createInMemoryStorage();
    const m = Ms.createMediator(s);
    const r = buildRealMap();
    const stored = await m.buildAndStore(r.substrate, r.source);
    assertEqual(stored.sourceHash, r.map.sourceHash, "stored hash matches");
    const retrieved = await m.ensureMap(r.map.sourceHash);
    if (!retrieved) throw new Error("ensureMap returned null after buildAndStore");
    assertEqual(retrieved.sourceHash, r.map.sourceHash, "retrieved hash matches");
    const traces = await m.traces(r.map.sourceHash);
    assertEqual(traces.length, 1, "one trace appended");
    assertEqual(traces[0].op, "map-write", "trace op is map-write");
  });

  await check("listSources returns hashes after buildAndStore", async function () {
    const s = Ms.createInMemoryStorage();
    const m = Ms.createMediator(s);
    const r = buildRealMap();
    await m.buildAndStore(r.substrate, r.source);
    const list = await m.listSources();
    assertEqual(list.length, 1, "one source");
    assertEqual(list[0], r.map.sourceHash, "source hash listed");
  });

  console.log("== applyPreparativeMapToVsf integration ==");

  await check("apply enriches vsf with derived kinds", async function () {
    const r = buildRealMap();
    const enriched = Mp.applyPreparativeMapToVsf(r.vsf, r.map);
    if (typeof enriched !== "string" || enriched.length === 0) {
      throw new Error("enriched VSF empty");
    }
    if (!Mp.asciiOnly(enriched)) {
      throw new Error("enriched VSF non-ASCII");
    }
    // The enriched VSF should preserve the header section unchanged
    const sepOrig = r.vsf.indexOf("\n---\n");
    const sepNew = enriched.indexOf("\n---\n");
    assertEqual(r.vsf.slice(0, sepOrig), enriched.slice(0, sepNew), "header preserved");
    // It should contain at least one derived-kind reference if any entries
    // had non-UNCLASSIFIED derivedKind.
    if (r.map.entries.length > 0) {
      const hasDerived = /\|(DOMAIN_VALUE|DOMAIN_DIM|IDIOMATIC|LIBRARY_REF)\|/.test(enriched);
      if (!hasDerived) {
        throw new Error("enriched VSF has no derived kinds despite map entries");
      }
    }
  });

  await check("round-trip: map written, read back, applied, kinds present", async function () {
    const s = Ms.createInMemoryStorage();
    const m = Ms.createMediator(s);
    const r = buildRealMap();
    await m.buildAndStore(r.substrate, r.source);
    const retrieved = await m.ensureMap(r.map.sourceHash);
    const enriched = Mp.applyPreparativeMapToVsf(r.vsf, retrieved);
    if (!Mp.asciiOnly(enriched)) {
      throw new Error("round-trip enrichment non-ASCII");
    }
    // The enriched vsf should be identical whether built from the in-memory
    // map or the storage-retrieved map (S2 substrate-equivalence)
    const enrichedDirect = Mp.applyPreparativeMapToVsf(r.vsf, r.map);
    assertEqual(enriched, enrichedDirect, "stored-and-retrieved map produces identical enrichment");
  });

  console.log("");
  console.log(pass + " passed, " + fail + " failed");
  if (fail > 0) {
    console.log("");
    for (const f of failures) {
      console.log("FAIL: " + f.name);
      console.log("      " + f.error.stack);
    }
    process.exit(1);
  }
})();
