import { test, expect } from '@playwright/test';
import { loadPanel } from './fixtures';

/**
 * S4.5 V6 — per-view visual-regression baselines for the redesigned 5-view
 * panel. Each test renders the built panel with deterministic fixture data and
 * screenshots one view. Baselines live in panel.visual.spec.ts-snapshots/.
 */
test.beforeEach(async ({ page }) => {
  await loadPanel(page);
});

const VIEWS = ['Dashboard', 'Profiler', 'State', 'Effects', 'Settings'] as const;

for (const view of VIEWS) {
  test(`view: ${view}`, async ({ page }) => {
    if (view !== 'Dashboard') {
      await page.getByRole('tab', { name: view }).click();
      await page.waitForTimeout(300);
    }
    await expect(page).toHaveScreenshot(`view-${view.toLowerCase()}.png`, { fullPage: true });
  });
}

test('classic layout', async ({ page }) => {
  await page.getByRole('button', { name: /classic view/i }).click();
  await page.waitForTimeout(300);
  await expect(page).toHaveScreenshot('layout-classic.png', { fullPage: true });
});
