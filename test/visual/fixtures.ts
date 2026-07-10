import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

const DIST = fileURLToPath(new URL('../../dist', import.meta.url));
const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/** Deterministic panel state so screenshots are byte-stable across runs. */
const PANEL_STATE = {
  reactDetected: true,
  reactVersion: '19.2.0',
  reactMode: 'development',
  reduxDetected: true,
  issues: [
    { id: '1', type: 'UNSTABLE_LIST_KEY', severity: 'warning', component: 'ProductList', message: 'List renders with array index as key — reorders will remount rows', suggestion: 'Use a stable unique id as the key.', timestamp: 0, location: { componentName: 'ProductList', componentPath: ['App', 'Shop', 'ProductList'] } },
    { id: '2', type: 'CONTEXT_CASCADE', severity: 'error', component: 'ThemeProvider', message: 'Context value is a new object each commit, cascading re-renders to all consumers', suggestion: 'Memoize the provider value with useMemo.', timestamp: 0, location: { componentName: 'ThemeProvider', componentPath: ['App', 'ThemeProvider'] } },
    { id: '3', type: 'MISSING_CLEANUP', severity: 'error', component: 'ChatWidget', message: 'useEffect adds a listener without a cleanup function', suggestion: 'Return a cleanup that removes the listener.', timestamp: 0 },
    { id: '4', type: 'EXCESSIVE_RERENDERS', severity: 'warning', component: 'CartBadge', message: 'Rendered 42 times in the last second', suggestion: 'Wrap in React.memo and stabilize props.', timestamp: 0 },
    { id: '5', type: 'INDEX_AS_KEY', severity: 'info', component: 'Sidebar', message: 'Consider a semantic key for nav items', suggestion: 'Prefer route id over index.', timestamp: 0 },
  ],
  components: [],
  renders: Object.fromEntries(
    ['ProductList', 'CartBadge', 'Header', 'PriceTag', 'Sidebar', 'Footer'].map((n, i) => [
      n,
      { componentId: n, componentName: n, renderCount: 42 - i * 6, lastRenderTime: 0, renderDurations: [3.2], selfDurations: [2.1 + i], triggerReasons: [] },
    ]),
  ),
  clsReport: null,
  reduxState: { user: { id: 42, name: 'Ada', roles: ['admin', 'editor'] }, cart: { items: 3, total: 59.9 }, ui: { theme: 'dark', sidebarOpen: true } },
  reduxActions: [
    { id: 'a1', type: 'cart/addItem', payload: { sku: 'X1' }, timestamp: 0 },
    { id: 'a2', type: 'user/login', payload: { id: 42 }, timestamp: 0 },
  ],
  memoryReport: {
    current: { timestamp: 0, usedJSHeapSize: 86 * 1024 * 1024, totalJSHeapSize: 104 * 1024 * 1024, jsHeapSizeLimit: 512 * 1024 * 1024 },
    history: Array.from({ length: 24 }, (_, i) => {
      const used = 42 + Math.sin(i / 3) * 3 + i * 1.5;
      return { timestamp: i * 1000, usedJSHeapSize: used * 1024 * 1024, totalJSHeapSize: (used + 18) * 1024 * 1024, jsHeapSizeLimit: 512 * 1024 * 1024 };
    }),
    growthRate: 1.5 * 1024 * 1024,
    peakUsage: 115 * 1024 * 1024,
    warnings: [],
    crashes: [],
  },
  pageLoadMetrics: { fcp: 812, lcp: 1340, ttfb: 96, domContentLoaded: 900, loadComplete: 1500, timestamp: 0 },
  timelineEvents: [],
};

/**
 * Wire a Page to render the built panel offline: serve dist/ over a fake origin
 * and inject a deterministic chrome.* stub before any script runs.
 */
export async function loadPanel(page: Page): Promise<void> {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    const filePath = resolve(DIST, '.' + url.pathname);
    if (existsSync(filePath) && filePath.startsWith(DIST)) {
      route.fulfill({
        status: 200,
        headers: { 'content-type': CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream' },
        body: readFileSync(filePath),
      });
    } else {
      route.fulfill({ status: 404, body: '' });
    }
  });

  await page.addInitScript((state) => {
    // @ts-expect-error test stub
    window.chrome = {
      runtime: {
        id: 'visual',
        getManifest: () => ({ version: '2.0.3' }),
        sendMessage: (m: { type: string }) =>
          Promise.resolve(
            m.type === 'GET_STATE'
              ? { success: true, state }
              : m.type === 'GET_DEBUGGER_STATE'
                ? { success: true, enabled: true }
                : { success: true },
          ),
        onMessage: { addListener() {}, removeListener() {} },
      },
      devtools: { inspectedWindow: { tabId: 1, reload() {} } },
      storage: { local: { get: () => Promise.resolve({}), set: () => Promise.resolve() } },
    };
  }, PANEL_STATE);

  await page.goto('http://rdbg.local/panel.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
}
