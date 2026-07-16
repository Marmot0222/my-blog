import { AiPanel } from "@/components/home/AiPanel";
import { FeaturedArticles } from "@/components/home/FeaturedArticles";
import { HeroSection } from "@/components/home/HeroSection";
import { LatestNotes } from "@/components/home/LatestNotes";
import { SiteHeader } from "@/components/home/SiteHeader";
import { TopicTags } from "@/components/home/TopicTags";
import { featuredArticles, latestNotes, topics } from "@/data/home";

import styles from "./page.module.scss";

export default function Home() {
  return (
    <>
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
        <span>TING LAB © 2026</span>
      </footer>
    </>
  );
}
