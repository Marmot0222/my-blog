import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteHeader } from "@/components/home/SiteHeader";
import { compileMdxContent } from "@/components/mdx/MdxContent";
import { ProjectLinks, ProjectStatus, TechList } from "@/components/projects/ProjectMeta";
import { contentRepository } from "@/lib/content";
import { createProjectJsonLd, createProjectMetadata } from "@/lib/project-seo";
import { serializeJsonLd } from "@/lib/seo";

import styles from "./page.module.scss";

type ProjectPageProps = Readonly<{ params: Promise<{ slug: string }> }>;

export const dynamicParams = false;

export function generateStaticParams() {
  return contentRepository.getAllProjectSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = contentRepository.getProjectBySlug(slug);
  if (!project?.metadata.published) {
    return { title: "项目未找到", robots: { index: false, follow: false } };
  }
  return createProjectMetadata(project.metadata);
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const project = contentRepository.getProjectBySlug(slug);
  if (!project?.metadata.published) notFound();

  const { metadata, content } = project;
  const compiled = await compileMdxContent(content);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(createProjectJsonLd(metadata)) }}
      />
      <SiteHeader activeItem="projects" />
      <main className={styles.page}>
        <article>
          <header className={styles.header}>
            <div className={styles.kicker}>
              <p>Project / Case Study</p>
              <ProjectStatus status={metadata.status} />
            </div>
            <h1>{metadata.title}</h1>
            <p className={styles.summary}>{metadata.summary}</p>
            <dl className={styles.facts}>
              <div>
                <dt>角色</dt>
                <dd>{metadata.role}</dd>
              </div>
              <div>
                <dt>开始</dt>
                <dd>
                  <time dateTime={metadata.startedAt}>{metadata.startedAt}</time>
                </dd>
              </div>
              <div>
                <dt>最近更新</dt>
                <dd>
                  <time dateTime={metadata.updatedAt}>{metadata.updatedAt}</time>
                </dd>
              </div>
            </dl>
            <TechList stack={metadata.stack} />
            <ProjectLinks project={metadata} />
          </header>

          <div className={styles.body}>{compiled.content}</div>

          <footer className={styles.footer}>
            <Link href="/projects">← 返回项目列表</Link>
            <Link href="/posts">继续阅读技术文章 →</Link>
          </footer>
        </article>
      </main>
    </>
  );
}
