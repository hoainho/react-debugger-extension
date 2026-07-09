/**
 * suspense-waterfall detector (M-E.3, hero #4).
 *
 * Flags a Suspense boundary that RE-SUSPENDS on >=3 consecutive commits — the
 * signature of a data-fetching waterfall (each resolve triggers the next fetch,
 * re-suspending the same boundary again and again). Emits `SUSPENSE_WATERFALL`
 * with a "may be intentional" caveat (some boundaries suspend repeatedly by
 * design). Per-boundary consecutive-suspension streak is tracked via
 * `ctx.write`/`ctx.read`.
 *
 * A boundary is treated as suspended-this-commit when its `memoizedState` is
 * non-null (React attaches SuspenseState while the fallback is shown). Pure
 * helpers are exported for unit testing.
 */
import type { Detector, DetectorContext } from '../../types/registry';
import type { Issue } from '../../types';
import type { FiberNode, ReactVersionAdapter, FiberRoot } from '../react-adapters/types';
import { walkFiberImpl } from '../react-adapters/utils';
import { getAdapter } from '../react-adapters';

const STORE_PREFIX = 'suspense-streak:';
export const WATERFALL_THRESHOLD = 3;

/** A Suspense boundary is showing its fallback when memoizedState is set. */
export function isBoundarySuspended(fiber: FiberNode): boolean {
  const st = (fiber as { memoizedState?: unknown }).memoizedState;
  return st !== null && st !== undefined;
}

/** Consecutive-suspension streak: +1 while suspended, reset to 0 otherwise. */
export function nextStreak(prevStreak: number | undefined, suspendedNow: boolean): number {
  if (!suspendedNow) return 0;
  return (prevStreak ?? 0) + 1;
}

export function shouldFlagWaterfall(streak: number): boolean {
  return streak >= WATERFALL_THRESHOLD;
}

export function createSuspenseWaterfallDetector(): Detector<Issue> {
  let ctx: DetectorContext | null = null;
  let adapter: ReactVersionAdapter | null = null;
  let buffer: Issue[] = [];
  let seq = 0;

  function buildPath(fiber: FiberNode, ad: ReactVersionAdapter): string[] {
    const path: string[] = [];
    let cur: FiberNode | null = fiber;
    let limit = 50;
    while (cur && limit-- > 0) {
      const name = ad.getDisplayName(cur);
      if (name) path.unshift(name);
      cur = cur.return;
    }
    return path;
  }

  return {
    id: 'suspense-waterfall',
    category: 'performance',
    budgetMs: 0.3,
    confidence: 'medium',
    prodCapable: true,

    init(injected: DetectorContext): void {
      ctx = injected;
      try {
        adapter = getAdapter();
      } catch {
        adapter = null;
      }
    },

    onCommit(fiberRoot: unknown, deadline: number): void {
      const context = ctx;
      const ad = adapter;
      if (context === null || ad === null) return;
      const root = fiberRoot as FiberRoot | null;
      if (!root || !root.current) return;
      const suspenseTag = ad.FIBER_TAGS.SuspenseComponent;

      walkFiberImpl(root.current, (fiber) => {
        if (context.performance.now() > deadline) return;
        if (fiber.tag !== suspenseTag) return;

        const path = buildPath(fiber, ad);
        const key = STORE_PREFIX + (path.length ? path.join('/') : `suspense-${seq}`);
        const streak = nextStreak(context.read<number>(key), isBoundarySuspended(fiber));
        context.write<number>(key, streak);

        if (!shouldFlagWaterfall(streak)) return;
        if (!context.dedupe(key)) return;
        buffer.push({
          id: `suspense-waterfall-${seq++}`,
          type: 'SUSPENSE_WATERFALL',
          severity: 'warning',
          component: 'Suspense',
          message: `Suspense boundary re-suspended ${streak} commits in a row (possible fetch waterfall) — may be intentional`,
          suggestion:
            'If unintentional, hoist data fetching (prefetch in parallel) or coalesce the boundaries so children resolve together.',
          timestamp: Date.now(),
          fiberId: key,
          location: { componentName: 'Suspense', componentPath: path },
        });
      });
    },

    drain(): Issue[] {
      const out = buffer;
      buffer = [];
      return out;
    },

    teardown(): void {
      buffer = [];
      seq = 0;
      ctx = null;
      adapter = null;
    },
  };
}

export const suspenseWaterfallDetector = createSuspenseWaterfallDetector();
