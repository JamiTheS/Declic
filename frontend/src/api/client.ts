import { Card, Pack, Preset, Vibe } from "@/src/types";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export type CatalogResponse = {
  version: number;
  count: number;
  cards: Card[];
  packs: Pack[];
  presets: Preset[];
  vibes: Vibe[];
  synced_at: string;
};

export async function fetchCatalog(): Promise<CatalogResponse> {
  const res = await fetch(`${BASE}/api/catalog`);
  if (!res.ok) throw new Error(`Catalog fetch failed: ${res.status}`);
  return res.json();
}

export async function logEvent(name: string, props: Record<string, unknown> = {}) {
  try {
    await fetch(`${BASE}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, props }),
    });
  } catch {
    // analytics are best-effort, never block gameplay
  }
}

// ----------------------------- Admin / content management -----------------------------

const authHeaders = (token: string) => ({
  "Content-Type": "application/json",
  "X-Admin-Token": token,
});

export type AdminSummary = {
  total: number;
  manual: number;
  premium: number;
  by_mode: Record<string, number>;
  catalog_version: number;
};

export async function verifyAdmin(token: string): Promise<boolean> {
  const res = await fetch(`${BASE}/api/admin/verify`, {
    method: "POST",
    headers: authHeaders(token),
  });
  return res.ok;
}

export async function fetchAdminSummary(token: string): Promise<AdminSummary> {
  const res = await fetch(`${BASE}/api/admin/summary`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Summary failed: ${res.status}`);
  return res.json();
}

export type NewCard = {
  mode: string;
  texte: string;
  texte_b?: string | null;
  variante?: string | null;
  vibe?: string | null;
  gage?: string;
  alternative?: string;
  intensite?: number;
  tags_theme?: string[];
  packs?: string[];
  premium?: boolean;
  age18?: boolean;
};

export async function createCard(token: string, card: NewCard): Promise<Card> {
  const res = await fetch(`${BASE}/api/cards`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(card),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Create failed: ${res.status}`);
  return res.json();
}

export async function importCsv(
  token: string,
  csv: string
): Promise<{ inserted: number; skipped: number; errors: string[] }> {
  const res = await fetch(`${BASE}/api/import/csv`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ csv }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Import failed: ${res.status}`);
  return res.json();
}

// ----------------------------- Airtable (source of truth) -----------------------------

export type SyncResult = { ok: boolean; fetched: number; synced: number; active: number; skipped: number };
export type AirtableInfo = { configured: boolean; base_id: string; table_id: string; edit_url: string | null };

export async function syncAirtable(token: string): Promise<SyncResult> {
  const res = await fetch(`${BASE}/api/admin/sync`, { method: "POST", headers: authHeaders(token) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Sync failed: ${res.status}`);
  return res.json();
}

export async function fetchAirtableInfo(token: string): Promise<AirtableInfo> {
  const res = await fetch(`${BASE}/api/admin/airtable-info`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Info failed: ${res.status}`);
  return res.json();
}

export async function fetchAdminCards(token: string, mode?: string): Promise<Card[]> {
  const q = mode ? `?mode=${encodeURIComponent(mode)}` : "";
  const res = await fetch(`${BASE}/api/admin/cards${q}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`List failed: ${res.status}`);
  return res.json();
}

export async function deleteAirtableCard(token: string, recordId: string): Promise<void> {
  const res = await fetch(`${BASE}/api/admin/airtable/${recordId}`, { method: "DELETE", headers: authHeaders(token) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Delete failed: ${res.status}`);
}
