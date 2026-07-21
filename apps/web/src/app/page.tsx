import { AiPanel } from "@/components/home/AiPanel";
import { FeaturedArticles } from "@/components/home/FeaturedArticles";
import { HeroSection } from "@/components/home/HeroSection";
import { LatestNotes } from "@/components/home/LatestNotes";
import { SiteHeader } from "@/components/home/SiteHeader";
import { TopicTags } from "@/components/home/TopicTags";
import { contentRepository } from "@/lib/content";
import { serializeJsonLd } from "@/lib/seo";
import { absoluteUrl, siteConfig } from "@/lib/site";

import styles from "./page.module.scss";

export default function Home() {
  const featuredArticles = contentRepository.getFeaturedPosts().slice(0, 3);
  const latestNotes = contentRepository.getLatestNotes().slice(0, 3);
  const topics = contentRepository.getAllTags().slice(0, 8);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd({
            "@context": "https://schema.org",
            "@type": "Blog",
            name: siteConfig.name,
            description: siteConfig.description,
            url: absoluteUrl("/"),
            inLanguage: siteConfig.language,
            author: {
              "@type": "Person",
              name: siteConfig.author,
              url: absoluteUrl("/about"),
            },
          }),
        }}
      />
      <SiteHeader activeItem="home" />
      <main className={styles.page}>
        <HeroSection articles={featuredArticles} />
        <FeaturedArticles articles={featuredArticles} />
        <AiPanel />
        <section className={styles.metaSection} aria-label="更多博客内容">
          <LatestNotes notes={latestNotes} />
          <TopicTags topics={topics} />
        </section>
      </main>
      <footer className={styles.footer}>
        <span>A / EDITORIAL</span>
        <span>
          <a href="/feed.xml">RSS</a> · TING LAB © 2026
        </span>
      </footer>
    </>
  );
}
