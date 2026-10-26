# CauriPay : ce que la loi impose

Synthèse préparée en octobre 2026 pour cadrer le projet. **Ce n'est pas un avis juridique.** Avant d'ouvrir de vrais transferts d'argent, fais valider ce document par un avocat en droit bancaire et financier en France, et par un conseil local dans chaque pays d'envoi.

Les points marqués **à vérifier** viennent de sources secondaires (presse, cabinets, blogs spécialisés) et doivent être confirmés sur le texte officiel.

---

## 1. L'essentiel

| Ce que fait CauriPay | Réglementé ? | Ce qu'il faut |
| --- | --- | --- |
| Gestion de budget, épargne, envies (aujourd'hui) | Non, hors droit commun | RGPD, mentions légales, CGU, droit de la consommation, accessibilité |
| « Recevoir d'Afrique » en **démonstration** (aujourd'hui) | Non : aucun fonds ne circule | Dire clairement que c'est une démo (fait dans l'appli) |
| « Recevoir d'Afrique » **réel** | **Oui** : c'est un service de paiement (transmission de fonds) | Agrément, ou partenariat avec un établissement agréé, en Europe **et** dans chaque pays d'envoi |

**Le point bloquant.** En France, seuls les prestataires agréés peuvent fournir des services de paiement (Code monétaire et financier, art. L. 521-2). L'exercice sans agrément est un délit. CauriPay ne doit donc **jamais** encaisser, conserver ou reverser de l'argent elle-même tant qu'elle n'a pas de statut.

**La voie recommandée.** CauriPay reste l'application (l'interface, la marque, l'expérience) et s'appuie sur **des partenaires agréés** :

- en Afrique, un acteur agréé localement qui encaisse en mobile money ou par virement, et qui passe par une banque autorisée pour sortir les devises ;
- en Europe, un établissement de paiement ou de monnaie électronique agréé qui reçoit les fonds et les verse sur le compte bancaire de l'utilisateur.

Ce sont les partenaires qui portent les agréments, la vérification d'identité et la lutte contre le blanchiment. CauriPay signe avec eux un contrat de prestataire technique, ou devient leur agent.

---

## 2. Pourquoi l'Afrique → Europe est difficile

C'est exactement le problème que tu as repéré. Il a trois causes principales.

### 2.1 Le contrôle des changes dans les pays d'envoi

Vers l'Afrique, l'argent sort librement d'Europe. Dans l'autre sens, la plupart des pays africains contrôlent la sortie des devises pour protéger leurs réserves de change.

**Zone UEMOA** (Sénégal, Côte d'Ivoire, Mali, Burkina Faso, Bénin, Togo, Niger, Guinée-Bissau)

- Le règlement n° 06/2024/CM/UEMOA, adopté en décembre 2024, remplace le règlement n° 09/2010 sur les relations financières extérieures. La BCEAO a publié 15 instructions d'application en juillet 2025 (n° 01/07/2025/RFE à 15/07/2025/RFE). L'instruction n° 09/07/2025/RFE est entrée en vigueur le 1er août 2025.
- Les transferts vers l'étranger passent par un **intermédiaire agréé**, en pratique une banque, qui contrôle les justificatifs avant d'exécuter l'opération.
- Pour un particulier (aide familiale, frais de scolarité), les justificatifs cités sont : un certificat de résidence ou un titre de séjour du bénéficiaire à l'étranger, les pièces justifiant la dépense (loyer, inscription) et un formulaire de change signé. **À vérifier** sur le texte de la BCEAO.
- Seuil : selon une source secondaire, les transferts **inférieurs à 1 000 000 FCFA** (environ 1 500 €) peuvent se faire sans justificatif particulier, sous réserve des règles anti-blanchiment. L'ancien règlement de 2010 fixait ce seuil à 500 000 FCFA. **À vérifier.**
- Côté services de paiement, l'instruction BCEAO n° 001-01-2024 encadre les services de paiement dans l'UMOA. La période de mise en conformité a pris fin en mars 2025 : les acteurs sans agrément doivent cesser leur activité.

**Zone CEMAC** (Cameroun, Gabon, Congo, Tchad, Centrafrique, Guinée équatoriale)

- Le règlement n° 02/18/CEMAC/UMAC/CM du 21 décembre 2018 n'interdit pas les transferts, mais exige de justifier leur réalité et leur objet, par l'intermédiaire d'une banque agréée.
- Le seuil de dispense de justificatifs n'a pas pu être confirmé. **À vérifier** dans le règlement et les instructions de la BEAC.

**Autres pays** (Maroc, Tunisie, Algérie, Nigeria, Ghana, Kenya…) : chacun a son propre régime de change. C'est pourquoi l'appli les affiche « bientôt ».

### 2.2 La lutte contre le blanchiment

- L'Union européenne tient une **liste des pays tiers à haut risque**. Depuis le 29 janvier 2026 (règlements délégués 2026/46 et 2026/83), elle comprend notamment **l'Algérie, l'Angola, le Cameroun, la Côte d'Ivoire, la RD Congo, le Kenya, la Namibie et le Soudan du Sud**. Le Burkina Faso, le Mali, le Mozambique, le Nigeria, l'Afrique du Sud et la Tanzanie en ont été retirés.
- Pour toute opération impliquant un pays de cette liste, les établissements européens doivent appliquer une **vigilance renforcée** : origine des fonds, objet de l'opération, contrôles plus poussés. Le Cameroun et la Côte d'Ivoire font partie des pays ouverts dans l'appli : prévois des contrôles plus lourds pour ces deux pays.
- Cette charge de conformité explique pourquoi beaucoup de banques européennes refusent ces flux (on parle de *de-risking*).

### 2.3 Une bonne nouvelle : la parité fixe

Le franc CFA (XOF et XAF), le franc comorien et l'escudo cap-verdien sont liés à l'euro par un taux fixe : 1 € = 655,957 F CFA. Il n'y a donc **pas de risque de change** : le montant reçu est connu au moment de la demande. C'est pour cela que l'appli commence par ces pays.

---

## 3. Côté Europe : quel statut pour CauriPay ?

| Option | Rôle de CauriPay | Exigences principales | Délai |
| --- | --- | --- | --- |
| **A. Prestataire technique** d'un partenaire agréé | Fournit l'appli ; le partenaire signe avec l'utilisateur, encaisse et verse | Contrat de partenariat. Si CauriPay présente le service du partenaire contre rémunération, elle peut devoir s'inscrire comme **IOBSP** (intermédiaire en opérations de banque et en services de paiement) au registre de l'ORIAS. **À vérifier** avec un avocat. | Quelques mois |
| **B. Agent** d'un établissement agréé | Agit au nom du partenaire, qui l'inscrit auprès de l'ACPR (registre REGAFI) | Honorabilité, formation anti-blanchiment, contrôle par le partenaire | 2 à 4 mois |
| **C. Établissement de paiement** agréé par l'ACPR | Fournit lui-même le service | Capital minimum de **20 000 €** pour la seule transmission de fonds (arrêté du 29 octobre 2009, art. 4), dossier d'agrément de 6 à 12 mois, contrôle interne, protection des fonds des clients, dispositif anti-blanchiment complet | 6 à 12 mois |
| **D. Établissement de monnaie électronique** | Tient des soldes « CauriPay » | Capital de 350 000 € et exigences renforcées | Plus d'un an |

**Recommandation : commencer par A, puis passer à B.** CauriPay ne doit **jamais tenir elle-même** de solde. Le « compte CauriPay » et les cartes de l'appli doivent être ouverts chez le partenaire agréé, sous forme de compte de paiement ou de monnaie électronique. Sans cartes, le plus simple est de verser l'argent directement sur le compte bancaire (IBAN) de l'utilisateur. Voir la section 9.

---

## 4. Obligations dès que les transferts sont réels

Elles sont portées surtout par le partenaire agréé, mais l'appli doit lui fournir les bonnes informations et les bons écrans.

### 4.1 Services de paiement : DSP2, puis DSP3 et RSP

- **Information avant paiement** : montant, frais, taux de change, montant payé, délai. *L'écran « Vérifie ta demande » affiche déjà tout cela.*
- **Authentification forte** : l'accès au compte et la validation d'un paiement exigent deux facteurs (par exemple mot de passe + code ou biométrie). Un e-mail et un mot de passe seuls ne suffiront pas. Supabase propose la double authentification par application (TOTP).
- **DSP3 et RSP** : accord politique en novembre 2025, textes approuvés par la commission ECON du Parlement le 5 mai 2026. L'adoption formelle est attendue fin 2026, pour une application environ 21 mois après l'entrée en vigueur, donc **vers mi-2028**. Ils renforcent la lutte contre la fraude et la vérification du bénéficiaire. À anticiper.

### 4.2 Lutte contre le blanchiment et le financement du terrorisme

- Code monétaire et financier, art. L. 561-1 et suivants :
  - identifier et vérifier chaque client (pièce d'identité, selfie, justificatif de domicile) ;
  - surveiller les opérations en continu ;
  - appliquer une vigilance renforcée pour les pays à haut risque ;
  - déclarer les soupçons à **Tracfin** ;
  - conserver les données **5 ans** (art. L. 561-12).
- **Gel des avoirs et sanctions** : vérifier chaque client et chaque expéditeur contre les listes de l'UE, de l'ONU et le registre national des gels (DG Trésor).
- **Règlement (UE) 2024/1624 (AMLR)** : il s'applique directement à partir du **10 juillet 2027** et harmonise ces règles dans toute l'UE, sous la supervision de la nouvelle autorité européenne AMLA.
- **Règlement (UE) 2023/1113 sur les transferts de fonds**, en vigueur depuis le 30 décembre 2024 : le nom et l'identifiant de compte de l'expéditeur doivent accompagner le transfert. Le prestataire du bénéficiaire contrôle ces informations et, **au-delà de 1 000 €**, vérifie l'identité du bénéficiaire avant de créditer. *L'appli collecte déjà le nom, le pays et le numéro de l'expéditeur.*

### 4.3 Résilience numérique : DORA

Le règlement (UE) 2022/2554 s'applique depuis le 17 janvier 2025 aux établissements de paiement. Si CauriPay est leur prestataire technique, le contrat de partenariat contiendra des clauses DORA : sécurité, continuité, audits, notification des incidents.

---

## 5. Données personnelles (RGPD) : à respecter dès maintenant

| Obligation | État |
| --- | --- |
| Politique de confidentialité claire (art. 13), y compris pour les expéditeurs (art. 14) | **Fait** : `legal/confidentialite.html`, plus un message dans la fiche expéditeur. À compléter. |
| Base légale pour chaque usage | **Fait** dans la politique |
| Consentement séparé pour la newsletter, case non cochée | **Fait** à l'inscription |
| Mots de passe conformes à la recommandation CNIL n° 2022-100 (12 caractères de 4 types, ou 14 caractères) | **Fait** : contrôle en direct à l'inscription. À régler aussi dans Supabase. |
| Limitation des tentatives de connexion | **Fait** en mode démo (blocage d'une minute après 5 échecs). Supabase le gère aussi. |
| Droit d'accès et portabilité | **Fait** : « Exporter mes données » |
| Droit à l'effacement | **Fait** : « Supprimer mon compte » (fonction `delete_my_account`) |
| Pas de traceurs soumis à consentement | **Fait** : uniquement du stockage local strictement nécessaire. Les polices sont hébergées avec l'appli, sans appel à Google. |
| Registre des traitements (art. 30) | **À faire** |
| Analyse d'impact (AIPD, art. 35) | **À faire avant les transferts réels** : données financières, surveillance anti-blanchiment, transferts hors UE. Très probablement obligatoire. |
| Délégué à la protection des données (art. 37) | **Probablement obligatoire** en version réelle (surveillance régulière et systématique à grande échelle) |
| Contrats de sous-traitance (art. 28) | **À signer** avec Supabase (choisir une région UE) et le partenaire de paiement |
| Transferts hors UE (chapitre V) | GitHub (États-Unis) ; partenaires africains : clauses contractuelles types ou art. 49. **À documenter.** |
| Lois africaines sur les données | **À vérifier** pour les expéditeurs : par exemple loi n° 2008-12 au Sénégal, loi n° 2013-450 en Côte d'Ivoire, loi n° 2024/017 au Cameroun |

**Minimisation :** CauriPay ne doit **pas** stocker les pièces d'identité. La vérification est confiée au partenaire agréé ou à son prestataire. En démo, aucune donnée d'identité n'est demandée.

---

## 6. Droit de la consommation et du numérique

| Obligation | État |
| --- | --- |
| Mentions légales : éditeur, directeur de publication, hébergeur (LCEN, art. 6) | **Projet fait** : `legal/mentions-legales.html`, à compléter |
| CGU acceptées à l'inscription, case non pré-cochée | **Fait** : `legal/cgu.html`, à compléter |
| Réservé aux majeurs | **Fait** : case « J'ai 18 ans ou plus » |
| Rétractation de 14 jours pour un service financier conclu à distance (Code de la consommation, art. L. 222-7) | **Fait** : bouton « Me rétracter du contrat » dans le profil pendant 14 jours |
| **Fonction de rétractation** en ligne : directive (UE) 2023/2673, applicable depuis le 19 juin 2026, transposée en France par l'ordonnance n° 2026-2 du 5 janvier 2026 (**à vérifier** sur Légifrance) | **Fait** (même bouton). Faire valider l'intitulé exact exigé par l'ordonnance. |
| Résiliation simple, sans frais | **Fait** : « Supprimer mon compte » |
| Médiateur de la consommation (Code de la consommation, art. L. 612-1) | **À faire** : en désigner un et l'indiquer dans les mentions légales et les CGU |
| Transparence des prix | **Fait** : frais, taux et total affichés avant validation. Les frais actuels sont des exemples (`js/config.js`). |
| Prévention des arnaques (« mules » financières) | **Fait** : avertissement et attestation avant chaque demande |
| Accessibilité : directive (UE) 2019/882 et décret n° 2023-931, applicables depuis le 28 juin 2025 ; les services bancaires aux consommateurs sont visés | **Bonnes pratiques en place** : libellés, contrastes, alternative clavier à l'appui long. La directive exempte les microentreprises de services (moins de 10 personnes et 2 M€ de chiffre d'affaires ou de bilan) : **à vérifier** pour la transposition française. Un audit sera nécessaire en version réelle. |

---

## 7. Avant d'ouvrir de vrais transferts

1. **Créer la structure juridique** : société, compte bancaire professionnel, assurance responsabilité civile professionnelle.
2. **Choisir les partenaires** :
   - un établissement agréé en Europe, qui reçoit les fonds et les verse sur un IBAN ;
   - un ou plusieurs agrégateurs agréés en zone UEMOA et CEMAC, qui encaissent en mobile money et sortent les devises par une banque.

   Vérifie pour chacun l'agrément, les pays couverts et la répartition des obligations anti-blanchiment. Exemples d'acteurs à étudier, sans recommandation : agrégateurs de paiement panafricains et réseaux de transfert déjà actifs sur ces pays.
3. **Faire valider par un avocat** le statut de CauriPay (prestataire technique, IOBSP ou agent), les CGU et la politique de confidentialité.
4. **Compléter les champs surlignés** des pages légales, désigner un médiateur et un délégué à la protection des données.
5. **Réaliser l'analyse d'impact (AIPD)** et tenir le registre des traitements.
6. **Activer les vrais comptes** (Supabase, région UE), puis la **double authentification**.
7. **Intégrer l'API du partenaire** à la place de la simulation : création de la demande, page de paiement, statuts, notifications. Dans `js/app.js`, la fonction `simulate()` et la page `vPayer()` sont les deux endroits à remplacer.
8. **Fixer les vrais tarifs et plafonds** avec le partenaire, en tenant compte des seuils de justificatifs de chaque zone (`js/config.js`).
9. **Ajouter les justificatifs** si le partenaire les demande, par exemple un certificat de scolarité pour le motif « Frais de scolarité », transmis directement au partenaire.

---

## 8. Le nom « CauriPay »

Avant d'investir dans la marque (logo, nom de domaine, communication), vérifie que le nom est disponible. Des noms proches existent déjà **dans le même secteur** :

- **Cauri Money** : fintech basée à Dakar, tournée vers la diaspora africaine et les transferts d'argent ;
- **Cauri** : prestataire de paiement britannique, actif dans l'Union européenne.

Le risque est réel, puisqu'il s'agit des mêmes services (paiement, transfert). À faire :

1. Rechercher les marques existantes sur [INPI](https://data.inpi.fr) (France), [EUIPO](https://euipo.europa.eu/eSearch) (Union européenne) et [OAPI](https://www.oapi.int) (17 pays d'Afrique francophone, dont la zone UEMOA et la CEMAC).
2. Si le nom est libre, déposer la marque dans les classes 36 (services financiers) et 9 (logiciels et applications), au moins en France ou dans l'UE, et à l'OAPI.
3. Sinon, choisir un autre nom tant que l'appli n'est pas encore connue.

---

## 9. Cartes CauriPay et paiement sans contact

### 9.1 Qui peut émettre une carte

Émettre une carte de paiement est un service de paiement réglementé : c'est l'émission d'instruments de paiement (Code monétaire et financier, art. L. 314-1). Il faut :
- un établissement agréé (banque, établissement de paiement ou de monnaie électronique) ;
- membre d'un réseau de cartes comme Visa ou Mastercard, ou parrainé par un membre.

La voie réaliste est un partenaire de **« banque en marque blanche »** (*Banking as a Service*), qui fournit le compte, les cartes et la conformité. CauriPay en est le distributeur ou l'agent. Exemples d'acteurs à étudier en France, sans recommandation : Swan, Treezor.

**Marques :** ne pas afficher les logos Visa ou Mastercard sans l'accord du réseau. La démo affiche seulement « DÉMO ».

### 9.2 Ce que la loi impose, et ce que la démo simule déjà

| Règle | Dans l'appli |
| --- | --- |
| Identité vérifiée avant toute émission (lutte contre le blanchiment) | **Simulé** : vérification d'identité obligatoire avant la création |
| Personnes majeures, contrat de carte accepté | **Fait** : case à cocher et section 9 des CGU |
| Authentification forte (règlement délégué (UE) 2018/389) pour créer une carte et en afficher le numéro | **Simulé** : mot de passe demandé. En réel, il faut un second facteur (code, biométrie). |
| Paiements en ligne validés par 3-D Secure | **Simulé** : validation dans l'appli à chaque achat |
| Sans contact : authentification au-delà de 50 € par paiement, de 150 € cumulés ou de 5 paiements d'affilée (article 11 du même règlement) | **Simulé** : les trois seuils sont appliqués |
| Numéro et cryptogramme jamais stockés ni transmis par CauriPay (norme **PCI DSS**) | **À faire en réel** : afficher ces infos dans le cadre sécurisé de l'émetteur (iframe ou SDK, lien à usage unique). En démo, le numéro est faux (préfixe 0000). |
| Opposition possible à tout moment (CMF, art. L. 133-17) | **Fait** : bouton « Opposition », définitif. Prévoir aussi un numéro d'urgence 24 h/24. |
| Responsabilité du client limitée à 50 € avant opposition, aucune après (CMF, art. L. 133-19 et L. 133-20) | **Fait** : rappel dans l'appli et les CGU |
| Plafonds et usages réglables, gel temporaire | **Fait** |
| Transparence des frais | **Fait** : « Gratuite (démonstration) » affiché à la création. Grille réelle à définir. |

### 9.3 Payer avec le téléphone

1. **Apple Pay et Google Pay.** C'est la voie classique : l'émetteur ajoute la carte au portefeuille du téléphone par **tokenisation**. Le vrai numéro est remplacé par un numéro de substitution propre à l'appareil (services Visa Token Service ou Mastercard MDES). L'ajout depuis l'appli exige une **application native** et, chez Apple, une autorisation spécifique (*In-App Provisioning*). Les paiements par téléphone sont validés par Face ID, une empreinte ou un code : ils échappent donc au plafond de 50 €.
2. **Un « CauriPay Pay » maison, comme Apple Pay.** Depuis iOS 17.4, Apple autorise dans l'Espace économique européen des applications tierces à payer en NFC (technologie HCE). Il faut pour cela :
   - être établi dans l'EEE et inscrit comme organisation au programme développeur d'Apple ;
   - respecter PCI DSS et les certifications EMVCo ;
   - travailler avec un prestataire de paiement agréé ;
   - obtenir l'autorisation d'Apple, accordée au cas par cas ([Apple](https://developer.apple.com/support/hce-transactions-in-apps)).

   Sur Android, la même technologie est ouverte. C'est un projet de long terme, pour une application native.
3. **Une application web**, comme la version actuelle, **ne peut pas** utiliser la puce NFC pour payer. Le sans contact est donc simulé.

### 9.4 Modèle économique

Dans l'Union européenne, la commission d'interchange perçue sur chaque paiement par carte de particulier est plafonnée à **0,2 %** (débit) et **0,3 %** (crédit) par le règlement (UE) 2015/751. Une carte rapporte donc peu par paiement : à intégrer dans le plan d'affaires.

---

## 10. Pays de résidence et monnaies

L'appli affiche tous les montants dans la monnaie du pays de résidence choisi par l'utilisateur. Elle couvre 32 pays :
- la zone euro, soit 21 pays, dont la Bulgarie depuis le 1er janvier 2026 ;
- le Danemark, la Hongrie, la Pologne, la Roumanie, la Suède et la Tchéquie ;
- l'Islande, le Liechtenstein et la Norvège ;
- le Royaume-Uni et la Suisse.

| Point | Ce qu'il faut savoir | Dans l'appli |
| --- | --- | --- |
| Conversion F CFA → euro | Parité fixe : 1 € = 655,957 F CFA | Appliquée |
| Conversion euro → autre monnaie | Taux de référence de la BCE du jour | Taux enregistré dans `data/taux.json`, mis à jour chaque jour ouvré par la mise en ligne |
| Transparence des frais de conversion | Le règlement (UE) 2019/518, qui modifie le règlement 924/2009, impose d'exprimer les frais de conversion comme une **marge en pourcentage par rapport au taux de référence de la BCE**, communiquée avant l'opération | La démo affiche « taux BCE, sans marge ». En réel, afficher la marge exacte du partenaire. |
| Seuils légaux en euros | Sans contact (50 € et 150 €), règlement sur les transferts de fonds (1 000 €) | Comparaison faite en euros ; montants affichés convertis |
| Royaume-Uni et Suisse | Hors de l'Espace économique européen : l'agrément européen (« passeport ») ne s'y applique pas | **À prévoir :** un partenaire agréé localement (FCA au Royaume-Uni, FINMA en Suisse) et les règles locales, sans contact compris |
| Changement de pays | Les montants déjà saisis ne sont pas convertis | L'appli prévient avant de changer |

---

## 11. Pilote Burkina Faso : analyse de la proposition reçue

Une proposition de montage pour un premier test au Burkina Faso a été étudiée en octobre 2026. Ce qu'il faut en retenir :

**1. Moyens de paiement : à garder.** Orange Money, Moov Money et Wave sont bien présents. Wave est installé au Burkina depuis 2021. Telecel Money et Sank Money sont aussi utilisés. Les cinq sont proposés dans l'appli pour le Burkina.

**2. Agrégateurs : à vérifier un par un.**
- **Existent bien :** LigdiCash, YengaPay, Kkiapay et CinetPay. La page de paiement de YengaPay liste Orange, Moov, Telecel et Sank, mais pas Wave.
- **Introuvables, à ne pas retenir :** « LigdyPay » (probablement une confusion avec LigdiCash), « Kaybic Africa » et « E-Pay Burkina ».
- **Agrément BCEAO :** pour chacun, le vérifier sur la [liste officielle de la Commission bancaire de l'UMOA](https://www.cb-umoa.org/sites/default/files/_Liste%20EME%20ET%20EP%20Burkina_2026.pdf). D'après l'extrait consulté au 29 juin 2026, sont agréés au Burkina : InTouch Burkina et Kerry Payments Burkina (établissements de paiement), et Orange Money Burkina (établissement de monnaie électronique). **À vérifier.**
- **Usage du compte :** un compte marchand d'agrégateur sert à vendre des biens ou des services. L'utiliser pour encaisser des transferts d'argent doit être déclaré et accepté par l'agrégateur.

**3. Décret « étudiants » : réel, mais mal interprété.**
- Le décret existe. Adopté en Conseil des ministres le 25 juin 2026, il oblige tout étudiant burkinabè à obtenir une autorisation du ministère de l'Enseignement supérieur avant d'étudier à l'étranger, sous peine de non-reconnaissance du diplôme.
- En revanche, rien n'en fait un justificatif de change « imparable ». Les pièces citées pour l'aide aux étudiants dans l'UEMOA sont :
  - le titre de séjour ou le certificat de résidence ;
  - les pièces justifiant les dépenses (scolarité, loyer) ;
  - le formulaire de change.
- **Dans l'appli :** quand le motif est « frais d'études », l'appli liste les pièces à préparer. Pour le Burkina, elle mentionne aussi l'autorisation ministérielle.
- **Pas de téléversement obligatoire, pour deux raisons :**
  - cela ne concerne que les étudiants burkinabè ;
  - ces documents doivent être collectés par la banque ou le partenaire agréé, pas stockés par CauriPay (minimisation des données, RGPD).

**4. Montage « compte de transit » : bloquant en l'état.** Le schéma proposé est le suivant :
1. l'argent arrive en F CFA sur un compte marchand de CauriPay au Burkina ;
2. le serveur de CauriPay crédite aussitôt l'étudiant en euros, chez Swan ou Treezor.

Il pose trois problèmes :
- **CauriPay ferait elle-même de la transmission de fonds**, dans les deux zones et sans agrément. C'est le point interdit identifié en section 1.
- **Le schéma ne dit pas comment les F CFA sortent du Burkina.** Une sortie de devises de l'UEMOA passe par une banque agréée, avec justificatifs. Créditer l'étudiant en euros avec d'autres fonds pendant que les F CFA restent au Burkina s'apparente à une **compensation**, que la réglementation des changes encadre strictement. **À vérifier avec un avocat local.**
- **Alimenter les comptes des clients avec les fonds de CauriPay** est aussi une activité de paiement réglementée.

Deux montages conformes possibles :
- **Le montage cible :** un **partenaire agréé qui opère le couloir UEMOA → Europe**. Il encaisse au Burkina (directement ou via un agrégateur agréé), fait sortir les devises par sa banque correspondante, puis crédite le compte du client en Europe. CauriPay reste l'interface, et éventuellement l'agent.
- **Le plus simple pour un test :** la famille fait un **virement international** depuis sa banque au Burkina, avec les justificatifs, vers l'IBAN de l'étudiant. CauriPay prépare la demande, liste les pièces à fournir et suit l'arrivée.

**5. Envoi du lien par WhatsApp (Twilio) : possible.** Il faut un compte WhatsApp Business, des modèles de messages validés par WhatsApp, l'accord des destinataires et un contrat de sous-traitance RGPD.

---

## Sources consultées (octobre 2026)

- PSD3 et RSP, calendrier : [Clifford Chance, avril 2026](https://www.cliffordchance.com/content/dam/cliffordchance/briefings/2026/04/impact-of-psd3-are-you-ready.pdf) · [Adyen](https://www.adyen.com/en_AE/knowledge-hub/psd3) · [fintech.global, août 2026](https://fintech.global/2026/08/14/psd3-is-coming-is-your-payments-licence-ready-for-2028/)
- BCEAO, services de paiement : [Instruction n° 001-01-2024](https://bceao.int/sites/default/files/inline-files/Instruction-No001-01-2024_relative_aux_services_de_paiement_dans_l-UMOA.pdf) · [Avis n° 004-03-2025, fin de la période transitoire](https://downloads.bceao.int/sites/default/files/2025-04/AVIS%20N%C2%B0%20004-03-2025%20relatif%20%C3%A0%20la%20fin%20de%20la%20p%C3%A9riode%20transitoire%20de%20mise%20en%20conformit%C3%A9%20aux%20dispositions%20de%20l%27instruction%20n%C2%B0001-01-2024.pdf)
- UEMOA, relations financières extérieures : [Financial Afrik, règlement 06/2024](https://www.financialafrik.com/2026/03/24/reglement-06-2024-uemoa-ce-qui-change-vraiment-pour-les-banques-et-les-entreprises/) · [Alliance solidaire, instruction de 2025](https://alliancesolidaire.org/2026/05/07/union-economique-et-monetaire-ouest-africaine-la-france-attentive-aux-nouvelles-regles-de-transferts-de-fonds-imposees-par-la-bceao/) · [Règlement 09/2010 (ancien)](https://www.vie-publique.sn/documents/11024/reglement-092010cmuemoa-relations-financieres-exterieures-uemoa)
- CEMAC : [Règlement 02/18/CEMAC/UMAC/CM (BEAC)](https://www.beac.int/wp-content/uploads/2020/06/REGLEMENT-02-18-CEMAC-UMAC-CM_001.pdf) · [Transferts depuis la CEMAC, avocat.fr](https://consultation.avocat.fr/blog/axel-mayombo/article-2983508-transferts-en-devises-depuis-la-zone-cemac-comprendre-les-difficultes-et-mieux-preparer-son-dossier.html)
- Liste UE des pays à haut risque : [Bird & Bird, 2026](https://cm.twobirds.com/en/insights/2026/eu-list-of-highrisk-countries-and-jurisdictions-for-money-laundering-and-terrorism-financing-amended) · [FIAU Malta](https://fiaumalta.org/news/eu-commission-delegated-acts-on-high-risk-third-countries/) · [Commission européenne](https://finance.ec.europa.eu/node/199_en)
- Règlement 2023/1113, article 7 : [Springlex](https://www.springlex.eu/fr/packages/aml/tfr-regulation/article-7/)
- Fonction de rétractation : [HLC, transposition française](https://hlc.com/fr/publications/transposition-under-french-law-of-the-eu-mandatory-withdrawal-button-for-online-sales) · [iubenda](https://www.iubenda.com/fr/blog/la-nouvelle-fonction-de-retractation-en-ligne-ce-que-signifie-la-directive-ue-2023-2673-pour-votre-entreprise/)
- Mots de passe : [Clubic, recommandation CNIL 2022](https://www.clubic.com/pro/it-business/securite-et-donnees/actualite-442581-mots-de-passe-la-cnil-fait-ses-recommandations-etes-vous-dans-les-clous.html) · [Solutions numériques](https://www.solutions-numeriques.com/juridique-mots-de-passe-quelles-recommandations-de-la-cnil)
- Établissement de paiement, capital : [Crassula, guide 2026](https://crassula.io/fr/guides/comment-creer-une-entreprise-de-transfert-dargent/) · [ACPR, sécurité des paiements](https://acpr.banque-france.fr/system/files/import/acpr/medias/documents/jch_20180403_conference_securite_des_paiements.pdf)
- Cartes et sans contact : [Apple, transactions NFC HCE dans l'EEE](https://developer.apple.com/support/hce-transactions-in-apps) · [Commission européenne, engagements d'Apple sur le NFC (2024)](https://ec.europa.eu/commission/presscorner/api/files/document/print/fin/ip_24_3706/IP_24_3706_EN.pdf) · [Selectra, plafonds du sans contact](https://selectra.info/finance/actualites/marche/sans-contact-refuse-paiement-telephone-passe) · [Reap, affichage sécurisé des cartes](https://docs.reap.global/cards/secure-display) · [Lithic, affichage du numéro et du cryptogramme](https://docs.lithic.com/docs/quick-start-card-ui)
- Monnaies : [Taux de référence de la BCE](https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml) · [Règlement 2021/1230 (frais de conversion, EUR-Lex)](https://eur-lex.europa.eu/eli/reg/2021/1230/oj/fra) · [Banque de France, Bulgarie dans la zone euro](https://www.banque-france.fr/fr/communiques-de-presse/la-bulgarie-adherera-la-zone-euro-le-1er-janvier-2026)
- Burkina Faso : [allAfrica, décret sur les études à l'étranger](https://fr.allafrica.com/stories/202606260536.html) · [Capmad](https://www.capmad.com/article/burkina-faso-un-decret-impose-une-autorisation-ministerielle-pour-tout-projet-detudes-a-letranger) · [Burkina24, Wave et Orabank](https://burkina24.com/2026/07/15/burkina-faso-largent-circule-desormais-plus-facilement-entre-wave-et-orabank/) · [YengaPay](https://yengapay.com/) · [Kkiapay](https://kkiapay.me/?lang=en) · [We Are Tech, LigdiCash](https://www.wearetech.africa/fr/fils/solutions/burkina-faso-ligdicash-facilite-les-paiements-en-ligne) · [Liste EME et EP Burkina 2026](https://www.cb-umoa.org/sites/default/files/_Liste%20EME%20ET%20EP%20Burkina_2026.pdf)
- Accessibilité : [DGCCRF](https://www.economie.gouv.fr/node/3235045) · [Qualibooth, décret 2023-931](https://www.qualibooth.com/accessibility/compliance/europe/france---decree-number-2023-931)
