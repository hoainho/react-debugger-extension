/**
 * Representative list-key scenarios for the reconciler-keys detector
 * (M-B hero #1). This module is the single source of truth shared by the
 * illustrative fixture components in this directory AND by
 * `src/__tests__/reconciler-keys.fixtures.test.ts`, which drives the detector
 * over these exact key sets and asserts emit-on-positive / zero-on-negative.
 *
 * Positive (should emit UNSTABLE_LIST_KEY):
 *   - mathRandomKeys  → Case A, `0.xxxxxx` decimals (Math.random())
 *   - dateNowKeys     → Case A, 10+ digit epoch prefixes (Date.now())
 *   - indexKeys{Initial,Reordered} → Case B, numeric-index keys that reorder
 *
 * Negative (should emit nothing):
 *   - stableIdKeys{,Reordered} → stable string ids, reordering is harmless
 */

export const mathRandomKeys: string[] = ['0.123456789', '0.987654321', '0.456789123'];

export const dateNowKeys: string[] = ['1717180000000', '1717180000001', '1717180000002'];

export const indexKeysInitial: string[] = ['0', '1', '2', '3'];
export const indexKeysReordered: string[] = ['3', '0', '1', '2'];

export const stableIdKeys: string[] = ['user-abc', 'user-def', 'user-ghi'];
export const stableIdKeysReordered: string[] = ['user-ghi', 'user-abc', 'user-def'];
