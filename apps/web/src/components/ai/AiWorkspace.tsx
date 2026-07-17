"use client";

import type { PostMetadata } from "@ting-lab/content";
import type { PublicRagSource } from "@ting-lab/retrieval";
import type { TocHeading } from "@/components/mdx/MdxContent";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import Link from "next/link";

import { AiChat } from "./AiChat";
import { ArticleDrawer } from "./ArticleDrawer";
import styles from "./AiWorkspace.module.scss";

export type DrawerPost = Readonly<{
  slug: string;
  metadata: PostMetadata;
  content: ReactNode;
  headings: readonly TocHeading[];
}>;

type AiWorkspaceProps = Readonly<{
  drawerPost?: DrawerPost;
  drawerStatus: "ok" | "not_found";
}>;

function parseSourceUrl(url: string): { slug: string; anchor?: string } {
  const hashIndex = url.indexOf("#");
  const path = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const anchor = hashIndex >= 0 ? url.slice(hashIndex + 1) : undefined;
  const match = path.match(/^\/posts\/(.+)$/);
  return { slug: match ? match[1] : "", anchor: anchor || undefined };
}

export function AiWorkspace({ drawerPost, drawerStatus }: AiWorkspaceProps) {
  const router = useRouter();

  const handleSourceOpen = useCallback(
    (source: PublicRagSource) => {
      const { slug, anchor } = parseSourceUrl(source.url);
      if (!slug) return;
      const target = `/ai?post=${encodeURIComponent(slug)}${anchor ? `#${anchor}` : ""}`;
      router.push(target);
    },
    [router],
  );

  const closeDrawer = useCallback(() => {
    router.push("/ai");
  }, [router]);

  const drawerOpen = Boolean(drawerPost) || drawerStatus === "not_found";

  return (
    <div className={styles.workspace}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand} aria-label="Ting Lab 首页">
          TING LAB
        </Link>
        <nav className={styles.topNav} aria-label="工作区导航">
          <Link href="/posts" className={styles.topLink}>
            文章
          </Link>
          <Link href="/" className={styles.topLink}>
            返回博客
          </Link>
        </nav>
      </header>

      <main className={styles.main}>
        <div className={styles.chatColumn}>
          {/* 不加 key：searchParams 变化只重渲染，不卸载 AiChat，聊天与共享 Chat 实例保持不变。 */}
          <AiChat mode="workspace" onSourceOpen={handleSourceOpen} />
        </div>
      </main>

      {drawerOpen ? (
        <ArticleDrawer post={drawerPost} status={drawerStatus} onClose={closeDrawer} />
      ) : null}
    </div>
  );
}
