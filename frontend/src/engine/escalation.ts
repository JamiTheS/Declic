import { Card, Ambiance } from "@/src/types";

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const AMBIANCE_MAX: Record<Ambiance, number> = {
  chill: 2,
  standard: 3,
  chaud: 4,
};

// Modes that run as a self-contained round on their own screen (secret reveal,
// collection or voting phases). They are never dealt into a card deck.
const STANDALONE_MODES = new Set(["confession", "imposteur"]);

/**
 * The "DJ" — builds the auto-escalation sequence for the "Soirée Déclic" mode.
 * Starts federating (level 1-2), ramps intensity every ~4 cards, never repeats
 * the same mode twice in a row. Premium cards stay in the deck and are gated at
 * play-time by the paywall.
 */
export function buildSoiree(
  all: Card[],
  opts: { ambiance: Ambiance; count?: number; isPremium?: boolean } = { ambiance: "standard" }
): Card[] {
  const maxIntensity = AMBIANCE_MAX[opts.ambiance] ?? 3;
  const count = opts.count ?? 28;
  // Free players never see premium cards, so a launched game is never
  // interrupted by a paywall. Premium is discovered on the hub / launch screen.
  // "confession" and "imposteur" are excluded — each needs its own multi-phase
  // round (dedicated screen) and must never be rendered by the standard card
  // renderer.
  const pool = shuffle(
    all.filter(
      (c) => c.actif && !STANDALONE_MODES.has(c.mode) && (opts.isPremium || !c.premium)
    )
  );
  const used = new Set<string>();
  const deck: Card[] = [];
  let lastMode: string | null = null;

  for (let i = 0; i < count; i++) {
    const level = Math.min(maxIntensity, 1 + Math.floor(i / 4));

    let cands = pool.filter(
      (c) => !used.has(c.id) && c.intensite === level && c.mode !== lastMode
    );
    if (cands.length === 0)
      cands = pool.filter(
        (c) =>
          !used.has(c.id) &&
          Math.abs(c.intensite - level) <= 1 &&
          c.mode !== lastMode
      );
    if (cands.length === 0)
      cands = pool.filter((c) => !used.has(c.id) && c.mode !== lastMode);
    if (cands.length === 0) cands = pool.filter((c) => !used.has(c.id));
    if (cands.length === 0) break;

    const pick = cands[0];
    used.add(pick.id);
    deck.push(pick);
    lastMode = pick.mode;
  }
  return deck;
}

/**
 * Deck for a single explicitly-chosen mode. When the player picks a mode on
 * purpose (e.g. Hot/Intime), we do NOT cap by ambiance intensity — the ambiance
 * curve only drives the "Soirée Déclic" escalation. Premium cards are still
 * filtered out for non-subscribers, and an optional theme pack can narrow it.
 */
export function buildModeDeck(
  all: Card[],
  mode: string,
  opts: { ambiance: Ambiance; pack?: string | null; isPremium?: boolean } = { ambiance: "standard" }
): Card[] {
  let cards = all.filter(
    (c) => c.actif && c.mode === mode && (opts.isPremium || !c.premium)
  );
  if (opts.pack && opts.pack !== "general") {
    cards = cards.filter((c) => c.tags_theme.includes(opts.pack as string));
  }
  return shuffle(cards);
}
