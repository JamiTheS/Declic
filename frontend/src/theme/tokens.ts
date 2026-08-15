// ============================================================================
// Déclic — Design tokens · "Dark Editorial" art direction
// Discipline chromatique : châssis encre + crème chaud + UN accent signature
// (terracotta) ; la couleur du mode n'est qu'un ACCENT (icône, liseré, jauge),
// jamais un aplat plein écran. Zéro néon, zéro glow.
// ============================================================================

export const FONTS = {
  display: "ClashDisplay-Bold",
  displaySemi: "ClashDisplay-Semibold",
  displayMed: "ClashDisplay-Medium",
  body: "Satoshi-Medium",
  bodyBold: "Satoshi-Bold",
  bodyRegular: "Satoshi-Regular",
  bodyBlack: "Satoshi-Black",
};

export const TYPE = {
  sm: 13,
  base: 17,
  lg: 22,
  xl: 32,
  "2xl": 48,
};

export const SPACING = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
  "3xl": 64,
};

export const RADIUS = {
  sm: 12,
  md: 18,
  lg: 26,
  pill: 999,
};

// Warm near-black used as the fixed "ink".
export const INK = "#0B0B0E";

// Signature accent (terracotta) — the single brand colour.
export const ACCENT = "#E8654F";

export const DARK = {
  isDark: true,
  surface: "#0B0B0E",
  surfaceSecondary: "#151419",
  surfaceTertiary: "#201E26",
  onSurface: "#F4F1EA",          // warm cream (not pure white)
  onSurfaceSecondary: "#CFCAD6",
  onSurfaceTertiary: "#CFCAD6",
  muted: "#7C7887",
  faint: "#4A4753",
  brand: ACCENT,
  onBrand: "#160D0A",            // ink text on terracotta (editorial)
  brandSoft: "rgba(232,101,79,0.14)",
  success: "#4CB782",
  warning: "#E0A458",
  error: "#E5484D",
  border: "#232028",
  borderStrong: "#332F3B",
  overlay: "rgba(244,241,234,0.06)",
  overlayBorder: "rgba(244,241,234,0.12)",
};

export const LIGHT = {
  isDark: false,
  surface: "#FAF8F3",            // warm off-white
  surfaceSecondary: "#FFFFFF",
  surfaceTertiary: "#F1ECE2",
  onSurface: "#1A1720",
  onSurfaceSecondary: "#3A3542",
  onSurfaceTertiary: "#3A3542",
  muted: "#6B6675",
  faint: "#B4AEA2",
  brand: "#C6553E",              // slightly deeper terracotta for light bg
  onBrand: "#FFFFFF",
  brandSoft: "rgba(198,85,62,0.12)",
  success: "#2E9E6B",
  warning: "#B9803A",
  error: "#D3423F",
  border: "#E7E1D6",
  borderStrong: "#D6CFC1",
  overlay: "rgba(26,23,32,0.05)",
  overlayBorder: "rgba(26,23,32,0.12)",
};

export type Colors = typeof DARK;

// Intensity thermometer scale (1 → 5) — cool sage to warm terracotta, no neon.
export const INTENSITY_COLORS: Record<number, string> = {
  1: "#6FB79B",
  2: "#A8C08A",
  3: "#E0A458",
  4: "#E8654F",
  5: "#D14D5E",
};

// Refined, cohesive jewel-tone accent per mode (used as ACCENT only).
export const MODE_META: Record<
  string,
  { label: string; short: string; color: string; onColor: string; icon: string }
> = {
  "qui-est-le-plus": { label: "Qui est le plus…", short: "QUI EST LE PLUS", color: "#7E8CE0", onColor: "#0B0B0E", icon: "account-group" },
  "je-nai-jamais": { label: "Je n'ai jamais", short: "JE N'AI JAMAIS", color: "#4FB0A5", onColor: "#0B0B0E", icon: "hand-back-left" },
  "action-verite": { label: "Action ou Vérité", short: "ACTION OU VÉRITÉ", color: "#E8654F", onColor: "#160D0A", icon: "dice-5" },
  "cash-ou-cash": { label: "Cash ou Cash", short: "CASH OU CASH", color: "#E0A458", onColor: "#160D0A", icon: "cards" },
  "le-verdict": { label: "Le Verdict", short: "LE VERDICT", color: "#6C6FD6", onColor: "#0B0B0E", icon: "gavel" },
  "tu-me-connais": { label: "Tu me connais ?", short: "TU ME CONNAIS", color: "#C77D9E", onColor: "#160D0A", icon: "account-heart" },
  "hot": { label: "Hot / Intime", short: "HOT · INTIME", color: "#D14D5E", onColor: "#160D0A", icon: "fire" },
  "bombe": { label: "La Bombe", short: "LA BOMBE", color: "#F2762E", onColor: "#160D0A", icon: "bomb" },
  "confession": { label: "Confessions", short: "CONFESSIONS", color: "#7A5EA8", onColor: "#F4F1EA", icon: "incognito" },
};

// Short "how to play" notice per game mode — shown via the in-game (?) button.
export const HOW_TO_PLAY: Record<string, string> = {
  "qui-est-le-plus":
    "Lis la question à voix haute. À 3, tout le monde pointe la personne qui correspond le plus. La plus désignée assume le gage (ou son alternative sans alcool).",
  "je-nai-jamais":
    "Lis l'affirmation. Tous ceux qui l'ont déjà fait boivent une gorgée — ou révèlent un secret de plus en mode sans alcool.",
  "action-verite":
    "La personne visée choisit : elle réalise l'Action, ou répond en toute honnêteté à la Vérité. Elle refuse ? C'est gage.",
  "cash-ou-cash":
    "Un dilemme, deux options. La personne visée doit trancher et justifier son choix. Pas de réponse neutre !",
  "le-verdict":
    "Une personne passe au centre. En secret, chacun la note de 0 à 10 sur la question. On révèle la moyenne — surprises garanties.",
  "tu-me-connais":
    "Deux joueurs s'affrontent : l'un devine la réponse de l'autre. Bonne réponse = point. Sinon, gage.",
  "hot":
    "Contenu intime et suggestif, réservé aux majeurs. Ose, ou passe la carte. On reste dans l'allusion, jamais l'explicite.",
  "bombe":
    "Une catégorie s'affiche. Passez-vous le tél en donnant chacun une réponse à voix haute, puis tapez pour passer. Un minuteur caché finit par exploser : qui tient le tél au BOOM prend le gage.",
  "confession":
    "Chacun écrit une confession en secret, à tour de rôle. L'app les mélange et les affiche une par une : le groupe devine qui l'a écrite, puis l'auteur est révélé. 100% privé, rien n'est enregistré.",
  "soiree":
    "Laisse-toi porter : l'app enchaîne les jeux et monte l'ambiance toute seule. Tape l'écran pour avancer, « Passer » pour zapper une carte.",
};

/**
 * Palette for the full-screen game card. In the editorial direction the card
 * background is the uniform theme surface (ink or cream); the mode colour is
 * surfaced only through accents (tag, progress, thermometer, CTA).
 */
export function modePalette(mode: string, colors: Colors = DARK) {
  const meta = MODE_META[mode] || MODE_META["action-verite"];
  return {
    color: meta.color,                 // mode accent
    onAccent: meta.onColor,            // readable text ON the accent
    base: colors.surface,              // uniform card background
    fg: colors.onSurface,              // primary text (cream / ink)
    muted: colors.muted,
    faint: colors.faint,
    overlay: colors.surfaceSecondary,  // chips / boxes sit on elevated surface
    overlayBorder: colors.border,
    chipBg: colors.surfaceSecondary,
    accentSoft: hexAlpha(meta.color, colors.isDark ? 0.16 : 0.14),
    onDark: colors.isDark,
  };
}

export type ModePalette = ReturnType<typeof modePalette>;

// Small helper: apply alpha to a #RRGGBB hex.
export function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const HEALTH_MSG =
  "L'abus d'alcool est dangereux pour la santé, à consommer avec modération.";
