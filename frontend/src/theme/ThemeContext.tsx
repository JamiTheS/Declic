import React, { createContext, useContext, useEffect, useState } from "react";
import { storage } from "@/src/utils/storage";
import { DARK, LIGHT, Colors } from "./tokens";

type ThemeMode = "dark" | "light";

type ThemeCtx = {
  mode: ThemeMode;
  colors: Colors;
  toggle: () => void;
  isDark: boolean;
};

const Ctx = createContext<ThemeCtx>({
  mode: "dark",
  colors: DARK,
  toggle: () => {},
  isDark: true,
});

const KEY = "declic.theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem(KEY, "dark");
      if (saved === "light" || saved === "dark") setMode(saved);
    })();
  }, []);

  const toggle = () => {
    setMode((m) => {
      const next = m === "dark" ? "light" : "dark";
      storage.setItem(KEY, next);
      return next;
    });
  };

  const colors = mode === "dark" ? DARK : LIGHT;

  return (
    <Ctx.Provider value={{ mode, colors, toggle, isDark: mode === "dark" }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);
