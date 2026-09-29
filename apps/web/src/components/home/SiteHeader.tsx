import Link from "next/link";

import { HeaderInteractive } from "@/components/navigation/HeaderInteractive";

import { SiteNavigation } from "@/components/navigation/SiteNavigation";

import styles from "./SiteHeader.module.scss";

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link className={styles.brand} href="/" aria-label="Ting Lab 首页">
          TING LAB
        </Link>

        <SiteNavigation />

        <HeaderInteractive />
      </div>
    </header>
  );
}
