/**
 * closure-leak detector (M-B T8 — canary extraction #1)
 *
 * Strategy: **thin adapter (Strategy A)**.
 *
 * The legacy closure-tracking implementation in `src/inject/index.ts`
 * (`_installClosureTracking` + `trackClosure` + `checkStaleClosureOnExecution`
 * + the `trackedClosures` / `staleClosureIssues` Maps) is **kept in place
 * unchanged**. It has shipped for many versions and depends on inject-resident
 * state (`getCurrentComponentContext`, `componentRenderIds`, the captured
 * `originalSetTimeout` / `originalSetInterval` / `originalAddEventListener`).
 *
 * Inject exposes a small bridge on the host-page window:
 *
 *   window.__REACT_DEBUGGER_CLOSURE_BRIDGE__ = {
 *     install():          // calls _installClosureTracking() (idempotent)
 *     restoreOriginals(): // best-effort restore of window.setTimeout etc.
 *     clear():            // drains tracked closures + stale issue dedupe map
 *     setSink(fn):        // detector installs an issue-emit hook here so
 *                         // inject can forward each STALE_CLOSURE issue into
 *                         // the detector's buffer in addition to the legacy
 *                         // sendFromPage('STALE_CLOSURE_DETECTED', issue) path
 *   }
 *
 * This file converts that bridge into a `Detector` conforming to T1's
 * registry contract. The legacy `sendFromPage('STALE_CLOSURE_DETECTED', ...)`
 * call site is preserved for backward compatibility with any consumer that
 * still listens on the legacy channel; the detector buffer is filled
 * **in addition**, so panel users see issues either way.
 *
 * Default-off via `KNOWN_DETECTORS_DEFAULTS` in `src/settings/migrate.ts`
 * (confidence: medium → enabled: false). Users opt-in via Settings UI.
 */
import type { Detector, DetectorContext } from '../../types/registry';
import type { Issue } from '../../types';

/**
 * Bridge contract exposed by inject. Detector is tolerant of missing methods
 * (tests / future inject builds that haven't wired everything yet).
 */
interface ClosureBridge {
  install?: () => void;
  restoreOriginals?: () => void;
  clear?: () => void;
  setSink?: (fn: ((issue: Issue) => void) | null) => void;
}

/**
 * Accessor with a tight cast at the boundary. The legacy code already uses
 * `(window as any).__REACT_DEBUGGER_*` extensively — this file follows the
 * same convention (which is allowed under the host-page-window namespace
 * pattern per the M-B rules).
 */
function getBridge(): ClosureBridge | null {
  // Test environments (jsdom) may not have the bridge installed; the detector
  // must not throw at init() in that case — it just becomes a no-op.
  if (typeof window === 'undefined') return null;
  const bridge = (window as unknown as {
    __REACT_DEBUGGER_CLOSURE_BRIDGE__?: ClosureBridge;
  }).__REACT_DEBUGGER_CLOSURE_BRIDGE__;
  return bridge ?? null;
}

export function createClosureLeakDetector(): Detector<Issue> {
  let ctx: DetectorContext | null = null;
  let buffer: Issue[] = [];
  let installed = false;

  // Stable sink reference so we can detach the same function on teardown.
  const sink = (issue: Issue): void => {
    // Defensive: ignore once teardown has nulled ctx (sink may still be held
    // by inject until restoreOriginals() runs).
    if (ctx === null) return;
    buffer.push(issue);
  };

  return {
    id: 'closure-leak',
    category: 'side-effects',
    // Event-driven detector — onCommit is a near-no-op so the budget is tiny.
    budgetMs: 0.2,
    // Documented FP modes with async patterns → default OFF per T5.
    confidence: 'medium',
    prodCapable: true,

    init(injected: DetectorContext): void {
      ctx = injected;
      const bridge = getBridge();
      if (bridge === null) return;
      try {
        // Attach the sink BEFORE installing so any synchronous emission during
        // install (none expected, but cheap insurance) is captured.
        bridge.setSink?.(sink);
        bridge.install?.();
        installed = true;
      } catch (err) {
        // Re-thrown errors here would be wrapped by the registry into a
        // disabled-for-session marker. Route through ctx.log for diagnosis.
        injected.log('[closure-leak] init failed', err);
      }
    },

    /**
     * Closure tracking is event-driven (setTimeout / setInterval /
     * addEventListener callbacks). The per-commit hook is intentionally a
     * no-op — issues land in the buffer when async callbacks fire, not when
     * React commits. The legacy `periodicCleanup` (every 60s) already prunes
     * tracked closures; we do not duplicate that here.
     */
    onCommit(): void {
      // Intentionally empty. See module comment.
    },

    drain(): Issue[] {
      const out = buffer;
      buffer = [];
      return out;
    },

    teardown(): void {
      // Detach sink and restore window globals. Idempotent: safe to call
      // twice, or before init() (no bridge → silent return).
      const bridge = getBridge();
      if (bridge !== null) {
        try {
          bridge.setSink?.(null);
          if (installed) {
            bridge.restoreOriginals?.();
            bridge.clear?.();
          }
        } catch {
          // Swallow — teardown must never throw.
        }
      }
      installed = false;
      buffer = [];
      ctx = null;
    },
  };
}

/** Singleton export for convenience — most callers use this directly. */
export const closureLeakDetector = createClosureLeakDetector();
