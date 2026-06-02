/**
 * React Version Adapter — public entry point
 *
 * Usage:
 *   const adapter = getAdapter();   // auto-detects from window.__REACT_DEVTOOLS_GLOBAL_HOOK__
 *   const name = adapter.getDisplayName(fiber);
 *   const tags = adapter.FIBER_TAGS;
 *
 * Or with an explicit version string:
 *   const adapter = getAdapterForVersion('18.3.1');
 */

export type { ReactVersionAdapter, FiberTagMap, FiberNode, FiberHook, FiberRoot, ReactRenderer, DevToolsProfilingHooks, ProfilingConflict } from './types';
export { PROFILING_FLAG_BASIC_SUPPORT, PROFILING_FLAG_TIMELINE_SUPPORT, PROFILING_FLAG_PERFORMANCE_TRACKS_SUPPORT } from './types';

export { r17Adapter, R17_FIBER_TAGS } from './r17';
export { r18Adapter, R18_FIBER_TAGS } from './r18';
export { r19Adapter, R19_FIBER_TAGS } from './r19';
export { r19_2Adapter, R19_2_FIBER_TAGS } from './r19_2';

import type { ReactVersionAdapter, ProfilingConflict } from './types';
import { r17Adapter } from './r17';
import { r18Adapter } from './r18';
import { r19Adapter } from './r19';
import { r19_2Adapter } from './r19_2';

// ---------------------------------------------------------------------------
// Version detection
// ---------------------------------------------------------------------------

/**
 * Detect the React version string from the page.
 *
 * Priority order (most to least reliable):
 *   1. renderer.version from hook.renderers — works in ESM, SSR, RN, any bundler
 *   2. window.React.version — fails for ESM-only, Next.js App Router, RN
 *   3. renderer.reconcilerVersion — monorepo builds sometimes differ from version
 *
 * Source for renderer.version reliability:
 *   https://github.com/facebook/react/blob/05ca66ad9c/packages/react-devtools-shared/src/backend/types.js#L131
 */
export function detectReactVersion(): string | null {
  const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;

  // Priority 1: renderer.version (most reliable)
  if (hook?.renderers instanceof Map && hook.renderers.size > 0) {
    const renderer = hook.renderers.values().next().value;
    if (typeof renderer?.version === 'string' && renderer.version) {
      return renderer.version;
    }
  }

  // Priority 2: window.React.version
  const reactVersion = (window as any).React?.version;
  if (typeof reactVersion === 'string' && reactVersion) {
    return reactVersion;
  }

  // Priority 3: reconcilerVersion
  if (hook?.renderers instanceof Map && hook.renderers.size > 0) {
    const renderer = hook.renderers.values().next().value;
    if (typeof renderer?.reconcilerVersion === 'string' && renderer.reconcilerVersion) {
      return renderer.reconcilerVersion;
    }
  }

  return null;
}

/**
 * Parse a semver string into [major, minor, patch].
 * Returns [0, 0, 0] for unparseable strings.
 */
function parseSemver(version: string): [number, number, number] {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return [0, 0, 0];
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

/**
 * Select the correct adapter for a given React version string.
 *
 * Version routing:
 *   19.2+ → r19_2Adapter   (ViewTransition/Activity tags; supportsPerformanceTracks)
 *   19.x  → r19Adapter     (HostHoistable/HostSingleton/Throw; no Indeterminate)
 *   18.x  → r18Adapter     (Offscreen=22; injectProfilingHooks present)
 *   17.x  → r17Adapter     (Block=22 / Offscreen=23; no injectProfilingHooks)
 *   <17   → r17Adapter     (best effort — no adapter below 17)
 */
export function getAdapterForVersion(version: string): ReactVersionAdapter {
  const [major, minor] = parseSemver(version);

  if (major >= 19) {
    if (major > 19 || minor >= 2) return r19_2Adapter;
    return r19Adapter;
  }
  if (major === 18) return r18Adapter;
  // 17.x and below
  return r17Adapter;
}

/**
 * Detect React version from the page and return the correct adapter.
 * Falls back to r17Adapter if version cannot be determined (safest fallback
 * since r17 tags 0–19 are a stable subset of all later versions).
 */
export function getAdapter(): ReactVersionAdapter {
  const version = detectReactVersion();
  if (version) return getAdapterForVersion(version);
  // Unknown version: fallback to r17 (minimal safe tag set)
  return r17Adapter;
}

// ---------------------------------------------------------------------------
// Conflict detection
// ---------------------------------------------------------------------------

/**
 * Detect active profiling hook conflicts before calling injectProfilingHooks.
 *
 * react-scan detection:
 *   window.__REACT_SCAN__.ReactScanInternals present
 *   Source: https://github.com/aidenybai/react-scan/blob/main/packages/scan/src/types.ts
 *           https://github.com/aidenybai/react-scan/blob/main/packages/scan/src/new-outlines/index.ts
 *
 * Real React DevTools detection (bippy pattern):
 *   'getFiberRoots' in window.__REACT_DEVTOOLS_GLOBAL_HOOK__
 *   Source: https://github.com/aidenybai/bippy/blob/main/packages/bippy/src/rdt-hook.ts
 */
export function detectProfilingConflict(): ProfilingConflict {
  const reactScan =
    typeof (window as any).__REACT_SCAN__?.ReactScanInternals !== 'undefined';

  const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
  const reactDevTools = Boolean(hook && 'getFiberRoots' in hook);

  return { reactScan, reactDevTools };
}
