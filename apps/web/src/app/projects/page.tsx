import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/home/SiteHeader";
import { ProjectList } from "@/components/projects/ProjectList";
import { contentRepository } from "@/lib/content";
import { siteConfig } from "@/lib/site";

import styles from "./page.module.scss";

export const metadata: Metadata = {
  title: "项目作品",
  description: "记录 Ting Lab 的技术产品、界面实验与关键工程决策。",
  alternates: { canonical: "/projects" },
  openGraph: {
    url: "/projects",
    title: "项目作品",
    description: "记录 Ting Lab 的技术产品、界面实验与关键工程决策。",
    images: ["/opengraph-image"],
  },
};

export default function ProjectsPage() {
  const projects = contentRepository.getPublishedProjects();

  return (
    <>
      <SiteHeader activeItem="projects" />
      <main className={styles.page}>
        <header className={styles.intro}>
          <p className={styles.eyebrow}>Selected / Projects</p>
          <h1>把问题做成可以持续维护的作品。</h1>
          <p>
            这里不只陈列完成结果，也记录动机、约束与关键技术决策。每个项目都来自真实实践，并保留它仍在变化的状态。
          </p>
        </header>

        <section className={styles.projects} aria-labelledby="selected-projects">
          <div className={styles.sectionHeading}>
            <h2 id="selected-projects">项目案例</h2>
            <span>{String(projects.length).padStart(2, "0")} / PUBLIC</span>
          </div>
          <ProjectList projects={projects} />
        </section>

        <section className={styles.cta} aria-labelledby="projects-next">
          <div>
            <p className={styles.eyebrow}>Continue / Explore</p>
            <h2 id="projects-next">作品之外，还有过程。</h2>
            <p>从文章了解技术判断，或进入 AI 问答，用本站内容继续追问。</p>
          </div>
          <div className={styles.ctaLinks}>
            <Link href="/posts">阅读技术文章 →</Link>
            <Link href="/ai">进入 AI 问答 →</Link>
            <a href={siteConfig.github} target="_blank" rel="noopener noreferrer">
              访问 GitHub（新窗口）↗
            </a>
          </div>
        </section>
      </main>
    </>
  );
}
