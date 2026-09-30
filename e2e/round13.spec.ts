import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const root = "test-results/round13/after";
async function aligned(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const label = document
          .querySelector('nav[aria-label="主导航"] a[aria-current] span')
          ?.getBoundingClientRect();
        const line = document.querySelector('[data-slot="nav-indicator"]')?.getBoundingClientRect();
        return label && line
          ? Math.max(Math.abs(label.left - line.left), Math.abs(label.right - line.right))
          : Infinity;
      }),
    )
    .toBeLessThanOrEqual(1);
}

test("persistent navigation tracks label geometry at 100 and 125 percent", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await mkdir(root, { recursive: true });
  for (const width of [1440, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/posts");
    await page.getByRole("navigation", { name: "主导航", exact: true }).evaluate((el) => {
      el.setAttribute("data-persistence-probe", "yes");
    });
    for (const zoom of [1, 1.25]) {
      await page.evaluate((value) => {
        document.documentElement.style.zoom = String(value);
      }, zoom);
      for (const [label, href] of [
        ["项目", "/projects"],
        ["关于", "/about"],
        ["AI 问答", "/ai"],
        ["文章", "/posts"],
      ]) {
        await page
          .getByRole("navigation", { name: "主导航", exact: true })
          .getByRole("link", { name: label, exact: true })
          .click();
        await expect(page).toHaveURL(new RegExp(`${href}$`));
        await aligned(page);
        await expect(page.locator('[data-slot="nav-indicator"]')).toHaveCount(1);
        await expect(page.locator('[data-persistence-probe="yes"]')).toHaveCount(1);
        if (width === 1440 && zoom === 1)
          await page.screenshot({
            animations: "disabled",
            path: `${root}/nav-${href.slice(1)}-${info.project.name}.png`,
          });
      }
    }
  }
  await page.evaluate(() => {
    document.documentElement.style.zoom = "1";
  });
  const nav = page.getByRole("navigation", { name: "主导航", exact: true });
  for (const label of ["项目", "关于", "文章"])
    await nav.getByRole("link", { name: label, exact: true }).click();
  await expect(page).toHaveURL(/\/posts$/);
  await aligned(page);
  await page.goto("/posts/why-i-left-redux");
  await aligned(page);
  await expect(
    page
      .getByRole("navigation", { name: "主导航", exact: true })
      .getByRole("link", { name: "文章", exact: true }),
  ).toHaveAttribute("aria-current", "location");
  await page.goto("/tags");
  await aligned(page);
  await page.goBack();
  await aligned(page);
  await page.goto("/");
  await expect(page.locator('[data-slot="nav-indicator"]')).toHaveAttribute(
    "data-visible",
    "false",
  );
});

test("theme motion and viewport matrix keeps controls aligned and focus restored", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await mkdir(root, { recursive: true });
  for (const colorScheme of ["light", "dark"] as const) {
    for (const reducedMotion of ["no-preference", "reduce"] as const) {
      await page.emulateMedia({ colorScheme, reducedMotion });
      for (const width of [1440, 1280, 390, 360]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/posts");
        const heights = await page.evaluate(() => [
          document.querySelector('[role="radiogroup"]')!.getBoundingClientRect().height,
          document.querySelector('[role="combobox"]')!.getBoundingClientRect().height,
        ]);
        expect(Math.abs(heights[0] - heights[1])).toBeLessThanOrEqual(1);
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
          .toBe(true);
        await page.getByRole("combobox", { name: "标签" }).click();
        await expect(page.getByRole("listbox")).toBeVisible();
        if (width === 1440 && reducedMotion === "no-preference")
          await page.screenshot({
            animations: "disabled",
            path: `${root}/select-${colorScheme}-${info.project.name}.png`,
          });
        await page.keyboard.press("Escape");
        await expect(page.getByRole("combobox", { name: "标签" })).toBeFocused();
        await page.screenshot({
          animations: "disabled",
          path: `${root}/posts-${width}-${colorScheme}-${reducedMotion}-${info.project.name}.png`,
        });
        if (width < 768) {
          await page.getByRole("button", { name: "导航菜单" }).click();
          if (width === 390 && reducedMotion === "no-preference")
            await page.screenshot({
              animations: "disabled",
              path: `${root}/sheet-${colorScheme}-${info.project.name}.png`,
            });
          await page
            .getByRole("dialog")
            .getByRole("button", { name: /主题：/ })
            .click();
        } else await page.getByRole("button", { name: /主题：/ }).click();
        await expect(page.getByRole("menu")).toBeVisible();
        if (width === 1440 || width === 390)
          await page.screenshot({
            animations: "disabled",
            path: `${root}/theme-${width}-${colorScheme}-${reducedMotion}-${info.project.name}.png`,
          });
        await page.keyboard.press("Escape");
        await expect(page.getByRole("menu")).toHaveCount(0);
        if (width < 768) {
          await page.keyboard.press("Escape");
          await expect(page.getByRole("button", { name: "导航菜单" })).toBeFocused();
        }
      }
    }
  }
});

test("real motion samples, exit presence and reduced-motion behavior", async ({
  browser,
}, info) => {
  test.setTimeout(60000);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: info.outputPath("video"), size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  const video = page.video();
  try {
    await page.goto("http://127.0.0.1:3200/posts");
    await aligned(page);
    const samples = page.evaluate(
      () =>
        new Promise<number[]>((resolve) => {
          const nav = document.querySelector('nav[aria-label="主导航"]')!;
          const indicator = nav.querySelector('[data-slot="nav-indicator"]')!;
          const values: number[] = [];
          const observer = new MutationObserver(() => {
            if (!nav.querySelector('a[href="/projects"][aria-current]')) return;
            observer.disconnect();
            const start = performance.now();
            const read = () => {
              values.push(indicator.getBoundingClientRect().x);
              if (performance.now() - start < 400) requestAnimationFrame(read);
              else resolve(values);
            };
            read();
          });
          observer.observe(nav, {
            attributes: true,
            subtree: true,
            attributeFilter: ["aria-current"],
          });
        }),
    );
    await page
      .getByRole("navigation", { name: "主导航", exact: true })
      .getByRole("link", { name: "项目", exact: true })
      .click();
    const movement = await samples;
    expect(new Set(movement.map((x) => Math.round(x))).size).toBeGreaterThan(2);
    await aligned(page);
    await page.getByRole("button", { name: "搜索内容", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("combobox").fill("React");
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.screenshot({
      animations: "disabled",
      path: `${root}/search-${info.project.name}.png`,
    });
    const exit = page.evaluate(
      () =>
        new Promise<{ opacity: number[]; removed: boolean }>((resolve) => {
          const panel = document.querySelector('[role="dialog"]')!;
          const opacity: number[] = [];
          const observer = new MutationObserver(() => {
            if (panel.getAttribute("data-state") !== "closed") return;
            observer.disconnect();
            const start = performance.now();
            const read = () => {
              if (panel.isConnected) opacity.push(Number(getComputedStyle(panel).opacity));
              if (performance.now() - start < 300) requestAnimationFrame(read);
              else resolve({ opacity, removed: !panel.isConnected });
            };
            read();
          });
          observer.observe(panel, { attributes: true, attributeFilter: ["data-state"] });
        }),
    );
    await page.keyboard.press("Escape");
    const closing = await exit;
    expect(closing.removed).toBe(true);
    expect(closing.opacity.some((value) => value > 0 && value < 1)).toBe(true);
    await expect(page.getByRole("button", { name: "搜索内容", exact: true })).toBeFocused();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("button", { name: "搜索内容", exact: true }).click();
    expect(await page.getByRole("dialog").evaluate((el) => el.getAnimations().length)).toBe(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("http://127.0.0.1:3200/ai?post=nextjs-concurrent-rendering");
    const drawer = page.getByRole("dialog", { name: "理解 Next.js 15 的并发渲染机制" });
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute("data-motion", "right");
    await page.screenshot({
      animations: "disabled",
      path: `${root}/drawer-${info.project.name}.png`,
    });
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(page).toHaveURL(/\/ai$/);
    await mkdir("test-results/round13/motion", { recursive: true });
    await writeFile(
      `test-results/round13/motion/samples-${info.project.name}.json`,
      `${JSON.stringify({ movement, closing }, null, 2)}\n`,
    );
  } finally {
    await context.close();
    if (video)
      await video.saveAs(`test-results/round13/motion/interaction-${info.project.name}.webm`);
  }
});

test("rapid filter intent commits last choice without collapsing old results", async ({ page }) => {
  await page.goto("/posts");
  await page.route("**/posts?**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });
  await page.getByRole("radio", { name: "笔记", exact: true }).click();
  await expect(page.getByRole("radio", { name: "笔记", exact: true })).toHaveAttribute(
    "data-pending",
    "true",
  );
  await expect(page.locator("main article").first()).toBeVisible();
  await page.getByRole("radio", { name: "文章", exact: true }).click();
  await page.getByRole("radio", { name: "笔记", exact: true }).click();
  await expect(page).toHaveURL(/kind=note$/);
  await expect(page.getByRole("radio", { name: "笔记", exact: true })).toBeChecked();
  await expect(page.locator('[data-slot="segment-indicator"]')).toHaveCount(1);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const a = document
          .querySelector('[role="radio"][data-state="checked"]')!
          .getBoundingClientRect();
        const b = document
          .querySelector('[data-slot="segment-indicator"]')!
          .getBoundingClientRect();
        return Math.max(Math.abs(a.x - b.x), Math.abs(a.width - b.width));
      }),
    )
    .toBeLessThanOrEqual(1);
});

test("search lock preserves long-page coordinates and short-page width", async ({ page }, info) => {
  const records = [];
  for (const height of [900, 4000]) {
    await page.setViewportSize({ width: 1440, height });
    await page.goto(height === 900 ? "/posts" : "/about");
    await page.waitForLoadState("networkidle");
    await page.evaluate(
      (long) => window.scrollTo({ top: long ? 400 : 0, behavior: "instant" }),
      height === 900,
    );
    const measure = () =>
      page.evaluate(() => ({
        scrollY,
        gap: innerWidth - document.documentElement.clientWidth,
        boxes: ["header", "main"].map((selector) => {
          const box = document.querySelector(selector)!.getBoundingClientRect();
          return { x: box.x, width: box.width };
        }),
      }));
    const before = await measure();
    if (height === 900 && info.project.name === "chromium") expect(before.gap).toBeGreaterThan(0);
    if (height === 4000) expect(before.gap).toBe(0);
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog")).toBeVisible();
    const during = await measure();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const after = await measure();
    for (const result of [during, after]) {
      expect(Math.abs(result.scrollY - before.scrollY)).toBeLessThanOrEqual(1);
      result.boxes.forEach((box, i) => {
        expect(Math.abs(box.x - before.boxes[i].x)).toBeLessThanOrEqual(1);
        expect(Math.abs(box.width - before.boxes[i].width)).toBeLessThanOrEqual(1);
      });
    }
    records.push({ height, before, during, after });
  }
  await mkdir("test-results/round13/after", { recursive: true });
  await writeFile(
    `test-results/round13/after/scroll-${info.project.name}.json`,
    `${JSON.stringify(records, null, 2)}\n`,
  );
  await page.emulateMedia({ forcedColors: "active" });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarColor)).toBe(
    "auto",
  );
});
