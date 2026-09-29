import type { MetadataRoute } from "next";

import { getContentRepository } from "@/lib/content";
import { createSitemap } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const contentRepository = await getContentRepository();
  return createSitemap(
    siteConfig.origin,
    contentRepository.getPublishedPosts(),
    contentRepository.getPublishedProjects(),
    contentRepository.getAllTags(),
  );
}
