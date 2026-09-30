import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { failJournalFixtureIndex } from "../packages/publishing/test-support/round14-fixture";
const origin = "http://localhost:3201";
async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("管理员密码").fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
}
async function select(page: Page, name: string, option: string) {
  await page.getByRole("combobox", { name, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("round14: cross-dimension publishing, public isolation, layout and new-tab state", async ({
  page,
}) => {
  test.setTimeout(180000);
  await login(page);
  await mkdir("test-results/round14/after", { recursive: true });
  const prefix = "round14-" + Date.now();
  const fixtures: { id: string; version: number; slug: string; title: string }[] = [];
  for (const [index, [kind, category, title]] of [
    ["article", "技术", "技术文章"],
    ["article", "生活", "生活长文：一次散步的观察"],
    ["journal", "生活", "生活随记：傍晚的光"],
    ["journal", "技术", "技术随记：一个接口的想法"],
    ["note", "生活", "生活笔记：读书摘记"],
  ].entries()) {
    const slug = prefix + "-" + index;
    const draft = {
      slug,
      metadata: {
        title: prefix + " " + title,
        description: "隔离测试的演示记录，不会发布到生产。",
        date: "2026-09-30",
        kind,
        category,
        tags: [prefix, "记录"],
        published: false,
        featured: false,
      },
      body:
        index === 1
          ? "## 出门之前\n\n这是一篇隔离测试中的虚构散步记录。放下屏幕，把注意力转向街道上的声音、光线和缓慢变化的季节。生活长文与技术文章使用相同的阅读布局。\n\n## 路上的观察\n\n街角的树影落在台阶上，行人各自走向不同的方向。记录不需要预设结论，可以从一个具体的细节开始，再慢慢整理当时的感受。\n\n一段较长的文字可以容纳背景、过程与回望；简短的随记则保留一个瞬间。形式决定表达的长度与节奏，分类负责说明主题，两者彼此独立。\n\n## 想要记住的事\n\n- 给日常留出观察的时间。\n- 用准确的文字描述一个细节。\n- 发布之前检查哪些信息适合公开。\n\n这些段落仅用于本机测试，不是真实个人经历，也不会进入生产博客。"
          : "## 记录\n\n这是隔离测试内容，用于验证生活与技术可以采用不同内容形式。",
    };
    const response = await page.request.post("/api/admin/posts", {
      headers: { Origin: origin },
      data: draft,
    });
    expect(response.status()).toBe(201);
    let row = await response.json();
    expect((await page.request.get("/posts/" + slug)).status()).toBe(404);
    const published = await page.request.post("/api/admin/posts/" + row.id, {
      headers: { Origin: origin },
      data: { action: "publish", version: row.version },
    });
    expect(published.ok()).toBe(true);
    row = await published.json();
    fixtures.push({ id: row.id, version: row.version, slug, title: draft.metadata.title });
  }
  await failJournalFixtureIndex(fixtures[2].id);
  await page.goto("/admin/posts?q=" + prefix);
  await expect(page.locator("tbody tr")).toHaveCount(5);
  const failure = page.locator("summary").filter({ hasText: "索引失败" });
  await failure.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("检索索引暂不可用，不影响内容的发布状态。可在编辑页查看并重试。"),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("navigation", { name: "管理内容分页" })).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "管理导航" }).getByRole("link", { name: /查看博客/ }),
  ).toHaveCount(0);
  const geometry: unknown[] = [];
  for (const width of [1440, 1280, 390, 360]) {
    for (const colorScheme of ["light", "dark"] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await expect(page.locator("html")).toHaveAttribute("data-theme", colorScheme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: `test-results/round14/after/list-${width}-${colorScheme}.png`,
        animations: "disabled",
        fullPage: true,
      });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const zoom of [1, 1.25]) {
    await page.evaluate((zoom) => {
      document.documentElement.style.zoom = String(zoom);
    }, zoom);
    const boxes = await page
      .locator('main form input:not([type="hidden"]), main form button, main form a')
      .evaluateAll((els) =>
        els.map((el) => ({
          label: el.textContent,
          rect: el.getBoundingClientRect().toJSON(),
          parentAlign: getComputedStyle(el.parentElement!).alignItems,
        })),
      );
    for (const box of boxes) expect(Math.abs(box.rect.height / zoom - 44)).toBeLessThanOrEqual(1);
    // Wrapped rows are allowed; within each visual row all control edges agree.
    const tops: number[] = [];
    for (const box of boxes) {
      const near = tops.find((top) => Math.abs(top - box.rect.top) < 22 * zoom);
      if (near === undefined) tops.push(box.rect.top);
      else expect(Math.abs(near - box.rect.top)).toBeLessThanOrEqual(1);
    }
    geometry.push({ zoom, boxes });
  }
  await writeFile("test-results/round14/after/geometry.json", JSON.stringify(geometry, null, 2));
  await page.evaluate(() => {
    document.documentElement.style.zoom = "1";
  });
  await select(page, "内容形式", "随记");
  await select(page, "分类", "技术");
  await select(page, "标签", prefix);
  await page.route("**/admin/posts?**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  const submit = page.getByRole("button", { name: "筛选", exact: true });
  const beforePending = await submit.boundingBox();
  await page.getByRole("button", { name: "筛选", exact: true }).click();
  await expect(submit).toBeDisabled();
  expect((await submit.boundingBox())?.height).toBe(beforePending?.height);
  for (let frame = 0; frame < 3; frame++)
    await page.screenshot({ path: `test-results/round14/after/pending-${frame}.png` });
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.unrouteAll({ behavior: "wait" });
  await page.reload();
  await expect(page.getByRole("combobox", { name: "分类", exact: true })).toHaveText("技术");
  await page.getByRole("link", { name: "清空", exact: true }).click();
  await expect(page.getByLabel("标题关键词")).toHaveValue("");
  await expect(page.getByRole("combobox", { name: "内容形式" })).toHaveText("全部");
  await page.goBack();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.goto("/admin/posts?pageSize=20");
  await page.getByLabel("标题关键词").fill("尚未提交的筛选");
  await select(page, "内容形式", "随记");
  await page.getByRole("link", { name: "清空", exact: true }).click();
  await expect(page.getByLabel("标题关键词")).toHaveValue("");
  await expect(page.getByRole("combobox", { name: "内容形式" })).toHaveText("全部");
  const journal = fixtures[3];
  await page.goto("/admin/posts/" + journal.id + "/edit");
  await page.getByLabel("标题", { exact: true }).fill("尚未保存的标题");
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("link", { name: "查看博客 ↗" }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  await popup.close();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("标题", { exact: true })).toHaveValue("尚未保存的标题");
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByRole("button", { name: "管理菜单" }).click();
  await page.screenshot({
    path: "test-results/round14/after/mobile-shortcuts.png",
    animations: "disabled",
  });
  const mobilePopup = page.waitForEvent("popup");
  await page.getByRole("dialog").getByRole("link", { name: "查看博客 ↗" }).click();
  await (await mobilePopup).close();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByLabel("标题", { exact: true })).toHaveValue("尚未保存的标题");
  await page.setViewportSize({ width: 1440, height: 900 });
  await select(page, "类型", "文章");
  await expect(page.getByLabel("分类", { exact: true })).toHaveValue("技术");
  await expect(page.getByLabel("Markdown 正文")).toHaveValue(/隔离测试内容/);
  await select(page, "类型", "随记");
  await page.getByLabel("标题", { exact: true }).fill(journal.title);
  await page.getByLabel("Markdown 正文").fill("## 记录\n\n随记编辑后的草稿。");
  const saveResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/admin/posts/" + journal.id) &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  journal.version = (await (await saveResponse).json()).version;
  await expect(page.getByRole("status").first()).toContainText("草稿已保存");
  await page.getByRole("link", { name: "预览已保存草稿" }).click();
  await expect(page.getByText("随记编辑后的草稿。", { exact: true })).toBeVisible();
  for (const fixture of [fixtures[1], fixtures[2]]) {
    await page.goto("/admin/posts/" + fixture.id + "/edit");
    for (const width of [1440, 1280, 390, 360])
      for (const colorScheme of ["light", "dark"] as const) {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({
          path: `test-results/round14/after/editor-${fixture.slug.slice(-1)}-${width}-${colorScheme}.png`,
          animations: "disabled",
          fullPage: true,
        });
      }
    await page.goto("/posts/" + fixture.slug);
    await expect(page.getByRole("heading", { name: fixture.title, exact: true })).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: "light" });
    await page.screenshot({
      path: `test-results/round14/after/public-${fixture.slug.slice(-1)}.png`,
      animations: "disabled",
      fullPage: true,
    });
    await page.setViewportSize({ width: 360, height: 900 });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.screenshot({
      path: `test-results/round14/after/public-${fixture.slug.slice(-1)}-mobile.png`,
      animations: "disabled",
      fullPage: true,
    });
  }
  await page.goto("/posts?kind=journal&category=" + encodeURIComponent("技术") + "&tag=" + prefix);
  await expect(page.getByRole("status")).toContainText("共 1 篇");
  await page.reload();
  await expect(page.getByRole("combobox", { name: "分类", exact: true })).toHaveText("技术");
  await select(page, "分类", "生活");
  await expect(page.getByRole("status")).toContainText("共 1 篇");
  await page.goBack();
  await expect(page.getByRole("combobox", { name: "分类", exact: true })).toHaveText("技术");
  const exported = await (await page.request.get("/api/admin/export")).text();
  expect(exported).toContain("journal");
  expect(exported).toContain("生活");
  for (const fixture of fixtures) {
    const saved = await page.request.post("/api/admin/posts/" + fixture.id, {
      headers: { Origin: origin },
      data: { action: "unpublish", version: fixture.version },
    });
    expect(saved.ok()).toBe(true);
    const row = await saved.json();
    expect((await page.request.get("/posts/" + fixture.slug)).status()).toBe(404);
    const removed = await page.request.post("/api/admin/posts/" + fixture.id, {
      headers: { Origin: origin },
      data: { action: "delete", version: row.version },
    });
    expect(removed.ok()).toBe(true);
  }
  expect(await (await page.request.get("/feed.xml")).text()).not.toContain(prefix);
  expect(await (await page.request.get("/sitemap.xml")).text()).not.toContain(prefix);
  expect((await (await page.request.get("/api/search?q=" + prefix)).json()).results).toEqual([]);
});
