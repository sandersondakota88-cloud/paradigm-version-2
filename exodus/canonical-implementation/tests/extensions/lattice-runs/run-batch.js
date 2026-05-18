// ============================================================================
// run-batch.js -- Run all Phase 6 autonomous duel variants, multiple
// replicates each, capturing logs and per-round metrics.
// ============================================================================
//
// Spawns run-duel.js as a child process per (variant, replicate). Writes
// each run's log to runs/<variant>-r<n>.run.txt and accumulates a summary
// table to runs/_summary.tsv.
//
// Usage:
//   node run-batch.js [--replicates=<n>] [--max-minutes=<n>]
//
// Default: 5 replicates per variant, 15 minute timeout each.
// ============================================================================

"use strict";

const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const REPLICATES_DEFAULT = 5;
const MAX_MIN_DEFAULT = 15;

let replicates = REPLICATES_DEFAULT;
let maxMinutes = MAX_MIN_DEFAULT;
for (const a of process.argv.slice(2)) {
  if (a.startsWith("--replicates=")) replicates = parseInt(a.slice(13), 10);
  else if (a.startsWith("--max-minutes=")) maxMinutes = parseInt(a.slice(14), 10);
}

const PHASE6 = path.resolve(__dirname, "..", "..", "..", "Phase 6");

// The 7 autonomous variants. Names are clean labels (no spaces).
const variants = [
  { label: "rich-duel",                     file: "rich-duel/rich-duel.html" },
  { label: "rich-duel-crossed",             file: "rich-duel _crossed.html" },
  { label: "rich-duel-melting-pot",         file: "rich-duel-melting-pot.html" },
  { label: "rich-duel-asymettry",           file: "rich-duel_asymettry.html" },
  { label: "rich-duel-swap",                file: "rich-duel_swap.html" },
  { label: "lattice-vs-lattice-v1",         file: "lattice-vs-lattice/lattice-vs-lattice.html" },
  { label: "lattice-vs-lattice-v2",         file: "lattice-vs-lattice 2/lattice-vs-lattice.html" }
];

const runsDir = path.join(__dirname, "runs");
if (!fs.existsSync(runsDir)) fs.mkdirSync(runsDir, { recursive: true });

function runOne(variant, replicate) {
  return new Promise((resolve, reject) => {
    const htmlPath = path.join(PHASE6, variant.file);
    const label = variant.label + "-r" + replicate;
    const outPath = path.join(runsDir, label + ".run.txt");

    console.log("\n[batch] === " + label + " ===");
    console.log("[batch] " + htmlPath);

    const child = spawn("node", [
      path.join(__dirname, "run-duel.js"),
      htmlPath,
      "--out=" + outPath,
      "--label=" + label,
      "--max-minutes=" + maxMinutes
    ], { stdio: "inherit" });

    child.on("error", (err) => reject(err));
    child.on("exit", (code) => {
      if (code === 0) resolve({ label, outPath });
      else {
        console.log("[batch] " + label + " exited with code " + code);
        resolve({ label, outPath, failed: true, exitCode: code });
      }
    });
  });
}

(async () => {
  const allStart = Date.now();
  const summary = [];

  for (const v of variants) {
    for (let r = 1; r <= replicates; r++) {
      const result = await runOne(v, r);
      summary.push({
        variant: v.label,
        replicate: r,
        outPath: result.outPath,
        failed: !!result.failed,
        exitCode: result.exitCode || 0
      });
    }
  }

  // Build a summary by reading each run file's round metrics
  const summaryLines = [];
  summaryLines.push("variant\treplicate\twinner_total\tA_score\tB_score\ttotal_turns\tlocked_at_round\tfinal_A_cons_rat_sub\tfinal_B_cons_rat_sub");

  for (const s of summary) {
    if (!fs.existsSync(s.outPath)) {
      summaryLines.push([s.variant, s.replicate, "MISSING", "", "", "", "", "", ""].join("\t"));
      continue;
    }
    const content = fs.readFileSync(s.outPath, "utf8");

    // Parse score line: "Score: A=X · B=Y"
    const scoreMatch = content.match(/Score:\s*A=(\d+)\s*[·.]\s*B=(\d+)/);
    const turnsMatch = content.match(/Total turns:\s*(\d+)/);
    const scoreA = scoreMatch ? parseInt(scoreMatch[1], 10) : null;
    const scoreB = scoreMatch ? parseInt(scoreMatch[2], 10) : null;
    const totalTurns = turnsMatch ? parseInt(turnsMatch[1], 10) : null;
    const winner = scoreA != null && scoreB != null
      ? (scoreA > scoreB ? "A" : scoreA < scoreB ? "B" : "TIE")
      : "?";

    // Parse round metrics table to detect lock: find the round where
    // a's "cons / rat / sub" stops changing
    const lines = content.split("\n");
    const roundRows = [];
    let inRoundMetrics = false;
    for (const ln of lines) {
      if (ln.startsWith("## Round metrics")) { inRoundMetrics = true; continue; }
      if (inRoundMetrics) {
        if (ln.startsWith("##") || ln.trim() === "") {
          if (roundRows.length > 0) break;
          else continue;
        }
        const parts = ln.split("\t");
        // Skip header row
        if (parts[0] === "round" || isNaN(parseInt(parts[0], 10))) continue;
        roundRows.push(parts);
      }
    }

    // Detect lock: A's column (index 3 in newer format) stops changing
    let lockRound = null;
    if (roundRows.length >= 3) {
      // Find the column with "cons / rat / sub" pattern
      let aCol = -1;
      for (let i = 0; i < roundRows[0].length; i++) {
        if (/\d+\s*\/\s*\d+\s*\/\s*\d+/.test(roundRows[0][i])) { aCol = i; break; }
      }
      if (aCol >= 0) {
        for (let i = 1; i < roundRows.length; i++) {
          if (roundRows[i][aCol] === roundRows[i-1][aCol]) {
            // Check if it stays locked for the rest
            let staysSame = true;
            for (let j = i; j < roundRows.length; j++) {
              if (roundRows[j][aCol] !== roundRows[i-1][aCol]) { staysSame = false; break; }
            }
            if (staysSame) {
              lockRound = parseInt(roundRows[i-1][0], 10);
              break;
            }
          }
        }
      }
    }

    const lastRow = roundRows[roundRows.length - 1] || [];
    const finalA = lastRow[3] || "";
    const finalB = lastRow[4] || "";

    summaryLines.push([
      s.variant,
      s.replicate,
      winner,
      scoreA != null ? scoreA : "",
      scoreB != null ? scoreB : "",
      totalTurns != null ? totalTurns : "",
      lockRound != null ? lockRound : "no-lock",
      finalA,
      finalB
    ].join("\t"));
  }

  const summaryPath = path.join(runsDir, "_summary.tsv");
  fs.writeFileSync(summaryPath, summaryLines.join("\n"), "utf8");
  console.log("\n[batch] wrote summary: " + summaryPath);

  const totalMin = (Date.now() - allStart) / 60000;
  console.log("[batch] total elapsed: " + totalMin.toFixed(1) + " min");
  console.log("[batch] runs: " + summary.length + " (" + summary.filter(s => !s.failed).length + " ok, " + summary.filter(s => s.failed).length + " failed)");
})().catch(err => {
  console.error("[batch] FATAL: " + err.message);
  process.exit(1);
});
