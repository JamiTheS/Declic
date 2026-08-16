import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { storage } from "@/src/utils/storage";
import { Card, Pack, Preset, Vibe } from "@/src/types";
import { fetchCatalog } from "@/src/api/client";
import { SEED_CARDS } from "@/src/data/seedCards";

type Source = "remote" | "cache" | "seed" | "loading";

type CatalogCtx = {
  cards: Card[];
  packs: Pack[];
  presets: Preset[];
  vibes: Vibe[];
  source: Source;
  loading: boolean;
  refresh: () => Promise<void>;
};

const Ctx = createContext<CatalogCtx>({
  cards: SEED_CARDS,
  packs: [],
  presets: [],
  vibes: [],
  source: "loading",
  loading: true,
  refresh: async () => {},
});

// v4: the embedded pack now carries the full catalog. Bumped so a cache written
// against the old backend can't shadow it on existing installs.
const CACHE_KEY = "declic.catalog.v4";

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [cards, setCards] = useState<Card[]>(SEED_CARDS);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [vibes, setVibes] = useState<Vibe[]>([]);
  const [source, setSource] = useState<Source>("loading");
  const [loading, setLoading] = useState(true);

  const loadFromCache = useCallback(async () => {
    const raw = await storage.getItem(CACHE_KEY, "");
    if (raw && typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.cards?.length) {
          setCards(parsed.cards);
          setPacks(parsed.packs || []);
          setPresets(parsed.presets || []);
          setVibes(parsed.vibes || []);
          setSource("cache");
          return true;
        }
      } catch {}
    }
    return false;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCatalog();
      if (data?.cards?.length) {
        setCards(data.cards);
        setPacks(data.packs || []);
        setPresets(data.presets || []);
        setVibes(data.vibes || []);
        setSource("remote");
        storage.setItem(
          CACHE_KEY,
          JSON.stringify({
            cards: data.cards,
            packs: data.packs,
            presets: data.presets,
            vibes: data.vibes,
            version: data.version,
          })
        );
      }
    } catch {
      const hadCache = await loadFromCache();
      if (!hadCache) {
        setCards(SEED_CARDS);
        setSource("seed");
      }
    } finally {
      setLoading(false);
    }
  }, [loadFromCache]);

  useEffect(() => {
    (async () => {
      await loadFromCache();
      await refresh();
    })();
  }, [loadFromCache, refresh]);

  return (
    <Ctx.Provider value={{ cards, packs, presets, vibes, source, loading, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export const useCatalog = () => useContext(Ctx);
