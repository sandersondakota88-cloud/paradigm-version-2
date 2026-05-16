// ============================================================================
// serve.js  --  minimal static file server for the Phase B GPU harness.
// Zero deps, Node stdlib only. Serves the parent directory (canonical-
// implementation/) so resolve.wgsl and tests/gpu-equivalence.html both load.
// ============================================================================
//
// Run:    node tests/serve.js
// Then:   open http://localhost:8080/tests/gpu-equivalence.html
//
// Stop with Ctrl+C.
// ============================================================================

"use strict";

const http = require("http");
const fs   = require("fs");
const path = require("path");

const PORT = 8080;
const ROOT = path.resolve(__dirname, "..");

const MIME = {
  ".html":  "text/html; charset=utf-8",
  ".js":    "text/javascript; charset=utf-8",
  ".mjs":   "text/javascript; charset=utf-8",
  ".json":  "application/json; charset=utf-8",
  ".wgsl":  "text/plain; charset=utf-8",
  ".md":    "text/markdown; charset=utf-8",
  ".css":   "text/css; charset=utf-8",
  ".txt":   "text/plain; charset=utf-8",
  ".svg":   "image/svg+xml",
  ".png":   "image/png",
  ".ico":   "image/x-icon"
};

function safeJoin(root, urlPath) {
  // Resolve, then verify the result is still under root (no `../` escapes).
  const decoded = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  const joined = path.normalize(path.join(root, decoded));
  if (!joined.startsWith(root)) return null;
  return joined;
}

const server = http.createServer((req, res) => {
  const urlPath = req.url === "/" ? "/index.html" : req.url;
  const filePath = safeJoin(ROOT, urlPath);
  if (!filePath) {
    res.writeHead(403); res.end("forbidden"); return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 not found: " + urlPath);
      console.log("  404  " + urlPath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": mime,
      "Content-Length": stat.size,
      // dev-friendly: no caching while we iterate
      "Cache-Control": "no-store"
    });
    fs.createReadStream(filePath).pipe(res);
    console.log("  200  " + urlPath + "  (" + mime + ", " + stat.size + " B)");
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("[serve] root:  " + ROOT);
  console.log("[serve] port:  " + PORT);
  console.log("[serve] open:  http://localhost:" + PORT + "/tests/gpu-equivalence.html");
  console.log("[serve] (Ctrl+C to stop)");
});
