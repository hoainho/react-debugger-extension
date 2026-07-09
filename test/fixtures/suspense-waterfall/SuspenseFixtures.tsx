import React, { Suspense } from 'react';

/**
 * ANTI-PATTERN (positive): a data waterfall — the child suspends, resolves,
 * then its child suspends again, re-suspending the SAME boundary on successive
 * commits. The detector flags SUSPENSE_WATERFALL after >=3 consecutive re-suspends.
 */
export const WaterfallBoundary: React.FC<{ Child: React.ComponentType }> = ({ Child }) => (
  <Suspense fallback={<div>Loading…</div>}>
    <Child />
  </Suspense>
);

/**
 * CORRECT (negative): siblings whose data is prefetched in parallel resolve
 * together, so the boundary suspends once (or not repeatedly) — not flagged.
 */
export const ParallelBoundary: React.FC<{ Children: React.ComponentType }> = ({ Children }) => (
  <Suspense fallback={<div>Loading…</div>}>
    <Children />
  </Suspense>
);
