import { getContentRepository } from "@/lib/content";
import { createRss } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export async function GET() {
  try {
    const contentRepository = await getContentRepository();
    const xml = createRss(siteConfig.origin, siteConfig, contentRepository.getPublishedPosts());
    return new Response(xml, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Content temporarily unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
