import { defineConfig } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
const data = mkdtempSync(join(tmpdir(), "via-hub-e2e-"));
const port = Number(process.env.E2E_PORT || 8197);
export default defineConfig({
  testDir: "tests/browser",
  workers: 1,
  timeout: 120000,
  use: { baseURL: `http://127.0.0.1:${port}`, headless: true },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    timeout: 120000,
    reuseExistingServer: false,
    env: {
      NODE_ENV: "development",
      PROJECT_DATA_DIR: data,
      PROJECT_ADMIN_PASSWORD: "test-admin-password",
      PROJECT_ACCESS_SECRET: "test-only-secret-012345678901234567890123456789",
      DATABASE_URL: "",
      SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      SUPABASE_PUBLISHABLE_KEY: "",
    },
  },
});
