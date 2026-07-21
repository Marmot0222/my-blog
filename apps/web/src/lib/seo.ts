import type { PostMetadata, ProjectMetadata, TagSummary } from "@ting-lab/content";
import type { MetadataRoute } from "next";

export function joinUrl(origin: string, pathname: string): string {
  return new URL(pathname, `${origin.replace(/\/$/, "")}/`).toString();
}

export function createRobots(origin: string): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    sitemap: joinUrl(origin, "/sitemap.xml"),
    host: origin,
  };
}

export function createSitemap(
  origin: string,
  posts: readonly PostMetadata[],
  projects: readonly ProjectMetadata[],
  tags: readonly TagSummary[],
): MetadataRoute.Sitemap {
  const published = posts.filter((post) => post.published);
  const latest = published[0]?.updatedAt ?? published[0]?.date;
  const entries: MetadataRoute.Sitemap = [
    { url: joinUrl(origin, "/"), lastModified: latest, changeFrequency: "weekly", priority: 1 },
    {
      url: joinUrl(origin, "/posts"),
      lastModified: latest,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    { url: joinUrl(origin, "/projects"), changeFrequency: "monthly", priority: 0.6 },
    { url: joinUrl(origin, "/about"), changeFrequency: "yearly", priority: 0.5 },
    { url: joinUrl(origin, "/ai"), changeFrequency: "monthly", priority: 0.6 },
    {
      url: joinUrl(origin, "/tags"),
      lastModified: latest,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    ...published.map((post) => ({
      url: joinUrl(origin, `/posts/${post.slug}`),
      lastModified: post.updatedAt ?? post.date,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...projects
      .filter((project) => project.published)
      .map((project) => ({
        url: joinUrl(origin, `/projects/${project.slug}`),
        lastModified: project.updatedAt,
        changeFrequency: "monthly" as const,
        priority: project.featured ? 0.8 : 0.7,
      })),
    ...tags.map((tag) => ({
      url: joinUrl(origin, `/tags/${tag.slug}`),
      lastModified: latest,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
  return [...new Map(entries.map((entry) => [entry.url, entry])).values()];
}

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function createRss(
  origin: string,
  site: Readonly<{ name: string; description: string; language: string }>,
  posts: readonly PostMetadata[],
  limit = 30,
): string {
  const items = posts
    .filter((post) => post.published)
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, limit)
    .map((post) => {
      const url = joinUrl(origin, `/posts/${post.slug}`);
      const categories = post.tags.map((tag) => `<category>${escapeXml(tag)}</category>`).join("");
      return `<item><title>${escapeXml(post.title)}</title><link>${escapeXml(url)}</link><guid isPermaLink="true">${escapeXml(url)}</guid><description>${escapeXml(post.description)}</description><pubDate>${new Date(`${post.date}T00:00:00.000Z`).toUTCString()}</pubDate>${categories}</item>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escapeXml(site.name)}</title><link>${escapeXml(joinUrl(origin, "/"))}</link><description>${escapeXml(site.description)}</description><language>${escapeXml(site.language)}</language><atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${escapeXml(joinUrl(origin, "/feed.xml"))}" rel="self" type="application/rss+xml"/>${items}</channel></rss>`;
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}
