import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { compile } from "sass";
import { resolve } from "node:path";

test("shared Dialog containing Select preserves outer lock and long-page position", async ({
  page,
}) => {
  const bundle = await build({
    stdin: {
      resolveDir: resolve("apps/web"),
      loader: "tsx",
      contents: `
      import React from "react";
      import {createRoot} from "react-dom/client";
      import {Dialog,DialogTrigger,DialogContent,DialogTitle,Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from "@ting-lab/ui";
      createRoot(document.getElementById('root')).render(<><header>Background header</header><main style={{height:3000,paddingTop:600}}><Dialog><DialogTrigger>Open dialog</DialogTrigger><DialogContent aria-describedby={undefined}><DialogTitle>Nested fixture</DialogTitle><Select defaultValue="a"><SelectTrigger aria-label="Nested choice"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="a">Alpha</SelectItem><SelectItem value="b">Beta</SelectItem>{Array.from({length:35},(_,i)=><SelectItem key={i} value={'long-'+i}>Long menu option {i} with a descriptive label</SelectItem>)}</SelectContent></Select></DialogContent></Dialog></main></>);
    `,
    },
    bundle: true,
    write: false,
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "fixture-scss",
        setup(builder) {
          builder.onLoad({ filter: /\.scss$/ }, (args) => {
            const css = compile(args.path).css;
            const classes = Object.fromEntries(
              [...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((match) => [match[1], match[1]]),
            );
            return {
              loader: "js",
              contents: `const style=document.createElement('style');style.textContent=${JSON.stringify(css)};document.head.append(style);export default ${JSON.stringify(classes)};`,
            };
          });
        },
      },
    ],
  });
  const globalCss = compile(resolve("apps/web/src/styles/globals.scss")).css;
  await page.route("**/__nested-fixture", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html><head><style>${globalCss}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script></body></html>`,
    }),
  );
  await page.goto("/__nested-fixture");
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, 500);
  });
  const before = await page.locator("main").boundingBox();
  const scroll = await page.evaluate(() => scrollY);
  await page.getByRole("button", { name: "Open dialog" }).click();
  await page.getByRole("combobox", { name: "Nested choice" }).click();
  const viewport = page.locator("[data-radix-select-viewport]");
  await expect
    .poll(() => viewport.evaluate((el) => getComputedStyle(el).scrollbarWidth))
    .not.toBe("none");
  await page.keyboard.press("End");
  await expect(page.getByRole("option").last()).toBeFocused();
  expect(await viewport.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("combobox", { name: "Nested choice" })).toBeFocused();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe("hidden");
  const during = await page.locator("main").boundingBox();
  expect(Math.abs(before!.width - during!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(before!.x - during!.x)).toBeLessThanOrEqual(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("button", { name: "Open dialog" })).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
  expect(await page.evaluate(() => getComputedStyle(document.body).pointerEvents)).not.toBe("none");
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");
});
