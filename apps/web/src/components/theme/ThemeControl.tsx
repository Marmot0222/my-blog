"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { resolveTheme, THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme";

import styles from "./ThemeControl.module.scss";

const options: readonly { value: ThemePreference; label: string }[] = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "system", label: "跟随系统" },
];

type ThemeControlProps = Readonly<{
  className: string;
  children: ReactNode;
}>;

export function ThemeControl({ className, children }: ThemeControlProps) {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    setPreference(stored === "light" || stored === "dark" ? stored : "system");
  }, []);

  useEffect(() => {
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
  }, [preference]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  function choose(value: ThemePreference) {
    setPreference(value);
    if (value === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, value);
    setOpen(false);
  }

  const label = options.find(({ value }) => value === preference)?.label ?? "跟随系统";

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        className={className}
        type="button"
        aria-label={`主题：${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {children}
      </button>
      {open ? (
        <div className={styles.menu} role="radiogroup" aria-label="选择主题">
          {options.map((option) => (
            <button
              className={styles.option}
              type="button"
              role="radio"
              aria-checked={preference === option.value}
              key={option.value}
              onClick={() => choose(option.value)}
            >
              <span className={styles.indicator} aria-hidden="true" />
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
