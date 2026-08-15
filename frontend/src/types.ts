export type GameMode =
  | "qui-est-le-plus"
  | "je-nai-jamais"
  | "action-verite"
  | "cash-ou-cash"
  | "le-verdict"
  | "tu-me-connais"
  | "hot"
  | "bombe"
  | "confession";

export type Card = {
  id: string;
  mode: GameMode;
  texte: string;
  texte_b?: string | null;
  variante?: "action" | "verite" | null;
  vibe?: string | null;
  gage: string;
  alternative: string;
  intensite: number; // 1..5
  tags_theme: string[];
  packs?: string[];
  premium: boolean;
  age18: boolean;
  actif: boolean;
  source?: string;
  airtable_id?: string | null;
  version: number;
};

export type Pack = {
  id: string;
  label: string;
  count: number;
  premium: boolean;
};

export type Preset = {
  id: string;
  label: string;
  count: number;
  premium: boolean;
  hot: boolean;
};

export type Vibe = {
  id: string;
  label: string;
  count: number;
  hot: boolean;
};

export type Player = {
  id: string;
  name: string;
  emoji: string;
};

export type Ambiance = "chill" | "standard" | "chaud";
