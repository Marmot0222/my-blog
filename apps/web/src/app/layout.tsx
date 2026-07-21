import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ChatProvider } from "@/components/ai/chat-provider";
import { themeInitScript } from "@/lib/theme";
import { siteConfig } from "@/lib/site";

import "@/styles/globals.scss";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.origin),
  title: { default: siteConfig.title, template: "%s — Ting Lab" },
  description: siteConfig.description,
  authors: [{ name: siteConfig.author }],
  creator: siteConfig.author,
  publisher: siteConfig.name,
  alternates: {
    canonical: "/",
    types: { "application/rss+xml": "/feed.xml" },
  },
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
    locale: siteConfig.locale,
    url: "/",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    images: ["/opengraph-image"],
  },
  icons: { icon: "/icon.svg" },
  manifest: "/manifest.webmanifest",
  robots: { index: true, follow: true },
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ChatProvider>{children}</ChatProvider>
      </body>
    </html>
  );
}
