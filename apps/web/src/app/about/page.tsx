import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/home/SiteHeader";
import { serializeJsonLd } from "@/lib/seo";
import { absoluteUrl, siteConfig } from "@/lib/site";

import styles from "./page.module.scss";

export const metadata: Metadata = {
  title: "关于",
  description: "关于 Ting Lab 的作者、技术方向、工作方式与当前关注。",
  alternates: { canonical: "/about" },
  openGraph: {
    url: "/about",
    title: "关于 Ting Lab",
    description: "关于 Ting Lab 的作者、技术方向、工作方式与当前关注。",
    images: ["/opengraph-image"],
  },
};

const capabilityGroups = [
  {
    title: "界面与交互",
    items: ["Vue 2 / Vue 3", "React 与 Next.js", "复杂业务界面", "响应式与可访问性"],
  },
  {
    title: "AI 应用",
    items: ["SSE 流式交互", "RAG 体验", "Markdown 多形态渲染", "MCP 与多智能体协作"],
  },
  {
    title: "工程与交付",
    items: ["TypeScript 约束", "组件与协议复用", "故障定位", "Docker 化部署"],
  },
] as const;

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd({
            "@context": "https://schema.org",
            "@type": "Person",
            name: siteConfig.author,
            url: absoluteUrl("/about"),
            description: "关注复杂界面、AI 应用前端与工程可维护性的前端开发者。",
            sameAs: [siteConfig.github],
            knowsAbout: [
              "Vue.js",
              "React",
              "Next.js",
              "TypeScript",
              "AI application interfaces",
              "Retrieval-augmented generation",
            ],
          }),
        }}
      />
      <SiteHeader activeItem="about" />
      <main className={styles.page}>
        <header className={styles.intro}>
          <p className={styles.eyebrow}>Profile / About</p>
          <h1>在界面、协议与真实问题之间工作。</h1>
          <div className={styles.introCopy}>
            <p>我是一名前端开发工程师，主要使用 Vue，也在 React 与 Next.js 中持续实践。</p>
            <p>
              我关注 AI 应用如何真正进入产品界面：从流式协议、结构化渲染到 RAG
              来源体验，同时也重视类型约束、组件复用和线上故障定位。
            </p>
          </div>
        </header>

        <section className={styles.direction} aria-labelledby="doing">
          <div className={styles.sectionLabel}>01 / Direction</div>
          <div>
            <h2 id="doing">我在做什么</h2>
            <div className={styles.directionGrid}>
              <article>
                <h3>AI 应用前端</h3>
                <p>把模型的流式输出、工具状态和结构化内容变成可理解、可操作的界面。</p>
              </article>
              <article>
                <h3>复杂业务界面</h3>
                <p>在信息密度、状态边界和复用成本之间建立清晰的组件与交互模型。</p>
              </article>
              <article>
                <h3>个人技术产品</h3>
                <p>独立完成内容建模、前端体验、服务接入、部署和线上问题排查的闭环。</p>
              </article>
            </div>
          </div>
        </section>

        <section className={styles.capabilities} aria-labelledby="capabilities">
          <div className={styles.sectionLabel}>02 / Capability</div>
          <div>
            <h2 id="capabilities">能力地图</h2>
            <div className={styles.capabilityGrid}>
              {capabilityGroups.map((group) => (
                <article key={group.title}>
                  <h3>{group.title}</h3>
                  <ul>
                    {group.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.process} aria-labelledby="process">
          <div className={styles.sectionLabel}>03 / Process</div>
          <div>
            <h2 id="process">工作方式</h2>
            <ol>
              <li>
                <span>01</span>
                <div>
                  <h3>先还原问题</h3>
                  <p>确认用户路径、数据边界和失败条件，不急着把现象翻译成某个框架功能。</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>用最小闭环验证</h3>
                  <p>先建立可观察、可复现的路径，再逐步补齐类型、错误处理与自动化测试。</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>把结论变成约束</h3>
                  <p>将故障经验沉淀为协议、内容模型、测试或部署预检，而不是只修一次现场。</p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        <section className={styles.focus} aria-labelledby="focus">
          <div className={styles.sectionLabel}>04 / Now</div>
          <div>
            <h2 id="focus">当前关注</h2>
            <ul>
              <li>配置化 AI 对话流与安全组件注册表</li>
              <li>流式协议中的状态、文本和来源归属</li>
              <li>RAG 如何提供可核验且不打断阅读的体验</li>
              <li>通过真实项目、源码阅读与技术写作提升工程抽象</li>
            </ul>
          </div>
        </section>

        <section className={styles.contact} aria-labelledby="contact">
          <div>
            <p className={styles.eyebrow}>Contact / Continue</p>
            <h2 id="contact">继续了解 Ting Lab</h2>
            <p>项目、文章与 RSS 是目前公开且持续维护的联系入口。</p>
          </div>
          <div className={styles.contactLinks}>
            <Link href="/projects">浏览项目 →</Link>
            <Link href="/posts">阅读文章 →</Link>
            <a href="/feed.xml">订阅 RSS →</a>
            <a href={siteConfig.github} target="_blank" rel="noopener noreferrer">
              GitHub（新窗口）↗
            </a>
          </div>
        </section>
      </main>
    </>
  );
}
