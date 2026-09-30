"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Button, Dialog, DialogTrigger, DialogContent, DialogTitle } from "@ting-lab/ui";
import { ThemeControl } from "@/components/theme/ThemeControl";
import { Logout } from "./Logout";
import styles from "./admin.module.scss";
const items = [
  { href: "/admin", label: "概览" },
  { href: "/admin/posts", label: "内容管理" },
  { href: "/admin/media", label: "媒体库" },
  { href: "/admin/settings/ai", label: "模型配置" },
];
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname, params]);
  const current = items.find(
    (item) =>
      item.href === pathname || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`)),
  );
  const target = params.get("returnTo");
  const returnTo =
    target && (target === "/admin/posts" || target.startsWith("/admin/posts?"))
      ? target
      : "/admin/posts";
  const navigation = (
    <nav aria-label="管理导航">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={
            current === item ? (item.href === pathname ? "page" : "location") : undefined
          }
          onClick={() => setOpen(false)}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
  return (
    <div className={styles.shell}>
      <aside className={styles.nav}>
        <Link href="/admin">TING LAB / 管理</Link>
        {navigation}
      </aside>
      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.mobileToggle}>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" aria-label="管理菜单">
                  菜单
                </Button>
              </DialogTrigger>
              <DialogContent motion="left" className={styles.sheet} aria-describedby={undefined}>
                <DialogTitle>管理导航</DialogTitle>
                {navigation}
                <div className={styles.shortcuts}>
                  <p>快捷操作</p>
                  <Button asChild variant="ghost">
                    <Link href="/" target="_blank" rel="noopener" onClick={() => setOpen(false)}>
                      查看博客 ↗
                    </Link>
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <span>{current?.label ?? "管理"}</span>
          <div className={styles.account}>
            <Button asChild variant="ghost" className={styles.blogLink}>
              <Link href="/" target="_blank" rel="noopener">
                查看博客 ↗
              </Link>
            </Button>
            <ThemeControl className={styles.themeButton}>主题</ThemeControl>
            <Logout />
          </div>
        </header>
        <main className={styles.main}>
          {pathname.startsWith("/admin/posts/") && <Link href={returnTo}>← 返回内容列表</Link>}
          {children}
        </main>
      </div>
    </div>
  );
}
