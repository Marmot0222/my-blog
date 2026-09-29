"use client";

import type { PostMetadata } from "@ting-lab/content";
import type { PublicRagSource } from "@ting-lab/retrieval";
import type { TocHeading } from "@/components/mdx/MdxContent";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AiChat } from "./AiChat";
import { ArticleDrawer } from "./ArticleDrawer";
import styles from "./AiWorkspace.module.scss";

export type DrawerPost = Readonly<{
  slug: string;
  metadata: PostMetadata;
  content: ReactNode;
  headings: readonly TocHeading[];
  tagLinks: ReadonlyArray<Readonly<{ tag: string; slug: string }>>;
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
  const [closing, setClosing] = useState(false);
  useEffect(() => setClosing(false), [drawerPost, drawerStatus]);

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
    setClosing(true);
    router.push("/ai", { scroll: false });
  }, [router]);

  const drawerOpen = Boolean(drawerPost) || drawerStatus === "not_found";

  return (
    <div className={styles.workspace}>
      <main className={styles.main}>
        <div className={styles.chatColumn}>
          {/* 不加 key：searchParams 变化只重渲染，不卸载 AiChat，聊天与共享 Chat 实例保持不变。 */}
          <AiChat mode="workspace" onSourceOpen={handleSourceOpen} />
        </div>
      </main>

      <ArticleDrawer
        open={drawerOpen && !closing}
        post={drawerPost}
        status={drawerStatus}
        onClose={closeDrawer}
      />
    </div>
  );
}
