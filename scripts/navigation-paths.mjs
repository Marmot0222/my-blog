import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const directory = "test-results/round15/paths";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const samples = [];
for (const width of [1440, 390]) {
  for (const delay of [0, 800]) {
    for (let run = 0; run < 3; run++) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      if (delay)
        await page.route("**/*", async (route) => {
          if (route.request().headers().rsc)
            await new Promise((resolve) => setTimeout(resolve, delay));
          await route.continue();
        });
      await page.goto("http://127.0.0.1:3200/");
      await page.waitForLoadState("networkidle");
      for (const source of ["home", "related", "archive"]) {
        const link =
          source === "home"
            ? page.locator('a[href^="/posts/"]:visible').first()
            : source === "related"
              ? page.getByRole("region", { name: "相关阅读" }).locator("a").first()
              : page.locator("main article h2 a").first();
        const href = await link.getAttribute("href");
        await link.scrollIntoViewIfNeeded();
        await page.evaluate(() => {
          window.measurement = { start: 0, feedback: null };
          document.addEventListener(
            "click",
            () => {
              window.measurement.start = performance.now();
              const measurement = window.measurement;
              const inspect = () => {
                if (window.measurement !== measurement) return;
                const indicator = document.querySelector('[data-pending="true"] > span');
                if (indicator && Number(getComputedStyle(indicator).opacity) > 0)
                  window.measurement.feedback = performance.now() - window.measurement.start;
                else if (performance.now() - window.measurement.start < 5000)
                  requestAnimationFrame(inspect);
              };
              requestAnimationFrame(inspect);
            },
            { once: true, capture: true },
          );
        });
        await link.click();
        await page.waitForURL(`http://127.0.0.1:3200${href}`);
        await page.locator("main h1").waitFor();
        const titleMs = await page.evaluate(() => performance.now() - window.measurement.start);
        await page.locator('main article [class*="MdxContent_content"]').waitFor();
        const measured = await page.evaluate(() => ({
          ...window.measurement,
          bodyMs: performance.now() - window.measurement.start,
          requests: performance
            .getEntriesByType("resource")
            .filter((entry) => entry.name.includes("_rsc"))
            .map((entry) => ({
              url: new URL(entry.name).pathname,
              ttfb: entry.responseStart - entry.requestStart,
              download: entry.responseEnd - entry.responseStart,
              bytes: entry.transferSize,
            })),
        }));
        samples.push({ width, delay, run, source, titleMs, ...measured });
        await writeFile(`${directory}/samples.json`, JSON.stringify(samples, null, 2));
        if (source === "archive") {
          const backStarted = Date.now();
          await page.goBack();
          await page.locator("main article h2 a").first().waitFor();
          samples.push({ width, delay, run, source: "back", visibleMs: Date.now() - backStarted });
        }
        if (run === 0 && !delay)
          await page.screenshot({ path: `${directory}/${width}-${source}.png` });
        if (source !== "home") {
          await page.goto("http://127.0.0.1:3200/posts");
          await page.waitForLoadState("networkidle");
        }
      }
      await context.close();
    }
  }
}
await browser.close();
await writeFile(`${directory}/samples.json`, JSON.stringify(samples, null, 2));
