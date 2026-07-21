import type { ProjectMetadata } from "@ting-lab/content";
import Link from "next/link";

import { ProjectLinks, ProjectStatus, TechList } from "./ProjectMeta";
import styles from "./ProjectList.module.scss";

export function ProjectList({ projects }: Readonly<{ projects: readonly ProjectMetadata[] }>) {
  return (
    <ol className={styles.list}>
      {projects.map((project, index) => (
        <li key={project.slug}>
          <article className={styles.project}>
            <span className={styles.index} aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className={styles.summary}>
              <div className={styles.headingRow}>
                <div>
                  {project.featured ? <p className={styles.featured}>精选项目</p> : null}
                  <h2>
                    <Link href={`/projects/${project.slug}`}>{project.title}</Link>
                  </h2>
                </div>
                <ProjectStatus status={project.status} />
              </div>
              <p className={styles.description}>{project.summary}</p>
              <dl className={styles.facts}>
                <div>
                  <dt>角色</dt>
                  <dd>{project.role}</dd>
                </div>
                <div>
                  <dt>周期</dt>
                  <dd>
                    <time dateTime={project.startedAt}>{project.startedAt}</time> — 至今
                  </dd>
                </div>
              </dl>
              <TechList stack={project.stack} />
              <div className={styles.actions}>
                <Link className={styles.caseLink} href={`/projects/${project.slug}`}>
                  查看案例 <span aria-hidden="true">→</span>
                </Link>
                <ProjectLinks project={project} />
              </div>
            </div>
          </article>
        </li>
      ))}
    </ol>
  );
}
