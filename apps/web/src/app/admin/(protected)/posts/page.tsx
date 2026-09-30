import { isPostKind, postKindLabels } from "@ting-lab/content/kinds";
import Link from "next/link";
import { createPublishingStore } from "@ting-lab/database";
import { requireAdmin } from "@/lib/admin/auth";
import { Button } from "@ting-lab/ui";
import { AdminFilters } from "@/components/admin/AdminFilters";
import { ExportContent } from "@/components/admin/ExportContent";
import { indexStatusLabel } from "@/components/admin/index-status";
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
    kind: isPostKind(first("kind")) ? first("kind") : undefined,
    category: first("category"),
    tag: first("tag"),
    status: first("status"),
    page: first("page"),
    pageSize: first("pageSize"),
  });
  const href = (page: number) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(result.pageSize) });
    for (const key of ["q", "kind", "status", "category", "tag"] as const)
      if (result[key]) params.set(key, result[key]);
    return `/admin/posts?${params}`;
  };
  const returnTo = encodeURIComponent(href(result.page));
  return (
    <>
      <div className={styles.pageHeading}>
        <div>
          <h1>内容管理</h1>
          <p>写下技术、生活与日常思考，管理草稿和公开内容。</p>
        </div>
        <div className={styles.actions}>
          <Button asChild>
            <Link href={`/admin/posts/new?returnTo=${returnTo}`}>新建内容</Link>
          </Button>
          <ExportContent />
        </div>
      </div>
      <AdminFilters
        key={href(result.page)}
        q={result.q}
        kind={result.kind}
        category={result.category}
        tag={result.tag}
        categories={result.categories}
        tags={result.tags}
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
          {result.q || result.kind || result.status || result.category || result.tag
            ? "无匹配结果，请调整筛选条件。"
            : "暂无内容，可以新建第一篇草稿。"}
          <Button asChild variant="ghost">
            <Link href={`/admin/posts?pageSize=${result.pageSize}`}>清空筛选</Link>
          </Button>
        </p>
      ) : null}
      {result.total > 0 && (
        <table className={styles.contentTable}>
          <caption className={styles.srOnly}>管理内容列表</caption>
          <thead>
            <tr>
              {["标题", "内容形式", "分类", "发布状态", "更新时间", "索引状态", "操作"].map(
                (label) => (
                  <th key={label} scope="col">
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row) => (
              <tr key={row.id}>
                <th scope="row" data-label="标题">
                  <Link
                    title={row.title}
                    href={"/admin/posts/" + row.id + "/edit?returnTo=" + returnTo}
                  >
                    {row.title}
                  </Link>
                </th>
                <td data-label="内容形式">
                  {isPostKind(row.kind) ? postKindLabels[row.kind] : row.kind}
                </td>
                <td data-label="分类">{row.category}</td>
                <td data-label="发布状态">
                  {row.deleted_at ? (
                    "已删除"
                  ) : row.published_revision ? (
                    <>
                      已发布
                      {row.working_revision !== row.published_revision && (
                        <small>有未发布修改</small>
                      )}
                    </>
                  ) : (
                    "草稿"
                  )}
                </td>
                <td data-label="更新时间">
                  <time dateTime={row.modified_at.toISOString()}>
                    {row.modified_at.toISOString().slice(0, 10)}
                  </time>
                </td>
                <td data-label="索引状态">
                  {row.index_status === "failed" ? (
                    <details className={styles.indexFailure}>
                      <summary>索引失败</summary>
                      <p>检索索引暂不可用，不影响内容的发布状态。可在编辑页查看并重试。</p>
                    </details>
                  ) : (
                    indexStatusLabel(row.index_status)
                  )}
                </td>
                <td data-label="操作">
                  <div className={styles.rowActions}>
                    <Link href={"/admin/posts/" + row.id + "/edit?returnTo=" + returnTo}>编辑</Link>
                    <Link href={"/admin/posts/" + row.id + "/preview?returnTo=" + returnTo}>
                      预览
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {result.pageCount > 1 && (
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
