import { expect, test } from "@playwright/test";

test("即时筛选、干净 URL、分页与历史恢复", async ({ page }) => {
  await page.goto("/posts");
  await expect(page.getByRole("button", { name: "重置" })).toHaveCount(0);
  await page.getByRole("link", { name: "下一页" }).click();
  await expect(page).toHaveURL(/page=2/);
  await page.getByRole("radio", { name: "笔记", exact: true }).click();
  await expect(page).toHaveURL(/\/posts\?kind=note$/);
  await page.getByRole("combobox", { name: "标签" }).click();
  await page.getByRole("option", { name: "前端工程", exact: true }).click();
  await expect(page).toHaveURL(/kind=note&tag=frontend-engineering$/);
  await expect(page.getByRole("status")).toContainText("共 2 篇");
  await page.reload();
  await expect(page.getByRole("radio", { name: "笔记", exact: true })).toBeChecked();
  await expect(page.getByRole("combobox", { name: "标签" })).toContainText("前端工程");
  await page.goBack();
  await expect(page).toHaveURL(/\/posts\?kind=note$/);
  await expect(page.getByRole("combobox", { name: "标签" })).toContainText("全部标签");
  await page.goForward();
  await expect(page.getByRole("combobox", { name: "标签" })).toContainText("前端工程");
  await page.getByRole("heading", { level: 2 }).first().getByRole("link").click();
  await expect(page).toHaveURL(/\/posts\/[^/?]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "为什么我放弃了 Redux" })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/kind=note&tag=frontend-engineering$/);
  await expect(page.getByRole("radio", { name: "笔记", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "重置" }).click();
  await expect(page).toHaveURL(/\/posts$/);
  await expect(page.getByRole("status")).toContainText("共 6 篇");
});

test("快速连续选择合并条件，portal Escape 归还焦点", async ({ page }) => {
  await page.goto("/posts");
  await page.route("**/posts?**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.continue();
  });
  await page.getByRole("radio", { name: "笔记", exact: true }).click();
  const trigger = page.getByRole("combobox", { name: "标签" });
  await trigger.click();
  await page.getByRole("option", { name: "React", exact: true }).click();
  await expect(page).toHaveURL(/kind=note&tag=react$/);
  await expect(page.getByRole("status")).toContainText("共 1 篇");
  await trigger.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("listbox")).toHaveCount(0);
});

test("筛选在浅深主题、375/768/1440 及 320px 和 200% 下可读", async ({ page }, testInfo) => {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/posts?kind=note");
      await expect(page.locator("html")).toHaveAttribute("data-theme", colorScheme);
      await page.getByRole("combobox", { name: "标签" }).click();
      await expect(page.getByRole("listbox")).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`filters-${colorScheme}-${width}.png`) });
      await page.keyboard.press("Escape");
    }
  }
  await page.setViewportSize({ width: 768, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await page.getByRole("combobox", { name: "标签" }).click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.screenshot({ path: testInfo.outputPath("filters-200-percent.png") });
});
