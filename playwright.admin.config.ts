import { defineConfig, devices } from "@playwright/test";
process.loadEnvFile(".env.round11-test");
const database = new URL(process.env.TEST_DATABASE_URL ?? "");
if (!["127.0.0.1", "localhost"].includes(database.hostname) || !database.pathname.endsWith("_test"))
  throw new Error("Admin E2E requires an isolated local *_test database");
export default defineConfig({
  testDir: "./e2e-admin",
  outputDir: "./test-results/admin",
  globalSetup: "./e2e-admin/setup.ts",
  workers: 1,
  fullyParallel: false,
  timeout: 60000,
  expect: { timeout: 10000 },
  use: { baseURL: "http://localhost:3201", trace: "off", screenshot: "only-on-failure" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.CI ? {} : { channel: "chrome" as const }),
      },
    },
  ],
  webServer: {
    command: "pnpm --filter @ting-lab/web exec next start -p 3201 -H localhost",
    url: "http://localhost:3201",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      CONTENT_SOURCE: "database",
      ADMIN_ORIGIN: "http://localhost:3201",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3201",
    },
  },
});
