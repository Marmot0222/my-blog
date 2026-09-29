import Link from "next/link";
import { createPublishingStore } from "@ting-lab/database";
import { requireAdmin } from "@/lib/admin/auth";
import { Button, Input } from "@ting-lab/ui";
import styles from "@/components/admin/admin.module.scss";
export default async function AdminPosts({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string; status?: string; page?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const rows = (await createPublishingStore().list()).filter(
    (row) =>
      (!query.q || String(row.metadata.title).toLowerCase().includes(query.q.toLowerCase())) &&
      (!query.kind || row.metadata.kind === query.kind) &&
      (query.status === "deleted"
        ? !!row.deleted_at
        : !row.deleted_at &&
          (query.status === "published"
            ? row.published_revision !== null
            : query.status === "draft"
              ? row.published_revision === null
              : true)),
  );
  const count = Math.max(1, Math.ceil(rows.length / 20)),
    page = Math.min(count, Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1));
  const href = (number: number) => {
    const params = new URLSearchParams();
    for (const key of ["q", "kind", "status"] as const) if (query[key]) params.set(key, query[key]);
    params.set("page", String(number));
    return `/admin/posts?${params}`;
  };
  return (
    <>
      <h1>文章与笔记</h1>
      <Button asChild>
        <Link href="/admin/posts/new">新建草稿</Link>
      </Button>
      <form className={styles.actions}>
        <Input name="q" aria-label="标题关键词" placeholder="标题关键词" defaultValue={query.q} />
        <label>
          类型{" "}
          <select name="kind" defaultValue={query.kind ?? ""}>
            <option value="">全部</option>
            <option value="article">文章</option>
            <option value="note">笔记</option>
          </select>
        </label>
        <label>
          状态{" "}
          <select name="status" defaultValue={query.status ?? ""}>
            <option value="">全部</option>
            <option value="published">已发布</option>
            <option value="draft">草稿</option>
            <option value="deleted">回收站</option>
          </select>
        </label>
        <Button variant="outline">筛选</Button>
      </form>
      <p>
        共 {rows.length} 篇 · 第 {page}/{count} 页
      </p>
      <ul className={styles.list}>
        {rows.slice((page - 1) * 20, page * 20).map((row) => (
          <li key={row.id}>
            <h2>
              <Link href={`/admin/posts/${row.id}/edit`}>{String(row.metadata.title)}</Link>
            </h2>
            <p>
              {row.metadata.kind === "note" ? "笔记" : "文章"} ·{" "}
              {row.deleted_at ? "已删除" : row.published_revision ? "已发布" : "草稿"} ·{" "}
              {row.modified_at.toISOString().slice(0, 10)}
            </p>
            <p>
              索引：{row.index_status ?? "未入队"}
              {row.index_error ? ` · ${row.index_error}` : ""}
            </p>
          </li>
        ))}
      </ul>
      <nav className={styles.actions} aria-label="管理内容分页">
        {page > 1 ? <Link href={href(page - 1)}>上一页</Link> : null}
        {page < count ? <Link href={href(page + 1)}>下一页</Link> : null}
      </nav>
    </>
  );
}
