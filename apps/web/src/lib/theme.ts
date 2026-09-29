export const THEME_STORAGE_KEY = "tinglab:theme";

export type ThemePreference = "light" | "dark" | "system";

export function parseThemePreference(value: string | null | undefined): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

export const themeInitScript = `(() => {
  try {
    const key = ${JSON.stringify(THEME_STORAGE_KEY)};
    let stored = null;
    try { stored = localStorage.getItem(key); } catch {}
    const preference = stored === "light" || stored === "dark" ? stored : "system";
    const resolved = preference === "system"
      ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : preference;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePreference = preference;
    document.documentElement.style.colorScheme = resolved;
  } catch {}
})();`;

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): "light" | "dark" {
  return preference === "system" ? (prefersDark ? "dark" : "light") : preference;
}
