import { defineConfig } from "@playwright/test";
import process from "node:process";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    channel: process.platform === "win32" ? "msedge" : "chromium",
  },
  webServer: [
    {
      command: "node apps/api/dist/server.js",
      url: "http://127.0.0.1:4310/health",
      reuseExistingServer: true,
    },
    {
      command: "npm run --workspace apps/web start",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: true,
    },
  ],
});
