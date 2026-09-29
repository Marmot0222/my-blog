import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin, AdminError } from "@/lib/admin/auth";
import { Logout } from "@/components/admin/Logout";
import { ThemeControl } from "@/components/theme/ThemeControl";
import styles from "@/components/admin/admin.module.scss";
export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AdminError && error.status === 401) redirect("/admin/login");
    return (
      <main className={styles.login}>
        <h1>后台暂不可用</h1>
        <p>请检查内容源、数据库、会话密钥与管理员初始化。</p>
        <Link href="/">返回博客</Link>
      </main>
    );
  }
  return (
    <div className={styles.shell}>
      <aside className={styles.nav}>
        <Link href="/admin">TING LAB / 管理</Link>
        <details open>
          <summary>管理导航</summary>
          <nav aria-label="管理导航">
            <Link href="/admin/posts">文章与笔记</Link>
            <Link href="/admin/settings/ai">模型配置</Link>
            <a href="/api/admin/export" download>
              导出内容
            </a>
            <Link href="/">查看博客</Link>
            <Logout />
            <ThemeControl className={styles.themeButton}>主题</ThemeControl>
          </nav>
        </details>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
