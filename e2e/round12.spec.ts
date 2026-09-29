import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

async function geometry(page: Page) {
  return page.evaluate(() => {
    const box = (selector: string) => {
      const r = document.querySelector(selector)!.getBoundingClientRect();
      return { x: r.x, width: r.width };
    };
    const body = getComputedStyle(document.body);
    return {
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      overflow: body.overflow,
      margin: body.marginRight,
      padding: body.paddingRight,
      scrollY,
      header: box("header"),
      main: box("main"),
    };
  });
}
test("navigation, portal bounds and scroll compensation", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(
    page.getByRole("navigation", { name: "主导航", exact: true }).locator("[aria-current]"),
  ).toHaveCount(0);
  await page.goto("/posts");
  await page.waitForLoadState("networkidle");
  const before = await geometry(page);
  if (info.project.name === "chromium")
    expect(before.innerWidth - before.clientWidth).toBeGreaterThan(0);
  await page.getByRole("combobox", { name: "标签", exact: true }).click();
  const during = await geometry(page);
  for (const key of ["header", "main"] as const) {
    expect(Math.abs(before[key].x - during[key].x)).toBeLessThanOrEqual(1);
    expect(Math.abs(before[key].width - during[key].width)).toBeLessThanOrEqual(1);
  }
  await mkdir("test-results/round12/screenshots", { recursive: true });
  await page.screenshot({ path: "test-results/round12/screenshots/posts-select.png" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "搜索内容", exact: true }).click();
  const overlay = await page.locator('[data-slot="dialog-overlay"]').boundingBox();
  expect(overlay).toEqual({ x: 0, y: 0, width: 1440, height: 900 });
  await page.screenshot({ path: "test-results/round12/screenshots/search-desktop.png" });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "搜索内容", exact: true })).toBeFocused();
  await writeFile(
    `test-results/round12/geometry-${info.project.name}.json`,
    JSON.stringify({ before, during, after: await geometry(page) }, null, 2),
  );
  await info.attach("geometry", {
    body: JSON.stringify({ before, during, after: await geometry(page) }),
    contentType: "application/json",
  });
  await page.goto("/");
  await page.getByRole("button", { name: "搜索内容", exact: true }).click();
  await page.screenshot({ path: "test-results/round12/screenshots/search-home.png" });
});

test("search invalidates results immediately and ignores composing Enter", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "搜索内容", exact: true }).click();
  const input = page.getByRole("combobox", { name: "搜索内容" });
  await input.fill("Next.js");
  await expect(page.getByRole("option").first()).toBeVisible();
  await input.dispatchEvent("keydown", { key: "Enter", keyCode: 229, isComposing: true });
  await expect(page).toHaveURL(/\/$/);
  await input.fill("no-match-new-query");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: "关闭搜索" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("mobile search restores visible focus and theme persists", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("button", { name: "导航菜单", exact: true }).click();
  await page.getByRole("button", { name: "搜索", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "导航菜单", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "导航菜单", exact: true }).click();
  await page
    .getByRole("button", { name: /主题：/ })
    .last()
    .click();
  await page.getByRole("menuitemradio", { name: "深色", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("Control+k");
  await page.screenshot({ path: "test-results/round12/screenshots/search-dark-mobile.png" });
});

test("storage unavailable still supports synchronized theme controls", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error("storage unavailable");
    };
    Storage.prototype.setItem = () => {
      throw new Error("storage unavailable");
    };
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: /主题：/ })
    .first()
    .click();
  await page.getByRole("menuitemradio", { name: "深色", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "导航菜单" }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "主题：深色" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "主题：深色" }).click();
  await page.getByRole("menuitemradio", { name: "浅色", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("search retries share cancellation lifecycle", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/search?*", async (route) => {
    if (++attempts === 1) return route.fulfill({ status: 503, body: "{}" });
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ query: "retry", results: [] }),
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "搜索内容", exact: true }).click();
  await page.getByRole("combobox", { name: "搜索内容" }).fill("retry");
  await page.getByRole("button", { name: "重试", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
});
