// Scénarios de test de CauriPay : ils sont joués dans l'émulateur (dev/) et par « npm test ».
// Règle : un libellé de vérification ne change pas d'une série à l'autre (c'est lui qui permet de repérer un recul).
// Les détails variables (montants lus, éléments en trop) vont dans le 3e argument de t.check.
(function () {
"use strict";
const EMAIL = "test@cauripay.dev", PW = "Cauri-Pay-2026!";
const values = o => Object.values(o || {});
const pot = (t, name) => values(t.state().pots).find(p => p.name === name);
const wallet = t => Math.round(values(t.state().wallet).reduce((a, m) => a + (+m.amt || 0), 0) * 100) / 100;
const card = t => values(t.state().cards).find(k => k.status !== "closed");
async function payDone(t) { await t.until(() => { const z = t.doc.getElementById("payZone"); return z && /^(ok|err)$/.test(z.dataset.state); }, { timeout: 8000, label: "résultat du paiement" }); }
// revient à l'accueil depuis n'importe quel écran (reconnecte si besoin)
async function home(t) {
  if (t.doc.getElementById("scrim")) await t.escape();
  if (t.exists("#authForm")) { await t.type("#auEmail", EMAIL); await t.type("#auPw", PW); await t.tap('#authForm [type=submit]'); }
  if (t.exists("[data-back]")) await t.tap("[data-back]");
  if (t.exists('.nav [data-tab="accueil"]')) await t.tap('.nav [data-tab="accueil"]');
  await t.el(".top-lime", { timeout: 8000 });
}

window.CP_SCENARIOS = [
{ name: "Ouverture et inscription", async run(t) {
  t.step("Effacer les données de test et ouvrir l'appli");
  t.clearData(); await t.open(null, { waitSplash: false });
  t.check(!!t.doc.getElementById("splash"), "L'animation du cauri s'affiche à l'ouverture");
  await t.waitSplash();
  t.check(!t.doc.getElementById("splash"), "L'animation laisse place à l'appli");
  await t.el("#authForm"); t.check(true, "L'écran de connexion s'affiche");
  t.step("Mot de passe : règles de la CNIL");
  await t.tap('[data-auth="signup"]');
  await t.type("#auName", "Aïcha"); await t.type("#auEmail", EMAIL); await t.type("#auPw", "court");
  t.check(t.count("#pwRules li.ok") === 0, "Un mot de passe trop court ne valide aucune règle");
  await t.tap('#authForm [type=submit]');
  t.check(/règles/.test(await t.text("#auErr")), "Un mot de passe faible est refusé");
  await t.type("#auPw", PW);
  t.check(t.count("#pwRules li.ok") === 4, "Un mot de passe fort valide les 4 règles");
  t.step("Âge et conditions obligatoires");
  await t.tap('#authForm [type=submit]');
  t.check(/majeures/.test(await t.text("#auErr")), "L'inscription exige d'avoir 18 ans");
  await t.tap("#auAge"); await t.tap('#authForm [type=submit]');
  t.check(/conditions/.test(await t.text("#auErr")), "L'inscription exige d'accepter les conditions");
  await t.tap("#auCgu"); await t.tap('#authForm [type=submit]');
  await t.el("#obIncome", { timeout: 8000 });
  t.check(true, "Le compte est créé et le premier lancement commence");
} },

{ name: "Premier lancement", async run(t) {
  t.step("Pays de résidence");
  t.check((await t.el("#obCountry")).value === "FR", "La France est proposée par défaut");
  t.check(t.count("#obCountry option") === 32, "32 pays de résidence sont proposés");
  t.step("Revenus, charges, épargne");
  await t.type("#obIncome", "2000"); await t.tap('[data-ob="next"]');
  await t.type("#obFixed", "850"); await t.tap('[data-ob="next"]');
  t.check(/€/.test(await t.text(".onb .row")), "Les suggestions d'épargne sont en euros");
  await t.type("#obSave", "200"); await t.tap('[data-ob="next"]');
  t.check(/950 €/.test(await t.text(".onb .result")), "Le disponible du mois est juste (2 000 − 850 − 200)");
  await t.tap('[data-ob="finish"]'); await t.el(".top-lime", { timeout: 8000 });
  const P = t.state().profile, sum = P.categories.reduce((a, k) => a + k.budget, 0);
  t.check(sum <= 950, "La somme des budgets ne dépasse pas le disponible", `${sum} € de budgets pour 950 €`);
  t.check(P.country === "FR" && P.currency === "EUR", "Le pays et la monnaie sont enregistrés");
} },

{ name: "Accueil", async run(t) {
  await home(t);
  t.step("Montant de la semaine et actions");
  await t.until(() => /€/.test(t.textNow(".bal-amt")), { label: "montant de la semaine" });
  t.check(true, "Le reste de la semaine s'affiche en euros");
  t.check(t.texts(".nav-in [data-tab] span").join(",") === "Accueil,Cartes,Budget,Épargne", "La barre du bas contient Accueil, Cartes, Budget, Épargne", t.texts(".nav-in [data-tab] span").join(","));
  t.check(t.count(".acts button") === 4, "Les 4 actions rapides sont présentes");
  t.step("Détail de la semaine");
  await t.tap(".notch"); t.check(t.isVisible("#weekMore"), "La flèche ouvre le détail de la semaine");
  await t.tap(".notch"); t.check(!t.isVisible("#weekMore"), "La flèche referme le détail de la semaine");
  t.step("Notifications");
  await t.tap('.hhdr [data-act="notifs"]');
  t.check(/Notifications/.test(await t.text("#scrim h2")), "Les notifications s'ouvrent");
  await t.tap("#scrim [data-close]"); await t.until(() => !t.doc.getElementById("scrim"), { label: "fermeture" });
  t.check(true, "Les notifications se ferment");
} },

{ name: "Dépenses", async run(t) {
  await home(t);
  t.step("Ajouter une dépense");
  await t.tap('.acts [data-act="expense"]'); await t.type("#exAmt", "23,40"); await t.type("#exNote", "Marché"); await t.tap("#exSave");
  await t.until(() => values(t.state().tx).length === 1, { label: "dépense enregistrée" });
  t.check(true, "La dépense est enregistrée");
  t.check(/Marché/.test(t.textNow(".view-accueil")), "Elle apparaît dans les transactions de l'accueil");
  t.step("Modifier puis supprimer");
  await t.tap("[data-edit-tx]"); await t.type("#exAmt", "30"); await t.tap("#exSave");
  await t.until(() => values(t.state().tx)[0].amount === 30, { label: "modification" }); t.check(true, "La dépense est modifiée");
  await t.tap("[data-edit-tx]"); await t.tap("#exDel");
  await t.until(() => values(t.state().tx).length === 0, { label: "suppression" }); t.check(true, "La dépense est supprimée");
  t.step("Une envie mise en attente 48 h");
  await t.tap('.acts [data-act="expense"]'); await t.type("#exAmt", "60"); await t.tap('#scrim [data-kind="envie"]');
  await t.el("#toWish"); t.check(true, "Une envie de plus de 25 € propose la règle des 48 h");
  await t.type("#exNote", "Casque"); await t.tap("#toWish"); await t.el(".view-envies");
  t.check(values(t.state().wishes).some(w => w.name === "Casque" && w.status === "wait"), "L'envie est mise en attente");
} },

{ name: "Envies", async run(t) {
  if (!t.exists(".view-envies")) { await home(t); await t.tap('.hhdr [data-tab="envies"]'); }
  await t.type("#wishName", "Baskets"); await t.type("#wishPrice", "90"); await t.tap('#wishForm [type=submit]');
  await t.until(() => values(t.state().wishes).some(w => w.name === "Baskets"), { label: "envie ajoutée" });
  t.check(true, "Une envie s'ajoute à la liste d'attente");
  const buy = [...t.doc.querySelectorAll('[data-to="bought"]')];
  t.check(buy.length > 0 && buy.every(b => b.disabled), "L'achat reste bloqué pendant 48 h");
  await t.tap('[data-to="skipped"]');
  await t.until(() => values(t.state().wishes).some(w => w.status === "skipped"), { label: "renoncement" });
  t.check(/économisés/.test(t.textNow(".view-envies")), "Renoncer compte l'argent économisé");
} },

{ name: "Budget", async run(t) {
  await home(t);
  await t.tap('.nav [data-tab="budget"]'); await t.el(".view-budget");
  t.check(t.count(".view-budget .bud-row") >= 7, "Les catégories de budget s'affichent", `${t.count(".view-budget .bud-row")} lignes`);
  t.check(!!t.doc.querySelector(".view-budget .chart svg"), "La courbe du mois s'affiche");
  await t.tap('[data-filter="envie"]'); t.check(t.attr('[data-filter="envie"]', "aria-pressed") === "true", "Le filtre « Envies » s'active");
  await t.tap('[data-filter="all"]');
  t.check(!!t.doc.querySelector('.linkcard[data-tab="envies"]'), "Un lien mène à la règle des 48 h");
} },

{ name: "Épargne", async run(t) {
  await home(t);
  await t.tap('.nav [data-tab="epargne"]'); await t.el(".view-epargne");
  t.step("Nouveau projet");
  await t.tap('.view-epargne .grid4 [data-act="newpot"]');
  await t.type("#peName", "Voyage"); await t.type("#peTarget", "600");
  const date = await t.el("#peDate"), sheet = t.doc.querySelector("#scrim .sheet").getBoundingClientRect();
  t.check(date.getBoundingClientRect().right <= sheet.right - 8, "Le champ « Pour quand ? » tient dans la fenêtre", `bord droit ${Math.round(date.getBoundingClientRect().right)} px, fenêtre ${Math.round(sheet.right)} px`);
  t.check(t.attr("#peName", "autocomplete") === "off", "Le nom du projet n'est pas prérempli avec les contacts");
  await t.select("#peDate", "2027-06"); await t.tap("#peSave");
  await t.until(() => pot(t, "Voyage"), { label: "projet créé" }); t.check(true, "Le projet est créé");
  t.step("Mettre de côté et retirer");
  await t.tap(`[data-pot-in="${pot(t, "Voyage").id}"]`);
  t.check(t.doc.activeElement && t.doc.activeElement.id === "pmAmt", "Le curseur est dans le montant dès l'ouverture");
  await t.type("#pmAmt", "100"); await t.tap("#pmSave");
  await t.until(() => pot(t, "Voyage").balance === 100, { label: "dépôt" }); t.check(true, "100 € sont mis de côté");
  await t.tap(`[data-pot-out="${pot(t, "Voyage").id}"]`); await t.type("#pmAmt", "500"); await t.tap("#pmSave");
  t.check(/ne contient que/.test(await t.text("#pmErr")), "Retirer plus que le solde est refusé");
  await t.tap('#scrim [data-q="20"]'); t.check(t.doc.getElementById("pmAmt").value === "20", "Les montants rapides remplissent le montant");
  await t.tap("#pmSave"); await t.until(() => pot(t, "Voyage").balance === 80, { label: "retrait" }); t.check(true, "Le retrait est enregistré");
  t.step("Objectif atteint");
  await t.tap(`[data-pot-in="${pot(t, "Voyage").id}"]`); await t.type("#pmAmt", "520"); await t.tap("#pmSave");
  await t.until(() => /Objectif atteint/.test(t.toast()), { label: "message d'objectif atteint" }); t.check(true, "Atteindre l'objectif est célébré");
  t.step("Supprimer le projet");
  await t.tap(`[data-pot-open="${pot(t, "Voyage").id}"]`); await t.tap("#peDel"); await t.tap("#cfBoxOk");
  await t.until(() => !pot(t, "Voyage"), { label: "suppression du projet" }); t.check(true, "Le projet est supprimé");
} },

{ name: "Recevoir d'Afrique", async run(t) {
  await home(t);
  await t.tap('.acts [data-act="receive"]'); await t.el(".view-transfert");
  t.step("Ajouter un expéditeur");
  await t.tap(".view-transfert .add-chip"); await t.type("#ctName", "Awa Diop"); await t.select("#ctCountry", "SN");
  await t.tap('[data-meth="wave"]'); await t.type("#ctPhone", "771234546"); await t.tap("#ctSave");
  await t.until(() => values(t.state().contacts).some(c => c.name === "Awa Diop"), { label: "expéditeur enregistré" });
  t.check(true, "L'expéditeur est enregistré");
  t.step("Saisir le montant au clavier");
  for (const k of ["1", "5", "0"]) await t.key(k);
  t.check(/^150,00 €$/.test(await t.text("#rxAmt")), "Le montant tapé s'affiche : 150,00 €", t.textNow("#rxAmt"));
  t.check(/99 870 F CFA/.test(t.textNow("#rxConv")), "La conversion est juste : 99 870 F CFA, frais compris", t.textNow("#rxConv"));
  await t.tap('[data-act="swapcur"]'); t.check(/F CFA$/.test(t.textNow("#rxAmt")), "On peut saisir le montant payé en F CFA");
  await t.tap('[data-act="swapcur"]'); t.check(/^150,00 €$/.test(t.textNow("#rxAmt")), "Le retour en euros garde le montant", t.textNow("#rxAmt"));
  t.step("Appui long, identité, confirmation");
  await t.hold("#holdBtn"); await t.tap("#kycGo"); await t.el("#cfGo");
  await t.tap("#cfGo"); t.check(/motif/.test(await t.text("#cfErr")), "Le motif du transfert est obligatoire");
  await t.select("#cfPurpose", "Frais de scolarité ou d'études");
  t.check(/justificatifs/.test(t.textNow("#cfStudy")), "Pour des frais d'études, l'appli liste les justificatifs");
  await t.tap("#cfGo"); t.check(/Coche/.test(t.textNow("#cfErr")), "L'attestation d'origine des fonds est obligatoire");
  await t.tap("#cfOk"); await t.tap("#cfGo");
  t.check(/^CPY-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(await t.text(".ref")), "Une référence CPY-XXXX-XXXX est créée", t.textNow(".ref"));
  const wa = decodeURIComponent(t.attr('.share a[href^="https://wa.me"]', "href") || "");
  t.check(/150,00\s€/.test(wa) && /99\s870/.test(wa), "Le message WhatsApp contient les montants");
  t.step("Paiement simulé de l'expéditeur");
  const before = wallet(t); await t.tap("#scrim [data-sim]");
  await t.until(() => values(t.state().transfers).some(x => x.status === "credited"), { timeout: 9000, label: "argent reçu" });
  t.check(Math.abs(wallet(t) - before - 150) < 0.001, "Les 150 € reçus arrivent sur le compte CauriPay", `solde ${wallet(t)} €`);
  t.step("Suivi et page de l'expéditeur");
  await t.tap('[data-rxtab="track"]'); await t.tap(".view-transfert [data-tr]");
  t.check(t.count("#scrim .timeline li.done") === 4, "Le suivi montre les 4 étapes terminées");
  await t.tap("#scrim [data-close]");
  const m = wa.match(/(https?:\/\/\S+#payer=\S+)/); t.check(!!m, "Le message contient le lien de paiement");
  if (m) { const u = new URL(m[1]); await t.open(u.pathname + u.hash); t.check(/150,00 €/.test(await t.text(".from-card")), "La page de l'expéditeur affiche le montant reçu"); await t.open(); }
  t.step("Burkina Faso : moyens de paiement");
  await home(t); await t.tap('.acts [data-act="receive"]'); await t.tap(".view-transfert .add-chip"); await t.select("#ctCountry", "BF");
  const meth = t.texts("#ctMethods [data-meth]").join(", ");
  t.check(/Orange/.test(meth) && /Moov/.test(meth) && /Wave/.test(meth) && /Telecel/.test(meth) && /Sank/.test(meth), "Burkina : Orange, Moov, Wave, Telecel et Sank sont proposés", meth);
  await t.escape();
} },

{ name: "Cartes CauriPay", async run(t) {
  await home(t);
  await t.tap('.nav [data-tab="cartes"]'); await t.el(".view-cartes");
  t.step("Créer une carte en 4 étapes");
  await t.tap('.view-cartes [data-act="newcard"]');
  if (t.exists("#kycGo")) await t.tap("#kycGo");
  await t.el("[data-cw-type]");
  await t.tap('[data-cw-type="single"]'); t.check(t.attr('[data-cw-type="single"]', "aria-pressed") === "true", "Le type de carte se choisit au toucher");
  await t.tap('[data-cw-type="virtual"]'); await t.tap('[data-cw="next"]');
  await t.tap('[data-cw-design="indigo"]'); t.check(t.doc.querySelector(".ccard.preview").classList.contains("d-indigo"), "Le style se choisit au toucher, avec aperçu");
  await t.type("#cwHolder", "Aïcha Test"); t.check(t.textNow(".ccard.preview .cc-holder") === "AÏCHA TEST", "Le nom s'affiche en majuscules sur l'aperçu", t.textNow(".ccard.preview .cc-holder"));
  await t.tap('[data-cw="next"]'); t.check(!!t.doc.getElementById("cwLim"), "Le plafond se règle");
  await t.tap('[data-cw="next"]');
  await t.tap('[data-cw="create"]'); t.check(/conditions/.test(await t.text("#cwErr")), "Les conditions de la carte sont obligatoires");
  await t.tap("#cwCgu"); await t.type("#cwPw", "mauvais-mot"); await t.tap('[data-cw="create"]');
  await t.until(() => /incorrect/.test(t.textNow("#cwErr")), { label: "refus du mot de passe" }); t.check(true, "Un mauvais mot de passe bloque la création");
  await t.type("#cwPw", PW); await t.tap('[data-cw="create"]'); await t.el("#cardRail .ccard", { timeout: 8000 });
  t.check(/^0000\d{12}$/.test(card(t).pan), "La carte a un numéro de démonstration (0000…)");
  t.step("Recharger et payer");
  const w0 = wallet(t);
  await t.tap('[data-card-act="topup"]'); await t.tap('#scrim [data-q="200"]'); await t.tap("#tuGo");
  await t.until(() => Math.abs(wallet(t) - w0 - 200) < 0.001, { label: "recharge" }); t.check(true, "La recharge crédite le compte");
  await t.tap('[data-card-act="nfc"]'); await t.tap("#payGo"); await payDone(t);
  t.check(/Paiement accepté/.test(t.textNow("#payMsg")), "Sans contact 12,50 € : accepté sans mot de passe", t.textNow("#payMsg"));
  await t.type("#payAmt", "60"); await t.tap("#payGo"); await t.until(() => t.isVisible("#payAuth"), { label: "authentification forte" });
  t.check(true, "Sans contact 60 € : authentification forte demandée");
  await t.type("#payPw", PW); await t.tap("#payYes"); await payDone(t);
  t.check(/Paiement accepté/.test(t.textNow("#payMsg")), "Après le mot de passe, le paiement est accepté", t.textNow("#payMsg"));
  await t.escape();
  await t.tap('[data-card-act="online"]'); await t.tap("#payGo"); await t.until(() => t.isVisible("#payAuth"), { label: "3-D Secure" });
  t.check(true, "Achat en ligne : validation 3-D Secure");
  await t.type("#payPw", PW); await t.tap("#payYes"); await payDone(t);
  t.check(/Paiement accepté/.test(t.textNow("#payMsg")), "L'achat en ligne est accepté", t.textNow("#payMsg"));
  await t.escape();
  t.check(Math.abs(wallet(t) - (w0 + 200 - 12.5 - 60 - 39.9)) < 0.001, "Le solde baisse du montant des 3 paiements", `solde ${wallet(t)} €`);
  t.step("Geler, infos, plafonds, opposition");
  await t.tap('[data-card-act="freeze"]'); await t.el("#cardRail .ccard.frozen .cc-frost"); t.check(true, "Geler la carte affiche le givre");
  await t.tap('[data-card-act="nfc"]'); await t.tap("#payGo"); await payDone(t);
  t.check(/gelée/.test(t.textNow("#payMsg")), "Une carte gelée refuse les paiements", t.textNow("#payMsg"));
  await t.escape(); await t.tap('[data-card-act="freeze"]');
  await t.tap('[data-card-act="details"]'); await t.type("#raPw", PW); await t.tap("#raGo"); await t.el("#flip");
  t.check(t.textNow("#flip").replace(/\s/g, "").includes(card(t).pan), "Le numéro complet s'affiche après le mot de passe");
  await t.tap("[data-flip]"); t.check(t.doc.getElementById("flip").classList.contains("flipped"), "La carte se retourne pour le cryptogramme");
  await t.escape();
  await t.tap('[data-card-act="limits"]'); await t.select("#lmLim", "1000"); await t.tap("#lmSave");
  await t.until(() => card(t).limit === 1000, { label: "plafond" }); t.check(true, "Le plafond se modifie");
  await t.tap('[data-card-act="oppose"]'); await t.tap('[data-why="volee"]'); await t.tap("#opGo");
  await t.el("#cardRail .cc-frost.blocked"); t.check(true, "L'opposition bloque la carte définitivement");
  await t.tap('[data-card-act="close"]'); await t.tap("#cfBoxOk");
  await t.until(() => !t.doc.querySelector("#cardRail"), { label: "carte supprimée" }); t.check(true, "La carte supprimée disparaît");
  t.step("Paiements ajoutés au budget");
  await t.tap('.nav [data-tab="budget"]');
  t.check(/^112 €$/.test(t.textNow(".sum-card .stats3 .v")), "Les 3 paiements par carte comptent dans le budget", t.textNow(".sum-card .stats3 .v"));
} },

{ name: "Monnaie selon le pays", async run(t) {
  await home(t);
  await t.tap(".hhdr .avatar"); await t.select("#pfCountry", "GB");
  t.check(/livre sterling/.test(await t.text("#scrim h2")), "Changer de pays demande une confirmation");
  await t.tap("#cfBoxOk"); await t.until(() => t.state().profile.currency === "GBP", { label: "passage à la livre" });
  t.check(true, "La monnaie passe à la livre");
  await home(t);
  await t.until(() => /£/.test(t.textNow(".bal-amt")), { label: "accueil en livres" }); t.check(true, "L'accueil s'affiche en livres");
  await t.tap('.acts [data-act="receive"]'); for (const k of ["1", "5", "0"]) await t.key(k);
  t.check(/^150,00 £$/.test(await t.text("#rxAmt")), "Le montant à recevoir se saisit en livres", t.textNow("#rxAmt"));
  t.check(/taux BCE/.test(t.textNow("#rxConv")), "La conversion utilise le taux de la BCE");
  await home(t);
  await t.tap(".hhdr .avatar"); await t.select("#pfCountry", "FR"); await t.tap("#cfBoxOk");
  await t.until(() => t.state().profile.currency === "EUR", { label: "retour à l'euro" }); t.check(true, "Le retour en France rétablit l'euro");
} },

{ name: "Profil et compte", async run(t) {
  await home(t);
  await t.tap(".hhdr .avatar");
  t.step("Changer le prénom");
  await t.type('[data-pf-text="name"]', "Aïcha B.");
  await t.until(() => t.state().profile.name === "Aïcha B.", { label: "prénom" }); t.check(true, "Le prénom se modifie");
  t.step("Exporter mes données");
  const w = t.win; let blob = null; const keepURL = w.URL.createObjectURL, keepClick = w.HTMLAnchorElement.prototype.click;
  w.URL.createObjectURL = b => { blob = b; return "blob:test"; }; w.HTMLAnchorElement.prototype.click = function () {};
  try { await t.tap('[data-act="export"]'); } finally { w.URL.createObjectURL = keepURL; w.HTMLAnchorElement.prototype.click = keepClick; }
  let data = null; try { data = blob ? JSON.parse(await blob.text()) : null; } catch (e) { data = null; }
  t.check(!!(data && data.app === "cauripay" && data.data && data.data.profile), "L'export contient toutes les données");
  t.step("Déconnexion et reconnexion");
  await t.tap('[data-act="logout"]'); await t.el("#authForm");
  await t.type("#auEmail", EMAIL); await t.type("#auPw", "mauvais-mot"); await t.tap('#authForm [type=submit]');
  await t.until(() => /incorrect/.test(t.textNow("#auErr")), { label: "refus" }); t.check(true, "Un mauvais mot de passe est refusé");
  await t.type("#auPw", PW); await t.tap('#authForm [type=submit]'); await t.el(".top-lime", { timeout: 8000 });
  t.check(/Aïcha B\./.test(t.textNow(".who b")), "Après reconnexion, les données sont retrouvées", t.textNow(".who b"));
} },

{ name: "Plein écran et mise en page", async run(t) {
  const start = t.deviceKey;
  for (const key of Object.keys(t.devices)) {
    const name = t.devices[key].name;
    t.step("Écran " + name); await t.setDevice(key); await home(t);
    const w = t.win, d = t.doc, sc = d.getElementById("scroller"), nav = d.getElementById("nav");
    t.check(Math.abs(nav.getBoundingClientRect().bottom - w.innerHeight) <= 1, `${name} : la barre du bas touche le bas de l'écran`, `écart ${Math.round(w.innerHeight - nav.getBoundingClientRect().bottom)} px`);
    await t.until(() => d.querySelector(".top-lime").getBoundingClientRect().top <= 0.5, { timeout: 3000, label: "en-tête en haut" }).catch(() => {});
    t.check(d.querySelector(".top-lime").getBoundingClientRect().top <= 0.5, `${name} : le vert de l'accueil monte jusqu'en haut de l'écran`);
    t.check(sc.offsetWidth - sc.clientWidth === 0, `${name} : aucune barre de défilement`);
    const over = [];
    const probe = label => { if (sc.scrollWidth > sc.clientWidth + 1 || d.documentElement.scrollWidth > w.innerWidth + 1) over.push(label); };
    probe("accueil");
    for (const [tab, label] of [["cartes", "cartes"], ["budget", "budget"], ["epargne", "épargne"]]) { await t.tap(`.nav [data-tab="${tab}"]`); await t.el(".view-" + tab); probe(label); }
    await home(t); await t.tap('.hhdr [data-tab="envies"]'); await t.el(".view-envies"); probe("envies");
    await home(t); await t.tap('.acts [data-act="receive"]'); await t.el(".view-transfert"); probe("recevoir");
    t.check(!over.length, `${name} : rien ne déborde sur le côté`, over.join(", "));
    const unnamed = [...d.querySelectorAll("button")].filter(b => b.getClientRects().length && !b.textContent.trim() && !b.getAttribute("aria-label") && !b.title);
    t.check(!unnamed.length, `${name} : chaque bouton a un nom pour les lecteurs d'écran`, unnamed.slice(0, 3).map(b => b.outerHTML.slice(0, 60)).join(" | "));
    await home(t);
  }
  await t.setDevice(start);
} },

{ name: "Pages légales", async run(t) {
  for (const [path, title] of [["/legal/mentions-legales.html", "Mentions légales"], ["/legal/confidentialite.html", "Politique de confidentialité"], ["/legal/cgu.html", "Conditions générales d'utilisation"]]) {
    let ok = false; try { const r = await fetch(path); ok = r.ok && (await r.text()).includes(title); } catch (e) { ok = false; }
    t.check(ok, `La page « ${title} » est en ligne`);
  }
} },

{ name: "Suppression du compte", async run(t) {
  await t.open(); await home(t);
  await t.tap(".hhdr .avatar"); await t.tap('[data-act="delaccount"]'); await t.tap("#cfBoxOk");
  await t.el("#authForm"); t.check(true, "Le compte est supprimé et l'écran de connexion revient");
  await t.tap('[data-auth="login"]'); await t.type("#auEmail", EMAIL); await t.type("#auPw", PW); await t.tap('#authForm [type=submit]');
  await t.until(() => /incorrect/.test(t.textNow("#auErr")), { label: "refus après suppression" }); t.check(true, "Le compte supprimé ne peut plus se connecter");
  t.check(!Object.keys(localStorage).some(k => k.startsWith("cptest_v3_")), "Les données du compte sont effacées de l'appareil");
} }
];
})();
