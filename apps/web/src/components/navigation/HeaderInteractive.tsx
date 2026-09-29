"use client";

import Link from "next/link";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@ting-lab/ui";
import { usePathname } from "next/navigation";
import { navItems, navigationCurrent } from "@/lib/navigation";
import { useEffect, useRef, useState } from "react";

import { SearchDialog } from "@/components/search/SearchDialog";
import { ThemeControl } from "@/components/theme/ThemeControl";

import styles from "../home/SiteHeader.module.scss";

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

export function HeaderInteractive() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const mobileSearchButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  function openSearch(source: HTMLElement | null) {
    window.dispatchEvent(new Event("tinglab:open-search"));
    returnFocusRef.current = source;
    setMenuOpen(false);
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
        openSearch(
          searchButtonRef.current?.getClientRects().length
            ? searchButtonRef.current
            : menuTriggerRef.current,
        );
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

      <div className={styles.mobileMenu}>
        <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="导航菜单"
              ref={menuTriggerRef}
            >
              <span className={styles.menuIcon} aria-hidden="true">
                <i />
                <i />
              </span>
            </button>
          </DialogTrigger>
          <DialogContent
            className={styles.mobileSheet}
            aria-describedby={undefined}
            onCloseAutoFocus={(event) => {
              if (searchOpen) event.preventDefault();
            }}
          >
            <DialogTitle>导航菜单</DialogTitle>
            <nav className={styles.mobileNav} aria-label="移动端导航">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={navigationCurrent(pathname, item.href)}
                >
                  {item.label}
                </Link>
              ))}
              <div className={styles.mobileActions}>
                <button
                  ref={mobileSearchButtonRef}
                  type="button"
                  onClick={() => openSearch(menuTriggerRef.current)}
                >
                  <SearchIcon /> 搜索
                </button>
                <ThemeControl className={styles.mobileThemeButton}>
                  <ThemeIcon /> 主题
                </ThemeControl>
              </div>
            </nav>
          </DialogContent>
        </Dialog>
      </div>
      <SearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        returnFocusRef={returnFocusRef}
      />
    </>
  );
}
