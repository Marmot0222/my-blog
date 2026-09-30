import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";

test("正文 Suspense 在真实编译完成前输出骨架且保留服务端正文", async () => {
  const fixture = path.resolve("content/posts/round15-stream.mdx");
  writeFileSync(
    fixture,
    `---\ntitle: Stream fixture\ndescription: Local stream verification\ndate: "2026-09-30"\ntags: [React]\ncategory: Test\npublished: true\nkind: note\n---\n\n## BODY_STREAM_ROUND15\n\n\`\`\`tsx\n${"const value = { count: 1 };\n".repeat(1200)}\`\`\`\n`,
    { flag: "wx" },
  );
  try {
    const response = await fetch("http://127.0.0.1:3200/posts/round15-stream", {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    expect(response.status).toBe(200);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let html = "";
    let skeletonBeforeBody = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (html.includes("正在加载正文") && !html.includes("BODY_STREAM_ROUND15"))
        skeletonBeforeBody = true;
    }
    expect(skeletonBeforeBody).toBe(true);
    expect(html).toContain("BODY_STREAM_ROUND15");
    expect(html).toContain("<pre");
  } finally {
    unlinkSync(fixture);
  }
});

test("搜索结果保留真实链接，延迟导航期间可见等待且新标签不残留 pending", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "搜索内容", exact: true }).click();
  await page.getByRole("combobox", { name: "搜索内容" }).fill("Next.js");
  const result = page.getByRole("option").first().getByRole("link");
  await expect(result).toHaveAttribute("href", /\/posts\//);
  const newTab = context.waitForEvent("page");
  await result.click({ modifiers: ["Control"] });
  const opened = await newTab;
  await opened.waitForLoadState();
  await opened.close();
  await expect(page.locator('[data-pending="true"]')).toHaveCount(0);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.route("**/posts/*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  await result.click({ noWaitAfter: true });
  await expect(result.locator('[data-pending="true"]')).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.locator("main h1")).toBeVisible();
});

test("延迟 RSC 的局部反馈、快速切换、返回位置和减少动态效果", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/*", async (route) => {
    if (route.request().headers()["rsc"] && route.request().url().includes("/posts/")) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    await route.continue();
  });
  await page.goto("/posts");
  await page.waitForLoadState("networkidle");
  const links = page.locator("main article h2 a");
  await links.first().scrollIntoViewIfNeeded();
  const firstTitle = await links.first().innerText();
  const secondTitle = await links.nth(1).innerText();
  const directory = "test-results/round15/frames";
  mkdirSync(directory, { recursive: true });
  await page.screenshot({ path: `${directory}/before.png` });
  await links.first().click({ noWaitAfter: true });
  await expect(links.first().locator('[data-pending="true"]')).toBeVisible();
  await expect(links.first().locator("[data-pending] > span")).toHaveCSS("opacity", "1");
  await expect(links.first().locator("[data-pending] > span")).toHaveCSS("transform", "none");
  await page.screenshot({ path: `${directory}/pending.png` });
  await links.nth(1).scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => scrollY);
  await links.nth(1).click();
  await expect(links.first().locator("[data-pending]")).toHaveAttribute("data-pending", "false");
  await expect(page.locator("main h1")).toHaveText(secondTitle.trim());
  await page.screenshot({ path: `${directory}/complete.png` });
  await page.goBack();
  await expect(links.first()).toHaveText(firstTitle);
  await expect(page.locator('[data-pending="true"]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(y, -2);
});

test("服务端内容失败显示重试，恢复后可继续阅读", async ({ page }) => {
  const fixture = path.resolve("content/posts/round15-invalid.mdx");
  await page.goto("/posts");
  writeFileSync(fixture, "---\ntitle: invalid\n---\ninvalid", { flag: "wx" });
  try {
    await page.reload();
    await expect(page.getByRole("heading", { name: "内容暂时无法加载" })).toBeVisible();
  } finally {
    unlinkSync(fixture);
  }
  await page.getByRole("button", { name: "重新加载" }).click();
  await expect(page.locator("main article").first()).toBeVisible();
});

test("原始 HTML SEO、分页、爬虫 metadata 与 404", async ({ request }) => {
  for (const agent of ["Mozilla/5.0", "Twitterbot/1.0"]) {
    for (const [url, canonical, noindex] of [
      ["/posts?page=2&utm_source=test", "/posts?page=2", false],
      ["/posts?page=1&page=2", "/posts", false],
      ["/posts?page=999", "/posts?page=2", false],
      ["/posts?kind=note&page=999", "/posts?kind=note", true],
      ["/ai", "/ai", true],
    ] as const) {
      const response = await request.get(url, { headers: { "User-Agent": agent } });
      expect(response.status()).toBe(200);
      const html = await response.text();
      const canonicals = [...html.matchAll(/<link rel="canonical" href="([^"]+)"/g)];
      expect(canonicals).toHaveLength(1);
      expect(canonicals[0]?.[1]).toBe(`http://127.0.0.1:3200${canonical}`);
      expect(/<meta name="robots" content="[^"]*noindex/.test(html)).toBe(noindex);
    }
    const missing = await request.get("/posts/round15-missing", {
      headers: { "User-Agent": agent },
    });
    expect(missing.status()).toBe(404);
    expect(await missing.text()).toContain("noindex");
    const html = await (
      await request.get("/posts/nextjs-concurrent-rendering", { headers: { "User-Agent": agent } })
    ).text();
    const schemas = [
      ...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs),
    ].map((match) => JSON.parse(match[1]!));
    expect(schemas.find((schema) => schema["@type"] === "BlogPosting")?.author.name).toBe(
      "Weng Tingxing",
    );
    expect(html).toContain("<pre");
  }
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain("/ai</loc>");
  expect(await (await request.get("/robots.txt")).text()).toContain("sitemap.xml");
  expect(await (await request.get("/feed.xml")).text()).toContain("<rss");
});
