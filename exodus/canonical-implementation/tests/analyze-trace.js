// analyze-trace.js - Parse a DevTools Performance trace and summarize what
// it tells us about the canon-shape stratified harness in flight.
//
// Usage: node tests/analyze-trace.js Trace-20260521T191641.json

"use strict";

const fs = require("fs");
const path = require("path");

const file = process.argv[2] || "Trace-20260521T191641.json";
const raw = fs.readFileSync(path.resolve(__dirname, file), "utf8");
const trace = JSON.parse(raw);

const events = trace.traceEvents;
const meta = trace.metadata || {};
const breadcrumb = meta.modifications && meta.modifications.initialBreadcrumb;

console.log("=== TRACE OVERVIEW ===");
console.log("source:", meta.source);
console.log("startTime:", meta.startTime);
console.log("hostDPR:", meta.hostDPR);
console.log("total events:", events.length.toLocaleString());

if (breadcrumb && breadcrumb.window) {
  const w = breadcrumb.window;
  console.log("breadcrumb window:", w.min, "->", w.max, "(" +
    (w.range/1000).toFixed(1) + " ms,", (w.range/1000/1000).toFixed(2) + "s)");
}
console.log("");

// ---- Categorize events ----
const cats = Object.create(null);
const names = Object.create(null);
for (const e of events) {
  if (!e.cat) continue;
  for (const c of e.cat.split(",")) {
    cats[c] = (cats[c] || 0) + 1;
  }
  if (e.name) names[e.name] = (names[e.name] || 0) + 1;
}

console.log("=== EVENT CATEGORIES (top 15 by count) ===");
const catList = Object.entries(cats).sort((a,b) => b[1]-a[1]).slice(0, 15);
for (const [cat, n] of catList) console.log("  " + n.toString().padStart(8) + "  " + cat);
console.log("");

console.log("=== EVENT NAMES (top 25 by count) ===");
const nameList = Object.entries(names).sort((a,b) => b[1]-a[1]).slice(0, 25);
for (const [name, n] of nameList) console.log("  " + n.toString().padStart(8) + "  " + name);
console.log("");

// ---- Identify the renderer process and main thread ----
const procs = Object.create(null);
const threads = Object.create(null);
for (const e of events) {
  if (e.cat === "__metadata" && e.name === "thread_name") {
    threads[e.pid + ":" + e.tid] = e.args && e.args.name;
  }
  if (e.cat === "__metadata" && e.name === "process_name") {
    procs[e.pid] = e.args && e.args.name;
  }
}

let rendererPid = null;
let mainTid = null;
let gpuPid = null;
let gpuTid = null;
for (const key of Object.keys(threads)) {
  const [pid, tid] = key.split(":");
  if (threads[key] === "CrRendererMain") { rendererPid = +pid; mainTid = +tid; }
  if (threads[key] === "CrGpuMain") { gpuPid = +pid; gpuTid = +tid; }
}
console.log("renderer process:", rendererPid, "main thread:", mainTid);
console.log("gpu process:", gpuPid, "gpu main thread:", gpuTid);
console.log("");

// ---- Window-filter events to the breadcrumb window if present ----
let winMin = -Infinity, winMax = Infinity;
if (breadcrumb && breadcrumb.window) {
  winMin = breadcrumb.window.min;
  winMax = breadcrumb.window.max;
}

function inWindow(e) {
  if (typeof e.ts !== "number") return false;
  return e.ts >= winMin && e.ts <= winMax;
}

// ---- Style recalc and layout events on the renderer main thread ----
const eventBuckets = {
  "UpdateLayoutTree": [],   // style recalc
  "Layout": [],
  "Paint": [],
  "RunTask": [],
  "FunctionCall": [],
  "V8.GCScavenger": [],
  "GPUTask": [],
  "WebGPU::Submit": [],
  "GpuCommandBuffer": []
};

const allNamesInWindow = Object.create(null);

for (const e of events) {
  if (!inWindow(e)) continue;
  if (e.pid !== rendererPid) {
    // collect GPU events from gpu process too
    if (e.pid === gpuPid && e.name) {
      allNamesInWindow["gpu:" + e.name] = (allNamesInWindow["gpu:" + e.name] || 0) + 1;
    }
    continue;
  }
  if (e.name) {
    allNamesInWindow[e.name] = (allNamesInWindow[e.name] || 0) + 1;
  }
  if (eventBuckets[e.name] && e.ph === "X" /* complete event */) {
    eventBuckets[e.name].push({ ts: e.ts, dur: e.dur || 0, args: e.args });
  }
}

console.log("=== EVENT NAMES IN BREADCRUMB WINDOW (top 25) ===");
const winNameList = Object.entries(allNamesInWindow).sort((a,b) => b[1]-a[1]).slice(0, 25);
for (const [name, n] of winNameList) console.log("  " + n.toString().padStart(8) + "  " + name);
console.log("");

function summarize(label, arr) {
  if (arr.length === 0) {
    console.log(label.padEnd(30) + " count=0");
    return;
  }
  const durs = arr.map(e => e.dur).sort((a,b) => a-b);
  const sum = durs.reduce((a,b) => a+b, 0);
  const median = durs[Math.floor(durs.length/2)];
  const p95 = durs[Math.floor(durs.length*0.95)];
  console.log(label.padEnd(30) +
    " count=" + arr.length.toString().padStart(5) +
    "  totalMs=" + (sum/1000).toFixed(1).padStart(7) +
    "  medianMs=" + (median/1000).toFixed(2).padStart(5) +
    "  p95Ms=" + (p95/1000).toFixed(2).padStart(5) +
    "  maxMs=" + (durs[durs.length-1]/1000).toFixed(2).padStart(5));
}

console.log("=== RENDERER MAIN-THREAD WORK (within breadcrumb window) ===");
for (const [name, arr] of Object.entries(eventBuckets)) {
  if (arr.length > 0) summarize(name, arr);
}
console.log("");

// ---- Look for fetch/XHR or other I/O ----
const resourceEvents = events.filter(e =>
  inWindow(e) && e.cat && /devtools.timeline|loading/.test(e.cat) &&
  (e.name === "ResourceSendRequest" || e.name === "ResourceReceiveResponse" ||
   e.name === "ResourceFinish")
);
if (resourceEvents.length) {
  console.log("=== RESOURCE LOADS IN WINDOW ===");
  console.log("count:", resourceEvents.length);
  console.log("");
}

// ---- Try to identify cycle boundaries via FunctionCall or RAF ----
// requestAnimationFrame fires happen on the main thread; in the canon-shape
// harness we yield every 4 fixtures via rAF.
const rafFire = events.filter(e =>
  inWindow(e) && e.name === "FireAnimationFrame" && e.pid === rendererPid && e.ph === "X"
);
console.log("=== rAF FIRINGS (cycle yields) ===");
console.log("count:", rafFire.length);
if (rafFire.length > 0) {
  const durs = rafFire.map(e => e.dur || 0);
  console.log("first 10 ts deltas (ms):");
  for (let i = 1; i < Math.min(11, rafFire.length); i++) {
    console.log("  rAF[" + i + "] - rAF[" + (i-1) + "] = " +
      ((rafFire[i].ts - rafFire[i-1].ts)/1000).toFixed(1) + " ms");
  }
}
console.log("");

// ---- Compute the structural finding: are CSS recalc, JS function calls, and
// GPU work interleaved within roughly the same time window? ----
console.log("=== STRATIFICATION CHECK ===");
const recalcs = eventBuckets["UpdateLayoutTree"];
const funcs   = eventBuckets["FunctionCall"];
const gpuTasks = eventBuckets["GPUTask"];

if (recalcs.length > 0 && funcs.length > 0) {
  // For each style recalc, find the nearest FunctionCall in time and report distance.
  // High frequency = interleaved (stratification visible). Low frequency = serial.
  let interleaveCount = 0;
  for (const r of recalcs.slice(0, 50)) {
    const window = 25000; // 25ms
    const nearby = funcs.filter(f => Math.abs(f.ts - r.ts) < window);
    if (nearby.length > 0) interleaveCount++;
  }
  console.log("style recalcs with FunctionCall within 25ms: " +
    interleaveCount + " / " + Math.min(50, recalcs.length));
}

if (gpuTasks.length > 0) {
  console.log("GPUTask events: " + gpuTasks.length);
}

// ---- Sample: time-clustered events for one window of ~30ms ----
console.log("");
console.log("=== ONE CYCLE WINDOW (first 30ms after first style recalc) ===");
if (recalcs.length > 0) {
  const t0 = recalcs[0].ts;
  const t1 = t0 + 30000;
  const slice = events.filter(e =>
    e.pid === rendererPid && typeof e.ts === "number" &&
    e.ts >= t0 && e.ts <= t1 && e.ph === "X" && e.dur && e.dur > 100
  ).sort((a,b) => a.ts - b.ts);
  console.log("events in window (dur > 0.1ms):");
  for (const e of slice.slice(0, 40)) {
    console.log("  +" + ((e.ts - t0)/1000).toFixed(2).padStart(6) + "ms" +
      " dur=" + (e.dur/1000).toFixed(2).padStart(5) + "ms  " + e.name);
  }
}
