import type { ProjectMetadata, ProjectStatus } from "@ting-lab/content";

import styles from "./ProjectMeta.module.scss";

const statusLabels: Readonly<Record<ProjectStatus, string>> = {
  active: "持续开发",
  maintained: "维护中",
  archived: "已归档",
  concept: "概念实验",
};

export function ProjectStatus({ status }: Readonly<{ status: ProjectStatus }>) {
  return (
    <span className={styles.status} data-status={status}>
      <span aria-hidden="true" />
      {statusLabels[status]}
    </span>
  );
}

export function TechList({ stack }: Readonly<{ stack: readonly string[] }>) {
  return (
    <ul className={styles.stack} aria-label="技术栈">
      {stack.map((technology) => (
        <li key={technology}>{technology}</li>
      ))}
    </ul>
  );
}

export function ProjectLinks({ project }: Readonly<{ project: ProjectMetadata }>) {
  if (!project.repository && !project.demo) return null;
  return (
    <div className={styles.links} aria-label="项目外部链接">
      {project.repository ? (
        <a href={project.repository} target="_blank" rel="noopener noreferrer">
          查看代码 <span className={styles.newWindow}>（新窗口）</span> ↗
        </a>
      ) : null}
      {project.demo ? (
        <a href={project.demo} target="_blank" rel="noopener noreferrer">
          访问线上站点 <span className={styles.newWindow}>（新窗口）</span> ↗
        </a>
      ) : null}
    </div>
  );
}
