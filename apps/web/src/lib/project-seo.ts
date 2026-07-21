import type { ProjectMetadata } from "@ting-lab/content";
import type { Metadata } from "next";

import { absoluteUrl, siteConfig } from "./site";

export function createProjectMetadata(project: ProjectMetadata): Metadata {
  const pathname = `/projects/${project.slug}`;
  return {
    title: project.title,
    description: project.summary,
    keywords: project.stack,
    alternates: { canonical: pathname },
    openGraph: {
      type: "article",
      url: pathname,
      title: project.title,
      description: project.summary,
      modifiedTime: project.updatedAt,
      images: ["/opengraph-image"],
    },
    twitter: {
      card: "summary_large_image",
      title: project.title,
      description: project.summary,
      images: ["/opengraph-image"],
    },
  };
}

export function createProjectJsonLd(project: ProjectMetadata) {
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: project.title,
    description: project.summary,
    url: absoluteUrl(`/projects/${project.slug}`),
    dateCreated: project.startedAt,
    dateModified: project.updatedAt,
    inLanguage: siteConfig.language,
    author: { "@type": "Person", name: siteConfig.author, url: absoluteUrl("/about") },
    keywords: project.stack,
    ...(project.repository ? { codeRepository: project.repository } : {}),
    ...(project.demo ? { sameAs: project.demo } : {}),
  };
}
