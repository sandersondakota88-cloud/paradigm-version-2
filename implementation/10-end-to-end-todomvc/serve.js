// serve.js -- tiny static file server for local browser testing of todomvc.html.
// Serves from implementation/ root so ../kernel/* and ../08-runtime-kernel/*
// relative paths resolve. Default port 8080.

"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT) || 8080;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wgsl": "text/plain; charset=utf-8",
  ".md":   "text/plain; charset=utf-8"
};

http.createServer(function (req, res) {
  const u = url.parse(req.url);
  let p = decodeURIComponent(u.pathname || "/");
  if (p === "/") p = "/10-end-to-end-todomvc/todomvc.html";
  const full = path.normalize(path.join(ROOT, p));
  if (full.indexOf(ROOT) !== 0) {
    res.writeHead(403); res.end("forbidden"); return;
  }
  fs.stat(full, function (err, st) {
    if (err || !st.isFile()) {
      res.writeHead(404); res.end("not found: " + p); return;
    }
    const ext = path.extname(full).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    fs.createReadStream(full).pipe(res);
  });
}).listen(PORT, "127.0.0.1", function () {
  console.log("serving " + ROOT + " at http://127.0.0.1:" + PORT + "/");
  console.log("todomvc: http://127.0.0.1:" + PORT + "/10-end-to-end-todomvc/todomvc.html");
});
