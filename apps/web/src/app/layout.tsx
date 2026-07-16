import type { Metadata } from "next";
import { Inter, Noto_Serif_SC } from "next/font/google";
import type { ReactNode } from "react";

import "@/styles/globals.scss";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const notoSerif = Noto_Serif_SC({
  weight: ["500", "600", "700"],
  variable: "--font-serif",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Ting Lab — 记录技术与思考",
  description: "记录编码、设计、思考与实践的过程。",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="zh-CN" className={`${inter.variable} ${notoSerif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
