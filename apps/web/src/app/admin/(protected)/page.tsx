import Link from "next/link";
import { createPublishingStore } from "@ting-lab/database";
import { requireAdmin } from "@/lib/admin/auth";
import styles from "@/components/admin/admin.module.scss";
export default async function AdminPage() {
  await requireAdmin();
  const rows = await createPublishingStore().list();
  return (
    <>
      <h1>内容工作台</h1>
      <p>管理文章、笔记、随记和模型配置。</p>
      <div className={styles.notice}>
        <p>
          {rows.filter((row) => !row.deleted_at).length} 篇内容 ·{" "}
          {rows.filter((row) => row.published_revision !== null).length} 篇已发布 ·{" "}
          {rows.filter((row) => row.index_status === "failed").length} 篇索引失败
        </p>
      </div>
      <div className={styles.actions}>
        <Link href="/admin/posts/new">新建草稿 →</Link>
        <Link href="/admin/posts">查看全部内容</Link>
      </div>
    </>
  );
}
