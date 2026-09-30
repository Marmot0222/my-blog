import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results/public",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Content-boundary tests create/remove a real fixture in the shared content
  // directory; serialize files so request-time readers never race that teardown.
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: "http://127.0.0.1:3200",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] },
        ...(process.env.CI ? {} : { channel: "chrome" as const }),
      },
    },
    ...(process.env.CROSS_BROWSER
      ? // Patched Firefox headless forces scrollbar-width:none, even on plain
        // overflow:auto elements. Headed mode validates real native scrollbars.
        [{ name: "firefox", use: { ...devices["Desktop Firefox"], headless: false } }]
      : []),
  ],
  webServer: {
    command: "pnpm --filter @ting-lab/web exec next start -p 3200",
    url: "http://127.0.0.1:3200",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3200", CONTENT_PREVIEW: "1" },
  },
});
