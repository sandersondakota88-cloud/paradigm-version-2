// ============================================================================
// run-duel.js -- Puppeteer driver for Phase 6 substrate duels
// ============================================================================
//
// Loads a Phase 6 duel HTML file in headless Chromium, runs the simulation
// to completion at maximum speed, and harvests the full run data.
//
// Usage:
//   node run-duel.js <html-path> [--out=<output-path>] [--label=<label>]
//                                [--max-minutes=<n>]
//
// The driver patches the duel HTML in memory before serving it to expose
// the closure-local `game` (and `meta`, if present) on `window.__game` and
// `window.__meta`. This is required because every duel wraps its script
// in an IIFE; without the patch we can't observe game state from Puppeteer.
//
// Discipline: this driver runs the duel exactly as the browser does. Real
// cascade resolution. Real substrate dynamics. The injection adds two
// window-assignment lines at the end of the IIFE; it does not modify any
// substrate mechanism.
// ============================================================================

"use strict";

const path = require("path");
const fs = require("fs");
const os = require("os");
const puppeteer = require("puppeteer");

// ---- CLI parsing ----------------------------------------------------------

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: node run-duel.js <html-path> [--out=<output-path>] [--label=<label>] [--max-minutes=<n>]");
  process.exit(1);
}

const htmlPath = path.resolve(args[0]);
if (!fs.existsSync(htmlPath)) {
  console.error("[run-duel] file not found: " + htmlPath);
  process.exit(1);
}

let outPath = null;
let label = path.basename(htmlPath, ".html").replace(/\s+/g, "-");
let maxMinutes = 20;
for (const a of args.slice(1)) {
  if (a.startsWith("--out=")) outPath = path.resolve(a.slice(6));
  else if (a.startsWith("--label=")) label = a.slice(8);
  else if (a.startsWith("--max-minutes=")) maxMinutes = parseInt(a.slice(14), 10);
}
if (!outPath) outPath = path.join(__dirname, "runs", label + ".run.txt");

const runsDir = path.dirname(outPath);
if (!fs.existsSync(runsDir)) fs.mkdirSync(runsDir, { recursive: true });

// ---- Patch the HTML: expose game/meta on window before IIFE closes -------

console.log("[run-duel] target  : " + htmlPath);
console.log("[run-duel] label   : " + label);
console.log("[run-duel] out     : " + outPath);
console.log("[run-duel] max-min : " + maxMinutes);

const rawHtml = fs.readFileSync(htmlPath, "utf8");

// Find the IIFE close. The duels end with `})();` immediately before
// `</script>`. Inject our window assignments just before `})();`.
const iifeCloseMatch = rawHtml.match(/(\}\)\(\);)(\s*<\/script>)/);
if (!iifeCloseMatch) {
  console.error("[run-duel] could not find IIFE close `})();</script>` in the source.");
  console.error("[run-duel] the patch step assumes the duel uses an IIFE; this file doesn't match.");
  process.exit(1);
}

const injection = `
// === Puppeteer instrumentation: expose closure-local references on window ===
try {
  if (typeof game !== 'undefined') window.__game = game;
  if (typeof meta !== 'undefined') window.__meta = meta;
  window.__pup_ready = true;
} catch (e) { window.__pup_inject_error = String(e); }
// ===========================================================================
`;

const patchedHtml = rawHtml.replace(
  /(\}\)\(\);)(\s*<\/script>)/,
  injection + "$1$2"
);

// Write patched HTML to a temp file under the same directory (so relative
// paths in the HTML still resolve)
const patchedDir = path.dirname(htmlPath);
const patchedName = "__pup_" + path.basename(htmlPath);
const patchedPath = path.join(patchedDir, patchedName);
fs.writeFileSync(patchedPath, patchedHtml, "utf8");
console.log("[run-duel] patched HTML written to: " + patchedName);

const cleanup = () => {
  try { if (fs.existsSync(patchedPath)) fs.unlinkSync(patchedPath); } catch {}
};
process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(130); });

const fileUrl = "file:///" + patchedPath.replace(/\\/g, "/");
console.log("[run-duel] url     : " + fileUrl);

// ---- Main ----------------------------------------------------------------

(async () => {
  const t0 = Date.now();

  // Use a dedicated user-data-dir under tmp so cleanup doesn't conflict
  // with other Chromium instances
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pup-duel-"));

  const browser = await puppeteer.launch({
    headless: true,
    userDataDir,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage"
    ]
  });
  try {
    const page = await browser.newPage();

    const consoleMessages = [];
    page.on("console", msg => consoleMessages.push("[console:" + msg.type() + "] " + msg.text()));
    page.on("pageerror", err => consoleMessages.push("[pageerror] " + err.message));

    console.log("[run-duel] navigating...");
    await page.goto(fileUrl, { waitUntil: "load", timeout: 60000 });

    // Wait for the instrumentation flag
    await page.waitForFunction(() => window.__pup_ready === true, { timeout: 10000 });
    console.log("[run-duel] game object exposed; starting simulation...");

    const simStart = Date.now();

    // Set speed=0 and kick off runFull
    await page.evaluate(() => {
      const g = window.__game;
      if (g && "speed" in g) g.speed = 0;
      // Prefer calling runFull directly; fall back to button click
      if (g && typeof g.runFull === "function") {
        // Don't await — let it run; we poll for completion
        g.runFull();
      } else {
        const btn = document.getElementById("btn-run") || document.getElementById("run-btn");
        if (btn) btn.click();
      }
    });

    // Poll for completion
    const COMPLETION_TIMEOUT_MS = maxMinutes * 60 * 1000;
    const POLL_MS = 1000;
    const REPORT_INTERVAL_MS = 3000;
    let elapsed = 0;
    let lastReport = -REPORT_INTERVAL_MS;
    let lastSteps = 0;
    while (elapsed < COMPLETION_TIMEOUT_MS) {
      const status = await page.evaluate(() => {
        const g = window.__game;
        const statusEl = document.getElementById("status");
        return {
          statusText: statusEl ? (statusEl.textContent || "").trim() : null,
          gameOver: g ? !!g.gameOver : null,
          running: g ? !!g.running : null,
          totalSteps: g && typeof g.totalSteps === "number" ? g.totalSteps : null,
          round: g && typeof g.round === "number" ? g.round : null,
          scoreA: g && typeof g.scoreA === "number" ? g.scoreA : null,
          scoreB: g && typeof g.scoreB === "number" ? g.scoreB : null,
          reportCount: g && Array.isArray(g.reports) ? g.reports.length : null
        };
      });

      if (elapsed - lastReport >= REPORT_INTERVAL_MS) {
        lastReport = elapsed;
        const rate = (status.totalSteps && lastSteps !== null)
          ? ((status.totalSteps - lastSteps) / (REPORT_INTERVAL_MS / 1000)).toFixed(1) + "/s"
          : "?";
        console.log("[run-duel]   t=" + (elapsed/1000).toFixed(0) + "s " +
          "status=" + (status.statusText || "?") +
          " round=" + (status.round != null ? status.round : "?") +
          "/" + (status.reportCount != null ? status.reportCount : "?") +
          " steps=" + (status.totalSteps != null ? status.totalSteps : "?") +
          " rate=" + rate +
          " A:B=" + (status.scoreA || 0) + ":" + (status.scoreB || 0));
        lastSteps = status.totalSteps;
      }

      const done = (status.gameOver === true && status.running === false) ||
                   (status.statusText && /complete/i.test(status.statusText));
      if (done) {
        console.log("[run-duel] simulation complete in " + ((Date.now() - simStart) / 1000).toFixed(1) + "s");
        break;
      }
      await new Promise(r => setTimeout(r, POLL_MS));
      elapsed += POLL_MS;
    }
    if (elapsed >= COMPLETION_TIMEOUT_MS) {
      console.log("[run-duel] WARNING: completion timeout reached (" + maxMinutes + " min); harvesting partial state");
    }

    // Harvest: try copyRunData first, fall back to DOM scrape
    console.log("[run-duel] harvesting run data...");
    const payload = await page.evaluate(() => {
      const g = window.__game;
      const lines = [];

      // Header
      const titleEl = document.querySelector("h1");
      if (titleEl) lines.push("# " + titleEl.textContent.trim());
      lines.push("");
      lines.push("Generated: " + new Date().toISOString());
      if (g) {
        if (typeof g.scoreA === "number") lines.push("Score: A=" + g.scoreA + " · B=" + g.scoreB);
        if (typeof g.totalSteps === "number") lines.push("Total turns: " + g.totalSteps);
      }
      lines.push("");

      // Per-round reports
      if (g && Array.isArray(g.reports) && g.reports.length > 0) {
        lines.push("## Round metrics");
        const sample = g.reports[0];
        const cols = Object.keys(sample);
        lines.push(cols.join("\t"));
        for (const r of g.reports) {
          const row = cols.map(c => {
            let v = r[c];
            if (c === "winner") v = (v === "a" ? "A" : (v === "b" ? "B" : v));
            return v == null ? "" : v;
          });
          lines.push(row.join("\t"));
        }
        lines.push("");
      }

      // Substrate end-state
      if (g) {
        const lats = [];
        if (g.latticeA) lats.push(["Player A", g.latticeA]);
        if (g.latticeB) lats.push(["Player B", g.latticeB]);
        if (lats.length > 0) {
          lines.push("## Substrate end-state");
          for (const [labelStr, lat] of lats) {
            lines.push("### " + labelStr);
            for (const s of ["pres", "threat", "dbecon", "exploit"]) {
              if (lat[s] && lat[s].field) {
                const F = lat[s].field;
                lines.push(s + ": cons=" + (F.constraints ? F.constraints.length : "?") +
                  " rat=" + (F.ratified != null ? F.ratified : "?") +
                  " sub=" + (F.subcascades ? F.subcascades.length : "?") +
                  " delta=" + (F.vectorDelta ? F.vectorDelta.scalar.toFixed(3) : "?") +
                  " lastOut=" + (F.lastOutput || "?"));
              }
            }
          }
          // Meta if present
          const metaObj = window.__meta;
          if (metaObj && metaObj.field) {
            const F = metaObj.field;
            lines.push("### Meta");
            lines.push("meta: cons=" + (F.constraints ? F.constraints.length : "?") +
              " rat=" + (F.ratified != null ? F.ratified : "?") +
              " sub=" + (F.subcascades ? F.subcascades.length : "?") +
              " delta=" + (F.vectorDelta ? F.vectorDelta.scalar.toFixed(3) : "?") +
              " lastOut=" + (F.lastOutput || "?"));
          }
          lines.push("");
        }
      }

      // Combat log
      const logEl = document.getElementById("log");
      if (logEl) {
        lines.push("## Combat log");
        lines.push("");
        for (const child of logEl.children) {
          lines.push((child.textContent || "").trim());
        }
      }
      return lines.join("\n");
    });

    fs.writeFileSync(outPath, payload, "utf8");
    console.log("[run-duel] wrote " + outPath + " (" + (payload.length / 1024).toFixed(1) + " KB)");

    if (consoleMessages.length > 0) {
      const sidecarPath = outPath.replace(/\.txt$/, "") + ".console.log";
      fs.writeFileSync(sidecarPath, consoleMessages.join("\n"), "utf8");
      console.log("[run-duel] wrote console sidecar: " + sidecarPath);
    }

    const total = (Date.now() - t0) / 1000;
    console.log("[run-duel] done in " + total.toFixed(1) + "s");
  } finally {
    try { await browser.close(); } catch {}
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }
})().catch(err => {
  console.error("[run-duel] FATAL: " + err.message);
  console.error(err.stack);
  cleanup();
  process.exit(1);
});
