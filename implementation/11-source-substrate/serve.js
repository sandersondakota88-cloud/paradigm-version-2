// serve.js -- tiny static file server for local browser testing of source-nav.html.
// Serves from implementation/ root so ../kernel/* paths resolve, and from
// project root so ../../exodus/* paths resolve.
// Default port 8080.

"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

// Serve from PROJECT ROOT so both ../kernel/* (under implementation/) and
// ../../exodus/* relative resolves work transparently. URL paths are
// project-root-relative.
const ROOT = path.resolve(__dirname, "..", "..");
const PORT = Number(process.env.PORT) || 8080;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wgsl": "text/plain; charset=utf-8",
  ".md":   "text/plain; charset=utf-8",
  ".tsv":  "text/plain; charset=utf-8",
  ".txt":  "text/plain; charset=utf-8"
};

http.createServer(function (req, res) {
  const u = url.parse(req.url);
  let p = decodeURIComponent(u.pathname || "/");
  // Redirect bare "/" to the source-nav.html under its actual directory
  // so relative <script src="..."> paths resolve correctly in the browser.
  if (p === "/") {
    res.writeHead(302, { "Location": "/implementation/11-source-substrate/source-nav.html" });
    res.end();
    return;
  }
  const full = path.normalize(path.join(ROOT, p));
  if (full.indexOf(ROOT) !== 0) {
    res.writeHead(403); res.end("forbidden"); return;
  }
  fs.stat(full, function (err, st) {
    if (err) { res.writeHead(404); res.end("not found: " + p); return; }
    if (st.isDirectory()) { res.writeHead(404); res.end("dir not served"); return; }
    const ext = path.extname(full).toLowerCase();
    const ct = MIME[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": ct });
    fs.createReadStream(full).pipe(res);
  });
}).listen(PORT, function () {
  console.log("source-nav serving on http://localhost:" + PORT + "/");
  console.log("  default route: /implementation/11-source-substrate/source-nav.html");
  console.log("  serving from project root: " + ROOT);
});
