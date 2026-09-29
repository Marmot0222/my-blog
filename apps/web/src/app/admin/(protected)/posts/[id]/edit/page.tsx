import { notFound } from "next/navigation";
import { z } from "zod";
import { createPublishingStore } from "@ting-lab/database";
import { postFrontMatterSchema } from "@ting-lab/content";
import { PostEditor } from "@/components/admin/PostEditor";
import { requireAdmin } from "@/lib/admin/auth";
export default async function EditPost({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const row = await createPublishingStore().read(id);
  return (
    <PostEditor
      post={{
        id: row.id,
        slug: row.slug,
        version: row.version,
        metadata: postFrontMatterSchema.parse(row.metadata),
        body: row.body,
        everPublished: row.ever_published,
        publishedRevision: row.published_revision,
        deleted: !!row.deleted_at,
        indexStatus: row.index_status,
      }}
    />
  );
}
