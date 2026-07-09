import { defineConfig } from '@playwright/test';

/**
 * Playwright config for the MCP e2e lane (MCP v1, task 3.12).
 * Specs live under test/e2e and are gated behind RDBG_E2E=1 (they need a real
 * Chromium with the unpacked extension + a spawned bridge), so they never run
 * in the unit lane. Invoke with `npm run test:e2e`.
 */
export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
});
