# CauriPay

Appli de budget personnel pensée pour arrêter de finir le mois dans le rouge, et pour recevoir facilement l'argent envoyé par ses proches depuis l'Afrique.

- **Compte par e-mail** : inscription, connexion, mot de passe oublié, suppression du compte
- **Budget de la semaine**, recalculé chaque jour selon ce que tu as déjà dépensé, avec un maximum pour aujourd'hui
- **Épargne** : des projets avec un montant visé et une date. L'appli calcule combien verser par mois et par semaine
- **Rattrapage** : si un mois dépasse, tu étales le dépassement sur 1 à 3 mois et tes budgets baissent automatiquement
- **Règle des 48 h** contre les achats impulsifs
- **Cartes CauriPay** (démonstration) : carte virtuelle ou à usage unique au motif de cauris, 4 styles, paiement en ligne validé (3-D Secure), sans contact simulé, gel, plafonds, opposition. Chaque paiement s'ajoute au budget
- **Effets** : écrans qui glissent, montants qui défilent, vibrations sur Android, pluie de cauris pour les réussites. L'option « réduire les animations » du téléphone est respectée
- **Recevoir d'Afrique** (démonstration) : tu crées une demande en euros, ton proche paie en F CFA par mobile money (Wave, Orange Money, MTN…) et tu suis l'arrivée de l'argent
- **Tes données** : export en fichier `.json` et suppression du compte

C'est un site statique (HTML, CSS, JavaScript) : aucune installation, et un hébergement gratuit sur GitHub Pages.

> **Important.** La réception d'argent est une **simulation** : aucun argent ne circule. Pour de vrais transferts, il faut un partenaire de paiement agréé. Voir [docs/CONFORMITE.md](docs/CONFORMITE.md).

**En ligne :** https://hermes-bit.github.io/cauripay/ · **Code :** https://github.com/Hermes-bit/cauripay

---

## Structure du projet

```
cauripay/
├── index.html               La page : zones où l'appli s'affiche
├── css/style.css            Tout le design (couleurs, polices, mise en page)
├── js/config.js             Réglages : comptes en ligne, frais et plafonds des transferts
├── js/auth.js               Inscription et connexion par e-mail
├── js/app.js                Toute la logique de l'appli
├── legal/                   Mentions légales, confidentialité, CGU (projets à compléter)
├── docs/CONFORMITE.md       Ce que la loi impose, et ce qu'il reste à faire
├── supabase/schema.sql      Base de données pour les vrais comptes
├── fonts/                   Polices Outfit et Manrope (hébergées ici, pas chez Google)
├── icons/                   Logo et icônes de l'appli
├── manifest.webmanifest     Installation sur l'écran d'accueil du téléphone
└── .github/workflows/       Mise en ligne automatique sur GitHub Pages
```

### Où modifier quoi

| Tu veux changer…                               | Va dans                                                       |
| ---------------------------------------------- | ------------------------------------------------------------- |
| Les couleurs                                   | `css/style.css`, tout en haut (`:root`)                       |
| Le logo                                        | `icons/logo.svg` (voir plus bas)                              |
| Les frais, plafonds et durée des demandes      | `js/config.js`                                                |
| Les pays et moyens de paiement proposés        | `js/app.js`, constantes `COUNTRIES` et `METHODS`              |
| Les catégories proposées au départ             | `js/app.js`, constante `DEF_CATS`                             |
| Le calcul du budget de la semaine              | `js/app.js`, fonction `calc()`                                |
| L'écran d'accueil                              | `js/app.js`, fonction `vHome()`                               |
| L'écran « Recevoir d'Afrique »                 | `js/app.js`, fonction `vTransfer()`                           |
| Les cartes (styles, seuils, commerçants de test) | `js/app.js`, section « cartes CauriPay » (`DESIGNS`, `NFC_ONE`…) et `css/style.css` (`.d-citron`…) |
| L'écran de connexion                           | `js/app.js`, fonction `vAuth()`                               |
| Les textes légaux                              | `legal/*.html` (les passages surlignés sont à compléter)      |

Chaque écran correspond à une fonction `vNomDeLEcran()` qui renvoie du HTML. Après chaque action, l'appli appelle `render()`, qui redessine l'écran.

---

## Les comptes : mode démo ou vrais comptes

### Mode démo (par défaut)

Sans réglage, l'inscription fonctionne mais le compte et les données restent **dans le navigateur de l'appareil**. Aucun e-mail n'est envoyé, et un bandeau « Mode démo » l'indique. C'est parfait pour tester et montrer l'appli.

Si tu utilisais déjà Tirelire sur cet appareil, tes anciennes données sont reprises automatiquement par le premier compte créé.

### Activer les vrais comptes (Supabase, gratuit pour commencer)

1. Crée un compte sur [supabase.com](https://supabase.com), puis un projet. Choisis une **région en Europe**, pour le RGPD.
2. Dans **SQL Editor**, colle le contenu de `supabase/schema.sql` et clique sur **Run**.
3. Dans **Authentication → Sign In / Providers → Email** :
   - laisse **Confirm email** activé ;
   - règle la longueur minimale du mot de passe sur **12** et exige minuscules, majuscules, chiffres et symboles.
4. Dans **Authentication → URL Configuration**, mets l'adresse de ton appli dans **Site URL** (`https://hermes-bit.github.io/cauripay/`). Ajoute aussi `http://127.0.0.1:5500/` dans **Redirect URLs** pour tester avec Live Server.
5. Dans **Project Settings → API**, copie la **Project URL** et la clé **anon public**, et colle-les dans `js/config.js` :

```js
supabaseUrl: "https://abcdefgh.supabase.co",
supabaseAnonKey: "eyJhbGciOi...",
```

La clé « anon » peut être publique : chaque personne ne voit que ses propres données grâce aux règles de sécurité créées par `schema.sql`. Ne mets **jamais** la clé « service_role » dans le code.

Avec les vrais comptes, tu as l'e-mail de confirmation, le mot de passe oublié, la synchronisation entre appareils et la suppression complète du compte.

---

## Recevoir de l'argent d'Afrique (démonstration)

Bouton **Recevoir** sur l'accueil, ou bouton central de la barre du bas.

1. Ajoute un **expéditeur** : nom, pays, moyen de paiement, numéro.
2. Tape le montant en euros sur le pavé. Tu peux aussi saisir ce que paie l'expéditeur en F CFA. Les frais et le taux s'affichent en direct.
3. **Maintiens** le bouton du bas une seconde. Au clavier, appuie sur Entrée.
4. La première fois, l'appli simule la vérification d'identité.
5. Vérifie le récapitulatif, choisis le motif et valide. Tu obtiens une référence `CPY-XXXX-XXXX` et un lien à envoyer par WhatsApp ou SMS.
6. « Simuler le paiement » fait passer la demande par toutes les étapes, jusqu'à « Argent reçu ».

Les pays ouverts sont ceux dont la monnaie a un **taux fixe avec l'euro** : zone franc CFA (UEMOA et CEMAC), Comores, Cap-Vert. Les autres sont affichés « bientôt ».

Pour passer au réel, la simulation est à remplacer par l'API d'un partenaire agréé : fonctions `simulate()` et `vPayer()` dans `js/app.js`. Le détail est dans [docs/CONFORMITE.md](docs/CONFORMITE.md).

---

## Les cartes CauriPay (démonstration)

Onglet **Cartes** dans la barre du bas.

1. **Créer ma carte** : vérification d'identité (simulée), choix du type, du style et des plafonds, puis acceptation des conditions et confirmation par mot de passe.
2. **Recharger** le compte CauriPay. L'argent reçu d'Afrique y arrive aussi automatiquement.
3. **Sans contact** ou **Payer en ligne** : un paiement de test. Au-delà de 50 €, ou pour tout achat en ligne, l'appli demande ton mot de passe : c'est l'authentification forte exigée par la réglementation.
4. **Geler**, **Plafonds**, **Opposition**, **Voir les infos** (après mot de passe, masquées au bout de 60 secondes).

Les numéros de carte commencent par 0000 : ils ne fonctionnent nulle part. Pour de vraies cartes, il faut un émetteur agréé ; le détail est en section 9 de [docs/CONFORMITE.md](docs/CONFORMITE.md).

---

## Mettre ton logo

Ton logo s'affiche sur l'écran de connexion et sur la page de paiement envoyée à tes proches.

1. Exporte-le en **SVG** si possible (sinon en PNG carré d'au moins 512 × 512 px).
2. Remplace `icons/logo.svg` en gardant le même nom. Pour un PNG, nomme-le `icons/logo.png` et remplace `icons/logo.svg` par `icons/logo.png` dans `js/app.js` (constante `LOGO`).
3. Pour l'icône du téléphone et de l'onglet, génère les fichiers `icon-192.png`, `icon-512.png` et `icon-maskable-512.png` (par exemple avec [maskable.app](https://maskable.app/editor)), puis remplace ceux du dossier `icons/`, ainsi que `icons/icon.svg`.
4. Pour l'iPhone, l'icône doit faire **180 × 180 px, sans transparence** (fond plein), sinon l'iPhone affiche une lettre à la place du logo. Elle se trouve dans `apple-touch-icon.png` et elle est aussi **copiée dans `index.html`** (ligne `apple-touch-icon`), pour que l'iPhone n'ait rien à télécharger. Le plus simple : envoie ton logo à Claude, qui régénère toutes les icônes d'un coup.

---

## Travailler dans VS Code

1. Ouvre le dossier du projet dans VS Code (**Fichier → Ouvrir le dossier**).
2. VS Code te propose d'installer les extensions conseillées : accepte. Il s'agit de **Live Server** et **Prettier**.
3. Fais un clic droit sur `index.html`, puis **Open with Live Server**. L'appli s'ouvre dans ton navigateur et se recharge à chaque enregistrement.

> Ouvre toujours l'appli avec Live Server, pas en double-cliquant sur `index.html`. Sinon la création de compte et l'installation sur l'écran d'accueil peuvent être bloquées.

---

## L'appli en ligne (GitHub Pages)

Le dépôt est https://github.com/Hermes-bit/cauripay et GitHub Pages est déjà activé (source : GitHub Actions). L'appli est en ligne à l'adresse :

```
https://hermes-bit.github.io/cauripay/
```

### Publier une modification

```bash
git add .
git commit -m "Ce que j'ai changé"
git push
```

Tu peux aussi passer par l'onglet **Contrôle de code source** de VS Code. La mise en ligne se relance toute seule à chaque `push`, en une minute environ. Tu peux suivre son avancement dans l'onglet **Actions** du dépôt.

### Installer l'appli sur ton téléphone

Ouvre https://hermes-bit.github.io/cauripay/ sur ton téléphone, puis :

- **iPhone (Safari)** : bouton Partager → **Sur l'écran d'accueil**
- **Android (Chrome)** : menu ⋮ → **Installer l'application**

---

## Avant une ouverture au public

- [ ] Compléter les passages surlignés de `legal/mentions-legales.html`, `legal/confidentialite.html` et `legal/cgu.html`, puis les faire relire par un juriste
- [ ] Activer les vrais comptes (Supabase, région UE)
- [ ] Mettre ton logo
- [ ] Pour de vrais transferts : suivre la liste de la section 7 de [docs/CONFORMITE.md](docs/CONFORMITE.md)

> Le dépôt ne contient **aucune** de tes données personnelles. Ne commite pas tes fichiers de sauvegarde : le `.gitignore` les exclut déjà.
