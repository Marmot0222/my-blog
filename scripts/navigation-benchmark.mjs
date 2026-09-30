import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const phase = process.argv[2] ?? "before";
const directory = `test-results/round15/${phase}`;
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const samples = [];
for (const width of [1440, 390]) {
  for (const prefetch of [true, false]) {
    for (let run = 0; run < 3; run++) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      if (!prefetch)
        await page.route("**/*", (route) =>
          route.request().headers()["next-router-prefetch"] ? route.abort() : route.continue(),
        );
      await page.goto("http://127.0.0.1:3200/posts");
      await page.locator("main article a").first().waitFor();
      for (const visit of ["first", "repeat"]) {
        const link = page.locator("main article h2 a").first();
        const title = await link.innerText();
        const start = Date.now();
        await link.click();
        await page.locator("main h1").filter({ hasText: title.trim() }).waitFor();
        const titleMs = Date.now() - start;
        await page.locator("main article pre, main article h2").first().waitFor();
        const bodyMs = Date.now() - start;
        const requests = await page.evaluate(() =>
          performance
            .getEntriesByType("resource")
            .filter((x) => x.name.includes("_rsc"))
            .map((x) => ({
              url: new URL(x.name).pathname,
              ttfb: x.responseStart - x.requestStart,
              download: x.responseEnd - x.responseStart,
              bytes: x.transferSize,
            })),
        );
        samples.push({ width, prefetch, run, visit, titleMs, bodyMs, requests });
        await page.goBack();
        await page.locator("main article h2 a").first().waitFor();
      }
      await context.close();
    }
  }
}
await browser.close();
await writeFile(`${directory}/navigation.json`, JSON.stringify(samples, null, 2));
console.log(JSON.stringify(samples.map(({ requests, ...sample }) => sample)));
