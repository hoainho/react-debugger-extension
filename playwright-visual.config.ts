import { defineConfig, devices } from '@playwright/test';

/**
 * Visual-regression lane (S4.5 V6). Separate from the MCP e2e lane
 * (playwright.config.ts) so it needs no unpacked extension or bridge — the
 * panel's built `dist/` assets are served from disk via route-fulfill and the
 * chrome.* API is stubbed with deterministic fixture data (see fixtures.ts).
 *
 * Run:   npm run test:visual
 * Update baselines after an intentional UI change:
 *        npm run test:visual -- --update-snapshots
 *
 * Baselines are platform-suffixed by Playwright (…-darwin.png here); regenerate
 * on the same OS/arch used in CI. Requires `npm run build` first.
 */
export default defineConfig({
  testDir: './test/visual',
  fullyParallel: true,
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled' },
  },
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 760, height: 900 },
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
  },
});
