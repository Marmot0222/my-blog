import { expect, test } from "@playwright/test";
import { writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";

test("归档筛选保留 URL、刷新和历史状态，切换条件重置页码", async ({ page }) => {
  await page.goto("/posts");
  await page.getByRole("link", { name: "下一页" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole("status")).toContainText("第 2 / 2 页");
  await page.getByLabel("内容类型").selectOption("note");
  await page
    .getByRole("combobox", { name: "标签", exact: true })
    .selectOption("frontend-engineering");
  await page.getByRole("button", { name: "应用筛选" }).click();
  await expect(page).toHaveURL(/kind=note&tag=frontend-engineering$/);
  await expect(page.getByRole("status")).toContainText("共 2 篇");
  await expect(page.getByRole("navigation", { name: "文章分页" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("内容类型")).toHaveValue("note");
  await page.goBack();
  await expect(page.getByRole("status")).toContainText("第 2 / 2 页");
  await page.goForward();
  await expect(page.getByRole("combobox", { name: "标签", exact: true })).toHaveValue(
    "frontend-engineering",
  );
  await page.getByRole("heading", { level: 2 }).first().getByRole("link").click();
  await expect(page).toHaveURL(/\/posts\/[a-z-]+$/);
  await page.goBack();
  await expect(page.getByLabel("内容类型")).toHaveValue("note");
  await expect(page.getByRole("combobox", { name: "标签", exact: true })).toHaveValue(
    "frontend-engineering",
  );
  await page.goto("/posts?tag=unknown&page=-2");
  await expect(page.getByText("没有符合条件的内容。", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "清除筛选", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("共 6 篇");
});

test("深色窄屏阅读目录、代码与相关阅读", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/posts/nextjs-concurrent-rendering");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const toc = page.getByRole("navigation", { name: "文章目录" });
  await expect(toc).toBeVisible();
  await toc.getByRole("link").first().click();
  await expect(page).toHaveURL(/#/);
  await expect(page.locator("pre").first()).toBeVisible();
  // Exercise existing MDX overflow containers without publishing synthetic content.
  await page
    .locator("pre code")
    .first()
    .evaluate((node) => {
      node.textContent = "long_code_".repeat(150);
    });
  await expect(page.locator("table")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  const related = page.getByRole("region", { name: "相关阅读" });
  const count = await related.getByRole("heading", { level: 3 }).count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThanOrEqual(3);
  await related.getByRole("link").first().click();
  await expect(page).not.toHaveURL(/nextjs-concurrent-rendering/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("生产预览入口返回 404，筛选 noindex 且 canonical 固定", async ({ page, request }) => {
  expect((await request.get("/preview/posts/nextjs-concurrent-rendering")).status()).toBe(404);
  expect((await request.get("/posts/unknown-draft")).status()).toBe(404);
  await page.goto("/posts?kind=note&page=999");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/posts$/);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).not.toContain("/preview/");
  expect(sitemap).not.toContain("?kind=");
});

test("真实未发布文件不会暴露给生产详情、预览或搜索", async ({ request }) => {
  const slug = `e2e-draft-${process.pid}`;
  const target = path.resolve("content/posts", `${slug}.mdx`);
  writeFileSync(
    target,
    `---\ntitle: ${slug}\ndescription: Private draft\ndate: "2026-09-01"\ntags: [React]\ncategory: Test\npublished: false\nkind: note\n---\nPrivate draft`,
    { flag: "wx" },
  );
  try {
    expect((await request.get(`/posts/${slug}`)).status()).toBe(404);
    expect((await request.get(`/preview/posts/${slug}`)).status()).toBe(404);
    const search = await request.get(`/api/search?q=${slug}`);
    expect(search.ok()).toBe(true);
    expect((await search.json()).results).toEqual([]);
    for (const url of ["/feed.xml", "/sitemap.xml", "/posts"]) {
      const response = await request.get(url);
      expect(response.ok()).toBe(true);
      expect(await response.text()).not.toContain(slug);
    }
  } finally {
    unlinkSync(target);
  }
});
