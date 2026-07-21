import Link from "next/link";

import { HeaderInteractive } from "@/components/navigation/HeaderInteractive";

import styles from "./SiteHeader.module.scss";

const navItems = [
  { key: "posts", label: "文章", href: "/posts" },
  { key: "projects", label: "项目", href: "/projects" },
  { key: "about", label: "关于", href: "/about" },
  { key: "ai", label: "AI 问答", href: "/ai" },
] as const;

export type NavigationKey = "home" | "posts" | "projects" | "about" | "ai";

type SiteHeaderProps = Readonly<{
  activeItem?: NavigationKey;
}>;

export function SiteHeader({ activeItem }: SiteHeaderProps) {
  const activeNavigationItem = activeItem === "home" ? "posts" : activeItem;

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link className={styles.brand} href="/" aria-label="Ting Lab 首页">
          TING LAB
        </Link>

        <nav className={styles.desktopNav} aria-label="主导航">
          {navItems.map((item) => (
            <Link
              key={item.label}
              className={item.key === activeNavigationItem ? styles.activeLink : styles.navLink}
              href={item.href}
              aria-current={item.key === activeNavigationItem ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <HeaderInteractive activeItem={activeNavigationItem} />
      </div>
    </header>
  );
}
