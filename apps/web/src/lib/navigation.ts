export const navItems = [
  { key: "posts", label: "文章", href: "/posts" },
  { key: "projects", label: "项目", href: "/projects" },
  { key: "about", label: "关于", href: "/about" },
  { key: "ai", label: "AI 问答", href: "/ai" },
] as const;

export function navigationCurrent(pathname: string, href: string): "page" | "location" | undefined {
  if (pathname === href) return "page";
  if (
    pathname.startsWith(`${href}/`) ||
    (href === "/posts" && (pathname === "/tags" || pathname.startsWith("/tags/")))
  )
    return "location";
  return undefined;
}
