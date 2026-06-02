/**
 * scan-overlay detector (M-B T9 — canary extraction #2)
 *
 * Strategy: **thin adapter (Strategy A)**.
 *
 * The legacy scan implementation in `src/inject/index.ts` (`flashRenderOverlay`
 * + `clearAllOverlays` + the `overlayElements` / `renderFlashTimers` /
 * `lastOverlayFlashTime` maps + `toggleScan` + the `__REACT_DEBUGGER_SCAN__`
 * window export) is **kept in place unchanged**. It owns the DOM-touching
 * paint pipeline and the visible state.
 *
 * Inject exposes a small bridge on the host-page window:
 *
 *   window.__REACT_DEBUGGER_SCAN_BRIDGE__ = {
 *     enable():             // calls toggleScan(true)
 *     disable():            // calls toggleScan(false) + clears overlays
 *     isEnabled():          // returns scanEnabled
 *     setRecorder(fn):      // commit-loop calls fn(fiber, name, count)
 *                           // instead of the sync flashRenderOverlay
 *     paint(items):         // drives flashRenderOverlay for each buffered
 *                           // item — DOM access lives here, so this MUST
 *                           // only be called from onIdle
 *     clear():              // clearAllOverlays()
 *   }
 *
 * The critical M-B audit fix: `getBoundingClientRect()` no longer runs
 * synchronously in `onCommitFiberRoot`. Per-commit work is bounded to fiber
 * traversal + buffering; the DOM measurement happens in `onIdle()` when the
 * browser is otherwise idle.
 *
 * Default-on via `KNOWN_DETECTORS_DEFAULTS` (confidence: high → enabled: true).
 */
import type { Detector, DetectorContext } from '../../types/registry';

export interface ScanOverlayPendingItem {
  fiber: unknown;
  componentName: string;
  renderCount: number;
}

interface ScanBridge {
  enable?: () => void;
  disable?: () => void;
  isEnabled?: () => boolean;
  setRecorder?: (
    fn: ((fiber: unknown, name: string, count: number) => void) | null,
  ) => void;
  paint?: (items: ScanOverlayPendingItem[]) => void;
  clear?: () => void;
}

function getBridge(): ScanBridge | null {
  if (typeof window === 'undefined') return null;
  const bridge = (window as unknown as {
    __REACT_DEBUGGER_SCAN_BRIDGE__?: ScanBridge;
  }).__REACT_DEBUGGER_SCAN_BRIDGE__;
  return bridge ?? null;
}

const PENDING_KEY = 'pendingFlashes';
const MAX_PENDING_PER_COMMIT = 200;

export function createScanOverlayDetector(): Detector<never> {
  let ctx: DetectorContext | null = null;
  let pending: ScanOverlayPendingItem[] = [];
  let recorderAttached = false;

  const recorder = (
    fiber: unknown,
    name: string,
    count: number,
  ): void => {
    if (ctx === null) return;
    if (pending.length >= MAX_PENDING_PER_COMMIT) return;
    pending.push({ fiber, componentName: name, renderCount: count });
    ctx.write(PENDING_KEY, pending);
  };

  return {
    id: 'scan-overlay',
    category: 'performance',
    budgetMs: 0.5,
    confidence: 'high',
    prodCapable: true,

    init(injected: DetectorContext): void {
      ctx = injected;
      const bridge = getBridge();
      if (bridge === null) return;
      try {
        bridge.setRecorder?.(recorder);
        recorderAttached = true;
      } catch (err) {
        injected.log('[scan-overlay] init failed', err);
      }
    },

    onCommit(): void {
      // Intentionally empty — the host-page commit loop pushes fibers through
      // the recorder above. Detector owns no per-commit work other than the
      // recorder closure, which already buffers into ctx-staging via write().
    },

    onIdle(deadline: IdleDeadline): void {
      if (pending.length === 0) return;
      const bridge = getBridge();
      if (bridge === null || !bridge.paint) {
        pending = [];
        return;
      }
      // Drain the buffer in one shot — paint runs sync but is bounded by
      // MAX_PENDING_PER_COMMIT (200), and the bridge's flashRenderOverlay
      // path already has a 300ms-per-fiber debounce.
      const items = pending;
      pending = [];
      try {
        if (deadline.timeRemaining() <= 0 && !deadline.didTimeout) {
          // No budget left and not a forced run — drop this batch to avoid
          // jank. The next commit will rebuild a fresh batch.
          return;
        }
        bridge.paint(items);
      } catch (err) {
        ctx?.log('[scan-overlay] paint failed', err);
      }
    },

    drain(): never[] {
      return [];
    },

    teardown(): void {
      const bridge = getBridge();
      if (bridge !== null) {
        try {
          if (recorderAttached) {
            bridge.setRecorder?.(null);
          }
          bridge.clear?.();
        } catch {
          // teardown must never throw
        }
      }
      recorderAttached = false;
      pending = [];
      ctx = null;
    },
  };
}

export const scanOverlayDetector = createScanOverlayDetector();
