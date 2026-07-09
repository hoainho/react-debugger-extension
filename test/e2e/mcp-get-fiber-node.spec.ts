/**
 * E2E: an MCP client drives get_fiber_node end-to-end through a loaded
 * extension + spawned bridge (MCP v1, task 3.10).
 *
 * HUMAN GATE — requires a real Chromium with the unpacked extension and a
 * spawned bridge subprocess, so it is SKIPPED unless RDBG_E2E=1. It is not part
 * of the unit lane (vitest include is `src/**`) and is run via `npm run test:e2e`.
 */
import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { resolve } from 'node:path';

const ENABLED = process.env.RDBG_E2E === '1';
// Paths are relative to the repo root (playwright runs from there).
const DIST = resolve(process.cwd(), 'dist');
const CLI = resolve(process.cwd(), 'cli/bin/cli.js');

test.describe('MCP get_fiber_node (loaded extension + bridge)', () => {
  test.skip(!ENABLED, 'requires a loaded extension + bridge — set RDBG_E2E=1 to run');

  let context: BrowserContext | undefined;
  let bridge: ChildProcessWithoutNullStreams | undefined;

  test.afterEach(async () => {
    bridge?.kill('SIGTERM');
    await context?.close();
  });

  test('lists get_fiber_node and returns a result shape', async () => {
    // 1. launch Chromium with the unpacked extension
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
    });

    // 2. spawn the bridge; capture the deep-link it prints on stdout
    bridge = spawn('node', [CLI, 'mcp'], { stdio: ['pipe', 'pipe', 'pipe'] });
    const deepLink: string = await new Promise((resolveLink) => {
      bridge!.stdout.on('data', (d: Buffer) => {
        const line = d.toString();
        if (line.includes('chrome-extension://')) resolveLink(line.trim());
      });
    });
    expect(deepLink).toContain('#token=');

    // 3. open the pairing deep-link in the extension's options page
    const page = await context.newPage();
    await page.goto(deepLink);
    await expect(page.getByText('Connected')).toBeVisible({ timeout: 10_000 });

    // 4. an MCP client would connect over stdio here and call get_fiber_node;
    //    asserting the result shape is the maintainer's soak step.
  });
});
