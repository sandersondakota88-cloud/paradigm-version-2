// m2-chain-transport-verifier.js - M2 acceptance: transport-equivalence

"use strict";

const fs = require("fs");
const path = require("path");

const ChainComposer = require("./chain-composer.js");
const Transport = require("./chain-transport-binding.js");
const Codec = require("./vsf-codec-min.js");
const Remote = require("./chain-link-remote.js");
const Async = require("./chain-runner-async.js");

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
// Test fixture: 3 deterministic links producing different contributions
// ----------------------------------------------------------------------------
function makeLink(id, contributionsForArtifact) {
  return {
    id: id,
    apply(artifact) {
      // Pure function of artifact: same input -> same output
      return {
        contributions: contributionsForArtifact(artifact),
        metadata: { id: id, sawRows: artifact.rows.length }
      };
    }
  };
}

const LINK_A = makeLink("link-a", function (art) {
  return [
    { coord: "x", value: 10 },
    { coord: "y", value: 20 }
  ];
});

const LINK_B = makeLink("link-b", function (art) {
  // Doubles whatever x/y are (reads upstream rows)
  const lookup = {};
  for (const r of art.rows) lookup[r.coord] = r.value;
  return [
    { coord: "x2", value: (lookup["x"] || 0) * 2 },
    { coord: "y2", value: (lookup["y"] || 0) * 2 }
  ];
});

const LINK_C = makeLink("link-c", function (art) {
  return [{ coord: "z", value: 100 }];
});

const TEST_INPUT = { seed: 42 };
const TEST_DIMS = ["x", "y", "x2", "y2", "z"];

async function main() {
  console.log("m2-chain-transport verification");
  console.log("");

  // --------------------------------------------------------------------
  // PART A: codec invariants
  // --------------------------------------------------------------------
  console.log("PART A: codec invariants");
  console.log("");

  test("canonicalize: deterministic key ordering", () => {
    const a = Codec.canonicalize({ b: 1, a: 2, c: 3 });
    const b = Codec.canonicalize({ a: 2, c: 3, b: 1 });
    assert(a === b);
    assert(a === '{"a":2,"b":1,"c":3}');
  });

  test("hashString: same input -> same hash", () => {
    const h1 = Codec.hashString("hello");
    const h2 = Codec.hashString("hello");
    assert(h1 === h2);
    const h3 = Codec.hashString("world");
    assert(h1 !== h3);
  });

  test("encode: requires all fields", () => {
    let threw = false;
    try { Codec.encode({}); } catch (e) { threw = true; }
    assert(threw);
    threw = false;
    try { Codec.encode({chainId: "c", linkIdx: 0}); } catch (e) { threw = true; }
    assert(threw);
  });

  test("encode/decode roundtrip", () => {
    const artifact = ChainComposer.makeGenesisArtifact(TEST_INPUT,
      { dimensions: TEST_DIMS });
    const framed = Codec.encode({
      chainId: "c1", linkIdx: 0, produced: 1, artifact: artifact
    });
    assert(typeof framed === "string");
    const decoded = Codec.decode(framed);
    assert(decoded.ok);
    assert(decoded.frame.chainId === "c1");
    assert(decoded.frame.linkIdx === 0);
    assert(decoded.frame.produced === 1);
    // Inner artifact preserved
    assert(decoded.frame.artifact.address === artifact.address);
  });

  test("decode: integrity check rejects tampered hash", () => {
    const artifact = ChainComposer.makeGenesisArtifact(TEST_INPUT, { dimensions: TEST_DIMS });
    const framed = Codec.encode({
      chainId: "c1", linkIdx: 0, produced: 1, artifact: artifact
    });
    // Tamper: replace the artifactHash with a different valid-looking one
    const tampered = framed.replace(/"artifactHash":"h[0-9a-f]+"/, '"artifactHash":"h00000000"');
    const decoded = Codec.decode(tampered);
    assert(!decoded.ok);
    assert(decoded.error.indexOf("artifactHash") >= 0);
  });

  test("decode: rejects malformed JSON", () => {
    const r = Codec.decode("{not json");
    assert(!r.ok);
  });

  test("decode: rejects wrong codec version", () => {
    const wrong = '{"v":99,"chainId":"c","linkIdx":0,"produced":1,"artifactHash":"h0","artifact":{}}';
    const r = Codec.decode(wrong);
    assert(!r.ok);
    assert(r.error.indexOf("codec version") >= 0);
  });

  // --------------------------------------------------------------------
  // PART B: transport bindings
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART B: transport bindings");
  console.log("");

  await asyncTest("MemoryTransport: send synchronously delivers", async () => {
    const t = new Transport.MemoryTransport();
    let received = null;
    t.onReceive(b => { received = b; });
    await t.send("hello");
    assert(received === "hello");
    assert(t.observe().sent === 1);
    assert(t.observe().received === 1);
    t.close();
  });

  await asyncTest("LoopbackTransport.pair: send on A delivers to B", async () => {
    const [a, b] = Transport.LoopbackTransport.pair();
    let received = null;
    b.onReceive(bytes => { received = bytes; });
    await a.send("ping");
    assert(received === "ping");
    a.close(); b.close();
  });

  await asyncTest("LoopbackTransport: bidirectional", async () => {
    const [a, b] = Transport.LoopbackTransport.pair();
    let aGot = null, bGot = null;
    a.onReceive(x => { aGot = x; });
    b.onReceive(x => { bGot = x; });
    await a.send("A->B");
    await b.send("B->A");
    assert(bGot === "A->B");
    assert(aGot === "B->A");
    a.close(); b.close();
  });

  test("MemoryTransport: rejects non-string bytes", async () => {
    const t = new Transport.MemoryTransport();
    let rejected = false;
    t.send(42).catch(() => { rejected = true; });
    // Promise-rejection is async; spin-wait briefly via microtask
    return Promise.resolve().then(() => Promise.resolve().then(() => {
      assert(t.observe().errors === 1);
      t.close();
    }));
  });

  await asyncTest("BroadcastChannelTransport: works with mock channel factory", async () => {
    // Mock BroadcastChannel: ALL instances created by mockFactory share
    // a registry; postMessage on one delivers to all others on the same name.
    const registry = new Map();   // channelName -> [channels]
    function mockFactory(name) {
      const subs = registry.get(name) || [];
      const ch = {
        _subs: subs,
        _name: name,
        _handler: null,
        addEventListener(type, h) {
          if (type === "message") this._handler = h;
        },
        postMessage(data) {
          for (const peer of subs) {
            if (peer === this) continue;
            if (peer._handler) peer._handler({ data: data });
          }
        },
        close() {
          const i = subs.indexOf(this);
          if (i >= 0) subs.splice(i, 1);
        }
      };
      subs.push(ch);
      registry.set(name, subs);
      return ch;
    }
    const t1 = new Transport.BroadcastChannelTransport({
      channelName: "chain-test", channelFactory: mockFactory
    });
    const t2 = new Transport.BroadcastChannelTransport({
      channelName: "chain-test", channelFactory: mockFactory
    });
    let received = null;
    t2.onReceive(b => { received = b; });
    await t1.send("hello-broadcast");
    assert(received === "hello-broadcast");
    t1.close(); t2.close();
  });

  // --------------------------------------------------------------------
  // PART C: chain equivalence across transports
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART C: chain equivalence across transports");
  console.log("");

  let directTerminal;

  test("Direct in-process composition produces baseline artifact", () => {
    const chain = ChainComposer.composeChain([LINK_A, LINK_B, LINK_C],
      { dimensions: TEST_DIMS });
    const r = chain.run(TEST_INPUT);
    directTerminal = r.terminal;
    assert(directTerminal);
    assert(directTerminal.rows.length === 5);
    assert(directTerminal.address);
  });

  await asyncTest("Memory transport: terminal artifact byte-identical to direct", async () => {
    const [callerSide, workerSide] = Transport.LoopbackTransport.pair();

    // Worker side: hosts LINK_B
    const worker = Remote.attachRemoteWorker({
      transport: workerSide,
      link: LINK_B,
      chainId: "test-chain",
      linkIdx: 1
    });

    // Caller side: chain has LINK_A (local) + remote-LINK_B + LINK_C (local)
    const remoteB = Remote.makeRemoteLink({
      id: "link-b",
      transport: callerSide,
      chainId: "test-chain",
      linkIdx: 1,
      timeoutMs: 5000
    });

    const runner = Async.makeAsyncRunner([LINK_A, remoteB, LINK_C],
      { dimensions: TEST_DIMS });
    const r = await runner.run(TEST_INPUT);

    worker.detach();
    callerSide.close();
    workerSide.close();

    // Byte equivalence: terminal address matches direct
    assert(r.terminal.address === directTerminal.address,
      "address mismatch: " + r.terminal.address + " vs " + directTerminal.address);
    // And merkleRoot
    assert(r.terminal.merkleRoot === directTerminal.merkleRoot);
    // And canonicalized form
    const a = Codec.canonicalize(r.terminal);
    const b = Codec.canonicalize(directTerminal);
    assert(a === b, "canonical bytes differ");
  });

  await asyncTest("Loopback transport (different produced cadence): same byte result", async () => {
    // Run the chain twice via different transport pair sessions, verify
    // both produce the same terminal as the direct composition. Demonstrates
    // that produced counters and transport timing don't affect the artifact.
    const runs = [];
    for (let trial = 0; trial < 2; trial++) {
      const [c, w] = Transport.LoopbackTransport.pair();
      const worker = Remote.attachRemoteWorker({
        transport: w, link: LINK_B,
        chainId: "trial-" + trial, linkIdx: 1
      });
      const rb = Remote.makeRemoteLink({
        id: "link-b", transport: c,
        chainId: "trial-" + trial, linkIdx: 1, timeoutMs: 5000
      });
      const runner = Async.makeAsyncRunner([LINK_A, rb, LINK_C],
        { dimensions: TEST_DIMS });
      const r = await runner.run(TEST_INPUT);
      runs.push(r.terminal.address);
      worker.detach(); c.close(); w.close();
    }
    assert(runs[0] === runs[1], "trial addresses differ");
    assert(runs[0] === directTerminal.address, "trial != direct");
  });

  await asyncTest("All-remote chain: 2 remote links produce same terminal", async () => {
    const [cA, wA] = Transport.LoopbackTransport.pair();
    const [cB, wB] = Transport.LoopbackTransport.pair();

    const workerA = Remote.attachRemoteWorker({
      transport: wA, link: LINK_A, chainId: "all-remote", linkIdx: 0
    });
    const workerB = Remote.attachRemoteWorker({
      transport: wB, link: LINK_B, chainId: "all-remote", linkIdx: 1
    });

    const remoteA = Remote.makeRemoteLink({
      id: "link-a", transport: cA, chainId: "all-remote", linkIdx: 0, timeoutMs: 5000
    });
    const remoteB = Remote.makeRemoteLink({
      id: "link-b", transport: cB, chainId: "all-remote", linkIdx: 1, timeoutMs: 5000
    });

    const runner = Async.makeAsyncRunner([remoteA, remoteB, LINK_C],
      { dimensions: TEST_DIMS });
    const r = await runner.run(TEST_INPUT);

    assert(r.terminal.address === directTerminal.address,
      "all-remote: " + r.terminal.address + " vs " + directTerminal.address);

    workerA.detach(); workerB.detach();
    cA.close(); wA.close(); cB.close(); wB.close();
  });

  // --------------------------------------------------------------------
  // PART D: error paths
  // --------------------------------------------------------------------
  console.log("");
  console.log("PART D: error paths");
  console.log("");

  await asyncTest("Remote link timeout: rejects after deadline", async () => {
    // Caller, no worker on the other side -> request never replied
    const [c, w] = Transport.LoopbackTransport.pair();
    // Note: we deliberately do NOT attach a worker to w
    const remoteX = Remote.makeRemoteLink({
      id: "x", transport: c, chainId: "timeout-test",
      linkIdx: 0, timeoutMs: 50
    });
    const runner = Async.makeAsyncRunner([remoteX]);
    let threw = false;
    try {
      await runner.run(TEST_INPUT);
    } catch (e) {
      threw = true;
      assert(e.message.indexOf("timeout") >= 0,
        "expected timeout error, got: " + e.message);
    }
    assert(threw, "expected runner to throw on timeout");
    c.close(); w.close();
  });

  await asyncTest("Remote link cap: too many outstanding rejected", async () => {
    const [c, w] = Transport.LoopbackTransport.pair();
    // No worker; requests never resolve
    const r = Remote.makeRemoteLink({
      id: "y", transport: c, chainId: "cap-test",
      linkIdx: 0, timeoutMs: 60000, maxOutstanding: 2
    });
    // Issue 3 applyAsync calls in parallel; 3rd should reject
    const p1 = r.applyAsync({ rows: [], header: {} });
    const p2 = r.applyAsync({ rows: [], header: {} });
    const p3 = r.applyAsync({ rows: [], header: {} });
    p1.catch(() => {}); p2.catch(() => {});
    let p3Rejected = false;
    try { await p3; } catch (e) {
      p3Rejected = true;
      assert(e.message.indexOf("outstanding") >= 0);
    }
    assert(p3Rejected);
    c.close(); w.close();
  });

  test("makeRemoteLink: validates required opts", () => {
    let threw = 0;
    try { Remote.makeRemoteLink(); } catch (e) { threw++; }
    try { Remote.makeRemoteLink({}); } catch (e) { threw++; }
    try { Remote.makeRemoteLink({id: "x"}); } catch (e) { threw++; }
    assert(threw === 3);
  });

  test("makeAsyncRunner: rejects duplicate link ids", () => {
    let threw = false;
    try {
      Async.makeAsyncRunner([
        { id: "a", apply: () => ({contributions: []}) },
        { id: "a", apply: () => ({contributions: []}) }
      ]);
    } catch (e) { threw = true; }
    assert(threw);
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
