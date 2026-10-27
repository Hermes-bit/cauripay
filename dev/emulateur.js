// Émulateur CauriPay : montre l'appli dans un téléphone, y joue les scénarios de dev/scenarios.js en direct
// (un doigt rose montre chaque toucher) et compare chaque série à la précédente : la règle « aucun recul ».
(function () {
"use strict";
const $ = s => document.querySelector(s);
const DEVICES = {
  iphone16promax: { name: "iPhone 16 Pro Max", w: 440, h: 956, sat: 62, sab: 34, r: 56, island: true, home: true },
  iphone15: { name: "iPhone 15", w: 393, h: 852, sat: 59, sab: 34, r: 52, island: true, home: true },
  iphonese: { name: "iPhone SE", w: 375, h: 667, sat: 20, sab: 0, r: 0, flat: true },
  pixel8: { name: "Android · Pixel 8", w: 412, h: 915, sat: 28, sab: 16, r: 44, punch: true, home: true },
  ipadmini: { name: "iPad mini", w: 744, h: 1133, sat: 24, sab: 20, r: 30, home: true }
};
const SPEEDS = { lent: { move: 650, pause: 650, type: 75 }, normal: { move: 260, pause: 230, type: 22 }, rapide: { move: 60, pause: 60, type: 0 }, max: { move: 0, pause: 0, type: 0 } };
const params = new URLSearchParams(location.search);
const settings = load("cpemu_settings", { device: "iphone16promax", speed: "normal", auto: true });
if (DEVICES[params.get("appareil")]) settings.device = params.get("appareil");
if (SPEEDS[params.get("vitesse")]) settings.speed = params.get("vitesse");
const HEADLESS = params.has("auto");
const AUTOSTART = HEADLESS || sessionStorage.getItem("cpemu_autostart") === "1";
sessionStorage.removeItem("cpemu_autostart");
const frame = $("#app"), finger = $("#finger");
let device = DEVICES[settings.device] || DEVICES.iphone16promax, running = false, stopAsked = false, results = null;

function load(k, d) { try { return { ...d, ...JSON.parse(localStorage.getItem(k) || "{}") }; } catch (e) { return d; } }
function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage plein : ignoré */ } }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ---------- le téléphone ---------- */
function layoutDevice() {
  const d = device, df = $("#device-frame"), sc = $("#screen");
  df.style.setProperty("--r", d.r + "px");
  df.className = "device" + (d.island ? "" : " noisland") + (d.home ? "" : " nohome") + (d.punch ? " punch" : "") + (d.flat ? " flat" : "");
  sc.style.width = frame.style.width = d.w + "px";
  sc.style.height = frame.style.height = d.h + "px";
  $("#sbar").style.height = d.sat + "px";
  fit();
}
function fit() {
  const st = $("#stage"), df = $("#device-frame");
  df.style.transform = "none"; df.style.margin = "0";
  const k = Math.min(1, (st.clientWidth - 32) / df.offsetWidth, (st.clientHeight - 64) / df.offsetHeight);
  df.style.transform = `scale(${k})`;
  df.style.margin = `${-(df.offsetHeight * (1 - k)) / 2}px ${-(df.offsetWidth * (1 - k)) / 2}px`;
}
addEventListener("resize", fit);
// marges de sécurité de l'appareil (encoche, barre d'accueil) : l'appli les lit dans --sat / --sab
function applyInsets() {
  try { const r = frame.contentDocument.documentElement; r.style.setProperty("--sat", device.sat + "px"); r.style.setProperty("--sab", device.sab + "px"); } catch (e) { /* page pas encore prête */ }
}
function loadApp(path) {
  path = path || "/?test";
  const [base, hash] = path.split("#");
  const url = base + (base.includes("?") ? "&" : "?") + "emu=" + Date.now() + (hash ? "#" + hash : "");
  return new Promise(res => {
    frame.onload = () => { applyInsets(); res(); };
    frame.src = url;
  });
}

/* ---------- le doigt ---------- */
function pointAt(el) {
  const r = el.getBoundingClientRect(), sp = SPEEDS[settings.speed];
  finger.style.transitionDuration = sp.move + "ms";
  finger.style.left = (r.left + r.width / 2) + "px"; finger.style.top = (r.top + r.height / 2) + "px";
  finger.classList.add("show");
  return sleep(sp.move);
}
const hideFinger = () => finger.classList.remove("show", "press", "hold");

/* ---------- ce que les scénarios peuvent faire ---------- */
function makeApi(rec) {
  const sp = () => SPEEDS[settings.speed];
  const win = () => frame.contentWindow, doc = () => frame.contentDocument;
  const guard = () => { if (stopAsked) throw new Error("Série arrêtée"); };
  const isVisible = e => !!e && e.isConnected && e.getClientRects().length > 0 && win().getComputedStyle(e).visibility !== "hidden";
  async function el(sel, { timeout = 6000, visible = true } = {}) {
    const t0 = performance.now();
    for (;;) {
      guard();
      const list = doc() ? [...doc().querySelectorAll(sel)] : [];
      const e = visible ? list.find(isVisible) : list[0];
      if (e) return e;
      if (performance.now() - t0 > timeout) throw new Error(`introuvable à l'écran : ${sel}`);
      await sleep(40);
    }
  }
  function fire(e, type, extra) {
    const w = win(), r = e.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, composed: true, view: w, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0, ...extra };
    const C = /^pointer/.test(type) ? w.PointerEvent : w.MouseEvent;
    e.dispatchEvent(new C(type, /^pointer/.test(type) ? { pointerType: "touch", isPrimary: true, ...o } : o));
  }
  function setValue(e, v) {
    const w = win(), proto = e.tagName === "TEXTAREA" ? w.HTMLTextAreaElement.prototype : e.tagName === "SELECT" ? w.HTMLSelectElement.prototype : w.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(e, v);
    e.dispatchEvent(new w.Event("input", { bubbles: true }));
  }
  const t = {
    devices: DEVICES,
    get deviceKey() { return settings.device; },
    get win() { return win(); },
    get doc() { return doc(); },
    step(label) { rec.step = label; $("#now-step").textContent = label; progress({ type: "step", scenario: rec.name, label }); },
    clearData() { Object.keys(localStorage).filter(k => k.startsWith("cptest_")).forEach(k => localStorage.removeItem(k)); },
    async open(path, { waitSplash = true } = {}) { guard(); hideFinger(); await loadApp(path); if (waitSplash) await t.waitSplash(); },
    async waitSplash() {
      if (settings.speed === "max") { const s = doc().getElementById("splash"); if (s) fire(s, "pointerdown"); }   // vitesse maximale : on passe l'ouverture
      await t.until(() => !doc().getElementById("splash"), { timeout: 8000, label: "fin de l'animation d'ouverture" });
    },
    el, isVisible: sel => isVisible(doc().querySelector(sel)),
    exists: sel => !!doc() && [...doc().querySelectorAll(sel)].some(isVisible),
    count: sel => doc().querySelectorAll(sel).length,
    attr: (sel, a) => { const e = doc().querySelector(sel); return e ? e.getAttribute(a) : null; },
    textNow: sel => { const e = doc().querySelector(sel); return e ? norm(e.textContent) : ""; },
    texts: sel => [...doc().querySelectorAll(sel)].map(e => norm(e.textContent)),
    async text(sel) { return norm((await el(sel)).textContent); },
    toast: () => norm((doc().getElementById("toastSlot") || {}).textContent),
    state() { const k = Object.keys(localStorage).find(x => x.startsWith("cptest_v3_")); return k ? JSON.parse(localStorage.getItem(k)) : { profile: null, tx: {}, pots: {}, wishes: {}, transfers: {}, contacts: {}, cards: {}, wallet: {} }; },
    wait: ms => { guard(); return sleep(ms); },
    async until(fn, { timeout = 6000, label = "condition" } = {}) {
      const t0 = performance.now();
      for (;;) { guard(); let v = false; try { v = fn(); } catch (e) { v = false; } if (v) return v; if (performance.now() - t0 > timeout) throw new Error(`délai dépassé : ${label}`); await sleep(40); }
    },
    async tap(sel) {
      const e = await el(sel);
      e.scrollIntoView({ block: "center", inline: "nearest" }); await sleep(20);
      await pointAt(e); finger.classList.add("press");
      fire(e, "pointerdown"); fire(e, "pointerup");
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName)) e.focus();
      if (e.tagName === "INPUT" && /^(checkbox|radio)$/.test(e.type)) e.click(); else fire(e, "click", { detail: 1 });
      await sleep(Math.max(70, sp().pause)); finger.classList.remove("press");
    },
    async hold(sel, ms = 1150) {
      const e = await el(sel);
      e.scrollIntoView({ block: "center" }); await sleep(20);
      await pointAt(e); finger.classList.add("hold");
      fire(e, "pointerdown"); await sleep(ms); fire(e, "pointerup");
      finger.classList.remove("hold"); await sleep(Math.max(80, sp().pause));
    },
    async type(sel, text) {
      const e = await el(sel);
      e.scrollIntoView({ block: "center" }); await pointAt(e); e.focus();
      setValue(e, "");
      const d = sp().type;
      if (d) { let v = ""; for (const ch of String(text)) { guard(); v += ch; setValue(e, v); await sleep(d); } } else setValue(e, String(text));
      e.dispatchEvent(new (win().Event)("change", { bubbles: true }));
      await sleep(Math.max(40, sp().pause));
    },
    async select(sel, value) {
      const e = await el(sel);
      e.scrollIntoView({ block: "center" }); await pointAt(e);
      setValue(e, value); e.dispatchEvent(new (win().Event)("change", { bubbles: true }));
      await sleep(Math.max(60, sp().pause));
    },
    key(k) { return t.tap(`[data-key="${k}"]`); },
    escape() { doc().dispatchEvent(new (win().KeyboardEvent)("keydown", { key: "Escape", bubbles: true })); return sleep(260); },
    async setDevice(key) { settings.device = key; device = DEVICES[key]; $("#device").value = key; layoutDevice(); await t.open(); },
    check(ok, label, detail) {
      const c = { label, ok: !!ok, detail: ok ? "" : (detail || "") };
      rec.checks.push(c); renderScenario(rec); renderSummary();
      progress({ type: "check", scenario: rec.name, label, ok: !!ok, detail: c.detail });
      return !!ok;
    }
  };
  return t;
}

/* ---------- une série de tests ---------- */
function progress(evt) { try { if (window.__cpProgress) window.__cpProgress(evt); } catch (e) { /* CLI absente */ } }
async function runAll(reason) {
  if (running) { stopAsked = true; while (running) await sleep(50); }
  running = true; stopAsked = false;
  const list = window.CP_SCENARIOS || [];
  results = { at: new Date().toISOString(), reason: reason || "manuel", device: settings.device, speed: settings.speed, scenarios: list.map(s => ({ name: s.name, checks: [], error: null, ms: 0, state: "wait" })) };
  renderList(); setRunning(true);
  const t0 = performance.now();
  log(`Série lancée (${esc(reason || "manuel")}) · ${esc(device.name)} · vitesse ${esc(settings.speed)}`);
  for (let i = 0; i < list.length && !stopAsked; i++) {
    const rec = results.scenarios[i]; rec.state = "run"; renderScenario(rec); renderSummary();
    progress({ type: "scenario", name: rec.name });
    const s0 = performance.now();
    try { await list[i].run(makeApi(rec)); }
    catch (e) { rec.error = e.message || String(e); if (!stopAsked) rec.checks.push({ label: "Le scénario va jusqu'au bout", ok: false, detail: rec.error }); progress({ type: "check", scenario: rec.name, label: "Le scénario va jusqu'au bout", ok: false, detail: rec.error }); }
    rec.ms = Math.round(performance.now() - s0);
    rec.state = rec.checks.some(c => !c.ok) ? "ko" : "ok";
    renderScenario(rec); renderSummary(); hideFinger();
  }
  results.ms = Math.round(performance.now() - t0);
  const stopped = stopAsked;
  running = false; stopAsked = false; setRunning(false);
  if (stopped) { log("Série arrêtée."); renderSummary(); return; }
  finish();
}
function totals() {
  const all = results ? results.scenarios.flatMap(s => s.checks.map(c => ({ ...c, key: s.name + " › " + c.label }))) : [];
  return { all, ok: all.filter(c => c.ok).length, failed: all.filter(c => !c.ok).length };
}
function finish() {
  const { all, ok, failed } = totals();
  const hist = loadHist(), prev = hist[0];
  // aucun recul : ce qui marchait à la série précédente doit encore marcher
  const regressions = prev ? all.filter(c => !c.ok && prev.labels[c.key] === true).map(c => c.key) : [];
  const added = prev ? all.filter(c => !(c.key in prev.labels)).length : 0;
  Object.assign(results, { total: all.length, ok, failed, regressions, added, done: true });
  hist.unshift({ at: results.at, total: all.length, ok, failed, ms: results.ms, device: results.device, labels: Object.fromEntries(all.map(c => [c.key, c.ok])) });
  store("cpemu_hist", hist.slice(0, 20));
  renderSummary(); renderHistory();
  log(failed ? `<b>${failed} échec(s)</b> sur ${all.length} vérifications.` : `<b>Tout est bon</b> : ${all.length} vérifications réussies.`);
  window.__rapport = results;
  fetch("/__rapport", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(results) }).catch(() => {});
  progress({ type: "done", results });
}
function loadHist() { try { return JSON.parse(localStorage.getItem("cpemu_hist") || "[]"); } catch (e) { return []; } }

/* ---------- affichage ---------- */
function setRunning(on) {
  $("#run").textContent = on ? "Arrêter" : "Lancer les tests";
  $("#run").classList.toggle("pri", !on);
  $("#hint").textContent = on ? "Le doigt rose montre ce que fait le test." : "Tu peux aussi utiliser l'appli toi-même dans le téléphone.";
  if (!on) $("#now-step").textContent = "—";
}
function renderList() {
  $("#scenarios").innerHTML = results.scenarios.map((s, i) => `<li class="sc" id="sc-${i}"></li>`).join("");
  results.scenarios.forEach(renderScenario); renderSummary();
}
function renderScenario(rec) {
  const i = results.scenarios.indexOf(rec), li = $("#sc-" + i); if (!li) return;
  const ok = rec.checks.filter(c => c.ok).length, wasOpen = li.classList.contains("open");
  li.className = "sc " + rec.state + (wasOpen || rec.state === "run" || rec.state === "ko" ? " open" : "");
  li.innerHTML = `<button type="button"><span class="st">${rec.state === "ok" ? "✓" : rec.state === "ko" ? "✗" : ""}</span><span class="nm">${esc(rec.name)}</span><span class="ct">${rec.checks.length ? `${ok}/${rec.checks.length}` : ""}${rec.ms ? ` · ${(rec.ms / 1000).toFixed(1)} s` : ""}</span></button>
    <ul>${rec.checks.map(c => `<li class="${c.ok ? "ok" : "ko"}">${esc(c.label)}${c.detail ? `<span class="why">${esc(c.detail)}</span>` : ""}</li>`).join("")}</ul>`;
  li.querySelector("button").onclick = () => li.classList.toggle("open");
}
function renderSummary() {
  const box = $("#summary");
  if (!results) { box.className = "summary"; return; }
  const { all, ok, failed } = totals(), done = results.scenarios.filter(s => s.state === "ok" || s.state === "ko").length;
  const live = running && !results.done;
  if (!running && !results.done && results.scenarios.every(s => s.state === "wait")) {
    box.className = "summary"; $("#sum-title").textContent = "Prêt"; $("#sum-time").textContent = "";
    $("#sum-reg").className = "sum-reg"; $("#sum-reg").textContent = `${results.scenarios.length} scénarios prêts. Lance les tests pour vérifier toute l'appli.`;
    return;
  }
  box.className = "summary " + (live ? "run" : failed ? "ko" : "ok");
  $("#sum-title").textContent = live ? "Tests en cours…" : failed ? `${failed} échec${failed > 1 ? "s" : ""}` : results.done ? "Tout est bon" : "Série arrêtée";
  $("#sum-time").textContent = results.ms ? `${(results.ms / 1000).toFixed(1)} s · ${new Date(results.at).toLocaleTimeString("fr-FR")}` : "";
  $("#sum-bar").style.width = (results.scenarios.length ? done / results.scenarios.length * 100 : 0) + "%";
  $("#sum-ok").textContent = `${ok} réussie${ok > 1 ? "s" : ""}`;
  $("#sum-ko").textContent = `${failed} échec${failed > 1 ? "s" : ""}`;
  $("#sum-total").textContent = `${all.length} vérification${all.length > 1 ? "s" : ""}`;
  const reg = $("#sum-reg");
  if (!results.done) { reg.className = "sum-reg"; reg.textContent = live ? `Scénario ${Math.min(done + 1, results.scenarios.length)} sur ${results.scenarios.length}` : "Série arrêtée avant la fin."; return; }
  if (results.regressions.length) { reg.className = "sum-reg bad"; reg.textContent = `${results.regressions.length} recul${results.regressions.length > 1 ? "s" : ""} : ce qui marchait avant ne marche plus (${results.regressions.slice(0, 3).join(" · ")}${results.regressions.length > 3 ? "…" : ""})`; }
  else { reg.className = "sum-reg good"; reg.textContent = loadHist().length > 1 ? `Aucun recul par rapport à la série précédente${results.added ? ` · ${results.added} nouvelle${results.added > 1 ? "s" : ""} vérification${results.added > 1 ? "s" : ""}` : ""}.` : "Première série : elle sert de référence pour les suivantes."; }
}
function renderHistory() {
  $("#history").innerHTML = loadHist().map(h => `<li class="${h.failed ? "ko" : "ok"}"><b>${h.ok}/${h.total}</b> · ${new Date(h.at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · ${esc((DEVICES[h.device] || {}).name || h.device)} · ${(h.ms / 1000).toFixed(0)} s</li>`).join("") || "<li>Aucune série pour l'instant.</li>";
}
function log(html) {
  const li = document.createElement("li");
  li.innerHTML = `${new Date().toLocaleTimeString("fr-FR")} · ${html}`;
  $("#journal").prepend(li);
  while ($("#journal").children.length > 60) $("#journal").lastChild.remove();
}

/* ---------- en direct : rechargement et tests à chaque modification ---------- */
function connectLive() {
  if (!window.EventSource) return;
  const es = new EventSource("/__live"), box = $("#live");
  es.onopen = () => { box.classList.add("on"); box.querySelector("span").textContent = "En direct"; };
  es.onerror = () => { box.classList.remove("on"); box.querySelector("span").textContent = "Serveur arrêté"; };
  es.addEventListener("change", e => {
    const d = JSON.parse(e.data);
    log(`Modifié : <b>${esc(d.files.slice(0, 4).join(", "))}${d.files.length > 4 ? "…" : ""}</b>`);
    if (d.kind === "dev") { sessionStorage.setItem("cpemu_autostart", settings.auto ? "1" : "0"); location.reload(); return; }
    if (settings.auto) runAll("modification de l'appli"); else if (!running) loadApp().then(() => log("Appli rechargée."));
  });
}

/* ---------- démarrage ---------- */
$("#device").innerHTML = Object.entries(DEVICES).map(([k, d]) => `<option value="${k}">${esc(d.name)} · ${d.w}×${d.h}</option>`).join("");
$("#device").value = settings.device; $("#speed").value = settings.speed; $("#auto").checked = settings.auto;
$("#device").onchange = e => { settings.device = e.target.value; device = DEVICES[settings.device]; store("cpemu_settings", settings); layoutDevice(); if (!running) loadApp(); };
$("#speed").onchange = e => { settings.speed = e.target.value; store("cpemu_settings", settings); };
$("#auto").onchange = e => { settings.auto = e.target.checked; store("cpemu_settings", settings); };
$("#run").onclick = () => { if (running) stopAsked = true; else runAll("manuel"); };
$("#reload").onclick = () => { if (!running) loadApp().then(() => log("Appli rechargée.")); };
layoutDevice(); renderHistory();
results = { scenarios: (window.CP_SCENARIOS || []).map(s => ({ name: s.name, checks: [], error: null, ms: 0, state: "wait" })) };
renderList();
if (!HEADLESS) connectLive();
if (AUTOSTART) setTimeout(() => runAll(HEADLESS ? "ligne de commande" : "modification des tests"), 300);
else loadApp().then(() => log("Appli chargée en mode test : tes vraies données ne sont pas touchées."));
})();
