// Serveur de développement CauriPay.
// Il sert l'appli, prévient l'émulateur à chaque fichier modifié (rechargement et tests en direct),
// et enregistre le résultat de chaque série de tests dans dev/rapports/.
// Lancement : node dev/serveur.js   puis ouvrir http://localhost:5600/dev/
"use strict";
const http = require("http"), fs = require("fs"), path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PORT = +process.env.PORT || 5600;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8"
};
// fichiers dont la modification ne doit pas relancer les tests
const IGNORE = /(^|\/)(\.git|node_modules|screenshot_bug|dev\/rapports)(\/|$)/;
const clients = new Set();

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) c.write(msg);
}

function watch(quiet) {
  let timer = null; const changed = new Set();
  try {
    fs.watch(ROOT, { recursive: true }, (_e, file) => {
      if (!file) return;
      const rel = String(file).replace(/\\/g, "/");
      if (IGNORE.test(rel)) return;
      changed.add(rel); clearTimeout(timer);
      timer = setTimeout(() => {
        const files = [...changed]; changed.clear();
        const kind = files.every(f => f.startsWith("dev/")) ? "dev" : "app";
        broadcast("change", { files, kind, at: Date.now() });
        if (!quiet) console.log("  modifié :", files.join(", "));
      }, 150);
    });
  } catch (e) { if (!quiet) console.warn("  (surveillance des fichiers indisponible :", e.message + ")"); }
}

function saveReport(body, quiet) {
  try {
    const r = JSON.parse(body), dir = path.join(__dirname, "rapports");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "dernier.json"), JSON.stringify(r, null, 2));
    fs.appendFileSync(path.join(dir, "historique.jsonl"), JSON.stringify({ at: r.at, total: r.total, ok: r.ok, failed: r.failed, regressions: (r.regressions || []).length, ms: r.ms }) + "\n");
    if (!quiet) console.log(`  tests : ${r.ok}/${r.total} réussis${r.failed ? ` · ${r.failed} ÉCHEC(S)` : ""}${(r.regressions || []).length ? ` · ${r.regressions.length} RÉGRESSION(S)` : ""} · ${(r.ms / 1000).toFixed(1)} s`);
  } catch (e) { /* rapport illisible : ignoré */ }
}

function start(port = PORT, { quiet = false, live = true } = {}) {
  if (live) watch(quiet);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/__live") {   // canal « en direct » vers l'émulateur
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
      res.write("retry: 1000\n\n"); clients.add(res); req.on("close", () => clients.delete(res)); return;
    }
    if (url.pathname === "/__rapport" && req.method === "POST") {
      let body = ""; req.on("data", c => { body += c; }); req.on("end", () => { saveReport(body, quiet); res.writeHead(204); res.end(); }); return;
    }
    let p = decodeURIComponent(url.pathname); if (p.endsWith("/")) p += "index.html";
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); res.end("Introuvable"); return;
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((ok, ko) => { server.on("error", ko); server.listen(port, () => ok(server)); });
}

module.exports = { start };

if (require.main === module) {
  start().then(() => {
    console.log(`\n  CauriPay · émulateur en direct\n  → http://localhost:${PORT}/dev/\n\n  L'appli seule, en mode test : http://localhost:${PORT}/?test\n  Ctrl+C pour arrêter.\n`);
  }).catch(e => {
    console.error(e.code === "EADDRINUSE" ? `\n  Le port ${PORT} est déjà pris : un émulateur tourne peut-être déjà. Ouvre http://localhost:${PORT}/dev/\n` : e.message);
    process.exit(1);
  });
}
