import styles from "./page.module.scss";

export default function Home() {
  return (
    <main className={styles.shell}>
      <p className={styles.eyebrow}>TING LAB</p>
      <h1>空间已准备好。</h1>
      <p className={styles.summary}>内容与产品体验将在这里逐步生长。</p>
    </main>
  );
}
