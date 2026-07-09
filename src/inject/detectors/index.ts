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

export { reconcilerKeysDetector, createReconcilerKeysDetector } from './reconciler-keys';
export { closureLeakDetector, createClosureLeakDetector } from './closure-leak';
export { scanOverlayDetector, createScanOverlayDetector } from './scan-overlay';
export { hydrationMismatchDetector, createHydrationMismatchDetector } from './hydration-mismatch';
export { contextCascadeDetector, createContextCascadeDetector } from './context-cascade';
export { staleClosureAsyncDetector, createStaleClosureAsyncDetector } from './stale-closure-async';

export function registerAllDetectors(registry: Registry): void {
  registry.register(reconcilerKeysDetector);
  registry.register(closureLeakDetector);
  registry.register(scanOverlayDetector);
  registry.register(hydrationMismatchDetector);
  registry.register(contextCascadeDetector);
  registry.register(staleClosureAsyncDetector);
}
