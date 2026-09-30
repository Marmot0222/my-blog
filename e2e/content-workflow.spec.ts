import { expect, test } from "@playwright/test";
import { writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";

test("深色窄屏阅读目录、代码与相关阅读", async ({ page }) => {
  // Headed Firefox cold window/navigation initialization can exceed 30 seconds.
  test.setTimeout(60000);
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

test("随记 file 模式：组合分页、历史恢复和草稿分类隔离", async ({ page, request }) => {
  const prefix = `e2e-journal-${process.pid}`;
  const targets: string[] = [];
  try {
    for (let index = 0; index < 9; index++) {
      const slug = `${prefix}-${index}`;
      const target = path.resolve("content/posts", slug + ".mdx");
      const category = index === 8 ? "未公开主题" : index === 7 ? "技术" : "生活";
      writeFileSync(
        target,
        `---\ntitle: ${slug}\ndescription: Isolated journal fixture\ndate: "2026-09-30"\ntags: [${prefix}]\ncategory: ${category}\npublished: ${index !== 8}\nkind: ${index === 6 ? "article" : "journal"}\n---\n## 记录\n\n测试随记。`,
        { flag: "wx" },
      );
      targets.push(target);
    }
    await page.goto(
      `/posts?kind=journal&category=${encodeURIComponent("生活")}&tag=${prefix}&page=2`,
    );
    await expect(page.getByRole("status")).toContainText("共 6 篇");
    await expect(page.getByRole("status")).toContainText("2 / 2");
    await expect(page.locator("main article")).toHaveCount(1);
    await page.reload();
    await expect(page.getByRole("status")).toContainText("2 / 2");
    await page.getByRole("combobox", { name: "分类", exact: true }).click();
    await expect(page.getByRole("option", { name: "未公开主题", exact: true })).toHaveCount(0);
    await page.getByRole("option", { name: "技术", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("共 1 篇");
    await expect(page).not.toHaveURL(/page=/);
    await page.goBack();
    await expect(page.getByRole("status")).toContainText("2 / 2");
    await page.goForward();
    await expect(page.getByRole("status")).toContainText("共 1 篇");
    await page.getByRole("radio", { name: "文章", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("共 0 篇");
    await page.goto(`/posts?category=${encodeURIComponent("未知分类")}`);
    await expect(page.getByRole("status")).toContainText("共 0 篇");
    for (const url of ["/", "/posts", "/feed.xml", "/sitemap.xml", `/api/search?q=${prefix}`])
      expect(await (await request.get(url)).text()).not.toContain(prefix + "-8");
  } finally {
    for (const target of targets) unlinkSync(target);
  }
});
