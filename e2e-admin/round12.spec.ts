import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("管理员密码").fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await mkdir("test-results/round12/screenshots", { recursive: true });
}
test("45 isolated articles: filters, pagination, export and mobile shell", async ({ page }) => {
  await login(page);
  const prefix = `round12-${Date.now()}`;
  for (let index = 0; index < 45; index++) {
    const response = await page.request.post("/api/admin/posts", {
      headers: { Origin: "http://localhost:3201" },
      data: {
        slug: `${prefix}-${index}`,
        metadata: {
          title: `${prefix} ${index}`,
          description: "Pagination fixture",
          date: "2026-09-29",
          category: "Test",
          tags: ["Test"],
          kind: index % 2 ? "note" : "article",
          featured: false,
          published: false,
        },
        body: "Test body, never exported from production.",
      },
    });
    expect(response.status()).toBe(201);
  }
  await page.goto(`/admin/posts?q=${prefix}`);
  await expect(page.getByText(/共 45 篇/)).toBeVisible();
  await expect(page.locator("main tbody tr")).toHaveCount(20);
  await page.getByRole("link", { name: "下一页", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await page.getByRole("link", { name: "下一页", exact: true }).click();
  await expect(page.locator("main tbody tr")).toHaveCount(5);
  await page.getByRole("combobox", { name: "每页条数" }).click();
  await page.getByRole("option", { name: "50", exact: true }).click();
  await page.getByRole("button", { name: "筛选", exact: true }).click();
  await expect(page.locator("main tbody tr")).toHaveCount(45);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    animations: "disabled",
    path: "test-results/round12/screenshots/admin-list.png",
  });
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.getByRole("button", { name: "导出内容", exact: true }).click();
  await page.screenshot({
    animations: "disabled",
    path: "test-results/round12/screenshots/export-dialog.png",
  });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "确认导出" }).click();
  expect((await download).suggestedFilename()).toMatch(/^ting-lab-content-.*\.json$/);
  await expect(page.getByRole("status")).toContainText("已发起下载");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({
    animations: "disabled",
    path: "test-results/round12/screenshots/admin-list-mobile.png",
  });
  await page.getByRole("button", { name: "管理菜单" }).click();
  await page.screenshot({
    animations: "disabled",
    path: "test-results/round12/screenshots/admin-sheet-mobile.png",
  });
  await page.getByRole("dialog").getByRole("link", { name: "模型配置" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("export errors never download, pending prevents duplicates", async ({ page }) => {
  await login(page);
  await page.goto("/admin/posts");
  let calls = 0;
  let downloads = 0;
  page.on("download", () => downloads++);
  await page.route("**/api/admin/export", async (route) => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: '{"message":"failure"}',
    });
  });
  await page.getByRole("button", { name: "导出内容", exact: true }).click();
  await page.getByRole("button", { name: "确认导出" }).click();
  await expect(page.getByRole("button", { name: "确认导出" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "重试导出" })).toBeVisible();
  expect(calls).toBe(1);
  expect(downloads).toBe(0);
  await page.unroute("**/api/admin/export");
  await page.route("**/api/admin/export", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: "{}" }),
  );
  await page.getByRole("button", { name: "重试导出" }).click();
  await expect(page.getByRole("link", { name: "返回登录" })).toBeVisible();
  expect(downloads).toBe(0);
});

test("failed save preserves input and model tests preserve dirty chat", async ({ page }) => {
  await login(page);
  await page.goto("/admin/posts/new");
  await expect(page.getByText(/尚未保存/)).toBeVisible();
  await page.getByLabel("标题", { exact: true }).fill("Keep this title");
  await page.getByLabel("描述", { exact: true }).fill("Keep this description");
  await page.getByLabel("Slug", { exact: true }).fill("round12-save-failure");
  await page.getByLabel("分类", { exact: true }).fill("Test");
  await page.getByLabel("标签（逗号分隔）").fill("中文，标签，中文");
  await page.route("**/api/admin/posts", (route) =>
    route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ message: "内容已在其他页面更新。请复制当前编辑，再刷新页面。" }),
    }),
  );
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("其他页面更新");
  await expect(page.getByLabel("标题", { exact: true })).toHaveValue("Keep this title");
  await expect(page.getByLabel("标签（逗号分隔）")).toHaveValue("中文，标签，中文");
  await page.screenshot({
    animations: "disabled",
    path: "test-results/round12/screenshots/editor.png",
  });
  await page.getByRole("link", { name: "模型配置", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("有未保存的修改");
  await page.getByRole("button", { name: "继续编辑" }).click();
  await expect(page.getByLabel("标题", { exact: true })).toHaveValue("Keep this title");
  await page.getByRole("link", { name: "模型配置", exact: true }).click();
  await page.getByRole("button", { name: "确认离开" }).click();
  await expect(page).toHaveURL(/\/admin\/settings\/ai$/);
  await page.getByLabel("模型", { exact: true }).fill("unsaved-chat-model");
  await page.route("**/api/admin/settings/test", (route) =>
    route.fulfill({ contentType: "application/json", body: '{"ok":true,"durationMs":12}' }),
  );
  const embedding = page.getByRole("button", { name: "测试 Embedding 连接", exact: true });
  await expect(embedding).toBeEnabled();
  {
    await embedding.click();
    await page.getByRole("button", { name: "确认测试" }).click();
    await expect(page.getByRole("status").last()).toContainText("连接成功");
    await expect(page.getByLabel("模型", { exact: true })).toHaveValue("unsaved-chat-model");
  }
  await page.screenshot({
    animations: "disabled",
    path: "test-results/round12/screenshots/model-settings.png",
  });
});
