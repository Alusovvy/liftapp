import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-320",
      use: {
        browserName: "chromium",
        viewport: { width: 320, height: 720 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: [
    {
      command: "npm run server",
      url: "http://127.0.0.1:4001/api/session",
      reuseExistingServer: !process.env.CI,
      env: {
        PORT: "4001",
        LIFTWISE_DB_PATH: "server/data/e2e-test.sqlite3",
        ALLOW_TEST_ENDPOINTS: "1",
      },
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 4173",
      url: "http://127.0.0.1:4173/modern.html",
      reuseExistingServer: !process.env.CI,
      env: {
        LIFTWISE_API_ORIGIN: "http://127.0.0.1:4001",
      },
    },
  ],
});
