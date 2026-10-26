# Tirelire

Appli de budget personnel pensée pour arrêter de finir le mois dans le rouge.

- **Budget de la semaine**, recalculé chaque jour selon ce que tu as déjà dépensé, avec un maximum pour aujourd'hui
- **Trésorerie** : des projets d'épargne avec un montant visé et une date. L'appli calcule combien verser par mois et par semaine
- **Rattrapage** : si un mois dépasse, tu étales le dépassement sur 1 à 3 mois et tes budgets baissent automatiquement
- **Budgets par catégorie**, part besoins / envies et courbe du mois
- **Règle des 48 h** contre les achats impulsifs
- **Sauvegarde** : export et import de tes données en fichier `.json`

Aucune installation, aucun serveur : c'est un site statique (HTML, CSS, JavaScript).

---

## Structure du projet

```
tirelire/
├── index.html               La page : en-tête, zones où l'appli s'affiche
├── css/style.css            Tout le design (couleurs, polices, mise en page)
├── js/app.js                Toute la logique de l'appli
├── manifest.webmanifest     Permet d'installer l'appli sur l'écran d'accueil du téléphone
├── icons/                   Icônes de l'appli
├── .github/workflows/       Mise en ligne automatique sur GitHub Pages
└── .vscode/                 Réglages et extensions conseillées pour VS Code
```

### Où modifier quoi

| Tu veux changer…                            | Va dans                                                         |
| ------------------------------------------- | --------------------------------------------------------------- |
| Les couleurs (thème clair et sombre)        | `css/style.css`, tout en haut (`:root` puis les blocs « dark ») |
| Les polices                                 | `index.html` (lien Google Fonts) et `--display` / `--body` dans `style.css` |
| Les catégories proposées au départ          | `js/app.js`, constante `DEF_CATS` (nom + part du budget)        |
| Le calcul du budget de la semaine           | `js/app.js`, fonction `calc()`                                   |
| La page d'accueil                           | `js/app.js`, fonction `vHome()`                                  |
| La trésorerie                               | `js/app.js`, fonction `vTreso()`                                 |
| Les messages de conseil                     | `js/app.js`, fonction `coachLine()`                              |
| La durée d'attente des envies (48 h)        | `js/app.js`, constante `H48`                                     |

Chaque écran correspond à une fonction `vNomDeLEcran()` qui renvoie du HTML. Après chaque action, l'appli appelle `render()`, qui redessine l'écran.

---

## Travailler dans VS Code

1. Ouvre le dossier `tirelire` dans VS Code (**Fichier → Ouvrir le dossier**).
2. VS Code te propose d'installer les extensions conseillées : accepte. Il s'agit de **Live Server** et **Prettier**.
3. Fais un clic droit sur `index.html`, puis **Open with Live Server**. L'appli s'ouvre dans ton navigateur et se recharge à chaque enregistrement de fichier.

> Ouvre toujours l'appli avec Live Server, pas en double-cliquant sur `index.html`. Sinon certains navigateurs bloquent l'installation sur l'écran d'accueil.

---

## Mettre l'appli en ligne avec GitHub

### 1. Créer le dépôt

1. Sur [github.com/new](https://github.com/new), crée un dépôt nommé `tirelire`. Ne coche **aucune** case : ni README, ni .gitignore, ni licence.
2. Dans VS Code, ouvre le terminal (**Terminal → Nouveau terminal**) et tape :

```bash
git remote add origin https://github.com/TON-PSEUDO/tirelire.git
git push -u origin main
```

Remplace `TON-PSEUDO` par ton nom d'utilisateur GitHub. Le dossier est déjà un dépôt Git avec un premier commit.

### 2. Activer GitHub Pages (une seule fois)

Sur la page du dépôt : **Settings → Pages → Build and deployment → Source : GitHub Actions**.

Au bout d'une minute environ, l'appli est en ligne à l'adresse :

```
https://TON-PSEUDO.github.io/tirelire/
```

### 3. Publier une modification

Après chaque retouche :

```bash
git add .
git commit -m "Ce que j'ai changé"
git push
```

Tu peux aussi passer par l'onglet **Contrôle de code source** de VS Code (l'icône en forme de branche), sans taper de commande. La mise en ligne se relance toute seule à chaque `push`. Tu peux suivre son avancement dans l'onglet **Actions** du dépôt.

### 4. Installer l'appli sur ton téléphone

Ouvre l'adresse de ton appli sur ton téléphone :

- **iPhone (Safari)** : bouton Partager → **Sur l'écran d'accueil**
- **Android (Chrome)** : menu ⋮ → **Installer l'application**

---

## Où sont tes données ?

La version hébergée sur GitHub enregistre tes données **dans le navigateur de ton appareil** (`localStorage`). Rien n'est envoyé sur Internet et personne d'autre ne peut les voir. En contrepartie :

- tes données ne passent pas d'un appareil à l'autre automatiquement ;
- vider les données du navigateur les efface.

Va donc régulièrement dans **Profil → Exporter une sauvegarde**. Pour retrouver tes données sur un autre appareil, ouvre l'appli et fais **Importer une sauvegarde**. Tu peux aussi le faire dès le premier écran.

La version ouverte depuis Claude utilise une base de données liée à ton compte Claude, synchronisée entre tes appareils. Ces deux versions ne partagent pas leurs données. Pour passer de l'une à l'autre, utilise l'export / import.

> Le dépôt ne contient **aucune** de tes données personnelles. Ne commite pas tes fichiers de sauvegarde : le `.gitignore` les exclut déjà.

---

## Aller plus loin

Pour synchroniser tes données entre plusieurs appareils dans la version GitHub, il faut ajouter une base de données en ligne, par exemple **Supabase** ou **Firebase**, qui ont des offres gratuites. Toutes les écritures passent par une seule fonction, `write()` dans `js/app.js`. C'est donc le seul endroit à adapter.
