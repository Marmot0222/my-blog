import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createPublishingStore } from "@ting-lab/database";
import { recordToPost } from "@ting-lab/publishing";
import { compilePostMdx } from "@/components/mdx/MdxContent";
import { requireAdmin } from "@/lib/admin/auth";
export default async function Preview({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const post = recordToPost(await createPublishingStore().read(id), false);
  const rendered = await compilePostMdx(post.content);
  return (
    <>
      <p>管理员草稿预览 · 未公开</p>
      <h1>{post.metadata.title}</h1>
      <p>{post.metadata.description}</p>
      {rendered.content}
      <Link href={`/admin/posts/${id}/edit`}>返回编辑</Link>
    </>
  );
}
