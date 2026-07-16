import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@/styles/globals.scss";

export const metadata: Metadata = {
  title: "Ting Lab — 记录技术与思考",
  description: "记录编码、设计、思考与实践的过程。",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
