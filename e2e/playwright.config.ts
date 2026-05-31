import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config for the TCG Builder web app.
 *
 * Two servers are started automatically (unless already running):
 *   1. The Axum backend on :8080 — started via scripts/run-backend.sh, which
 *      seeds a throwaway SQLite DB from seed.sql (no tracked DB blob) and points
 *      DATABASE_URL at it, so e2e runs never modify any real database.
 *   2. The CRA frontend on :3000 — reads REACT_APP_API_URL from
 *      frontend/.env.development (→ http://localhost:8080/api), which matches.
 *
 * The app uses HashRouter, so navigate with `/#/path` (see helpers.gotoHash).
 */
const FRONTEND_URL = "http://localhost:3000";
const BACKEND_HEALTH = "http://localhost:8080/health";
const JWT_SECRET = process.env.JWT_SECRET ?? "e2e-test-secret";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "html",

  use: {
    baseURL: FRONTEND_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      // Seeds a disposable DB from seed.sql, then runs the backend against it.
      // First run compiles the Rust backend, which can be slow.
      command: "bash scripts/run-backend.sh",
      url: BACKEND_HEALTH,
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
      env: {
        JWT_SECRET,
        // Quiet the per-startup scrapers during tests where possible.
        RUST_LOG: "tcg_backend=warn",
      },
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "npm start",
      cwd: "../frontend",
      url: FRONTEND_URL,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      env: {
        BROWSER: "none",
        // Avoid CRA treating warnings as errors and failing `npm start`.
        CI: "",
      },
    },
  ],
});
