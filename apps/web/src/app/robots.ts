import type { MetadataRoute } from "next";

import { createRobots } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return createRobots(siteConfig.origin);
}
