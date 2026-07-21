import { contentRepository } from "@/lib/content";
import { createRss } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export function GET() {
  const xml = createRss(siteConfig.origin, siteConfig, contentRepository.getPublishedPosts());
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
