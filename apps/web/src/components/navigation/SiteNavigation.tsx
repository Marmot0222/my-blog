"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSelectionIndicator } from "@ting-lab/ui";
import { navItems, navigationCurrent } from "@/lib/navigation";
import styles from "../home/SiteHeader.module.scss";

export function SiteNavigation() {
  const pathname = usePathname();
  const { hostRef, indicatorRef } = useSelectionIndicator(
    pathname,
    "a[aria-current] [data-indicator-target]",
  );
  return (
    <nav ref={hostRef} className={styles.desktopNav} aria-label="主导航">
      {navItems.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={navigationCurrent(pathname, item.href)}
          className={navigationCurrent(pathname, item.href) ? styles.activeLink : styles.navLink}
        >
          <span data-indicator-target className={styles.navLabel}>
            {item.label}
          </span>
        </Link>
      ))}
      <span
        ref={indicatorRef}
        data-slot="nav-indicator"
        className={styles.navIndicator}
        aria-hidden="true"
      />
    </nav>
  );
}
