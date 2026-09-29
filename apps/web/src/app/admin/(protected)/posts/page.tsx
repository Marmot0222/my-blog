import Link from "next/link";
import { createPublishingStore } from "@ting-lab/database";
import { requireAdmin } from "@/lib/admin/auth";
import { Button } from "@ting-lab/ui";
import { AdminFilters } from "@/components/admin/AdminFilters";
import { ExportContent } from "@/components/admin/ExportContent";
import styles from "@/components/admin/admin.module.scss";
export default async function AdminPosts({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const raw = await searchParams;
  const first = (key: string) => (Array.isArray(raw[key]) ? raw[key][0] : raw[key]);
  const result = await createPublishingStore().querySummaries({
    q: first("q"),
    kind: first("kind"),
    status: first("status"),
    page: first("page"),
    pageSize: first("pageSize"),
  });
  const href = (page: number) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(result.pageSize) });
    for (const key of ["q", "kind", "status"] as const)
      if (result[key]) params.set(key, result[key]);
    return `/admin/posts?${params}`;
  };
  const returnTo = encodeURIComponent(href(result.page));
  return (
    <>
      <h1>文章与笔记</h1>
      <div className={styles.actions}>
        <Button asChild>
          <Link href={`/admin/posts/new?returnTo=${returnTo}`}>新建草稿</Link>
        </Button>
        <ExportContent />
      </div>
      <AdminFilters
        key={href(result.page)}
        q={result.q}
        kind={result.kind}
        status={result.status}
        pageSize={result.pageSize}
      />
      <p>
        共 {result.total} 篇
        {result.total
          ? ` · ${(result.page - 1) * result.pageSize + 1}–${Math.min(result.page * result.pageSize, result.total)} 条 · 第 ${result.page}/${result.pageCount} 页`
          : ""}
      </p>
      {!result.total ? (
        <p className={styles.notice}>
          {result.q || result.kind || result.status
            ? "无匹配结果，请调整筛选条件。"
            : "暂无内容，可以新建第一篇草稿。"}
        </p>
      ) : null}
      <ul className={styles.list}>
        {result.rows.map((row) => (
          <li key={row.id}>
            <h2>
              <Link href={`/admin/posts/${row.id}/edit?returnTo=${returnTo}`}>{row.title}</Link>
            </h2>
            <p>
              {row.kind === "note" ? "笔记" : "文章"} ·{" "}
              {row.deleted_at
                ? "已删除"
                : row.published_revision
                  ? row.working_revision !== row.published_revision
                    ? "已发布 · 有未发布修改"
                    : "已发布"
                  : "草稿"}{" "}
              · {row.modified_at.toISOString().slice(0, 10)}
            </p>
            <p>
              索引：{row.index_status ?? "未入队"}
              {row.index_status === "failed" ? " · 索引失败，可在编辑页重试" : ""}
            </p>
            <div className={styles.actions}>
              <Link href={`/admin/posts/${row.id}/edit?returnTo=${returnTo}`}>编辑</Link>
              <Link href={`/admin/posts/${row.id}/preview?returnTo=${returnTo}`}>预览</Link>
            </div>
          </li>
        ))}
      </ul>
      {result.total > 0 && (
        <nav className={styles.actions} aria-label="管理内容分页">
          {result.page > 1 ? (
            <Link href={href(result.page - 1)}>上一页</Link>
          ) : (
            <span aria-disabled="true">上一页</span>
          )}
          {Array.from({ length: result.pageCount }, (_, i) => i + 1)
            .filter(
              (page) =>
                page === 1 || page === result.pageCount || Math.abs(page - result.page) <= 2,
            )
            .map((page) => (
              <Link
                key={page}
                href={href(page)}
                aria-current={page === result.page ? "page" : undefined}
              >
                {page}
              </Link>
            ))}
          {result.page < result.pageCount ? (
            <Link href={href(result.page + 1)}>下一页</Link>
          ) : (
            <span aria-disabled="true">下一页</span>
          )}
        </nav>
      )}
    </>
  );
}
