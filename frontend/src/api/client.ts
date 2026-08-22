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
  // No backend configured (current shipping setup): fail fast so CatalogContext
  // falls straight through to the embedded catalog instead of firing a request
  // at "undefined/api/catalog" on every launch.
  if (!BASE) throw new Error("No backend configured");
  const res = await fetch(`${BASE}/api/catalog`);
  if (!res.ok) throw new Error(`Catalog fetch failed: ${res.status}`);
  return res.json();
}

export async function logEvent(name: string, props: Record<string, unknown> = {}) {
  // No backend configured: stay silent rather than firing a request at
  // "undefined/api/events" on every game start. The privacy policy states that
  // the app collects no usage data — keep the code honest about that.
  if (!BASE) return;
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

