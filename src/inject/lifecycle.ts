/**
 * src/inject/lifecycle.ts
 *
 * Leaf module that owns the install/uninstall of named lifecycle intervals
 * for the React Debugger inject script.
 *
 * Design constraints (M-A consolidation):
 *  - This file MUST NOT import anything from src/inject/index.ts (no circular
 *    dependency). It is a pure leaf: it accepts callbacks/values as parameters
 *    and manipulates the window namespace directly.
 *  - Callers pass callbacks (e.g. periodicCleanup) rather than this module
 *    closing over inject internals.
 *  - The (window as any) casts are intentional: they follow the existing
 *    host-page-window-namespace pattern used throughout inject/index.ts.
 *
 * M-A scope (T5): cleanup-interval pair only.
 *   Memory monitor + closure tracking extractions are deferred to M-B, where
 *   a full install(flags)/uninstall()/toggle() API will be introduced together
 *   with a hook registry.
 */

/**
 * Default interval duration for the periodic cleanup timer (ms).
 * Matches the hardcoded 60000 previously inlined at inject/index.ts:3262.
 */
const DEFAULT_CLEANUP_INTERVAL_MS = 60_000;

/**
 * Install the periodic cleanup interval on the host-page window.
 *
 * Consolidates the pattern previously inlined at inject/index.ts lines 3261-3263
 * (inside the ENABLE_DEBUGGER message handler):
 *
 *   ```ts
 *   if (!(window as any).__REACT_DEBUGGER_CLEANUP_INTERVAL__) {
 *     (window as any).__REACT_DEBUGGER_CLEANUP_INTERVAL__ =
 *       window.setInterval(periodicCleanup, 60000);
 *   }
 *   ```
 *
 * The window-namespace guard prevents double-install (idempotent). The window
 * key is set to the interval ID so that uninstallCleanupInterval() can clear it.
 *
 * Future intent (M-B): this function will become part of lifecycle.install(flags)
 * and will be driven by the hook registry rather than called ad-hoc.
 *
 * @param periodicCleanup - The cleanup callback to run on each interval tick.
 *   Defined and closed-over inside inject/index.ts; passed here as a parameter
 *   to keep this module free of inject internals.
 * @param intervalMs - Interval duration in milliseconds.
 *   Defaults to DEFAULT_CLEANUP_INTERVAL_MS (60 000).
 */
export function installCleanupInterval(
  periodicCleanup: () => void,
  intervalMs: number = DEFAULT_CLEANUP_INTERVAL_MS,
): void {
  if (!(window as any).__REACT_DEBUGGER_CLEANUP_INTERVAL__) {
    (window as any).__REACT_DEBUGGER_CLEANUP_INTERVAL__ = window.setInterval(
      periodicCleanup,
      intervalMs,
    );
  }
}

/**
 * Clear the periodic cleanup interval and remove the window-namespace key.
 *
 * Consolidates the pattern previously inlined at inject/index.ts lines 2905-2908
 * (inside stopAllMonitoring()):
 *
 *   ```ts
 *   if ((window as any).__REACT_DEBUGGER_CLEANUP_INTERVAL__) {
 *     clearInterval((window as any).__REACT_DEBUGGER_CLEANUP_INTERVAL__);
 *     (window as any).__REACT_DEBUGGER_CLEANUP_INTERVAL__ = null;
 *   }
 *   ```
 *
 * Safe to call multiple times (idempotent): the guard skips the clearInterval
 * call if the key is already null/undefined.
 *
 * Future intent (M-B): will become part of lifecycle.uninstall() driven by the
 * hook registry, with reverse-priority ordering.
 */
export function uninstallCleanupInterval(): void {
  if ((window as any).__REACT_DEBUGGER_CLEANUP_INTERVAL__) {
    clearInterval((window as any).__REACT_DEBUGGER_CLEANUP_INTERVAL__);
    (window as any).__REACT_DEBUGGER_CLEANUP_INTERVAL__ = null;
  }
}
