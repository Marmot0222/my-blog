import Link from "next/link";

import { postKindLabels, type PostMetadata } from "@ting-lab/content";

import { formatMonthDay } from "@/lib/format-date";

import styles from "./LatestNotes.module.scss";

type LatestNotesProps = Readonly<{
  notes: readonly PostMetadata[];
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
        <h2>最新内容</h2>
        <span>RECENT</span>
      </div>
      <ul>
        {notes.map((note) => (
          <li key={note.slug}>
            <NoteIcon />
            <Link href={`/posts/${note.slug}`}>
              {note.title}
              <small> · {postKindLabels[note.kind]}</small>
            </Link>
            <time dateTime={note.date}>{formatMonthDay(note.date)}</time>
          </li>
        ))}
      </ul>
      {notes.length === 0 ? <p className={styles.empty}>暂无内容。</p> : null}
      <Link className={styles.more} href="/posts">
        查看全部内容 <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
