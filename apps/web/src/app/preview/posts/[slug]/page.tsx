import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleToc } from "@/components/article/ArticleToc";
import { compilePostMdx } from "@/components/mdx/MdxContent";
import { contentRepository } from "@/lib/content";
import { isContentPreviewEnabled } from "@/lib/content-preview";
import styles from "../../../posts/[slug]/page.module.scss";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "本地内容预览",
  robots: { index: false, follow: false },
};

export default async function PreviewPost({
  params,
}: Readonly<{ params: Promise<{ slug: string }> }>) {
  if (!isContentPreviewEnabled()) notFound();
  const post = contentRepository.getPostBySlug((await params).slug);
  if (!post) notFound();
  const compiled = await compilePostMdx(post.content);
  return (
    <>
      <main className={styles.page}>
        <article>
          <header className={styles.header}>
            <p className={styles.eyebrow}>
              仅本地预览 · {post.metadata.published ? "已发布内容" : "未发布草稿"}
            </p>
            <h1>{post.metadata.title}</h1>
            <p className={styles.description}>{post.metadata.description}</p>
          </header>
          <div className={styles.articleLayout}>
            <div className={styles.body}>{compiled.content}</div>
            <ArticleToc headings={compiled.headings} />
          </div>
        </article>
      </main>
    </>
  );
}
