import { test, expect, type Page } from "@playwright/test";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAACgAAAAeCAIAAADRv8uKAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAPklEQVR4nO3VQQ0AMAwCwPmXgBMk4Goytscl/TdpKHfWPJljcZ16whXvVAUylRlIFIvBYrE4LAaLxeK+YvECMQ/jyCwissoAAAAASUVORK5CYII=",
  "base64",
);
async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("管理员密码").fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
}
test.skip(!process.env.MEDIA_SERVICE_URL, "Requires isolated media service");
test("unsaved preview, uploads, publication permissions, shared rendering and library", async ({
  page: loginPage,
  browser,
  request,
}, info) => {
  await login(loginPage);
  // Start recording after authentication; never record credentials or login fields.
  const recording = await browser.newContext({
    baseURL: "http://localhost:3201",
    storageState: await loginPage.context().storageState(),
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: info.outputPath("video"), size: { width: 1440, height: 900 } },
  });
  const page = await recording.newPage();
  try {
    await page.goto("/admin/posts/new");
    const slug = `round16-${Date.now()}`;
    await page.getByLabel("标题", { exact: true }).fill("图片与代码的草稿");
    await page.getByLabel("描述", { exact: true }).fill("未保存内容预览与媒体权限回归");
    await page.getByLabel("Slug", { exact: true }).fill(slug);
    await page.getByLabel("分类", { exact: true }).fill("测试");
    await page.getByLabel("标签（逗号分隔）").fill("Media");
    const editor = page.getByLabel("Markdown 正文");
    await editor.fill('## 未保存标题\n\n```typescript\nconst text = "你好";\n```\n\n');
    await page.getByRole("button", { name: "分屏", exact: true }).click();
    await expect(page.getByRole("heading", { name: "未保存标题" })).toBeVisible({ timeout: 30000 });
    expect((await request.get(`/posts/${slug}`)).status()).toBe(404);
    await page.screenshot({ path: info.outputPath("unsaved-split.png"), fullPage: true });
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 850 });
      await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
      await page.getByRole("button", { name: "预览", exact: true }).click();
      await expect(page.getByRole("heading", { name: "未保存标题" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({ path: info.outputPath(`editor-${width}-dark.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
    await page.getByRole("button", { name: "分屏", exact: true }).click();
    await editor.focus();
    await editor.press("Control+End");
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer: png });
    await expect(editor).toHaveValue(/\/media\/[a-f0-9-]+/, { timeout: 15000 });
    const body = await editor.inputValue(),
      id = /\/media\/([a-f0-9-]+)/.exec(body)![1];
    expect((await request.get(`/media/${id}`)).status()).toBe(404);
    expect((await page.request.get(`/media/${id}`)).status()).toBe(200);
    await expect(page.getByRole("button", { name: /放大图片/ })).toBeVisible({ timeout: 30000 });
    await page.getByRole("button", { name: /放大图片/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.screenshot({ path: info.outputPath("preview-lightbox.png"), fullPage: true });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(page).toHaveURL(/\/edit$/);
    const editUrl = page.url();
    await page.getByRole("button", { name: "发布", exact: true }).click();
    await page.getByRole("button", { name: "确认发布", exact: true }).click();
    await expect(page.getByRole("status").first()).toContainText("已发布");
    const image = await request.get(`/media/${id}`);
    expect(image.status()).toBe(200);
    expect(image.headers()["cache-control"]).toContain("must-revalidate");
    expect(
      (
        await request.get(`/media/${id}`, { headers: { "If-None-Match": image.headers().etag } })
      ).status(),
    ).toBe(304);
    await page.goto(`/posts/${slug}`);
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: "复制代码", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("已复制");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('const text = "你好";');
    await page.screenshot({ path: info.outputPath("public-code.png"), fullPage: true });
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 850 });
      await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({ path: info.outputPath(`public-${width}-dark.png`), fullPage: true });
    }
    await page.goto(editUrl);
    await page.getByRole("button", { name: "取消发布", exact: true }).click();
    await page.getByRole("button", { name: "确认取消发布", exact: true }).click();
    await expect(page.getByRole("status").first()).toContainText("公开入口移除");
    expect(
      (
        await request.get(`/media/${id}`, { headers: { "If-None-Match": image.headers().etag } })
      ).status(),
    ).toBe(404);
    const denied = await page.request.delete(`/api/admin/media/${id}`, {
      headers: { Origin: "http://localhost:3201" },
    });
    expect(denied.status()).toBe(409);
    await page.goto("/admin/media");
    await expect(page.getByText("fixture.png", { exact: true }).first()).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect
      .poll(() =>
        page
          .locator("article img")
          .evaluateAll((images) =>
            images
              .filter((image) => image.getBoundingClientRect().top < innerHeight)
              .every(
                (image) =>
                  image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
              ),
          ),
      )
      .toBe(true);
    await page.screenshot({ path: info.outputPath("media-library.png") });
  } finally {
    await recording.close();
  }
});

test("late upload preserves typing; deleting anchor prevents resurrection; failure is retryable", async ({
  page,
}, info) => {
  await login(page);
  await page.goto("/admin/posts/new");
  let release: () => void = () => {};
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/admin/media", async (route) => {
    await waiting;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ id: "11111111-1111-4111-8111-111111111111" }),
    });
  });
  const editor = page.getByLabel("Markdown 正文");
  await editor.fill("before\n");
  await editor.focus();
  await editor.press("Control+End");
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "slow.png", mimeType: "image/png", buffer: png });
  await expect(editor).toHaveValue(/⟦上传:/);
  await editor.press("Control+End");
  await editor.pressSequentially("typed after upload started");
  await page.screenshot({ path: info.outputPath("upload-pending.png"), fullPage: true });
  release();
  await expect(editor).toHaveValue(/\/media\/11111111/);
  expect(await editor.inputValue()).toContain("typed after upload started");
  await page.unroute("**/api/admin/media");
  let finish: () => void = () => {},
    settled = false;
  const late = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route("**/api/admin/media", async (route) => {
    await late;
    await route
      .fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: "33333333-3333-4333-8333-333333333333" }),
      })
      .catch(() => {});
    settled = true;
  });
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "cancelled.png", mimeType: "image/png", buffer: png });
  await expect(editor).toHaveValue(/⟦上传:/);
  await editor.fill("deleted while uploading");
  finish();
  await expect.poll(() => settled).toBe(true);
  await expect(editor).toHaveValue("deleted while uploading");
  await page.unroute("**/api/admin/media");
  await page.route("**/api/admin/media", (route) =>
    route.fulfill({
      status: 413,
      contentType: "application/json",
      body: JSON.stringify({ message: "图片超过上传大小限制" }),
    }),
  );
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "failed.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("button", { name: "重试", exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("upload-failed.png"), fullPage: true });
  await editor.fill("anchor deleted; body retained");
  await expect(page.getByRole("button", { name: "重试", exact: true })).toHaveCount(0);
});

test("mixed paste maintains multiple anchors and native toolbar undo", async ({ page }) => {
  await login(page);
  await page.goto("/admin/posts/new");
  const editor = page.getByLabel("Markdown 正文");
  await editor.fill("selected");
  await editor.focus();
  await editor.press("Control+a");
  await page.getByRole("button", { name: "粗体", exact: true }).click();
  await expect(editor).toHaveValue("**selected**");
  await editor.press("Control+z");
  await expect(editor).toHaveValue("selected");
  let count = 0;
  await page.route("**/api/admin/media", async (route) => {
    count++;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id:
          count === 1
            ? "11111111-1111-4111-8111-111111111111"
            : "22222222-2222-4222-8222-222222222222",
      }),
    });
  });
  await editor.focus();
  await editor.press("Control+End");
  await editor.evaluate((element, base64) => {
    const clipboard = new DataTransfer();
    clipboard.setData("text/plain", "mixed text");
    for (const name of ["first.png", "second.png"])
      clipboard.items.add(
        new File([Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))], name, {
          type: "image/png",
        }),
      );
    element.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: clipboard, bubbles: true, cancelable: true }),
    );
  }, png.toString("base64"));
  await expect(editor).toHaveValue(/selectedmixed text[\s\S]*11111111[\s\S]*22222222/);
  expect(count).toBe(2);
});
