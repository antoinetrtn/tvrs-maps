import process from "node:process";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  timeout: 45 * 1000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 10 * 1000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--use-gl=angle",
            "--use-gl=swiftshader",
            "--ignore-gpu-blocklist",
            "--enable-gpu-rasterization",
            "--no-sandbox",
            "--disable-setuid-sandbox",
          ],
        },
      },
    },
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 5"],
        launchOptions: {
          args: [
            "--use-gl=angle",
            "--use-gl=swiftshader",
            "--ignore-gpu-blocklist",
            "--enable-gpu-rasterization",
            "--no-sandbox",
            "--disable-setuid-sandbox",
          ],
        },
      },
    },
  ],
  webServer: {
    command: "npx vite --host 127.0.0.1 --port 5001",
    url: "http://127.0.0.1:5001",
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
