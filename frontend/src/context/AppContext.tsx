import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { storage } from "@/src/utils/storage";
import { Player, Ambiance } from "@/src/types";
import { useSubscription } from "@/src/lib/revenuecat";

const EMOJIS = ["🦊", "🐼", "🐸", "🦁", "🐙", "🦄", "🐯", "🐨", "🐷", "🦖", "🐧", "🦋", "🐝", "🦉", "🐺", "🐹"];

export type SessionStats = {
  mode: string;
  packLabel: string | null;
  cardsPlayed: number;
  reveals: number;
  passes: number;
  targetCounts: Record<string, number>; // playerId -> times targeted
  voteCounts: Record<string, number>; // playerId -> times voted for
  correctGuesses: number;
};

const emptyStats = (mode = "", packLabel: string | null = null): SessionStats => ({
  mode,
  packLabel,
  cardsPlayed: 0,
  reveals: 0,
  passes: 0,
  targetCounts: {},
  voteCounts: {},
  correctGuesses: 0,
});

type AppCtx = {
  ready: boolean;
  ageVerified: boolean;
  verifyAge: () => void;

  players: Player[];
  addPlayer: (name: string) => void;
  removePlayer: (id: string) => void;
  clearPlayers: () => void;

  soberMode: boolean;
  setSoberMode: (v: boolean) => void;
  ambiance: Ambiance;
  setAmbiance: (a: Ambiance) => void;
  haptics: boolean;
  setHaptics: (v: boolean) => void;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;

  isPremium: boolean; // RevenueCat "pro" entitlement OR local test unlock
  testUnlockEnabled: boolean; // whether the "test unlock" toggle is exposed
  testUnlock: boolean;
  setTestUnlock: (v: boolean) => void;

  stats: SessionStats;
  startSession: (mode: string, packLabel?: string | null) => void;
  recordCard: (targetIds?: string[]) => void;
  recordReveal: () => void;
  recordPass: () => void;
  recordVote: (playerId: string) => void;
  recordCorrect: () => void;
};

const Ctx = createContext<AppCtx>({} as AppCtx);

const K = {
  age: "declic.ageVerified",
  players: "declic.players",
  sober: "declic.sober",
  ambiance: "declic.ambiance",
  haptics: "declic.haptics",
  sound: "declic.sound",
  testUnlock: "declic.testUnlock",
};

// When true, Settings exposes a "Débloquer Premium (test)" toggle so TestFlight
// / internal testers can access premium content without a real purchase.
// Set EXPO_PUBLIC_ENABLE_TEST_UNLOCK=false before the final App Store build.
const TEST_UNLOCK_ENABLED = process.env.EXPO_PUBLIC_ENABLE_TEST_UNLOCK === "true";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [soberMode, setSoberModeState] = useState(false);
  const [ambiance, setAmbianceState] = useState<Ambiance>("standard");
  const [haptics, setHapticsState] = useState(true);
  const [soundEnabled, setSoundEnabledState] = useState(false);
  const [testUnlock, setTestUnlockState] = useState(false);
  const [stats, setStats] = useState<SessionStats>(emptyStats());

  // Premium status is owned by RevenueCat — the "pro" entitlement is the single
  // source of truth. In test builds, a local unlock flag can also grant premium
  // so testers can exercise premium content without a live store purchase.
  const { isSubscribed } = useSubscription();
  const isPremium = isSubscribed || (TEST_UNLOCK_ENABLED && testUnlock);

  useEffect(() => {
    (async () => {
      const [age, savedPlayers, sober, amb, hap, snd, tu] = await Promise.all([
        storage.getItem(K.age, false),
        storage.getItem(K.players, "[]"),
        storage.getItem(K.sober, false),
        storage.getItem(K.ambiance, "standard"),
        storage.getItem(K.haptics, true),
        storage.getItem(K.sound, false),
        storage.getItem(K.testUnlock, false),
      ]);
      setAgeVerified(!!age);
      try {
        const p = JSON.parse((savedPlayers as string) || "[]");
        if (Array.isArray(p)) setPlayers(p);
      } catch {}
      setSoberModeState(!!sober);
      if (amb === "chill" || amb === "standard" || amb === "chaud") setAmbianceState(amb);
      setHapticsState(hap === null ? true : !!hap);
      setSoundEnabledState(!!snd);
      setTestUnlockState(!!tu);
      setReady(true);
    })();
  }, []);

  const verifyAge = useCallback(() => {
    setAgeVerified(true);
    storage.setItem(K.age, true);
  }, []);

  const persistPlayers = (next: Player[]) => {
    setPlayers(next);
    storage.setItem(K.players, JSON.stringify(next));
  };

  const addPlayer = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setPlayers((prev) => {
        const emoji = EMOJIS[prev.length % EMOJIS.length];
        const next = [
          ...prev,
          { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: trimmed, emoji },
        ];
        storage.setItem(K.players, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const removePlayer = useCallback((id: string) => {
    setPlayers((prev) => {
      const next = prev.filter((p) => p.id !== id);
      storage.setItem(K.players, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearPlayers = useCallback(() => persistPlayers([]), []);

  const setSoberMode = useCallback((v: boolean) => {
    setSoberModeState(v);
    storage.setItem(K.sober, v);
  }, []);
  const setAmbiance = useCallback((a: Ambiance) => {
    setAmbianceState(a);
    storage.setItem(K.ambiance, a);
  }, []);
  const setHaptics = useCallback((v: boolean) => {
    setHapticsState(v);
    storage.setItem(K.haptics, v);
  }, []);
  const setSoundEnabled = useCallback((v: boolean) => {
    setSoundEnabledState(v);
    storage.setItem(K.sound, v);
  }, []);

  const startSession = useCallback((mode: string, packLabel: string | null = null) => {
    setStats(emptyStats(mode, packLabel));
  }, []);

  const recordCard = useCallback((targetIds: string[] = []) => {
    setStats((s) => {
      const targetCounts = { ...s.targetCounts };
      targetIds.forEach((id) => {
        targetCounts[id] = (targetCounts[id] || 0) + 1;
      });
      return { ...s, cardsPlayed: s.cardsPlayed + 1, targetCounts };
    });
  }, []);

  const recordReveal = useCallback(() => setStats((s) => ({ ...s, reveals: s.reveals + 1 })), []);
  const recordPass = useCallback(() => setStats((s) => ({ ...s, passes: s.passes + 1 })), []);
  const recordVote = useCallback((playerId: string) => {
    setStats((s) => ({
      ...s,
      voteCounts: { ...s.voteCounts, [playerId]: (s.voteCounts[playerId] || 0) + 1 },
    }));
  }, []);
  const recordCorrect = useCallback(() => setStats((s) => ({ ...s, correctGuesses: s.correctGuesses + 1 })), []);

  return (
    <Ctx.Provider
      value={{
        ready,
        ageVerified,
        verifyAge,
        players,
        addPlayer,
        removePlayer,
        clearPlayers,
        soberMode,
        setSoberMode,
        ambiance,
        setAmbiance,
        haptics,
        setHaptics,
        soundEnabled,
        setSoundEnabled,
        isPremium,
        stats,
        startSession,
        recordCard,
        recordReveal,
        recordPass,
        recordVote,
        recordCorrect,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useApp = () => useContext(Ctx);
