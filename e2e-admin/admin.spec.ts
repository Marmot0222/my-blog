import { test, expect } from "@playwright/test";

test("unauthenticated APIs, preview and cross-origin writes are denied", async ({
  request,
  page,
}) => {
  for (const endpoint of ["export", "settings"]) {
    const response = await request.get(`/api/admin/${endpoint}`);
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
  const denied = await request.post("/api/admin/posts", {
    headers: { Origin: "http://localhost:3201" },
    data: {},
  });
  expect(denied.status()).toBe(401);
  const csrf = await request.post("/api/admin/login", {
    headers: { Origin: "https://evil.example" },
    data: { password: "unused" },
  });
  expect(csrf.status()).toBe(403);
  await page.goto("/admin/posts/00000000-0000-4000-8000-000000000000/preview");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("login → draft → preview → publish → draft isolation → republish → withdraw", async ({
  page,
  request,
}, testInfo) => {
  const suffix = Date.now(),
    slug = `browser-${suffix}`,
    title = `Browser fixture ${suffix}`;
  await page.goto("/admin/login");
  await page.getByLabel("管理员密码").fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("link", { name: "新建草稿" }).click();
  await page.getByLabel("标题", { exact: true }).fill(title);
  await page.getByLabel("描述", { exact: true }).fill("Browser workflow fixture");
  await page.getByLabel("Slug", { exact: true }).fill(slug);
  await page.getByLabel("分类", { exact: true }).fill("Test");
  await page.getByLabel("标签（逗号分隔）").fill("BrowserTest");
  await page.getByLabel("Markdown 正文").fill("## Original heading\n\nPublic original body.");
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/posts\/[^/]+\/edit$/);
  await expect(page.getByLabel("Slug", { exact: true })).toHaveValue(slug);
  const editURL = page.url();
  expect((await request.get(`/posts/${slug}`)).status()).toBe(404);
  await page.getByRole("link", { name: "预览已保存草稿" }).click();
  await expect(page.getByRole("heading", { name: "Original heading" })).toBeVisible();
  await page.getByRole("link", { name: "返回编辑" }).click();
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await page.getByRole("button", { name: "确认发布", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已发布");
  const first = await request.get(`/posts/${slug}`);
  expect(first.status()).toBe(200);
  expect(await first.text()).toContain("Public original body.");
  expect(
    JSON.stringify(await (await request.get(`/api/search?q=${encodeURIComponent(title)}`)).json()),
  ).toContain(slug);
  expect(await (await request.get("/feed.xml")).text()).toContain(slug);
  expect(await (await request.get("/sitemap.xml")).text()).toContain(slug);
  expect(await (await request.get("/tags/browsertest")).text()).toContain(title);
  await page.getByLabel("Markdown 正文").fill("## Revised heading\n\nPublic revised body.");
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("草稿已保存");
  const unchanged = await (await request.get(`/posts/${slug}`)).text();
  expect(unchanged).toContain("Public original body.");
  expect(unchanged).not.toContain("Public revised body.");
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await page.getByRole("button", { name: "确认发布", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已发布");
  expect(await (await request.get(`/posts/${slug}`)).text()).toContain("Public revised body.");
  await page.screenshot({ path: testInfo.outputPath("admin-editor-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("admin-editor-mobile.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "取消发布", exact: true }).click();
  await page.getByRole("button", { name: "确认取消发布", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("公开入口移除");
  expect((await request.get(`/posts/${slug}`)).status()).toBe(404);
  expect(
    JSON.stringify(await (await request.get(`/api/search?q=${encodeURIComponent(title)}`)).json()),
  ).not.toContain(slug);
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain(slug);
  await page.goto(editURL);
  await expect(page.getByLabel("Markdown 正文")).toHaveValue(/Public revised body/);
  const exported = await page.request.get("/api/admin/export");
  expect(exported.status()).toBe(200);
  expect(await exported.text()).toContain(slug);
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  expect((await page.request.get("/api/admin/settings")).status()).toBe(401);
});

test("configuration save, fake connection feedback, activation and secret redaction", async ({
  page,
}, testInfo) => {
  await page.goto("/admin/login");
  await page.getByLabel("管理员密码").fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/settings/ai");
  await page.getByLabel("启用 Chat").check();
  await page.getByLabel("模型", { exact: true }).fill("fixture-chat");
  await page.getByRole("combobox", { name: "Key 操作" }).click();
  await page.getByRole("option", { name: "替换 Key", exact: true }).click();
  const key = "fixture-browser-secret-never-sent";
  await page.getByLabel("新 API Key").fill(key);
  await page.getByRole("button", { name: "保存配置草稿" }).click();
  await expect(page.getByRole("status")).toContainText("尚未激活");
  await expect(page.getByLabel("新 API Key")).toHaveCount(0);
  // UI feedback uses a fake HTTP boundary. Real provider adapter is tested with a fake model separately.
  await page.route("**/api/admin/settings/test", (route) =>
    route.fulfill({ json: { ok: true, durationMs: 5, code: "CONNECTED" } }),
  );
  await page.getByRole("button", { name: "测试 Chat 连接" }).click();
  await page.getByRole("button", { name: "确认测试" }).click();
  await expect(page.getByRole("status")).toContainText("连接成功");
  await page.getByRole("button", { name: "激活配置" }).click();
  await expect(page.getByRole("status")).toContainText("已激活");
  const summary = await (await page.request.get("/api/admin/settings")).text();
  expect(summary).not.toContain(key);
  expect(summary).not.toContain("ciphertext");
  expect(summary).not.toContain("nonce");
  await page.reload();
  await expect(page.getByLabel("模型", { exact: true })).toHaveValue("fixture-chat");
  expect(await page.content()).not.toContain(key);
  await page.screenshot({ path: testInfo.outputPath("admin-model-settings.png"), fullPage: true });
  await page.getByLabel("启用 Chat").uncheck();
  await page.getByRole("button", { name: "保存配置草稿" }).click();
  await expect(page.getByRole("status")).toContainText("尚未激活");
  await page.getByRole("button", { name: "激活配置" }).click();
  await expect(page.getByRole("status")).toContainText("已激活");
});
