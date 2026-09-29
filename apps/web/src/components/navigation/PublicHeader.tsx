"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// The server-rendered header slot stays mounted across public route changes.
export function PublicHeader({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return pathname === "/admin" || pathname.startsWith("/admin/") ? null : children;
}
