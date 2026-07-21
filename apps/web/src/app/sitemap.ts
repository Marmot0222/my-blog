import type { MetadataRoute } from "next";

import { contentRepository } from "@/lib/content";
import { createSitemap } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return createSitemap(
    siteConfig.origin,
    contentRepository.getPublishedPosts(),
    contentRepository.getPublishedProjects(),
    contentRepository.getAllTags(),
  );
}
