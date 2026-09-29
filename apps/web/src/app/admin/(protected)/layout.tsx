import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin, AdminError } from "@/lib/admin/auth";
import { AdminShell } from "@/components/admin/AdminShell";
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
  return <AdminShell>{children}</AdminShell>;
}
