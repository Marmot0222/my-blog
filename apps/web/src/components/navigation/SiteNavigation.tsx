"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems, navigationCurrent } from "@/lib/navigation";
import styles from "../home/SiteHeader.module.scss";

export function SiteNavigation() {
  const pathname = usePathname();
  return (
    <nav className={styles.desktopNav} aria-label="主导航">
      {navItems.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={navigationCurrent(pathname, item.href)}
          className={navigationCurrent(pathname, item.href) ? styles.activeLink : styles.navLink}
        >
          <span className={styles.navLabel}>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
