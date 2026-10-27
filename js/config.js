/* Réglages de CauriPay. C'est le seul fichier à modifier pour brancher les services en ligne. */
// Mode test (émulateur) : « ?test » dans l'adresse → données rangées à part (préfixe cptest_),
// jamais mélangées aux tiennes, et toujours en mode démo.
window.CAURIPAY_NS = /[?&]test(=|&|$)/.test(location.search) ? "cptest_" : "cauripay_";

window.CAURIPAY_CONFIG = {
  // Comptes et synchronisation avec Supabase (voir README, « Activer les vrais comptes »).
  // Laisse vide pour le mode démo : les comptes et les données restent dans le navigateur de l'appareil.
  supabaseUrl: "",      // ex. "https://abcdefgh.supabase.co"
  supabaseAnonKey: "",  // clé « anon public » (Project Settings → API). Elle peut être publique.

  // Réception d'argent depuis l'Afrique.
  // "demo" = simulation, aucun argent ne circule. Le mode réel demande un partenaire agréé (voir docs/CONFORMITE.md).
  transferMode: "demo",
  transferFeePct: 0.015,     // frais d'exemple : 1,5 % du montant reçu…
  transferFeeMin: 1,         // … avec un minimum de 1 €
  transferMax: 1000,         // plafond par demande, en euros (exemple, à fixer avec le partenaire)
  transferMonthlyMax: 3000,  // plafond par mois, en euros (exemple)
  requestValidityDays: 7     // une demande non payée expire après ce délai
};
