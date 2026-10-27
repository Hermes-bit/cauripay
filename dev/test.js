// Joue tous les tests de CauriPay sans écran (dans Chrome invisible) et affiche le résultat dans le terminal.
// Les mêmes scénarios que l'émulateur (dev/scenarios.js). Code de sortie 1 au moindre échec : la mise en ligne est alors bloquée.
// Lancement : npm test        (une fois « npm install » fait)
"use strict";
const fs = require("fs"), path = require("path");
const { start } = require("./serveur.js");

function findChrome() {
  const list = [process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium-browser", "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
  return list.find(p => p && fs.existsSync(p));
}

(async () => {
  let puppeteer;
  try { puppeteer = require("puppeteer-core"); } catch (e) { console.error("\n  Il manque l'outil de test : lance d'abord « npm install ».\n"); process.exit(2); }
  const chrome = findChrome();
  if (!chrome) { console.error("\n  Chrome ou Edge introuvable. Indique son chemin dans la variable CHROME_PATH.\n"); process.exit(2); }
  const port = +process.env.PORT || 5610;
  const server = await start(port, { quiet: true, live: false });
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000 });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  let current = "";
  await page.exposeFunction("__cpProgress", evt => {
    if (evt.type === "scenario") { current = evt.name; console.log(`\n  ${evt.name}`); }
    if (evt.type === "check") console.log(`    ${evt.ok ? "✓" : "✗"} ${evt.label}${evt.ok || !evt.detail ? "" : `  →  ${evt.detail}`}`);
  });
  const t0 = Date.now();
  console.log(`\n  CauriPay · tests complets (${path.basename(chrome)})`);
  await page.goto(`http://localhost:${port}/dev/?auto&vitesse=${process.env.VITESSE || "rapide"}`);
  let r = null;
  try { await page.waitForFunction(() => window.__rapport && window.__rapport.done, { timeout: 15 * 60 * 1000, polling: 500 }); r = await page.evaluate(() => window.__rapport); }
  catch (e) { console.error(`\n  Les tests n'ont pas pu aller au bout (${current || "démarrage"}) : ${e.message}`); }
  await browser.close(); server.close();
  if (!r) process.exit(1);
  const appErrors = errors.filter(m => !/Série arrêtée/.test(m));
  console.log(`\n  ${r.failed ? "✗" : "✓"} ${r.ok}/${r.total} vérifications réussies en ${((Date.now() - t0) / 1000).toFixed(0)} s${r.failed ? ` · ${r.failed} échec(s)` : ""}`);
  if (appErrors.length) console.log(`  Erreurs JavaScript de l'émulateur : ${appErrors.join(" | ")}`);
  fs.mkdirSync(path.join(__dirname, "rapports"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "rapports", "dernier.json"), JSON.stringify(r, null, 2));
  process.exit(r.failed || appErrors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
