import { Card } from "@/src/types";

// Minimal embedded fallback pack (offline / cold-start safety net).
// The full catalog is fetched from the backend and cached; this is the
// "base pack" shipped with the app so a party never dead-ends without network.
export const SEED_CARDS: Card[] = [
  { id: "s1", mode: "qui-est-le-plus", texte: "…de survivre le plus longtemps dans une apocalypse zombie ?", intensite: 1, gage: "Bois une gorgée", alternative: "Fais 10 pompes", tags_theme: ["general"], premium: false, age18: false, actif: true, version: 1 },
  { id: "s2", mode: "qui-est-le-plus", texte: "…de pleurer devant une pub émouvante ?", intensite: 1, gage: "Bois une gorgée", alternative: "Bois une gorgée de soft", tags_theme: ["general"], premium: false, age18: false, actif: true, version: 1 },
  { id: "s3", mode: "qui-est-le-plus", texte: "…de textoter son ex à 3h du matin ?", intensite: 2, gage: "Bois une gorgée", alternative: "Révèle un secret de plus", tags_theme: ["general"], premium: false, age18: false, actif: true, version: 1 },
  { id: "s4", mode: "je-nai-jamais", texte: "Je n'ai jamais fait semblant d'aimer un cadeau.", intensite: 1, gage: "Bois une gorgée", alternative: "Bois une gorgée de soft", tags_theme: ["general"], premium: false, age18: false, actif: true, version: 1 },
  { id: "s5", mode: "je-nai-jamais", texte: "Je n'ai jamais stalké quelqu'un sur les réseaux plus d'une heure.", intensite: 2, gage: "Bois une gorgée", alternative: "Révèle un secret de plus", tags_theme: ["general"], premium: false, age18: false, actif: true, version: 1 },
  { id: "s6", mode: "action-verite", variante: "action", texte: "Imite la personne à ta droite jusqu'à ce qu'on devine qui c'est.", intensite: 1, gage: "Bois une gorgée", alternative: "Parle avec un accent ridicule pendant 2 tours", tags_theme: ["general"], premium: false, age18: false, actif: true, version: 1 },
  { id: "s7", mode: "action-verite", variante: "verite", texte: "Quel compliment aimerais-tu recevoir plus souvent ?", intensite: 2, gage: "Bois une gorgée", alternative: "Révèle un secret de plus", tags_theme: ["general"], premium: false, age18: false, actif: true, version: 1 },
  { id: "s8", mode: "cash-ou-cash", texte: "Ta plus grande fierté cachée ?", texte_b: "Le truc le plus gênant de ton année ?", intensite: 2, gage: "Bois une gorgée", alternative: "Révèle un secret de plus", tags_theme: ["general"], premium: false, age18: false, actif: true, version: 1 },
  { id: "s9", mode: "cash-ou-cash", texte: "La dernière fois que tu as pleuré ?", texte_b: "La dernière fois que tu as menti à un pote ?", intensite: 2, gage: "Bois une gorgée", alternative: "Révèle un secret de plus", tags_theme: ["general"], premium: false, age18: false, actif: true, version: 1 },
  { id: "s10", mode: "le-verdict", texte: "Est-ce que {J} finira marié(e) en premier du groupe ?", intensite: 3, gage: "Bois une gorgée", alternative: "Révèle un secret de plus", tags_theme: ["general"], premium: true, age18: false, actif: true, version: 1 },
  { id: "s11", mode: "tu-me-connais", texte: "Quelle est la plus grande peur de {B} ?", intensite: 3, gage: "Bois une gorgée", alternative: "Révèle un secret de plus", tags_theme: ["general"], premium: true, age18: false, actif: true, version: 1 },
];
