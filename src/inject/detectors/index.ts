/**
 * Detector module aggregator. The inject script's bootstrap calls
 * `registerAllDetectors(registry)` once, after `createRegistry(...)`.
 *
 * Add one `register()` line per new detector. T8 adds `closure-leak`,
 * T9 adds `scan-overlay` here.
 */
import type { Registry } from '../registry';
import { reconcilerKeysDetector } from './reconciler-keys';

export { reconcilerKeysDetector, createReconcilerKeysDetector } from './reconciler-keys';

export function registerAllDetectors(registry: Registry): void {
  registry.register(reconcilerKeysDetector);
}
