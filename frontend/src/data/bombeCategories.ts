import { Card } from "@/src/types";

// Fallback gage when a "bombe" card has no gage set in Airtable.
export const DEFAULT_BOMBE_GAGE = "Prends une gorgée 🍺";
export const DEFAULT_BOMBE_ALT =
  "Relève un mini-défi choisi par le groupe (ou 10 pompes) 💪";

// Built-in categories so La Bombe is always playable, even before any
// "bombe" card is added in Airtable. Intensité pilots the escalation.
const CATS: { t: string; i: number }[] = [
  { t: "Cite une marque de fringues", i: 1 },
  { t: "Un prénom qui commence par S", i: 1 },
  { t: "Une marque de voiture", i: 1 },
  { t: "Un pays d'Europe", i: 1 },
  { t: "Un dessin animé de ton enfance", i: 1 },
  { t: "Une boisson qu'on commande en soirée", i: 1 },
  { t: "Un métier de rêve", i: 2 },
  { t: "Une excuse bidon pour rentrer plus tôt", i: 2 },
  { t: "Un truc qu'on trouve toujours dans un frigo", i: 2 },
  { t: "Une appli sur ton téléphone", i: 2 },
  { t: "Un film qu'on peut regarder 1000 fois", i: 2 },
  { t: "Une chanson à reprendre en chœur", i: 2 },
  { t: "Un red flag en soirée", i: 3 },
  { t: "Un truc qu'on a tous déjà googlé en secret", i: 3 },
  { t: "Un surnom ridicule pour un ex", i: 3 },
  { t: "Une manie un peu chelou", i: 3 },
  { t: "Un petit mytho qu'on a tous déjà sorti", i: 3 },
  { t: "Un truc qu'on cache à ses parents", i: 4 },
  { t: "Une pire idée à 3h du mat", i: 4 },
  { t: "Un endroit insolite pour un date", i: 4 },
  { t: "Un truc qu'on a déjà fait un peu éméché", i: 4 },
  { t: "Une réplique de drague qui tue", i: 5 },
  { t: "Un truc qu'on n'avouerait jamais sobre", i: 5 },
  { t: "Une bêtise dont on n'est pas fier", i: 5 },
];

export function buildDefaultBombeDeck(count = 14): Card[] {
  const shuffled = [...CATS].sort(() => Math.random() - 0.5).slice(0, count);
  return shuffled.map((c, idx) => ({
    id: `bombe-default-${idx}-${c.t.slice(0, 8)}`,
    mode: "bombe" as const,
    texte: c.t,
    gage: DEFAULT_BOMBE_GAGE,
    alternative: DEFAULT_BOMBE_ALT,
    intensite: c.i,
    tags_theme: [],
    packs: [],
    premium: false,
    age18: c.i >= 4,
    actif: true,
    source: "builtin",
    version: 1,
  }));
}
