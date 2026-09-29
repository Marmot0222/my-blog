"use client";
import { Button } from "@ting-lab/ui";
import { useRouter } from "next/navigation";
export function Logout() {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      onClick={async () => {
        const response = await fetch("/api/admin/logout", { method: "POST" });
        if (response.ok) {
          router.replace("/admin/login");
          router.refresh();
        }
      }}
    >
      退出登录
    </Button>
  );
}
