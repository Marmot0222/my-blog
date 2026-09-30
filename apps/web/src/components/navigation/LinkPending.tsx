"use client";

import { useLinkStatus } from "next/link";
import styles from "./LinkPending.module.scss";

export function LinkPending() {
  const { pending } = useLinkStatus();
  return (
    <span className={styles.slot} data-pending={pending} aria-hidden="true">
      <span className={styles.indicator} />
    </span>
  );
}
