import { expect, test, type Page } from "@playwright/test";

function fakeChatStream(): string {
  const source = {
    id: "nextjs-concurrent-rendering:mechanism",
    index: 1,
    title: "理解 Next.js 15 的并发渲染机制",
    heading: "并发渲染的工作方式",
    url: "/posts/nextjs-concurrent-rendering#并发渲染的工作方式",
  };
  const chunks = [
    { type: "start" },
    { type: "data-ragStatus", data: { status: "used", sourceCount: 1 } },
    { type: "data-sources", data: [source] },
    { type: "text-start", id: "answer" },
    { type: "text-delta", id: "answer", delta: "并发渲染让 React 可以中断并恢复非紧急更新。" },
    { type: "text-end", id: "answer" },
    { type: "finish", finishReason: "stop" },
  ];
  return `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`;
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        width: innerWidth,
      })),
    )
    .toEqual({ documentWidth: 360, width: 360 });
}

test("首页 AI 面板折叠偏好持久化", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /记录技术.*知识可以被提问/ })).toBeVisible();
  await page.getByRole("button", { name: "收起 AI 问答面板" }).click();
  await expect(page.getByRole("button", { name: "展开 AI 问答面板" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "展开 AI 问答面板" })).toBeVisible();
  await page.getByRole("button", { name: "展开 AI 问答面板" }).click();
  await expect(page.getByRole("button", { name: "收起 AI 问答面板" })).toBeVisible();
});

test("搜索支持快捷键、键盘导航、空结果与旧请求取消", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "搜索内容" }).click();
  await expect(page.getByRole("dialog", { name: "搜索 Ting Lab" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+K");
  const input = page.getByRole("combobox", { name: "搜索内容" });
  await expect(input).toBeFocused();
  await input.fill("Next.js 并发");
  await expect(page.getByRole("option").first()).toContainText("Next.js");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/posts\/nextjs-concurrent-rendering$/);

  await page.keyboard.press("/");
  await input.fill("绝对不存在的内容 xyz");
  await expect(page.getByText("没有找到相关内容，试试更短的关键词。")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "搜索 Ting Lab" })).toBeHidden();

  await page.route("**/api/search?*", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q") ?? "";
    await new Promise((resolve) => setTimeout(resolve, query === "React" ? 350 : 10));
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        query,
        results:
          query === "React" ? [{ id: "stale", title: "旧 React 结果", href: "/posts/stale" }] : [],
      }),
    });
  });
  await page.keyboard.press("Control+K");
  await input.fill("React");
  await page.waitForTimeout(230);
  await input.fill("new-query");
  await expect(page.getByText("没有找到相关内容，试试更短的关键词。")).toBeVisible();
  await page.waitForTimeout(400);
  await expect(page.getByText("旧 React 结果")).toHaveCount(0);
});

test("主题支持 light/dark/system 并在刷新前完成初始化", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: /主题：/ }).click();
  await page.getByRole("radio", { name: "浅色" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.getByRole("button", { name: /主题：/ }).click();
  await page.getByRole("radio", { name: "跟随系统" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme-preference", "system");
});

test("fake AI 一次提交只产生一轮回答，共享到工作区并可打开来源抽屉", async ({ page }) => {
  let postCount = 0;
  await page.route("**/api/chat", async (route) => {
    postCount += 1;
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "x-vercel-ai-ui-message-stream": "v1",
      },
      body: fakeChatStream(),
    });
  });
  await page.goto("/");
  await page.getByLabel("输入问题").fill("什么是并发渲染？");
  await page.getByRole("button", { name: "发送问题" }).click();
  await expect(page.getByText("并发渲染让 React 可以中断并恢复非紧急更新。")).toHaveCount(1);
  expect(postCount).toBe(1);

  await page.getByRole("link", { name: "进入完整 AI 页面" }).click();
  await expect(page).toHaveURL(/\/ai$/);
  await expect(page.getByText("什么是并发渲染？")).toBeVisible();
  await page.waitForLoadState("networkidle");
  const source = page.getByRole("link", { name: /理解 Next\.js 15 的并发渲染机制/ });
  await expect(async () => {
    await source.click();
    await expect(page).toHaveURL(/\/ai\?post=nextjs-concurrent-rendering/, { timeout: 1_000 });
  }).toPass();
  const drawer = page.getByRole("dialog", { name: "理解 Next.js 15 的并发渲染机制" });
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(source).toBeFocused();
  await expect(page.getByText("并发渲染让 React 可以中断并恢复非紧急更新。")).toHaveCount(1);
  expect(postCount).toBe(1);
});

test("360px 下核心页面与移动搜索无横向溢出", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const path of [
    "/",
    "/posts",
    "/projects",
    "/about",
    "/ai?post=nextjs-concurrent-rendering",
  ]) {
    await page.goto(path);
    await expectNoHorizontalOverflow(page);
  }
  await page.goto("/");
  await page.locator('summary[aria-label="导航菜单"]').click();
  await page.getByRole("button", { name: "搜索" }).click();
  await expect(page.getByRole("dialog", { name: "搜索 Ting Lab" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("项目导航、详情与公开外链行为正确", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "项目", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole("heading", { name: "项目案例" })).toBeVisible();
  await page.getByRole("link", { name: "查看案例" }).first().click();
  await expect(page).toHaveURL(/\/projects\/ting-lab$/);
  await expect(page.getByRole("heading", { name: "Ting Lab" })).toBeVisible();
  const repository = page.getByRole("link", { name: /查看代码/ });
  await expect(repository).toHaveAttribute("target", "_blank");
  await expect(repository).toHaveAttribute("rel", /noopener/);
  await page.getByRole("link", { name: "返回项目列表" }).click();
  await page.getByRole("link", { name: "可配置 AI 对话流 Demo" }).first().click();
  await expect(page.getByRole("link", { name: /查看代码/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /访问线上站点/ })).toHaveCount(0);
});

test("站内搜索标识项目并进入项目详情", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "搜索内容" }).click();
  await page.getByRole("combobox", { name: "搜索内容" }).fill("组件注册表");
  const result = page.getByRole("option").first();
  await expect(result).toContainText("项目");
  await expect(result).toContainText("可配置 AI 对话流 Demo");
  await result.getByRole("link").click();
  await expect(page).toHaveURL(/\/projects\/configurable-ai-dialogue-flow$/);
});

test("关于页在深色主题和窄屏下保持可读且无溢出", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await page.locator('summary[aria-label="导航菜单"]').click();
  await page.getByRole("link", { name: "关于", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("heading", { name: "我在做什么" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "能力地图" })).toBeVisible();
  await expect(page.getByRole("link", { name: /GitHub/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.goto("/projects");
  await expectNoHorizontalOverflow(page);
  await page.goto("/projects/configurable-ai-dialogue-flow");
  await expectNoHorizontalOverflow(page);
});
