import Link from "next/link";

import styles from "./SiteHeader.module.scss";

const navItems = [
  { label: "文章", href: "#featured", active: true },
  { label: "项目", href: "#projects", active: false },
  { label: "关于", href: "#about", active: false },
  { label: "AI 问答", href: "#ai", active: false },
] as const;

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function SiteHeader() {
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
              className={item.active ? styles.activeLink : styles.navLink}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          <button className={styles.iconButton} type="button" aria-label="搜索文章">
            <SearchIcon />
          </button>
          <span className={styles.divider} aria-hidden="true" />
          <button className={styles.themeButton} type="button" aria-label="切换主题（暂未开放）">
            <SunIcon />
          </button>
        </div>

        <details className={styles.mobileMenu}>
          <summary aria-label="打开导航菜单">
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
                aria-current={item.active ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
            <div className={styles.mobileActions}>
              <button type="button" aria-label="搜索文章">
                <SearchIcon /> 搜索
              </button>
              <button type="button" aria-label="切换主题（暂未开放）">
                <SunIcon /> 主题
              </button>
            </div>
          </nav>
        </details>
      </div>
    </header>
  );
}
