"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  parseThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme";

const ThemeContext = createContext<{
  preference: ThemePreference;
  choose(value: ThemePreference): void;
} | null>(null);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setPreference(parseThemePreference(document.documentElement.dataset.themePreference));
    setReady(true);
    const sync = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null)
        setPreference(parseThemePreference(event.newValue));
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved = resolveTheme(preference, media.matches);
      document.documentElement.dataset.theme = resolved;
      document.documentElement.dataset.themePreference = preference;
      document.documentElement.style.colorScheme = resolved;
    };
    apply();
    if (preference === "system") media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preference, ready]);
  function choose(value: ThemePreference) {
    setPreference(value);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      /* Memory preference remains usable. */
    }
  }
  return <ThemeContext.Provider value={{ preference, choose }}>{children}</ThemeContext.Provider>;
}
export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("ThemeProvider is required");
  return value;
}
