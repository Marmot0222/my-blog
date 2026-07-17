import type { Metadata } from "next";
import type { ReactNode } from "react";

import { tagToSlug } from "@ting-lab/content";

import { AiWorkspace, type DrawerPost } from "@/components/ai/AiWorkspace";
import { compilePostMdx, type TocHeading } from "@/components/mdx/MdxContent";
import { contentRepository } from "@/lib/content";

export const metadata: Metadata = {
  title: "AI 问答 - Ting Lab",
  description: "与 Ting Lab 的 AI 助手对话，回答会引用本站已索引的博客文章作为来源。",
};

export const dynamic = "force-dynamic";

type AiPageProps = Readonly<{
  searchParams: Promise<{ post?: string }>;
}>;

export default async function AiPage({ searchParams }: AiPageProps) {
  const { post: slug } = await searchParams;
  let drawerPost: DrawerPost | undefined;
  let drawerStatus: "ok" | "not_found" = "ok";

  if (slug) {
    const post = contentRepository.getPostBySlug(slug);
    if (!post?.metadata.published) {
      drawerStatus = "not_found";
    } else {
      const compiled = await compilePostMdx(post.content);
      const { metadata } = post;
      drawerPost = {
        slug,
        metadata,
        content: compiled.content as ReactNode,
        headings: compiled.headings as readonly TocHeading[],
        tagLinks: metadata.tags.map((tag) => ({ tag, slug: tagToSlug(tag) })),
      };
    }
  }

  return <AiWorkspace drawerPost={drawerPost} drawerStatus={drawerStatus} />;
}
