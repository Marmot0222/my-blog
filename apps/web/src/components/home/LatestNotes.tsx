import Link from "next/link";

import type { LatestNote } from "@/data/home";

import styles from "./LatestNotes.module.scss";

type LatestNotesProps = Readonly<{
  notes: readonly LatestNote[];
}>;

function NoteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3h8l4 4v14H6V3Z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}

export function LatestNotes({ notes }: LatestNotesProps) {
  return (
    <div className={styles.block}>
      <div className={styles.titleRow}>
        <h2>最新笔记</h2>
        <span>NOTES</span>
      </div>
      <ul>
        {notes.map((note) => (
          <li key={note.title}>
            <NoteIcon />
            <Link href="#featured">{note.title}</Link>
            <time>{note.date}</time>
          </li>
        ))}
      </ul>
      <Link className={styles.more} href="#featured">
        查看全部笔记 <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
