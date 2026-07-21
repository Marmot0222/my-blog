"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { SearchDialog } from "@/components/search/SearchDialog";
import { ThemeControl } from "@/components/theme/ThemeControl";

import styles from "../home/SiteHeader.module.scss";

const navItems = [
  { key: "posts", label: "文章", href: "/posts" },
  { key: "projects", label: "项目", href: "/projects" },
  { key: "about", label: "关于", href: "/about" },
  { key: "ai", label: "AI 问答", href: "/ai" },
] as const;

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function ThemeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

type HeaderInteractiveProps = Readonly<{ activeItem?: string }>;

export function HeaderInteractive({ activeItem }: HeaderInteractiveProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const mobileSearchButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  function openSearch(source: HTMLElement | null) {
    returnFocusRef.current = source;
    setSearchOpen(true);
  }

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const command = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      const slash = event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey;
      const editable =
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName));
      if ((command || slash) && !editable) {
        event.preventDefault();
        openSearch(searchButtonRef.current ?? mobileSearchButtonRef.current);
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  return (
    <>
      <div className={styles.actions}>
        <button
          className={styles.iconButton}
          ref={searchButtonRef}
          type="button"
          aria-label="搜索内容"
          aria-keyshortcuts="Control+K Meta+K /"
          onClick={() => openSearch(searchButtonRef.current)}
        >
          <SearchIcon />
        </button>
        <span className={styles.divider} aria-hidden="true" />
        <ThemeControl className={styles.themeButton}>
          <ThemeIcon />
        </ThemeControl>
      </div>

      <details className={styles.mobileMenu}>
        <summary aria-label="导航菜单">
          <span className={styles.menuIcon} aria-hidden="true">
            <i />
            <i />
          </span>
        </summary>
        <nav className={styles.mobileNav} aria-label="移动端导航">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              aria-current={item.key === activeItem ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
          <div className={styles.mobileActions}>
            <button
              ref={mobileSearchButtonRef}
              type="button"
              onClick={() => openSearch(mobileSearchButtonRef.current)}
            >
              <SearchIcon /> 搜索
            </button>
            <ThemeControl className={styles.mobileThemeButton}>
              <ThemeIcon /> 主题
            </ThemeControl>
          </div>
        </nav>
      </details>
      <SearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        returnFocusRef={returnFocusRef}
      />
    </>
  );
}
