/**
 * Detector module aggregator. The inject script's bootstrap calls
 * `registerAllDetectors(registry)` once, after `createRegistry(...)`.
 *
 * Add one `register()` line per new detector. T8 adds `closure-leak`,
 * T9 adds `scan-overlay` here.
 */
import type { Registry } from '../registry';
import { reconcilerKeysDetector } from './reconciler-keys';
import { closureLeakDetector } from './closure-leak';
import { scanOverlayDetector } from './scan-overlay';
import { hydrationMismatchDetector } from './hydration-mismatch';
import { contextCascadeDetector } from './context-cascade';
import { staleClosureAsyncDetector } from './stale-closure-async';
import { suspenseWaterfallDetector } from './suspense-waterfall';
import { inlineHandlerCostDetector } from './inline-handler-cost';
import { refMutationDuringRenderDetector } from './ref-mutation-during-render';

export { reconcilerKeysDetector, createReconcilerKeysDetector } from './reconciler-keys';
export { closureLeakDetector, createClosureLeakDetector } from './closure-leak';
export { scanOverlayDetector, createScanOverlayDetector } from './scan-overlay';
export { hydrationMismatchDetector, createHydrationMismatchDetector } from './hydration-mismatch';
export { contextCascadeDetector, createContextCascadeDetector } from './context-cascade';
export { staleClosureAsyncDetector, createStaleClosureAsyncDetector } from './stale-closure-async';
export { suspenseWaterfallDetector, createSuspenseWaterfallDetector } from './suspense-waterfall';
export { inlineHandlerCostDetector, createInlineHandlerCostDetector } from './inline-handler-cost';
export { refMutationDuringRenderDetector, createRefMutationDuringRenderDetector } from './ref-mutation-during-render';

/** The registered detector set — single source for registration + the capability matrix. */
export const ALL_DETECTORS = [
  reconcilerKeysDetector,
  closureLeakDetector,
  scanOverlayDetector,
  hydrationMismatchDetector,
  contextCascadeDetector,
  staleClosureAsyncDetector,
  suspenseWaterfallDetector,
  inlineHandlerCostDetector,
  refMutationDuringRenderDetector,
];

export function registerAllDetectors(registry: Registry): void {
  for (const detector of ALL_DETECTORS) registry.register(detector);
}
